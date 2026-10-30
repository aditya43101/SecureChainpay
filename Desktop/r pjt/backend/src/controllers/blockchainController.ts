import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { BlockchainService } from '../blockchain/services/blockchainService';

export async function initializeBlockchainUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const blockchainService = BlockchainService.getInstance();
    const result = await blockchainService.initializeUser({
      userId: req.user.id,
      firebaseUid: req.user.firebaseUid,
      role: req.user.role,
      address: req.user.blockchainAddress,
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    return res.status(200).json({
      success: true,
      message: 'Blockchain user identity initialized successfully',
      data: {
        user: updatedUser,
        blockchain: result,
      },
    });
  } catch (error: any) {
    console.error('initializeBlockchainUser error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize blockchain identity',
    });
  }
}

export async function registerVehicleOnBlockchain(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const vehicleId = req.params.vehicleId as string;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    // Authorization: only current owner or admin can register on blockchain
    if (vehicle.currentOwnerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only the vehicle owner or an administrator can register a vehicle on the blockchain',
      });
    }

    const blockchainService = BlockchainService.getInstance();
    const result = await blockchainService.registerVehicle(vehicleId);

    const updatedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      include: { currentOwner: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Vehicle successfully registered and anchored on blockchain',
      data: {
        vehicle: updatedVehicle,
        blockchain: result,
      },
    });
  } catch (error: any) {
    console.error('registerVehicleOnBlockchain error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to register vehicle on blockchain',
    });
  }
}

export async function getVehicleBlockchainInfo(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ id: vehicleId }, { passportId: vehicleId }],
      },
      select: {
        id: true,
        passportId: true,
        vin: true,
        blockchainVehicleId: true,
        blockchainTxHash: true,
        blockNumber: true,
        recordHash: true,
        blockchainStatus: true,
        blockchainRegisteredAt: true,
      },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    return res.status(200).json({
      success: true,
      data: { vehicle },
    });
  } catch (error: any) {
    console.error('getVehicleBlockchainInfo error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get vehicle blockchain metadata',
    });
  }
}

export async function verifyVehiclePassport(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const blockchainService = BlockchainService.getInstance();
    const verificationResult = await blockchainService.verifyVehicle(vehicleId);

    return res.status(200).json({
      success: true,
      message: verificationResult.isVerified
        ? 'MATCH → Cryptographically verified on blockchain'
        : verificationResult.tamperDetected
        ? 'MISMATCH → Tamper detected! Database record does not match blockchain proof'
        : 'Vehicle not registered on blockchain',
      data: verificationResult,
    });
  } catch (error: any) {
    console.error('verifyVehiclePassport error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute blockchain verification',
    });
  }
}

export async function getBlockchainUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.params.userId as string;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { blockchainUserId: userId }],
      },
      select: {
        id: true,
        blockchainUserId: true,
        blockchainAddress: true,
        blockchainTxHash: true,
        blockchainInitializedAt: true,
        isInitialized: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    console.error('getBlockchainUser error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get blockchain user metadata',
    });
  }
}

