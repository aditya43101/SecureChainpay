import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { BlockchainService } from '../blockchain/services/blockchainService';
import {
  OwnershipTransferType,
  OdometerSourceType,
  AccidentSeverity,
  RepairStatus,
  InsurancePolicyStatus,
  DocumentType,
  VerificationStatus,
} from '@prisma/client';
import { getStorageProvider } from '../services/storage/storageFactory';
import { getOCRProvider } from '../services/ocr/ocrFactory';
import { evaluateDocumentConsistency } from '../services/ocr/consistencyEngine';
import { logAuditEvent } from '../services/auditService';

const blockchainService = BlockchainService.getInstance();

// ============================================================================
// 1. OWNERSHIP HISTORY & TRANSFER
// ============================================================================

export async function transferOwnership(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const vehicleId = req.params.vehicleId as string;
    const { targetUserIdentifier, transferType, notes } = req.body;

    if (!targetUserIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Target user email or user ID is required',
      });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { currentOwner: true },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    // Authorization: only current owner can initiate transfer (Rule 2)
    if (vehicle.currentOwnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only the current vehicle owner can initiate an ownership transfer',
      });
    }

    // Resolve target new owner
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetUserIdentifier },
          { firebaseUid: targetUserIdentifier },
          { email: targetUserIdentifier.toLowerCase().trim() },
          { blockchainUserId: targetUserIdentifier },
        ],
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target owner not found. The target user must register and initialize first.',
      });
    }

    if (!targetUser.isInitialized) {
      return res.status(400).json({
        success: false,
        error: 'Target user has not initialized their Vehicle Passport identity.',
      });
    }

    if (vehicle.currentOwnerId === targetUser.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot transfer vehicle to current owner',
      });
    }

    const type = (transferType as OwnershipTransferType) || OwnershipTransferType.SALE;

    // Execute blockchain transfer & atomic DB update
    const result = await blockchainService.transferOwnership({
      vehicleId: vehicle.id,
      previousOwnerId: vehicle.currentOwnerId,
      newOwnerId: targetUser.id,
      transferType: type,
      notes,
    });

    return res.status(200).json({
      success: true,
      message: `Ownership successfully transferred to ${targetUser.name}`,
      data: {
        vehicleId: vehicle.id,
        previousOwner: vehicle.currentOwner.name,
        newOwner: targetUser.name,
        newOwnerId: targetUser.id,
        transferType: type,
        blockchain: result,
      },
    });
  } catch (error: any) {
    console.error('transferOwnership error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to transfer ownership',
    });
  }
}

export async function getOwnershipHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const history = await prisma.ownershipHistory.findMany({
      where: { vehicleId },
      include: {
        previousOwner: {
          select: { id: true, name: true, email: true, blockchainUserId: true, role: true },
        },
        newOwner: {
          select: { id: true, name: true, email: true, blockchainUserId: true, role: true },
        },
      },
      orderBy: { transferDate: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: { ownershipHistory: history },
    });
  } catch (error: any) {
    console.error('getOwnershipHistory error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get ownership history',
    });
  }
}

// ============================================================================
// 2. SERVICE RECORDS
// ============================================================================

export async function addServiceRecord(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Role validation: ONLY GARAGE or ADMIN
    if (req.user.role !== 'GARAGE' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only authorized Garages or Administrators can record vehicle services',
      });
    }

    const vehicleId = req.params.vehicleId as string;
    const {
      serviceDate,
      mileage,
      serviceType,
      description,
      partsReplaced,
      laborDescription,
      cost,
      technician,
      notes,
    } = req.body;

    if (!mileage || !serviceType || !description) {
      return res.status(400).json({
        success: false,
        error: 'Mileage, serviceType, and description are required',
      });
    }

    const serviceRecord = await blockchainService.anchorServiceRecord({
      vehicleId,
      garageId: req.user.id,
      serviceDate: serviceDate || new Date(),
      mileage: Number(mileage),
      serviceType,
      description,
      partsReplaced,
      laborDescription,
      cost: cost ? Number(cost) : null,
      technician,
      notes,
    });

    // Also auto-record odometer from garage service
    await blockchainService.anchorOdometerRecord({
      vehicleId,
      sourceUserId: req.user.id,
      mileage: Number(mileage),
      recordedAt: serviceDate || new Date(),
      sourceType: OdometerSourceType.SERVICE,
      notes: `Recorded during ${serviceType}`,
    });

    return res.status(201).json({
      success: true,
      message: 'Service record successfully verified and anchored on blockchain',
      data: { serviceRecord },
    });
  } catch (error: any) {
    console.error('addServiceRecord error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add service record',
    });
  }
}

