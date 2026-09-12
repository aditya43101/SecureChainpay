export type SecurityState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'SUSPICIOUS'
  | 'INCIDENT_DETECTED'
  | 'TRANSACTION_FROZEN'
  | 'EMERGENCY_LOCK'
  | 'RECOVERY_REQUIRED'
  | 'RECOVERY_IN_PROGRESS'
  | 'RECOVERED';

export type IncidentSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export type ThreatClassification =
  | 'NONE'
  | 'TRANSIENT_RPC_TIMEOUT'
  | 'TRANSIENT_DB_UNAVAILABLE'
  | 'BLOCK_HASH_TAMPERED'
  | 'PREVIOUS_HASH_TAMPERED'
  | 'BLOCK_NUMBER_MANIPULATED'
  | 'CHAIN_ROOT_MISMATCH'
  | 'GENESIS_MISMATCH'
  | 'DATABASE_CONTRACT_DIVERGENCE'
  | 'UNAUTHORIZED_WRITE_ATTEMPT'
  | 'DUPLICATE_BLOCK'
  | 'BLOCK_DELETION_GAP'
  | 'INVALID_CHAIN_ID'
  | 'SMART_CONTRACT_PAUSE_FAILED';

export interface SystemSecurityDoc {
  state: SecurityState;
  previousState: SecurityState | null;
  lastStateChange: string;
  isTransactionFrozen: boolean;
  isContractPaused: boolean;
  isEmergencyLockActive: boolean;
  activeIncidentId: string | null;
  lastCheckedAt: string;
  reason?: string;
  lastTrustedBlockNumber?: number;
  lastTrustedBlockHash?: string;
  lastTrustedChainRoot?: string;
}

export interface IncidentRecord {
  incidentId: string;
  incidentType: ThreatClassification;
  severity: IncidentSeverity;
  detectedAt: string;
  detectedBy: string;
  chainId: number;
  detectedBlockNumber: number | null;
  expectedHash: string | null;
  observedHash: string | null;
  expectedPreviousHash: string | null;
  observedPreviousHash: string | null;
  expectedChainRoot: string | null;
  observedChainRoot: string | null;
  databaseState: Record<string, any> | null;
  onChainState: Record<string, any> | null;
  securityState: SecurityState;
  freezeStatus: boolean;
  contractPauseStatus: boolean;
  lastTrustedBlock: number;
  lastTrustedHash: string;
  lastTrustedChainRoot: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RECOVERY_PENDING' | 'RESOLVED';
  phase: 'PHASE_4_DETECTED' | 'PHASE_5_READY';
  createdAt: string;
  updatedAt: string;
}

export interface TrustedCheckpoint {
  checkpointId: string;
  chainId: number;
  blockNumber: number;
  blockHash: string;
  chainRoot: string;
  genesisHash: string;
  verifiedAt: string;
  source: 'SMART_CONTRACT' | 'FULL_CHAIN_VALIDATION' | 'INITIAL_GENESIS';
}

export type GateDecision =
  | 'ALLOW'
  | 'DENY_FROZEN'
  | 'DENY_INCIDENT'
  | 'DENY_RECOVERY'
  | 'DENY_CONTRACT_PAUSED'
  | 'DENY_CHAIN_DIVERGENCE'
  | 'DENY_EMERGENCY_LOCK'
  | 'DENY_DEGRADED';

export interface TransactionGateResult {
  allowed: boolean;
  code: GateDecision;
  reason?: string;
  securityState: SecurityState;
  contractPaused: boolean;
}

export interface IntegrityCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'SUSPICIOUS' | 'CRITICAL_FAILURE';
  threat: ThreatClassification;
  severity: IncidentSeverity;
  details: string;
  mismatches: string[];
  blockNumber?: number;
  expectedValue?: string;
  observedValue?: string;
  lastTrustedBlock: number;
  lastTrustedHash: string;
  lastTrustedChainRoot: string;
  timestamp: string;
}
