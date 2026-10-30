import { z } from 'zod';

// ============================================================================
// PHASE 8: AUTONOMOUS INVESTIGATION AGENT TYPES
// ============================================================================

export type InvestigationStatusType =
  | 'QUEUED'
  | 'RUNNING'
  | 'REVIEW_REQUIRED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT'
  | 'PARTIALLY_COMPLETED';

export type InvestigationTargetType = 'VEHICLE' | 'FINDING' | 'DOCUMENT' | 'ENTITY';

export type InvestigationTypeEnum =
  | 'ODOMETER_ROLLBACK'
  | 'OWNERSHIP_IDENTITY'
  | 'DOCUMENT_INTEGRITY'
  | 'FRAUD_GRAPH'
  | 'MULTI_SIGNAL'
  | 'GENERAL';

export type StepStatusType = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type EvidenceVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'MISMATCH' | 'UNAVAILABLE';
export type EvidenceRelationship = 'SUPPORTING' | 'CONTRADICTING' | 'NEUTRAL';

export type FindingSeverity = 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FindingAssessmentStatus = 'CONFIRMED_ANOMALY' | 'REQUIRES_HUMAN_REVIEW' | 'INCONSISTENCY_NOTED' | 'DISMISSED';

// ============================================================================
// TOOL REGISTRY CONTRACTS
// ============================================================================

export interface ToolExecutionContext {
  runId: string;
  userId: string;
  userRole: string;
  vehicleId?: string;
  signal?: AbortSignal;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  toolName: string;
  toolVersion: string;
  durationMs: number;
  data?: T;
  evidenceItems?: CollectedEvidenceDraft[];
  error?: {
    category: string;
    message: string;
    isRetryable: boolean;
  };
}

export interface CollectedEvidenceDraft {
  evidenceType: string;
  sourceRecordId: string;
  contentHash?: string;
  verificationStatus: EvidenceVerificationStatus;
  description: string;
  limitations?: string;
  relationship: EvidenceRelationship;
  provenance: Record<string, any>;
}

export interface RegisteredToolDefinition {
  name: string;
  version: string;
  description: string;
  category: 'PASSPORT' | 'LIFECYCLE' | 'BLOCKCHAIN' | 'GRAPH' | 'ANALYSIS' | 'CASE';
  isReadOnly: boolean;
  requiredRole?: string[]; // e.g. ['ADMIN', 'GARAGE', ...]
  inputSchema: z.ZodType<any>;
  execute: (input: any, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

// ============================================================================
// INVESTIGATION EVIDENCE & REPORT SCHEMAS
// ============================================================================

export interface StructuredClaim {
  claim: string;
  claimType: 'VERIFIED_FACT' | 'SOURCE_CLAIM' | 'RULE_FINDING' | 'INFERRED_RELATIONSHIP' | 'CONTRADICTION' | 'UNKNOWN';
  evidenceRefs: string[]; // List of evidenceNumbers (e.g. "EVD-2026-000001")
  supportingObservations: string[];
  contradictingObservations: string[];
  assessment: string;
  limitations?: string;
}

export interface StructuredFinding {
  findingId: string; // e.g. "FINDING-REPORT-1"
  category: string;
  severity: FindingSeverity;
  assessmentStatus: FindingAssessmentStatus;
  title: string;
  explanation: string;
  supportingEvidenceRefs: string[];
  contradictingEvidenceRefs: string[];
  verificationResults?: string[];
  limitations?: string;
  recommendedNextSteps: string[];
}

export interface InvestigationReport {
  investigationId: string;
  runNumber: string;
  vehicleId?: string;
  targetType: InvestigationTargetType;
  targetId: string;
  investigationType: InvestigationTypeEnum;
  status: InvestigationStatusType;
  generatedAt: string;
  reportVersion: string;
  executiveSummary: string;
  verifiedFacts: StructuredClaim[];
  observations: StructuredClaim[];
  findings: StructuredFinding[];
  contradictions: string[];
  unknowns: string[];
  verificationResults: {
    canonicalHashing: 'VERIFIED' | 'MISMATCH' | 'NOT_EVALUATED';
    blockchainAnchoring: 'CONFIRMED' | 'UNANCHORED' | 'UNAVAILABLE' | 'NOT_EVALUATED';
    merkleInclusion: 'VERIFIED' | 'MISMATCH' | 'UNAVAILABLE' | 'NOT_EVALUATED';
    documentConsistency: 'CONSISTENT' | 'INCONSISTENT' | 'UNAVAILABLE' | 'NOT_EVALUATED';
  };
  recommendedNextSteps: string[];
  limitations: string[];
  evidenceSummary: {
    totalItems: number;
    verifiedCount: number;
    unverifiedCount: number;
    mismatchCount: number;
  };
}

// ============================================================================
// DTOs FOR API
// ============================================================================

export interface CreateInvestigationRequestDTO {
  targetType: InvestigationTargetType;
  targetId: string;
  vehicleId?: string;
  investigationType?: InvestigationTypeEnum;
  maxSteps?: number;
  executionBudgetMs?: number;
  caseId?: string;
  waitForCompletion?: boolean;
}

export interface InvestigationRunDTO {
  id: string;
  runNumber: string;
  initiatingUserId: string;
  targetType: string;
  targetId: string;
  vehicleId?: string | null;
  investigationType: InvestigationTypeEnum;
  status: InvestigationStatusType;
  summary?: string | null;
  errorCategory?: string | null;
  errorMessage?: string | null;
  stepCount: number;
  maxSteps: number;
  evidenceCount: number;
  executionBudgetMs: number;
  executionDurationMs: number;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  deadline?: string | null;
  createdAt: string;
  updatedAt: string;
  investigationCaseId?: string | null;
  report?: InvestigationReport | null;
}

export interface InvestigationStepDTO {
  id: string;
  stepIndex: number;
  toolName: string;
  toolVersion: string;
  status: StepStatusType;
  inputMetadata?: any;
  resultSummary?: string | null;
  errorCategory?: string | null;
  errorMessage?: string | null;
  durationMs: number;
  retryCount: number;
  createdAt: string;
}

export interface InvestigationEvidenceDTO {
  id: string;
  evidenceNumber: string;
  evidenceType: string;
  sourceRecordId: string;
  contentHash?: string | null;
  verificationStatus: EvidenceVerificationStatus;
  description: string;
  limitations?: string | null;
  relationship: EvidenceRelationship;
  provenance?: any;
  createdAt: string;
}

export interface InvestigationOverviewDTO {
  totalRuns: number;
  runningRuns: number;
  completedRuns: number;
  reviewRequiredRuns: number;
  failedRuns: number;
  recentRuns: InvestigationRunDTO[];
}
