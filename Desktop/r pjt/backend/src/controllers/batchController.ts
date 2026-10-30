import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { BatchOrchestrationService } from '../blockchain/services/batchOrchestrationService';
import { BlockchainService } from '../blockchain/services/blockchainService';
import { verifyInclusionProof } from '../blockchain/services/merkleService';
import { prisma } from '../lib/prisma';
import { MerkleBatchStatus } from '@prisma/client';

const createBatchSchema = z.object({
  recordIds: z.array(z.string().min(1)).optional(),
  vehicleId: z.string().optional(),
  maxRecords: z.number().int().min(1).max(500).optional(),
  autoSubmit: z.boolean().optional(),
});

const verifyProofSchema = z.object({
  leaf: z.string().min(10),
  proof: z.array(z.string()),
  root: z.string().min(10),
  batchIdHex: z.string().optional(),
});

export async function createBatchHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch creation payload',
        details: parsed.error.format(),
      });
    }

    const service = BatchOrchestrationService.getInstance();
    const batch = await service.createBatch({
      recordIds: parsed.data.recordIds,
      vehicleId: parsed.data.vehicleId,
      maxRecords: parsed.data.maxRecords,
      createdByUserId: req.user?.id,
      autoSubmit: parsed.data.autoSubmit,
    });

    if (!batch) {
      throw new Error('Failed to create or retrieve Merkle batch');
    }

    return res.status(201).json({
      success: true,
      message: `Batch '${batch.batchIdentifier}' created successfully with ${batch.leafCount} records`,
      data: { batch },
    });
  } catch (err: any) {
    console.error('createBatchHandler error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to create Merkle batch',
    });
  }
}

export async function listBatchesHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const status = req.query.status as MerkleBatchStatus | undefined;
    const search = req.query.search as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const service = BatchOrchestrationService.getInstance();
    const result = await service.listBatches({
      status,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('listBatchesHandler error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to list Merkle batches',
    });
  }
}

export async function getEligibleRecordsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.query.vehicleId as string | undefined;
    const recordType = req.query.recordType as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const service = BatchOrchestrationService.getInstance();
    const records = await service.getEligibleRecords({
      vehicleId,
      recordType,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: {
        records,
        count: records.length,
      },
    });
  } catch (err: any) {
    console.error('getEligibleRecordsHandler error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve eligible records',
    });
  }
}

export async function getBatchDetailsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const batchId = req.params.batchId as string;
    const service = BatchOrchestrationService.getInstance();
    const batch = await service.getBatchById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: `Batch '${batchId}' not found`,
      });
    }

    // Check live on-chain status
    const bcService = BlockchainService.getInstance();
    const isAnchored = await bcService.isBatchAnchoredOnChain(batch.batchIdHex);
    let onChainData: any = null;
    if (isAnchored) {
      onChainData = await bcService.getOnChainBatch(batch.batchIdHex).catch(() => null);
    }

    return res.status(200).json({
      success: true,
      data: {
        batch,
        onChain: {
          isAnchored,
          data: onChainData
            ? {
                batchId: onChainData.batchId,
                merkleRoot: onChainData.merkleRoot,
                leafCount: Number(onChainData.leafCount),
                metadataHash: onChainData.metadataHash,
                actorAddress: onChainData.actorAddress,
                timestamp: Number(onChainData.timestamp),
                blockNumber: Number(onChainData.blockNumber),
              }
            : null,
        },
      },
    });
  } catch (err: any) {
    console.error('getBatchDetailsHandler error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve batch details',
    });
  }
}

export async function getRecordProofHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const batchId = req.params.batchId as string;
    const recordId = req.params.recordId as string;

    const service = BatchOrchestrationService.getInstance();
    const proofData = await service.getRecordInclusionProof(batchId, recordId);

    return res.status(200).json({
      success: true,
      data: proofData,
    });
  } catch (err: any) {
    console.error('getRecordProofHandler error:', err);
    return res.status(404).json({
      success: false,
      error: err.message || 'Failed to generate record inclusion proof',
    });
  }
}

export async function reconcileBatchHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const batchId = req.params.batchId as string;
    const service = BatchOrchestrationService.getInstance();
    const result = await service.reconcileBatch(batchId);

    return res.status(200).json({
      success: true,
      message: result.reconciled ? 'Batch successfully reconciled and confirmed on-chain' : 'Batch reconciliation processed',
      data: result,
    });
  } catch (err: any) {
    console.error('reconcileBatchHandler error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to reconcile batch',
    });
  }
}

export async function verifyBatchRecordHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const recordId = req.body.recordId as string;
    const recordType = req.body.recordType as string;

    if (!recordId || !recordType) {
      return res.status(400).json({
        success: false,
        error: 'recordId and recordType are required',
      });
    }

    const service = BatchOrchestrationService.getInstance();
    const report = await service.verifyRecord(recordId, recordType);

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err: any) {
    console.error('verifyBatchRecordHandler error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to verify record inclusion',
    });
  }
}

