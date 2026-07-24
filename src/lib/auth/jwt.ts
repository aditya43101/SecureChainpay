import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  role: string;
  [key: string]: any;
}

export interface JwtTokens {
  accessToken: string;
  refreshToken: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'securechain-super-secret-key-fallback';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'securechain-super-refresh-secret-fallback';

export function generateTokens(payload: JwtPayload): JwtTokens {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
  
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}
