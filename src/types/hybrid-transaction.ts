export type TransactionStatus =
  | 'CREATED'
  | 'VALIDATED'
  | 'SIGNED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FINALIZED'
  | 'VALIDATION_FAILED'
  | 'SIGNING_FAILED'
  | 'SUBMISSION_FAILED'
  | 'CONFIRMATION_FAILED'
  | 'completed'
  | 'pending'
  | 'failed';

export interface HybridTransactionRecord {
  // Canonical Application Identifier
  applicationTransactionId: string;
  userId: string;
  sender: string;
  receiver: string;
  amount: number;
  asset: string;
  currency?: string;
  type: 'credit' | 'debit' | 'trade' | 'genesis';
  status: TransactionStatus;
  description: string;
  idempotencyKey: string;

  // Off-Chain Cryptographic Proof
  canonicalPayload: string;
  transactionHash: string;
  signature: string;
  senderPublicKey: string;

  // Real EVM On-Chain Proof
  blockchainTransactionHash?: string | null;
  blockNumber?: number | null;
  blockHash?: string | null;
  chainId?: number | null;
  contractAddress?: string | null;

  // Lifecycle Timestamps
  createdAt: string;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  finalizedAt?: string | null;

  // Phase 3 Reconciliation Status
  reconciliationStatus?: string | null;
  lastReconciledAt?: string | null;

  // Phase 4 Merkle Anchoring
  merkleBatchId?: string | null;
  merkleLeaf?: string | null;
  merkleRoot?: string | null;
  anchorStatus?: string | null;
  anchoredAt?: string | null;

  // Backwards compatibility / Micro-ledger fields
  id: string; // matches applicationTransactionId
  hash: string; // matches transactionHash
  previousHash: string;
  walletAddress?: string;
  senderPublicKeyLegacy?: string;
  digitalSignature?: string;
  date: string;
  payload?: any;
  difficulty?: number;
  nonce?: number;
  blockSize?: number;
}

export interface HybridVerificationResult {
  verified: boolean;
  status: TransactionStatus;
  applicationTransactionId: string;
  blockchainTransactionHash?: string | null;
  blockNumber?: number | null;
  blockHash?: string | null;
  contractAddress?: string | null;
  chainId?: number | null;
  onChainTimestamp?: number | null;
  mismatches: string[];
}
