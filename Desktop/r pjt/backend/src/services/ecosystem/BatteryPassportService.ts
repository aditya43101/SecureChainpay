import { prisma } from '../../lib/prisma';
import { BlockchainService } from '../../blockchain/services/blockchainService';
import {
  generateBatteryPassportHash,
  generateBatteryEventHash,
  CanonicalBatteryPassportInput,
  CanonicalBatteryEventInput,
} from '../../blockchain/utils/canonicalHash';
import {
  BatteryPassportDTO,
  CreateBatteryPassportInput,
  LogBatteryEventInput,
  BatteryLifecycleEventDTO,
} from './types';
import { logAuditEvent } from '../auditService';
import { VerificationStatus } from '@prisma/client';

export class BatteryPassportService {
  private static instance: BatteryPassportService;

  public static getInstance(): BatteryPassportService {
    if (!BatteryPassportService.instance) {
      BatteryPassportService.instance = new BatteryPassportService();
    }
    return BatteryPassportService.instance;
  }

  /**
   * Checks if vehicle powertrain is compatible with EV Battery Passport
   */
  public isEvCompatible(fuelType: string): boolean {
    return fuelType === 'ELECTRIC' || fuelType === 'HYBRID';
  }

  /**
   * Retrieves the Battery Passport for an EV/Hybrid vehicle
   */
  public async getBatteryPassport(vehicleId: string): Promise<BatteryPassportDTO | null> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        batteryPassport: {
          include: {
            events: {
              orderBy: { eventDate: 'desc' },
            },
          },
        },
      },
    });

    if (!vehicle || !this.isEvCompatible(vehicle.fuelType)) {
      return null;
    }

    const bp = vehicle.batteryPassport;
    if (!bp) return null;

    // Calculate transparent retention metrics
    const capacityRetained = bp.nominalCapacityKwh > 0
      ? Math.min(100, Math.max(0, Math.round((bp.currentCapacityKwh / bp.nominalCapacityKwh) * 1000) / 10))
      : 100;
    const estimatedDegradation = Math.max(0, Math.round((100 - capacityRetained) * 10) / 10);

    // Evidence classification tier
    const hasDiagnosticEvent = bp.events.some((e) => e.eventType === 'BATTERY_INSPECTED' && e.verificationStatus === 'VERIFIED');
    const classification = hasDiagnosticEvent
      ? 'VERIFIED'
      : bp.events.length > 0
      ? 'DERIVED'
      : bp.currentCapacityKwh === bp.nominalCapacityKwh
      ? 'ESTIMATED'
      : 'INSUFFICIENT_DATA';

    const eventsDto: BatteryLifecycleEventDTO[] = bp.events.map((e) => ({
      id: e.id,
      batteryPassportId: e.batteryPassportId,
      eventType: e.eventType,
      eventDate: e.eventDate.toISOString(),
      recordedBy: e.recordedBy,
      capacityKwh: e.capacityKwh,
      sohPercentage: e.sohPercentage,
      cycleCount: e.cycleCount,
      description: e.description,
      verificationStatus: e.verificationStatus,
      evidenceRef: e.evidenceRef,
      recordHash: e.recordHash,
      blockchainTxHash: e.blockchainTxHash,
      blockNumber: e.blockNumber,
      createdAt: e.createdAt.toISOString(),
    }));

    return {
      id: bp.id,
      vehicleId: bp.vehicleId,
      passportId: vehicle.passportId,
      batterySerial: bp.batterySerial,
      chemistry: bp.chemistry,
      nominalCapacityKwh: bp.nominalCapacityKwh,
      currentCapacityKwh: bp.currentCapacityKwh,
      sohPercentage: bp.sohPercentage,
      cycleCount: bp.cycleCount,
      manufactureDate: bp.manufactureDate.toISOString(),
      installationDate: bp.installationDate.toISOString(),
      warrantyExpiryDate: bp.warrantyExpiryDate ? bp.warrantyExpiryDate.toISOString() : null,
      isOriginal: bp.isOriginal,
      status: bp.status,
      estimatedDegradationPercentage: estimatedDegradation,
      capacityRetainedPercentage: capacityRetained,
      evidenceClassification: classification,
      recordHash: bp.recordHash,
      blockchainRecordId: bp.blockchainRecordId,
      blockchainTxHash: bp.blockchainTxHash,
      blockNumber: bp.blockNumber,
      events: eventsDto,
      createdAt: bp.createdAt.toISOString(),
    };
  }

  /**
   * Initializes and anchors an EV Battery Passport
   */
  public async createBatteryPassport(
    vehicleId: string,
    input: CreateBatteryPassportInput
  ): Promise<BatteryPassportDTO> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    if (!this.isEvCompatible(vehicle.fuelType)) {
      throw new Error(`Battery Passport can only be created for ELECTRIC or HYBRID vehicles. Found: ${vehicle.fuelType}`);
    }

    const existingBp = await prisma.batteryPassport.findUnique({
      where: { vehicleId },
    });

    if (existingBp) {
      throw new Error(`Battery Passport already exists for vehicle ${vehicle.passportId} (Serial: ${existingBp.batterySerial})`);
    }

    const mfgDate = new Date(input.manufactureDate || `${vehicle.manufacturingYear}-01-10T00:00:00Z`);
    const installDate = new Date(input.installationDate || `${vehicle.manufacturingYear}-01-20T00:00:00Z`);
    const warrantyDate = input.warrantyExpiryDate ? new Date(input.warrantyExpiryDate) : null;
    const nominalCap = input.nominalCapacityKwh;
    const currentCap = input.currentCapacityKwh ?? nominalCap;
    const soh = input.sohPercentage ?? 100.0;
    const cycles = input.cycleCount ?? 0;

    // Canonical Hashing
    const canonicalInput: CanonicalBatteryPassportInput = {
      blockchainVehicleId: vehicle.blockchainVehicleId || vehicle.id,
      batterySerial: input.batterySerial,
      chemistry: input.chemistry,
      nominalCapacityKwh: nominalCap,
      manufactureDate: mfgDate,
    };

    const recordHash = generateBatteryPassportHash(canonicalInput);

    // Blockchain Anchoring
    let blockchainRecordId: string | null = null;
    let blockchainTxHash: string | null = null;
    let blockNumber: number | null = null;

    if (vehicle.blockchainVehicleId) {
      try {
        const anchor = await BlockchainService.getInstance().anchorRecord({
          vehicleId: vehicle.id,
          recordType: 'BATTERY_PASSPORT',
          recordHash,
        });
        blockchainRecordId = anchor.recordId;
        blockchainTxHash = anchor.txHash;
        blockNumber = anchor.blockNumber;
      } catch (err) {
        console.warn('⚠️ Blockchain anchoring failed for Battery Passport:', err);
      }
    }

    const bp = await prisma.batteryPassport.create({
      data: {
        vehicleId: vehicle.id,
        batterySerial: input.batterySerial,
        chemistry: input.chemistry,
        nominalCapacityKwh: nominalCap,
        currentCapacityKwh: currentCap,
        sohPercentage: soh,
        cycleCount: cycles,
        manufactureDate: mfgDate,
        installationDate: installDate,
        warrantyExpiryDate: warrantyDate,
        isOriginal: input.isOriginal ?? true,
        status: 'ACTIVE',
        recordHash,
        blockchainRecordId,
        blockchainTxHash,
        blockNumber,
      },
    });

    // Automatically create initial BATTERY_INSTALLED event
    await this.logLifecycleEvent(vehicle.id, 'OEM Factory Assembly', {
      eventType: 'BATTERY_INSTALLED',
      eventDate: installDate.toISOString(),
      capacityKwh: nominalCap,
      sohPercentage: 100.0,
      cycleCount: 0,
      description: `Factory initial installation of ${input.chemistry} high-voltage traction pack (${nominalCap} kWh)`,
      evidenceRef: `OEM-BIRTH-${input.batterySerial}`,
    });

    await logAuditEvent({
      action: 'BATTERY_PASSPORT_CREATED',
      vehicleId: vehicle.id,
      details: {
        batterySerial: bp.batterySerial,
        nominalCapacityKwh: nominalCap,
        recordHash,
        blockchainTxHash,
      },
    });

    return (await this.getBatteryPassport(vehicle.id))!;
  }

  /**
   * Logs a battery lifecycle event (inspection, service, repair, replacement, decommissioning)
   */
  public async logLifecycleEvent(
    vehicleId: string,
    recordedBy: string,
    input: LogBatteryEventInput
  ): Promise<BatteryLifecycleEventDTO> {
    const bp = await prisma.batteryPassport.findUnique({
      where: { vehicleId },
      include: { vehicle: true },
    });

    if (!bp) {
      throw new Error(`Battery Passport not found for vehicle ${vehicleId}`);
    }

    const eventDate = new Date(input.eventDate || new Date());
    const capacity = input.capacityKwh ?? (input as any).measuredCapacityKwh ?? null;
    const soh = input.sohPercentage ?? (input as any).stateOfHealthPct ?? null;
    const desc = input.description || (input as any).notes || `Battery event logged: ${input.eventType}`;

    // Canonical event hashing
    const canonicalInput: CanonicalBatteryEventInput = {
      blockchainVehicleId: bp.vehicle.blockchainVehicleId || bp.vehicle.id,
      batterySerial: bp.batterySerial,
      eventType: input.eventType,
      eventDate,
      capacityKwh: capacity,
      sohPercentage: soh,
    };

    const recordHash = generateBatteryEventHash(canonicalInput);

    let blockchainTxHash: string | null = null;
    let blockNumber: number | null = null;

    if (bp.vehicle.blockchainVehicleId) {
      try {
        const anchor = await BlockchainService.getInstance().anchorRecord({
          vehicleId: bp.vehicle.id,
          recordType: 'BATTERY_EVENT',
          recordHash,
        });
        blockchainTxHash = anchor.txHash;
        blockNumber = anchor.blockNumber;
      } catch (err) {
        console.warn('⚠️ Blockchain anchoring failed for Battery Event:', err);
      }
    }

    const event = await prisma.batteryLifecycleEvent.create({
      data: {
        batteryPassportId: bp.id,
        eventType: input.eventType,
        eventDate,
        recordedBy,
        capacityKwh: capacity,
        sohPercentage: soh,
        cycleCount: input.cycleCount,
        description: desc,
        verificationStatus: VerificationStatus.VERIFIED,
        evidenceRef: input.evidenceRef,
        recordHash,
        blockchainTxHash,
        blockNumber,
      },
    });

    // Update battery passport status or capacity if diagnostic data provided
    const updateData: Record<string, any> = {};
    if (capacity !== undefined && capacity !== null) {
      updateData.currentCapacityKwh = capacity;
    }
    if (soh !== undefined && soh !== null) {
      updateData.sohPercentage = soh;
    }
    if (input.cycleCount !== undefined && input.cycleCount !== null) {
      updateData.cycleCount = input.cycleCount;
    }
    if (input.eventType === 'BATTERY_DECOMMISSIONED') {
      updateData.status = 'DECOMMISSIONED';
    } else if (input.eventType === 'BATTERY_REPLACED') {
      updateData.isOriginal = false;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.batteryPassport.update({
        where: { id: bp.id },
        data: updateData,
      });
    }

    await logAuditEvent({
      action: 'BATTERY_EVENT_LOGGED',
      vehicleId: bp.vehicleId,
      details: {
        eventType: input.eventType,
        recordHash,
        blockchainTxHash,
      },
    });

    return {
      id: event.id,
      batteryPassportId: event.batteryPassportId,
      eventType: event.eventType,
      eventDate: event.eventDate.toISOString(),
      recordedBy: event.recordedBy,
      capacityKwh: event.capacityKwh,
      sohPercentage: event.sohPercentage,
      cycleCount: event.cycleCount,
      description: event.description,
      verificationStatus: event.verificationStatus,
      evidenceRef: event.evidenceRef,
      recordHash: event.recordHash,
      blockchainTxHash: event.blockchainTxHash,
      blockNumber: event.blockNumber,
      createdAt: event.createdAt.toISOString(),
    };
  }
}
