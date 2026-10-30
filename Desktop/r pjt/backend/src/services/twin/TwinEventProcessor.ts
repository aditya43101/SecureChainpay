import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { TwinLifecycleEventDTO } from './autonomousTwinTypes';

export class TwinEventProcessor {
  private static instance: TwinEventProcessor;

  private constructor() {}

  public static getInstance(): TwinEventProcessor {
    if (!TwinEventProcessor.instance) {
      TwinEventProcessor.instance = new TwinEventProcessor();
    }
    return TwinEventProcessor.instance;
  }

  /**
   * Generates a deterministic idempotency key for an event.
   */
  public generateIdempotencyKey(
    vehicleId: string,
    eventType: string,
    sourceRecordId: string,
    eventTime: Date
  ): string {
    const raw = `TWIN_EVT_V10:${vehicleId}:${eventType}:${sourceRecordId}:${eventTime.toISOString()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Scans all authoritative source records for a vehicle and synchronizes the
   * VehicleTwinEvent stream idempotently.
   */
  public async syncAuthoritativeEvents(vehicleId: string): Promise<{
    scannedCount: number;
    upsertedCount: number;
  }> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        currentOwner: true,
        manufacturerCertificate: true,
        batteryPassport: {
          include: { events: true },
        },
        ownershipHistory: {
          include: { previousOwner: true, newOwner: true },
        },
        serviceRecords: {
          include: { garage: true },
        },
        odometerRecords: {
          include: { sourceUser: true },
        },
        accidentRecords: {
          include: { reportedBy: true },
        },
        insuranceRecords: {
          include: { provider: true },
        },
        documents: {
          include: { uploadedBy: true },
        },
        blockchainRecords: true,
        privacyCredentials: true,
      },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const candidateEvents: Array<{
      eventType: string;
      sourceRecordId: string;
      sourceSystem: string;
      eventTime: Date;
      recordedTime: Date;
      actor?: string | null;
      sourceVerificationStatus: string;
      contentHash?: string | null;
      blockchainTxHash?: string | null;
      summary: string;
      payloadJson?: string | null;
    }> = [];

    // 1. Initial Registration
    candidateEvents.push({
      eventType: 'VEHICLE_REGISTERED',
      sourceRecordId: vehicle.id,
      sourceSystem: 'CORE_PASSPORT',
      eventTime: vehicle.createdAt,
      recordedTime: vehicle.createdAt,
      actor: vehicle.currentOwner?.name || 'Authorized Registrar',
      sourceVerificationStatus: vehicle.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
      contentHash: vehicle.recordHash,
      blockchainTxHash: vehicle.blockchainTxHash,
      summary: `Vehicle ${vehicle.manufacturingYear} ${vehicle.manufacturer} ${vehicle.model} initially registered.`,
      payloadJson: JSON.stringify({
        vin: vehicle.vin,
        registrationNumber: vehicle.registrationNumber,
        fuelType: vehicle.fuelType,
      }),
    });

    // 2. Factory Birth Certificate
    if (vehicle.manufacturerCertificate) {
      const mc = vehicle.manufacturerCertificate;
      candidateEvents.push({
        eventType: 'MANUFACTURER_BIRTH_CERTIFIED',
        sourceRecordId: mc.id,
        sourceSystem: 'MANUFACTURER_SYSTEM',
        eventTime: mc.manufacturingDate,
        recordedTime: mc.manufacturingDate,
        actor: 'Authorized Factory OEM',
        sourceVerificationStatus: 'VERIFIED',
        contentHash: mc.recordHash,
        blockchainTxHash: mc.blockchainTxHash,
        summary: `Factory Birth Certificate issued (${mc.certificateNumber}) at plant ${mc.manufacturingPlant || 'OEM Assembly'}.`,
        payloadJson: JSON.stringify({
          certificateNumber: mc.certificateNumber,
          initialOdometer: mc.initialOdometer,
        }),
      });
    }

    // 3. Ownership Transfers
    for (const oh of vehicle.ownershipHistory) {
      candidateEvents.push({
        eventType: 'OWNERSHIP_TRANSFERRED',
        sourceRecordId: oh.id,
        sourceSystem: 'CORE_PASSPORT',
        eventTime: oh.transferDate,
        recordedTime: oh.createdAt,
        actor: oh.newOwner?.name || 'Transferee',
        sourceVerificationStatus: oh.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
        contentHash: oh.recordHash,
        blockchainTxHash: oh.blockchainTxHash,
        summary: `Ownership transferred from ${oh.previousOwner?.name || 'Initial Dealer'} to ${oh.newOwner?.name || 'New Owner'}.`,
        payloadJson: JSON.stringify({
          transferType: oh.transferType,
        }),
      });
    }

    // 4. Service Records
    for (const sr of vehicle.serviceRecords) {
      candidateEvents.push({
        eventType: 'SERVICE_PERFORMED',
        sourceRecordId: sr.id,
        sourceSystem: 'SERVICE_LEDGER',
        eventTime: sr.serviceDate,
        recordedTime: sr.createdAt,
        actor: sr.garage?.name || 'Certified Garage',
        sourceVerificationStatus: sr.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
        contentHash: sr.recordHash,
        blockchainTxHash: sr.blockchainTxHash,
        summary: `${sr.serviceType} performed at ${sr.mileage.toLocaleString()} km by ${sr.garage?.name || 'Garage'}.`,
        payloadJson: JSON.stringify({
          serviceType: sr.serviceType,
          mileage: sr.mileage,
          cost: sr.cost,
        }),
      });
    }

    // 5. Odometer Records
    for (const odo of vehicle.odometerRecords) {
      candidateEvents.push({
        eventType: 'ODOMETER_LOGGED',
        sourceRecordId: odo.id,
        sourceSystem: 'ODOMETER_LOG',
        eventTime: odo.recordedAt,
        recordedTime: odo.createdAt,
        actor: odo.sourceUser?.name || 'Odometer Logger',
        sourceVerificationStatus: odo.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
        contentHash: odo.recordHash,
        blockchainTxHash: odo.blockchainTxHash,
        summary: `Odometer reading recorded at ${odo.mileage.toLocaleString()} km via ${odo.sourceType}.`,
        payloadJson: JSON.stringify({
          mileage: odo.mileage,
          sourceType: odo.sourceType,
        }),
      });
    }

    // 6. Accidents
    for (const acc of vehicle.accidentRecords) {
      candidateEvents.push({
        eventType: 'ACCIDENT_RECORDED',
        sourceRecordId: acc.id,
        sourceSystem: 'COLLISION_REGISTRY',
        eventTime: acc.accidentDate,
        recordedTime: acc.createdAt,
        actor: acc.reportedBy?.name || 'Insurance Adjuster',
        sourceVerificationStatus: acc.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
        contentHash: acc.recordHash,
        blockchainTxHash: acc.blockchainTxHash,
        summary: `${acc.severity} collision incident reported: ${acc.description}`,
        payloadJson: JSON.stringify({
          severity: acc.severity,
          repairStatus: acc.repairStatus,
        }),
      });
    }

    // 7. Insurance Policies
    for (const ins of vehicle.insuranceRecords) {
      candidateEvents.push({
        eventType: 'INSURANCE_ISSUED',
        sourceRecordId: ins.id,
        sourceSystem: 'INSURANCE_CARRIER',
        eventTime: ins.startDate,
        recordedTime: ins.createdAt,
        actor: ins.provider?.name || 'Insurance Underwriter',
        sourceVerificationStatus: ins.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
        contentHash: ins.recordHash,
        blockchainTxHash: ins.blockchainTxHash,
        summary: `Policy ${ins.policyReference} active with ${ins.provider?.name || 'Insurer'} (Coverage to ${ins.endDate.toISOString().split('T')[0]}).`,
        payloadJson: JSON.stringify({
          policyReference: ins.policyReference,
          status: ins.status,
        }),
      });
    }

    // 8. Documents
    for (const doc of vehicle.documents) {
      candidateEvents.push({
        eventType: 'DOCUMENT_VERIFIED',
        sourceRecordId: doc.id,
        sourceSystem: 'DOCUMENT_INTELLIGENCE',
        eventTime: doc.createdAt,
        recordedTime: doc.createdAt,
        actor: doc.uploadedBy?.name || 'Document Auditor',
        sourceVerificationStatus: doc.consistencyStatus === 'CONSISTENT' ? 'VERIFIED' : 'UNVERIFIED',
        contentHash: doc.recordHash || doc.fileHash,
        blockchainTxHash: doc.blockchainTxHash,
        summary: `${doc.documentType} verified with OCR consistency status: ${doc.consistencyStatus}.`,
        payloadJson: JSON.stringify({
          documentType: doc.documentType,
          consistencyStatus: doc.consistencyStatus,
          ipfsCid: doc.ipfsCid,
        }),
      });
    }

    // 9. Battery Passport & Lifecycle Events (EVs)
    if (vehicle.batteryPassport) {
      for (const bev of vehicle.batteryPassport.events) {
        candidateEvents.push({
          eventType: 'BATTERY_EVENT_LOGGED',
          sourceRecordId: bev.id,
          sourceSystem: 'BATTERY_MANAGEMENT',
          eventTime: bev.eventDate,
          recordedTime: bev.createdAt,
          actor: 'Battery Service Technician',
          sourceVerificationStatus: bev.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
          contentHash: bev.recordHash,
          blockchainTxHash: bev.blockchainTxHash,
          summary: `EV Battery Event: ${bev.eventType} recorded on ${bev.eventDate.toISOString().split('T')[0]} (SoH: ${bev.sohPercentage ?? 94}%).`,
          payloadJson: JSON.stringify({
            eventType: bev.eventType,
            soh: bev.sohPercentage ?? 94,
          }),
        });
      }
    }

    // 10. Privacy & ZKP Credentials (Phase 9)
    for (const pc of vehicle.privacyCredentials) {
      candidateEvents.push({
        eventType: 'PRIVACY_CREDENTIAL_ISSUED',
        sourceRecordId: pc.id,
        sourceSystem: 'PRIVACY_VERIFIER',
        eventTime: pc.validFrom,
        recordedTime: pc.createdAt,
        actor: 'Certified Privacy Issuer',
        sourceVerificationStatus: pc.status === 'ACTIVE' ? 'VERIFIED' : 'SUSPICIOUS',
        contentHash: pc.rootCommitment,
        blockchainTxHash: pc.onChainTxHash,
        summary: `Privacy Credential (${pc.credentialType}) committed with Merkle root: ${pc.rootCommitment.slice(0, 16)}...`,
        payloadJson: JSON.stringify({
          credentialId: pc.credentialId,
          status: pc.status,
        }),
      });
    }

    // Upsert each event into the VehicleTwinEvent table with idempotency
    let upsertedCount = 0;
    for (const evt of candidateEvents) {
      const idempotencyKey = this.generateIdempotencyKey(
        vehicleId,
        evt.eventType,
        evt.sourceRecordId,
        evt.eventTime
      );

      await prisma.vehicleTwinEvent.upsert({
        where: { idempotencyKey },
        update: {
          sourceVerificationStatus: evt.sourceVerificationStatus,
          blockchainTxHash: evt.blockchainTxHash,
          summary: evt.summary,
        },
        create: {
          vehicleId,
          eventType: evt.eventType,
          sourceRecordId: evt.sourceRecordId,
          sourceSystem: evt.sourceSystem,
          eventTime: evt.eventTime,
          recordedTime: evt.recordedTime,
          ingestionTime: new Date(),
          actor: evt.actor,
          schemaVersion: '1.0.0',
          sourceVerificationStatus: evt.sourceVerificationStatus,
          contentHash: evt.contentHash,
          blockchainTxHash: evt.blockchainTxHash,
          idempotencyKey,
          summary: evt.summary,
          payloadJson: evt.payloadJson,
        },
      });
      upsertedCount++;
    }

    return {
      scannedCount: candidateEvents.length,
      upsertedCount,
    };
  }

  /**
   * Retrieves the deterministic, chronologically ordered event-sourced timeline.
   */
  public async getEventTimeline(vehicleId: string): Promise<TwinLifecycleEventDTO[]> {
    const events = await prisma.vehicleTwinEvent.findMany({
      where: { vehicleId },
      orderBy: [
        { eventTime: 'asc' },
        { recordedTime: 'asc' },
        { ingestionTime: 'asc' },
      ],
    });

    return events.map((e) => ({
      id: e.id,
      vehicleId: e.vehicleId,
      eventType: e.eventType,
      sourceRecordId: e.sourceRecordId,
      sourceSystem: e.sourceSystem,
      eventTime: e.eventTime.toISOString(),
      recordedTime: e.recordedTime.toISOString(),
      ingestionTime: e.ingestionTime.toISOString(),
      actor: e.actor,
      schemaVersion: e.schemaVersion,
      sourceVerificationStatus: e.sourceVerificationStatus,
      contentHash: e.contentHash,
      blockchainTxHash: e.blockchainTxHash,
      idempotencyKey: e.idempotencyKey,
      summary: e.summary,
      payloadJson: e.payloadJson,
    }));
  }
}

export const twinEventProcessor = TwinEventProcessor.getInstance();
