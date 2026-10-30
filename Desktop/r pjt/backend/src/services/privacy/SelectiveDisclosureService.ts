import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { logAuditEvent } from '../auditService';
import { BlockchainService } from '../../blockchain/services/blockchainService';
import { getBlockchainConfig } from '../../blockchain/config';
import { VehicleIntelligenceService } from '../intelligence/VehicleIntelligenceService';
import { ManufacturerCertificateService } from '../ecosystem/ManufacturerCertificateService';
import { BatteryPassportService } from '../ecosystem/BatteryPassportService';

const blockchainService = BlockchainService.getInstance();
const mfrService = new ManufacturerCertificateService();
const batteryService = new BatteryPassportService();

export class SelectiveDisclosureService {
  generateShareId(): string {
    return `sh_${crypto.randomBytes(12).toString('hex')}`;
  }

  maskRegistration(reg: string): string {
    if (!reg || reg.length < 6) return '••••••';
    return `${reg.slice(0, 4)}••••${reg.slice(-4)}`;
  }

  maskVin(vin: string): string {
    if (!vin || vin.length < 8) return 'VIN-PROTECTED';
    return `${vin.slice(0, 3)}***${vin.slice(-3)}`;
  }

  async createDisclosure(
    vehicleId: string,
    userId: string,
    userRole: string,
    input: { title?: string; categories: string[]; expiresInDays?: number | null }
  ) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, passportId: true, currentOwnerId: true },
    });
    if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
    if (userRole !== 'ADMIN' && vehicle.currentOwnerId !== userId) throw new Error('FORBIDDEN');
    if (!input.categories || !Array.isArray(input.categories) || input.categories.length === 0) {
      throw new Error('INVALID_CATEGORIES');
    }

    const validCategories = [
      'vehicleIdentity',
      'ownership',
      'odometer',
      'service',
      'accident',
      'repair',
      'insurance',
      'documents',
      'blockchainProof',
      'batteryPassport',
      'manufacturerCertificate',
      'vehicleHealth',
      'riskSummary',
    ];
    const sanitizedCategories = input.categories.filter((cat) => validCategories.includes(cat));
    if (sanitizedCategories.length === 0) throw new Error('NO_VALID_CATEGORIES_SELECTED');

    let expiresAt: Date | null = null;
    if (input.expiresInDays && input.expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
    }

    const shareId = this.generateShareId();
    const profile = await prisma.disclosureProfile.create({
      data: {
        vehicleId: vehicle.id,
        createdById: userId,
        shareId,
        title: input.title?.trim() || `Shareable Vehicle Verification — ${vehicle.passportId}`,
        categories: JSON.stringify(sanitizedCategories),
        expiresAt,
        status: 'ACTIVE',
      },
    });

    await logAuditEvent({
      action: 'DISCLOSURE_CREATED',
      vehicleId: vehicle.id,
      userId,
      details: JSON.stringify({
        shareId: profile.shareId,
        categories: sanitizedCategories,
        expiresAt: profile.expiresAt,
      }),
    });

    return {
      id: profile.id,
      shareId: profile.shareId,
      shareUrl: `/verify/share/${profile.shareId}`,
      title: profile.title,
      categories: sanitizedCategories,
      status: profile.status,
      expiresAt: profile.expiresAt,
      createdAt: profile.createdAt,
    };
  }

  async getVehicleDisclosures(vehicleId: string, userId: string, userRole: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, currentOwnerId: true },
    });
    if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
    if (userRole !== 'ADMIN' && vehicle.currentOwnerId !== userId) throw new Error('FORBIDDEN');

    const profiles = await prisma.disclosureProfile.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    return profiles.map((p) => {
      let currentStatus = p.status;
      if (currentStatus === 'ACTIVE' && p.expiresAt && now > p.expiresAt) {
        currentStatus = 'EXPIRED';
      }
      return {
        id: p.id,
        shareId: p.shareId,
        shareUrl: `/verify/share/${p.shareId}`,
        title: p.title,
        categories: JSON.parse(p.categories || '[]'),
        status: currentStatus,
        accessCount: p.accessCount,
        lastAccessedAt: p.lastAccessedAt,
        expiresAt: p.expiresAt,
        revokedAt: p.revokedAt,
        createdAt: p.createdAt,
      };
    });
  }

  async revokeDisclosure(shareId: string, userId: string, userRole: string) {
    const profile = await prisma.disclosureProfile.findUnique({
      where: { shareId },
      include: { vehicle: { select: { id: true, currentOwnerId: true } } },
    });
    if (!profile) throw new Error('DISCLOSURE_NOT_FOUND');
    if (userRole !== 'ADMIN' && profile.createdById !== userId && profile.vehicle.currentOwnerId !== userId) {
      throw new Error('FORBIDDEN');
    }
    if (profile.status === 'REVOKED') throw new Error('ALREADY_REVOKED');

    const updated = await prisma.disclosureProfile.update({
      where: { id: profile.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    await logAuditEvent({
      action: 'DISCLOSURE_REVOKED',
      vehicleId: profile.vehicleId,
      userId,
      details: JSON.stringify({
        shareId: profile.shareId,
        revokedAt: updated.revokedAt,
      }),
    });

    return {
      shareId: updated.shareId,
      status: updated.status,
      revokedAt: updated.revokedAt,
    };
  }

  async getSharedPassport(shareId: string, clientIp?: string) {
    const profile = await prisma.disclosureProfile.findUnique({
      where: { shareId },
      include: {
        vehicle: {
          include: {
            ownershipHistory: { orderBy: { transferDate: 'asc' } },
            serviceRecords: { orderBy: { serviceDate: 'desc' } },
            odometerRecords: { orderBy: { recordedAt: 'desc' } },
            accidentRecords: { orderBy: { accidentDate: 'desc' } },
            insuranceRecords: {
              include: { provider: { select: { name: true } } },
              orderBy: { startDate: 'desc' },
            },
            documents: { where: { isPublic: true }, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!profile || !profile.vehicle) {
      const err: any = new Error('NOT_FOUND');
      err.code = 'DISCLOSURE_NOT_FOUND';
      throw err;
    }
    if (profile.status === 'REVOKED' || profile.revokedAt) {
      const err: any = new Error('This vehicle disclosure is no longer available because it has been revoked by the owner.');
      err.code = 'DISCLOSURE_REVOKED';
      throw err;
    }
    const now = new Date();
    if (profile.expiresAt && now > profile.expiresAt) {
      if (profile.status !== 'EXPIRED') {
        await prisma.disclosureProfile.update({
          where: { id: profile.id },
          data: { status: 'EXPIRED' },
        });
      }
      const err: any = new Error('This shareable vehicle disclosure report has expired.');
      err.code = 'DISCLOSURE_EXPIRED';
      throw err;
    }

    await prisma.disclosureProfile.update({
      where: { id: profile.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: now,
      },
    });

    await logAuditEvent({
      action: 'DISCLOSURE_VIEWED',
      vehicleId: profile.vehicle.id,
      details: JSON.stringify({
        shareId: profile.shareId,
        ip: clientIp,
      }),
    });

    const vehicle = profile.vehicle;
    const categories: string[] = JSON.parse(profile.categories || '[]');
    const disclosedData: Record<string, any> = {};

    const fullReport = await blockchainService.verifyVehiclePassportFull(vehicle.id);

    if (categories.includes('vehicleIdentity')) {
      disclosedData.vehicleIdentity = {
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        variant: vehicle.variant || 'Standard',
        manufacturingYear: vehicle.manufacturingYear,
        fuelType: vehicle.fuelType,
        color: vehicle.color || 'Standard',
        registrationNumberMasked: this.maskRegistration(vehicle.registrationNumber),
        vinMasked: this.maskVin(vehicle.vin),
        status: vehicle.status,
      };
    }
    if (categories.includes('ownership')) {
      disclosedData.ownership = {
        totalOwners: fullReport.categories.ownership.count,
        isVerifiedOnChain: fullReport.categories.ownership.status === 'VERIFIED',
        records: vehicle.ownershipHistory.map((oh, idx) => ({
          ownerNumber: idx + 1,
          transferDate: oh.transferDate,
          transferType: oh.transferType,
          verifiedOnChain: oh.status === 'CONFIRMED',
          blockchainTxHash: oh.blockchainTxHash,
        })),
      };
    }
    if (categories.includes('odometer')) {
      disclosedData.odometer = {
        currentReadingKm: vehicle.odometerRecords[0]?.mileage || 0,
        rollbackDetected: fullReport.categories.odometer.rollbackDetected,
        isVerifiedOnChain: fullReport.categories.odometer.status === 'VERIFIED',
        readingsCount: fullReport.categories.odometer.count,
        history: vehicle.odometerRecords.slice(0, 10).map((r) => ({
          readingKm: r.mileage,
          readingDate: r.recordedAt,
          sourceType: r.sourceType,
          verified: r.status === 'CONFIRMED',
          blockchainTxHash: r.blockchainTxHash,
        })),
      };
    }
    if (categories.includes('service')) {
      disclosedData.service = {
        totalServices: fullReport.categories.service.count,
        isVerifiedOnChain: fullReport.categories.service.status === 'VERIFIED',
        records: vehicle.serviceRecords.map((sr) => ({
          serviceType: sr.serviceType,
          serviceDate: sr.serviceDate,
          odometerReadingKm: sr.mileage,
          description: sr.description,
          verifiedOnChain: sr.status === 'CONFIRMED',
          blockchainTxHash: sr.blockchainTxHash,
        })),
      };
    }
    if (categories.includes('accident')) {
      disclosedData.accident = {
        totalAccidents: fullReport.categories.accident.count,
        isVerifiedOnChain: fullReport.categories.accident.status === 'VERIFIED',
        records: vehicle.accidentRecords.map((ar) => ({
          accidentDate: ar.accidentDate,
          severity: ar.severity,
          damageArea: ar.damagedParts,
          description: ar.description,
          verifiedOnChain: ar.status === 'CONFIRMED',
          blockchainTxHash: ar.blockchainTxHash,
        })),
      };
    }
    if (categories.includes('repair')) {
      const repairs = vehicle.accidentRecords.filter((ar) => ar.repairStatus !== 'NOT_REQUIRED');
      disclosedData.repair = {
        totalRepairs: repairs.length,
        records: repairs.map((ar) => ({
          repairDate: ar.repairedAt || ar.accidentDate,
          repairStatus: ar.repairStatus,
          repairedParts: ar.damagedParts,
          repairDescription: ar.repairDescription,
          repairFacility: ar.locationDescription || null,
          verifiedOnChain: ar.status === 'CONFIRMED',
        })),
      };
    }
    if (categories.includes('insurance')) {
      const activePolicy = vehicle.insuranceRecords.find((p) => p.status === 'ACTIVE');
      disclosedData.insurance = {
        hasActiveInsurance: Boolean(activePolicy),
        providerName: activePolicy?.provider?.name || 'Certified Underwriter',
        policyStatus: activePolicy?.status || (vehicle.insuranceRecords.length > 0 ? 'EXPIRED' : 'NONE'),
        totalRecordedPolicies: vehicle.insuranceRecords.length,
        isVerifiedOnChain: fullReport.categories.insurance.status === 'VERIFIED',
      };
    }
    if (categories.includes('documents')) {
      disclosedData.documents = {
        totalVerifiedDocuments: vehicle.documents.length,
        proofs: vehicle.documents.map((d) => ({
          documentType: d.documentType,
          title: d.title,
          fileHash: d.fileHash,
          recordHash: d.recordHash,
          ipfsCid: d.ipfsCid,
          verifiedOnChain: d.status === 'CONFIRMED',
          blockchainTxHash: d.blockchainTxHash,
          uploadedAt: d.createdAt,
        })),
      };
    }
    if (categories.includes('blockchainProof')) {
      const config = getBlockchainConfig();
      disclosedData.blockchainProof = {
        passportId: vehicle.passportId,
        blockchainVehicleId: vehicle.blockchainVehicleId,
        contractAddress: config.contractAddress || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        network: 'Hardhat Local / Ethereum Layer 2',
        genesisTxHash: vehicle.blockchainTxHash,
        genesisBlockNumber: vehicle.blockNumber,
        isAnchored: fullReport.vehicleIdentity.isRegisteredOnBlockchain,
        overallVerification: fullReport.hasTamper ? 'TAMPERED' : fullReport.hasSuspicious ? 'SUSPICIOUS' : 'VERIFIED',
      };
    }
    if (categories.includes('manufacturerCertificate')) {
      const mfrCert = await mfrService.getCertificate(vehicle.id);
      if (mfrCert) {
        disclosedData.manufacturerCertificate = {
          certificateNumber: mfrCert.certificateNumber,
          manufacturingDate: mfrCert.manufacturingDate,
          manufacturingPlant: mfrCert.manufacturingPlant,
          initialOdometerKm: mfrCert.initialOdometer,
          specificationSnapshot: mfrCert.specificationSnapshot,
          canonicalHash: mfrCert.recordHash,
          verificationState: mfrCert.verificationStatus,
          blockchainTxHash: mfrCert.blockchainTxHash,
        };
      } else {
        disclosedData.manufacturerCertificate = null;
      }
    }
    if (categories.includes('batteryPassport')) {
      if (vehicle.fuelType === 'ELECTRIC' || vehicle.fuelType === 'HYBRID') {
        const bp = await batteryService.getBatteryPassport(vehicle.id);
        if (bp) {
          disclosedData.batteryPassport = {
            isApplicable: true,
            batterySerialMasked: `${bp.batterySerial.slice(0, 4)}***${bp.batterySerial.slice(-3)}`,
            chemistry: bp.chemistry,
            nominalCapacityKwh: bp.nominalCapacityKwh,
            currentCapacityKwh: bp.currentCapacityKwh,
            capacityRetentionPercentage: bp.capacityRetainedPercentage,
            sohPercentage: bp.sohPercentage,
            cycleCount: bp.cycleCount,
            status: bp.status,
            evidenceClassification: bp.evidenceClassification,
            blockchainTxHash: bp.blockchainTxHash,
          };
        } else {
          disclosedData.batteryPassport = { isApplicable: false, reason: 'No Battery Passport registered' };
        }
      } else {
        disclosedData.batteryPassport = { isApplicable: false, reason: 'Not applicable to ICE powertrain' };
      }
    }
    if (categories.includes('vehicleHealth') || categories.includes('riskSummary')) {
      const intel = await VehicleIntelligenceService.getInstance().generateReport(vehicle.id);
      if (categories.includes('vehicleHealth')) {
        disclosedData.vehicleHealth = {
          score: intel.health.overallScore,
          status: intel.health.status,
          calculatedAt: new Date().toISOString(),
          summary: intel.health.summary,
        };
      }
      if (categories.includes('riskSummary')) {
        disclosedData.riskSummary = {
          overallRiskLevel: intel.risk.overallRiskLevel,
          overallRiskScore: intel.risk.overallRiskScore,
          summary: intel.risk.summary,
        };
      }
    }

    return {
      shareId: profile.shareId,
      title: profile.title,
      status: profile.status,
      expiresAt: profile.expiresAt ? profile.expiresAt.toISOString() : null,
      disclosedCategories: categories,
      disclosedData,
      verificationSummary: {
        passportId: vehicle.passportId,
        overallState: fullReport.hasTamper ? 'TAMPERED' : fullReport.hasSuspicious ? 'SUSPICIOUS' : 'VERIFIED',
        verifiedAt: new Date().toISOString(),
      },
    };
  }
}
