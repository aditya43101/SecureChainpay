import { ethers } from 'ethers';
import { prisma } from '../../lib/prisma';
import { BlockchainService } from './blockchainService';
import {
  buildMerkleTree,
  computeLeafHash,
  verifyInclusionProof,
  computeBatchMetadataHash,
  MerkleRecordInput,
  ProofStep,
  MERKLE_ALGORITHM_VERSION,
  MERKLE_HASH_ALGORITHM,
  MERKLE_LEAF_ENCODING_VERSION,
  MERKLE_ODD_NODE_CONVENTION,
} from './merkleService';
import {
  generateServiceRecordHash,
  generateOdometerRecordHash,
  generateAccidentRecordHash,
  generateInsuranceRecordHash,
  generateDocumentRecordHash,
  generateOwnershipRecordHash,
  generateManufacturerCertificateHash,
  generateBatteryEventHash,
  generateInsuranceClaimHash,
} from '../utils/canonicalHash';
import {
  MerkleBatchStatus,
  BlockchainStatus,
  OwnershipTransferType,
} from '@prisma/client';

export interface EligibleRecordItem {
  recordId: string;
  recordType: string;
  vehicleId: string | null;
  recordHash: string;
  createdAt: Date;
  sourceTable: string;
}

export interface BatchCreationParams {
  recordIds?: string[];
  vehicleId?: string;
  maxRecords?: number;
  createdByUserId?: string;
  autoSubmit?: boolean;
}

export interface RecordVerificationReport {
  recordId: string;
  recordType: string;
  vehicleId?: string | null;
  anchoringMode: 'BATCH_MERKLE' | 'LEGACY_INDIVIDUAL' | 'UNANCHORED';
  overallStatus:
    | 'VERIFIED'
    | 'TAMPER_DETECTED'
    | 'PENDING'
    | 'INVALID_PROOF'
    | 'ROOT_MISMATCH'
    | 'RECORD_HASH_MISMATCH'
    | 'BATCH_NOT_CONFIRMED'
    | 'BLOCKCHAIN_UNAVAILABLE';
  recordHashStatus: 'MATCH' | 'MISMATCH';
  proofStatus?: 'VALID' | 'INVALID' | 'NOT_APPLICABLE';
  databaseRootStatus?: 'MATCH' | 'MISMATCH' | 'NOT_APPLICABLE';
  blockchainRootStatus?: 'MATCH' | 'MISMATCH' | 'NOT_ANCHORED' | 'NOT_APPLICABLE';
  batchIdentifier?: string;
  batchStatus?: string;
  algorithmVersion?: string;
  leafIndex?: number;
  leafCount?: number;
  calculatedHash: string;
  expectedHash: string;
  leafHash?: string;
  calculatedRoot?: string;
  databaseRoot?: string;
  onChainRoot?: string;
  transactionHash?: string | null;
  blockNumber?: number | null;
  proofSteps?: ProofStep[];
  evidence: Array<{ key: string; value: any; status: 'VALID' | 'WARNING' | 'ERROR' }>;
  verifiedAt: string;
}

export class BatchOrchestrationService {
  private static instance: BatchOrchestrationService;
  private blockchainService: BlockchainService;

  private constructor() {
    this.blockchainService = BlockchainService.getInstance();
  }

  public static getInstance(): BatchOrchestrationService {
    if (!BatchOrchestrationService.instance) {
      BatchOrchestrationService.instance = new BatchOrchestrationService();
    }
    return BatchOrchestrationService.instance;
  }

  /**
   * Generates next human-readable batch identifier: BATCH-YYYY-XXXXXX
   */
  public async generateNextBatchIdentifier(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.merkleBatch.count();
    let nextNum = count + 1;
    let identifier = `BATCH-${year}-${String(nextNum).padStart(6, '0')}`;

    while (true) {
      const dbExists = await prisma.merkleBatch.findUnique({ where: { batchIdentifier: identifier } });
      if (dbExists) {
        nextNum++;
        identifier = `BATCH-${year}-${String(nextNum).padStart(6, '0')}`;
        continue;
      }
      const hex = ethers.keccak256(ethers.toUtf8Bytes(identifier));
      const onChainExists = await this.blockchainService.isBatchAnchoredOnChain(hex).catch(() => false);
      if (onChainExists) {
        nextNum++;
        identifier = `BATCH-${year}-${String(nextNum).padStart(6, '0')}`;
        continue;
      }
      break;
    }

    return identifier;
  }