export async function verifyProofDirectHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = verifyProofSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proof verification payload',
        details: parsed.error.format(),
      });
    }

    const { leaf, proof, root, batchIdHex } = parsed.data;
    const verification = verifyInclusionProof(leaf, proof, root);

    let onChainVerified: boolean | null = null;
    let onChainRoot: string | null = null;

    if (batchIdHex) {
      const bcService = BlockchainService.getInstance();
      try {
        const isAnchored = await bcService.isBatchAnchoredOnChain(batchIdHex);
        if (isAnchored) {
          const onChainBatch = await bcService.getOnChainBatch(batchIdHex);
          onChainRoot = onChainBatch.merkleRoot;
          onChainVerified = await bcService.verifyBatchInclusionOnChain(batchIdHex, leaf, proof);
        }
      } catch {
        onChainVerified = null;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        isValid: verification.valid,
        calculatedRoot: verification.calculatedRoot,
        expectedRoot: verification.expectedRoot,
        proofSteps: verification.steps,
        onChainVerified,
        onChainRoot,
        error: verification.error,
      },
    });
  } catch (err: any) {
    console.error('verifyProofDirectHandler error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to execute direct proof verification',
    });
  }
}

export async function getVehicleBlockchainVerificationHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ id: vehicleId }, { passportId: vehicleId }],
      },
      include: {
        serviceRecords: { orderBy: { serviceDate: 'asc' } },
        odometerRecords: { orderBy: { recordedAt: 'asc' } },
        accidentRecords: { orderBy: { accidentDate: 'asc' } },
        insuranceRecords: { orderBy: { startDate: 'asc' } },
        documents: { orderBy: { createdAt: 'asc' } },
        ownershipHistory: { orderBy: { transferDate: 'asc' } },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    const service = BatchOrchestrationService.getInstance();
    const verifiedItems: any[] = [];

    // Verify Services
    for (const s of vehicle.serviceRecords) {
      const rep = await service.verifyRecord(s.id, 'SERVICE');
      verifiedItems.push({
        id: s.id,
        category: 'SERVICE',
        date: s.serviceDate,
        title: `${s.serviceType} (${s.mileage} km)`,
        verification: rep,
      });
    }

    // Verify Odometers
    for (const o of vehicle.odometerRecords) {
      const rep = await service.verifyRecord(o.id, 'ODOMETER');
      verifiedItems.push({
        id: o.id,
        category: 'ODOMETER',
        date: o.recordedAt,
        title: `Odometer Reading: ${o.mileage} km`,
        verification: rep,
      });
    }

    // Verify Accidents
    for (const a of vehicle.accidentRecords) {
      const rep = await service.verifyRecord(a.id, 'ACCIDENT');
      verifiedItems.push({
        id: a.id,
        category: 'ACCIDENT',
        date: a.accidentDate,
        title: `Collision Severity: ${a.severity}`,
        verification: rep,
      });
    }

    // Verify Insurance
    for (const ins of vehicle.insuranceRecords) {
      const rep = await service.verifyRecord(ins.id, 'INSURANCE');
      verifiedItems.push({
        id: ins.id,
        category: 'INSURANCE',
        date: ins.startDate,
        title: `Policy: ${ins.policyReference}`,
        verification: rep,
      });
    }

    // Verify Documents
    for (const doc of vehicle.documents) {
      const rep = await service.verifyRecord(doc.id, 'DOCUMENT');
      verifiedItems.push({
        id: doc.id,
        category: 'DOCUMENT',
        date: doc.createdAt,
        title: `Document: ${doc.title}`,
        verification: rep,
      });
    }

    // Genesis Vehicle Identity Check
    const bcService = BlockchainService.getInstance();
    const vehicleVerification = await bcService.verifyVehicle(vehicle.id);

    const batchAnchoredCount = verifiedItems.filter((i) => i.verification.anchoringMode === 'BATCH_MERKLE').length;
    const legacyAnchoredCount = verifiedItems.filter((i) => i.verification.anchoringMode === 'LEGACY_INDIVIDUAL').length;
    const verifiedCount = verifiedItems.filter((i) => i.verification.overallStatus === 'VERIFIED').length;
    const tamperCount = verifiedItems.filter(
      (i) => i.verification.overallStatus === 'RECORD_HASH_MISMATCH' || i.verification.overallStatus === 'ROOT_MISMATCH'
    ).length;

    return res.status(200).json({
      success: true,
      data: {
        vehicle: {
          id: vehicle.id,
          passportId: vehicle.passportId,
          vin: vehicle.vin,
          registrationNumber: vehicle.registrationNumber,
          blockchainVehicleId: vehicle.blockchainVehicleId,
          genesisVerification: vehicleVerification,
        },
        summary: {
          totalRecords: verifiedItems.length,
          verifiedRecords: verifiedCount,
          batchAnchoredRecords: batchAnchoredCount,
          legacyAnchoredRecords: legacyAnchoredCount,
          tamperedRecords: tamperCount,
          allVerified: tamperCount === 0 && (verifiedCount > 0 || verifiedItems.length === 0),
        },
        records: verifiedItems,
      },
    });
  } catch (err: any) {
    console.error('getVehicleBlockchainVerificationHandler error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve vehicle blockchain verification',
    });
  }
}
