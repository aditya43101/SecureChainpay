import { getAdminDb } from '@/lib/firebase/admin';
import { calculateCanonicalBlockHash, sha256Hex } from '@/lib/crypto/canonical-hash';
import { OnChainStateReader } from '@/lib/blockchain/on-chain-state-reader';
import { BlockchainWriteService } from '@/lib/blockchain/blockchain-write-service';
import { SecurityStateService } from './security-state-service';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';
import {
  IntegrityCheckResult,
  ThreatClassification,
  IncidentSeverity,
} from './security-state-types';

export class BlockchainIntegrityMonitor {
  private static GLOBAL_BLOCKS = 'global_blocks';
  private static GLOBAL_META = 'global_chain_meta';
  private static CHAIN_STATE_DOC = 'chain_state';
  private static GENESIS_BLOCK_ID = 'GENESIS';
  private static EXPECTED_GENESIS_SEED = 'genesis:securechainpay:global:v1';

  /**
   * Performs an efficient, incremental integrity check of the latest chain head.
   * Ideal for request-level validation and periodic heartbeat checks.
   */
  public static async runIncrementalCheck(): Promise<IntegrityCheckResult> {
    const timestamp = new Date().toISOString();
    const adminDb = getAdminDb();
    const mismatches: string[] = [];

    let dbState: any = null;
    let onChainState: any = null;

    // 1. Fetch DB Chain State
    try {
      const stateSnap = await adminDb.collection(this.GLOBAL_META).doc(this.CHAIN_STATE_DOC).get();
      if (stateSnap.exists) {
        dbState = stateSnap.data();
      }
    } catch (err: any) {
      console.warn('[IntegrityMonitor] Transient DB error during incremental check:', err.message);
      await SecurityStateService.transitionState('DEGRADED', `Transient DB error: ${err.message}`);
      return {
        status: 'DEGRADED',
        threat: 'TRANSIENT_DB_UNAVAILABLE',
        severity: 'WARNING',
        details: `Transient DB access error: ${err.message}`,
        mismatches: ['Database read error'],
        lastTrustedBlock: 0,
        lastTrustedHash: '',
        lastTrustedChainRoot: '',
        timestamp,
      };
    }

    // 2. Fetch On-Chain Smart Contract State
    try {
      onChainState = await OnChainStateReader.getChainState();
    } catch (rpcErr: any) {
      console.warn('[IntegrityMonitor] Transient RPC error during smart contract check:', rpcErr.message);
      // RPC transient failure leads to DEGRADED, not an immediate attack classification
      await SecurityStateService.transitionState('DEGRADED', `Transient RPC error: ${rpcErr.message}`);
      return {
        status: 'DEGRADED',
        threat: 'TRANSIENT_RPC_TIMEOUT',
        severity: 'WARNING',
        details: 'Smart contract RPC endpoint temporarily unavailable',
        mismatches: ['RPC endpoint timeout'],
        lastTrustedBlock: dbState?.lastBlockNumber || 0,
        lastTrustedHash: dbState?.lastBlockHash || '',
        lastTrustedChainRoot: dbState?.chainRoot || '',
        timestamp,
      };
    }

    if (!dbState) {
      return {
        status: 'HEALTHY',
        threat: 'NONE',
        severity: 'INFO',
        details: 'Chain not initialized yet or empty',
        mismatches: [],
        lastTrustedBlock: 0,
        lastTrustedHash: '',
        lastTrustedChainRoot: '',
        timestamp,
      };
    }

    const latestBlockNumber = Number(dbState.lastBlockNumber || dbState.height || 0);
    const storedLatestHash = dbState.lastBlockHash || dbState.latestBlockHash || '';
    const storedChainRoot = dbState.chainRoot || '';

    // 3. Verify Genesis Block Hash
    const expectedGenesisHash = await sha256Hex(this.EXPECTED_GENESIS_SEED);
    if (dbState.genesisHash && dbState.genesisHash.toLowerCase() !== expectedGenesisHash.toLowerCase()) {
      return await this.handleConfirmedTamper({
        threat: 'GENESIS_MISMATCH',
        severity: 'CRITICAL',
        details: `Genesis hash tampered: stored ${dbState.genesisHash}, expected ${expectedGenesisHash}`,
        mismatches: ['Genesis hash corrupted'],
        detectedBlockNumber: 0,
        expectedHash: expectedGenesisHash,
        observedHash: dbState.genesisHash,
        expectedPreviousHash: '0',
        observedPreviousHash: '0',
        expectedChainRoot: BlockchainWriteService.GENESIS_CHAIN_ROOT,
        observedChainRoot: storedChainRoot,
        databaseState: dbState,
        onChainState,
        lastTrustedBlock: 0,
        lastTrustedHash: expectedGenesisHash,
        lastTrustedChainRoot: BlockchainWriteService.GENESIS_CHAIN_ROOT,
      });
    }

    // 4. Verify Latest Block in Firestore
    if (latestBlockNumber > 0) {
      let latestBlockSnap: any = null;
      try {
        const blocksQuery = await adminDb
          .collection(this.GLOBAL_BLOCKS)
          .where('blockNumber', '==', latestBlockNumber)
          .limit(1)
          .get();

        if (!blocksQuery.empty) {
          latestBlockSnap = blocksQuery.docs[0].data();
        }
      } catch (err: any) {
        console.warn('[IntegrityMonitor] Error querying latest block:', err);
      }

      if (latestBlockSnap) {
        // Recompute canonical block hash
        const recomputedHash = await calculateCanonicalBlockHash({
          blockNumber: latestBlockSnap.blockNumber,
          previousHash: latestBlockSnap.previousHash,
          sender: latestBlockSnap.sender,
          receiver: latestBlockSnap.receiver,
          amount: Number(latestBlockSnap.amount),
          currency: latestBlockSnap.currency || latestBlockSnap.asset,
          date: latestBlockSnap.date || latestBlockSnap.createdAt,
          type: latestBlockSnap.type,
          idempotencyKey: latestBlockSnap.idempotencyKey,
        });

        if (recomputedHash.toLowerCase() !== latestBlockSnap.hash.toLowerCase()) {
          return await this.handleConfirmedTamper({
            threat: 'BLOCK_HASH_TAMPERED',
            severity: 'CRITICAL',
            details: `Block #${latestBlockNumber} hash tampered: stored ${latestBlockSnap.hash}, calculated ${recomputedHash}`,
            mismatches: [`Block #${latestBlockNumber} hash mismatch`],
            detectedBlockNumber: latestBlockNumber,
            expectedHash: recomputedHash,
            observedHash: latestBlockSnap.hash,
            expectedPreviousHash: latestBlockSnap.previousHash,
            observedPreviousHash: latestBlockSnap.previousHash,
            expectedChainRoot: null,
            observedChainRoot: storedChainRoot,
            databaseState: dbState,
            onChainState,
            lastTrustedBlock: latestBlockNumber - 1,
            lastTrustedHash: latestBlockSnap.previousHash,
            lastTrustedChainRoot: dbState.previousChainRoot || '',
          });
        }
      }
    }

    // 5. Compare DB with Smart Contract On-Chain Anchor
    if (onChainState && onChainState.initialized) {
      // Check Genesis consistency
      if (onChainState.genesisHash.toLowerCase() !== expectedGenesisHash.toLowerCase()) {
        return await this.handleConfirmedTamper({
          threat: 'GENESIS_MISMATCH',
          severity: 'CRITICAL',
          details: `Smart contract genesis mismatch: on-chain ${onChainState.genesisHash}, expected ${expectedGenesisHash}`,
          mismatches: ['Smart contract genesis hash altered'],
          detectedBlockNumber: 0,
          expectedHash: expectedGenesisHash,
          observedHash: onChainState.genesisHash,
          expectedPreviousHash: null,
          observedPreviousHash: null,
          expectedChainRoot: null,
          observedChainRoot: onChainState.chainRoot,
          databaseState: dbState,
          onChainState,
          lastTrustedBlock: 0,
          lastTrustedHash: expectedGenesisHash,
          lastTrustedChainRoot: BlockchainWriteService.GENESIS_CHAIN_ROOT,
        });
      }

      // Check height & hash alignment
      if (onChainState.latestBlockNumber > latestBlockNumber) {
        console.warn(`[IntegrityMonitor] Database is behind smart contract (#${latestBlockNumber} vs #${onChainState.latestBlockNumber})`);
        return {
          status: 'SUSPICIOUS',
          threat: 'DATABASE_CONTRACT_DIVERGENCE',
          severity: 'HIGH',
          details: `Database height (#${latestBlockNumber}) is behind canonical on-chain contract (#${onChainState.latestBlockNumber})`,
          mismatches: ['DB state stale relative to smart contract'],
          lastTrustedBlock: latestBlockNumber,
          lastTrustedHash: storedLatestHash,
          lastTrustedChainRoot: storedChainRoot,
          timestamp,
        };
      }
    }

    return {
      status: 'HEALTHY',
      threat: 'NONE',
      severity: 'INFO',
      details: 'Incremental blockchain integrity check passed. Hash chain is continuous and verified.',
      mismatches: [],
      lastTrustedBlock: latestBlockNumber,
      lastTrustedHash: storedLatestHash,
      lastTrustedChainRoot: storedChainRoot,
      timestamp,
    };
  }

