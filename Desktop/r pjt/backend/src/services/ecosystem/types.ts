import {
  BlockchainStatus,
  VerificationStatus,
  FuelType,
} from '@prisma/client';

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
  manufacturingDate: string;
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
  verificationStatus: VerificationStatus;
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
  manufactureDate: string;
  installationDate: string;
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
  accidentRecordId?: string;
  claimNumber?: string;
  claimDate: string;
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
