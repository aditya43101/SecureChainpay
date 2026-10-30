import { User, AuthResponse } from '../types/auth';
import {
  Vehicle,
  CreateVehicleInput,
  VehicleResponse,
  VehicleListResponse,
  VehicleIntelligenceReport,
  VehicleHealthAssessment,
  VehicleRiskAssessment,
  PredictiveMaintenanceAssessment,
  DetectedAnomaly,
  AIQuestionResponse,
  DigitalVehicleTwin,
  BuyerIntelligenceReport,
  PublicBuyerSummary,
  VehicleStateEvolution,
  DigitalTwinTimelineEvent,
  ManufacturerCertificateDTO,
  CreateManufacturerCertificateInput,
  BatteryPassportDTO,
  CreateBatteryPassportInput,
  LogBatteryEventInput,
  BatteryLifecycleEventDTO,
  InsuranceIntelligenceReport,
  CreateInsuranceClaimInput,
  InsuranceClaimDTO,
  GarageProfileDTO,
  UpdateGarageProfileInput,
  VehicleGarageIntelligence,
  VehicleEcosystemOverview,
  EcosystemTimelineEvent,
  PublicEcosystemSummary,
  DisclosureProfileDTO,
  CreateDisclosureInput,
  SharedPassportDTO,
  AdminOverviewDTO,
  AdminBlockchainAnalyticsDTO,
  AdminCaseDTO,
  AdminAuditLogDTO,
  DataQualityAuditDTO,
  MerkleBatchDTO,
  BatchOverviewDTO,
  BatchInclusionProofDTO,
  RecordVerificationReportDTO,
  EligibleBatchRecordDTO,
  GraphNodeDTO,
  GraphEdgeDTO,
  VehicleGraphDTO,
  FraudFindingDTO,
  FraudFindingDetailDTO,
  InvestigationCaseDTO,
  GraphOverviewDTO,
  InvestigationRunDTO,
  InvestigationStepDTO,
  InvestigationEvidenceDTO,
  InvestigationReportDTO,
  InvestigationOverviewDTO,
  CreateInvestigationInput,
  PrivacyCredentialDTO,
  ZkpChallengeSessionDTO,
  DisclosedAttributeItemDTO,
  UndisclosedAttributeItemDTO,
  SelectiveDisclosurePresentationDTO,
  SelectiveVerificationResultDTO,
  BitProofDTO,
  ZkpRangeProofPayloadDTO,
  ZkpVerificationResultDTO,
  PrivacyDisclosureLogDTO,
  AutonomousDigitalVehicleTwinDTO,
  FiveWayOntologyStatus,
  StateProvenanceItem,
  DerivedTwinStateWithProvenance,
  TwinLifecycleEventDTO,
  TwinScenarioType,
  ScenarioDiffItem,
  ScenarioSimulationResultDTO,
  TwinReconciliationResultDTO,
} from '../types/vehicle';

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    // On Vercel / HTTPS or when NEXT_PUBLIC_API_URL points to localhost, use relative /api
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (
      window.location.protocol === 'https:' ||
      !envUrl ||
      envUrl.includes('localhost') ||
      envUrl.includes('127.0.0.1')
    ) {
      return '/api';
    }
    return envUrl;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
};

const API_BASE = getApiBase();

/* ---------------- Auth Endpoints ---------------- */

export async function syncUserWithBackend(
  userData: {
    firebaseUid?: string;
    email?: string;
    name?: string;
    photoUrl?: string | null;
  },
  idToken?: string
): Promise<AuthResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(`${API_BASE}/auth/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...userData, idToken }),
  });

  return res.json();
}

export async function fetchMe(token: string): Promise<{ success: boolean; data?: { user: User }; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function initializePassportApi(token: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/initialize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function setOnboardingStatusApi(
  token: string,
  status: 'COMPLETED_WITHOUT_VEHICLE' | 'COMPLETED_WITH_VEHICLE' | 'NOT_STARTED'
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/onboarding`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  return res.json();
}

export async function logoutApi(token?: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.warn('Backend logout notification skipped:', err);
  }
}

