import { getAdminDb } from '@/lib/firebase/admin';

export type RecoveryStage =
  | 'RECOVERY_REQUIRED'
  | 'RECOVERY_INITIALIZING'
  | 'SOURCE_VALIDATION'
  | 'RECONSTRUCTION'
  | 'BLOCK_VALIDATION'
  | 'CHAIN_ROOT_VALIDATION'
  | 'ON_CHAIN_ANCHOR_VALIDATION'
  | 'DATABASE_RECONCILIATION'
  | 'POST_RECOVERY_AUDIT'
  | 'RECOVERY_VERIFIED'
  | 'READY_TO_RESUME'
  | 'RESUMING'
  | 'RECOVERED'
  | 'RECOVERY_FAILED';

export interface RecoveryJobState {
  recoveryId: string;
  incidentId: string;
  currentStage: RecoveryStage;
  lastProcessedBlock: number;
  totalBlocks: number;
  verifiedBlocks: number;
  failedBlocks: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  recoveryVersion: number;
}

// In-memory fallback for offline/testing environments
let inMemoryActiveJob: RecoveryJobState | null = null;

export class RecoveryLockService {
  private static COLLECTION = 'system_security';
  private static LOCK_DOC = 'recovery_lock';

  /**
   * Attempts to acquire an exclusive recovery lock.
   * If an active recovery job is already running, returns the existing job (idempotent).
   */
  public static async acquireLock(params: {
    incidentId: string;
    totalBlocks?: number;
    recoveryVersion?: number;
  }): Promise<{ acquired: boolean; job: RecoveryJobState; isExisting: boolean }> {
    const now = new Date().toISOString();
    const existing = await this.getActiveJob();

    if (existing && existing.status === 'ACTIVE' && existing.incidentId === params.incidentId) {
      console.info(`[RecoveryLockService] Existing recovery job active: ${existing.recoveryId} (Stage: ${existing.currentStage})`);
      return { acquired: true, job: existing, isExisting: true };
    }

    if (existing && existing.status === 'ACTIVE') {
      // Another incident is currently recovering
      return { acquired: false, job: existing, isExisting: true };
    }

    const recoveryId = `REC_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const newJob: RecoveryJobState = {
      recoveryId,
      incidentId: params.incidentId,
      currentStage: 'RECOVERY_INITIALIZING',
      lastProcessedBlock: 0,
      totalBlocks: params.totalBlocks || 0,
      verifiedBlocks: 0,
      failedBlocks: 0,
      startedAt: now,
      updatedAt: now,
      status: 'ACTIVE',
      recoveryVersion: params.recoveryVersion || 1,
    };

    inMemoryActiveJob = newJob;

    try {
      const adminDb = getAdminDb();
      await adminDb.collection(this.COLLECTION).doc(this.LOCK_DOC).set(newJob);
      console.info(`[RecoveryLockService] ✓ Acquired exclusive recovery lock: ${recoveryId}`);
    } catch (err) {
      console.warn('[RecoveryLockService] Firestore write warning (using in-memory):', err);
    }

    return { acquired: true, job: newJob, isExisting: false };
  }

  /**
   * Updates the progress checkpoint of the current recovery job.
   */
  public static async updateCheckpoint(params: {
    stage: RecoveryStage;
    lastProcessedBlock?: number;
    totalBlocks?: number;
    verifiedBlocks?: number;
    failedBlocks?: number;
    error?: string;
  }): Promise<RecoveryJobState | null> {
    const current = await this.getActiveJob();
    if (!current) return null;

    const now = new Date().toISOString();
    const isTerminal = params.stage === 'RECOVERED' || params.stage === 'RECOVERY_FAILED';

    const updatedJob: RecoveryJobState = {
      ...current,
      currentStage: params.stage,
      lastProcessedBlock: params.lastProcessedBlock ?? current.lastProcessedBlock,
      totalBlocks: params.totalBlocks ?? current.totalBlocks,
      verifiedBlocks: params.verifiedBlocks ?? current.verifiedBlocks,
      failedBlocks: params.failedBlocks ?? current.failedBlocks,
      updatedAt: now,
      completedAt: isTerminal ? now : undefined,
      error: params.error,
      status: params.stage === 'RECOVERY_FAILED' ? 'FAILED' : params.stage === 'RECOVERED' ? 'COMPLETED' : 'ACTIVE',
    };

    inMemoryActiveJob = updatedJob;

    try {
      const adminDb = getAdminDb();
      await adminDb.collection(this.COLLECTION).doc(this.LOCK_DOC).set(updatedJob, { merge: true });
    } catch (err) {
      console.warn('[RecoveryLockService] Firestore checkpoint update warning:', err);
    }

    return updatedJob;
  }

  /**
   * Reads the currently active recovery job.
   */
  public static async getActiveJob(): Promise<RecoveryJobState | null> {
    try {
      const adminDb = getAdminDb();
      const snap = await adminDb.collection(this.COLLECTION).doc(this.LOCK_DOC).get();
      if (snap.exists) {
        const data = snap.data() as RecoveryJobState;
        inMemoryActiveJob = data;
        return data;
      }
    } catch (_) {}
    return inMemoryActiveJob;
  }

  /**
   * Releases or clears the recovery lock.
   */
  public static async releaseLock(): Promise<void> {
    inMemoryActiveJob = null;
    try {
      const adminDb = getAdminDb();
      await adminDb.collection(this.COLLECTION).doc(this.LOCK_DOC).delete();
      console.info('[RecoveryLockService] Released recovery lock.');
    } catch (_) {}
  }
}
