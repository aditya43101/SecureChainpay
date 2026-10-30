import { prisma } from '../../lib/prisma';
import { BlockchainService } from '../../blockchain/services/blockchainService';
import {
  generateManufacturerCertificateHash,
  CanonicalManufacturerCertificateInput,
} from '../../blockchain/utils/canonicalHash';
import {
  ManufacturerCertificateDTO,
  CreateManufacturerCertificateInput,
} from './types';
import { logAuditEvent } from '../auditService';
import { BlockchainStatus } from '@prisma/client';

export class ManufacturerCertificateService {
  private static instance: ManufacturerCertificateService;

  public static getInstance(): ManufacturerCertificateService {
    if (!ManufacturerCertificateService.instance) {
      ManufacturerCertificateService.instance = new ManufacturerCertificateService();
    }
    return ManufacturerCertificateService.instance;
  }

  /**
   * Retrieves the Manufacturer Digital Birth Certificate for a given vehicle
   */
  public async getCertificate(vehicleId: string): Promise<ManufacturerCertificateDTO | null> {
    const cert = await prisma.manufacturerCertificate.findUnique({
      where: { vehicleId },
      include: {
        vehicle: true,
        manufacturer: true,
      },
    });

    if (!cert) return null;

    // Deterministically verify record against canonical hash
    const verificationStatus = await this.evaluateCertificateIntegrity(cert);

    let parsedSpecs: Record<string, any> = {};
    try {
      parsedSpecs = JSON.parse(cert.specificationSnapshot);
    } catch {
      parsedSpecs = { raw: cert.specificationSnapshot };
    }

    return {
      id: cert.id,
      vehicleId: cert.vehicleId,
      passportId: cert.vehicle.passportId,
      vin: cert.vehicle.vin,
      manufacturerId: cert.manufacturerId,
      manufacturerName: cert.manufacturer.name,
      certificateNumber: cert.certificateNumber,
      manufacturingPlant: cert.manufacturingPlant,
      manufacturingDate: cert.manufacturingDate.toISOString(),
      initialOdometer: cert.initialOdometer,
      specificationSnapshot: parsedSpecs,
      recordHash: cert.recordHash,
      blockchainRecordId: cert.blockchainRecordId,
      blockchainTxHash: cert.blockchainTxHash,
      blockNumber: cert.blockNumber,
      status: cert.status,
      verificationStatus,
      createdAt: cert.createdAt.toISOString(),
    };
  }

  /**
   * Creates and anchors a Manufacturer Digital Birth Certificate
   */
  public async createCertificate(
    vehicleId: string,
    manufacturerUserId: string,
    input: CreateManufacturerCertificateInput
  ): Promise<ManufacturerCertificateDTO> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const manufacturer = await prisma.user.findUnique({
      where: { id: manufacturerUserId },
    });

    if (!manufacturer) {
      throw new Error(`Manufacturer user ${manufacturerUserId} not found`);
    }

    if (manufacturer.role !== 'MANUFACTURER' && manufacturer.role !== 'ADMIN') {
      throw new Error('Only registered MANUFACTURER accounts or ADMIN can issue birth certificates');
    }

    const existingCert = await prisma.manufacturerCertificate.findUnique({
      where: { vehicleId },
    });

    if (existingCert) {
      throw new Error(`Vehicle ${vehicle.passportId} already has an issued Manufacturer Digital Birth Certificate (#${existingCert.certificateNumber})`);
    }

    const mfgDate = new Date(input.manufacturingDate || `${vehicle.manufacturingYear}-01-15T00:00:00Z`);
    const initialOdo = input.initialOdometer ?? 0;
    const certNumber = input.certificateNumber || `MBC-${vehicle.passportId}-${vehicle.manufacturingYear}`;

    const defaultSpecs = {
      vin: vehicle.vin,
      model: vehicle.model,
      variant: vehicle.variant || 'Standard',
      manufacturingYear: vehicle.manufacturingYear,
      fuelType: vehicle.fuelType,
      color: vehicle.color || 'Factory Standard',
      engineNumber: vehicle.engineNumber || 'OEM-SPEC',
      plant: input.manufacturingPlant || 'Main Assembly Line 1',
      emissionsStandard: 'Euro 6 / BS-VI',
      bodyType: 'Passenger Vehicle',
    };

    const specsPayload = JSON.stringify(input.specificationSnapshot || defaultSpecs);

