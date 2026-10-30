import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { generateNextPassportId } from '../utils/passportId';
import { validateAndNormalizeVin, validateAndNormalizeRegistration } from '../utils/validation';
import { FuelType, VehicleStatus, OnboardingStatus } from '@prisma/client';
import { z } from 'zod';
import { BlockchainService } from '../blockchain/services/blockchainService';


const createVehicleSchema = z.object({
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  model: z.string().min(1, 'Model is required'),
  variant: z.string().optional().nullable(),
  manufacturingYear: z
    .number()
    .int()
    .min(1900, 'Year must be 1900 or later')
    .max(new Date().getFullYear() + 1, 'Year cannot be in the far future'),
  fuelType: z.nativeEnum(FuelType, {
    errorMap: () => ({ message: 'Invalid fuel type. Allowed: PETROL, DIESEL, ELECTRIC, HYBRID, CNG, LPG' }),
  }),
  color: z.string().optional().nullable(),
  engineNumber: z.string().optional().nullable(),
  vin: z.string().min(1, 'VIN is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
});

const updateVehicleSchema = z.object({
  color: z.string().optional().nullable(),
  variant: z.string().optional().nullable(),
  engineNumber: z.string().optional().nullable(),
});

export async function getMyVehicles(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { currentOwnerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        currentOwner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            photoUrl: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: { vehicles },
    });
  } catch (error) {
    console.error('getMyVehicles error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user vehicles',
    });
  }
}

export async function getVehicleById(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ id }, { passportId: id }],
      },
      include: {
        currentOwner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            photoUrl: true,
            isInitialized: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle Passport not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { vehicle },
    });
  } catch (error) {
    console.error('getVehicleById error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve vehicle passport',
    });
  }
}

export async function createVehicle(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // 1. Strict Initialization Rule
    if (!req.user.isInitialized) {
      return res.status(403).json({
        success: false,
        error: 'Initialize your Vehicle Passport before adding a vehicle.',
        code: 'PASSPORT_NOT_INITIALIZED',
      });
    }

    // 2. Validate request body
    const parseResult = createVehicleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0].message,
      });
    }

    const data = parseResult.data;

    // 3. Normalize & validate VIN
    const vinValidation = validateAndNormalizeVin(data.vin);
    if (!vinValidation.valid) {
      return res.status(400).json({
        success: false,
        error: vinValidation.error,
      });
    }
    const normalizedVin = vinValidation.normalized;

    // 4. Normalize & validate Registration Number
    const regValidation = validateAndNormalizeRegistration(data.registrationNumber);
    if (!regValidation.valid) {
      return res.status(400).json({
        success: false,
        error: regValidation.error,
      });
    }
    const normalizedReg = regValidation.normalized;

    // 5. Check if VIN already exists
    const existingVin = await prisma.vehicle.findUnique({
      where: { vin: normalizedVin },
    });
    if (existingVin) {
      return res.status(409).json({
        success: false,
        error: 'Vehicle with this VIN already exists.',
      });
    }

    // 6. Check if Registration Number already exists
    const existingReg = await prisma.vehicle.findUnique({
      where: { registrationNumber: normalizedReg },
    });
    if (existingReg) {
      return res.status(409).json({
        success: false,
        error: 'Vehicle with this Registration Number already exists.',
      });
    }

    // 7. Generate next unique Passport ID
    const passportId = await generateNextPassportId();

    // 8. Create Vehicle record - currentOwnerId is automatically set from authenticated user
    const vehicle = await prisma.vehicle.create({
      data: {
        passportId,
        vin: normalizedVin,
        registrationNumber: normalizedReg,
        manufacturer: data.manufacturer.trim(),
        model: data.model.trim(),
        variant: data.variant ? data.variant.trim() : null,
        manufacturingYear: data.manufacturingYear,
        fuelType: data.fuelType,
        color: data.color ? data.color.trim() : null,
        engineNumber: data.engineNumber ? data.engineNumber.trim() : null,
        status: VehicleStatus.ACTIVE,
        currentOwnerId: req.user.id, // Authenticated user is automatically currentOwner
      },
      include: {
        currentOwner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    console.log(
      `[VEHICLE] Created Vehicle Passport: ${vehicle.passportId} (VIN: ${vehicle.vin}) for Owner: ${req.user.name} (${req.user.id})`
    );

    // Phase 3: Register vehicle on blockchain
    let updatedVehicle = vehicle;
    try {
      const blockchainService = BlockchainService.getInstance();
      await blockchainService.registerVehicle(vehicle.id);
      const reloaded = await prisma.vehicle.findUnique({
        where: { id: vehicle.id },
        include: {
          currentOwner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
      if (reloaded) {
        updatedVehicle = reloaded;
      }
    } catch (blockchainErr: any) {
      console.error('[VEHICLE] Blockchain registration failed for vehicle:', vehicle.id, blockchainErr);
      // Mark as FAILED in database if not already
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { blockchainStatus: 'FAILED' },
      }).catch(() => {});
      const reloaded = await prisma.vehicle.findUnique({
        where: { id: vehicle.id },
        include: {
          currentOwner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
      if (reloaded) {
        updatedVehicle = reloaded;
      }
    }

    // Automatically complete onboarding with vehicle for this owner
    await prisma.user.update({
      where: { id: req.user.id },
      data: { onboardingStatus: OnboardingStatus.COMPLETED_WITH_VEHICLE },
    }).catch((err) => console.warn('[VEHICLE] Failed to update user onboardingStatus:', err));

    return res.status(201).json({
      success: true,
      message: 'Vehicle Passport created successfully',
      data: { vehicle: updatedVehicle },
    });
  } catch (error) {
    console.error('createVehicle error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create vehicle passport',
    });
  }
}

export async function updateVehicle(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = req.params.id as string;

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!existingVehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
    }

    // Ownership check: only current owner or admin can update metadata
    if (existingVehicle.currentOwnerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not the owner of this vehicle',
      });
    }

    const parseResult = updateVehicleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0].message,
      });
    }

    const { color, variant, engineNumber } = parseResult.data;

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        color: color !== undefined ? color : existingVehicle.color,
        variant: variant !== undefined ? variant : existingVehicle.variant,
        engineNumber: engineNumber !== undefined ? engineNumber : existingVehicle.engineNumber,
      },
      include: {
        currentOwner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Vehicle details updated successfully',
      data: { vehicle: updatedVehicle },
    });
  } catch (error) {
    console.error('updateVehicle error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update vehicle',
    });
  }
}
