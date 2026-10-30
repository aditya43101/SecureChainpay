export interface BlockchainUserResult {
  blockchainUserId: string;
  userReferenceHash: string;
  walletAddress: string;
  role: string;
  txHash: string;
  blockNumber: number;
}

export interface BlockchainVehicleResult {
  blockchainVehicleId: string;
  passportId: string;
  vehicleRecordHash: string;
  ownerAddress: string;
  txHash: string;
  blockNumber: number;
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
