export type AnchorStatus =
  | 'NOT_ELIGIBLE'
  | 'ELIGIBLE'
  | 'BATCHED'
  | 'ANCHOR_SUBMITTED'
  | 'ANCHOR_CONFIRMED'
  | 'ANCHOR_FAILED'
  | 'ANCHOR_REQUIRES_RETRY'
  | 'ANCHOR_REQUIRES_REVIEW';

export interface MerkleProofNode {
  hash: string;
  position: 'left' | 'right';
}

export interface MerkleProof {
  batchId: string;
  applicationTransactionId: string;
  leaf: string;
  proof: MerkleProofNode[];
  merkleRoot: string;
  verified?: boolean;
  blockchainTransactionHash?: string | null;
  blockNumber?: number | null;
  blockHash?: string | null;
}

export interface AnchorBatch {
  batchId: string;
  merkleRoot: string;
  transactionCount: number;
  firstTransactionId: string;
  lastTransactionId: string;
  transactionIds: string[];
  leafHashes: string[];
  chainId: number;
  contractAddress: string;
  blockchainTransactionHash: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  status: AnchorStatus;
  createdAt: string;
  submittedAt: string | null;
  anchoredAt: string | null;
  errorMessage?: string | null;
}

export interface BatchCreationResult {
  success: boolean;
  batch?: AnchorBatch;
  error?: string;
  anchoredOnChain?: boolean;
}

export interface MerkleVerificationResult {
  verified: boolean;
  leafMatch: boolean;
  rootMatch: boolean;
  onChainMatch: boolean;
  mismatches: string[];
  calculatedRoot: string;
  storedRoot: string;
  onChainRoot?: string | null;
  batchId?: string;
}
