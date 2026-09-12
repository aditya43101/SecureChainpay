import { SecurityStateService } from './security-state-service';
import { OnChainStateReader } from '@/lib/blockchain/on-chain-state-reader';
import { TransactionGateResult } from './security-state-types';

export class TransactionSecurityGate {
  /**
   * Evaluates whether a transaction is permitted to process based on authoritative system security state.
   * ALL MONEY-MOVING API ROUTES MUST CALL THIS GATE BEFORE COMMENCING TRANSACTIONS.
   */
  public static async canProcessTransaction(): Promise<TransactionGateResult> {
    const secState = await SecurityStateService.getSecurityState();

    // 1. Check Emergency Lock
    if (secState.isEmergencyLockActive || secState.state === 'EMERGENCY_LOCK') {
      return {
        allowed: false,
        code: 'DENY_EMERGENCY_LOCK',
        reason: 'Emergency security lock is active. All ledger mutations are blocked.',
        securityState: secState.state,
        contractPaused: secState.isContractPaused,
      };
    }

    // 2. Check Global Transaction Freeze / Security State
    if (secState.isTransactionFrozen || secState.state === 'TRANSACTION_FROZEN') {
      return {
        allowed: false,
        code: 'DENY_FROZEN',
        reason: 'Blockchain transactions are temporarily paused while ledger integrity is being verified.',
        securityState: secState.state,
        contractPaused: secState.isContractPaused,
      };
    }

    if (secState.state === 'INCIDENT_DETECTED') {
      return {
        allowed: false,
        code: 'DENY_INCIDENT',
        reason: 'Blockchain incident detected. New transactions are suspended pending verification.',
        securityState: secState.state,
        contractPaused: secState.isContractPaused,
      };
    }

    if (secState.state === 'RECOVERY_REQUIRED' || secState.state === 'RECOVERY_IN_PROGRESS') {
      return {
        allowed: false,
        code: 'DENY_RECOVERY',
        reason: 'Blockchain recovery is pending or in progress. Transaction processing is unavailable.',
        securityState: secState.state,
        contractPaused: secState.isContractPaused,
      };
    }

    // 3. Check On-Chain Smart Contract Pause Status
    const onChainActive = await OnChainStateReader.isContractActive();
    if (onChainActive.paused) {
      return {
        allowed: false,
        code: 'DENY_CONTRACT_PAUSED',
        reason: 'Smart contract ledger anchor is paused on-chain.',
        securityState: secState.state,
        contractPaused: true,
      };
    }

    return {
      allowed: true,
      code: 'ALLOW',
      securityState: secState.state,
      contractPaused: false,
    };
  }

  /**
   * Pre-commit Revalidation Gate (Phase 4 §14: Race Condition Defense)
   * Must be called immediately before committing on-chain or atomic DB writes.
   */
  public static async revalidateBeforeCommit(): Promise<boolean> {
    const decision = await this.canProcessTransaction();
    if (!decision.allowed) {
      console.warn(`[TransactionSecurityGate] ⚠️ PRE-COMMIT REVALIDATION BLOCKED: ${decision.code} (${decision.reason})`);
      return false;
    }
    return true;
  }
}
