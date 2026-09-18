export type NodeStatus =
  | 'HEALTHY'
  | 'BUSY'
  | 'DEGRADED'
  | 'STALE'
  | 'UNAVAILABLE_FOR_NEW_TX'
  | 'OFFLINE'
  | 'RPC_TIMEOUT';

export interface NodeChecks {
  connected: boolean;
  synced: boolean;
  latestBlock: boolean;
  acceptableLatency: boolean;
  contractVerified: boolean;
}

export interface SimulationNode {
  id: string;
  name: string;
  providerUrl: string;
  status: NodeStatus;
  latencyMs: number;
  latestBlockNumber: number;
  blockAgeSeconds: number;
  chainId: number;
  gasPriceGwei: number;
  hasContractCode: boolean;
  healthScore: number; // 0 - 100
  checks: NodeChecks;
  lastCheckedAt: string;
  currentTransactionId?: string | null;
  acceptsNewTransactions?: boolean;
  isProcessingExisting?: boolean;
}

export type TransactionStatus =
  | 'IDLE'
  | 'CREATED'
  | 'SECURITY_VALIDATED'
  | 'TEMP_PENDING'
  | 'ONCHAIN_INITIALIZING'
  | 'FUNDS_RESERVED'
  | 'PROCESSING'
  | 'FINAL_VALIDATION'
  | 'FINALIZED'
  | 'QUARANTINED'
  | 'FAILED'
  | 'UNKNOWN_VERIFYING'
  | 'RECONCILED';

export type BlockchainState =
  | 'NOT_ANCHORED'
  | 'FUNDS_RESERVED'
  | 'MINED'
  | 'FINALIZED'
  | 'REVERTED'
  | 'DISCREPANCY';

export type SettlementRoute = 'ON_CHAIN' | 'TEMPORARY_OFF_CHAIN';

export interface StateHistoryEntry {
  state: TransactionStatus;
  timestamp: string;
  note: string;
  blockchainState?: BlockchainState;
}

export interface SimulationTransaction {
  id: string;
  idempotencyKey: string;
  reservationId: string;
  sender: string;
  recipient: string;
  amount: number;
  asset: string;
  expiryMinutes: number;
  createdAt: string;
  updatedAt: string;
  route: SettlementRoute;
  applicationState: TransactionStatus;
  blockchainState: BlockchainState;
  previousState?: TransactionStatus;
  blockchainTxHash?: string;
  blockNumber?: number;
  confirmations?: number;
  integrityHash: string;
  tamperedHash?: string;
  isTampered?: boolean;
  recoveryAttempts: number;
  inQueue: boolean;
  queueIndex?: number;
  stateHistory: StateHistoryEntry[];
}

export interface QueueNodeItem {
  id: string;
  transactionId: string;
  amount: number;
  asset: string;
  enqueuedAt: string;
  createdAt?: number | string;
  status: TransactionStatus;
}

export interface SimulationBalances {
  senderTotal: number;
  senderAvailable: number;
  senderReserved: number;
  recipientConfirmed: number;
  recipientIncoming: number;
}

export type HealingStep =
  | 'IDLE'
  | 'MONITOR'
  | 'DETECT'
  | 'CLASSIFY'
  | 'VERIFY'
  | 'RECOVER'
  | 'RECHECK'
  | 'RECONCILE'
  | 'RESUME';

export type ArchitectureStep =
  | 'IDLE'
  | 'USER'
  | 'SECURITY'
  | 'ROUTER'
  | 'NODE_HEALTH'
  | 'ONCHAIN_PATH'
  | 'BLOCKCHAIN_INIT'
  | 'FUNDS_RESERVED'
  | 'TEMPORARY_PATH'
  | 'TEMP_TX'
  | 'OFFCHAIN_RESERVE'
  | 'PROCESSING'
  | 'FINAL_VALIDATION'
  | 'FINALIZE'
  | 'RECIPIENT_CREDIT'
  | 'CANCEL'
  | 'QUARANTINE';

export type EventType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'RECOVERY' | 'QUARANTINE';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: EventType;
  transactionId?: string;
  stepName?: string;
}

export interface SystemMetrics {
  activeTransactions: number;
  temporaryTransactions: number;
  onChainTransactions: number;
  reservedAmount: number;
  completedTransactions: number;
  failedTransactions: number;
  quarantinedTransactions: number;
  healthyNodes: number;
  degradedNodes: number;
  recoveryEvents: number;
  reconciliationEvents: number;
}

export type ActiveScenario =
  | 'NONE'
  | 'DEMO_1' // Normal Payment
  | 'DEMO_2' // Blockchain Unavailable
  | 'DEMO_3' // RPC Timeout
  | 'DEMO_4' // Worker Crash
  | 'DEMO_5' // DB/Chain Mismatch
  | 'DEMO_6' // Integrity Attack
  | 'DEMO_INSUFFICIENT_FUNDS'
  | 'DEMO_NODE_BUSY';
