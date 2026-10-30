import {
  AccidentSeverity,
  FuelType,
  InsurancePolicyStatus,
  OdometerSourceType,
  OwnershipTransferType,
  RepairStatus,
  VehicleStatus,
} from '@prisma/client';

export type HealthStatus = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AnomalyCategory =
  | 'ODOMETER'
  | 'SERVICE'
  | 'ACCIDENT'
  | 'INSURANCE'
  | 'DOCUMENT'
  | 'OWNERSHIP'
  | 'BLOCKCHAIN';

export type PredictionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type PredictionStatus = 'PREDICTED' | 'ESTIMATED' | 'POSSIBLE';

/**
 * Concrete detected anomaly backed by records & cryptographic evidence
 */
export interface DetectedAnomaly {
  id: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  title: string;
  explanation: string;
  affectedRecordId?: string;
  affectedRecordType?: string;
  detectionTimestamp: string;
  evidence: {
    expected: string;
    actual: string;
    sourceRecords: Array<{
      id: string;
      type: string;
      date?: string;
      value?: string | number;
      hash?: string;
    }>;
    blockchainStatus?: string;
    notes?: string;
  };
  recommendation?: string;
}

/**
 * Component-level health evaluation (Explainable)
 */
export interface ComponentHealth {
  component: string;
  label: string;
  score: number; // 0 - 100
  weight: number; // Decimal weight e.g. 0.20
  status: HealthStatus;
  explanation: string;
  evidence: string[];
  penalties: Array<{
    reason: string;
    pointsDeducted: number;
    relatedAnomalyId?: string;
  }>;
  positiveFactors: string[];
}

/**
 * Overall explainable Health Score
 */
export interface VehicleHealthAssessment {
  overallScore: number; // 0 - 100
  status: HealthStatus;
  summary: string;
  components: {
    blockchainIntegrity: ComponentHealth;
    odometerIntegrity: ComponentHealth;
    serviceCompliance: ComponentHealth;
    accidentHistory: ComponentHealth;
    documentIntegrity: ComponentHealth;
    insuranceStatus: ComponentHealth;
    ownershipConsistency: ComponentHealth;
  };
  scoringMethodology: {
    weights: Record<string, number>;
    description: string;
    engineVersion: string;
  };
}

/**
 * Component-level risk assessment
 */
export interface ComponentRisk {
  category: AnomalyCategory | 'MAINTENANCE';
  label: string;
  riskLevel: RiskLevel;
  score: number; // 0 - 100 (higher = riskier)
  reason: string;
  evidence: string[];
  affectedRecordsCount: number;
}

/**
 * Overall Risk Evaluation
 */
export interface VehicleRiskAssessment {
  overallRiskLevel: RiskLevel;
  overallRiskScore: number; // 0 - 100 (0 = lowest risk, 100 = critical risk)
  summary: string;
  primaryRiskDrivers: string[];
  categories: {
    odometerRisk: ComponentRisk;
    accidentRisk: ComponentRisk;
    serviceRisk: ComponentRisk;
    documentRisk: ComponentRisk;
    insuranceRisk: ComponentRisk;
    ownershipRisk: ComponentRisk;
    blockchainIntegrityRisk: ComponentRisk;
    maintenanceRisk: ComponentRisk;
  };
  recommendedActions: string[];
  evaluationTimestamp: string;
  engineVersion: string;
}

/**
 * Predictive Maintenance Item
 */
export interface MaintenancePredictionItem {
  id: string;
  system: string; // e.g. "Braking System", "High-Voltage Battery", "Scheduled Periodic Service"
  title: string;
  status: PredictionStatus; // PREDICTED | ESTIMATED | POSSIBLE
  confidence: PredictionConfidence; // HIGH | MEDIUM | LOW
  urgency: 'IMMEDIATE' | 'SOON' | 'ROUTINE';
  estimatedDueMileage?: number;
  estimatedDueDate?: string;
  mileageRemaining?: number;
  reason: string;
  supportingHistory: {
    lastRelatedServiceDate?: string;
    lastRelatedServiceMileage?: number;
    recommendedIntervalKm?: number;
    recommendedIntervalMonths?: number;
    currentMileage: number;
  };
  recommendedServiceType: string;
  fuelTypeSuitability: FuelType[];
}

/**
 * Predictive Maintenance Overview
 */
export interface PredictiveMaintenanceAssessment {
  currentMileage: number;
  lastRecordedServiceDate?: string;
  lastRecordedServiceMileage?: number;
  overallMaintenanceRisk: RiskLevel;
  summary: string;
  predictions: MaintenancePredictionItem[];
  engineVersion: string;
}

/**
 * Relationship graph node & link for visual evidence tracing
 */
export interface EvidenceGraphNode {
  id: string;
  label: string;
  category: 'VEHICLE' | 'OWNERSHIP' | 'SERVICE' | 'ODOMETER' | 'ACCIDENT' | 'INSURANCE' | 'DOCUMENT' | 'BLOCKCHAIN';
  status: 'VERIFIED' | 'TAMPERED' | 'SUSPICIOUS' | 'UNVERIFIED';
  details?: Record<string, any>;
}

export interface EvidenceGraphLink {
  source: string;
  target: string;
  relationship: string;
  status: 'VERIFIED' | 'TAMPERED' | 'DISCREPANCY';
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  links: EvidenceGraphLink[];
}

/**
 * Evidence package strictly bounded for AI generation (Prevents hallucination)
 */
export interface AIEvidencePackage {
  passportId: string;
  vehicle: {
    manufacturer: string;
    model: string;
    variant?: string | null;
    year: number;
    fuelType: FuelType;
    status: VehicleStatus;
    vin: string;
  };
  metrics: {
    currentMileage: number;
    totalServices: number;
    totalAccidents: number;
    totalInsurancePolicies: number;
    totalDocuments: number;
    totalOwners: number;
  };
  blockchainIntegrity: {
    isAnchored: boolean;
    status: string;
    hasTamper: boolean;
    contractAddress: string;
  };
  healthScore: number;
  healthStatus: HealthStatus;
  riskLevel: RiskLevel;
  anomalies: Array<{
    category: string;
    severity: string;
    title: string;
    explanation: string;
  }>;
  maintenancePredictions: Array<{
    system: string;
    status: string;
    confidence: string;
    reason: string;
  }>;
}

/**
 * Complete Consolidated Intelligence Report
 */
export interface VehicleIntelligenceReport {
  vehicleId: string;
  passportId: string;
  vin: string;
  generatedAt: string;
  engineVersions: {
    healthEngine: string;
    riskEngine: string;
    anomalyEngine: string;
    maintenanceEngine: string;
    ruleSetVersion: string;
  };
  executiveSummary: string;
  health: VehicleHealthAssessment;
  risk: VehicleRiskAssessment;
  anomalies: {
    totalCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    items: DetectedAnomaly[];
  };
  predictiveMaintenance: PredictiveMaintenanceAssessment;
  evidenceGraph: EvidenceGraph;
  rawEvidencePackage: AIEvidencePackage;
}

export interface AIQuestionRequest {
  question: string;
  contextMode?: 'SUMMARY' | 'RISK_EXPLAIN' | 'MAINTENANCE' | 'GENERAL';
}

export interface AIQuestionResponse {
  question: string;
  answer: string;
  confidenceScore: number; // 0 - 1
  evidenceReferences: string[];
  isFallback: boolean;
  unansweredPortionExplanation?: string;
  modelIdentifier: string;
  timestamp: string;
}
