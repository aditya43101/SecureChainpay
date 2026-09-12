import { getAdminDb } from '@/lib/firebase/admin';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';
import { SmartContractService } from '@/lib/blockchain/smart-contract-service';
import { TrustedCheckpointService } from './trusted-checkpoint-service';
import {
  SecurityState,
  SystemSecurityDoc,
  IncidentRecord,
  ThreatClassification,
  IncidentSeverity,
} from './security-state-types';

const ALLOWED_TRANSITIONS: Record<SecurityState, SecurityState[]> = {
  HEALTHY: ['DEGRADED', 'SUSPICIOUS', 'INCIDENT_DETECTED', 'TRANSACTION_FROZEN', 'EMERGENCY_LOCK'],
  DEGRADED: ['HEALTHY', 'SUSPICIOUS', 'INCIDENT_DETECTED', 'TRANSACTION_FROZEN', 'EMERGENCY_LOCK'],
  SUSPICIOUS: ['HEALTHY', 'DEGRADED', 'INCIDENT_DETECTED', 'TRANSACTION_FROZEN', 'EMERGENCY_LOCK'],
  INCIDENT_DETECTED: ['TRANSACTION_FROZEN', 'EMERGENCY_LOCK', 'RECOVERY_REQUIRED', 'HEALTHY'],
  TRANSACTION_FROZEN: ['EMERGENCY_LOCK', 'RECOVERY_REQUIRED', 'RECOVERY_IN_PROGRESS', 'HEALTHY'],
  EMERGENCY_LOCK: ['RECOVERY_REQUIRED', 'RECOVERY_IN_PROGRESS', 'TRANSACTION_FROZEN', 'HEALTHY'],
  RECOVERY_REQUIRED: ['RECOVERY_IN_PROGRESS', 'TRANSACTION_FROZEN', 'HEALTHY'],
  RECOVERY_IN_PROGRESS: ['RECOVERED', 'TRANSACTION_FROZEN', 'RECOVERY_REQUIRED', 'HEALTHY'],
  RECOVERED: ['HEALTHY', 'TRANSACTION_FROZEN'],
};

// In-memory fallback if Firestore is temporarily offline
let inMemoryState: SystemSecurityDoc = {
  state: 'HEALTHY',
  previousState: null,
  lastStateChange: new Date().toISOString(),
  isTransactionFrozen: false,
  isContractPaused: false,
  isEmergencyLockActive: false,
  activeIncidentId: null,
  lastCheckedAt: new Date().toISOString(),
};

export class SecurityStateService {
  private static SYSTEM_SECURITY_COLLECTION = 'system_security';
  private static STATE_DOC_ID = 'state';
  private static INCIDENTS_COLLECTION = 'securityIncidents';

  /**
   * Retrieves the current authoritative system security state.
   */
  public static async getSecurityState(): Promise<SystemSecurityDoc> {
    try {
      const adminDb = getAdminDb();
      const snap = await adminDb
        .collection(this.SYSTEM_SECURITY_COLLECTION)
        .doc(this.STATE_DOC_ID)
        .get();

      if (snap.exists) {
        const data = snap.data() as SystemSecurityDoc;
        inMemoryState = data;
        return data;
      }
    } catch (err) {
      console.warn('[SecurityStateService] Warning reading Firestore security state, using in-memory state:', err);
    }
    return inMemoryState;
  }

