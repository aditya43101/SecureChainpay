import { prisma } from '../../lib/prisma';
import { ManufacturerCertificateService } from './ManufacturerCertificateService';
import { BatteryPassportService } from './BatteryPassportService';
import { InsuranceIntelligenceService } from './InsuranceIntelligenceService';
import { GarageVerificationService } from './GarageVerificationService';
import {
  VehicleEcosystemOverview,
  EcosystemTimelineEvent,
} from './types';

export class VehicleEcosystemService {
  private static instance: VehicleEcosystemService;

  public static getInstance(): VehicleEcosystemService {
    if (!VehicleEcosystemService.instance) {
      VehicleEcosystemService.instance = new VehicleEcosystemService();
    }
    return VehicleEcosystemService.instance;
  }

  /**
   * Consolidates complete Industry & EV Ecosystem Overview for a vehicle
   */
  public async getEcosystemOverview(vehicleId: string): Promise<VehicleEcosystemOverview> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        currentOwner: true,
        serviceRecords: {
          include: { garage: true },
          orderBy: { serviceDate: 'asc' },
        },
        insuranceRecords: {
          include: {
            provider: true,
            claims: true,
          },
          orderBy: { startDate: 'asc' },
        },
        accidentRecords: {
          orderBy: { accidentDate: 'asc' },
        },
      },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const isEv = BatteryPassportService.getInstance().isEvCompatible(vehicle.fuelType);

    // Parallel retrieval of domain intelligences
    const [mfgCert, batteryPassport, insuranceIntel, garageIntel] = await Promise.all([
      ManufacturerCertificateService.getInstance().getCertificate(vehicle.id),
      isEv ? BatteryPassportService.getInstance().getBatteryPassport(vehicle.id) : Promise.resolve(null),
      InsuranceIntelligenceService.getInstance().getInsuranceIntelligence(vehicle.id),
      GarageVerificationService.getInstance().getVehicleGarageIntelligence(vehicle.id),
    ]);

    // Build consolidated Ecosystem Timeline
    const timeline: EcosystemTimelineEvent[] = [];

    // 1. Manufacturing Event
    if (mfgCert) {
      timeline.push({
        id: `eco-mfg-${mfgCert.id}`,
        category: 'MANUFACTURING',
        date: mfgCert.manufacturingDate,
        title: `Digital Birth Certificate Issued (${mfgCert.certificateNumber})`,
        actor: mfgCert.manufacturerName,
        description: `Factory birth certificate issued at ${mfgCert.manufacturingPlant || 'OEM Assembly Plant'} with 0 km initial odometer reading.`,
        evidenceRef: mfgCert.certificateNumber,
        blockchainTxHash: mfgCert.blockchainTxHash,
      });
    }

    // 2. Battery Events (if EV)
    if (batteryPassport) {
      for (const bEvt of batteryPassport.events) {
        timeline.push({
          id: `eco-bat-${bEvt.id}`,
          category: 'BATTERY',
          date: bEvt.eventDate,
          title: `Traction Battery: ${bEvt.eventType.replace(/_/g, ' ')}`,
          actor: bEvt.recordedBy,
          description: bEvt.description,
          evidenceRef: bEvt.evidenceRef || undefined,
          blockchainTxHash: bEvt.blockchainTxHash,
        });
      }
    }

    // 3. Garage Service Events
    for (const srv of vehicle.serviceRecords) {
      timeline.push({
        id: `eco-srv-${srv.id}`,
        category: 'GARAGE_SERVICE',
        date: srv.serviceDate.toISOString(),
        title: `Certified Service: ${srv.serviceType}`,
        actor: srv.garage.name,
        description: `${srv.description} (${srv.mileage.toLocaleString()} km). Parts: ${srv.partsReplaced || 'OEM Standard'}.`,
        blockchainTxHash: srv.blockchainTxHash,
      });
    }

    // 4. Insurance & Claim Events
    for (const ins of vehicle.insuranceRecords) {
      timeline.push({
        id: `eco-ins-${ins.id}`,
        category: 'INSURANCE',
        date: ins.startDate.toISOString(),
        title: `Policy Active: ${ins.coverageType} (${ins.policyReference})`,
        actor: ins.provider.name,
        description: `Coverage initiated by ${ins.provider.name} valid through ${ins.endDate.toISOString().split('T')[0]}.`,
        blockchainTxHash: ins.blockchainTxHash,
      });

      for (const claim of ins.claims) {
        timeline.push({
          id: `eco-clm-${claim.id}`,
          category: 'INSURANCE',
          date: claim.claimDate.toISOString(),
          title: `Insurance Claim: ${claim.claimNumber} (${claim.claimStatus})`,
          actor: ins.provider.name,
          description: claim.description,
          blockchainTxHash: claim.blockchainTxHash,
        });
      }
    }

    // 5. Accident Events
    for (const acc of vehicle.accidentRecords) {
      timeline.push({
        id: `eco-acc-${acc.id}`,
        category: 'ACCIDENT',
        date: acc.accidentDate.toISOString(),
        title: `Incident Recorded: ${acc.severity} Severity`,
        actor: 'Authorized Reporter',
        description: `${acc.description} — Repair Status: ${acc.repairStatus}.`,
        blockchainTxHash: acc.blockchainTxHash,
      });
    }

    // Sort chronologically
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      fuelType: vehicle.fuelType,
      isEv,
      manufacturerCertificate: mfgCert,
      batteryPassport,
      insuranceIntelligence: insuranceIntel,
      garageIntelligence: garageIntel,
      ecosystemTimeline: timeline,
      generatedAt: new Date().toISOString(),
    };
  }
}
