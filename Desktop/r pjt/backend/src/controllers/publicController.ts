import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { BlockchainService } from '../blockchain/services/blockchainService';
import { getBlockchainConfig } from '../blockchain/config';
import { logAuditEvent } from '../services/auditService';
import { getSystemAlerts } from '../services/alertService';
import { ethers } from 'ethers';

const blockchainService = BlockchainService.getInstance();

/**
 * Mask registration plate for public privacy (e.g. MH02EV1001 -> MH02••••1001)
 */
function maskRegistration(reg: string): string {
  if (!reg || reg.length < 6) return '••••••';
  const prefix = reg.slice(0, 4);
  const suffix = reg.slice(-4);
  return `${prefix}••••${suffix}`;
}

// ============================================================================
// 1. PUBLIC PASSPORT VERIFICATION
// ============================================================================

export async function getPublicPassportVerification(req: Request, res: Response) {
  try {
    const rawPassportId = req.params.passportId as string;
    if (!rawPassportId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Passport ID is required' },
      });
    }

    const normalizedPassportId = rawPassportId.trim().toUpperCase();
    const passportRegex = /^VP-[A-Z0-9_-]{4,16}$/i;
    if (!passportRegex.test(normalizedPassportId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSPORT_FORMAT',
          message: 'Passport ID must match format VP-XXXXXX (e.g. VP-000001)',
        },
      });
    }

    // 1. Find Vehicle in database
    const vehicle = await prisma.vehicle.findUnique({
      where: { passportId: normalizedPassportId },
      include: {
        currentOwner: { select: { name: true, role: true } },
        documents: {
          select: {
            id: true,
            documentType: true,
            title: true,
            fileHash: true,
            recordHash: true,
            ipfsCid: true,
            storageProvider: true,
            ocrStatus: true,
            consistencyStatus: true,
            createdAt: true,
            status: true,
            blockchainTxHash: true,
            isPublic: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PASSPORT_NOT_FOUND',
          message: `Vehicle Passport ${normalizedPassportId} not found in the registry`,
        },
      });
    }

    // 2. Run existing full multi-category verification engine
    const fullReport = await blockchainService.verifyVehiclePassportFull(vehicle.id);
    const config = getBlockchainConfig();

    // 3. Determine Overall Verification State
    let overallState: 'VERIFIED' | 'SUSPICIOUS' | 'TAMPERED' = 'VERIFIED';
    let statusExplanation = 'All vehicle specifications and lifecycle records match cryptographic blockchain anchors.';

    if (fullReport.hasTamper) {
      overallState = 'TAMPERED';
      statusExplanation = 'Cryptographic mismatch detected! Database record contents differ from immutable on-chain proof.';
    } else if (fullReport.hasSuspicious || fullReport.categories.odometer.rollbackDetected) {
      overallState = 'SUSPICIOUS';
      statusExplanation = 'Potential anomaly detected: Odometer rollback or suspicious timeline sequence identified.';
    }

    // 4. Assemble Public Timeline
    const timelineEvents: Array<{
      date: string;
      type: string;
      title: string;
      description: string;
      txHash?: string | null;
      status: string;
    }> = [];

    // Genesis Registration
    timelineEvents.push({
      date: vehicle.createdAt.toISOString(),
      type: 'REGISTRATION',
      title: 'Vehicle Passport Minted & Anchored',
      description: `Initial registration anchored on blockchain for ${vehicle.manufacturer} ${vehicle.model} (${vehicle.manufacturingYear}).`,
      txHash: vehicle.blockchainTxHash,
      status: 'CONFIRMED',
    });

    // Ownership Transfers (Public sanitized)
    for (const rec of fullReport.categories.ownership.records) {
      timelineEvents.push({
        date: rec.timestamp,
        type: 'OWNERSHIP',
        title: rec.label.split(':')[0] || 'Ownership Transfer',
        description: `Verified ownership transition anchored on blockchain.`,
        txHash: rec.blockchainTxHash,
        status: rec.isVerified ? 'VERIFIED' : 'TAMPERED',
      });
    }

    // Service records
    for (const rec of fullReport.categories.service.records) {
      timelineEvents.push({
        date: rec.timestamp,
        type: 'SERVICE',
        title: `Certified Maintenance Completed`,
        description: rec.label,
        txHash: rec.blockchainTxHash,
        status: rec.isVerified ? 'VERIFIED' : 'TAMPERED',
      });
    }

    // Odometer records
    for (const rec of fullReport.categories.odometer.records) {
      timelineEvents.push({
        date: rec.timestamp,
        type: 'ODOMETER',
        title: rec.isSuspicious ? '⚠ Odometer Variance Logged' : 'Odometer Reading Anchored',
        description: rec.label,
        txHash: rec.blockchainTxHash,
        status: rec.isSuspicious ? 'SUSPICIOUS' : rec.isVerified ? 'VERIFIED' : 'TAMPERED',
      });
    }

    // Accident records
    for (const rec of fullReport.categories.accident.records) {
      timelineEvents.push({
        date: rec.timestamp,
        type: 'ACCIDENT',
        title: 'Accident & Repair Incident Logged',
        description: rec.label,
        txHash: rec.blockchainTxHash,
        status: rec.isVerified ? 'VERIFIED' : 'TAMPERED',
      });
    }

    // Insurance records
    for (const rec of fullReport.categories.insurance.records) {
      timelineEvents.push({
        date: rec.timestamp,
        type: 'INSURANCE',
        title: 'Insurance Coverage Policy Validated',
        description: rec.label,
        txHash: rec.blockchainTxHash,
        status: rec.isVerified ? 'VERIFIED' : 'TAMPERED',
      });
    }

    timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 5. Build Public Document Proofs (Zero sensitive file content)
    const publicDocuments = vehicle.documents.map((doc) => ({
      documentType: doc.documentType,
      title: doc.title,
      fileHash: doc.fileHash,
      recordHash: doc.recordHash,
      ipfsCid: doc.ipfsCid || `bafybeicdev_${doc.fileHash.slice(2, 34)}`,
      storageProvider: doc.storageProvider || 'local',
      ocrStatus: doc.ocrStatus || 'COMPLETED',
      consistencyStatus: doc.consistencyStatus || 'CONSISTENT',
      verifiedOnChain: doc.status === 'CONFIRMED',
      blockchainTxHash: doc.blockchainTxHash,
      uploadedAt: doc.createdAt.toISOString(),
    }));

    // 6. Strict Privacy-Safe Response DTO
    const publicResponse = {
      passportId: vehicle.passportId,
      vehicleSummary: {
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        variant: vehicle.variant || 'Standard',
        manufacturingYear: vehicle.manufacturingYear,
        fuelType: vehicle.fuelType,
        color: vehicle.color || 'Standard',
        registrationNumberMasked: maskRegistration(vehicle.registrationNumber),
        status: vehicle.status,
      },
      blockchainStatus: {
        isRegisteredOnBlockchain: fullReport.vehicleIdentity.isRegisteredOnBlockchain,
        blockchainVehicleId: vehicle.blockchainVehicleId,
        blockchainTxHash: vehicle.blockchainTxHash,
        blockNumber: vehicle.blockNumber,
        status: vehicle.blockchainStatus,
        network: config.chainId === 31337 ? 'Hardhat Local (Chain 31337)' : 'Ethereum Testnet',
        contractAddress: config.contractAddress,
      },
      verificationStatus: overallState,
      statusExplanation,
      verificationTimestamp: new Date().toISOString(),
      lifecycleSummary: {
        totalOwnershipTransfers: fullReport.categories.ownership.count,
        totalServices: fullReport.categories.service.count,
        totalOdometerReadings: fullReport.categories.odometer.count,
        totalAccidents: fullReport.categories.accident.count,
        totalInsurancePolicies: fullReport.categories.insurance.count,
        totalDocuments: fullReport.categories.documents.count,
        rollbackDetected: fullReport.categories.odometer.rollbackDetected,
      },
      categories: {
        vehicleIdentity: {
          status: fullReport.vehicleIdentity.tamperDetected ? 'TAMPERED' : 'VERIFIED',
          isVerified: fullReport.vehicleIdentity.isVerified,
          tamperDetected: fullReport.vehicleIdentity.tamperDetected,
          anchoredHash: fullReport.vehicleIdentity.onChainHash,
          calculatedHash: fullReport.vehicleIdentity.calculatedHash,
        },
        ownership: {
          status: fullReport.categories.ownership.status === 'TAMPER_DETECTED' ? 'TAMPERED' : fullReport.categories.ownership.status,
          count: fullReport.categories.ownership.count,
        },
        service: {
          status: fullReport.categories.service.status === 'TAMPER_DETECTED' ? 'TAMPERED' : fullReport.categories.service.status,
          count: fullReport.categories.service.count,
        },
        odometer: {
          status: fullReport.categories.odometer.status === 'TAMPER_DETECTED' ? 'TAMPERED' : fullReport.categories.odometer.status,
          count: fullReport.categories.odometer.count,
          rollbackDetected: fullReport.categories.odometer.rollbackDetected,
        },
        accident: {
          status: fullReport.categories.accident.status === 'TAMPER_DETECTED' ? 'TAMPERED' : fullReport.categories.accident.status,
          count: fullReport.categories.accident.count,
        },
        insurance: {
          status: fullReport.categories.insurance.status === 'TAMPER_DETECTED' ? 'TAMPERED' : fullReport.categories.insurance.status,
          count: fullReport.categories.insurance.count,
        },
        documents: {
          status: fullReport.categories.documents.status === 'TAMPER_DETECTED' ? 'TAMPERED' : fullReport.categories.documents.status,
          count: publicDocuments.length,
          proofs: publicDocuments,
        },
      },
      documents: publicDocuments,
      timeline: timelineEvents,
      publicVerificationUrl: `/verify/${vehicle.passportId}`,
    };

    // 7. Audit Log the public verification
    await logAuditEvent({
      action: overallState === 'TAMPERED' ? 'TAMPER_DETECTED' : 'VEHICLE_VERIFICATION',
      vehicleId: vehicle.id,
      details: {
        passportId: vehicle.passportId,
        verificationStatus: overallState,
        ip: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      data: publicResponse,
    });
  } catch (error: any) {
    console.error('getPublicPassportVerification error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_ERROR',
        message: 'An error occurred while verifying the vehicle passport.',
      },
    });
  }
}

