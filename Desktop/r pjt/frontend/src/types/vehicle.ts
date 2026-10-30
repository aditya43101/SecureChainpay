export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG' | 'LPG';

export type VehicleStatus = 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'SCRAPPED';

export type BlockchainStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface Vehicle {
  id: string;
  passportId: string;
  vin: string;
  registrationNumber: string;
  manufacturer: string;
  model: string;
  variant: string | null;
  manufacturingYear: number;
  fuelType: FuelType;
  color: string | null;
  engineNumber: string | null;
  status: VehicleStatus;
  currentOwnerId: string;
  currentOwner?: {
    id: string;
    name: string;
    email: string;
    role: string;
    photoUrl?: string | null;
    isInitialized?: boolean;
    blockchainUserId?: string | null;
    blockchainAddress?: string | null;
  };
  // Blockchain Fields
  blockchainVehicleId?: string | null;
  recordHash?: string | null;
  blockchainTxHash?: string | null;
  blockNumber?: number | null;
  blockchainStatus?: BlockchainStatus | null;
  blockchainRegisteredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleInput {
  manufacturer: string;
  model: string;
  variant?: string;
  manufacturingYear: number;
  fuelType: FuelType;
  color?: string;
  engineNumber?: string;
  vin: string;
  registrationNumber: string;
}

export interface VehicleResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    vehicle: Vehicle;
  };
}

export interface VehicleListResponse {
  success: boolean;
  error?: string;
  data?: {
    vehicles: Vehicle[];
  };
}

export interface VehicleVerificationResult {
  vehicleId: string;
  passportId: string;
  vin: string;
  isRegisteredOnBlockchain: boolean;
  isVerified: boolean;
  tamperDetected: boolean;
  calculatedHash: string;
  onChainHash: string | null;
  blockchainVehicleId: string | null;
  blockchainTxHash: string | null;
  blockNumber: number | null;
  network: string;
  verifiedAt: string;
  details?: {
    manufacturer: string;
    model: string;
    registrationNumber: string;
    ownerName?: string;
  };
}

export interface VerificationResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: VehicleVerificationResult;
}

// ============================================================================
// LIFECYCLE & VERIFICATION TYPES
// ============================================================================

export interface TimelineEvent {
  id: string;
  category: 'REGISTRATION' | 'OWNERSHIP' | 'SERVICE' | 'ODOMETER' | 'ACCIDENT' | 'INSURANCE' | 'DOCUMENT';
  date: string;
  year: number;
  title: string;
  actor: string;
  description: string;
  blockchainTxHash?: string | null;
  recordHash?: string | null;
  status: 'CONFIRMED' | 'PENDING' | 'SUSPICIOUS' | 'TAMPER_DETECTED';
  details?: Record<string, any>;
}

export interface TimelineResponse {
  success: boolean;
  error?: string;
  data?: {
    vehicleId: string;
    passportId: string;
    count: number;
    timeline: TimelineEvent[];
  };
}

export interface CategoryVerificationItem {
  id: string;
  category: 'OWNERSHIP' | 'SERVICE' | 'ODOMETER' | 'ACCIDENT' | 'INSURANCE' | 'DOCUMENT';
  label: string;
  isVerified: boolean;
  tamperDetected: boolean;
  isSuspicious?: boolean;
  calculatedHash: string;
  onChainHash: string | null;
  timestamp: string;
  blockchainTxHash?: string | null;
  blockNumber?: number | null;
  details?: Record<string, any>;
}

export interface FullVehicleVerificationReport {
  vehicleId: string;
  passportId: string;
  vin: string;
  overallVerified: boolean;
  hasTamper: boolean;
  hasSuspicious: boolean;
  network: string;
  verifiedAt: string;
  vehicleIdentity: VehicleVerificationResult;
  categories: {
    ownership: {
      status: 'VERIFIED' | 'TAMPER_DETECTED' | 'EMPTY';
      count: number;
      records: CategoryVerificationItem[];
    };
    service: {
      status: 'VERIFIED' | 'TAMPER_DETECTED' | 'EMPTY';
      count: number;
      records: CategoryVerificationItem[];
    };
    odometer: {
      status: 'VERIFIED' | 'SUSPICIOUS' | 'TAMPER_DETECTED' | 'EMPTY';
      count: number;
      rollbackDetected: boolean;
      records: CategoryVerificationItem[];
    };
    accident: {
      status: 'VERIFIED' | 'TAMPER_DETECTED' | 'EMPTY';
      count: number;
      records: CategoryVerificationItem[];
    };
    insurance: {
      status: 'VERIFIED' | 'TAMPER_DETECTED' | 'EMPTY';
      count: number;
      records: CategoryVerificationItem[];
    };
    documents: {
      status: 'VERIFIED' | 'TAMPER_DETECTED' | 'EMPTY';
      count: number;
      records: CategoryVerificationItem[];
    };
  };
}

export interface FullVerificationResponse {
  success: boolean;
  error?: string;
  data?: FullVehicleVerificationReport;
}

