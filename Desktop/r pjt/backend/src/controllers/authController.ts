import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { AuthenticatedRequest } from '../middleware/auth';
import { verifyFirebaseIdToken } from '../lib/firebaseAdmin';
import { UserRole, OnboardingStatus } from '@prisma/client';
import { BlockchainService } from '../blockchain/services/blockchainService';


export async function syncUser(req: AuthenticatedRequest, res: Response) {
  try {
    // 1. Extract Firebase ID token from Authorization header or body
    let idToken: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.split(' ')[1];
    } else if (req.body.idToken) {
      idToken = req.body.idToken;
    }

    if (!idToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing Firebase ID token in Authorization header or request body',
      });
    }

    // 2. Cryptographically verify Firebase ID token
    const decodedToken = await verifyFirebaseIdToken(idToken);
    if (!decodedToken || !decodedToken.uid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Firebase ID token',
      });
    }

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email || req.body.email;
    const name = decodedToken.name || req.body.name || 'Vehicle Owner';
    const photoUrl = decodedToken.picture || req.body.photoUrl || null;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required from verified token or profile',
      });
    }

    // 3. Query user by verified firebaseUid
    let user = await prisma.user.findUnique({
      where: { firebaseUid },
    });

    let isNewUser = false;

    if (!user) {
      // Also check if email matches a seeded record
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        // Link existing record with verified Firebase UID
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            firebaseUid,
            name: name || existingByEmail.name,
            photoUrl: photoUrl || existingByEmail.photoUrl,
          },
        });
      } else {
        // New user: Created uninitialized until /auth/initialize is called
        user = await prisma.user.create({
          data: {
            firebaseUid,
            email,
            name,
            photoUrl,
            role: UserRole.VEHICLE_OWNER,
            isInitialized: false,
            onboardingStatus: OnboardingStatus.NOT_STARTED,
            blockchainUserId: null,
            blockchainAddress: null,
          },
        });
        isNewUser = true;
        console.log(`[AUTH] Registered new application user (uninitialized): ${email} (UID: ${firebaseUid})`);
      }
    } else {
      // Existing user: Refresh metadata and assign blockchainUserId if missing
      const updateData: any = {
        name: name || user.name,
        photoUrl: photoUrl || user.photoUrl,
      };
      if (!user.blockchainUserId) {
        let num = (await prisma.user.count()) + 1;
        let candidate = `USR-${String(num).padStart(6, '0')}`;
        while (await prisma.user.findUnique({ where: { blockchainUserId: candidate } })) {
          num++;
          candidate = `USR-${String(num).padStart(6, '0')}`;
        }
        updateData.blockchainUserId = candidate;
        updateData.isInitialized = true;
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    // 4. Issue authenticated session token
    const token = signToken({
      userId: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      isInitialized: user.isInitialized,
      onboardingStatus: user.onboardingStatus,
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'New user registered (uninitialized)' : 'User authenticated successfully',
      data: {
        user,
        isNewUser,
        token,
      },
    });
  } catch (error) {
    console.error('syncUser error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to synchronize authenticated user',
    });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve current user',
    });
  }
}

export async function initializeUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Phase 3: Register user on blockchain before setting isInitialized = true
    try {
      const blockchainService = BlockchainService.getInstance();
      await blockchainService.initializeUser({
        userId: req.user.id,
        firebaseUid: req.user.firebaseUid,
        role: req.user.role,
        address: req.user.blockchainAddress,
      });
    } catch (blockchainErr: any) {
      console.error('[AUTH] Blockchain user initialization failed:', blockchainErr);
      return res.status(502).json({
        success: false,
        error: `Blockchain initialization failed: ${blockchainErr.message || 'Transaction error'}. Please try again.`,
      });
    }

    // Explicitly initialize user in database using authenticated User ID (never from body!)
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isInitialized: true,
      },
    });

    console.log(`[AUTH] Explicitly initialized passport: ${updatedUser.email} (User ID: ${updatedUser.id}, Blockchain ID: ${updatedUser.blockchainUserId})`);

    // Re-issue updated token
    const updatedToken = signToken({
      userId: updatedUser.id,
      firebaseUid: updatedUser.firebaseUid,
      email: updatedUser.email,
      role: updatedUser.role,
      isInitialized: updatedUser.isInitialized,
      onboardingStatus: updatedUser.onboardingStatus,
    });

    return res.status(200).json({
      success: true,
      message: 'Vehicle Passport initialized successfully!',
      data: {
        user: updatedUser,
        token: updatedToken,
      },
    });
  } catch (error) {
    console.error('initializeUser error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to initialize vehicle passport',
    });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully from session',
  });
}

export async function getTestUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const testUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: { testUsers },
    });
  } catch (error) {
    console.error('getTestUsers error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch test personas',
    });
  }
}

export async function devLogin(req: AuthenticatedRequest, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required for dev login' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `Test user with email ${email} not found. Please run seed script.`,
      });
    }

    const token = signToken({
      userId: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      isInitialized: user.isInitialized,
      onboardingStatus: user.onboardingStatus,
    });

    return res.status(200).json({
      success: true,
      message: `Logged in as ${user.name}`,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('devLogin error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to execute dev login',
    });
  }
}

export async function setOnboardingStatus(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { status } = req.body;
    if (
      !status ||
      (status !== OnboardingStatus.COMPLETED_WITHOUT_VEHICLE &&
        status !== OnboardingStatus.COMPLETED_WITH_VEHICLE &&
        status !== OnboardingStatus.NOT_STARTED)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid onboarding status. Allowed: COMPLETED_WITHOUT_VEHICLE, COMPLETED_WITH_VEHICLE, NOT_STARTED',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { onboardingStatus: status as OnboardingStatus },
    });

    console.log(`[AUTH] User ${updatedUser.email} updated onboarding status: ${status}`);

    const token = signToken({
      userId: updatedUser.id,
      firebaseUid: updatedUser.firebaseUid,
      email: updatedUser.email,
      role: updatedUser.role,
      isInitialized: updatedUser.isInitialized,
      onboardingStatus: updatedUser.onboardingStatus,
    });

    return res.status(200).json({
      success: true,
      message: 'Onboarding status updated successfully',
      data: {
        user: updatedUser,
        token,
      },
    });
  } catch (error) {
    console.error('setOnboardingStatus error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update onboarding status',
    });
  }
}
