import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { ManufacturerCertificateService } from '../services/ecosystem/ManufacturerCertificateService';
import { BatteryPassportService } from '../services/ecosystem/BatteryPassportService';
import { InsuranceIntelligenceService } from '../services/ecosystem/InsuranceIntelligenceService';
import { GarageVerificationService } from '../services/ecosystem/GarageVerificationService';
import { VehicleEcosystemService } from '../services/ecosystem/VehicleEcosystemService';

/**
 * Helper to verify vehicle ownership / authorized access
 */
async function verifyVehicleAccess(req: AuthenticatedRequest, vehicleId: string) {
  const user = req.user;
  if (!user) {
    throw new Error('Authentication required');
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!vehicle) {
    return { vehicle: null, authorized: false };
  }

  // Admins, Manufacturers, Garages, Insurers have business roles for authorized actions
  if (
    user.role === 'ADMIN' ||
    user.role === 'MANUFACTURER' ||
    user.role === 'GARAGE' ||
    user.role === 'INSURANCE_PROVIDER'
  ) {
    return { vehicle, authorized: true };
  }

  // Vehicle Owners can access only their own vehicles
  const isOwner = vehicle.currentOwnerId === user.id;
  return { vehicle, authorized: isOwner };
}

// ---------------- 1. Manufacturer Certificate ----------------

export async function getManufacturerCertificate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const { vehicle, authorized } = await verifyVehicleAccess(req, vehicleId);

    if (!vehicle) {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, error: 'Forbidden: Access to birth certificate denied' });
      return;
    }

    const cert = await ManufacturerCertificateService.getInstance().getCertificate(vehicle.id);
    res.status(200).json({ success: true, data: cert });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching manufacturer certificate';
    res.status(500).json({ success: false, error: msg });
  }
}

export async function createManufacturerCertificate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = req.user!;

    if (user.role !== 'MANUFACTURER' && user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Only MANUFACTURER or ADMIN accounts can issue digital birth certificates' });
      return;
    }

    const cert = await ManufacturerCertificateService.getInstance().createCertificate(
      vehicleId,
      user.id,
      req.body
    );

    res.status(201).json({ success: true, data: cert });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating manufacturer certificate';
    const status = msg.includes('already has') ? 409 : 400;
    res.status(status).json({ success: false, error: msg });
  }
}

// ---------------- 2. EV Battery Passport ----------------

export async function getBatteryPassport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const { vehicle, authorized } = await verifyVehicleAccess(req, vehicleId);

    if (!vehicle) {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, error: 'Forbidden: Access to battery passport denied' });
      return;
    }

    if (!BatteryPassportService.getInstance().isEvCompatible(vehicle.fuelType)) {
      res.status(200).json({
        success: true,
        data: {
          isApplicable: false,
          fuelType: vehicle.fuelType,
          message: `Battery Passport is not applicable to non-EV/Hybrid vehicles (Powertrain: ${vehicle.fuelType})`,
        },
      });
      return;
    }

    const bp = await BatteryPassportService.getInstance().getBatteryPassport(vehicle.id);
    if (!bp) {
      res.status(200).json({
        success: true,
        data: {
          isApplicable: true,
          passport: null,
          message: 'EV Battery Passport has not been initialized yet',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        isApplicable: true,
        ...bp,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching battery passport';
    res.status(500).json({ success: false, error: msg });
  }
}

export async function createBatteryPassport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = req.user!;

    if (user.role !== 'MANUFACTURER' && user.role !== 'GARAGE' && user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Only MANUFACTURER, GARAGE, or ADMIN accounts can initialize battery passports' });
      return;
    }

    const bp = await BatteryPassportService.getInstance().createBatteryPassport(
      vehicleId,
      req.body
    );

    res.status(201).json({ success: true, data: bp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating battery passport';
    res.status(400).json({ success: false, error: msg });
  }
}

export async function logBatteryEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = req.user!;

    if (user.role !== 'MANUFACTURER' && user.role !== 'GARAGE' && user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Only authorized service providers can log battery diagnostic events' });
      return;
    }

    const event = await BatteryPassportService.getInstance().logLifecycleEvent(
      vehicleId,
      user.name,
      req.body
    );

    res.status(201).json({ success: true, data: event });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error logging battery lifecycle event';
    res.status(400).json({ success: false, error: msg });
  }
}

