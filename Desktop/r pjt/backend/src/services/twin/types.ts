import { FuelType, VehicleStatus } from '@prisma/client';
import {
  VehicleHealthAssessment,
  VehicleRiskAssessment,
  PredictiveMaintenanceAssessment,
  DetectedAnomaly,
  EvidenceGraph,
} from '../intelligence/types';

export type EvidenceLevel = 'VERIFIED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';

export interface EvidenceItem {
  key: string;
  label: string;
  value: any;
  level: EvidenceLevel;
  sourceRecordId?: string;
  sourceRecordType?: string;
  proofHash?: string;
  note?: string;
}

export interface VehicleStateEvolution {
  timestamp: string;
  state: string; // e.g. "FACTORY_DELIVERY", "ROUTINE_SERVICE", "COLLISION_REPORTED", "CERTIFIED_REPAIR", "VERIFIED_OPERATIONAL"
  label: string;
  triggerEvent: string;
  description: string;
  verificationStatus: 'VERIFIED' | 'TAMPERED' | 'SUSPICIOUS' | 'UNVERIFIED';
  mileage?: number;
  actor?: string;
}

export interface DigitalTwinTimelineEvent {
  id: string;
  category: 'REGISTRATION' | 'OWNERSHIP' | 'SERVICE' | 'ODOMETER' | 'ACCIDENT' | 'INSURANCE' | 'DOCUMENT' | 'BLOCKCHAIN';
  date: string;
  title: string;
  description: string;
  actor: string;
  level: EvidenceLevel;
  status: 'CONFIRMED' | 'PENDING' | 'SUSPICIOUS' | 'TAMPER_DETECTED';
  blockchainTxHash?: string | null;
  recordHash?: string | null;
  evidenceRef?: string;
}

/**
 * Normalized Continuously Reconstructed Digital Vehicle Twin
 */
export interface DigitalVehicleTwin {
  vehicleId: string;
  passportId: string;
  vin: string;
  reconstructedAt: string;
  engineVersion: string;

  // 1. Vehicle Identity
  identity: {
    manufacturer: string;
    model: string;
    variant: string | null;
    manufacturingYear: number;
    fuelType: FuelType;
    color: string | null;
    registrationNumber: string;
    status: VehicleStatus;
    level: EvidenceLevel;
  };

  // 2. Ownership State
  ownership: {
    currentOwnerName: string;
    currentOwnerRole: string;
    totalOwnersCount: number;
    transfersCount: number;
    currentOwnershipDurationDays: number;
    history: Array<{
      transferDate: string;
      transferType: string;
      previousOwner?: string | null;
      newOwner: string;
      recordHash: string;
      level: EvidenceLevel;
    }>;
  };

  // 3. Odometer State
  odometer: {
    currentMileage: number;
    lastRecordedDate: string | null;
    totalReadingsCount: number;
    isMonotonic: boolean;
    rollbackDetected: boolean;
    averageAnnualMileageKm: number;
    dailyMileageVelocityKm: number;
    readingsHistory: Array<{
      date: string;
      mileage: number;
      source: string;
      level: EvidenceLevel;
    }>;
  };

  // 4. Maintenance State
  maintenance: {
    totalServicesCount: number;
    lastServiceDate: string | null;
    lastServiceMileage: number | null;
    lastServiceType: string | null;
    serviceCoverageScore: number; // 0 - 100%
    coverageFormulaExplanation: string;
    serviceGapsDetected: boolean;
    services: Array<{
      id: string;
      date: string;
      mileage: number;
      type: string;
      garageName: string;
      cost: number | null;
      level: EvidenceLevel;
    }>;
  };

  // 5. Accident & Structural State
  accidents: {
    totalAccidentsCount: number;
    openRepairsCount: number;
    severeAccidentsCount: number;
    records: Array<{
      id: string;
      date: string;
      severity: string;
      description: string;
      repairStatus: string;
      repairedAt: string | null;
      level: EvidenceLevel;
    }>;
  };

  // 6. Insurance Continuity State
  insurance: {
    hasActiveCoverage: boolean;
    currentPolicyReference: string | null;
    currentProvider: string | null;
    expiresAt: string | null;
    totalPoliciesCount: number;
    level: EvidenceLevel;
  };

  // 7. Smart Document State
  documents: {
    totalDocumentsCount: number;
    verifiedDocumentsCount: number;
    consistencyStatus: string; // CONSISTENT | PARTIAL | INCONSISTENT | UNVERIFIED
    documentProofs: Array<{
      id: string;
      type: string;
      title: string;
      ipfsCid: string | null;
      storageProvider: string;
      ocrConsistency: string;
      level: EvidenceLevel;
    }>;
  };

