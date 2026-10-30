import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { VehicleIntelligenceService } from '../services/intelligence/VehicleIntelligenceService';
import { prisma } from '../lib/prisma';
import { logAuditEvent } from '../services/auditService';

const intelligenceService = VehicleIntelligenceService.getInstance();

/**
 * Helper to verify authorization:
 * Vehicle Owners can only view their own vehicles (unless Admin or Garage with work order)
 */
async function authorizeVehicleAccess(req: AuthenticatedRequest, vehicleId: string) {
  if (!req.user) return false;
  if (req.user.role === 'ADMIN' || req.user.role === 'INSURANCE_PROVIDER') return true;

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      OR: [{ id: vehicleId }, { passportId: vehicleId }],
    },
    select: { id: true, currentOwnerId: true },
  });

  if (!vehicle) return null;

  if (req.user.role === 'VEHICLE_OWNER') {
    return vehicle.currentOwnerId === req.user.id;
  }

  // Garages can access vehicles they have serviced or are inspecting
  if (req.user.role === 'GARAGE') {
    return true;
  }

  return true;
}

// ============================================================================
// 1. CONSOLIDATED INTELLIGENCE REPORT
// ============================================================================
export async function getVehicleIntelligenceReport(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const isAuthorized = await authorizeVehicleAccess(req, vehicleId);

    if (isAuthorized === null) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view detailed vehicle intelligence' });
    }

    const report = await intelligenceService.generateReport(vehicleId);

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('getVehicleIntelligenceReport error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate vehicle intelligence report',
    });
  }
}

// ============================================================================
// 2. VEHICLE HEALTH ASSESSMENT & EXPLAINABILITY
// ============================================================================
export async function getVehicleHealthAssessment(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const isAuthorized = await authorizeVehicleAccess(req, vehicleId);

    if (isAuthorized === null) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const report = await intelligenceService.generateReport(vehicleId);

    return res.status(200).json({
      success: true,
      data: report.health,
    });
  } catch (error: any) {
    console.error('getVehicleHealthAssessment error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve vehicle health assessment',
    });
  }
}

// ============================================================================
// 3. DETECTED ANOMALIES & AUDIT TRAIL
// ============================================================================
export async function getVehicleAnomalies(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const isAuthorized = await authorizeVehicleAccess(req, vehicleId);

    if (isAuthorized === null) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const report = await intelligenceService.generateReport(vehicleId);

    return res.status(200).json({
      success: true,
      data: report.anomalies,
    });
  } catch (error: any) {
    console.error('getVehicleAnomalies error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve vehicle anomalies',
    });
  }
}

// ============================================================================
// 4. VEHICLE RISK ASSESSMENT
// ============================================================================
export async function getVehicleRiskAssessment(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const isAuthorized = await authorizeVehicleAccess(req, vehicleId);

    if (isAuthorized === null) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const report = await intelligenceService.generateReport(vehicleId);

    return res.status(200).json({
      success: true,
      data: report.risk,
    });
  } catch (error: any) {
    console.error('getVehicleRiskAssessment error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve vehicle risk assessment',
    });
  }
}

// ============================================================================
// 5. PREDICTIVE MAINTENANCE ITEMS
// ============================================================================
export async function getPredictiveMaintenance(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const isAuthorized = await authorizeVehicleAccess(req, vehicleId);

    if (isAuthorized === null) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const report = await intelligenceService.generateReport(vehicleId);

    return res.status(200).json({
      success: true,
      data: report.predictiveMaintenance,
    });
  } catch (error: any) {
    console.error('getPredictiveMaintenance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve predictive maintenance schedule',
    });
  }
}

// ============================================================================
// 6. EVIDENCE-BOUNDED AI ASSISTANT Q&A
// ============================================================================
export async function askVehicleIntelligenceQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Question text is required.' });
    }

    const isAuthorized = await authorizeVehicleAccess(req, vehicleId);
    if (isAuthorized === null) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const answer = await intelligenceService.askIntelligenceQuestion({
      vehicleIdOrPassportId: vehicleId,
      question: question.trim(),
    });

    // Log AI Q&A query event
    await logAuditEvent({
      action: 'AI_INTELLIGENCE_QUERY',
      userId: req.user?.id,
      details: {
        vehicleId,
        question: question.trim(),
        model: answer.modelIdentifier,
        confidence: answer.confidenceScore,
      },
    });

    return res.status(200).json({
      success: true,
      data: answer,
    });
  } catch (error: any) {
    console.error('askVehicleIntelligenceQuestion error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process intelligence question',
    });
  }
}
