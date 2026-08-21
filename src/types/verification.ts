import { HybridTransactionRecord } from './hybrid-transaction';
import { MerkleProof, MerkleProofNode } from './merkle';

export type VerificationState =
  | 'UNVERIFIED'
  | 'VERIFYING'
  | 'TRANSACTION_VALID'
  | 'MERKLE_VALID'
  | 'ANCHOR_VALID'
  | 'FULLY_VERIFIED'
  | 'TRANSACTION_HASH_MISMATCH'
  | 'MERKLE_PROOF_INVALID'
  | 'MERKLE_ROOT_MISMATCH'
  | 'BLOCKCHAIN_ANCHOR_MISMATCH'
  | 'BLOCKCHAIN_TRANSACTION_INVALID'
  | 'BLOCK_NOT_FOUND'
  | 'BLOCK_CONFIRMATION_PENDING'
  | 'RECONCILIATION_REQUIRED'
  | 'MANUAL_REVIEW_REQUIRED';

export interface VerificationLayerResult {
  status: 'VALID' | 'INVALID' | 'PENDING' | 'SKIPPED';
  message: string;
  expected?: string | number | null;
  actual?: string | number | null;
}

export interface ComprehensiveVerificationResult {
  verificationId: string;
  applicationTransactionId: string;
  userId?: string;
  timestamp: string;
  overallState: VerificationState;
  fullyVerified: boolean;

  // 6 Core Integrity Layers
  layers: {
    canonicalSerialization: VerificationLayerResult;
    transactionHash: VerificationLayerResult;
    merkleMembership: VerificationLayerResult;
    merkleProof: VerificationLayerResult;
    merkleRoot: VerificationLayerResult;
    blockchainAnchor: VerificationLayerResult;
    blockConfirmation: VerificationLayerResult;
  };

  // Cryptographic & On-chain proofs
  proofDetails: {
    canonicalPayload: string;
    computedTransactionHash: string;
    storedTransactionHash: string;
    merkleLeaf: string;
    merkleBatchId?: string | null;
    merkleRoot?: string | null;
    onChainMerkleRoot?: string | null;
    merkleProof?: MerkleProofNode[];
    blockchainTransactionHash?: string | null;
    blockNumber?: number | null;
    blockHash?: string | null;
    chainId?: number | null;
    contractAddress?: string | null;
    confirmations: number;
    requiredConfirmations: number;
    onChainTimestamp?: string | null;
  };

  mismatches: string[];
  durationMs: number;
  isCached?: boolean;
}

export interface ExportableProofReport {
  version: '1.0';
  exportTimestamp: string;
  transactionId: string;
  userId?: string;
  transactionData: {
    sender: string;
    receiver: string;
    amount: number;
    asset: string;
    type: string;
    createdAt: string;
  };
  cryptographicProof: {
    canonicalPayload: string;
    transactionHash: string;
    signature: string;
    senderPublicKey?: string;
  };
  merkleProof: {
    merkleBatchId?: string | null;
    merkleLeaf: string;
    merkleProofNodes: MerkleProofNode[];
    merkleRoot: string;
  };
  blockchainAnchor: {
    network: string;
    chainId: number;
    contractAddress: string;
    blockchainTransactionHash: string | null;
    blockNumber: number | null;
    blockHash: string | null;
    confirmations: number;
    receiptStatus: 'SUCCESS' | 'REVERTED' | 'NOT_FOUND';
  };
  verificationSummary: {
    overallStatus: VerificationState;
    fullyVerified: boolean;
    verificationId: string;
    verifiedAt: string;
  };
}

export interface VerificationAuditLog {
  verificationId: string;
  transactionId: string;
  userId?: string;
  timestamp: string;
  overallState: VerificationState;
  fullyVerified: boolean;
  durationMs: number;
  layersSummary: Record<string, string>;
  mismatchesCount: number;
  mismatches: string[];
}