  // 8. Blockchain State
  blockchain: {
    isAnchored: boolean;
    contractAddress: string;
    network: string;
    totalAnchoredRecords: number;
    latestBlockNumber: number | null;
    latestTxHash: string | null;
    integrityStatus: 'VERIFIED' | 'TAMPER_DETECTED' | 'PENDING';
    level: EvidenceLevel;
  };

  // 9. Intelligence Integration (Phase 2 Engines)
  intelligence: {
    healthScore: number;
    healthStatus: string;
    riskScore: number;
    riskLevel: string;
    anomaliesCount: number;
    predictiveItemsCount: number;
  };

  // 10. Dynamic Evolution Progression
  stateEvolution: VehicleStateEvolution[];

  // 11. Unified Chronological Timeline
  timeline: DigitalTwinTimelineEvent[];

  // 12. Full Evidence Registry
  evidenceRegistry: EvidenceItem[];
}

/**
 * Buyer Intelligence Model
 */
export interface BuyerQuestionToAsk {
  id: string;
  category: string;
  question: string;
  contextReason: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface VerifiedFact {
  category: string;
  fact: string;
  source: string;
  onChainVerified: boolean;
}

export interface UnknownFact {
  category: string;
  description: string;
  impactReason: string;
}

export interface BuyerIntelligenceReport {
  vehicleId: string;
  passportId: string;
  vin: string;
  generatedAt: string;
  engineVersion: string;

  // Overview
  overview: {
    manufacturer: string;
    model: string;
    variant: string | null;
    manufacturingYear: number;
    vehicleAgeYears: number;
    fuelType: FuelType;
    registrationNumber: string;
    currentVerifiedMileage: number;
    status: VehicleStatus;
    totalOwnersCount: number;
  };

  // Trust Summary
  trustSummary: {
    overallTrustBadge: 'VERIFIED' | 'PROCEED_WITH_CAUTION' | 'HIGH_RISK_TAMPER';
    blockchainVerified: boolean;
    odometerIntegrityVerified: boolean;
    serviceIntegrityVerified: boolean;
    accidentRepairsVerified: boolean;
    documentConsistencyVerified: boolean;
    healthScore: number;
    riskLevel: string;
  };

  // Odometer Transparency
  odometerTransparency: {
    currentMileage: number;
    rollbackDetected: boolean;
    anomalyDetected: boolean;
    statusExplanation: string;
    progression: Array<{ date: string; mileage: number; source: string }>;
  };

  // Service History Intelligence
  serviceIntelligence: {
    totalServices: number;
    serviceCoveragePercentage: number;
    coverageCalculationFormula: string;
    frequencyAssessment: string;
    lastServiceDate: string | null;
    lastServiceMileage: number | null;
    nextExpectedServiceKm: number | null;
    isOverdueForService: boolean;
  };

  // Accident & Repair Summary
  accidentIntelligence: {
    totalAccidents: number;
    severeDamageRecorded: boolean;
    allRepairsCertified: boolean;
    summary: string;
    incidents: Array<{
      date: string;
      severity: string;
      description: string;
      repairStatus: string;
    }>;
  };

  // Questions to Ask the Seller (Evidence-Driven)
  questionsToAskSeller: BuyerQuestionToAsk[];

  // Explicit What is Verified
  whatIsVerified: VerifiedFact[];

  // Explicit What is Unknown (Missing Records)
  whatIsUnknown: UnknownFact[];

  // Categorical Risk Breakdown
  riskFactors: Array<{
    category: string;
    riskLevel: string;
    summary: string;
    evidence: string[];
  }>;

  // Structured AI Analysis
  aiAnalysis?: {
    summary: string;
    facts: string[];
    anomalies: string[];
    unknowns: string[];
    questions: string[];
    evidence: string[];
    confidenceScore: number;
  };
}

/**
 * Public Sanitized Buyer Summary (Zero PII, Masked Reg No, Unauthenticated safe)
 */
export interface PublicBuyerSummary {
  passportId: string;
  vinMasked: string;
  registrationNumberMasked: string;
  manufacturer: string;
  model: string;
  variant: string | null;
  manufacturingYear: number;
  vehicleAgeYears: number;
  fuelType: FuelType;
  currentVerifiedMileage: number;
  overallTrustBadge: 'VERIFIED' | 'PROCEED_WITH_CAUTION' | 'HIGH_RISK_TAMPER';
  blockchainVerified: boolean;
  healthScore: number;
  riskLevel: string;
  totalOwnersCount: number;
  totalServicesCount: number;
  totalAccidentsCount: number;
  odometerRollbackDetected: boolean;
  serviceCoveragePercentage: number;
  serviceCoverageFormula: string;
  questionsToAskSeller: BuyerQuestionToAsk[];
  whatIsVerified: string[];
  whatIsUnknown: string[];
  publicBlockchainProof: {
    network: string;
    contractAddress: string;
    isAnchored: boolean;
    latestBlock: number | null;
  };
  generatedAt: string;
}
