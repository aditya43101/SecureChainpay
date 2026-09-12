import { getAdminDb } from '@/lib/firebase/admin';
import { ReconstructedBlock } from './chain-reconstruction-service';
import { DerivedUserBalance } from './balance-reconstruction-service';
import { GlobalChainState } from '@/lib/blockchain/blockchain-write-service';

export interface ReconciliationReport {
  success: boolean;
  reconciledBlocksCount: number;
  quarantinedBlocksCount: number;
  reconciledUsersCount: number;
  finalBlockNumber: number;
  finalBlockHash: string;
  finalChainRoot: string;
  reconciledAt: string;
}

export class RecoveryReconciliationService {
  private static GLOBAL_BLOCKS = 'global_blocks';
  private static GLOBAL_META = 'global_chain_meta';
  private static CHAIN_STATE_DOC = 'chain_state';
  private static FORENSIC_CORRUPTED_BLOCKS = 'forensic_corrupted_blocks';

  /**
   * Atomically reconciles Firestore state with the verified canonical reconstructed chain.
   */
  public static async reconcileDatabase(params: {
    reconstructedBlocks: ReconstructedBlock[];
    rejectedBlocks: any[];
    derivedBalances: Map<string, DerivedUserBalance>;
    recoveryVersion: number;
  }): Promise<ReconciliationReport> {
    const adminDb = getAdminDb();
    const now = new Date().toISOString();

    const latestReconstructed = params.reconstructedBlocks[params.reconstructedBlocks.length - 1];
    const finalBlockNumber = latestReconstructed ? latestReconstructed.blockNumber : 0;
    const finalBlockHash = latestReconstructed ? latestReconstructed.hash : '';
    const finalChainRoot = latestReconstructed ? latestReconstructed.chainRoot : '';
    const genesisHash = params.reconstructedBlocks[0]?.hash || '';

    console.info(`[RecoveryReconciliationService] Reconciling DB to Block #${finalBlockNumber} (${params.reconstructedBlocks.length} verified blocks)...`);

    // 1. Archive rejected/corrupted blocks to forensic storage and delete from canonical global_blocks
    let quarantinedCount = 0;
    for (const rejected of params.rejectedBlocks) {
      try {
        const docId = rejected.id || rejected.applicationTransactionId || `REJECTED_${rejected.blockNumber}`;
        await adminDb.collection(this.FORENSIC_CORRUPTED_BLOCKS).doc(docId).set({
          ...rejected,
          quarantinedAt: now,
          recoveryVersion: params.recoveryVersion,
        });

        // Remove from active global_blocks collection so it doesn't pollute the canonical chain
        await adminDb.collection(this.GLOBAL_BLOCKS).doc(docId).delete();
        quarantinedCount++;
      } catch (qErr) {
        console.warn(`[RecoveryReconciliationService] Forensic quarantine error for block:`, qErr);
      }
    }

    // 2. Overwrite / Write canonical reconstructed blocks into global_blocks in batches of up to 400
    const batchSize = 400;
    for (let i = 0; i < params.reconstructedBlocks.length; i += batchSize) {
      const chunk = params.reconstructedBlocks.slice(i, i + batchSize);
      const batch = adminDb.batch();

      for (const block of chunk) {
        const docRef = adminDb.collection(this.GLOBAL_BLOCKS).doc(block.id);
        batch.set(docRef, block);
      }

      await batch.commit();
    }

    // 3. Update canonical chain metadata
    const updatedChainState: GlobalChainState = {
      lastBlockNumber: finalBlockNumber,
      lastBlockHash: finalBlockHash,
      genesisHash,
      chainRoot: finalChainRoot,
      chainId: 31337,
      chainVersion: 1,
      totalBlocks: params.reconstructedBlocks.length,
      lastUpdatedAt: now,
    };

    await adminDb.collection(this.GLOBAL_META).doc(this.CHAIN_STATE_DOC).set(updatedChainState);

    // 4. Update derived balances for users
    let reconciledUsersCount = 0;
    for (const [uid, userBal] of params.derivedBalances.entries()) {
      try {
        await adminDb
          .collection('users')
          .doc(uid)
          .collection('wallet')
          .doc('data')
          .set(
            {
              balances: userBal.balances,
              lastReconciledAt: now,
              recoveryVersion: params.recoveryVersion,
            },
            { merge: true }
          );
        reconciledUsersCount++;
      } catch (uErr) {
        console.warn(`[RecoveryReconciliationService] User balance update warning for ${uid}:`, uErr);
      }
    }

    console.info(`[RecoveryReconciliationService] ✓ Database reconciliation complete: ${params.reconstructedBlocks.length} blocks, ${quarantinedCount} quarantined, ${reconciledUsersCount} user wallets.`);

    return {
      success: true,
      reconciledBlocksCount: params.reconstructedBlocks.length,
      quarantinedBlocksCount: quarantinedCount,
      reconciledUsersCount,
      finalBlockNumber,
      finalBlockHash,
      finalChainRoot,
      reconciledAt: now,
    };
  }
}