  /**
   * Recomputes canonical hash for a record to ensure source record consistency
   */
  public async recomputeRecordHash(recordId: string, recordType: string): Promise<string | null> {
    const normType = recordType.trim().toUpperCase();

    switch (normType) {
      case 'SERVICE': {
        const s = await prisma.serviceRecord.findUnique({
          where: { id: recordId },
          include: { vehicle: true, garage: true },
        });
        if (!s || !s.vehicle.blockchainVehicleId || !s.garage.blockchainUserId) return null;
        return generateServiceRecordHash({
          blockchainVehicleId: s.vehicle.blockchainVehicleId,
          garageBlockchainId: s.garage.blockchainUserId,
          serviceDate: s.serviceDate,
          mileage: s.mileage,
          serviceType: s.serviceType,
          description: s.description,
          partsReplaced: s.partsReplaced,
          cost: s.cost,
        });
      }
      case 'ODOMETER': {
        const o = await prisma.odometerRecord.findUnique({
          where: { id: recordId },
          include: { vehicle: true },
        });
        if (!o || !o.vehicle.blockchainVehicleId) return null;
        return generateOdometerRecordHash({
          blockchainVehicleId: o.vehicle.blockchainVehicleId,
          mileage: o.mileage,
          recordedAt: o.recordedAt,
          sourceType: o.sourceType,
        });
      }
      case 'ACCIDENT': {
        const a = await prisma.accidentRecord.findUnique({
          where: { id: recordId },
          include: { vehicle: true },
        });
        if (!a || !a.vehicle.blockchainVehicleId) return null;
        return generateAccidentRecordHash({
          blockchainVehicleId: a.vehicle.blockchainVehicleId,
          accidentDate: a.accidentDate,
          severity: a.severity,
          description: a.description,
          damagedParts: a.damagedParts,
          repairStatus: a.repairStatus,
        });
      }
      case 'INSURANCE': {
        const ins = await prisma.insuranceRecord.findUnique({
          where: { id: recordId },
          include: { vehicle: true, provider: true },
        });
        if (!ins || !ins.vehicle.blockchainVehicleId || !ins.provider.blockchainUserId) return null;
        return generateInsuranceRecordHash({
          blockchainVehicleId: ins.vehicle.blockchainVehicleId,
          providerBlockchainId: ins.provider.blockchainUserId,
          policyReference: ins.policyReference,
          startDate: ins.startDate,
          endDate: ins.endDate,
          coverageType: ins.coverageType,
        });
      }
      case 'DOCUMENT': {
        const doc = await prisma.vehicleDocument.findUnique({
          where: { id: recordId },
          include: { vehicle: true },
        });
        if (!doc || !doc.vehicle.blockchainVehicleId) return null;
        return generateDocumentRecordHash({
          blockchainVehicleId: doc.vehicle.blockchainVehicleId,
          documentType: doc.documentType,
          fileHash: doc.fileHash,
          title: doc.title,
        });
      }
      case 'OWNERSHIP_TRANSFERRED':
      case 'OWNERSHIP': {
        const own = await prisma.ownershipHistory.findUnique({
          where: { id: recordId },
          include: { vehicle: true, previousOwner: true, newOwner: true },
        });
        if (!own || !own.vehicle.blockchainVehicleId) return null;
        if (own.transferType === OwnershipTransferType.INITIAL_REGISTRATION) {
          return own.recordHash;
        }
        return generateOwnershipRecordHash({
          blockchainVehicleId: own.vehicle.blockchainVehicleId,
          previousOwnerBlockchainId: own.previousOwner?.blockchainUserId || 'GENESIS',
          newOwnerBlockchainId: own.newOwner?.blockchainUserId || 'UNKNOWN',
          transferType: own.transferType,
          transferDate: own.transferDate,
        });
      }
      case 'MANUFACTURER_CERTIFICATE': {
        const cert = await prisma.manufacturerCertificate.findUnique({
          where: { id: recordId },
          include: { vehicle: true },
        });
        if (!cert || !cert.vehicle.blockchainVehicleId) return null;
        return generateManufacturerCertificateHash({
          blockchainVehicleId: cert.vehicle.blockchainVehicleId,
          certificateNumber: cert.certificateNumber,
          manufacturingDate: cert.manufacturingDate,
          manufacturingPlant: cert.manufacturingPlant,
          initialOdometer: cert.initialOdometer,
        });
      }
      case 'BATTERY_EVENT': {
        const be = await prisma.batteryLifecycleEvent.findUnique({
          where: { id: recordId },
          include: { batteryPassport: { include: { vehicle: true } } },
        });
        if (!be || !be.batteryPassport.vehicle.blockchainVehicleId) return null;
        return generateBatteryEventHash({
          blockchainVehicleId: be.batteryPassport.vehicle.blockchainVehicleId,
          batterySerial: be.batteryPassport.batterySerial,
          eventType: be.eventType,
          eventDate: be.eventDate,
          capacityKwh: be.capacityKwh,
          sohPercentage: be.sohPercentage,
        });
      }
      case 'INSURANCE_CLAIM': {
        const claim = await prisma.insuranceClaimRecord.findUnique({
          where: { id: recordId },
          include: { insuranceRecord: { include: { vehicle: true } } },
        });
        if (!claim || !claim.insuranceRecord.vehicle.blockchainVehicleId) return null;
        return generateInsuranceClaimHash({
          blockchainVehicleId: claim.insuranceRecord.vehicle.blockchainVehicleId,
          claimNumber: claim.claimNumber,
          claimDate: claim.claimDate,
          claimAmount: claim.claimAmount,
          claimStatus: claim.claimStatus,
        });
      }
      default:
        return null;
    }
  }

