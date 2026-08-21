import { HybridTransactionRecord, TransactionStatus } from './hybrid-transaction';

export type ReconciliationState =
  | 'NOT_CHECKED'
  | 'MATCHED'
  | 'MISMATCH'
  | 'BLOCKCHAIN_PENDING'
  | 'BLOCKCHAIN_NOT_FOUND'
  | 'DATABASE_RECORD_MISSING'
  | 'DATABASE_UPDATE_PENDING'
  | 'RECOVERY_REQUIRED'
  | 'RECOVERY_COMPLETED'
  | 'MANUAL_REVIEW_REQUIRED';

export type MismatchSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface ReconciliationMismatch {
  field: string;
  offChain: string | number | boolean | null;
  onChain: string | number | boolean | null;
  severity: MismatchSeverity;
  message: string;
}

export interface ReconciliationResult {
  reconciliationId: string;
  applicationTransactionId: string;
  userId?: string;
  timestamp: string;
  offChainStatus: TransactionStatus | string;
  blockchainStatus: string;
  reconciliationStatus: ReconciliationState;
  verified: boolean;
  severity: MismatchSeverity;
  actionPerformed: string;
  recoveredFields?: Partial<HybridTransactionRecord>;
  mismatches: ReconciliationMismatch[];
  isRetryable: boolean;
  blockchainTransactionHash?: string | null;
  blockNumber?: number | null;
  blockHash?: string | null;
  contractAddress?: string | null;
  chainId?: number | null;
}

export interface ReconciliationAuditLog {
  reconciliationId: string;
  applicationTransactionId: string;
  userId?: string;
  timestamp: string;
  previousStatus: string;
  newStatus: string;
  reconciliationStatus: ReconciliationState;
  mismatchType?: string;
  severity: MismatchSeverity;
  action: string;
  result: 'MATCHED' | 'RECOVERED' | 'MISMATCH' | 'PENDING' | 'ERROR';
  details?: string;
}
