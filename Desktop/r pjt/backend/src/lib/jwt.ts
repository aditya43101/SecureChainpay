import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-blockchain-vehicle-passport-secret-key-2026';

export interface TokenPayload {
  userId: string;
  firebaseUid: string;
  email: string;
  role: string;
  isInitialized: boolean;
  onboardingStatus?: string;
}

export const signToken = (payload: TokenPayload, expiresIn: string = '7d'): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
};
