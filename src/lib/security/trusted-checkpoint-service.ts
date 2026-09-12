import { getAdminDb } from '@/lib/firebase/admin';
import { TrustedCheckpoint } from './security-state-types';

export class TrustedCheckpointService {
  private static COLLECTION = 'trusted_checkpoints';

  /**
   * Records a cryptographically verified checkpoint in Firestore.
   */
  public static async recordCheckpoint(params: {
    chainId: number;
    blockNumber: number;
    blockHash: string;
    chainRoot: string;
    genesisHash: string;
    source: TrustedCheckpoint['source'];
  }): Promise<TrustedCheckpoint> {
    const adminDb = getAdminDb();
    const checkpointId = `CHK_${params.chainId}_${params.blockNumber}_${Date.now()}`;
    const verifiedAt = new Date().toISOString();

    const checkpoint: TrustedCheckpoint = {
      checkpointId,
      chainId: params.chainId,
      blockNumber: params.blockNumber,
      blockHash: params.blockHash,
      chainRoot: params.chainRoot,
      genesisHash: params.genesisHash,
      verifiedAt,
      source: params.source,
    };

    try {
      await adminDb.collection(this.COLLECTION).doc(checkpointId).set(checkpoint);
      // Also maintain latest pointer
      await adminDb.collection('system_security').doc('latest_checkpoint').set(checkpoint);
      console.info(`[TrustedCheckpointService] Recorded checkpoint #${params.blockNumber} (${checkpointId})`);
    } catch (err) {
      console.error('[TrustedCheckpointService] Failed to save checkpoint to Firestore:', err);
    }

    return checkpoint;
  }

  /**
   * Retrieves the latest verified checkpoint.
   */
  public static async getLatestCheckpoint(): Promise<TrustedCheckpoint | null> {
    try {
      const adminDb = getAdminDb();
      const snap = await adminDb.collection('system_security').doc('latest_checkpoint').get();
      if (snap.exists) {
        return snap.data() as TrustedCheckpoint;
      }
    } catch (err) {
      console.warn('[TrustedCheckpointService] Could not read latest checkpoint:', err);
    }
    return null;
  }
}