export interface OwnershipHistoryRecord {
  id: string;
  vehicleId: string;
  previousOwnerId?: string | null;
  previousOwner?: { id: string; name: string; email: string; role: string } | null;
  newOwnerId: string;
  newOwner: { id: string; name: string; email: string; role: string };
  transferType: string;
  transferDate: string;
  notes?: string | null;
  recordHash: string;
  blockchainRecordId?: string | null;
  blockchainTxHash?: string | null;
  blockNumber?: number | null;
  status: string;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  garageId: string;
  garage: { id: string; name: string; email: string; role: string };
  serviceDate: string;
  mileage: number;
  serviceType: string;
  description: string;
  partsReplaced?: string | null;
  laborDescription?: string | null;
  cost?: number | null;
  technician?: string | null;
  notes?: string | null;
  recordHash: string;
  blockchainRecordId?: string | null;
  blockchainTxHash?: string | null;
  blockNumber?: number | null;
  status: string;
}

export interface PublicPassportData {
  passportId: string;
  vehicleSummary: {
    manufacturer: string;
    model: string;
    variant: string;
    manufacturingYear: number;
    fuelType: FuelType;
    color: string;
    registrationNumberMasked: string;
    status: VehicleStatus;
  };
  blockchainStatus: {
    isRegisteredOnBlockchain: boolean;
    blockchainVehicleId: string | null;
    blockchainTxHash: string | null;
    blockNumber: number | null;
    status: BlockchainStatus;
    network: string;
    contractAddress: string;
  };
  verificationStatus: 'VERIFIED' | 'SUSPICIOUS' | 'TAMPERED';
  statusExplanation: string;
  verificationTimestamp: string;
  lifecycleSummary: {
    totalOwnershipTransfers: number;
    totalServices: number;
    totalOdometerReadings: number;
    totalAccidents: number;
    totalInsurancePolicies: number;
    totalDocuments: number;
    rollbackDetected: boolean;
  };
  categories: {
    vehicleIdentity: {
      status: 'VERIFIED' | 'TAMPERED';
      isVerified: boolean;
      tamperDetected: boolean;
      anchoredHash: string | null;
      calculatedHash: string;
    };
    ownership: {
      status: string;
      count: number;
    };
    service: {
      status: string;
      count: number;
    };
    odometer: {
      status: string;
      count: number;
      rollbackDetected: boolean;
    };
    accident: {
      status: string;
      count: number;
    };
    insurance: {
      status: string;
      count: number;
    };
    documents: {
      status: string;
      count: number;
      proofs: Array<{
        documentType: string;
        title: string;
        fileHash: string;
        recordHash: string;
        ipfsCid: string;
        storageProvider: string;
        ocrStatus: string;
        consistencyStatus: string;
        verifiedOnChain: boolean;
        blockchainTxHash?: string | null;
        uploadedAt: string;
      }>;
    };
  };
  timeline: Array<{
    date: string;
    type: string;
    title: string;
    description: string;
    txHash?: string | null;
    status: string;
  }>;
  publicVerificationUrl: string;
}

export interface ExplorerOverviewData {
  network: string;
  chainId: number;
  contractAddress: string;
  latestBlock: number;
  stats: {
    totalVehicles: number;
    totalUsers: number;
    totalAnchors: number;
  };
  eventBreakdown: Record<string, number>;
  explorerUrl?: string | null;
  timestamp: string;
}

export interface ExplorerTransaction {
  id: string;
  txHash: string;
  blockNumber: number;
  recordType: string;
  recordHash: string;
  network: string;
  status: string;
  timestamp: string;
  passportId: string | null;
  vehicleSummary: string | null;
}

export interface ExplorerTransactionsResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  transactions: ExplorerTransaction[];
}

export interface SystemAlertItem {
  id: string;
  type: 'ODOMETER_ROLLBACK' | 'TAMPER_DETECTED' | 'BLOCKCHAIN_FAILURE' | 'UNAUTHORIZED_ACCESS';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  timestamp: string;
  vehicleId?: string | null;
  passportId?: string | null;
  metadata?: any;
}

// ============================================================================
// VEHICLE INTELLIGENCE, FRAUD DETECTION & PREDICTIVE MAINTENANCE
// ============================================================================

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

export interface VehicleHealthAssessment {
  overallScore: number;
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

export interface ComponentRisk {
  category: AnomalyCategory | 'MAINTENANCE';
  label: string;
  riskLevel: RiskLevel;
  score: number;
  reason: string;
  evidence: string[];
  affectedRecordsCount: number;
}

export interface VehicleRiskAssessment {
  overallRiskLevel: RiskLevel;
  overallRiskScore: number;
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

export interface MaintenancePredictionItem {
  id: string;
  system: string;
  title: string;
  status: PredictionStatus;
  confidence: PredictionConfidence;
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

export interface PredictiveMaintenanceAssessment {
  currentMileage: number;
  lastRecordedServiceDate?: string;
  lastRecordedServiceMileage?: number;
  overallMaintenanceRisk: RiskLevel;
  summary: string;
  predictions: MaintenancePredictionItem[];
  engineVersion: string;
}

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
}

export interface AIQuestionResponse {
  question: string;
  answer: string;
  confidenceScore: number;
  evidenceReferences: string[];
  isFallback: boolean;
  unansweredPortionExplanation?: string;
  modelIdentifier: string;
  timestamp: string;
}

// ============================================================================
// DIGITAL VEHICLE TWIN & USED-CAR BUYER INTELLIGENCE
// ============================================================================

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
  state: string;
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

export interface DigitalVehicleTwin {
  vehicleId: string;
  passportId: string;
  vin: string;
  reconstructedAt: string;
  engineVersion: string;

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

