import { getAdminDb } from '@/lib/firebase/admin';
import { sha256Hex } from '@/lib/crypto/canonical-hash';
import { BlockchainWriteService } from '@/lib/blockchain/blockchain-write-service';
import { SmartContractService } from '@/lib/blockchain/smart-contract-service';
import { TrustedCheckpointService } from '@/lib/security/trusted-checkpoint-service';
import { TrustedCheckpoint, IncidentRecord } from '@/lib/security/security-state-types';

export interface ValidatedRecoverySource {
  genesisValid: boolean;
  genesisHash: string;
  checkpoint: TrustedCheckpoint | null;
  historicalBlocks: any[];
  corruptedBlocks: any[];
  maxTrustedBlockNumber: number;
}

export class RecoverySourceService {
  private static GLOBAL_BLOCKS = 'global_blocks';
  private static EXPECTED_GENESIS_SEED = 'genesis:securechainpay:global:v1';

  /**
   * Validates Genesis Block #0 deterministically.
   * NEVER generates a replacement Genesis automatically if mismatched.
   */
  public static async validateGenesis(): Promise<{
    valid: boolean;
    genesisHash: string;
    expectedHash: string;
    error?: string;
  }> {
    const expectedHash = await sha256Hex(this.EXPECTED_GENESIS_SEED);
    const adminDb = getAdminDb();

    let genesisBlockData: any = null;
    try {
      const snap = await adminDb.collection(this.GLOBAL_BLOCKS).doc('GENESIS').get();
      if (snap.exists) {
        genesisBlockData = snap.data();
      }
    } catch (_) {}

    if (!genesisBlockData) {
      // Check block 0 by query
      try {
        const q = await adminDb
          .collection(this.GLOBAL_BLOCKS)
          .where('blockNumber', '==', 0)
          .limit(1)
          .get();
        if (!q.empty) {
          genesisBlockData = q.docs[0].data();
        }
      } catch (_) {}
    }

    if (!genesisBlockData) {
      return {
        valid: false,
        genesisHash: '',
        expectedHash,
        error: 'GENESIS_BLOCK_MISSING: Genesis Block #0 was not found in storage.',
      };
    }

    const storedHash = (genesisBlockData.hash || genesisBlockData.transactionHash || '').toLowerCase();
    const isGenesisMatch = storedHash === expectedHash.toLowerCase();

    if (!isGenesisMatch) {
      return {
        valid: false,
        genesisHash: storedHash,
        expectedHash,
        error: `GENESIS_HASH_MISMATCH: Stored genesis ${storedHash} does not match expected canonical root ${expectedHash}`,
      };
    }

    // Also check on-chain Genesis if available
    try {
      const onChainConsistent = await SmartContractService.verifyGenesisConsistency(expectedHash);
      if (!onChainConsistent) {
        console.warn('[RecoverySourceService] On-chain smart contract genesis verification failed or contract offline.');
      }
    } catch (_) {}

    return {
      valid: true,
      genesisHash: expectedHash,
      expectedHash,
    };
  }

  /**
   * Loads and validates the recovery source for a given incident.
   * Identifies trusted checkpoint and separates historical blocks from corrupted blocks.
   */
  public static async validateAndPrepareSource(incidentId?: string): Promise<ValidatedRecoverySource> {
    const genesisResult = await this.validateGenesis();
    if (!genesisResult.valid) {
      throw new Error(genesisResult.error || 'Genesis validation failed');
    }

    // 1. Identify Trusted Checkpoint
    let checkpoint = await TrustedCheckpointService.getLatestCheckpoint();
    let maxTrustedBlockNumber = 0;

    // If incident specifies a lastTrustedBlock, use that boundary
    if (incidentId) {
      try {
        const adminDb = getAdminDb();
        const incSnap = await adminDb.collection('securityIncidents').doc(incidentId).get();
        if (incSnap.exists) {
          const incData = incSnap.data() as IncidentRecord;
          if (typeof incData.lastTrustedBlock === 'number' && incData.lastTrustedBlock >= 0) {
            maxTrustedBlockNumber = incData.lastTrustedBlock;
          }
        }
      } catch (_) {}
    }

    if (checkpoint && checkpoint.blockNumber > 0) {
      maxTrustedBlockNumber = Math.max(maxTrustedBlockNumber, checkpoint.blockNumber);
    }

    // 2. Fetch all raw blocks from database
    const adminDb = getAdminDb();
    const snap = await adminDb.collection(this.GLOBAL_BLOCKS).get();
    const allRawBlocks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    // Sort by blockNumber ascending
    allRawBlocks.sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));

    // 3. Partition into candidate historical blocks (<= maxTrustedBlockNumber) and corrupted/post-checkpoint blocks
    const historicalBlocks: any[] = [];
    const corruptedBlocks: any[] = [];

    for (const b of allRawBlocks) {
      const bn = Number(b.blockNumber ?? 0);
      if (bn <= maxTrustedBlockNumber) {
        historicalBlocks.push(b);
      } else {
        corruptedBlocks.push(b);
      }
    }

    return {
      genesisValid: true,
      genesisHash: genesisResult.genesisHash,
      checkpoint,
      historicalBlocks,
      corruptedBlocks,
      maxTrustedBlockNumber,
    };
  }
}