    // Compute canonical SHA-256 hash
    const canonicalInput: CanonicalManufacturerCertificateInput = {
      blockchainVehicleId: vehicle.blockchainVehicleId || vehicle.id,
      certificateNumber: certNumber,
      manufacturingDate: mfgDate,
      manufacturingPlant: input.manufacturingPlant,
      initialOdometer: initialOdo,
    };

    const recordHash = generateManufacturerCertificateHash(canonicalInput);

    // Blockchain Anchoring
    let blockchainRecordId: string | null = null;
    let blockchainTxHash: string | null = null;
    let blockNumber: number | null = null;
    let blockchainStatus: BlockchainStatus = BlockchainStatus.CONFIRMED;

    if (vehicle.blockchainVehicleId) {
      try {
        const anchor = await BlockchainService.getInstance().anchorRecord({
          vehicleId: vehicle.id,
          recordType: 'MANUFACTURER_CERTIFICATE',
          recordHash,
        });
        blockchainRecordId = anchor.recordId;
        blockchainTxHash = anchor.txHash;
        blockNumber = anchor.blockNumber;
      } catch (err) {
        console.warn('⚠️ Blockchain anchoring failed for birth certificate, saving with PENDING status:', err);
        blockchainStatus = BlockchainStatus.PENDING;
      }
    }

    const cert = await prisma.manufacturerCertificate.create({
      data: {
        vehicleId: vehicle.id,
        manufacturerId: manufacturer.id,
        certificateNumber: certNumber,
        manufacturingPlant: input.manufacturingPlant || 'Main Manufacturing Plant',
        manufacturingDate: mfgDate,
        initialOdometer: initialOdo,
        specificationSnapshot: specsPayload,
        recordHash,
        blockchainRecordId,
        blockchainTxHash,
        blockNumber,
        status: blockchainStatus,
      },
      include: {
        vehicle: true,
        manufacturer: true,
      },
    });

    await logAuditEvent({
      action: 'MANUFACTURER_CERTIFICATE_CREATED',
      vehicleId: vehicle.id,
      userId: manufacturer.id,
      details: {
        certificateNumber: certNumber,
        recordHash,
        blockchainTxHash,
      },
    });

    return {
      id: cert.id,
      vehicleId: cert.vehicleId,
      passportId: cert.vehicle.passportId,
      vin: cert.vehicle.vin,
      manufacturerId: cert.manufacturerId,
      manufacturerName: cert.manufacturer.name,
      certificateNumber: cert.certificateNumber,
      manufacturingPlant: cert.manufacturingPlant,
      manufacturingDate: cert.manufacturingDate.toISOString(),
      initialOdometer: cert.initialOdometer,
      specificationSnapshot: input.specificationSnapshot || defaultSpecs,
      recordHash: cert.recordHash,
      blockchainRecordId: cert.blockchainRecordId,
      blockchainTxHash: cert.blockchainTxHash,
      blockNumber: cert.blockNumber,
      status: cert.status,
      verificationStatus: blockchainTxHash ? 'VERIFIED' : 'PENDING',
      createdAt: cert.createdAt.toISOString(),
    };
  }

  /**
   * Internal verification of birth certificate integrity
   */
  private async evaluateCertificateIntegrity(
    cert: any
  ): Promise<'VERIFIED' | 'TAMPER_DETECTED' | 'PENDING' | 'NOT_ANCHORED'> {
    const canonicalInput: CanonicalManufacturerCertificateInput = {
      blockchainVehicleId: cert.vehicle.blockchainVehicleId || cert.vehicle.id,
      certificateNumber: cert.certificateNumber,
      manufacturingDate: cert.manufacturingDate,
      manufacturingPlant: cert.manufacturingPlant,
      initialOdometer: cert.initialOdometer,
    };

    const calculatedHash = generateManufacturerCertificateHash(canonicalInput);

    if (calculatedHash !== cert.recordHash) {
      return 'TAMPER_DETECTED';
    }

    if (!cert.blockchainTxHash) {
      return 'NOT_ANCHORED';
    }

    // Verify against on-chain BlockchainRecord
    const anchoredRecord = await prisma.blockchainRecord.findFirst({
      where: {
        vehicleId: cert.vehicleId,
        recordType: 'MANUFACTURER_CERTIFICATE',
        blockchainTxHash: cert.blockchainTxHash,
      },
    });

    if (anchoredRecord && anchoredRecord.recordHash !== calculatedHash) {
      return 'TAMPER_DETECTED';
    }

    return 'VERIFIED';
  }
}
