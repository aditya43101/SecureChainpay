import { getAdminDb } from '../firebase/admin';
import { OnChainAnchorState } from './smart-contract-service';
import { GlobalChainState } from './global-chain';

export interface DivergenceReport {
  isDivergent: boolean;
  mismatches: string[];
  dbState: Partial<GlobalChainState> | null;
  onChainState: OnChainAnchorState | null;
  timestamp: string;
}

export class BlockchainReconciliationService {
  /**
   * Compares Firestore DB chain state with Smart Contract state and returns detailed divergence report.
   */
  public static compareDbToChain(
    dbState: GlobalChainState | null,
    onChainState: OnChainAnchorState | null
  ): DivergenceReport {
    const mismatches: string[] = [];
    const timestamp = new Date().toISOString();

    if (!dbState && !onChainState) {
      return { isDivergent: false, mismatches: [], dbState: null, onChainState: null, timestamp };
    }

    if (!dbState) {
      mismatches.push('Database chain state does not exist (missing in Firestore)');
      return { isDivergent: true, mismatches, dbState: null, onChainState, timestamp };
    }

    if (!onChainState) {
      mismatches.push('Smart contract state is unreachable or not initialized on-chain');
      return { isDivergent: true, mismatches, dbState, onChainState: null, timestamp };
    }

    // 1. Check Genesis Hash
    if (dbState.genesisHash.toLowerCase() !== onChainState.genesisHash.toLowerCase()) {
      mismatches.push(
        `Genesis hash mismatch: DB (${dbState.genesisHash}) vs Contract (${onChainState.genesisHash})`
      );
    }

    // 2. Check Height / Latest Block Number
    const dbHeight = dbState.lastBlockNumber ?? (dbState as any).height ?? 0;
    if (dbHeight !== onChainState.latestBlockNumber) {
      mismatches.push(
        `Height mismatch: DB (#${dbHeight}) vs Contract (#${onChainState.latestBlockNumber})`
      );
    }

    // 3. Check Latest Block Hash
    const dbBlockHash = dbState.lastBlockHash ?? (dbState as any).latestBlockHash ?? '';
    if (dbBlockHash.toLowerCase() !== onChainState.latestBlockHash.toLowerCase()) {
      mismatches.push(
        `Latest block hash mismatch: DB (${dbBlockHash}) vs Contract (${onChainState.latestBlockHash})`
      );
    }

    // 4. Check Chain Root (if dbState contains chainRoot)
    if (dbState.chainRoot && dbState.chainRoot.toLowerCase() !== onChainState.chainRoot.toLowerCase()) {
      mismatches.push(
        `Chain root mismatch: DB (${dbState.chainRoot}) vs Contract (${onChainState.chainRoot})`
      );
    }

    // 5. Check Paused status
    if (Boolean(dbState.paused) !== Boolean(onChainState.paused)) {
      mismatches.push(
        `Pause status mismatch: DB (${dbState.paused}) vs Contract (${onChainState.paused})`
      );
    }

    return {
      isDivergent: mismatches.length > 0,
      mismatches,
      dbState,
      onChainState,
      timestamp,
    };
  }

  /**
   * Reconciles a stale database state to match the canonical on-chain smart contract state.
   * CRITICAL: ON-CHAIN CONTRACT IS THE SOURCE OF TRUTH. NEVER OVERWRITE ON-CHAIN CONTRACT.
   */
  public static async reconcileStaleDatabase(
    onChainState: OnChainAnchorState
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getAdminDb();
      const stateRef = db.collection('blockchain_state').doc('global');

      await stateRef.set(
        {
          height: onChainState.latestBlockNumber,
          lastBlockNumber: onChainState.latestBlockNumber,
          latestBlockHash: onChainState.latestBlockHash,
          lastBlockHash: onChainState.latestBlockHash,
          chainRoot: onChainState.chainRoot,
          genesisHash: onChainState.genesisHash,
          chainId: onChainState.chainId,
          chainVersion: onChainState.chainVersion,
          contractAddress: onChainState.contractAddress,
          paused: onChainState.paused,
          blockWriter: onChainState.blockWriter,
          securityAdmin: onChainState.securityAdmin,
          contractAdmin: onChainState.contractAdmin,
          reconciledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.info(`[BlockchainReconciliation] ✓ Reconciled Firestore DB to on-chain height #${onChainState.latestBlockNumber}`);
      return { success: true };
    } catch (error: any) {
      console.error('[BlockchainReconciliation] Failed to reconcile DB:', error);
      return { success: false, error: error?.message || 'Database update failed' };
    }
  }

  /**
   * Handles partial failures (e.g. smart contract commit succeeded, but Firestore write failed).
   * Writes the pending transaction/block to the `pending_reconciliation` collection.
   */
  public static async recordPendingReconciliation(params: {
    blockNumber: number;
    blockHash: string;
    txHash?: string;
    candidateBlock?: any;
    errorReason: string;
  }): Promise<void> {
    try {
      const db = getAdminDb();
      const ref = db.collection('pending_reconciliation').doc(`block_${params.blockNumber}`);
      await ref.set({
        blockNumber: params.blockNumber,
        blockHash: params.blockHash,
        txHash: params.txHash || null,
        candidateBlock: params.candidateBlock || null,
        errorReason: params.errorReason,
        createdAt: new Date().toISOString(),
        resolved: false,
      });
      console.warn(`[BlockchainReconciliation] Recorded pending reconciliation for block #${params.blockNumber}`);
    } catch (err) {
      console.error('[BlockchainReconciliation] Failed to record pending reconciliation:', err);
    }
  }
}