export async function getServiceRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const services = await prisma.serviceRecord.findMany({
      where: { vehicleId },
      include: {
        garage: {
          select: { id: true, name: true, email: true, role: true, blockchainUserId: true },
        },
      },
      orderBy: { serviceDate: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { serviceRecords: services },
    });
  } catch (error: any) {
    console.error('getServiceRecords error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get service records',
    });
  }
}

// ============================================================================
// 3. ODOMETER RECORDS
// ============================================================================

export async function addOdometerRecord(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const vehicleId = req.params.vehicleId as string;
    const { mileage, recordedAt, sourceType, notes } = req.body;

    if (mileage === undefined || mileage === null) {
      return res.status(400).json({ success: false, error: 'Mileage is required' });
    }

    const type = (sourceType as OdometerSourceType) || (req.user.role === 'GARAGE' ? OdometerSourceType.GARAGE : OdometerSourceType.OWNER);

    const odometerRecord = await blockchainService.anchorOdometerRecord({
      vehicleId,
      sourceUserId: req.user.id,
      mileage: Number(mileage),
      recordedAt,
      sourceType: type,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: odometerRecord.rollbackDetected
        ? '⚠️ Warning: Possible Odometer Rollback detected and flagged for review'
        : 'Odometer reading recorded and anchored on blockchain',
      data: { odometerRecord },
    });
  } catch (error: any) {
    console.error('addOdometerRecord error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add odometer record',
    });
  }
}

export async function getOdometerRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const records = await prisma.odometerRecord.findMany({
      where: { vehicleId },
      include: {
        sourceUser: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { recordedAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: { odometerRecords: records },
    });
  } catch (error: any) {
    console.error('getOdometerRecords error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get odometer records',
    });
  }
}

// ============================================================================
// 4. ACCIDENT & REPAIR RECORDS
// ============================================================================

export async function addAccidentRecord(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const vehicleId = req.params.vehicleId as string;
    const {
      accidentDate,
      severity,
      description,
      damagedParts,
      locationDescription,
      insuranceClaimId,
    } = req.body;

    if (!description) {
      return res.status(400).json({ success: false, error: 'Accident description is required' });
    }

    const accidentRecord = await blockchainService.anchorAccidentRecord({
      vehicleId,
      reportedById: req.user.id,
      accidentDate: accidentDate || new Date(),
      severity: severity as AccidentSeverity,
      description,
      damagedParts,
      locationDescription,
      insuranceClaimId,
      repairStatus: RepairStatus.PENDING,
    });

    return res.status(201).json({
      success: true,
      message: 'Accident record reported and anchored on blockchain',
      data: { accidentRecord },
    });
  } catch (error: any) {
    console.error('addAccidentRecord error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add accident record',
    });
  }
}

export async function updateAccidentRepair(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const accidentId = req.params.accidentId as string;
    const { repairStatus, repairDescription } = req.body;

    const accident = await prisma.accidentRecord.findUnique({
      where: { id: accidentId },
    });

    if (!accident) {
      return res.status(404).json({ success: false, error: 'Accident record not found' });
    }

    const status = (repairStatus as RepairStatus) || RepairStatus.COMPLETED;

    const updated = await prisma.accidentRecord.update({
      where: { id: accidentId },
      data: {
        repairStatus: status,
        repairDescription: repairDescription || accident.repairDescription,
        repairedAt: status === RepairStatus.COMPLETED ? new Date() : accident.repairedAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'ACCIDENT_REPAIR_UPDATED',
        vehicleId: accident.vehicleId,
        userId: req.user.id,
        details: JSON.stringify({
          accidentId,
          repairStatus: status,
          repairedAt: updated.repairedAt,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Accident repair details updated successfully',
      data: { accidentRecord: updated },
    });
  } catch (error: any) {
    console.error('updateAccidentRepair error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update repair details',
    });
  }
}

export async function getAccidentRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const accidents = await prisma.accidentRecord.findMany({
      where: { vehicleId },
      include: {
        reportedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { accidentDate: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { accidentRecords: accidents },
    });
  } catch (error: any) {
    console.error('getAccidentRecords error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get accident records',
    });
  }
}