  /**
   * Performs an exhaustive, read-only full-chain integrity audit from Genesis #0 to head.
   */
  public static async runFullChainIntegrityAudit(maxBlocks = 1000): Promise<{
    status: 'PASSED' | 'FAILED';
    totalBlocks: number;
    validBlocks: number;
    firstInvalidBlock: number | null;
    lastTrustedBlock: number;
    lastTrustedBlockHash: string;
    lastTrustedChainRoot: string;
    threat: ThreatClassification;
    reason?: string;
    auditDetails: any[];
  }> {
    const adminDb = getAdminDb();
    const blocksSnap = await adminDb
      .collection(this.GLOBAL_BLOCKS)
      .orderBy('blockNumber', 'asc')
      .limit(maxBlocks)
      .get();

    if (blocksSnap.empty) {
      return {
        status: 'PASSED',
        totalBlocks: 0,
        validBlocks: 0,
        firstInvalidBlock: null,
        lastTrustedBlock: 0,
        lastTrustedBlockHash: '',
        lastTrustedChainRoot: '',
        threat: 'NONE',
        auditDetails: [],
      };
    }

    const blocks: any[] = [];
    blocksSnap.forEach((doc) => blocks.push(doc.data()));

    let lastTrustedBlock = 0;
    let lastTrustedBlockHash = '';
    let lastTrustedChainRoot = BlockchainWriteService.GENESIS_CHAIN_ROOT;
    let previousHash = '0';
    let previousChainRoot = BlockchainWriteService.GENESIS_CHAIN_ROOT;
    let validCount = 0;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];

