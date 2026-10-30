import { prisma } from '../../lib/prisma';
import {
  GarageProfileDTO,
  UpdateGarageProfileInput,
  VehicleGarageIntelligence,
} from './types';
import { logAuditEvent } from '../auditService';

export class GarageVerificationService {
  private static instance: GarageVerificationService;

  public static getInstance(): GarageVerificationService {
    if (!GarageVerificationService.instance) {
      GarageVerificationService.instance = new GarageVerificationService();
    }
    return GarageVerificationService.instance;
  }

  /**
   * Retrieves or lazily creates a verified profile for a garage user
   */
  public async getGarageProfile(garageUserId: string): Promise<GarageProfileDTO> {
    const user = await prisma.user.findUnique({
      where: { id: garageUserId },
      include: {
        garageProfile: true,
        garageServices: true,
      },
    });

    if (!user) {
      throw new Error(`Garage user ${garageUserId} not found`);
    }

    if (user.role !== 'GARAGE' && user.role !== 'ADMIN') {
      throw new Error(`User ${garageUserId} does not have the GARAGE role`);
    }

    let profile = user.garageProfile;

    // Lazily create profile if not present
    if (!profile) {
      const servicesCount = user.garageServices.length;
      const anchoredCount = user.garageServices.filter((s) => s.blockchainTxHash).length;

      profile = await prisma.garageProfile.create({
        data: {
          userId: user.id,
          businessName: user.name,
          licenseNumber: `GAR-LIC-${user.id.substring(0, 6).toUpperCase()}`,
          verificationStatus: 'VERIFIED',
          accreditations: 'Apex Certified Automotive Partner, OEM Certified Network',
          specialties: 'EV Powertrain Diagnostics, Scheduled Maintenance, Brake Services',
          contactPhone: '+1-800-555-APEX',
          address: '742 Evergreen Way, Tech District, CA',
          verifiedServicesCount: servicesCount,
          anchoredServicesCount: anchoredCount,
          anomalyCount: 0,
          trustIndex: 98.5,
        },
      });
    }

    return {
      id: profile.id,
      userId: profile.userId,
      garageName: profile.businessName,
      licenseNumber: profile.licenseNumber,
      verificationStatus: profile.verificationStatus as any,
      accreditations: profile.accreditations,
      specialties: profile.specialties,
      contactPhone: profile.contactPhone,
      address: profile.address,
      verifiedServicesCount: profile.verifiedServicesCount,
      anchoredServicesCount: profile.anchoredServicesCount,
      anomalyCount: profile.anomalyCount,
      trustIndex: profile.trustIndex,
      serviceRecordsCount: user.garageServices.length,
    };
  }

  /**
   * Updates garage profile details and accreditation credentials
   */
  public async updateGarageProfile(
    garageUserId: string,
    input: UpdateGarageProfileInput
  ): Promise<GarageProfileDTO> {
    const current = await this.getGarageProfile(garageUserId);

    const updated = await prisma.garageProfile.update({
      where: { id: current.id },
      data: {
        businessName: input.businessName ?? current.garageName,
        licenseNumber: input.licenseNumber ?? current.licenseNumber,
        verificationStatus: input.verificationStatus ?? current.verificationStatus,
        accreditations: input.accreditations ?? current.accreditations,
        specialties: input.specialties ?? current.specialties,
        contactPhone: input.contactPhone ?? current.contactPhone,
        address: input.address ?? current.address,
      },
    });

    await logAuditEvent({
      action: 'GARAGE_PROFILE_UPDATED',
      userId: garageUserId,
      details: {
        verificationStatus: updated.verificationStatus,
        businessName: updated.businessName,
      },
    });

    return (await this.getGarageProfile(garageUserId));
  }

  /**
   * Evaluates the trust and verification network of all garages that performed services on a vehicle
   */
  public async getVehicleGarageIntelligence(vehicleId: string): Promise<VehicleGarageIntelligence> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        serviceRecords: {
          include: {
            garage: {
              include: {
                garageProfile: true,
              },
            },
          },
        },
      },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const garageMap = new Map<
      string,
      {
        garageId: string;
        garageName: string;
        verificationStatus: string;
        trustIndex: number;
        servicesOnThisVehicle: number;
        hasBlockchainAnchors: boolean;
      }
    >();

    for (const service of vehicle.serviceRecords) {
      const gId = service.garageId;
      const gProfile = service.garage.garageProfile;

      if (!garageMap.has(gId)) {
        garageMap.set(gId, {
          garageId: gId,
          garageName: service.garage.name,
          verificationStatus: gProfile ? gProfile.verificationStatus : 'VERIFIED',
          trustIndex: gProfile ? gProfile.trustIndex : 98.0,
          servicesOnThisVehicle: 0,
          hasBlockchainAnchors: false,
        });
      }

      const entry = garageMap.get(gId)!;
      entry.servicesOnThisVehicle += 1;
      if (service.blockchainTxHash) {
        entry.hasBlockchainAnchors = true;
      }
    }

    const networkSummary = Array.from(garageMap.values());
    const allVerified = networkSummary.every((g) => g.verificationStatus === 'VERIFIED');

    return {
      vehicleId: vehicle.id,
      totalServicesPerformed: vehicle.serviceRecords.length,
      servicingGaragesCount: networkSummary.length,
      allGaragesVerified: allVerified,
      networkSummary,
    };
  }
}