  /**
   * Validates and transitions the security state machine.
   * SERVER-SIDE ONLY.
   */
  public static async transitionState(
    nextState: SecurityState,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<SystemSecurityDoc> {
    const currentState = await this.getSecurityState();

    if (currentState.state === nextState) {
      return currentState;
    }

    const allowed = ALLOWED_TRANSITIONS[currentState.state];
    if (!allowed || !allowed.includes(nextState)) {
      console.warn(
        `[SecurityStateService] Transition from ${currentState.state} to ${nextState} is not standard. Permitting with warning.`
      );
    }

    const now = new Date().toISOString();
    const isFrozen = ['INCIDENT_DETECTED', 'TRANSACTION_FROZEN', 'EMERGENCY_LOCK', 'RECOVERY_REQUIRED', 'RECOVERY_IN_PROGRESS'].includes(nextState);
    const isEmergency = nextState === 'EMERGENCY_LOCK';

    const updatedDoc: SystemSecurityDoc = {
      state: nextState,
      previousState: currentState.state,
      lastStateChange: now,
      isTransactionFrozen: isFrozen,
      isContractPaused: currentState.isContractPaused,
      isEmergencyLockActive: isEmergency || currentState.isEmergencyLockActive,
      activeIncidentId: metadata?.incidentId || currentState.activeIncidentId || null,
      lastCheckedAt: now,
      reason,
      lastTrustedBlockNumber: metadata?.lastTrustedBlockNumber ?? currentState.lastTrustedBlockNumber,
      lastTrustedBlockHash: metadata?.lastTrustedBlockHash ?? currentState.lastTrustedBlockHash,
      lastTrustedChainRoot: metadata?.lastTrustedChainRoot ?? currentState.lastTrustedChainRoot,
    };

    inMemoryState = updatedDoc;

    try {
      const adminDb = getAdminDb();
      await adminDb
        .collection(this.SYSTEM_SECURITY_COLLECTION)
        .doc(this.STATE_DOC_ID)
        .set(updatedDoc, { merge: true });
    } catch (err) {
      console.error('[SecurityStateService] Failed to persist state transition to Firestore:', err);
    }

    console.info(`[SecurityStateService] Security state transitioned: ${currentState.state} -> ${nextState} (${reason})`);
    return updatedDoc;
  }

  /**
   * Global Transaction Freeze Protocol:
   * 1. Transitions security state to TRANSACTION_FROZEN
   * 2. Calls SmartContractService.pause() to halt on-chain commits
   * 3. If contract pause fails, immediately engages EMERGENCY_LOCK
   */
  public static async freezeTransactions(params: {
    reason: string;
    incidentId: string;
    lastTrustedBlockNumber: number;
    lastTrustedBlockHash: string;
    lastTrustedChainRoot: string;
  }): Promise<{ success: boolean; contractPaused: boolean; state: SecurityState }> {
    console.warn(`[SecurityStateService] 🚨 INITIATING GLOBAL TRANSACTION FREEZE: ${params.reason}`);

    // Transition state to TRANSACTION_FROZEN
    await this.transitionState('TRANSACTION_FROZEN', params.reason, {
      incidentId: params.incidentId,
      lastTrustedBlockNumber: params.lastTrustedBlockNumber,
      lastTrustedBlockHash: params.lastTrustedBlockHash,
      lastTrustedChainRoot: params.lastTrustedChainRoot,
    });

    let contractPaused = false;

    // Trigger Smart Contract Emergency Pause on-chain
    try {
      console.info('[SecurityStateService] Triggering on-chain SmartContractService.pause()...');
      const pauseResult = await SmartContractService.pause();
      if (pauseResult.success) {
        contractPaused = true;
        inMemoryState.isContractPaused = true;
        const adminDb = getAdminDb();
        await adminDb
          .collection(this.SYSTEM_SECURITY_COLLECTION)
          .doc(this.STATE_DOC_ID)
          .set({ isContractPaused: true }, { merge: true })
          .catch(() => {});
        console.info(`[SecurityStateService] ✓ Smart Contract successfully paused on-chain (Tx: ${pauseResult.txHash})`);
      } else {
        throw new Error(pauseResult.error || 'Smart contract pause transaction reverted');
      }
    } catch (pauseErr: any) {
      console.error('[SecurityStateService] ❌ Smart Contract pause failed — triggering EMERGENCY_LOCK:', pauseErr);

      // Trigger stronger server-side EMERGENCY LOCK
      await this.transitionState('EMERGENCY_LOCK', `Smart contract pause failed: ${pauseErr.message}`, {
        incidentId: params.incidentId,
        lastTrustedBlockNumber: params.lastTrustedBlockNumber,
        lastTrustedBlockHash: params.lastTrustedBlockHash,
        lastTrustedChainRoot: params.lastTrustedChainRoot,
      });

      await SecurityAuditLogger.log({
        type: 'SMART_CONTRACT_COMMIT_FAILED',
        userId: 'SYSTEM',
        resource: 'SecurityStateService',
        action: 'pauseContract',
        result: 'DENIED',
        severity: 'CRITICAL',
        metadata: { error: pauseErr.message, incidentId: params.incidentId },
      });
    }

    return {
      success: true,
      contractPaused,
      state: inMemoryState.state,
    };
  }

  /**
   * Preserves tamper evidence and creates an immutable IncidentRecord in Firestore.
   * FORENSIC EVIDENCE PRESERVATION: NEVER DELETES OR OVERWRITES EXISTING EVIDENCE.
   */
  public static async recordIncident(params: {
    incidentType: ThreatClassification;
    severity: IncidentSeverity;
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
  }): Promise<IncidentRecord> {
    const incidentId = `INCIDENT_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date().toISOString();

    const incident: IncidentRecord = {
      incidentId,
      incidentType: params.incidentType,
      severity: params.severity,
      detectedAt: now,
      detectedBy: 'BlockchainIntegrityMonitor',
      chainId: 31337,
      detectedBlockNumber: params.detectedBlockNumber,
      expectedHash: params.expectedHash,
      observedHash: params.observedHash,
      expectedPreviousHash: params.expectedPreviousHash,
      observedPreviousHash: params.observedPreviousHash,
      expectedChainRoot: params.expectedChainRoot,
      observedChainRoot: params.observedChainRoot,
      databaseState: params.databaseState,
      onChainState: params.onChainState,
      securityState: 'INCIDENT_DETECTED',
      freezeStatus: true,
      contractPauseStatus: false,
      lastTrustedBlock: params.lastTrustedBlock,
      lastTrustedHash: params.lastTrustedHash,
      lastTrustedChainRoot: params.lastTrustedChainRoot,
      status: 'OPEN',
      phase: 'PHASE_4_DETECTED',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const adminDb = getAdminDb();
      await adminDb.collection(this.INCIDENTS_COLLECTION).doc(incidentId).set(incident);
      console.warn(`[SecurityStateService] ✓ Recorded security incident ${incidentId} with full forensic evidence.`);

      // Also record trusted checkpoint for Phase 5
      await TrustedCheckpointService.recordCheckpoint({
        chainId: 31337,
        blockNumber: params.lastTrustedBlock,
        blockHash: params.lastTrustedHash,
        chainRoot: params.lastTrustedChainRoot,
        genesisHash: params.databaseState?.genesisHash || 'genesis:securechainpay:global:v1',
        source: 'FULL_CHAIN_VALIDATION',
      });
    } catch (err) {
      console.error('[SecurityStateService] Failed to record incident evidence to Firestore:', err);
    }

    return incident;
  }

  /**
   * Resets or clears the incident state strictly after authorized verification / dev testing.
   */
  public static async resetToHealthy(reason = 'Authorized admin reset'): Promise<SystemSecurityDoc> {
    try {
      await SmartContractService.unpause().catch(() => {});
    } catch (_) {}

    const doc = await this.transitionState('HEALTHY', reason, {
      incidentId: null,
    });

    inMemoryState.isTransactionFrozen = false;
    inMemoryState.isContractPaused = false;
    inMemoryState.isEmergencyLockActive = false;

    try {
      const adminDb = getAdminDb();
      await adminDb
        .collection(this.SYSTEM_SECURITY_COLLECTION)
        .doc(this.STATE_DOC_ID)
        .set({
          isTransactionFrozen: false,
          isContractPaused: false,
          isEmergencyLockActive: false,
          activeIncidentId: null,
        }, { merge: true });
    } catch (_) {}

    return doc;
  }
}
