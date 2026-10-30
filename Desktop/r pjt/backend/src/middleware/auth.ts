import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../lib/jwt';
import { verifyFirebaseIdToken } from '../lib/firebaseAdmin';
import { User, UserRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication token missing or invalid format',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 0. Support local dev tokens (vpt_ base64url or dev-seed-token)
    if (token.startsWith('vpt_')) {
      try {
        const jsonStr = Buffer.from(token.slice(4), 'base64url').toString('utf8');
        const payload = JSON.parse(jsonStr);
        if (payload.email) {
          const user = await prisma.user.findFirst({
            where: { email: { equals: payload.email, mode: 'insensitive' } },
          });
          if (user) {
            req.user = user;
            return next();
          }
        }
      } catch (_) {}
    }

    if (token.startsWith('dev-seed-token:')) {
      const parts = token.split(':');
      const email = parts[2];
      if (email) {
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
        if (user) {
          req.user = user;
          return next();
        }
      }
    }

    // 1. Try internal JWT verification first (fastest)
    const jwtPayload = verifyToken(token);
    if (jwtPayload && jwtPayload.userId) {
      const user = await prisma.user.findUnique({
        where: { id: jwtPayload.userId },
      });

      if (user) {
        req.user = user;
        return next();
      }
    }

    // 2. If not internal JWT, verify as Firebase ID Token
    const firebaseUser = await verifyFirebaseIdToken(token);
    if (firebaseUser && firebaseUser.uid) {
      const user = await prisma.user.findUnique({
        where: { firebaseUid: firebaseUser.uid },
      });

      if (user) {
        req.user = user;
        return next();
      } else {
        return res.status(401).json({
          success: false,
          error: 'Firebase user not registered in database. Call /api/auth/sync first.',
        });
      }
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token',
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication',
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: role ${req.user.role} does not have required permissions`,
      });
    }

    next();
  };
}

export function requireInitialized(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!req.user.isInitialized) {
    return res.status(403).json({
      success: false,
      error: 'Initialize your Vehicle Passport before adding a vehicle.',
      code: 'PASSPORT_NOT_INITIALIZED',
    });
  }

  next();
}

export async function optionalAuthenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const jwtPayload = verifyToken(token);
    if (jwtPayload && jwtPayload.userId) {
      const user = await prisma.user.findUnique({ where: { id: jwtPayload.userId } });
      if (user) {
        req.user = user;
        return next();
      }
    }
    const firebaseUser = await verifyFirebaseIdToken(token);
    if (firebaseUser && firebaseUser.uid) {
      const user = await prisma.user.findUnique({ where: { firebaseUid: firebaseUser.uid } });
      if (user) {
        req.user = user;
        return next();
      }
    }
  } catch {
    // Ignore invalid tokens in optional auth
  }
  next();
}

