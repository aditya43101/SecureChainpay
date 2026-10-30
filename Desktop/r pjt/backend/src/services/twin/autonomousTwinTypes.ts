import { FuelType, VehicleStatus } from '@prisma/client';
import { EvidenceLevel } from './types';

// ============================================================================
// PHASE 10: AUTONOMOUS DIGITAL VEHICLE TWIN ONTOLOGY & PROVENANCE
// ============================================================================

/**
 * 1. Five-Way Ontological State Representation
 */
export interface FiveWayOntologyStatus {
  physicalVehicle: {
    status: 'REAL_WORLD_ASSET';
    observedDirectly: false;
    observationNote: string;
  };
  recordedHistory: {
    status: 'TRACEABLE_GROUND_TRUTH';
    totalSourceRecords: number;
    sourcesBreakdown: Record<string, number>;
    firstRecordedDate: string | null;
    lastRecordedDate: string | null;
  };
  verifiedClaims: {
    status: 'CRYPTOGRAPHICALLY_COMMITTED';
    totalVerifiedClaims: number;
    onChainAnchorVerified: boolean;
    merkleBatchesVerified: number;
    zkpRangeProofsVerified: number;
    issuerSignaturesVerified: number;
  };
  derivedDigitalState: {
    status: 'COMPUTED_PROJECTION';
    engineVersion: string;
    computedAt: string;
    freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
    driftDetected: boolean;
  };
  simulatedFutureState: {
    status: 'HYPOTHETICAL_SIMULATION_ONLY';
    activeSimulationsCount: number;
    isSimulated: false;
    simulationNotice: string;
  };
}

/**
 * 2. Field-Level State Provenance
 */
export interface StateProvenanceItem<T = any> {
  value: T;
  sourceRecordId?: string | null;
  sourceRecordType?: string;
  sourceSystem: string;
  sourceTimestamp: string;
  computedAt: string;
  verifiedStatus: EvidenceLevel;
  freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
  conflictsDetected: boolean;
  conflictingEvidenceNotes?: string | null;
  ruleVersion: string;
}

/**
 * 3. Provenance-Enriched Derived State
 */
export interface DerivedTwinStateWithProvenance {
  odometer: StateProvenanceItem<{
    mileage: number;
    unit: 'km';
    isMonotonic: boolean;
    rollbackDetected: boolean;
    dailyVelocityKm: number;
  }>;
  ownership: StateProvenanceItem<{
    currentOwnerName: string;
    currentOwnerRole: string;
    totalOwnersCount: number;
    ownershipDurationDays: number;
  }>;
  maintenance: StateProvenanceItem<{
    totalServices: number;
    lastServiceDate: string | null;
    lastServiceMileage: number | null;
    serviceCoveragePercentage: number;
    isOverdueForService: boolean;
  }>;
  battery: StateProvenanceItem<{
    isEv: boolean;
    stateOfHealthPercent: number | null;
    cycleCount: number | null;
    packSerialMasked: string | null;
    warrantyStatus: string;
  }>;
  documentConsistency: StateProvenanceItem<{
    totalDocuments: number;
    consistentCount: number;
    inconsistentCount: number;
    consistencyScore: number;
  }>;
  blockchainIntegrity: StateProvenanceItem<{
    isAnchored: boolean;
    contractAddress: string;
    latestBlock: number | null;
    status: 'VERIFIED' | 'TAMPER_DETECTED' | 'PENDING';
  }>;
  healthRisk: StateProvenanceItem<{
    healthScore: number;
    riskScore: number;
    riskLevel: string;
    anomaliesCount: number;
  }>;
}

/**
 * 4. Event-Sourced Lifecycle Stream Item
 */
export interface TwinLifecycleEventDTO {
  id: string;
  vehicleId: string;
  eventType: string;
  sourceRecordId?: string | null;
  sourceSystem: string;
  eventTime: string;      // When the real-world event reportedly took place
  recordedTime: string;   // When the DB record was inserted
  ingestionTime: string;  // When the twin ingested it
  actor?: string | null;
  schemaVersion: string;
  sourceVerificationStatus: string;
  contentHash?: string | null;
  blockchainTxHash?: string | null;
  idempotencyKey: string;
  summary: string;
  payloadJson?: string | null;
}

/**
 * 5. Complete Autonomous Digital Vehicle Twin DTO
 */
export interface AutonomousDigitalVehicleTwinDTO {
  vehicleId: string;
  passportId: string;
  vin: string;
  reconstructedAt: string;
  engineVersion: string;

  // Ontological Separation
  ontology: FiveWayOntologyStatus;

  // Derived State with Field Provenance
  derivedState: DerivedTwinStateWithProvenance;

  // Summary Flags
  summary: {
    currentState: string;
    lifecycleState: string;
    healthScore: number;
    riskLevel: string;
    trustBadge: 'VERIFIED' | 'ATTENTION_REQUIRED' | 'TAMPER_DETECTED';
    dataFreshness: 'FRESH' | 'STALE' | 'UNKNOWN';
    conflictsCount: number;
    unresolvedAnomaliesCount: number;
    lastSyncTimestamp: string;
  };

  // Associated Integrations
  integrations: {
    merkleBatchesCount: number;
    fraudFindingsCount: number;
    activeInvestigationRunId?: string | null;
    privacyCredentialsCount: number;
    latestZkpProofTimestamp?: string | null;
  };

  // Event stream summary
  eventsCount: number;
}

/**
 * 6. Scenario Simulation Types
 */
export type TwinScenarioType =
  | 'SCHEDULED_MAINTENANCE'
  | 'ODOMETER_PROJECTION'
  | 'OWNERSHIP_PRECHECK'
  | 'BATTERY_DEGRADATION';

export interface ScenarioSimulationRequest {
  scenarioType: TwinScenarioType;
  inputs: Record<string, any>;
}

export interface ScenarioDiffItem {
  attribute: string;
  baseValue: any;
  simulatedValue: any;
  changeExplanation: string;
  impactLevel: 'POSITIVE' | 'NEUTRAL' | 'WARNING' | 'CRITICAL';
}

export interface ScenarioSimulationResultDTO {
  scenarioId: string;
  vehicleId: string;
  scenarioType: TwinScenarioType;
  status: 'COMPLETED' | 'CANCELLED' | 'FAILED';
  baseTwinVersion: string;
  simulatedAt: string;
  assumptions: string[];
  inputs: Record<string, any>;
  diffs: ScenarioDiffItem[];
  simulatedStateSummary: {
    projectedHealthScore: number;
    projectedRiskLevel: string;
    projectedServiceCoverage: number;
    projectedMileage: number;
    projectedBatterySoH?: number | null;
    warningFlags: string[];
  };
  explanation: string;
  isSimulated: true;
}

/**
 * 7. Reconciliation Run DTO
 */
export interface TwinReconciliationResultDTO {
  reconciliationId: string;
  vehicleId: string;
  status: 'SUCCESS' | 'DRIFT_DETECTED_AND_REPAIRED' | 'FAILED';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sourcesCompared: number;
  discrepanciesCount: number;
  discrepancies: Array<{
    field: string;
    storedProjectionValue: any;
    authoritativeSourceValue: any;
    resolutionAction: string;
  }>;
  repairSummary: string;
}
