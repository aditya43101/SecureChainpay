export type UserRole = 'VEHICLE_OWNER' | 'GARAGE' | 'MANUFACTURER' | 'INSURANCE_PROVIDER' | 'ADMIN';

export type OnboardingStatus = 'NOT_STARTED' | 'COMPLETED_WITH_VEHICLE' | 'COMPLETED_WITHOUT_VEHICLE';

export interface User {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  photoUrl: string | null;
  role: UserRole;
  isInitialized: boolean;
  onboardingStatus?: OnboardingStatus;
  blockchainAddress: string | null;
  blockchainUserId?: string | null;
  blockchainTxHash?: string | null;
  blockchainInitializedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    user: User;
    token: string;
    isNewUser?: boolean;
  };
}