export async function fetchTestUsers(): Promise<{ success: boolean; data?: { testUsers: User[] }; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/test-users`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function loginAsTestUserApi(email: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  return res.json();
}

/* ---------------- Vehicle Endpoints (Phase 2) ---------------- */

export async function fetchMyVehicles(token: string): Promise<VehicleListResponse> {
  const res = await fetch(`${API_BASE}/vehicles`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchVehicleById(id: string, token: string): Promise<VehicleResponse> {
  const res = await fetch(`${API_BASE}/vehicles/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function createVehicle(input: CreateVehicleInput, token: string): Promise<VehicleResponse> {
  const res = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return res.json();
}

export async function updateVehicle(
  id: string,
  input: { color?: string | null; variant?: string | null; engineNumber?: string | null },
  token: string
): Promise<VehicleResponse> {
  const res = await fetch(`${API_BASE}/vehicles/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return res.json();
}

/* ---------------- Blockchain Endpoints (Phase 3) ---------------- */

export async function verifyVehiclePassportApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: import('../types/vehicle').VehicleVerificationResult }> {
  const res = await fetch(`${API_BASE}/blockchain/vehicle/${vehicleId}/verify`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function registerVehicleOnBlockchainApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: { vehicle: Vehicle } }> {
  const res = await fetch(`${API_BASE}/blockchain/vehicle/${vehicleId}/register`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

/* ---------------- Lifecycle & Verification Endpoints (Phase 4) ---------------- */

export async function fetchVehicleTimeline(
  vehicleId: string,
  token: string
): Promise<import('../types/vehicle').TimelineResponse> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/timeline`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchFullVehicleVerification(
  vehicleId: string,
  token: string
): Promise<import('../types/vehicle').FullVerificationResponse> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/verify`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function transferVehicleOwnershipApi(
  vehicleId: string,
  payload: { targetUserIdentifier: string; transferType: string; notes?: string },
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/ownership/transfer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function addVehicleServiceApi(
  vehicleId: string,
  payload: {
    serviceDate: string;
    mileage: number;
    serviceType: string;
    description: string;
    partsReplaced?: string[];
    laborDescription?: string;
    cost?: number;
    technician?: string;
    notes?: string;
  },
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/services`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function addVehicleOdometerApi(
  vehicleId: string,
  payload: { mileage: number; recordedAt?: string; sourceType?: string; notes?: string },
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/odometer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function addVehicleAccidentApi(
  vehicleId: string,
  payload: {
    accidentDate: string;
    severity?: string;
    description: string;
    damagedParts?: string[];
    locationDescription?: string;
    insuranceClaimId?: string;
  },
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/accidents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function updateVehicleRepairApi(
  vehicleId: string,
  accidentId: string,
  payload: { repairStatus: string; repairDescription: string },
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/accidents/${accidentId}/repair`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function addVehicleInsuranceApi(
  vehicleId: string,
  payload: {
    policyReference: string;
    startDate: string;
    endDate: string;
    status?: string;
    coverageType?: string;
    claimReference?: string;
    notes?: string;
  },
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/insurance`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function addVehicleDocumentApi(
  vehicleId: string,
  payload: {
    documentType: string;
    title: string;
    fileContent: string;
    storageUrl?: string;
    fileSizeBytes?: number;
    mimeType?: string;
  },
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function simulateTamperApi(
  vehicleId: string,
  payload: { field: string; tamperedValue?: any; recordId?: string },
  token: string
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/simulate-tamper`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function restoreTamperApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/restore-tamper`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

/* ---------------- Phase 5: Public Verification & Trust Endpoints ---------------- */

export async function fetchPublicPassport(
  passportId: string
): Promise<{ success: boolean; data?: import('../types/vehicle').PublicPassportData; error?: { code: string; message: string } }> {
  const res = await fetch(`${API_BASE}/public/passport/${encodeURIComponent(passportId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchBlockchainExplorerOverview(): Promise<{
  success: boolean;
  data?: import('../types/vehicle').ExplorerOverviewData;
  error?: { code: string; message: string };
}> {
  const res = await fetch(`${API_BASE}/public/explorer/overview`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchBlockchainExplorerTransactions(params?: {
  search?: string;
  recordType?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: import('../types/vehicle').ExplorerTransactionsResponse;
  error?: { code: string; message: string };
}> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.recordType && params.recordType !== 'ALL') searchParams.append('recordType', params.recordType);
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE}/public/explorer/transactions${query}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchPublicAlerts(): Promise<{
  success: boolean;
  data?: { count: number; alerts: import('../types/vehicle').SystemAlertItem[] };
  error?: { code: string; message: string };
}> {
  const res = await fetch(`${API_BASE}/public/alerts`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function processDocumentOCRApi(
  vehicleId: string,
  documentId: string,
  token: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/documents/${documentId}/ocr`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

/* ---------------- Phase 2: Vehicle Intelligence Endpoints ---------------- */

export async function fetchVehicleIntelligence(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: VehicleIntelligenceReport; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/intelligence`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchVehicleHealth(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: VehicleHealthAssessment; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/intelligence/health`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchVehicleAnomalies(
  vehicleId: string,
  token: string
): Promise<{
  success: boolean;
  data?: {
    totalCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    items: DetectedAnomaly[];
  };
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/intelligence/anomalies`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchVehicleRisk(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: VehicleRiskAssessment; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/intelligence/risk`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchPredictiveMaintenance(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: PredictiveMaintenanceAssessment; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/intelligence/maintenance`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function askVehicleIntelligenceAi(
  vehicleId: string,
  question: string,
  token: string,
  contextMode: 'SUMMARY' | 'RISK_EXPLAIN' | 'MAINTENANCE' | 'GENERAL' = 'GENERAL'
): Promise<{ success: boolean; data?: AIQuestionResponse; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/intelligence/ask`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, contextMode }),
  });

  return res.json();
}

/* ---------------- Phase 3: Digital Twin & Used-Car Buyer Intelligence Endpoints ---------------- */

export async function fetchDigitalTwin(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: DigitalVehicleTwin; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchDigitalTwinTimeline(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: DigitalTwinTimelineEvent[]; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/timeline`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchDigitalTwinEvolution(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: VehicleStateEvolution[]; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/evolution`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchBuyerReport(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: BuyerIntelligenceReport; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/buyer-report`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

export async function fetchPublicBuyerSummary(
  passportId: string
): Promise<{ success: boolean; data?: PublicBuyerSummary; error?: string }> {
  const res = await fetch(`${API_BASE}/public/passport/${encodeURIComponent(passportId)}/buyer-summary`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return res.json();
}

/* ---------------- Phase 4: Industry & EV Ecosystem Intelligence Endpoints ---------------- */

export async function fetchManufacturerCertificate(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: ManufacturerCertificateDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/birth-certificate`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function createManufacturerCertificate(
  vehicleId: string,
  input: CreateManufacturerCertificateInput,
  token: string
): Promise<{ success: boolean; data?: ManufacturerCertificateDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/birth-certificate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function fetchBatteryPassport(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: (BatteryPassportDTO & { isApplicable?: boolean }) | null; message?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/battery-passport`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function createBatteryPassport(
  vehicleId: string,
  input: CreateBatteryPassportInput,
  token: string
): Promise<{ success: boolean; data?: BatteryPassportDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/battery-passport`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function logBatteryLifecycleEvent(
  vehicleId: string,
  input: LogBatteryEventInput,
  token: string
): Promise<{ success: boolean; data?: BatteryLifecycleEventDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/battery/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function fetchInsuranceIntelligence(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: InsuranceIntelligenceReport; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/insurance-intelligence`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fileInsuranceClaim(
  vehicleId: string,
  input: CreateInsuranceClaimInput,
  token: string
): Promise<{ success: boolean; data?: InsuranceClaimDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/insurance/claims`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function fetchGarageProfile(
  garageId: string
): Promise<{ success: boolean; data?: GarageProfileDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/garages/${garageId}/profile`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function updateGarageProfile(
  garageId: string,
  input: UpdateGarageProfileInput,
  token: string
): Promise<{ success: boolean; data?: GarageProfileDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/garages/${garageId}/profile`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function fetchVehicleGarageIntelligence(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: VehicleGarageIntelligence; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/garage-intelligence`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchVehicleEcosystem(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: VehicleEcosystemOverview; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/ecosystem`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchEcosystemTimeline(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: { timeline: EcosystemTimelineEvent[]; count: number }; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/ecosystem/timeline`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchPublicEcosystemSummary(
  passportId: string
): Promise<{ success: boolean; data?: PublicEcosystemSummary; error?: string }> {
  const res = await fetch(`${API_BASE}/public/passport/${encodeURIComponent(passportId)}/ecosystem-summary`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

/* ---------------- Phase 5: Selective Disclosure Endpoints ---------------- */

export async function createSelectiveDisclosure(
  vehicleId: string,
  input: CreateDisclosureInput,
  token: string
): Promise<{ success: boolean; data?: DisclosureProfileDTO; error?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/disclosures`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function fetchVehicleDisclosures(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: DisclosureProfileDTO[]; error?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/disclosures`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function revokeSelectiveDisclosure(
  vehicleId: string,
  shareId: string,
  token: string
): Promise<{ success: boolean; data?: { shareId: string; status: string; revokedAt: string }; error?: any }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/disclosures/${shareId}/revoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchSharedPassport(
  shareId: string
): Promise<{ success: boolean; data?: SharedPassportDTO; error?: any }> {
  const res = await fetch(`${API_BASE}/public/share/${encodeURIComponent(shareId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

/* ---------------- Phase 5: Admin Intelligence Endpoints ---------------- */

export async function fetchAdminOverview(
  token: string
): Promise<{ success: boolean; data?: AdminOverviewDTO; error?: any }> {
  const res = await fetch(`${API_BASE}/admin/intelligence/overview`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchAdminBlockchainAnalytics(
  token: string
): Promise<{ success: boolean; data?: AdminBlockchainAnalyticsDTO; error?: any }> {
  const res = await fetch(`${API_BASE}/admin/intelligence/blockchain`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchAdminBlockchainRecords(
  params: { search?: string; recordType?: string; status?: string; page?: number; limit?: number },
  token: string
): Promise<{ success: boolean; data?: { total: number; page: number; limit: number; totalPages: number; records: any[] }; error?: any }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.recordType) query.set('recordType', params.recordType);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/admin/intelligence/explorer?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchAdminTamperMonitoring(
  token: string
): Promise<{ success: boolean; data?: { cases: AdminCaseDTO[]; recentAuditAlerts: any[] }; error?: any }> {
  const res = await fetch(`${API_BASE}/admin/intelligence/tamper-monitoring`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function createAdminCase(
  input: { vehicleId?: string; category: string; title: string; description: string; severity?: string; evidence?: any },
  token: string
): Promise<{ success: boolean; data?: AdminCaseDTO; error?: any }> {
  const res = await fetch(`${API_BASE}/admin/intelligence/cases`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function updateAdminCase(
  caseId: string,
  input: { status?: string; resolutionNotes?: string; assignedToId?: string },
  token: string
): Promise<{ success: boolean; data?: AdminCaseDTO; error?: any }> {
  const res = await fetch(`${API_BASE}/admin/intelligence/cases/${caseId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function fetchAdminDataQuality(
  token: string
): Promise<{ success: boolean; data?: DataQualityAuditDTO; error?: any }> {
  const res = await fetch(`${API_BASE}/admin/intelligence/data-quality`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchAdminAuditLogs(
  params: { action?: string; status?: string; search?: string; page?: number; limit?: number },
  token: string
): Promise<{ success: boolean; data?: { total: number; page: number; limit: number; totalPages: number; logs: AdminAuditLogDTO[] }; error?: any }> {
  const query = new URLSearchParams();
  if (params.action) query.set('action', params.action);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/admin/intelligence/audit-logs?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchAdminGlobalSearch(
  query: string,
  token: string
): Promise<{ success: boolean; data?: { vehicles: any[]; users: any[]; blockchainRecords: any[]; garages: any[] }; error?: any }> {
  const res = await fetch(`${API_BASE}/admin/intelligence/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

/* ---------------- Phase 6: Merkle Batches & Verification Endpoints ---------------- */

export async function fetchBatches(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  data?: {
    overview: BatchOverviewDTO;
    batches: MerkleBatchDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE}/blockchain/batches?${query.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function fetchBatchDetails(batchId: string): Promise<{
  success: boolean;
  data?: MerkleBatchDTO;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/blockchain/batches/${batchId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function fetchBatchEligibleRecords(
  token: string,
  params?: { limit?: number; vehicleId?: string; recordType?: string }
): Promise<{
  success: boolean;
  data?: {
    count: number;
    limit: number;
    records: EligibleBatchRecordDTO[];
  };
  error?: string;
}> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.vehicleId) query.set('vehicleId', params.vehicleId);
  if (params?.recordType) query.set('recordType', params.recordType);

  const res = await fetch(`${API_BASE}/blockchain/batches/eligible?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function createBatchApi(
  token: string,
  data: {
    recordIds?: string[];
    maxBatchSize?: number;
    recordType?: string;
    autoSubmit?: boolean;
  }
): Promise<{
  success: boolean;
  data?: {
    batch: MerkleBatchDTO;
    includedCount: number;
    receipt?: any;
  };
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/blockchain/batches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function reconcileBatchApi(
  batchId: string,
  token: string
): Promise<{
  success: boolean;
  data?: {
    batchId: string;
    batchIdentifier: string;
    status: string;
    transactionHash?: string | null;
    blockNumber?: number | null;
    actionTaken: string;
  };
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/blockchain/batches/${batchId}/reconcile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchRecordInclusionProof(
  batchId: string,
  recordId: string
): Promise<{
  success: boolean;
  data?: BatchInclusionProofDTO;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/blockchain/batches/${batchId}/proof/${recordId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function verifyProofDirectApi(payload: {
  leaf: string;
  proof: string[];
  root: string;
  batchIdHex?: string;
}): Promise<{
  success: boolean;
  data?: {
    isValid: boolean;
    calculatedRoot: string;
    targetRoot: string;
    steps: Array<{ level: number; current: string; sibling: string; parent: string }>;
    onChainVerified?: boolean;
    error?: string;
  };
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/blockchain/verify-proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchVehicleBlockchainVerification(vehicleId: string): Promise<{
  success: boolean;
  data?: {
    vehicleId: string;
    passportId: string;
    summary: {
      totalRecords: number;
      batchAnchored: number;
      legacyAnchored: number;
      unanchored: number;
      allVerified: boolean;
    };
    records: RecordVerificationReportDTO[];
  };
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/blockchain-verification`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

/* ---------------- Phase 7 Fraud Intelligence Graph Endpoints ---------------- */

export async function fetchGraphOverview(token: string): Promise<{
  success: boolean;
  data?: GraphOverviewDTO;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/intelligence/graph/overview`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchVehicleGraph(
  vehicleId: string,
  depth = 2,
  token: string
): Promise<{
  success: boolean;
  data?: VehicleGraphDTO;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/intelligence/graph/vehicles/${vehicleId}?depth=${depth}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchEntityNeighborhood(
  entityType: string,
  entityId: string,
  depth = 1,
  token: string
): Promise<{
  success: boolean;
  data?: {
    entity: { type: string; id: string };
    nodes: GraphNodeDTO[];
    edges: GraphEdgeDTO[];
  };
  error?: string;
}> {
  const res = await fetch(
    `${API_BASE}/intelligence/graph/entities/${entityType}/${entityId}?depth=${depth}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return res.json();
}

export async function fetchFraudFindings(
  params: {
    page?: number;
    limit?: number;
    severity?: string;
    status?: string;
    category?: string;
    ruleId?: string;
    search?: string;
    vehicleId?: string;
  },
  token: string
): Promise<{
  success: boolean;
  data?: {
    findings: FraudFindingDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.severity) query.set('severity', params.severity);
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.ruleId) query.set('ruleId', params.ruleId);
  if (params.search) query.set('search', params.search);
  if (params.vehicleId) query.set('vehicleId', params.vehicleId);

  const res = await fetch(`${API_BASE}/intelligence/graph/findings?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function fetchFindingDetails(
  findingId: string,
  token: string
): Promise<{
  success: boolean;
  data?: FraudFindingDetailDTO;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/intelligence/graph/findings/${findingId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function updateFindingStatus(
  findingId: string,
  status: string,
  resolutionReason: string,
  token: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/intelligence/graph/findings/${findingId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, resolutionReason }),
  });
  return res.json();
}

export async function fetchInvestigationCases(
  params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
  },
  token: string
): Promise<{
  success: boolean;
  data?: {
    cases: InvestigationCaseDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);

  const res = await fetch(`${API_BASE}/intelligence/graph/investigations?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function createInvestigationCase(
  payload: {
    title: string;
    description: string;
    priority?: string;
    findingIds: string[];
    assignedToId?: string;
  },
  token: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/intelligence/graph/investigations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function reconcileGraphApi(token: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/intelligence/graph/reconcile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function findEvidencePathApi(
  source: string,
  target: string,
  token: string
): Promise<{
  success: boolean;
  data?: {
    found: boolean;
    hops: number;
    path: Array<{ nodeKey: string; label: string; entityType: string; relationship?: string | null }>;
    message?: string;
  };
  error?: string;
}> {
  const query = new URLSearchParams({ source, target });
  const res = await fetch(`${API_BASE}/intelligence/graph/path?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

/* ---------------- Phase 8: Autonomous Vehicle Passport Investigation Agent Endpoints ---------------- */

export async function createInvestigationApi(
  input: CreateInvestigationInput,
  token: string
): Promise<{ success: boolean; data?: InvestigationRunDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/investigations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function listInvestigationsApi(
  params: { vehicleId?: string; status?: string; limit?: number; offset?: number },
  token: string
): Promise<{ success: boolean; data?: { runs: InvestigationRunDTO[]; total: number }; error?: string }> {
  const query = new URLSearchParams();
  if (params.vehicleId) query.set('vehicleId', params.vehicleId);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.offset) query.set('offset', params.offset.toString());

  const res = await fetch(`${API_BASE}/investigations?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getInvestigationApi(
  id: string,
  token: string
): Promise<{ success: boolean; data?: InvestigationRunDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/investigations/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function cancelInvestigationApi(
  id: string,
  reason: string,
  token: string
): Promise<{ success: boolean; data?: InvestigationRunDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/investigations/${id}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  return res.json();
}

export async function getInvestigationReportApi(
  id: string,
  token: string
): Promise<{ success: boolean; data?: InvestigationReportDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/investigations/${id}/report`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getInvestigationEvidenceApi(
  id: string,
  token: string
): Promise<{ success: boolean; data?: InvestigationEvidenceDTO[]; error?: string }> {
  const res = await fetch(`${API_BASE}/investigations/${id}/evidence`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getInvestigationTimelineApi(
  id: string,
  token: string
): Promise<{ success: boolean; data?: InvestigationStepDTO[]; error?: string }> {
  const res = await fetch(`${API_BASE}/investigations/${id}/timeline`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getInvestigationOverviewApi(
  token: string
): Promise<{ success: boolean; data?: InvestigationOverviewDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/investigations/overview`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function listInvestigationToolsApi(
  token: string
): Promise<{
  success: boolean;
  data?: Array<{
    name: string;
    version: string;
    description: string;
    category: string;
    isReadOnly: boolean;
    requiredRole?: string[];
  }>;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/investigations/tools`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

/* ---------------- Phase 9: Privacy-Preserving & ZKP Endpoints ---------------- */

export async function createZkpChallengeApi(
  vehicleId: string,
  claimType: string,
  policyThreshold?: number,
  token?: string
): Promise<{ success: boolean; data?: ZkpChallengeSessionDTO; error?: { code: string; message: string } }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/privacy/challenge`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ vehicleId, claimType, policyThreshold }),
  });
  return res.json();
}

export async function issuePrivacyCredentialApi(
  input: {
    vehicleId: string;
    credentialType: string;
    attributes: Record<string, string | number | boolean>;
    numericalWitness?: number;
    validityDays?: number;
  },
  token: string
): Promise<{ success: boolean; data?: PrivacyCredentialDTO; message?: string; error?: { code: string; message: string } }> {
  const res = await fetch(`${API_BASE}/privacy/credentials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function getVehiclePrivacyCredentialsApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: PrivacyCredentialDTO[]; error?: { code: string; message: string } }> {
  const res = await fetch(`${API_BASE}/privacy/credentials/vehicle/${vehicleId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function revokePrivacyCredentialApi(
  credentialId: string,
  reason: string,
  token: string
): Promise<{ success: boolean; data?: any; message?: string; error?: { code: string; message: string } }> {
  const res = await fetch(`${API_BASE}/privacy/credentials/${credentialId}/revoke`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  return res.json();
}

export async function createSelectiveDisclosureApi(
  credentialId: string,
  discloseKeys: string[],
  token: string
): Promise<{
  success: boolean;
  data?: SelectiveDisclosurePresentationDTO;
  message?: string;
  error?: { code: string; message: string };
}> {
  const res = await fetch(`${API_BASE}/privacy/selective-disclosure/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credentialId, discloseKeys }),
  });
  return res.json();
}

export async function verifySelectiveDisclosureApi(
  presentation: SelectiveDisclosurePresentationDTO,
  verifierIdentifier?: string
): Promise<{ success: boolean; data?: SelectiveVerificationResultDTO; error?: { code: string; message: string } }> {
  const res = await fetch(`${API_BASE}/privacy/selective-disclosure/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ presentation, verifierIdentifier }),
  });
  return res.json();
}

export async function generateZkpRangeProofApi(
  input: {
    vehicleId: string;
    claimType: string;
    threshold: number;
    nonce: string;
  },
  token: string
): Promise<{
  success: boolean;
  data?: {
    proof: ZkpRangeProofPayloadDTO;
    statement: string;
    vehicleCommitment: string;
    sessionStatus: string;
  };
  message?: string;
  error?: { code: string; message: string };
}> {
  const res = await fetch(`${API_BASE}/privacy/zkp/generate-range-proof`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function verifyZkpRangeProofApi(
  proof: ZkpRangeProofPayloadDTO,
  verifierIdentifier?: string
): Promise<{ success: boolean; data?: ZkpVerificationResultDTO; error?: { code: string; message: string } }> {
  const res = await fetch(`${API_BASE}/privacy/zkp/verify-range-proof`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ proof, verifierIdentifier }),
  });
  return res.json();
}

export async function getPrivacyDisclosureLogsApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: PrivacyDisclosureLogDTO[]; error?: { code: string; message: string } }> {
  const res = await fetch(`${API_BASE}/privacy/disclosure-logs/vehicle/${vehicleId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

/* ---------------- Phase 10: Autonomous Digital Vehicle Twin Endpoints ---------------- */

export async function getAutonomousTwinApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: AutonomousDigitalVehicleTwinDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/autonomous`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getTwinEventsTimelineApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: { vehicleId: string; count: number; events: TwinLifecycleEventDTO[] }; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function syncTwinEventsApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; message?: string; data?: { scannedCount: number; upsertedCount: number }; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function reconcileTwinApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; message?: string; data?: TwinReconciliationResultDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/reconcile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getTwinReconciliationsApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/reconciliations`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function simulateTwinScenarioApi(
  vehicleId: string,
  input: { scenarioType: TwinScenarioType; inputs: Record<string, any> },
  token: string
): Promise<{ success: boolean; message?: string; data?: ScenarioSimulationResultDTO; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/simulate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function getTwinScenariosHistoryApi(
  vehicleId: string,
  token: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/scenarios`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function handoffTwinAnomalyToInvestigationApi(
  vehicleId: string,
  input: { anomalyId?: string; reason: string; investigationType?: string },
  token: string
): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/digital-twin/investigate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return res.json();
}