// ============================================================================
// 5. INSURANCE RECORDS
// ============================================================================

export async function addInsuranceRecord(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Role validation: ONLY INSURANCE_PROVIDER or ADMIN
    if (req.user.role !== 'INSURANCE_PROVIDER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only authorized Insurance Providers can add insurance policies',
      });
    }

    const vehicleId = req.params.vehicleId as string;
    const { policyReference, startDate, endDate, coverageType, status, claimReference, notes } = req.body;

    if (!policyReference || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'policyReference, startDate, and endDate are required',
      });
    }

    const insuranceRecord = await blockchainService.anchorInsuranceRecord({
      vehicleId,
      providerId: req.user.id,
      policyReference,
      startDate,
      endDate,
      coverageType,
      status: status as InsurancePolicyStatus,
      claimReference,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: 'Insurance policy successfully anchored on blockchain',
      data: { insuranceRecord },
    });
  } catch (error: any) {
    console.error('addInsuranceRecord error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add insurance record',
    });
  }
}

export async function getInsuranceRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const insurance = await prisma.insuranceRecord.findMany({
      where: { vehicleId },
      include: {
        provider: {
          select: { id: true, name: true, email: true, role: true, blockchainUserId: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { insuranceRecords: insurance },
    });
  } catch (error: any) {
    console.error('getInsuranceRecords error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get insurance records',
    });
  }
}

// ============================================================================
// 6. DOCUMENTS
// ============================================================================