  maintenance: {
    totalServicesCount: number;
    lastServiceDate: string | null;
    lastServiceMileage: number | null;
    lastServiceType: string | null;
    serviceCoverageScore: number;
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

  insurance: {
    hasActiveCoverage: boolean;
    currentPolicyReference: string | null;
    currentProvider: string | null;
    expiresAt: string | null;
    totalPoliciesCount: number;
    level: EvidenceLevel;
  };

  documents: {
    totalDocumentsCount: number;
    verifiedDocumentsCount: number;
    consistencyStatus: string;
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

  intelligence: {
    healthScore: number;
    healthStatus: string;
    riskScore: number;
    riskLevel: string;
    anomaliesCount: number;
    predictiveItemsCount: number;
  };

  stateEvolution: VehicleStateEvolution[];
  timeline: DigitalTwinTimelineEvent[];
  evidenceRegistry: EvidenceItem[];
}

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

  odometerTransparency: {
    currentMileage: number;
    rollbackDetected: boolean;
    anomalyDetected: boolean;
    statusExplanation: string;
    progression: Array<{ date: string; mileage: number; source: string }>;
  };

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

  questionsToAskSeller: BuyerQuestionToAsk[];
  whatIsVerified: VerifiedFact[];
  whatIsUnknown: UnknownFact[];

  riskFactors: Array<{
    category: string;
    riskLevel: string;
    summary: string;
    evidence: string[];
  }>;

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

// ============================================================================
// INDUSTRY & EV ECOSYSTEM INTELLIGENCE INTERFACES
// ============================================================================

export interface ManufacturerCertificateDTO {
  id: string;
  vehicleId: string;
  passportId: string;
  vin: string;
  manufacturerId: string;
  manufacturerName: string;
  certificateNumber: string;
  manufacturingPlant: string | null;
  manufacturingDate: string;
  initialOdometer: number;
  specificationSnapshot: Record<string, any>;
  recordHash: string;
  blockchainRecordId: string | null;
  blockchainTxHash: string | null;
  blockNumber: number | null;
  status: BlockchainStatus;
  verificationStatus: 'VERIFIED' | 'TAMPER_DETECTED' | 'PENDING' | 'NOT_ANCHORED';
  createdAt: string;
}

export interface CreateManufacturerCertificateInput {
  certificateNumber?: string;
  manufacturingPlant?: string;
  manufacturingDate?: string;
  initialOdometer?: number;
  specificationSnapshot?: Record<string, any>;
}

export interface BatteryLifecycleEventDTO {
  id: string;
  batteryPassportId: string;
  eventType: string;
  eventDate: string;
  recordedBy: string;
  capacityKwh: number | null;
  sohPercentage: number | null;
  cycleCount: number | null;
  description: string;
  verificationStatus: string;
  evidenceRef: string | null;
  recordHash: string | null;
  blockchainTxHash: string | null;
  blockNumber: number | null;
  createdAt: string;
}

export interface BatteryPassportDTO {
  id: string;
  vehicleId: string;
  passportId: string;
  batterySerial: string;
  chemistry: string;
  nominalCapacityKwh: number;
  currentCapacityKwh: number;
  sohPercentage: number;
  cycleCount: number;
  manufactureDate: string;
  installationDate: string;
  warrantyExpiryDate: string | null;
  isOriginal: boolean;
  status: string;
  estimatedDegradationPercentage: number;
  capacityRetainedPercentage: number;
  evidenceClassification: 'VERIFIED' | 'DERIVED' | 'ESTIMATED' | 'INSUFFICIENT_DATA';
  recordHash: string;
  blockchainRecordId: string | null;
  blockchainTxHash: string | null;
  blockNumber: number | null;
  events: BatteryLifecycleEventDTO[];
  createdAt: string;
}

export interface CreateBatteryPassportInput {
  batterySerial: string;
  chemistry: string;
  nominalCapacityKwh: number;
  currentCapacityKwh?: number;
  sohPercentage?: number;
  cycleCount?: number;
  manufactureDate?: string;
  installationDate?: string;
  warrantyExpiryDate?: string;
  isOriginal?: boolean;
}

export interface LogBatteryEventInput {
  eventType: 'BATTERY_INSTALLED' | 'BATTERY_INSPECTED' | 'BATTERY_SERVICED' | 'BATTERY_REPAIRED' | 'BATTERY_REPLACED' | 'BATTERY_DECOMMISSIONED';
  eventDate?: string;
  capacityKwh?: number;
  sohPercentage?: number;
  cycleCount?: number;
  description: string;
  evidenceRef?: string;
}

export interface InsuranceClaimDTO {
  id: string;
  insuranceRecordId: string;
  policyReference: string;
  accidentRecordId: string | null;
  claimNumber: string;
  claimDate: string;
  claimAmount: number | null;
  approvedAmount: number | null;
  claimStatus: string;
  description: string;
  payoutDate: string | null;
  accidentDetails?: {
    date: string;
    severity: string;
    description: string;
    repairStatus: string;
  } | null;
  recordHash: string;
  blockchainTxHash: string | null;
  blockNumber: number | null;
  createdAt: string;
}

export interface CreateInsuranceClaimInput {
  insuranceRecordId?: string;
  accidentRecordId?: string;
  claimNumber?: string;
  claimDate?: string;
  claimAmount?: number;
  approvedAmount?: number;
  claimStatus?: string;
  description: string;
  payoutDate?: string;
}

export interface InsuranceIntelligenceReport {
  vehicleId: string;
  passportId: string;
  totalPolicies: number;
  activePolicy: {
    policyReference: string;
    providerName: string;
    startDate: string;
    endDate: string;
    status: string;
    coverageType: string;
  } | null;
  coverageContinuity: 'CONTINUOUS' | 'GAPS_DETECTED' | 'EXPIRED' | 'UNINSURED';
  totalClaimsCount: number;
  totalClaimAmountApproved: number;
  claims: InsuranceClaimDTO[];
  accidentCorrelation: {
    totalAccidents: number;
    linkedToClaimsCount: number;
    unlinkedAccidentsCount: number;
    correlationStatus: 'ALL_LINKED' | 'PARTIAL_LINKAGE' | 'NO_CLAIMS' | 'UNLINKED_ACCIDENTS';
  };
  riskObservations: string[];
}

export interface GarageProfileDTO {
  id: string;
  userId: string;
  garageName: string;
  licenseNumber: string | null;
  verificationStatus: 'VERIFIED' | 'PENDING_VERIFICATION' | 'UNVERIFIED' | 'SUSPENDED';
  accreditations: string | null;
  specialties: string | null;
  contactPhone: string | null;
  address: string | null;
  verifiedServicesCount: number;
  anchoredServicesCount: number;
  anomalyCount: number;
  trustIndex: number;
  serviceRecordsCount: number;
}

export interface UpdateGarageProfileInput {
  businessName?: string;
  licenseNumber?: string;
  verificationStatus?: 'VERIFIED' | 'PENDING_VERIFICATION' | 'UNVERIFIED' | 'SUSPENDED';
  accreditations?: string;
  specialties?: string;
  contactPhone?: string;
  address?: string;
}

export interface VehicleGarageIntelligence {
  vehicleId: string;
  totalServicesPerformed: number;
  servicingGaragesCount: number;
  allGaragesVerified: boolean;
  networkSummary: Array<{
    garageId: string;
    garageName: string;
    verificationStatus: string;
    trustIndex: number;
    servicesOnThisVehicle: number;
    hasBlockchainAnchors: boolean;
  }>;
}

export interface EcosystemTimelineEvent {
  id: string;
  category: 'MANUFACTURING' | 'REGISTRATION' | 'BATTERY' | 'GARAGE_SERVICE' | 'INSURANCE' | 'ACCIDENT' | 'BLOCKCHAIN';
  date: string;
  title: string;
  actor: string;
  description: string;
  evidenceRef?: string;
  blockchainTxHash?: string | null;
}

export interface VehicleEcosystemOverview {
  vehicleId: string;
  passportId: string;
  vin: string;
  fuelType: FuelType;
  isEv: boolean;
  manufacturerCertificate: ManufacturerCertificateDTO | null;
  batteryPassport: BatteryPassportDTO | null;
  insuranceIntelligence: InsuranceIntelligenceReport;
  garageIntelligence: VehicleGarageIntelligence;
  ecosystemTimeline: EcosystemTimelineEvent[];
  generatedAt: string;
}

export interface PublicEcosystemSummary {
  passportId: string;
  vinMasked: string;
  manufacturer: string;
  model: string;
  variant: string | null;
  manufacturingYear: number;
  fuelType: FuelType;
  isEv: boolean;
  manufacturerCertificate: {
    isIssued: boolean;
    certificateNumber?: string;
    manufacturerName?: string;
    manufacturingPlant?: string | null;
    manufacturingDate?: string;
    initialOdometer?: number;
    verificationStatus?: string;
    blockchainTxHash?: string | null;
  } | null;
  batteryPassport: {
    batterySerialMasked: string;
    chemistry: string;
    nominalCapacityKwh: number;
    capacityRetainedPercentage: number;
    currentHealthPct: number;
    cycleCount: number;
    status: string;
    evidenceClassification: string;
  } | null;
  insurance: {
    activePolicyPresent: boolean;
    coverageContinuity: string;
    settledClaimsCount: number;
  };
  servicingGaragesSummary: {
    totalServices: number;
    allGaragesVerified: boolean;
    verifiedGarages: Array<{
      garageName: string;
      verificationStatus: string;
      trustIndex: number;
    }>;
  };
  ecosystemEventsCount: number;
  generatedAt: string;
}

// ============================================================================
// SELECTIVE DISCLOSURE & PRIVACY DTOs
// ============================================================================

export interface DisclosureProfileDTO {
  id: string;
  shareId: string;
  shareUrl: string;
  title: string | null;
  categories: string[];
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  accessCount?: number;
  lastAccessedAt?: string | null;
  expiresAt: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface CreateDisclosureInput {
  title?: string;
  categories: string[];
  expiresInDays?: number | null;
}

export interface SharedPassportDTO {
  shareId: string;
  title: string | null;
  status: string;
  expiresAt: string | null;
  disclosedCategories: string[];
  disclosedData: {
    vehicleIdentity?: {
      manufacturer: string;
      model: string;
      variant: string;
      manufacturingYear: number;
      fuelType: string;
      color: string;
      registrationNumberMasked: string;
      vinMasked: string;
      status: string;
    };
    ownership?: {
      totalOwners: number;
      isVerifiedOnChain: boolean;
      records: Array<{
        ownerNumber: number;
        transferDate: string;
        transferType: string;
        verifiedOnChain: boolean;
        blockchainTxHash?: string | null;
      }>;
    };
    odometer?: {
      currentReadingKm: number;
      rollbackDetected: boolean;
      isVerifiedOnChain: boolean;
      readingsCount: number;
      history: Array<{
        readingKm: number;
        readingDate: string;
        sourceType: string;
        verified: boolean;
        blockchainTxHash?: string | null;
      }>;
    };
    service?: {
      totalServices: number;
      isVerifiedOnChain: boolean;
      records: Array<{
        serviceType: string;
        serviceDate: string;
        odometerReadingKm: number;
        description: string;
        verifiedOnChain: boolean;
        blockchainTxHash?: string | null;
      }>;
    };
    accident?: {
      totalAccidents: number;
      isVerifiedOnChain: boolean;
      records: Array<{
        accidentDate: string;
        severity: string;
        damageArea: string;
        description: string;
        verifiedOnChain: boolean;
        blockchainTxHash?: string | null;
      }>;
    };
    repair?: {
      totalRepairs: number;
      records: Array<{
        repairDate: string;
        repairStatus: string;
        repairedParts?: string | null;
        repairFacility?: string | null;
        verifiedOnChain: boolean;
      }>;
    };
    insurance?: {
      hasActiveInsurance: boolean;
      providerName: string;
      policyStatus: string;
      totalRecordedPolicies: number;
      isVerifiedOnChain: boolean;
    };
    documents?: {
      totalVerifiedDocuments: number;
      proofs: Array<{
        documentType: string;
        title: string;
        fileHash: string;
        recordHash: string;
        ipfsCid?: string | null;
        verifiedOnChain: boolean;
        blockchainTxHash?: string | null;
        uploadedAt: string;
      }>;
    };
    blockchainProof?: {
      passportId: string;
      blockchainVehicleId?: string | null;
      contractAddress: string;
      network: string;
      genesisTxHash?: string | null;
      genesisBlockNumber?: number | null;
      isAnchored: boolean;
      overallVerification: string;
    };
    batteryPassport?: {
      isApplicable: boolean;
      batterySerialMasked?: string;
      chemistry?: string;
      nominalCapacityKwh?: number;
      currentCapacityKwh?: number;
      capacityRetentionPercentage?: number;
      sohPercentage?: number;
      cycleCount?: number;
      status?: string;
      evidenceClassification?: string;
      blockchainTxHash?: string | null;
      reason?: string;
    };
    vehicleHealth?: {
      score: number;
      status: string;
      calculatedAt: string;
      summary: string;
    };
    riskSummary?: {
      overallRiskLevel: string;
      overallRiskScore: number;
      summary: string;
    };
  };
  verificationSummary: {
    passportId: string;
    overallState: string;
    verifiedAt: string;
  };
}

// ============================================================================
// ADMIN INTELLIGENCE DTOs
// ============================================================================

export interface AdminOverviewDTO {
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  vehicles: {
    total: number;
    byStatus: Record<string, number>;
    byFuel: Record<string, number>;
  };
  blockchain: {
    totalRecords: number;
    confirmed: number;
    pending: number;
    failed: number;
  };
  documents: {
    total: number;
    byConsistency: Record<string, number>;
  };
  lifecycleCounts: {
    services: number;
    odometerReadings: number;
    accidents: number;
    insurances: number;
    manufacturerCertificates: number;
    batteryPassports: number;
    certifiedGarages: number;
  };
  trustAndIntegrity: {
    totalVerificationQueries: number;
    tamperDetectionsLogged: number;
    activeAdminCases: number;
  };
  timestamp: string;
}

export interface AdminBlockchainAnalyticsDTO {
  network: {
    name: string;
    chainId: number;
    contractAddress: string;
    currentBlockNumber: number;
    isNodeOnline: boolean;
  };
  metrics: {
    totalRecords: number;
    confirmed: number;
    pending: number;
    failed: number;
    anchorsByType: Record<string, number>;
  };
  recentAnchors: Array<{
    id: string;
    txHash: string;
    blockNumber: number;
    recordType: string;
    recordHash: string;
    status: string;
    passportId: string | null;
    vehicleLabel: string | null;
    timestamp: string;
  }>;
  timestamp: string;
}

export interface AdminCaseDTO {
  id: string;
  caseNumber: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  evidence?: any;
  vehicle?: string | null;
  vehiclePassportId?: string | null;
  assignedTo: string;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLogDTO {
  id: string;
  action: string;
  status: string;
  actor: string;
  actorEmail?: string | null;
  passportId?: string | null;
  vehicleLabel?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface DataQualityAuditDTO {
  summary: {
    missingOdometerCount: number;
    missingServiceCount: number;
    missingInsuranceCount: number;
    documentMismatchesCount: number;
  };
  vehiclesMissingOdometer: Array<{ id: string; passportId: string; manufacturer: string; model: string; manufacturingYear: number }>;
  vehiclesMissingService: Array<{ id: string; passportId: string; manufacturer: string; model: string }>;
  vehiclesMissingInsurance: Array<{ id: string; passportId: string; manufacturer: string; model: string }>;
  mismatchedDocuments: Array<{
    id: string;
    title: string;
    documentType: string;
    passportId: string;
    vehicleLabel: string;
    consistencyStatus: string;
    createdAt: string;
  }>;
}

// ============================================================================
// MERKLE TREE BATCH ANCHORING & CRYPTOGRAPHIC VERIFICATION
// ============================================================================

export type MerkleBatchStatus =
  | 'CREATED'
  | 'BUILDING'
  | 'READY'
  | 'SUBMITTING'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'FAILED'
  | 'RETRYABLE'
  | 'RECONCILIATION_REQUIRED';

export interface MerkleBatchRecordDTO {
  id: string;
  batchId: string;
  recordId: string;
  recordType: string;
  vehicleId?: string | null;
  leafHash: string;
  leafIndex: number;
  proof: string;
  recordHashSnapshot: string;
  createdAt: string;
}

export interface MerkleBatchDTO {
  id: string;
  batchIdentifier: string;
  batchIdHex: string;
  merkleRoot: string;
  leafCount: number;
  algorithmVersion: string;
  hashAlgorithm: string;
  leafEncodingVersion: string;
  oddNodeConvention: string;
  status: MerkleBatchStatus;
  networkChainId: number;
  contractAddress: string;
  transactionHash?: string | null;
  blockNumber?: number | null;
  blockHash?: string | null;
  metadataHash?: string | null;
  lastErrorCode?: string | null;
  retryCount: number;
  createdAt: string;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  failedAt?: string | null;
  isAnchored?: boolean;
  records?: MerkleBatchRecordDTO[];
}

export interface BatchOverviewDTO {
  totalBatches: number;
  confirmedBatches: number;
  pendingBatches: number;
  failedBatches: number;
  committedRecords: number;
  networkChainId: number;
  contractAddress: string;
  latestBatch: MerkleBatchDTO | null;
}

export interface ProofStepDTO {
  level: number;
  current: string;
  sibling: string;
  parent: string;
}

export interface RecordVerificationReportDTO {
  recordId: string;
  recordType: string;
  vehicleId?: string | null;
  anchoringMode: 'BATCH_MERKLE' | 'LEGACY_INDIVIDUAL' | 'UNANCHORED';
  overallStatus:
    | 'VERIFIED'
    | 'PENDING'
    | 'RECORD_HASH_MISMATCH'
    | 'INVALID_PROOF'
    | 'ROOT_MISMATCH'
    | 'BATCH_NOT_FOUND'
    | 'BATCH_NOT_CONFIRMED'
    | 'BLOCKCHAIN_UNAVAILABLE'
    | 'NETWORK_MISMATCH'
    | 'CONTRACT_MISMATCH'
    | 'INSUFFICIENT_EVIDENCE';
  recordHashStatus: 'MATCH' | 'MISMATCH';
  proofStatus?: 'VALID' | 'INVALID' | 'NOT_APPLICABLE';
  databaseRootStatus?: 'MATCH' | 'MISMATCH';
  blockchainRootStatus?: 'MATCH' | 'MISMATCH' | 'NOT_ANCHORED' | 'NOT_APPLICABLE';
  batchIdentifier?: string;
  batchStatus?: string;
  algorithmVersion?: string;
  leafIndex?: number;
  leafCount?: number;
  calculatedHash: string;
  expectedHash: string;
  leafHash?: string;
  calculatedRoot?: string;
  databaseRoot?: string;
  onChainRoot?: string;
  transactionHash?: string | null;
  blockNumber?: number | null;
  proofSteps?: ProofStepDTO[];
  evidence: Array<{
    key: string;
    value: any;
    status: 'VALID' | 'WARNING' | 'ERROR';
  }>;
  verifiedAt: string;
}

export interface BatchInclusionProofDTO {
  batchIdentifier: string;
  batchIdHex: string;
  recordId: string;
  recordType: string;
  leafHash: string;
  leafIndex: number;
  merkleRoot: string;
  proof: string[];
  proofSteps: ProofStepDTO[];
  isAnchoredOnChain: boolean;
  transactionHash?: string | null;
  blockNumber?: number | null;
}

export interface EligibleBatchRecordDTO {
  recordId: string;
  recordType: string;
  vehicleId: string;
  recordHash: string;
  createdAt: string;
  sourceTable: string;
}

// ============================================================================
// FRAUD INTELLIGENCE GRAPH & EVIDENCE CORRELATION TYPES
// ============================================================================

export interface GraphNodeDTO {
  id: string;
  nodeKey: string;
  entityType: string;
  entityId: string;
  label: string;
  metadata?: any;
  sourceRecordHash?: string | null;
  isAnchored?: boolean;
  anomalyScore?: number;
  lastSyncedAt?: string;
  inDegree?: number;
  outDegree?: number;
}

export interface GraphEdgeDTO {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceNodeKey?: string;
  targetNodeKey?: string;
  relationshipType: string;
  isDirect: boolean;
  isInferred: boolean;
  confidence: number;
  sourceReference?: string | null;
  evidence?: any;
  createdAt: string;
}

export interface VehicleGraphDTO {
  vehicle: {
    id: string;
    passportId: string;
    vin: string;
    registrationNumber: string;
    manufacturer: string;
    model: string;
  };
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
  findings: FraudFindingDTO[];
}

export interface FraudFindingDTO {
  id: string;
  findingNumber: string;
  ruleId: string;
  ruleVersion: string;
  ruleName: string;
  category: string;
  severity: 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'UNDER_REVIEW' | 'NEEDS_MORE_EVIDENCE' | 'RESOLVED' | 'DISMISSED';
  primaryEntityId: string;
  primaryEntityType: string;
  title: string;
  description: string;
  explanation: string;
  unknowns?: string | null;
  recommendedAction?: string | null;
  case?: {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
  } | null;
  firstDetectedAt: string;
  lastEvaluatedAt: string;
}

export interface FraudFindingDetailDTO extends FraudFindingDTO {
  involvedNodes: Array<{
    nodeKey: string;
    label: string;
    entityType: string;
    entityId: string;
    metadata?: any;
  }>;
  evidenceReferences: Array<{
    recordType: string;
    recordId: string;
    field?: string;
    expected?: any;
    actual?: any;
    hash?: string;
    notes?: string;
  }>;
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  resolutionReason?: string | null;
}

export interface InvestigationCaseDTO {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'UNDER_REVIEW' | 'NEEDS_MORE_EVIDENCE' | 'RESOLVED' | 'DISMISSED';
  findingsCount: number;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  createdAt: string;
}

export interface GraphOverviewDTO {
  totalNodes: number;
  totalEdges: number;
  lastSyncedAt: string | null;
  status: string;
  syncDurationMs: number;
  nodeTypeDistribution: Array<{ type: string; count: number }>;
  edgeTypeDistribution: Array<{ type: string; count: number }>;
  findingsSummary: {
    totalFindings: number;
    highSeverity: number;
    openFindings: number;
    totalCases: number;
    byCategory: Array<{ category: string; count: number }>;
    bySeverity: Array<{ severity: string; count: number }>;
  };
}

// ============================================================================
// AUTONOMOUS VEHICLE PASSPORT INVESTIGATION AGENT TYPES
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

export type InvestigationTypeEnum =
  | 'ODOMETER_ROLLBACK'
  | 'OWNERSHIP_IDENTITY'
  | 'DOCUMENT_INTEGRITY'
  | 'FRAUD_GRAPH'
  | 'MULTI_SIGNAL'
  | 'GENERAL';

export type StepStatusType = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface StructuredClaimDTO {
  claim: string;
  claimType: 'VERIFIED_FACT' | 'SOURCE_CLAIM' | 'RULE_FINDING' | 'INFERRED_RELATIONSHIP' | 'CONTRADICTION' | 'UNKNOWN';
  evidenceRefs: string[];
  supportingObservations: string[];
  contradictingObservations: string[];
  assessment: string;
  limitations?: string;
}

export interface StructuredFindingDTO {
  findingId: string;
  category: string;
  severity: 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assessmentStatus: 'CONFIRMED' | 'SUSPECTED' | 'DISPROVED' | 'INCONCLUSIVE' | 'HYPOTHESIS';
  title: string;
  explanation: string;
  supportingEvidenceRefs: string[];
  contradictingEvidenceRefs: string[];
  verificationResults?: string[];
  limitations?: string;
  recommendedNextSteps: string[];
}

export interface InvestigationReportDTO {
  investigationId: string;
  runNumber: string;
  vehicleId?: string;
  targetType: 'VEHICLE' | 'FINDING' | 'DOCUMENT' | 'ENTITY';
  targetId: string;
  investigationType: InvestigationTypeEnum;
  status: InvestigationStatusType;
  generatedAt: string;
  reportVersion: string;
  executiveSummary: string;
  verifiedFacts: StructuredClaimDTO[];
  observations: StructuredClaimDTO[];
  findings: StructuredFindingDTO[];
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
  report?: InvestigationReportDTO | null;
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
  verificationStatus: 'VERIFIED' | 'TAMPERED' | 'MISMATCH' | 'UNVERIFIED' | 'UNAVAILABLE';
  description: string;
  limitations?: string | null;
  relationship: 'SUPPORTING' | 'CONTRADICTING' | 'NEUTRAL';
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

export interface CreateInvestigationInput {
  targetType: 'VEHICLE' | 'FINDING' | 'DOCUMENT' | 'ENTITY';
  targetId: string;
  vehicleId?: string;
  investigationType?: InvestigationTypeEnum;
  maxSteps?: number;
  executionBudgetMs?: number;
  caseId?: string;
  waitForCompletion?: boolean;
}

// ============================================================================
// PRIVACY-PRESERVING VEHICLE VERIFICATION & ZERO-KNOWLEDGE PROOFS
// ============================================================================

export interface PrivacyCredentialDTO {
  id: string;
  credentialId: string;
  credentialType: string;
  schemaVersion: string;
  rootCommitment: string;
  issuer: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  issuerPublicKey: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  validFrom: string;
  validUntil: string;
  revokedAt?: string;
  revocationReason?: string;
  onChainTxHash?: string;
  createdAt: string;
}

export interface ZkpChallengeSessionDTO {
  sessionId: string;
  vehicleId: string;
  vehicleCommitment: string;
  claimType: string;
  policyThreshold?: number;
  nonce: string;
  expiresAt: string;
  instructions: string;
}

export interface DisclosedAttributeItemDTO {
  key: string;
  value: string | number | boolean;
  salt: string;
  leafHash: string;
  merkleProof: string[];
}

export interface UndisclosedAttributeItemDTO {
  key: string;
  disclosed: false;
}

export interface SelectiveDisclosurePresentationDTO {
  format: 'MDC_SELECTIVE_DISCLOSURE_V1';
  credentialId: string;
  vehicleCommitment: string;
  validFrom: string;
  validUntil: string;
  merkleRoot: string;
  credentialCommitment: string;
  issuerAddress: string;
  issuerSignature: string;
  disclosedAttributes: DisclosedAttributeItemDTO[];
  undisclosedAttributes: UndisclosedAttributeItemDTO[];
}

export interface SelectiveVerificationResultDTO {
  valid: boolean;
  error?: string;
  credentialId: string;
  issuerAddress: string;
  vehicleCommitment: string;
  verifiedAttributes: Record<string, string | number | boolean>;
  hiddenFieldCount: number;
  isExpired: boolean;
  verificationDurationMs: number;
  timestamp: string;
}

export interface BitProofDTO {
  e0: string;
  e1: string;
  s0: string;
  s1: string;
}

export interface ZkpRangeProofPayloadDTO {
  proofSystem: 'PEDERSEN_NIZK_RANGE_V1';
  bitWidth: number;
  commitment: string;
  threshold: number;
  deltaCommitment: string;
  bitCommitments: string[];
  linearAnnouncement: string;
  linearResponse: string;
  bitProofs: BitProofDTO[];
  vehicleCommitment: string;
  claimType: string;
  nonce: string;
}

export interface ZkpVerificationResultDTO {
  valid: boolean;
  error?: string;
  statement: string;
  publicInputs: {
    vehicleCommitment: string;
    claimType: string;
    threshold: number;
    commitment: string;
    nonce: string;
  };
  verificationDurationMs: number;
  timestamp: string;
  onChainReceiptTx?: string;
}

export interface PrivacyDisclosureLogDTO {
  id: string;
  logNumber: string;
  vehicleId: string;
  credentialId?: string | null;
  disclosureType: string;
  claimType: string;
  disclosedFields: string;
  verifierIdentifier?: string | null;
  verificationStatus: string;
  verificationDetails?: string | null;
  blockchainReceiptTx?: string | null;
  createdAt: string;
}

// ============================================================================
// AUTONOMOUS DIGITAL VEHICLE TWIN TYPES
// ============================================================================

export type TwinEvidenceLevel = 'VERIFIED' | 'DERIVED' | 'ESTIMATED' | 'UNVERIFIED' | 'SUSPICIOUS';

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

export interface StateProvenanceItem<T = any> {
  value: T;
  sourceRecordId?: string | null;
  sourceRecordType?: string;
  sourceSystem: string;
  sourceTimestamp: string;
  computedAt: string;
  verifiedStatus: TwinEvidenceLevel;
  freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
  conflictsDetected: boolean;
  conflictingEvidenceNotes?: string | null;
  ruleVersion: string;
}

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

export interface TwinLifecycleEventDTO {
  id: string;
  vehicleId: string;
  eventType: string;
  sourceRecordId?: string | null;
  sourceSystem: string;
  eventTime: string;
  recordedTime: string;
  ingestionTime: string;
  actor?: string | null;
  schemaVersion: string;
  sourceVerificationStatus: string;
  contentHash?: string | null;
  blockchainTxHash?: string | null;
  idempotencyKey: string;
  summary: string;
  payloadJson?: string | null;
}

export interface AutonomousDigitalVehicleTwinDTO {
  vehicleId: string;
  passportId: string;
  vin: string;
  reconstructedAt: string;
  engineVersion: string;
  ontology: FiveWayOntologyStatus;
  derivedState: DerivedTwinStateWithProvenance;
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
  integrations: {
    merkleBatchesCount: number;
    fraudFindingsCount: number;
    activeInvestigationRunId?: string | null;
    privacyCredentialsCount: number;
    latestZkpProofTimestamp?: string | null;
  };
  eventsCount: number;
}

export type TwinScenarioType =
  | 'SCHEDULED_MAINTENANCE'
  | 'ODOMETER_PROJECTION'
  | 'OWNERSHIP_PRECHECK'
  | 'BATTERY_DEGRADATION';

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