// ============================================================================
// 2. BLOCKCHAIN EXPLORER OVERVIEW & STATS
// ============================================================================

export async function getBlockchainExplorerOverview(req: Request, res: Response) {
  try {
    const config = getBlockchainConfig();
    let latestBlock = 0;

    if (config.rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        latestBlock = await provider.getBlockNumber();
      } catch (err) {
        console.warn('Could not query latest block from provider:', err);
      }
    }

    const [totalVehicles, totalUsers, totalAnchors] = await Promise.all([
      prisma.vehicle.count({ where: { blockchainStatus: 'CONFIRMED' } }),
      prisma.user.count({ where: { isInitialized: true } }),
      prisma.blockchainRecord.count({ where: { status: 'CONFIRMED' } }),
    ]);

    const recordsGrouped = await prisma.blockchainRecord.groupBy({
      by: ['recordType'],
      _count: { id: true },
    });

    const eventBreakdown: Record<string, number> = {};
    for (const group of recordsGrouped) {
      eventBreakdown[group.recordType] = group._count.id;
    }

    return res.status(200).json({
      success: true,
      data: {
        network: config.chainId === 31337 ? 'Hardhat Local' : 'Ethereum Network',
        chainId: config.chainId,
        contractAddress: config.contractAddress,
        latestBlock,
        stats: {
          totalVehicles,
          totalUsers,
          totalAnchors,
        },
        eventBreakdown,
        explorerUrl: process.env.BLOCK_EXPLORER_URL || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('getBlockchainExplorerOverview error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPLORER_ERROR', message: 'Failed to retrieve blockchain overview' },
    });
  }
}