// ---------------- 3. Insurance Intelligence ----------------

export async function getInsuranceIntelligence(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const { vehicle, authorized } = await verifyVehicleAccess(req, vehicleId);

    if (!vehicle) {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, error: 'Forbidden: Access denied' });
      return;
    }

    const intel = await InsuranceIntelligenceService.getInstance().getInsuranceIntelligence(vehicle.id);
    res.status(200).json({ success: true, data: intel });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching insurance intelligence';
    res.status(500).json({ success: false, error: msg });
  }
}

export async function fileInsuranceClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = req.user!;

    if (user.role !== 'INSURANCE_PROVIDER' && user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Only registered INSURANCE_PROVIDER or ADMIN accounts can file claims' });
      return;
    }

    let policyId = req.body.insuranceRecordId;
    if (!policyId) {
      const activePolicy = await prisma.insuranceRecord.findFirst({
        where: { vehicleId },
        orderBy: { startDate: 'desc' },
      });
      if (activePolicy) {
        policyId = activePolicy.id;
      }
    }

    if (!policyId) {
      res.status(400).json({ success: false, error: 'insuranceRecordId is required or an insurance policy must exist on the vehicle' });
      return;
    }

    const { insuranceRecordId, ...claimInput } = req.body;
    const claim = await InsuranceIntelligenceService.getInstance().fileClaim(
      vehicleId,
      policyId,
      claimInput
    );

    res.status(201).json({ success: true, data: claim });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error filing insurance claim';
    res.status(400).json({ success: false, error: msg });
  }
}

// ---------------- 4. Garage Verification Intelligence ----------------

export async function getGarageProfile(req: Request, res: Response): Promise<void> {
  try {
    const garageId = String(req.params.garageId);
    const profile = await GarageVerificationService.getInstance().getGarageProfile(garageId);
    res.status(200).json({ success: true, data: profile });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching garage profile';
    res.status(404).json({ success: false, error: msg });
  }
}

export async function updateGarageProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const garageId = String(req.params.garageId);
    const user = req.user!;

    // A garage can update their own profile; admins can update any garage
    if (user.role !== 'ADMIN' && user.id !== garageId) {
      res.status(403).json({ success: false, error: 'Forbidden: You can only update your own garage profile' });
      return;
    }

    const updated = await GarageVerificationService.getInstance().updateGarageProfile(
      garageId,
      req.body
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating garage profile';
    res.status(400).json({ success: false, error: msg });
  }
}

export async function getVehicleGarageIntelligence(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const { vehicle, authorized } = await verifyVehicleAccess(req, vehicleId);

    if (!vehicle) {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, error: 'Forbidden: Access denied' });
      return;
    }

    const intel = await GarageVerificationService.getInstance().getVehicleGarageIntelligence(vehicle.id);
    res.status(200).json({ success: true, data: intel });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching vehicle garage intelligence';
    res.status(500).json({ success: false, error: msg });
  }
}

// ---------------- 5. Consolidated Ecosystem Overview & Timeline ----------------

export async function getVehicleEcosystem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const { vehicle, authorized } = await verifyVehicleAccess(req, vehicleId);

    if (!vehicle) {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, error: 'Forbidden: Access denied' });
      return;
    }

    const ecosystem = await VehicleEcosystemService.getInstance().getEcosystemOverview(vehicle.id);
    res.status(200).json({ success: true, data: ecosystem });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generating ecosystem overview';
    res.status(500).json({ success: false, error: msg });
  }
}