  /**
   * Finds records eligible for batch anchoring
   */
  public async getEligibleRecords(params?: {
    vehicleId?: string;
    recordType?: string;
    limit?: number;
  }): Promise<EligibleRecordItem[]> {
    const limit = params?.limit || 100;
    const vehicleFilter = params?.vehicleId ? { vehicleId: params.vehicleId } : {};

    // Get all record IDs already batched in non-failed batches
    const batchedRecords = await prisma.merkleBatchRecord.findMany({
      where: {
        batch: {
          status: {
            in: [
              MerkleBatchStatus.CREATED,
              MerkleBatchStatus.BUILDING,
              MerkleBatchStatus.READY,
              MerkleBatchStatus.SUBMITTING,
              MerkleBatchStatus.PENDING_CONFIRMATION,
              MerkleBatchStatus.CONFIRMED,
            ],
          },
        },
      },
      select: { recordId: true },
    });
    const batchedIdSet = new Set(batchedRecords.map((r) => r.recordId));

    const eligible: EligibleRecordItem[] = [];

    // 1. Service Records
    const services = await prisma.serviceRecord.findMany({
      where: { ...vehicleFilter },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    for (const s of services) {
      if (!batchedIdSet.has(s.id) && s.recordHash) {
        eligible.push({
          recordId: s.id,
          recordType: 'SERVICE',
          vehicleId: s.vehicleId,
          recordHash: s.recordHash,
          createdAt: s.createdAt,
          sourceTable: 'ServiceRecord',
        });
      }
    }

    // 2. Odometer Records
    const odometers = await prisma.odometerRecord.findMany({
      where: { ...vehicleFilter },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    for (const o of odometers) {
      if (!batchedIdSet.has(o.id) && o.recordHash) {
        eligible.push({
          recordId: o.id,
          recordType: 'ODOMETER',
          vehicleId: o.vehicleId,
          recordHash: o.recordHash,
          createdAt: o.createdAt,
          sourceTable: 'OdometerRecord',
        });
      }
    }

    // 3. Accident Records
    const accidents = await prisma.accidentRecord.findMany({
      where: { ...vehicleFilter },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    for (const a of accidents) {
      if (!batchedIdSet.has(a.id) && a.recordHash) {
        eligible.push({
          recordId: a.id,
          recordType: 'ACCIDENT',
          vehicleId: a.vehicleId,
          recordHash: a.recordHash,
          createdAt: a.createdAt,
          sourceTable: 'AccidentRecord',
        });
      }
    }

    // 4. Insurance Records
    const insurances = await prisma.insuranceRecord.findMany({
      where: { ...vehicleFilter },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    for (const ins of insurances) {
      if (!batchedIdSet.has(ins.id) && ins.recordHash) {
        eligible.push({
          recordId: ins.id,
          recordType: 'INSURANCE',
          vehicleId: ins.vehicleId,
          recordHash: ins.recordHash,
          createdAt: ins.createdAt,
          sourceTable: 'InsuranceRecord',
        });
      }
    }

    // 5. Vehicle Documents
    const documents = await prisma.vehicleDocument.findMany({
      where: { ...vehicleFilter },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    for (const doc of documents) {
      if (!batchedIdSet.has(doc.id) && doc.recordHash) {
        eligible.push({
          recordId: doc.id,
          recordType: 'DOCUMENT',
          vehicleId: doc.vehicleId,
          recordHash: doc.recordHash,
          createdAt: doc.createdAt,
          sourceTable: 'VehicleDocument',
        });
      }
    }

    // Filter by recordType if requested
    const filtered = params?.recordType
      ? eligible.filter((r) => r.recordType.toUpperCase() === params.recordType!.toUpperCase())
      : eligible;

    return filtered.slice(0, limit);
  }

  /**
   * Creates, persists, and optionally submits a Merkle batch
   */
  public async createBatch(params: BatchCreationParams) {
    const autoSubmit = params.autoSubmit !== false;
    let recordsToBatch: MerkleRecordInput[] = [];

    if (params.recordIds && params.recordIds.length > 0) {
      // Specified record IDs
      const uniqueIds = Array.from(new Set(params.recordIds));
      for (const id of uniqueIds) {
        // Find record in DB
        const s = await prisma.serviceRecord.findUnique({ where: { id } });
        if (s) {
          recordsToBatch.push({ recordId: s.id, recordType: 'SERVICE', recordHash: s.recordHash, vehicleId: s.vehicleId });
          continue;
        }
        const o = await prisma.odometerRecord.findUnique({ where: { id } });
        if (o) {
          recordsToBatch.push({ recordId: o.id, recordType: 'ODOMETER', recordHash: o.recordHash, vehicleId: o.vehicleId });
          continue;
        }
        const a = await prisma.accidentRecord.findUnique({ where: { id } });
        if (a) {
          recordsToBatch.push({ recordId: a.id, recordType: 'ACCIDENT', recordHash: a.recordHash, vehicleId: a.vehicleId });
          continue;
        }
        const ins = await prisma.insuranceRecord.findUnique({ where: { id } });
        if (ins) {
          recordsToBatch.push({ recordId: ins.id, recordType: 'INSURANCE', recordHash: ins.recordHash, vehicleId: ins.vehicleId });
          continue;
        }
        const doc = await prisma.vehicleDocument.findUnique({ where: { id } });
        if (doc) {
          recordsToBatch.push({ recordId: doc.id, recordType: 'DOCUMENT', recordHash: doc.recordHash, vehicleId: doc.vehicleId });
          continue;
        }
        const own = await prisma.ownershipHistory.findUnique({ where: { id } });
        if (own) {
          recordsToBatch.push({ recordId: own.id, recordType: 'OWNERSHIP_TRANSFERRED', recordHash: own.recordHash, vehicleId: own.vehicleId });
          continue;
        }
        const cert = await prisma.manufacturerCertificate.findUnique({ where: { id } });
        if (cert) {
          recordsToBatch.push({ recordId: cert.id, recordType: 'MANUFACTURER_CERTIFICATE', recordHash: cert.recordHash, vehicleId: cert.vehicleId });
          continue;
        }
        const be = await prisma.batteryLifecycleEvent.findUnique({ where: { id }, include: { batteryPassport: true } });
        if (be && be.recordHash) {
          recordsToBatch.push({ recordId: be.id, recordType: 'BATTERY_EVENT', recordHash: be.recordHash, vehicleId: be.batteryPassport.vehicleId });
          continue;
        }
        const claim = await prisma.insuranceClaimRecord.findUnique({ where: { id }, include: { insuranceRecord: true } });
        if (claim) {
          recordsToBatch.push({ recordId: claim.id, recordType: 'INSURANCE_CLAIM', recordHash: claim.recordHash, vehicleId: claim.insuranceRecord.vehicleId });
          continue;
        }
      }
    } else {
      // Pick eligible records
      const eligible = await this.getEligibleRecords({
        vehicleId: params.vehicleId,
        limit: params.maxRecords || 50,
      });
      recordsToBatch = eligible.map((e) => ({
        recordId: e.recordId,
        recordType: e.recordType,
        recordHash: e.recordHash,
        vehicleId: e.vehicleId,
      }));
    }

    if (recordsToBatch.length === 0) {
      throw new Error('No eligible records available to create a Merkle batch');
    }

    // Check if any of these records are already in an active batch (Concurrency check)
    const existingActive = await prisma.merkleBatchRecord.findFirst({
      where: {
        recordId: { in: recordsToBatch.map((r) => r.recordId) },
        batch: {
          status: {
            in: [
              MerkleBatchStatus.CREATED,
              MerkleBatchStatus.BUILDING,
              MerkleBatchStatus.READY,
              MerkleBatchStatus.SUBMITTING,
              MerkleBatchStatus.PENDING_CONFIRMATION,
              MerkleBatchStatus.CONFIRMED,
            ],
          },
        },
      },
    });

    if (existingActive) {
      throw new Error(
        `Record '${existingActive.recordId}' is already assigned to active batch '${existingActive.batchId}'`
      );
    }

    // Build Merkle Tree
    const batchIdentifier = await this.generateNextBatchIdentifier();
    const batchIdHex = ethers.keccak256(ethers.toUtf8Bytes(batchIdentifier));
    const tree = buildMerkleTree(recordsToBatch);
    const metadataHash = computeBatchMetadataHash(batchIdentifier, tree.leafCount, Date.now());

    // Atomic Database Persistence
    const createdBatch = await prisma.$transaction(async (tx) => {
      const batch = await tx.merkleBatch.create({
        data: {
          batchIdentifier,
          batchIdHex,
          merkleRoot: tree.root,
          leafCount: tree.leafCount,
          algorithmVersion: MERKLE_ALGORITHM_VERSION,
          hashAlgorithm: MERKLE_HASH_ALGORITHM,
          leafEncodingVersion: MERKLE_LEAF_ENCODING_VERSION,
          oddNodeConvention: MERKLE_ODD_NODE_CONVENTION,
          status: autoSubmit ? MerkleBatchStatus.SUBMITTING : MerkleBatchStatus.READY,
          networkChainId: 31337,
          metadataHash,
          createdByUserId: params.createdByUserId || null,
          submittedAt: autoSubmit ? new Date() : null,
        },
      });

      // Insert batch records
      for (const leaf of tree.leaves) {
        const proof = tree.proofs[leaf.recordId] || [];
        await tx.merkleBatchRecord.create({
          data: {
            batchId: batch.id,
            recordId: leaf.recordId,
            recordType: leaf.recordType,
            vehicleId: leaf.vehicleId,
            recordHashSnapshot: leaf.recordHash,
            leafHash: leaf.leafHash,
            leafIndex: leaf.leafIndex,
            proof: JSON.stringify(proof),
          },
        });

        // Update or create BlockchainRecord tracking entry
        await tx.blockchainRecord.create({
          data: {
            vehicleId: leaf.vehicleId,
            userId: params.createdByUserId || null,
            recordType: `BATCH_${leaf.recordType}`,
            recordHash: leaf.recordHash,
            blockchainTxHash: '0x_pending_batch',
            blockNumber: 0,
            blockchainNetwork: 'hardhat-local',
            status: BlockchainStatus.PENDING,
            anchoringMode: 'BATCH',
            batchId: batch.id,
            merkleRoot: tree.root,
            leafHash: leaf.leafHash,
          },
        });
      }

      return batch;
    });

    // If autoSubmit, submit on-chain
    if (autoSubmit) {
      try {
        const onChainRes = await this.blockchainService.anchorMerkleBatch({
          batchIdHex,
          merkleRoot: tree.root,
          leafCount: tree.leafCount,
          metadataHash,
        });

        // Mark CONFIRMED
        const confirmedBatch = await prisma.$transaction(async (tx) => {
          const updated = await tx.merkleBatch.update({
            where: { id: createdBatch.id },
            data: {
              status: MerkleBatchStatus.CONFIRMED,
              transactionHash: onChainRes.txHash,
              blockNumber: onChainRes.blockNumber,
              blockHash: onChainRes.blockHash,
              confirmedAt: new Date(),
            },
            include: { records: true },
          });

          // Update associated BlockchainRecords
          await tx.blockchainRecord.updateMany({
            where: { batchId: createdBatch.id },
            data: {
              blockchainTxHash: onChainRes.txHash,
              blockNumber: onChainRes.blockNumber,
              status: BlockchainStatus.CONFIRMED,
              confirmedAt: new Date(),
            },
          });

          return updated;
        });

        return confirmedBatch;
      } catch (err: any) {
        console.error(`[BATCH SUBMISSION WARNING] Failed to anchor batch ${batchIdentifier}:`, err.message);

        // Mark as PENDING_CONFIRMATION or RETRYABLE so reconciliation can recover
        const pendingBatch = await prisma.merkleBatch.update({
          where: { id: createdBatch.id },
          data: {
            status: MerkleBatchStatus.PENDING_CONFIRMATION,
            lastErrorCode: 'SUBMISSION_ERROR',
            lastErrorMessage: err.message,
          },
          include: { records: true },
        });

        return pendingBatch;
      }
    }

    return await prisma.merkleBatch.findUnique({
      where: { id: createdBatch.id },
      include: { records: true },
    });
  }

  /**
   * Retrieves batch details and associated record commitments
   */
  public async getBatchById(batchIdOrIdentifier: string) {
    const batch = await prisma.merkleBatch.findFirst({
      where: {
        OR: [
          { id: batchIdOrIdentifier },
          { batchIdentifier: batchIdOrIdentifier },
          { batchIdHex: batchIdOrIdentifier.toLowerCase() },
        ],
      },
      include: {
        records: {
          orderBy: { leafIndex: 'asc' },
        },
        createdByUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return batch;
  }

  /**
   * Lists batches with pagination and status filters
   */
  public async listBatches(params?: {
    status?: MerkleBatchStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.status) {
      where.status = params.status;
    }
    if (params?.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { batchIdentifier: { contains: q, mode: 'insensitive' } },
        { merkleRoot: { contains: q, mode: 'insensitive' } },
        { transactionHash: { contains: q, mode: 'insensitive' } },
        { batchIdHex: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, batches, stats] = await Promise.all([
      prisma.merkleBatch.count({ where }),
      prisma.merkleBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          records: {
            select: { id: true, recordId: true, recordType: true, leafIndex: true },
          },
          createdByUser: {
            select: { id: true, name: true, role: true },
          },
        },
      }),
      prisma.merkleBatch.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { leafCount: true },
      }),
    ]);

    let totalConfirmedBatches = 0;
    let totalPendingBatches = 0;
    let totalFailedBatches = 0;
    let totalCommittedRecords = 0;

    for (const s of stats) {
      if (s.status === MerkleBatchStatus.CONFIRMED) {
        totalConfirmedBatches += s._count._all;
        totalCommittedRecords += s._sum.leafCount || 0;
      } else if (
        s.status === MerkleBatchStatus.PENDING_CONFIRMATION ||
        s.status === MerkleBatchStatus.SUBMITTING ||
        s.status === MerkleBatchStatus.READY ||
        s.status === MerkleBatchStatus.BUILDING ||
        s.status === MerkleBatchStatus.CREATED
      ) {
        totalPendingBatches += s._count._all;
      } else if (
        s.status === MerkleBatchStatus.FAILED ||
        s.status === MerkleBatchStatus.RECONCILIATION_REQUIRED
      ) {
        totalFailedBatches += s._count._all;
      }
    }

    return {
      batches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        totalBatches: total,
        confirmedBatches: totalConfirmedBatches,
        pendingBatches: totalPendingBatches,
        failedBatches: totalFailedBatches,
        totalCommittedRecords,
      },
    };
  }

  /**
   * Retrieves inclusion proof for an individual record in a batch
   */
  public async getRecordInclusionProof(batchId: string, recordId: string) {
    const batch = await this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch '${batchId}' not found`);
    }

    const record = batch.records.find((r) => r.recordId === recordId);
    if (!record) {
      throw new Error(`Record '${recordId}' not found in batch '${batch.batchIdentifier}'`);
    }

    let parsedProof: string[] = [];
    try {
      parsedProof = JSON.parse(record.proof);
    } catch {
      parsedProof = [];
    }

    // Check on-chain batch state
    const onChainActive = await this.blockchainService.isBatchAnchoredOnChain(batch.batchIdHex);
    let onChainBatch: any = null;
    if (onChainActive) {
      onChainBatch = await this.blockchainService.getOnChainBatch(batch.batchIdHex).catch(() => null);
    }

    // Verify proof locally
    const verification = verifyInclusionProof(record.leafHash, parsedProof, batch.merkleRoot);

    return {
      batchIdentifier: batch.batchIdentifier,
      batchIdHex: batch.batchIdHex,
      recordId: record.recordId,
      recordType: record.recordType,
      vehicleId: record.vehicleId,
      leafHash: record.leafHash,
      leafIndex: record.leafIndex,
      leafCount: batch.leafCount,
      recordHashSnapshot: record.recordHashSnapshot,
      merkleRoot: batch.merkleRoot,
      proof: parsedProof,
      proofVerification: verification,
      status: batch.status,
      transactionHash: batch.transactionHash,
      blockNumber: batch.blockNumber,
      onChain: {
        isAnchored: onChainActive,
        onChainRoot: onChainBatch?.merkleRoot || null,
        actorAddress: onChainBatch?.actorAddress || null,
        anchoredAt: onChainBatch?.timestamp ? Number(onChainBatch.timestamp) : null,
      },
    };
  }

  /**
   * Safe, idempotent reconciliation for stuck or pending batches
   */
  public async reconcileBatch(batchIdOrIdentifier: string) {
    const batch = await this.getBatchById(batchIdOrIdentifier);
    if (!batch) {
      throw new Error(`Batch '${batchIdOrIdentifier}' not found`);
    }

    const onChainStatus = await this.blockchainService.reconcileBatchOnChain(
      batch.batchIdHex,
      batch.transactionHash
    );

    if (onChainStatus.isAnchored && onChainStatus.onChainRoot) {
      const rootMatches =
        onChainStatus.onChainRoot.toLowerCase() === batch.merkleRoot.toLowerCase();

      if (!rootMatches) {
        await prisma.merkleBatch.update({
          where: { id: batch.id },
          data: {
            status: MerkleBatchStatus.RECONCILIATION_REQUIRED,
            lastErrorCode: 'ROOT_MISMATCH',
            lastErrorMessage: `On-chain root '${onChainStatus.onChainRoot}' does not match expected '${batch.merkleRoot}'`,
          },
        });
        return {
          reconciled: false,
          status: MerkleBatchStatus.RECONCILIATION_REQUIRED,
          error: 'On-chain root mismatch',
        };
      }

      // Safe update to CONFIRMED
      const blockNum = onChainStatus.receipt?.blockNumber ? Number(onChainStatus.receipt.blockNumber) : batch.blockNumber || 1;
      const blockHash = onChainStatus.receipt?.blockHash || batch.blockHash;
      const txHash = onChainStatus.receipt?.hash || batch.transactionHash || '0x_onchain_confirmed';

      await prisma.$transaction([
        prisma.merkleBatch.update({
          where: { id: batch.id },
          data: {
            status: MerkleBatchStatus.CONFIRMED,
            transactionHash: txHash,
            blockNumber: blockNum,
            blockHash,
            confirmedAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        }),
        prisma.blockchainRecord.updateMany({
          where: { batchId: batch.id },
          data: {
            blockchainTxHash: txHash,
            blockNumber: blockNum,
            status: BlockchainStatus.CONFIRMED,
            confirmedAt: new Date(),
          },
        }),
      ]);

      return {
        reconciled: true,
        status: MerkleBatchStatus.CONFIRMED,
        transactionHash: txHash,
        blockNumber: blockNum,
      };
    }

    // If transaction failed or reverted, check if we can retry
    if (onChainStatus.error && onChainStatus.error.includes('reverted')) {
      const newRetryCount = batch.retryCount + 1;
      const nextStatus = newRetryCount <= 3 ? MerkleBatchStatus.RETRYABLE : MerkleBatchStatus.FAILED;

      await prisma.merkleBatch.update({
        where: { id: batch.id },
        data: {
          status: nextStatus,
          retryCount: newRetryCount,
          lastErrorCode: 'TRANSACTION_REVERTED',
          lastErrorMessage: onChainStatus.error,
          failedAt: nextStatus === MerkleBatchStatus.FAILED ? new Date() : null,
        },
      });

      return {
        reconciled: false,
        status: nextStatus,
        error: onChainStatus.error,
        retryCount: newRetryCount,
      };
    }

    // Try resubmission if batch is RETRYABLE or PENDING_CONFIRMATION
    if (
      batch.status === MerkleBatchStatus.RETRYABLE ||
      batch.status === MerkleBatchStatus.PENDING_CONFIRMATION ||
      batch.status === MerkleBatchStatus.READY
    ) {
      try {
        const metadataHash = batch.metadataHash || computeBatchMetadataHash(batch.batchIdentifier, batch.leafCount);
        const anchorRes = await this.blockchainService.anchorMerkleBatch({
          batchIdHex: batch.batchIdHex,
          merkleRoot: batch.merkleRoot,
          leafCount: batch.leafCount,
          metadataHash,
        });

        await prisma.$transaction([
          prisma.merkleBatch.update({
            where: { id: batch.id },
            data: {
              status: MerkleBatchStatus.CONFIRMED,
              transactionHash: anchorRes.txHash,
              blockNumber: anchorRes.blockNumber,
              blockHash: anchorRes.blockHash,
              confirmedAt: new Date(),
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          }),
          prisma.blockchainRecord.updateMany({
            where: { batchId: batch.id },
            data: {
              blockchainTxHash: anchorRes.txHash,
              blockNumber: anchorRes.blockNumber,
              status: BlockchainStatus.CONFIRMED,
              confirmedAt: new Date(),
            },
          }),
        ]);

        return {
          reconciled: true,
          status: MerkleBatchStatus.CONFIRMED,
          transactionHash: anchorRes.txHash,
          blockNumber: anchorRes.blockNumber,
        };
      } catch (submitErr: any) {
        await prisma.merkleBatch.update({
          where: { id: batch.id },
          data: {
            retryCount: batch.retryCount + 1,
            lastErrorCode: 'RETRY_SUBMISSION_FAILED',
            lastErrorMessage: submitErr.message,
          },
        });
        return {
          reconciled: false,
          status: batch.status,
          error: submitErr.message,
        };
      }
    }

    return {
      reconciled: false,
      status: batch.status,
      message: 'Batch is not currently anchored on-chain and not marked retryable',
    };
  }

  /**
   * End-to-end individual record verification against both Merkle proof and on-chain root
   */
  public async verifyRecord(recordId: string, recordType: string): Promise<RecordVerificationReport> {
    const verifiedAt = new Date().toISOString();
    const evidence: Array<{ key: string; value: any; status: 'VALID' | 'WARNING' | 'ERROR' }> = [];

    // 1. Fetch batch record association
    const batchRecord = await prisma.merkleBatchRecord.findFirst({
      where: { recordId },
      include: { batch: true },
    });

    // 2. Recompute current canonical record hash from live DB fields
    const effectiveRecordType = batchRecord?.recordType || recordType;
    const currentCalculatedHash = await this.recomputeRecordHash(recordId, effectiveRecordType);

    if (!batchRecord) {
      // Check legacy individual anchoring
      const legacyRecord = await prisma.blockchainRecord.findFirst({
        where: { recordHash: currentCalculatedHash || undefined },
      });

      if (legacyRecord) {
        return {
          recordId,
          recordType,
          vehicleId: legacyRecord.vehicleId,
          anchoringMode: 'LEGACY_INDIVIDUAL',
          overallStatus: 'VERIFIED',
          recordHashStatus: 'MATCH',
          calculatedHash: currentCalculatedHash || legacyRecord.recordHash,
          expectedHash: legacyRecord.recordHash,
          transactionHash: legacyRecord.blockchainTxHash,
          blockNumber: legacyRecord.blockNumber,
          evidence: [
            { key: 'Anchoring Mode', value: 'Legacy Individual On-Chain Anchor', status: 'VALID' },
            { key: 'Transaction Hash', value: legacyRecord.blockchainTxHash, status: 'VALID' },
          ],
          verifiedAt,
        };
      }

      return {
        recordId,
        recordType,
        anchoringMode: 'UNANCHORED',
        overallStatus: 'PENDING',
        recordHashStatus: currentCalculatedHash ? 'MATCH' : 'MISMATCH',
        calculatedHash: currentCalculatedHash || 'UNKNOWN',
        expectedHash: 'UNCOMMITTED',
        evidence: [{ key: 'Status', value: 'Record is not currently anchored in a batch', status: 'WARNING' }],
        verifiedAt,
      };
    }

    // Batch anchoring exists
    const batch = batchRecord.batch;
    const expectedHashSnapshot = batchRecord.recordHashSnapshot;
    const hashMatches =
      currentCalculatedHash !== null &&
      currentCalculatedHash.toLowerCase() === expectedHashSnapshot.toLowerCase();

    evidence.push({
      key: 'Canonical Hash Check',
      value: hashMatches ? 'Current record matches batch snapshot' : 'Current record differs from snapshot (Tamper)',
      status: hashMatches ? 'VALID' : 'ERROR',
    });

    if (!hashMatches) {
      return {
        recordId,
        recordType,
        vehicleId: batchRecord.vehicleId,
        anchoringMode: 'BATCH_MERKLE',
        overallStatus: 'RECORD_HASH_MISMATCH',
        recordHashStatus: 'MISMATCH',
        proofStatus: 'NOT_APPLICABLE',
        databaseRootStatus: 'MATCH',
        batchIdentifier: batch.batchIdentifier,
        batchStatus: batch.status,
        algorithmVersion: batch.algorithmVersion,
        leafIndex: batchRecord.leafIndex,
        leafCount: batch.leafCount,
        calculatedHash: currentCalculatedHash || 'COULD_NOT_CALCULATE',
        expectedHash: expectedHashSnapshot,
        leafHash: batchRecord.leafHash,
        databaseRoot: batch.merkleRoot,
        transactionHash: batch.transactionHash,
        blockNumber: batch.blockNumber,
        evidence,
        verifiedAt,
      };
    }

    // Verify leaf reconstruction
    const reconstructedLeaf = computeLeafHash({
      recordId: batchRecord.recordId,
      recordType: batchRecord.recordType,
      recordHash: batchRecord.recordHashSnapshot,
      vehicleId: batchRecord.vehicleId,
    });

    const leafMatches = reconstructedLeaf.toLowerCase() === batchRecord.leafHash.toLowerCase();
    evidence.push({
      key: 'Leaf Hash Reconstruction',
      value: leafMatches ? 'Reconstructed leaf matches stored leaf' : 'Reconstructed leaf mismatch',
      status: leafMatches ? 'VALID' : 'ERROR',
    });

    // Parse and verify Merkle Proof
    let parsedProof: string[] = [];
    try {
      parsedProof = JSON.parse(batchRecord.proof);
    } catch {
      parsedProof = [];
    }

    const proofResult = verifyInclusionProof(batchRecord.leafHash, parsedProof, batch.merkleRoot);
    evidence.push({
      key: 'Merkle Inclusion Proof',
      value: proofResult.valid
        ? `Valid (${parsedProof.length} proof siblings verified to root)`
        : `Invalid: ${proofResult.error}`,
      status: proofResult.valid ? 'VALID' : 'ERROR',
    });

    if (!proofResult.valid) {
      return {
        recordId,
        recordType,
        vehicleId: batchRecord.vehicleId,
        anchoringMode: 'BATCH_MERKLE',
        overallStatus: 'INVALID_PROOF',
        recordHashStatus: 'MATCH',
        proofStatus: 'INVALID',
        databaseRootStatus: 'MISMATCH',
        batchIdentifier: batch.batchIdentifier,
        batchStatus: batch.status,
        algorithmVersion: batch.algorithmVersion,
        leafIndex: batchRecord.leafIndex,
        leafCount: batch.leafCount,
        calculatedHash: currentCalculatedHash!,
        expectedHash: expectedHashSnapshot,
        leafHash: batchRecord.leafHash,
        calculatedRoot: proofResult.calculatedRoot,
        databaseRoot: batch.merkleRoot,
        proofSteps: proofResult.steps,
        evidence,
        verifiedAt,
      };
    }

    // Query on-chain contract
    let onChainBatch: any = null;
    let onChainAnchored = false;
    let blockchainAvailable = true;

    try {
      onChainAnchored = await this.blockchainService.isBatchAnchoredOnChain(batch.batchIdHex);
      if (onChainAnchored) {
        onChainBatch = await this.blockchainService.getOnChainBatch(batch.batchIdHex);
      }
    } catch (bcErr) {
      blockchainAvailable = false;
    }

    if (!blockchainAvailable) {
      evidence.push({
        key: 'Blockchain State',
        value: 'Blockchain node unavailable for live root verification',
        status: 'WARNING',
      });
      return {
        recordId,
        recordType,
        vehicleId: batchRecord.vehicleId,
        anchoringMode: 'BATCH_MERKLE',
        overallStatus: 'BLOCKCHAIN_UNAVAILABLE',
        recordHashStatus: 'MATCH',
        proofStatus: 'VALID',
        databaseRootStatus: 'MATCH',
        blockchainRootStatus: 'NOT_APPLICABLE',
        batchIdentifier: batch.batchIdentifier,
        batchStatus: batch.status,
        algorithmVersion: batch.algorithmVersion,
        leafIndex: batchRecord.leafIndex,
        leafCount: batch.leafCount,
        calculatedHash: currentCalculatedHash!,
        expectedHash: expectedHashSnapshot,
        leafHash: batchRecord.leafHash,
        calculatedRoot: proofResult.calculatedRoot,
        databaseRoot: batch.merkleRoot,
        proofSteps: proofResult.steps,
        evidence,
        verifiedAt,
      };
    }

    if (!onChainAnchored) {
      evidence.push({
        key: 'Blockchain State',
        value: 'Batch root has not yet been confirmed on-chain',
        status: 'WARNING',
      });
      return {
        recordId,
        recordType,
        vehicleId: batchRecord.vehicleId,
        anchoringMode: 'BATCH_MERKLE',
        overallStatus: 'BATCH_NOT_CONFIRMED',
        recordHashStatus: 'MATCH',
        proofStatus: 'VALID',
        databaseRootStatus: 'MATCH',
        blockchainRootStatus: 'NOT_ANCHORED',
        batchIdentifier: batch.batchIdentifier,
        batchStatus: batch.status,
        algorithmVersion: batch.algorithmVersion,
        leafIndex: batchRecord.leafIndex,
        leafCount: batch.leafCount,
        calculatedHash: currentCalculatedHash!,
        expectedHash: expectedHashSnapshot,
        leafHash: batchRecord.leafHash,
        calculatedRoot: proofResult.calculatedRoot,
        databaseRoot: batch.merkleRoot,
        proofSteps: proofResult.steps,
        evidence,
        verifiedAt,
      };
    }

    const onChainRoot = onChainBatch.merkleRoot;
    const rootMatchesOnChain = onChainRoot.toLowerCase() === batch.merkleRoot.toLowerCase();

    evidence.push({
      key: 'On-Chain Root Check',
      value: rootMatchesOnChain
        ? `Committed root ${onChainRoot.slice(0, 10)}... confirmed on-chain`
        : `On-chain root mismatch: ${onChainRoot}`,
      status: rootMatchesOnChain ? 'VALID' : 'ERROR',
    });

    if (!rootMatchesOnChain) {
      return {
        recordId,
        recordType,
        vehicleId: batchRecord.vehicleId,
        anchoringMode: 'BATCH_MERKLE',
        overallStatus: 'ROOT_MISMATCH',
        recordHashStatus: 'MATCH',
        proofStatus: 'VALID',
        databaseRootStatus: 'MATCH',
        blockchainRootStatus: 'MISMATCH',
        batchIdentifier: batch.batchIdentifier,
        batchStatus: batch.status,
        algorithmVersion: batch.algorithmVersion,
        leafIndex: batchRecord.leafIndex,
        leafCount: batch.leafCount,
        calculatedHash: currentCalculatedHash!,
        expectedHash: expectedHashSnapshot,
        leafHash: batchRecord.leafHash,
        calculatedRoot: proofResult.calculatedRoot,
        databaseRoot: batch.merkleRoot,
        onChainRoot,
        proofSteps: proofResult.steps,
        evidence,
        verifiedAt,
      };
    }

    // Full Verification Confirmed!
    evidence.push({
      key: 'Final Verification',
      value: 'Record verified end-to-end against cryptographic root anchored on Ethereum / EVM blockchain',
      status: 'VALID',
    });

    return {
      recordId,
      recordType,
      vehicleId: batchRecord.vehicleId,
      anchoringMode: 'BATCH_MERKLE',
      overallStatus: 'VERIFIED',
      recordHashStatus: 'MATCH',
      proofStatus: 'VALID',
      databaseRootStatus: 'MATCH',
      blockchainRootStatus: 'MATCH',
      batchIdentifier: batch.batchIdentifier,
      batchStatus: batch.status,
      algorithmVersion: batch.algorithmVersion,
      leafIndex: batchRecord.leafIndex,
      leafCount: batch.leafCount,
      calculatedHash: currentCalculatedHash!,
      expectedHash: expectedHashSnapshot,
      leafHash: batchRecord.leafHash,
      calculatedRoot: proofResult.calculatedRoot,
      databaseRoot: batch.merkleRoot,
      onChainRoot,
      transactionHash: batch.transactionHash,
      blockNumber: batch.blockNumber,
      proofSteps: proofResult.steps,
      evidence,
      verifiedAt,
    };
  }
}
