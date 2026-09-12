/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 2 — CHAIN INTEGRITY VALIDATOR
 * SecureChain Pay — Real-Time Blockchain Tamper Detection Engine
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getAdminDb } from '@/lib/firebase/admin';
import { calculateCanonicalBlockHash, sha256Hex } from '@/lib/crypto/canonical-hash';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BlockIntegrityStatus =
  | 'VALID'
  | 'HASH_MISMATCH'
  | 'PREVIOUS_HASH_BROKEN'
  | 'ORPHANED'
  | 'GENESIS';

export interface BlockIntegrityResult {
  blockId: string;
  blockNumber: number;
  status: BlockIntegrityStatus;
  storedHash: string;
  computedHash: string;
  previousHash: string;
  previousBlockId: string | null;
  hashMatch: boolean;
  chainContinuous: boolean;
  timestamp: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: string;
  type: string;
}

export interface ChainIntegrityReport {
  reportId: string;
  generatedAt: string;
  durationMs: number;
  totalBlocksScanned: number;
  validBlocks: number;
  tamperedBlocks: number;
  brokenLinks: number;
  orphanedBlocks: number;
  sequenceGaps: number[];
  genesisHashVerified: boolean;
  genesisHash: string;
  lastBlockHash: string;
  lastBlockNumber: number;
  chainHealthScore: number; // 0-100
  overallStatus: 'INTACT' | 'COMPROMISED' | 'PARTIALLY_COMPROMISED' | 'EMPTY';
  results: BlockIntegrityResult[];
  summary: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GLOBAL_BLOCKS = 'global_blocks';
const GLOBAL_META = 'global_chain_meta';
const CHAIN_STATE_DOC = 'chain_state';
const GENESIS_BLOCK_ID = 'GENESIS';
const GENESIS_SEED = 'genesis:securechainpay:global:v1';

// ─── Core Validator ───────────────────────────────────────────────────────────

export class ChainIntegrityValidator {
  /**
   * Performs a full chain traversal and integrity audit.
   * Returns a structured ChainIntegrityReport.
   */
  public static async validateFullChain(options?: { maxBlocks?: number }): Promise<ChainIntegrityReport> {
    const startMs = Date.now();
    const reportId = `REPORT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const generatedAt = new Date().toISOString();
    const maxBlocks = options?.maxBlocks ?? 500;

    const adminDb = getAdminDb();
    const results: BlockIntegrityResult[] = [];

    // 1. Load all global blocks
    let allBlocksSnap: FirebaseFirestore.QuerySnapshot;
    try {
      allBlocksSnap = await adminDb.collection(GLOBAL_BLOCKS).limit(maxBlocks).get();
    } catch (err: any) {
      return ChainIntegrityValidator.buildEmptyReport(reportId, generatedAt, startMs, `Failed to load blocks: ${err.message}`);
    }

    if (allBlocksSnap.empty) {
      return ChainIntegrityValidator.buildEmptyReport(reportId, generatedAt, startMs, 'No blocks found in chain');
    }

    // 2. Load chain meta
    let genesisHash = '';
    let lastBlockHash = '';
    let lastBlockNumber = 0;
    try {
      const metaSnap = await adminDb.collection(GLOBAL_META).doc(CHAIN_STATE_DOC).get();
      if (metaSnap.exists) {
        const meta = metaSnap.data()!;
        genesisHash = meta.genesisHash || '';
        lastBlockHash = meta.lastBlockHash || '';
        lastBlockNumber = meta.lastBlockNumber || 0;
      }
    } catch { /* non-fatal */ }

    // 3. Sort blocks by blockNumber
    const rawBlocks = allBlocksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const sortedBlocks = rawBlocks.sort((a: any, b: any) => (a.blockNumber || 0) - (b.blockNumber || 0));

    // 4. Verify genesis
    let genesisHashVerified = false;
    const genesisBlock = sortedBlocks.find((b: any) => b.type === 'genesis' || b.id === GENESIS_BLOCK_ID);
    if (genesisBlock) {
      const expectedGenesisHash = await sha256Hex(GENESIS_SEED);
      genesisHashVerified = (genesisBlock.hash || '').toLowerCase() === expectedGenesisHash.toLowerCase();

      results.push({
        blockId: genesisBlock.id,
        blockNumber: 0,
        status: genesisHashVerified ? 'GENESIS' : 'HASH_MISMATCH',
        storedHash: genesisBlock.hash || '',
        computedHash: expectedGenesisHash,
        previousHash: '0',
        previousBlockId: null,
        hashMatch: genesisHashVerified,
        chainContinuous: true,
        timestamp: genesisBlock.createdAt || genesisBlock.date || '',
        sender: genesisBlock.sender || '0x0000',
        receiver: genesisBlock.receiver || '0x0000',
        amount: 0,
        currency: 'HSCT',
        type: 'genesis',
      });
    }

    // 5. Validate each non-genesis block
    const nonGenesisBlocks = sortedBlocks.filter((b: any) => b.type !== 'genesis' && b.id !== GENESIS_BLOCK_ID);
    const blockHashMap = new Map<number, string>(); // blockNumber => hash
    if (genesisBlock) blockHashMap.set(0, genesisBlock.hash || '');

    const sequenceGaps: number[] = [];
    let previousBlockNumber = 0;

    for (const block of nonGenesisBlocks) {
      const bn = Number(block.blockNumber || 0);

      // Detect sequence gaps
      if (bn > previousBlockNumber + 1) {
        for (let gap = previousBlockNumber + 1; gap < bn; gap++) {
          sequenceGaps.push(gap);
        }
      }
      previousBlockNumber = bn;

      // Compute canonical hash for this block
      let computedHash = '';
      let hashMatch = false;
      const storedHash = block.hash || block.transactionHash || '';

      try {
        computedHash = await calculateCanonicalBlockHash({
          blockNumber: bn,
          previousHash: block.previousHash || '0',
          sender: block.sender || '',
          receiver: block.receiver || '',
          amount: Number(block.amount || 0),
          currency: (block.currency || 'HSCT').toUpperCase(),
          date: block.date || block.createdAt || '',
          type: block.type || 'transfer',
          idempotencyKey: block.idempotencyKey || block.id,
        });
        hashMatch = storedHash.toLowerCase() === computedHash.toLowerCase();
      } catch {
        computedHash = 'HASH_COMPUTATION_FAILED';
        hashMatch = false;
      }

      // Check chain continuity
      const expectedPreviousHash = blockHashMap.get(bn - 1) || '';
      const chainContinuous = (block.previousHash || '').toLowerCase() === expectedPreviousHash.toLowerCase()
        || expectedPreviousHash === '';

      const isOrphaned = bn > 1 && !blockHashMap.has(bn - 1);

      let status: BlockIntegrityStatus = 'VALID';
      if (!hashMatch) {
        status = 'HASH_MISMATCH';
      } else if (!chainContinuous && !isOrphaned) {
        status = 'PREVIOUS_HASH_BROKEN';
      } else if (isOrphaned) {
        status = 'ORPHANED';
      }

      blockHashMap.set(bn, storedHash);

      results.push({
        blockId: block.id,
        blockNumber: bn,
        status,
        storedHash,
        computedHash,
        previousHash: block.previousHash || '0',
        previousBlockId: null,
        hashMatch,
        chainContinuous: chainContinuous && !isOrphaned,
        timestamp: block.createdAt || block.date || '',
        sender: block.sender || '',
        receiver: block.receiver || '',
        amount: Number(block.amount || 0),
        currency: (block.currency || 'HSCT').toUpperCase(),
        type: block.type || 'transfer',
      });
    }

    // 6. Compute summary stats
    const totalBlocksScanned = results.length;
    const validBlocks = results.filter(r => r.status === 'VALID' || r.status === 'GENESIS').length;
    const tamperedBlocks = results.filter(r => r.status === 'HASH_MISMATCH').length;
    const brokenLinks = results.filter(r => r.status === 'PREVIOUS_HASH_BROKEN').length;
    const orphanedBlocks = results.filter(r => r.status === 'ORPHANED').length;

    const chainHealthScore = totalBlocksScanned === 0
      ? 100
      : Math.max(0, Math.round((validBlocks / totalBlocksScanned) * 100));

    let overallStatus: ChainIntegrityReport['overallStatus'];
    if (totalBlocksScanned === 0) {
      overallStatus = 'EMPTY';
    } else if (tamperedBlocks === 0 && brokenLinks === 0 && sequenceGaps.length === 0) {
      overallStatus = 'INTACT';
    } else if (chainHealthScore >= 80) {
      overallStatus = 'PARTIALLY_COMPROMISED';
    } else {
      overallStatus = 'COMPROMISED';
    }

    const summary = overallStatus === 'INTACT'
      ? `All ${totalBlocksScanned} blocks verified — chain is cryptographically intact.`
      : `Chain audit: ${tamperedBlocks} tampered, ${brokenLinks} broken links, ${sequenceGaps.length} sequence gaps detected.`;

    return {
      reportId,
      generatedAt,
      durationMs: Date.now() - startMs,
      totalBlocksScanned,
      validBlocks,
      tamperedBlocks,
      brokenLinks,
      orphanedBlocks,
      sequenceGaps,
      genesisHashVerified,
      genesisHash: genesisHash || (genesisBlock?.hash ?? ''),
      lastBlockHash,
      lastBlockNumber,
      chainHealthScore,
      overallStatus,
      results,
      summary,
    };
  }

  private static buildEmptyReport(
    reportId: string,
    generatedAt: string,
    startMs: number,
    summary: string
  ): ChainIntegrityReport {
    return {
      reportId,
      generatedAt,
      durationMs: Date.now() - startMs,
      totalBlocksScanned: 0,
      validBlocks: 0,
      tamperedBlocks: 0,
      brokenLinks: 0,
      orphanedBlocks: 0,
      sequenceGaps: [],
      genesisHashVerified: false,
      genesisHash: '',
      lastBlockHash: '',
      lastBlockNumber: 0,
      chainHealthScore: 100,
      overallStatus: 'EMPTY',
      results: [],
      summary,
    };
  }
}