export async function getEcosystemTimeline(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const { vehicle, authorized } = await verifyVehicleAccess(req, vehicleId);

    if (!vehicle) {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, error: 'Forbidden: Access denied' });
      return;
    }

    const ecosystem = await VehicleEcosystemService.getInstance().getEcosystemOverview(vehicle.id);
    res.status(200).json({
      success: true,
      data: {
        timeline: ecosystem.ecosystemTimeline,
        count: ecosystem.ecosystemTimeline.length,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generating ecosystem timeline';
    res.status(500).json({ success: false, error: msg });
  }
}

// ---------------- 6. Public Sanitized Ecosystem Summary ----------------

export async function getPublicEcosystemSummary(req: Request, res: Response): Promise<void> {
  try {
    const passportId = String(req.params.passportId).toUpperCase().trim();
    const vehicle = await prisma.vehicle.findUnique({
      where: { passportId },
    });

    if (!vehicle) {
      res.status(404).json({ success: false, error: 'Vehicle passport not found' });
      return;
    }

    const ecosystem = await VehicleEcosystemService.getInstance().getEcosystemOverview(vehicle.id);

    // Strict PII Sanitization
    const sanitized = {
      passportId: vehicle.passportId,
      vinMasked: `${vehicle.vin.substring(0, 3)}***${vehicle.vin.substring(vehicle.vin.length - 3)}`,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      variant: vehicle.variant,
      manufacturingYear: vehicle.manufacturingYear,
      fuelType: vehicle.fuelType,
      isEv: ecosystem.isEv,
      manufacturerCertificate: ecosystem.manufacturerCertificate
        ? {
            isIssued: true,
            certificateNumber: ecosystem.manufacturerCertificate.certificateNumber,
            manufacturerName: ecosystem.manufacturerCertificate.manufacturerName,
            manufacturingPlant: ecosystem.manufacturerCertificate.manufacturingPlant,
            manufacturingDate: ecosystem.manufacturerCertificate.manufacturingDate,
            initialOdometer: ecosystem.manufacturerCertificate.initialOdometer,
            verificationStatus: ecosystem.manufacturerCertificate.verificationStatus,
            blockchainTxHash: ecosystem.manufacturerCertificate.blockchainTxHash,
          }
        : { isIssued: false },
      batteryPassport: ecosystem.batteryPassport
        ? {
            batterySerialMasked: `${ecosystem.batteryPassport.batterySerial.substring(0, 4)}***${ecosystem.batteryPassport.batterySerial.substring(ecosystem.batteryPassport.batterySerial.length - 3)}`,
            chemistry: ecosystem.batteryPassport.chemistry,
            nominalCapacityKwh: ecosystem.batteryPassport.nominalCapacityKwh,
            capacityRetainedPercentage: ecosystem.batteryPassport.capacityRetainedPercentage,
            currentHealthPct: ecosystem.batteryPassport.sohPercentage,
            cycleCount: ecosystem.batteryPassport.cycleCount,
            status: ecosystem.batteryPassport.status,
            evidenceClassification: ecosystem.batteryPassport.evidenceClassification,
          }
        : null,
      insurance: {
        activePolicyPresent: Boolean(ecosystem.insuranceIntelligence.activePolicy),
        coverageContinuity: ecosystem.insuranceIntelligence.coverageContinuity,
        settledClaimsCount: ecosystem.insuranceIntelligence.totalClaimsCount,
      },
      servicingGaragesSummary: {
        totalServices: ecosystem.garageIntelligence.totalServicesPerformed,
        allGaragesVerified: ecosystem.garageIntelligence.allGaragesVerified,
        verifiedGarages: ecosystem.garageIntelligence.networkSummary.map((g) => ({
          garageName: g.garageName,
          verificationStatus: g.verificationStatus,
          trustIndex: g.trustIndex,
        })),
      },
      ecosystemEventsCount: ecosystem.ecosystemTimeline.length,
      generatedAt: ecosystem.generatedAt,
    };

    res.status(200).json({ success: true, data: sanitized });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generating public ecosystem summary';
    res.status(500).json({ success: false, error: msg });
  }
}