// ============================================================================
// 3. BLOCKCHAIN EXPLORER TRANSACTIONS / EVENTS
// ============================================================================

export async function getBlockchainExplorerTransactions(req: Request, res: Response) {
  try {
    const { search, recordType, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};

    if (recordType && recordType !== 'ALL') {
      whereClause.recordType = recordType as string;
    }

    if (search) {
      const q = (search as string).trim();
      whereClause.OR = [
        { blockchainTxHash: { contains: q, mode: 'insensitive' } },
        { recordHash: { contains: q, mode: 'insensitive' } },
        { vehicle: { passportId: { contains: q, mode: 'insensitive' } } },
        { vehicle: { vin: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.blockchainRecord.count({ where: whereClause }),
      prisma.blockchainRecord.findMany({
        where: whereClause,
        include: {
          vehicle: { select: { passportId: true, manufacturer: true, model: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    const transactions = records.map((rec) => ({
      id: rec.id,
      txHash: rec.blockchainTxHash,
      blockNumber: rec.blockNumber,
      recordType: rec.recordType,
      eventType: rec.recordType,
      recordHash: rec.recordHash,
      network: rec.blockchainNetwork,
      status: rec.status,
      timestamp: rec.createdAt.toISOString(),
      passportId: rec.vehicle?.passportId || null,
      vehicleSummary: rec.vehicle ? `${rec.vehicle.manufacturer} ${rec.vehicle.model}` : null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        transactions,
      },
    });
  } catch (error: any) {
    console.error('getBlockchainExplorerTransactions error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPLORER_ERROR', message: 'Failed to retrieve transactions' },
    });
  }
}

// ============================================================================
// 4. PUBLIC SYSTEM ALERTS
// ============================================================================

export async function getPublicSystemAlerts(req: Request, res: Response) {
  try {
    const alerts = await getSystemAlerts();
    return res.status(200).json({
      success: true,
      data: {
        count: alerts.length,
        alerts: alerts.slice(0, 20),
      },
    });
  } catch (error: any) {
    console.error('getPublicSystemAlerts error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ALERTS_ERROR', message: 'Failed to retrieve alerts' },
    });
  }
}