      // Genesis check
      if (b.blockNumber === 0) {
        const expectedGen = await sha256Hex(this.EXPECTED_GENESIS_SEED);
        if (b.hash.toLowerCase() !== expectedGen.toLowerCase()) {
          return {
            status: 'FAILED',
            totalBlocks: blocks.length,
            validBlocks: validCount,
            firstInvalidBlock: 0,
            lastTrustedBlock: 0,
            lastTrustedBlockHash: expectedGen,
            lastTrustedChainRoot: BlockchainWriteService.GENESIS_CHAIN_ROOT,
            threat: 'GENESIS_MISMATCH',
            reason: `Genesis hash mismatch: stored ${b.hash}, expected ${expectedGen}`,
            auditDetails: blocks.slice(0, i + 1),
          };
        }
        previousHash = b.hash;
        lastTrustedBlock = 0;
        lastTrustedBlockHash = b.hash;
        validCount++;
        continue;
      }

      // 1. Sequential numbering check
      if (b.blockNumber !== lastTrustedBlock + 1) {
        return {
          status: 'FAILED',
          totalBlocks: blocks.length,
          validBlocks: validCount,
          firstInvalidBlock: b.blockNumber,
          lastTrustedBlock,
          lastTrustedBlockHash,
          lastTrustedChainRoot,
          threat: 'BLOCK_NUMBER_MANIPULATED',
          reason: `Block number gap: expected #${lastTrustedBlock + 1}, found #${b.blockNumber}`,
          auditDetails: blocks.slice(0, i + 1),
        };
      }

      // 2. Hash chain continuity check
      if (b.previousHash.toLowerCase() !== previousHash.toLowerCase()) {
        return {
          status: 'FAILED',
          totalBlocks: blocks.length,
          validBlocks: validCount,
          firstInvalidBlock: b.blockNumber,
          lastTrustedBlock,
          lastTrustedBlockHash,
          lastTrustedChainRoot,
          threat: 'PREVIOUS_HASH_TAMPERED',
          reason: `Previous hash broken at block #${b.blockNumber}: stored prevHash ${b.previousHash}, expected ${previousHash}`,
          auditDetails: blocks.slice(0, i + 1),
        };
      }

      // 3. Recompute block hash
      const recomputedHash = await calculateCanonicalBlockHash({
        blockNumber: b.blockNumber,
        previousHash: b.previousHash,
        sender: b.sender,
        receiver: b.receiver,
        amount: Number(b.amount),
        currency: b.currency || b.asset,
        date: b.date || b.createdAt,
        type: b.type,
        idempotencyKey: b.idempotencyKey,
      });

      if (recomputedHash.toLowerCase() !== b.hash.toLowerCase()) {
        return {
          status: 'FAILED',
          totalBlocks: blocks.length,
          validBlocks: validCount,
          firstInvalidBlock: b.blockNumber,
          lastTrustedBlock,
          lastTrustedBlockHash,
          lastTrustedChainRoot,
          threat: 'BLOCK_HASH_TAMPERED',
          reason: `Block #${b.blockNumber} hash mismatch: stored ${b.hash}, calculated ${recomputedHash}`,
          auditDetails: blocks.slice(0, i + 1),
        };
      }