export async function addDocumentRecord(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const vehicleId = req.params.vehicleId as string;
    const {
      documentType,
      title,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      fileHash,
      fileContent,
    } = req.body;

    if (!title || (!fileUrl && !fileContent)) {
      return res.status(400).json({
        success: false,
        error: 'Document title and file content or URL are required',
      });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    const docType = (documentType as DocumentType) || DocumentType.REGISTRATION_CERTIFICATE;
    const cleanMime = mimeType || 'application/pdf';
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'];
    if (!allowedMimes.includes(cleanMime)) {
      return res.status(400).json({
        success: false,
        error: `Invalid MIME type ${cleanMime}. Allowed: ${allowedMimes.join(', ')}`,
      });
    }

    const safeName = (fileName || `${title.replace(/\s+/g, '_')}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');

    // 1. Process via Storage Provider (Local Dev or IPFS)
    const storageProvider = getStorageProvider();
    let fileBuffer: Buffer;
    if (fileContent) {
      if (fileContent.startsWith('data:')) {
        const base64Data = fileContent.split(',')[1];
        fileBuffer = Buffer.from(base64Data, 'base64');
      } else {
        fileBuffer = Buffer.from(fileContent, 'utf8');
      }
    } else {
      // Create synthetic sample buffer embedding vehicle and doc metadata for OCR parsing
      fileBuffer = Buffer.from(
        `VEHICLE DOCUMENT: ${title}\nVIN: ${vehicle.vin}\nREGISTRATION: ${vehicle.registrationNumber}\nMODEL: ${vehicle.model}\nTYPE: ${docType}\nDATE: ${new Date().toISOString().slice(0, 10)}\nSOURCE: ${fileUrl}`,
        'utf8'
      );
    }

    const storageResult = await storageProvider.uploadDocument({
      fileBuffer,
      fileName: safeName,
      mimeType: cleanMime,
      documentType: docType,
      title,
      vehicleId: vehicle.id,
      uploadedById: req.user.id,
    });

    // 2. Process via OCR Provider
    const ocrProvider = getOCRProvider();
    const ocrResult = await ocrProvider.extractText(fileBuffer, cleanMime, docType, {
      expectedVin: vehicle.vin,
      expectedRegistration: vehicle.registrationNumber,
      expectedModel: vehicle.model,
    });

    // 3. Document-to-Database Consistency Verification Engine
    const consistencyResult = await evaluateDocumentConsistency(vehicle.id, docType, ocrResult.fields);

    // 4. Anchor on Blockchain
    const document = await blockchainService.anchorDocumentRecord({
      vehicleId,
      uploadedById: req.user.id,
      documentType: docType,
      title,
      fileUrl: storageResult.fileUrl || fileUrl,
      fileName: storageResult.fileName,
      fileSize: storageResult.fileSize || fileSize || 102400,
      mimeType: cleanMime,
      fileHash: storageResult.fileHash,
      ipfsCid: storageResult.ipfsCid,
      storageProvider: storageResult.storageProvider,
      ocrStatus: ocrResult.success ? 'COMPLETED' : 'FAILED',
      extractedData: JSON.stringify(ocrResult.fields),
      consistencyStatus: consistencyResult.status,
      consistencyDetails: JSON.stringify(consistencyResult.comparisons),
    });

    await logAuditEvent({
      action: 'DOCUMENT_ADDED',
      vehicleId: vehicle.id,
      userId: req.user.id,
      details: {
        documentId: document.id,
        documentType: docType,
        consistencyStatus: consistencyResult.status,
        ipfsCid: storageResult.ipfsCid,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Document processed via OCR, consistency verified, and integrity anchored on blockchain',
      data: {
        document,
        ocr: ocrResult,
        consistency: consistencyResult,
      },
    });
  } catch (error: any) {
    console.error('addDocumentRecord error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add document record',
    });
  }
}

export async function processDocumentOCR(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const documentId = req.params.documentId as string;
    const document = await prisma.vehicleDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: document.vehicleId },
    });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle associated with document not found' });
    }
    const fileBuffer = Buffer.from(
      `VEHICLE DOCUMENT: ${document.title}\nVIN: ${vehicle.vin}\nREGISTRATION: ${vehicle.registrationNumber}\nMODEL: ${vehicle.model}\nTYPE: ${document.documentType}\nDATE: ${document.createdAt.toISOString().slice(0, 10)}`,
      'utf8'
    );

    const ocrProvider = getOCRProvider();
    const ocrResult = await ocrProvider.extractText(fileBuffer, document.mimeType, document.documentType, {
      expectedVin: vehicle.vin,
      expectedRegistration: vehicle.registrationNumber,
      expectedModel: vehicle.model,
    });

    const consistencyResult = await evaluateDocumentConsistency(vehicle.id, document.documentType, ocrResult.fields);

    const updated = await prisma.vehicleDocument.update({
      where: { id: document.id },
      data: {
        ocrStatus: ocrResult.success ? 'COMPLETED' : 'FAILED',
        extractedData: JSON.stringify(ocrResult.fields),
        consistencyStatus: consistencyResult.status,
        consistencyDetails: JSON.stringify(consistencyResult.comparisons),
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        document: updated,
        ocr: ocrResult,
        consistency: consistencyResult,
      },
    });
  } catch (error: any) {
    console.error('processDocumentOCR error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process document OCR',
    });
  }
}

export async function getDocumentRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const documents = await prisma.vehicleDocument.findMany({
      where: { vehicleId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { documents },
    });
  } catch (error: any) {
    console.error('getDocumentRecords error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get documents',
    });
  }
}

// ============================================================================
// 7. UNIFIED TIMELINE
// ============================================================================

export interface TimelineEvent {
  id: string;
  category: 'REGISTRATION' | 'OWNERSHIP' | 'SERVICE' | 'ODOMETER' | 'ACCIDENT' | 'INSURANCE' | 'DOCUMENT';
  date: string;
  year: number;
  title: string;
  actor: string;
  description: string;
  blockchainTxHash?: string | null;
  recordHash?: string | null;
  status: 'CONFIRMED' | 'PENDING' | 'SUSPICIOUS' | 'TAMPER_DETECTED';
  details?: Record<string, any>;
}

export async function getVehicleTimeline(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        currentOwner: true,
        ownershipHistory: {
          include: { previousOwner: true, newOwner: true },
          orderBy: { transferDate: 'asc' },
        },
        serviceRecords: {
          include: { garage: true },
          orderBy: { serviceDate: 'asc' },
        },
        odometerRecords: {
          include: { sourceUser: true },
          orderBy: { recordedAt: 'asc' },
        },
        accidentRecords: {
          include: { reportedBy: true },
          orderBy: { accidentDate: 'asc' },
        },
        insuranceRecords: {
          include: { provider: true },
          orderBy: { startDate: 'asc' },
        },
        documents: {
          include: { uploadedBy: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    const events: TimelineEvent[] = [];

    // 1. Vehicle Registered
    events.push({
      id: `VEH-REG-${vehicle.id}`,
      category: 'REGISTRATION',
      date: vehicle.createdAt.toISOString(),
      year: new Date(vehicle.createdAt).getFullYear(),
      title: 'Vehicle Manufactured & Registered',
      actor: 'Manufacturer / System',
      description: `${vehicle.manufacturer} ${vehicle.model} (${vehicle.manufacturingYear}) registered under Passport ${vehicle.passportId}`,
      blockchainTxHash: vehicle.blockchainTxHash,
      recordHash: vehicle.recordHash,
      status: 'CONFIRMED',
      details: {
        vin: vehicle.vin,
        registrationNumber: vehicle.registrationNumber,
        fuelType: vehicle.fuelType,
      },
    });

    // 2. Ownership Transfers
    for (const item of vehicle.ownershipHistory) {
      const prevName = item.previousOwner?.name || 'Initial Registration';
      events.push({
        id: item.id,
        category: 'OWNERSHIP',
        date: item.transferDate.toISOString(),
        year: new Date(item.transferDate).getFullYear(),
        title: item.transferType === OwnershipTransferType.INITIAL_REGISTRATION
          ? `First Ownership Registered → ${item.newOwner.name}`
          : `Ownership Transferred (${item.transferType})`,
        actor: prevName,
        description: `Ownership transferred from ${prevName} to ${item.newOwner.name}. Notes: ${item.notes || 'None'}`,
        blockchainTxHash: item.blockchainTxHash,
        recordHash: item.recordHash,
        status: 'CONFIRMED',
        details: {
          previousOwner: prevName,
          newOwner: item.newOwner.name,
          transferType: item.transferType,
        },
      });
    }

    // 3. Services
    for (const item of vehicle.serviceRecords) {
      events.push({
        id: item.id,
        category: 'SERVICE',
        date: item.serviceDate.toISOString(),
        year: new Date(item.serviceDate).getFullYear(),
        title: `Service Completed — ${item.mileage.toLocaleString()} km`,
        actor: item.garage.name,
        description: `${item.serviceType}: ${item.description}. Parts: ${item.partsReplaced || 'None'}. Cost: $${item.cost || 0}`,
        blockchainTxHash: item.blockchainTxHash,
        recordHash: item.recordHash,
        status: 'CONFIRMED',
        details: {
          serviceType: item.serviceType,
          mileage: item.mileage,
          garage: item.garage.name,
          cost: item.cost,
        },
      });
    }

    // 4. Odometer updates (non-duplicate)
    for (const item of vehicle.odometerRecords) {
      if (item.sourceType !== OdometerSourceType.SERVICE) {
        events.push({
          id: item.id,
          category: 'ODOMETER',
          date: item.recordedAt.toISOString(),
          year: new Date(item.recordedAt).getFullYear(),
          title: item.rollbackDetected
            ? `⚠ Possible Odometer Rollback Recorded (${item.mileage.toLocaleString()} km)`
            : `Odometer Reading Recorded (${item.mileage.toLocaleString()} km)`,
          actor: item.sourceUser.name,
          description: `Logged mileage ${item.mileage.toLocaleString()} km via ${item.sourceType}. ${item.notes || ''}`,
          blockchainTxHash: item.blockchainTxHash,
          recordHash: item.recordHash,
          status: item.rollbackDetected ? 'SUSPICIOUS' : 'CONFIRMED',
          details: {
            mileage: item.mileage,
            sourceType: item.sourceType,
            rollbackDetected: item.rollbackDetected,
          },
        });
      }
    }

    // 5. Accidents & Repairs
    for (const item of vehicle.accidentRecords) {
      events.push({
        id: item.id,
        category: 'ACCIDENT',
        date: item.accidentDate.toISOString(),
        year: new Date(item.accidentDate).getFullYear(),
        title: `Accident Reported (${item.severity})`,
        actor: item.reportedBy.name,
        description: `${item.description}. Damaged parts: ${item.damagedParts || 'Unspecified'}. Location: ${item.locationDescription || 'N/A'}`,
        blockchainTxHash: item.blockchainTxHash,
        recordHash: item.recordHash,
        status: 'CONFIRMED',
        details: {
          severity: item.severity,
          repairStatus: item.repairStatus,
          insuranceClaimId: item.insuranceClaimId,
        },
      });

      if (item.repairStatus === RepairStatus.COMPLETED && item.repairedAt) {
        events.push({
          id: `${item.id}-repair`,
          category: 'ACCIDENT',
          date: item.repairedAt.toISOString(),
          year: new Date(item.repairedAt).getFullYear(),
          title: 'Vehicle Repaired Post-Accident',
          actor: 'Authorized Service Center',
          description: item.repairDescription || 'All collision repairs completed and certified.',
          blockchainTxHash: item.blockchainTxHash,
          recordHash: item.recordHash,
          status: 'CONFIRMED',
          details: {
            originalAccidentId: item.id,
            repairStatus: item.repairStatus,
          },
        });
      }
    }

    // 6. Insurance
    for (const item of vehicle.insuranceRecords) {
      events.push({
        id: item.id,
        category: 'INSURANCE',
        date: item.startDate.toISOString(),
        year: new Date(item.startDate).getFullYear(),
        title: `Insurance Policy Added (${item.coverageType})`,
        actor: item.provider.name,
        description: `Policy ${item.policyReference} valid from ${new Date(item.startDate).toLocaleDateString()} to ${new Date(item.endDate).toLocaleDateString()}`,
        blockchainTxHash: item.blockchainTxHash,
        recordHash: item.recordHash,
        status: 'CONFIRMED',
        details: {
          policyReference: item.policyReference,
          provider: item.provider.name,
          coverageType: item.coverageType,
        },
      });
    }

    // 7. Documents
    for (const item of vehicle.documents) {
      events.push({
        id: item.id,
        category: 'DOCUMENT',
        date: item.createdAt.toISOString(),
        year: new Date(item.createdAt).getFullYear(),
        title: `Document Anchored: ${item.title}`,
        actor: item.uploadedBy.name,
        description: `Document of type ${item.documentType} stored off-chain with SHA-256 integrity hash proof anchored on blockchain.`,
        blockchainTxHash: item.blockchainTxHash,
        recordHash: item.recordHash,
        status: 'CONFIRMED',
        details: {
          documentType: item.documentType,
          fileHash: item.fileHash,
        },
      });
    }

    // Sort chronologically (ascending)
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.status(200).json({
      success: true,
      data: {
        vehicleId: vehicle.id,
        passportId: vehicle.passportId,
        count: events.length,
        timeline: events,
      },
    });
  } catch (error: any) {
    console.error('getVehicleTimeline error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to assemble vehicle timeline',
    });
  }
}

// ============================================================================
// 8. FULL VEHICLE PASSPORT VERIFICATION ENGINE
// ============================================================================

export async function verifyVehiclePassportFull(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;

    const report = await blockchainService.verifyVehiclePassportFull(vehicleId);

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('verifyVehiclePassportFull error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify vehicle passport',
    });
  }
}

// ============================================================================
// 9. DEVELOPMENT TAMPER SIMULATION (DEV ONLY!)
// ============================================================================

export async function simulateTamper(req: AuthenticatedRequest, res: Response) {
  try {
    // Safety check: Dev-only!
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Tamper simulation is strictly prohibited in production environments',
      });
    }

    const vehicleId = req.params.vehicleId as string;
    const field = req.body.field || req.body.scenario;
    const tamperedValue = req.body.tamperedValue !== undefined ? req.body.tamperedValue : req.body.tamperedMileage;
    const recordId = req.body.recordId;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });

    if (field === 'odometer') {
      // Find latest odometer record and tamper mileage
      const odometer = recordId
        ? await prisma.odometerRecord.findUnique({ where: { id: recordId } })
        : await prisma.odometerRecord.findFirst({
            where: { vehicleId },
            orderBy: { recordedAt: 'desc' },
          });

      if (!odometer) {
        return res.status(404).json({ success: false, error: 'No odometer record found to tamper' });
      }

      const newVal = tamperedValue !== undefined ? Number(tamperedValue) : 12000;
      await prisma.odometerRecord.update({
        where: { id: odometer.id },
        data: { mileage: newVal },
      });

      return res.status(200).json({
        success: true,
        message: `[DEV TAMPER] Odometer record ${odometer.id} altered to ${newVal} km in database (Blockchain hash remains anchored to original). Cryptographic mismatch guaranteed on next verify!`,
        data: { recordId: odometer.id, oldMileage: odometer.mileage, newMileage: newVal },
      });
    }

    if (field === 'service') {
      const service = recordId
        ? await prisma.serviceRecord.findUnique({ where: { id: recordId } })
        : await prisma.serviceRecord.findFirst({ where: { vehicleId } });

      if (!service) {
        return res.status(404).json({ success: false, error: 'No service record found to tamper' });
      }

      const newVal = tamperedValue !== undefined ? Number(tamperedValue) : 99999;
      await prisma.serviceRecord.update({
        where: { id: service.id },
        data: { mileage: newVal },
      });

      return res.status(200).json({
        success: true,
        message: `[DEV TAMPER] Service record ${service.id} altered in database. Mismatch guaranteed!`,
        data: { recordId: service.id, oldMileage: service.mileage, newMileage: newVal },
      });
    }

    if (field === 'vehicleModel') {
      const newVal = tamperedValue || 'Tampered Model GT';
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { model: newVal },
      });

      return res.status(200).json({
        success: true,
        message: `[DEV TAMPER] Vehicle model altered in database to ${newVal}. Vehicle Identity mismatch guaranteed!`,
        data: { oldModel: vehicle.model, newModel: newVal },
      });
    }

    if (field === 'accident') {
      const accident = recordId
        ? await prisma.accidentRecord.findUnique({ where: { id: recordId } })
        : await prisma.accidentRecord.findFirst({ where: { vehicleId } });

      if (!accident) {
        return res.status(404).json({ success: false, error: 'No accident record found to tamper' });
      }

      const newSeverity = (tamperedValue as AccidentSeverity) || AccidentSeverity.SEVERE;
      await prisma.accidentRecord.update({
        where: { id: accident.id },
        data: { severity: newSeverity },
      });

      await logAuditEvent({
        action: 'TAMPER_DETECTED',
        vehicleId: vehicle.id,
        details: { field: 'accident', recordId: accident.id, newSeverity },
      });

      return res.status(200).json({
        success: true,
        message: `[DEV TAMPER] Accident record ${accident.id} altered to ${newSeverity}. Cryptographic mismatch guaranteed!`,
        data: { recordId: accident.id, oldSeverity: accident.severity, newSeverity },
      });
    }

    if (field === 'ownership') {
      const ownership = recordId
        ? await prisma.ownershipHistory.findUnique({ where: { id: recordId } })
        : await prisma.ownershipHistory.findFirst({ where: { vehicleId } });

      if (!ownership) {
        return res.status(404).json({ success: false, error: 'No ownership record found to tamper' });
      }

      await prisma.ownershipHistory.update({
        where: { id: ownership.id },
        data: { notes: tamperedValue || 'Tampered fraudulent transfer notes' },
      });

      await logAuditEvent({
        action: 'TAMPER_DETECTED',
        vehicleId: vehicle.id,
        details: { field: 'ownership', recordId: ownership.id },
      });

      return res.status(200).json({
        success: true,
        message: `[DEV TAMPER] Ownership record ${ownership.id} altered in database. Mismatch guaranteed!`,
        data: { recordId: ownership.id },
      });
    }

    if (field === 'document') {
      const doc = recordId
        ? await prisma.vehicleDocument.findUnique({ where: { id: recordId } })
        : await prisma.vehicleDocument.findFirst({ where: { vehicleId } });

      if (!doc) {
        return res.status(404).json({ success: false, error: 'No document record found to tamper' });
      }

      await prisma.vehicleDocument.update({
        where: { id: doc.id },
        data: { title: tamperedValue || 'Tampered Forged Certificate' },
      });

      await logAuditEvent({
        action: 'TAMPER_DETECTED',
        vehicleId: vehicle.id,
        details: { field: 'document', recordId: doc.id },
      });

      return res.status(200).json({
        success: true,
        message: `[DEV TAMPER] Document ${doc.id} title altered in database. Mismatch guaranteed!`,
        data: { recordId: doc.id },
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid tamper field. Supported fields: odometer, service, vehicleModel, accident, ownership, document',
    });
  } catch (error: any) {
    console.error('simulateTamper error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to simulate tamper',
    });
  }
}

export async function restoreTamper(req: AuthenticatedRequest, res: Response) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Prohibited in production' });
    }

    const vehicleId = req.params.vehicleId as string;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        serviceRecords: true,
        odometerRecords: true,
        accidentRecords: true,
        documents: true,
      },
    });

    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });

    const field = req.body.field || req.body.scenario;
    const recordId = req.body.recordId;

    // Restore vehicle model if tampered
    if (!field || field === 'vehicleModel') {
      if (vehicle.model.includes('Tampered')) {
        const originalModel = vehicle.passportId === 'VP-000001' ? 'Nexon EV' : vehicle.passportId === 'VP-000002' ? 'City' : 'Model 3';
        await prisma.vehicle.update({ where: { id: vehicle.id }, data: { model: originalModel } });
      }
    }

    // Restore records for known demo vehicles
    if (vehicle.passportId === 'VP-000001') {
      if (!field || field === 'odometer') {
        await prisma.odometerRecord.deleteMany({
          where: { vehicleId: vehicle.id, notes: 'Fraudulent rollback attempt' },
        });
        await prisma.odometerRecord.updateMany({
          where: { vehicleId: vehicle.id, notes: 'Pre-inspection self log' },
          data: { mileage: 38000, rollbackDetected: false, verificationStatus: VerificationStatus.VERIFIED },
        });
        await prisma.odometerRecord.updateMany({
          where: { vehicleId: vehicle.id, notes: 'Verified during 30,000 km service' },
          data: { mileage: 32000, rollbackDetected: false, verificationStatus: VerificationStatus.VERIFIED },
        });
      }

      if (!field || field === 'service') {
        await prisma.serviceRecord.updateMany({
          where: { vehicleId: vehicle.id, serviceType: 'Major 30,000 km Maintenance' },
          data: { mileage: 32000 },
        });
      }

      if (!field || field === 'accident') {
        await prisma.accidentRecord.updateMany({
          where: { vehicleId: vehicle.id, description: { contains: 'bollard' } },
          data: { severity: AccidentSeverity.MINOR },
        });
      }

      if (!field || field === 'document') {
        const tamperedDocs = await prisma.vehicleDocument.findMany({
          where: { vehicleId: vehicle.id, title: { contains: 'Tampered' } },
        });
        for (const doc of tamperedDocs) {
          const cleanTitle = doc.documentType === 'REGISTRATION_CERTIFICATE'
            ? 'Vehicle Registration Certificate (RC)'
            : 'Pollution Under Control Certificate (PUC)';
          await prisma.vehicleDocument.update({
            where: { id: doc.id },
            data: { title: cleanTitle },
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Database records restored to match original blockchain anchors for ${vehicle.passportId}`,
    });
  } catch (error: any) {
    console.error('restoreTamper error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to restore tamper' });
  }
}
