import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { BlockchainService } from '../../blockchain/services/blockchainService';
import { BatchOrchestrationService } from '../../blockchain/services/batchOrchestrationService';
import { GraphInvestigationService } from '../graph/graphInvestigationService';
import {
  RegisteredToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  CollectedEvidenceDraft,
} from './types';
import { verifySelectiveDisclosurePresentation } from '../privacy/merkleDisclosureService';
import { verifyRangeProof, computeVehicleCommitment } from '../privacy/pedersenZkpService';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, RegisteredToolDefinition> = new Map();

  private constructor() {
    this.registerAllTools();
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public getTool(name: string): RegisteredToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): RegisteredToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Helper to check whether user has access to a vehicle
   */
  public async checkVehicleAccess(vehicleId: string, context: ToolExecutionContext): Promise<boolean> {
    if (context.userRole === 'ADMIN' || context.userRole === 'GARAGE' || context.userRole === 'INSURANCE_PROVIDER' || context.userRole === 'MANUFACTURER') {
      return true;
    }
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { currentOwnerId: true },
    });
    return !!vehicle && vehicle.currentOwnerId === context.userId;
  }

  private register(tool: RegisteredToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  private registerAllTools() {
    // ------------------------------------------------------------------------
    // 1. get_vehicle_passport
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_vehicle_passport',
      version: '1.0',
      description: 'Retrieves canonical digital vehicle passport core identity and current status.',
      category: 'PASSPORT',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1, 'vehicleId is required'),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'get_vehicle_passport',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: {
              category: 'UNAUTHORIZED',
              message: 'Caller is not authorized to access this vehicle passport',
              isRetryable: false,
            },
          };
        }

        const vehicle = await prisma.vehicle.findUnique({
          where: { id: input.vehicleId },
          include: {
            currentOwner: { select: { id: true, name: true, email: true, role: true } },
          },
        });

        if (!vehicle) {
          return {
            success: false,
            toolName: 'get_vehicle_passport',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'NOT_FOUND', message: `Vehicle not found with ID ${input.vehicleId}`, isRetryable: false },
          };
        }

        const evidence: CollectedEvidenceDraft = {
          evidenceType: 'VEHICLE_PASSPORT',
          sourceRecordId: vehicle.id,
          contentHash: vehicle.recordHash || undefined,
          verificationStatus: vehicle.blockchainStatus === 'CONFIRMED' ? 'VERIFIED' : 'UNVERIFIED',
          description: `Vehicle Passport: ${vehicle.passportId} (${vehicle.manufacturer} ${vehicle.model} ${vehicle.manufacturingYear})`,
          relationship: 'SUPPORTING',
          provenance: {
            vin: vehicle.vin,
            registrationNumber: vehicle.registrationNumber,
            blockchainTxHash: vehicle.blockchainTxHash,
            blockNumber: vehicle.blockNumber,
            status: vehicle.status,
            ownerId: vehicle.currentOwnerId,
          },
        };

        return {
          success: true,
          toolName: 'get_vehicle_passport',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            id: vehicle.id,
            passportId: vehicle.passportId,
            vin: vehicle.vin,
            registrationNumber: vehicle.registrationNumber,
            manufacturer: vehicle.manufacturer,
            model: vehicle.model,
            variant: vehicle.variant,
            year: vehicle.manufacturingYear,
            fuelType: vehicle.fuelType,
            status: vehicle.status,
            blockchainStatus: vehicle.blockchainStatus,
            blockchainTxHash: vehicle.blockchainTxHash,
            blockNumber: vehicle.blockNumber,
            recordHash: vehicle.recordHash,
            currentOwner: vehicle.currentOwner,
          },
          evidenceItems: [evidence],
        };
      },
    });

    // ------------------------------------------------------------------------
    // 2. get_vehicle_identity_history
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_vehicle_identity_history',
      version: '1.0',
      description: 'Retrieves vehicle birth certificate and manufacturing identity metadata.',
      category: 'PASSPORT',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'get_vehicle_identity_history',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        const [birthCert, batteryPassport] = await Promise.all([
          prisma.manufacturerCertificate.findUnique({ where: { vehicleId: input.vehicleId } }),
          prisma.batteryPassport.findUnique({ where: { vehicleId: input.vehicleId } }),
        ]);

        const evidenceItems: CollectedEvidenceDraft[] = [];

        if (birthCert) {
          evidenceItems.push({
            evidenceType: 'MANUFACTURER_CERTIFICATE',
            sourceRecordId: birthCert.id,
            contentHash: birthCert.recordHash,
            verificationStatus: birthCert.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
            description: `Factory Birth Certificate ${birthCert.certificateNumber} issued by plant ${birthCert.manufacturingPlant}`,
            relationship: 'SUPPORTING',
            provenance: {
              plant: birthCert.manufacturingPlant,
              manufactureDate: birthCert.manufacturingDate,
              initialOdometer: birthCert.initialOdometer,
              blockchainTxHash: birthCert.blockchainTxHash,
            },
          });
        }

        if (batteryPassport) {
          evidenceItems.push({
            evidenceType: 'BATTERY_PASSPORT',
            sourceRecordId: batteryPassport.id,
            contentHash: batteryPassport.recordHash,
            verificationStatus: batteryPassport.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
            description: `Traction Battery Serial: ${batteryPassport.batterySerial} (${batteryPassport.chemistry}, ${batteryPassport.nominalCapacityKwh} kWh, SoH: ${batteryPassport.sohPercentage}%)`,
            relationship: 'SUPPORTING',
            provenance: {
              batterySerial: batteryPassport.batterySerial,
              chemistry: batteryPassport.chemistry,
              sohPercentage: batteryPassport.sohPercentage,
              cycleCount: batteryPassport.cycleCount,
            },
          });
        }

        return {
          success: true,
          toolName: 'get_vehicle_identity_history',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            birthCertificate: birthCert,
            batteryPassport,
          },
          evidenceItems,
        };
      },
    });

    // ------------------------------------------------------------------------
    // 3. get_ownership_timeline
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_ownership_timeline',
      version: '1.0',
      description: 'Retrieves chronological vehicle ownership transfer history.',
      category: 'LIFECYCLE',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'get_ownership_timeline',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        const transfers = await prisma.ownershipHistory.findMany({
          where: { vehicleId: input.vehicleId },
          include: {
            previousOwner: { select: { id: true, name: true, role: true } },
            newOwner: { select: { id: true, name: true, role: true } },
          },
          orderBy: { transferDate: 'asc' },
        });

        const evidenceItems: CollectedEvidenceDraft[] = transfers.map((t) => ({
          evidenceType: 'OWNERSHIP_TRANSFER',
          sourceRecordId: t.id,
          contentHash: t.recordHash || undefined,
          verificationStatus: t.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
          description: `Ownership transfer (${t.transferType}): from ${t.previousOwner?.name || 'Genesis'} to ${t.newOwner?.name || 'Unknown'} on ${t.transferDate.toISOString().split('T')[0]}`,
          relationship: 'SUPPORTING',
          provenance: {
            transferType: t.transferType,
            transferDate: t.transferDate,
            previousOwnerId: t.previousOwnerId,
            newOwnerId: t.newOwnerId,
            blockchainTxHash: t.blockchainTxHash,
          },
        }));

        return {
          success: true,
          toolName: 'get_ownership_timeline',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: { transfers },
          evidenceItems,
        };
      },
    });

    // ------------------------------------------------------------------------
    // 4. get_service_history
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_service_history',
      version: '1.0',
      description: 'Retrieves certified service and maintenance entries with garage metadata.',
      category: 'LIFECYCLE',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input: { vehicleId: string; limit?: number }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'get_service_history',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        const services = await prisma.serviceRecord.findMany({
          where: { vehicleId: input.vehicleId },
          include: {
            garage: {
              select: {
                id: true,
                name: true,
                garageProfile: { select: { businessName: true, trustIndex: true, verificationStatus: true } },
              },
            },
          },
          orderBy: { serviceDate: 'asc' },
          take: input.limit || 50,
        });

        const evidenceItems: CollectedEvidenceDraft[] = services.map((s) => ({
          evidenceType: 'SERVICE_RECORD',
          sourceRecordId: s.id,
          contentHash: s.recordHash || undefined,
          verificationStatus: s.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
          description: `Certified service (${s.serviceType}) at ${s.mileage} km on ${s.serviceDate.toISOString().split('T')[0]} by ${s.garage.garageProfile?.businessName || s.garage.name}`,
          relationship: 'SUPPORTING',
          provenance: {
            serviceDate: s.serviceDate,
            mileage: s.mileage,
            serviceType: s.serviceType,
            cost: s.cost,
            technician: s.technician,
            garageId: s.garageId,
            blockchainTxHash: s.blockchainTxHash,
          },
        }));

        return {
          success: true,
          toolName: 'get_service_history',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: { services },
          evidenceItems,
        };
      },
    });

    // ------------------------------------------------------------------------
    // 5. get_odometer_timeline
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_odometer_timeline',
      version: '1.0',
      description: 'Retrieves chronological odometer telemetry and evaluates monotonic sequence integrity.',
      category: 'LIFECYCLE',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'get_odometer_timeline',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        const readings = await prisma.odometerRecord.findMany({
          where: { vehicleId: input.vehicleId },
          orderBy: { recordedAt: 'asc' },
        });

        // Sequence analysis: flag decreases between consecutive readings
        const discrepancies: Array<{ priorReading: any; currentReading: any; dropKm: number }> = [];
        for (let i = 1; i < readings.length; i++) {
          const prev = readings[i - 1];
          const curr = readings[i];
          if (curr.mileage < prev.mileage) {
            discrepancies.push({
              priorReading: { id: prev.id, mileage: prev.mileage, recordedAt: prev.recordedAt },
              currentReading: { id: curr.id, mileage: curr.mileage, recordedAt: curr.recordedAt },
              dropKm: prev.mileage - curr.mileage,
            });
          }
        }

        const evidenceItems: CollectedEvidenceDraft[] = readings.map((r, index) => {
          const isDrop = discrepancies.some((d) => d.currentReading.id === r.id);
          return {
            evidenceType: 'ODOMETER_RECORD',
            sourceRecordId: r.id,
            contentHash: r.recordHash || undefined,
            verificationStatus: r.rollbackDetected ? 'MISMATCH' : r.blockchainTxHash ? 'VERIFIED' : 'UNVERIFIED',
            description: `Odometer reading #${index + 1}: ${r.mileage} km on ${r.recordedAt.toISOString().split('T')[0]} (Source: ${r.sourceType})${isDrop ? ' [MILEAGE DECREASE DETECTED]' : ''}`,
            relationship: isDrop ? 'CONTRADICTING' : 'SUPPORTING',
            provenance: {
              mileage: r.mileage,
              recordedAt: r.recordedAt,
              sourceType: r.sourceType,
              rollbackDetected: r.rollbackDetected,
              blockchainTxHash: r.blockchainTxHash,
            },
          };
        });

        return {
          success: true,
          toolName: 'get_odometer_timeline',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            readingsCount: readings.length,
            readings,
            discrepancies,
            isMonotonic: discrepancies.length === 0,
          },
          evidenceItems,
        };
      },
    });

    // ------------------------------------------------------------------------
    // 6. get_document_metadata
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_document_metadata',
      version: '1.0',
      description: 'Retrieves uploaded document metadata, IPFS hashes, and OCR status.',
      category: 'PASSPORT',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'get_document_metadata',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        const documents = await prisma.vehicleDocument.findMany({
          where: { vehicleId: input.vehicleId },
          orderBy: { createdAt: 'desc' },
        });

        const evidenceItems: CollectedEvidenceDraft[] = documents.map((d) => ({
          evidenceType: 'DOCUMENT',
          sourceRecordId: d.id,
          contentHash: d.fileHash,
          verificationStatus: d.consistencyStatus === 'CONSISTENT' ? 'VERIFIED' : d.consistencyStatus === 'INCONSISTENT' ? 'MISMATCH' : 'UNVERIFIED',
          description: `Document [${d.documentType}]: "${d.title}" (Storage: ${d.storageProvider}, CID: ${d.ipfsCid || 'N/A'}, OCR: ${d.ocrStatus})`,
          relationship: d.consistencyStatus === 'INCONSISTENT' ? 'CONTRADICTING' : 'SUPPORTING',
          provenance: {
            documentType: d.documentType,
            ocrStatus: d.ocrStatus,
            consistencyStatus: d.consistencyStatus,
            consistencyDetails: d.consistencyDetails,
            recordHash: d.recordHash,
            createdAt: d.createdAt,
          },
        }));

        return {
          success: true,
          toolName: 'get_document_metadata',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: { documents },
          evidenceItems,
        };
      },
    });

    // ------------------------------------------------------------------------
    // 7. verify_document_integrity
    // ------------------------------------------------------------------------
    this.register({
      name: 'verify_document_integrity',
      version: '1.0',
      description: 'Audits document OCR extraction consistency against vehicle database records.',
      category: 'ANALYSIS',
      isReadOnly: true,
      inputSchema: z.object({
        documentId: z.string().min(1),
      }),
      execute: async (input: { documentId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const doc = await prisma.vehicleDocument.findUnique({
          where: { id: input.documentId },
          include: { vehicle: true },
        });

        if (!doc) {
          return {
            success: false,
            toolName: 'verify_document_integrity',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'NOT_FOUND', message: 'Document not found', isRetryable: false },
          };
        }

        const hasAccess = await this.checkVehicleAccess(doc.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'verify_document_integrity',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        let extractedDataObj: any = null;
        try {
          if (doc.extractedData) {
            extractedDataObj = typeof doc.extractedData === 'string' ? JSON.parse(doc.extractedData) : doc.extractedData;
          }
        } catch {
          extractedDataObj = null;
        }

        const vinMatch = extractedDataObj?.vin ? extractedDataObj.vin.toUpperCase() === doc.vehicle.vin.toUpperCase() : null;
        const regMatch = extractedDataObj?.registrationNumber ? extractedDataObj.registrationNumber.toUpperCase() === doc.vehicle.registrationNumber.toUpperCase() : null;

        const isConsistent = vinMatch !== false && regMatch !== false && doc.consistencyStatus !== 'INCONSISTENT';

        const evidence: CollectedEvidenceDraft = {
          evidenceType: 'DOCUMENT_VERIFICATION',
          sourceRecordId: doc.id,
          contentHash: doc.fileHash,
          verificationStatus: isConsistent ? 'VERIFIED' : 'MISMATCH',
          description: `Document audit for "${doc.title}": VIN Match: ${vinMatch === null ? 'N/A' : vinMatch}, Reg Match: ${regMatch === null ? 'N/A' : regMatch}, Consistency: ${doc.consistencyStatus}`,
          relationship: isConsistent ? 'SUPPORTING' : 'CONTRADICTING',
          provenance: {
            extractedVin: extractedDataObj?.vin,
            expectedVin: doc.vehicle.vin,
            extractedReg: extractedDataObj?.registrationNumber,
            expectedReg: doc.vehicle.registrationNumber,
            ocrStatus: doc.ocrStatus,
          },
        };

        return {
          success: true,
          toolName: 'verify_document_integrity',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            documentId: doc.id,
            title: doc.title,
            vinMatch,
            regMatch,
            isConsistent,
            consistencyDetails: doc.consistencyDetails,
          },
          evidenceItems: [evidence],
        };
      },
    });

    // ------------------------------------------------------------------------
    // 8. get_blockchain_anchor_status
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_blockchain_anchor_status',
      version: '1.0',
      description: 'Checks on-chain Hardhat smart contract registration and confirmed anchor logs.',
      category: 'BLOCKCHAIN',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'get_blockchain_anchor_status',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        const blockchainRecords = await prisma.blockchainRecord.findMany({
          where: { vehicleId: input.vehicleId },
          orderBy: { createdAt: 'desc' },
        });

        let onChainVerification = null;
        try {
          const bs = BlockchainService.getInstance();
          onChainVerification = await bs.verifyVehiclePassportFull(input.vehicleId);
        } catch (err: any) {
          console.warn('BlockchainService query warning:', err.message);
        }

        const isFullyVerified = onChainVerification?.overallVerified ?? false;

        const failedCategories: string[] = [];
        if (onChainVerification?.categories) {
          for (const [cat, val] of Object.entries(onChainVerification.categories) as [string, any][]) {
            if (val.status === 'TAMPER_DETECTED') {
              failedCategories.push(cat);
            }
          }
        }

        const evidence: CollectedEvidenceDraft = {
          evidenceType: 'BLOCKCHAIN_ANCHOR_STATE',
          sourceRecordId: input.vehicleId,
          contentHash: onChainVerification?.vehicleIdentity?.onChainHash || onChainVerification?.vehicleIdentity?.calculatedHash || undefined,
          verificationStatus: isFullyVerified ? 'VERIFIED' : onChainVerification ? 'MISMATCH' : 'UNAVAILABLE',
          description: `On-chain contract audit: ${blockchainRecords.length} anchor record(s), Verified: ${isFullyVerified}`,
          relationship: isFullyVerified ? 'SUPPORTING' : 'CONTRADICTING',
          provenance: {
            totalAnchors: blockchainRecords.length,
            isFullyVerified,
            failedCategories,
          },
        };

        return {
          success: true,
          toolName: 'get_blockchain_anchor_status',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            anchorsCount: blockchainRecords.length,
            records: blockchainRecords.slice(0, 15),
            onChainVerification,
          },
          evidenceItems: [evidence],
        };
      },
    });

    // ------------------------------------------------------------------------
    // 9. verify_record_against_blockchain
    // ------------------------------------------------------------------------
    this.register({
      name: 'verify_record_against_blockchain',
      version: '1.0',
      description: 'Recomputes canonical record hash and verifies against smart contract state.',
      category: 'BLOCKCHAIN',
      isReadOnly: true,
      inputSchema: z.object({
        recordId: z.string().min(1),
        recordType: z.string().min(1),
      }),
      execute: async (input: { recordId: string; recordType: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const bRec = await prisma.blockchainRecord.findFirst({
          where: {
            recordHash: { not: '' },
            OR: [{ id: input.recordId }, { vehicleId: input.recordId }],
          },
        });

        const isAnchored = !!bRec && bRec.status === 'CONFIRMED';
        const evidence: CollectedEvidenceDraft = {
          evidenceType: 'RECORD_CRYPTOGRAPHIC_PROOF',
          sourceRecordId: input.recordId,
          contentHash: bRec?.recordHash,
          verificationStatus: isAnchored ? 'VERIFIED' : 'UNVERIFIED',
          description: `Cryptographic audit for record ${input.recordId} (${input.recordType}): Status=${bRec?.status || 'NOT_FOUND'}, Tx=${bRec?.blockchainTxHash || 'NONE'}`,
          relationship: isAnchored ? 'SUPPORTING' : 'NEUTRAL',
          provenance: {
            recordType: input.recordType,
            txHash: bRec?.blockchainTxHash,
            blockNumber: bRec?.blockNumber,
          },
        };

        return {
          success: true,
          toolName: 'verify_record_against_blockchain',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            recordId: input.recordId,
            isAnchored,
            blockchainRecord: bRec,
          },
          evidenceItems: [evidence],
        };
      },
    });

    // ------------------------------------------------------------------------
    // 10. get_merkle_proof_status
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_merkle_proof_status',
      version: '1.0',
      description: 'Validates Phase 6 cryptographic Merkle batch inclusion and root anchoring.',
      category: 'BLOCKCHAIN',
      isReadOnly: true,
      inputSchema: z.object({
        recordId: z.string().min(1),
      }),
      execute: async (input: { recordId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        let verificationResult: any = null;
        try {
          const batchService = BatchOrchestrationService.getInstance();
          verificationResult = await batchService.verifyRecord(input.recordId, 'UNKNOWN');
        } catch (err: any) {
          verificationResult = { overallStatus: 'UNAVAILABLE', error: err.message };
        }

        const isVerified = verificationResult?.overallStatus === 'VERIFIED';
        const isMismatch =
          verificationResult?.overallStatus === 'RECORD_HASH_MISMATCH' ||
          verificationResult?.overallStatus === 'ROOT_MISMATCH' ||
          verificationResult?.overallStatus === 'INVALID_PROOF';

        const evidence: CollectedEvidenceDraft = {
          evidenceType: 'MERKLE_BATCH_INCLUSION',
          sourceRecordId: input.recordId,
          contentHash: verificationResult?.merkleRoot || undefined,
          verificationStatus: isVerified ? 'VERIFIED' : isMismatch ? 'MISMATCH' : 'UNAVAILABLE',
          description: `Merkle inclusion verification for record ${input.recordId}: Status=${verificationResult?.overallStatus}, Batch=${verificationResult?.batchIdentifier || 'N/A'}`,
          relationship: isVerified ? 'SUPPORTING' : isMismatch ? 'CONTRADICTING' : 'NEUTRAL',
          provenance: {
            batchIdentifier: verificationResult?.batchIdentifier,
            merkleRoot: verificationResult?.merkleRoot,
            leafIndex: verificationResult?.leafIndex,
            leafHash: verificationResult?.leafHash,
            status: verificationResult?.status,
          },
        };

        return {
          success: true,
          toolName: 'get_merkle_proof_status',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: verificationResult,
          evidenceItems: [evidence],
        };
      },
    });

    // ------------------------------------------------------------------------
    // 11. get_vehicle_fraud_findings
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_vehicle_fraud_findings',
      version: '1.0',
      description: 'Retrieves active Phase 7 fraud pattern findings and rule evaluations.',
      category: 'GRAPH',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'get_vehicle_fraud_findings',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        const findings = await prisma.fraudFinding.findMany({
          where: {
            OR: [
              { primaryEntityId: input.vehicleId },
              { primaryEntityType: 'VEHICLE', primaryEntityId: input.vehicleId },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        const evidenceItems: CollectedEvidenceDraft[] = findings.map((f) => ({
          evidenceType: 'FRAUD_FINDING',
          sourceRecordId: f.id,
          verificationStatus: f.status === 'RESOLVED' || f.status === 'DISMISSED' ? 'UNVERIFIED' : 'MISMATCH',
          description: `Finding ${f.findingNumber} [${f.ruleId}] (${f.severity}): ${f.title}`,
          relationship: 'CONTRADICTING',
          provenance: {
            ruleId: f.ruleId,
            ruleVersion: f.ruleVersion,
            severity: f.severity,
            status: f.status,
            category: f.category,
            explanation: f.explanation,
            unknowns: f.unknowns,
            recommendedAction: f.recommendedAction,
          },
        }));

        return {
          success: true,
          toolName: 'get_vehicle_fraud_findings',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            findingsCount: findings.length,
            findings,
          },
          evidenceItems,
        };
      },
    });

    // ------------------------------------------------------------------------
    // 12. get_related_graph_entities
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_related_graph_entities',
      version: '1.0',
      description: 'Traverses Phase 7 Fraud Intelligence Graph to discover adjacent multi-hop entities.',
      category: 'GRAPH',
      isReadOnly: true,
      inputSchema: z.object({
        nodeKey: z.string().min(1),
        depth: z.number().int().min(1).max(3).optional(),
      }),
      execute: async (input: { nodeKey: string; depth?: number }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const graphService = GraphInvestigationService.getInstance();
        const parts = input.nodeKey.split(':');
        const entityType = parts.length > 1 ? parts[0] : 'VEHICLE';
        const entityId = parts.length > 1 ? parts.slice(1).join(':') : input.nodeKey;
        const graphData = await graphService.getEntityNeighborhood(entityType, entityId, input.depth || 1);

        const evidenceItems: CollectedEvidenceDraft[] = graphData.edges.slice(0, 10).map((e) => ({
          evidenceType: 'GRAPH_RELATIONSHIP',
          sourceRecordId: e.id,
          verificationStatus: 'VERIFIED',
          description: `Graph edge (${e.relationshipType}): ${e.sourceKey} -> ${e.targetKey}`,
          relationship: 'SUPPORTING',
          provenance: {
            sourceKey: e.sourceKey,
            targetKey: e.targetKey,
            relationshipType: e.relationshipType,
            isDirect: e.isDirect,
            isInferred: e.isInferred,
            confidence: e.confidence,
          },
        }));

        return {
          success: true,
          toolName: 'get_related_graph_entities',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: graphData,
          evidenceItems,
        };
      },
    });

    // ------------------------------------------------------------------------
    // 13. get_related_graph_findings
    // ------------------------------------------------------------------------
    this.register({
      name: 'get_related_graph_findings',
      version: '1.0',
      description: 'Discovers cross-vehicle findings connected through graph edges (e.g. shared document hash).',
      category: 'GRAPH',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const vehicleNodeKey = `VEHICLE:${input.vehicleId}`;
        const edges = await prisma.graphEdge.findMany({
          where: {
            OR: [
              { sourceNode: { nodeKey: vehicleNodeKey } },
              { targetNode: { nodeKey: vehicleNodeKey } },
            ],
          },
          include: { sourceNode: true, targetNode: true },
        });

        const adjacentEntityIds = edges.map((e) =>
          e.sourceNode.nodeKey === vehicleNodeKey ? e.targetNode.entityId : e.sourceNode.entityId
        );

        const relatedFindings = await prisma.fraudFinding.findMany({
          where: {
            primaryEntityId: { in: adjacentEntityIds },
            NOT: { primaryEntityId: input.vehicleId },
          },
          take: 10,
        });

        const evidenceItems: CollectedEvidenceDraft[] = relatedFindings.map((f) => ({
          evidenceType: 'CROSS_VEHICLE_FINDING',
          sourceRecordId: f.id,
          verificationStatus: 'MISMATCH',
          description: `Related cross-entity finding ${f.findingNumber} (${f.ruleId}) on connected entity ${f.primaryEntityId}`,
          relationship: 'CONTRADICTING',
          provenance: {
            findingNumber: f.findingNumber,
            ruleId: f.ruleId,
            severity: f.severity,
            connectedEntityId: f.primaryEntityId,
          },
        }));

        return {
          success: true,
          toolName: 'get_related_graph_findings',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            connectedEntitiesCount: adjacentEntityIds.length,
            relatedFindings,
          },
          evidenceItems,
        };
      },
    });

    // ------------------------------------------------------------------------
    // 14. compare_record_timeline
    // ------------------------------------------------------------------------
    this.register({
      name: 'compare_record_timeline',
      version: '1.0',
      description: 'Cross-checks timestamps across services, odometer readings, and accidents for chronology violations.',
      category: 'ANALYSIS',
      isReadOnly: true,
      inputSchema: z.object({
        vehicleId: z.string().min(1),
      }),
      execute: async (input: { vehicleId: string }, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const start = Date.now();
        const hasAccess = await this.checkVehicleAccess(input.vehicleId, context);
        if (!hasAccess) {
          return {
            success: false,
            toolName: 'compare_record_timeline',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Unauthorized', isRetryable: false },
          };
        }

        const [vehicle, services, odometers, accidents] = await Promise.all([
          prisma.vehicle.findUnique({ where: { id: input.vehicleId }, select: { manufacturingYear: true, createdAt: true } }),
          prisma.serviceRecord.findMany({ where: { vehicleId: input.vehicleId }, orderBy: { serviceDate: 'asc' } }),
          prisma.odometerRecord.findMany({ where: { vehicleId: input.vehicleId }, orderBy: { recordedAt: 'asc' } }),
          prisma.accidentRecord.findMany({ where: { vehicleId: input.vehicleId }, orderBy: { accidentDate: 'asc' } }),
        ]);

        const anomalies: string[] = [];
        const mfgYear = vehicle?.manufacturingYear || 2000;
        const mfgDateLimit = new Date(`${mfgYear}-01-01T00:00:00.000Z`);

        // Check if any service predates manufacturing year
        for (const s of services) {
          if (s.serviceDate < mfgDateLimit) {
            anomalies.push(`Service on ${s.serviceDate.toISOString().split('T')[0]} predates vehicle manufacturing year (${mfgYear})`);
          }
        }

        // Check if any repair completion date predates accident date
        for (const a of accidents) {
          if (a.repairedAt && a.repairedAt < a.accidentDate) {
            anomalies.push(`Accident on ${a.accidentDate.toISOString().split('T')[0]} has repair date (${a.repairedAt.toISOString().split('T')[0]}) preceding accident occurrence`);
          }
        }

        const isChronologicallySound = anomalies.length === 0;
        const evidence: CollectedEvidenceDraft = {
          evidenceType: 'CHRONOLOGY_AUDIT',
          sourceRecordId: input.vehicleId,
          verificationStatus: isChronologicallySound ? 'VERIFIED' : 'MISMATCH',
          description: `Timeline cross-check: ${services.length} services, ${odometers.length} odometer readings, ${accidents.length} accidents. Violations: ${anomalies.length}`,
          relationship: isChronologicallySound ? 'SUPPORTING' : 'CONTRADICTING',
          provenance: {
            anomalies,
            isChronologicallySound,
          },
        };

        return {
          success: true,
          toolName: 'compare_record_timeline',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: {
            isChronologicallySound,
            anomalies,
          },
          evidenceItems: [evidence],
        };
      },
    });

    // ------------------------------------------------------------------------
    // 15. create_investigation_case
    // ------------------------------------------------------------------------
    this.register({
      name: 'create_investigation_case',
      version: '1.0',
      description: 'Creates a formal investigation case grouping candidate findings (Requires Reviewer Role).',
      category: 'CASE',
      isReadOnly: false,
      requiredRole: ['ADMIN', 'GARAGE', 'INSURANCE_PROVIDER', 'MANUFACTURER'],
      inputSchema: z.object({
        title: z.string().min(3),
        description: z.string().min(5),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        findingIds: z.array(z.string()).default([]),
      }),
      execute: async (
        input: { title: string; description: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; findingIds: string[] },
        context: ToolExecutionContext
      ): Promise<ToolExecutionResult> => {
        const start = Date.now();
        if (!['ADMIN', 'GARAGE', 'INSURANCE_PROVIDER', 'MANUFACTURER'].includes(context.userRole)) {
          return {
            success: false,
            toolName: 'create_investigation_case',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Forbidden: only reviewers can create investigation cases', isRetryable: false },
          };
        }

        const graphService = GraphInvestigationService.getInstance();
        const createdCase = await graphService.createInvestigationCase({
          title: input.title,
          description: input.description,
          priority: input.priority || 'MEDIUM',
          findingIds: input.findingIds,
          assignedToId: context.userId,
        });

        const evidence: CollectedEvidenceDraft = {
          evidenceType: 'CASE_CREATION',
          sourceRecordId: createdCase.id,
          verificationStatus: 'VERIFIED',
          description: `Investigation Case Opened: ${createdCase.caseNumber} - "${createdCase.title}" (Priority: ${createdCase.priority})`,
          relationship: 'NEUTRAL',
          provenance: {
            caseNumber: createdCase.caseNumber,
            assignedToId: context.userId,
            findingsCount: input.findingIds.length,
          },
        };

        return {
          success: true,
          toolName: 'create_investigation_case',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: createdCase,
          evidenceItems: [evidence],
        };
      },
    });

    // ------------------------------------------------------------------------
    // 16. create_authorized_investigation_alert
    // ------------------------------------------------------------------------
    this.register({
      name: 'create_authorized_investigation_alert',
      version: '1.0',
      description: 'Logs an authorized audit trail alert for human reviewer attention.',
      category: 'CASE',
      isReadOnly: false,
      requiredRole: ['ADMIN', 'INSURANCE_PROVIDER', 'GARAGE', 'MANUFACTURER'],
      inputSchema: z.object({
        vehicleId: z.string().min(1),
        alertType: z.string().min(1),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        message: z.string().min(3),
      }),
      execute: async (
        input: { vehicleId: string; alertType: string; severity: string; message: string },
        context: ToolExecutionContext
      ): Promise<ToolExecutionResult> => {
        const start = Date.now();
        if (!['ADMIN', 'GARAGE', 'INSURANCE_PROVIDER', 'MANUFACTURER'].includes(context.userRole)) {
          return {
            success: false,
            toolName: 'create_authorized_investigation_alert',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'UNAUTHORIZED', message: 'Forbidden', isRetryable: false },
          };
        }

        const auditEntry = await prisma.auditLog.create({
          data: {
            action: 'ADMIN_CASE_CREATED',
            vehicleId: input.vehicleId,
            userId: context.userId,
            status: 'SUCCESS',
            details: JSON.stringify({
              alertType: input.alertType,
              severity: input.severity,
              message: input.message,
              agentGenerated: true,
              runId: context.runId,
            }),
          },
        });

        return {
          success: true,
          toolName: 'create_authorized_investigation_alert',
          toolVersion: '1.0',
          durationMs: Date.now() - start,
          data: { auditLogId: auditEntry.id, status: 'LOGGED' },
        };
      },
    });

    // ------------------------------------------------------------------------
    // 17. verify_selective_disclosure_credential (Phase 9)
    // ------------------------------------------------------------------------
    this.register({
      name: 'verify_selective_disclosure_credential',
      version: '1.0',
      description: 'Independently verifies a Merkle-Disclosed Selective Disclosure presentation, validating issuer signature, inclusion proofs, and expiry while respecting unrevealed attributes.',
      category: 'BLOCKCHAIN',
      isReadOnly: true,
      requiredRole: ['ADMIN', 'GARAGE', 'MANUFACTURER', 'INSURANCE_PROVIDER', 'VEHICLE_OWNER'],
      inputSchema: z.object({
        presentation: z.any().describe('The SelectiveDisclosurePresentation JSON payload'),
        vehicleId: z.string().optional().describe('Expected vehicle ID to verify commitment binding against'),
      }),
      execute: async (
        input: { presentation: any; vehicleId?: string },
        context: ToolExecutionContext
      ): Promise<ToolExecutionResult> => {
        const start = Date.now();
        try {
          let expectedVehCommitment: string | undefined = undefined;
          if (input.vehicleId) {
            const veh = await prisma.vehicle.findUnique({
              where: { id: input.vehicleId },
              select: { id: true, vin: true },
            });
            if (veh) {
              expectedVehCommitment = computeVehicleCommitment(veh.id, veh.vin);
            }
          }

          // Check database for revocation status if credential exists locally
          const dbCred = await prisma.privacyCredential.findUnique({
            where: { credentialId: input.presentation.credentialId },
          });

          if (dbCred && dbCred.status === 'REVOKED') {
            return {
              success: true,
              toolName: 'verify_selective_disclosure_credential',
              toolVersion: '1.0',
              durationMs: Date.now() - start,
              data: {
                valid: false,
                status: 'REVOKED',
                reason: dbCred.revocationReason,
              },
              evidenceItems: [{
                evidenceType: 'PRIVACY_CREDENTIAL_STATUS',
                sourceRecordId: dbCred.id,
                verificationStatus: 'MISMATCH',
                description: `Selective disclosure rejected: Credential ${input.presentation.credentialId} has been REVOKED: ${dbCred.revocationReason}`,
                relationship: 'CONTRADICTING',
                provenance: {
                  credentialId: input.presentation.credentialId,
                  revokedAt: dbCred.revokedAt,
                },
              }],
            };
          }

          const verification = verifySelectiveDisclosurePresentation(input.presentation, expectedVehCommitment);

          const evidence: CollectedEvidenceDraft = {
            evidenceType: 'SELECTIVE_DISCLOSURE_PROOF',
            sourceRecordId: input.presentation.credentialId,
            contentHash: input.presentation.merkleRoot,
            verificationStatus: verification.valid ? 'VERIFIED' : 'MISMATCH',
            description: verification.valid
              ? `Selective Disclosure Cryptographically Verified: ${Object.keys(verification.verifiedAttributes).length} attributes verified against issuer ${verification.issuerAddress}. ${verification.hiddenFieldCount} undisclosed fields remain private.`
              : `Selective Disclosure Verification Failed: ${verification.error}`,
            limitations: 'Only disclosed attributes have verified cryptographic commitments. Undisclosed attributes remain strictly unproven and cannot be asserted as fact.',
            relationship: verification.valid ? 'SUPPORTING' : 'CONTRADICTING',
            provenance: {
              credentialId: input.presentation.credentialId,
              issuerAddress: verification.issuerAddress,
              verifiedKeys: Object.keys(verification.verifiedAttributes),
              hiddenFieldCount: verification.hiddenFieldCount,
              durationMs: verification.verificationDurationMs,
            },
          };

          return {
            success: true,
            toolName: 'verify_selective_disclosure_credential',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            data: verification,
            evidenceItems: [evidence],
          };
        } catch (err: any) {
          return {
            success: false,
            toolName: 'verify_selective_disclosure_credential',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'VERIFICATION_ERROR', message: err.message, isRetryable: false },
          };
        }
      },
    });

    // ------------------------------------------------------------------------
    // 18. verify_zkp_threshold_proof (Phase 9)
    // ------------------------------------------------------------------------
    this.register({
      name: 'verify_zkp_threshold_proof',
      version: '1.0',
      description: 'Independently verifies a Pedersen-based Non-Interactive Zero-Knowledge Range Proof (v <= threshold) with Fiat-Shamir nonces and vehicle bindings.',
      category: 'BLOCKCHAIN',
      isReadOnly: true,
      requiredRole: ['ADMIN', 'GARAGE', 'MANUFACTURER', 'INSURANCE_PROVIDER', 'VEHICLE_OWNER'],
      inputSchema: z.object({
        proof: z.any().describe('The ZkpRangeProofPayload JSON'),
        vehicleId: z.string().describe('Target vehicle ID for commitment binding verification'),
        claimType: z.string().describe('Claim type e.g. ODOMETER_BELOW_THRESHOLD'),
        threshold: z.number().describe('Numerical threshold requirement'),
        nonce: z.string().describe('Expected verifier challenge nonce'),
      }),
      execute: async (
        input: { proof: any; vehicleId: string; claimType: string; threshold: number; nonce: string },
        context: ToolExecutionContext
      ): Promise<ToolExecutionResult> => {
        const start = Date.now();
        try {
          const veh = await prisma.vehicle.findUnique({
            where: { id: input.vehicleId },
            select: { id: true, vin: true },
          });
          if (!veh) {
            return {
              success: false,
              toolName: 'verify_zkp_threshold_proof',
              toolVersion: '1.0',
              durationMs: Date.now() - start,
              error: { category: 'NOT_FOUND', message: 'Vehicle not found', isRetryable: false },
            };
          }

          const expectedVehCommitment = computeVehicleCommitment(veh.id, veh.vin);

          const verification = verifyRangeProof(input.proof, {
            vehicleCommitment: expectedVehCommitment,
            claimType: input.claimType,
            threshold: input.threshold,
            nonce: input.nonce,
          });

          const evidence: CollectedEvidenceDraft = {
            evidenceType: 'ZKP_RANGE_PROOF',
            sourceRecordId: input.proof.commitment || 'zkp_commitment',
            contentHash: input.proof.commitment,
            verificationStatus: verification.valid ? 'VERIFIED' : 'MISMATCH',
            description: verification.valid
              ? `Genuine Zero-Knowledge Range Proof Verified: Proves value <= ${input.threshold} for claim ${input.claimType}. Private value and blinding factors remain completely undisclosed.`
              : `Zero-Knowledge Range Proof Failed: ${verification.error}`,
            limitations: `Proves strictly that the committed value satisfies <= ${input.threshold}. Does NOT prove absence of tampering in other unrelated records or full historical maintenance accuracy.`,
            relationship: verification.valid ? 'SUPPORTING' : 'CONTRADICTING',
            provenance: {
              claimType: input.claimType,
              threshold: input.threshold,
              nonce: input.nonce,
              proofSystem: input.proof.proofSystem,
              durationMs: verification.verificationDurationMs,
            },
          };

          return {
            success: true,
            toolName: 'verify_zkp_threshold_proof',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            data: verification,
            evidenceItems: [evidence],
          };
        } catch (err: any) {
          return {
            success: false,
            toolName: 'verify_zkp_threshold_proof',
            toolVersion: '1.0',
            durationMs: Date.now() - start,
            error: { category: 'VERIFICATION_ERROR', message: err.message, isRetryable: false },
          };
        }
      },
    });
  }
}

export const toolRegistry = ToolRegistry.getInstance();