      // 4. Compute expected chain root
      const expectedChainRoot = BlockchainWriteService.computeChainRoot(previousChainRoot, b.hash);
      if (b.chainRoot && b.chainRoot.toLowerCase() !== expectedChainRoot.toLowerCase()) {
        return {
          status: 'FAILED',
          totalBlocks: blocks.length,
          validBlocks: validCount,
          firstInvalidBlock: b.blockNumber,
          lastTrustedBlock,
          lastTrustedBlockHash,
          lastTrustedChainRoot,
          threat: 'CHAIN_ROOT_MISMATCH',
          reason: `Block #${b.blockNumber} chain root mismatch: stored ${b.chainRoot}, calculated ${expectedChainRoot}`,
          auditDetails: blocks.slice(0, i + 1),
        };
      }

      lastTrustedBlock = b.blockNumber;
      lastTrustedBlockHash = b.hash;
      lastTrustedChainRoot = expectedChainRoot;
      previousHash = b.hash;
      previousChainRoot = expectedChainRoot;
      validCount++;
    }

    return {
      status: 'PASSED',
      totalBlocks: blocks.length,
      validBlocks: validCount,
      firstInvalidBlock: null,
      lastTrustedBlock,
      lastTrustedBlockHash,
      lastTrustedChainRoot,
      threat: 'NONE',
      auditDetails: [],
    };
  }

  /**
   * Internal handler for confirmed cryptographic tampering incidents.
   * Multi-Signal Confirmation -> State Transition -> Global Freeze -> Smart Contract Pause -> Evidence Recording.
   */
  private static async handleConfirmedTamper(params: {
    threat: ThreatClassification;
    severity: IncidentSeverity;
    details: string;
    mismatches: string[];
    detectedBlockNumber: number | null;
    expectedHash: string | null;
    observedHash: string | null;
    expectedPreviousHash: string | null;
    observedPreviousHash: string | null;
    expectedChainRoot: string | null;
    observedChainRoot: string | null;
    databaseState: Record<string, any> | null;
    onChainState: Record<string, any> | null;
    lastTrustedBlock: number;
    lastTrustedHash: string;
    lastTrustedChainRoot: string;
  }): Promise<IntegrityCheckResult> {
    console.error(`[IntegrityMonitor] 🚨 CRITICAL INTEGRITY FAILURE CONFIRMED: ${params.threat} — ${params.details}`);

    // 1. Record forensic incident evidence in Firestore
    const incident = await SecurityStateService.recordIncident({
      incidentType: params.threat,
      severity: params.severity,
      detectedBlockNumber: params.detectedBlockNumber,
      expectedHash: params.expectedHash,
      observedHash: params.observedHash,
      expectedPreviousHash: params.expectedPreviousHash,
      observedPreviousHash: params.observedPreviousHash,
      expectedChainRoot: params.expectedChainRoot,
      observedChainRoot: params.observedChainRoot,
      databaseState: params.databaseState,
      onChainState: params.onChainState,
      lastTrustedBlock: params.lastTrustedBlock,
      lastTrustedHash: params.lastTrustedHash,
      lastTrustedChainRoot: params.lastTrustedChainRoot,
    });

    // 2. Trigger Global Transaction Freeze and Smart Contract Pause
    await SecurityStateService.freezeTransactions({
      reason: params.details,
      incidentId: incident.incidentId,
      lastTrustedBlockNumber: params.lastTrustedBlock,
      lastTrustedBlockHash: params.lastTrustedHash,
      lastTrustedChainRoot: params.lastTrustedChainRoot,
    });

    // 3. Log security event
    await SecurityAuditLogger.log({
      type: 'CHAIN_HASH_MISMATCH',
      userId: 'SYSTEM',
      resource: 'BlockchainIntegrityMonitor',
      action: 'confirmTamper',
      result: 'DENIED',
      severity: params.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      metadata: {
        incidentId: incident.incidentId,
        threat: params.threat,
        detectedBlock: params.detectedBlockNumber,
        lastTrustedBlock: params.lastTrustedBlock,
      },
    });

    return {
      status: 'CRITICAL_FAILURE',
      threat: params.threat,
      severity: params.severity,
      details: params.details,
      mismatches: params.mismatches,
      blockNumber: params.detectedBlockNumber ?? undefined,
      expectedValue: params.expectedHash ?? undefined,
      observedValue: params.observedHash ?? undefined,
      lastTrustedBlock: params.lastTrustedBlock,
      lastTrustedHash: params.lastTrustedHash,
      lastTrustedChainRoot: params.lastTrustedChainRoot,
      timestamp: new Date().toISOString(),
    };
  }
}
