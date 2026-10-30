import { Request, Response } from 'express';
import { DigitalTwinService } from '../services/twin/DigitalTwinService';
import { BuyerIntelligenceService } from '../services/twin/BuyerIntelligenceService';
import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';

const twinService = DigitalTwinService.getInstance();
const buyerService = BuyerIntelligenceService.getInstance();

/**
 * Validates that requesting user owns the vehicle or has elevated access (Admin, Garage).
 */
async function authorizeVehicleAccess(
  vehicleId: string,
  user: { id: string; role: UserRole }
): Promise<boolean> {
  if (user.role === UserRole.ADMIN || user.role === UserRole.GARAGE) {
    return true;
  }
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { currentOwnerId: true },
  });
  if (!vehicle) return false;
  return vehicle.currentOwnerId === user.id;
}

/**
 * GET /api/vehicles/:vehicleId/digital-twin
 * Returns the fully reconstructed Digital Vehicle Twin state.
 */
export async function getDigitalTwin(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to access this Digital Vehicle Twin',
      });
      return;
    }

    const twin = await twinService.reconstructDigitalTwin(vehicleId);
    res.status(200).json({ success: true, data: twin });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getDigitalTwin:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reconstruct Digital Vehicle Twin',
    });
  }
}

/**
 * GET /api/vehicles/:vehicleId/digital-twin/timeline
 * Returns the unified chronological lifecycle timeline with evidence tags.
 */
export async function getDigitalTwinTimeline(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const twin = await twinService.reconstructDigitalTwin(vehicleId);
    res.status(200).json({
      success: true,
      data: {
        vehicleId,
        passportId: twin.passportId,
        count: twin.timeline.length,
        timeline: twin.timeline,
      },
    });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getDigitalTwinTimeline:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch twin timeline' });
  }
}

/**
 * GET /api/vehicles/:vehicleId/digital-twin/evolution
 * Returns the state transition history of the vehicle.
 */
export async function getDigitalTwinEvolution(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const twin = await twinService.reconstructDigitalTwin(vehicleId);
    res.status(200).json({
      success: true,
      data: {
        vehicleId,
        passportId: twin.passportId,
        count: twin.stateEvolution.length,
        evolution: twin.stateEvolution,
      },
    });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getDigitalTwinEvolution:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch twin evolution' });
  }
}

/**
 * GET /api/vehicles/:vehicleId/buyer-report
 * Returns the complete authenticated Used-Car Buyer Intelligence Report.
 */
export async function getBuyerReport(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const report = await buyerService.getBuyerReport(vehicleId);
    res.status(200).json({ success: true, data: report });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getBuyerReport:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate buyer report' });
  }
}

/**
 * GET /api/public/passport/:passportId/buyer-summary
 * Returns the sanitized public used-car buyer summary (No PII, unauthenticated).
 */
export async function getPublicBuyerSummary(req: Request, res: Response): Promise<void> {
  try {
    const passportId = String(req.params.passportId);
    if (!passportId) {
      res.status(400).json({ success: false, error: 'Passport ID required' });
      return;
    }

    const summary = await buyerService.getPublicBuyerSummary(passportId);
    res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getPublicBuyerSummary:', error);
    if (error.message?.includes('not found')) {
      res.status(404).json({ success: false, error: 'Vehicle passport not found' });
      return;
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to generate public buyer summary' });
  }
}

// ============================================================================
// PHASE 10: AUTONOMOUS DIGITAL VEHICLE TWIN CONTROLLERS
// ============================================================================

import { TwinEventProcessor } from '../services/twin/TwinEventProcessor';
import { TwinReconciliationService } from '../services/twin/TwinReconciliationService';
import { TwinScenarioService } from '../services/twin/TwinScenarioService';

const eventProcessor = TwinEventProcessor.getInstance();
const reconciliationService = TwinReconciliationService.getInstance();
const scenarioService = TwinScenarioService.getInstance();

/**
 * GET /api/vehicles/:vehicleId/digital-twin/autonomous
 * Returns the complete Phase 10 Autonomous Digital Vehicle Twin with 5-way ontology and provenance.
 */
export async function getAutonomousTwin(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to access this Digital Vehicle Twin',
      });
      return;
    }

    const twin = await twinService.getAutonomousDigitalTwin(vehicleId);
    res.status(200).json({ success: true, data: twin });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getAutonomousTwin:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Autonomous Digital Vehicle Twin',
    });
  }
}

/**
 * GET /api/vehicles/:vehicleId/digital-twin/events
 * Returns the event-sourced lifecycle timeline stream.
 */
export async function getTwinEvents(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const events = await eventProcessor.getEventTimeline(vehicleId);
    res.status(200).json({
      success: true,
      data: {
        vehicleId,
        count: events.length,
        events,
      },
    });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getTwinEvents:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch twin events' });
  }
}

/**
 * POST /api/vehicles/:vehicleId/digital-twin/sync
 * Manually or automatically synchronizes authoritative DB records into the twin event stream.
 */
export async function syncTwinEvents(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const syncResult = await eventProcessor.syncAuthoritativeEvents(vehicleId);
    res.status(200).json({
      success: true,
      message: 'Twin event stream synchronized successfully.',
      data: syncResult,
    });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] syncTwinEvents:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to sync twin events' });
  }
}

/**
 * POST /api/vehicles/:vehicleId/digital-twin/reconcile
 * Executes authoritative record reconciliation, detects drift, and repairs projection safely.
 */
export async function reconcileTwin(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    if (!['ADMIN', 'INSPECTOR', 'AUTHORITY', 'GOVERNMENT'].includes(user.role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Operational reconciliation requires administrative or auditor privileges.',
      });
      return;
    }

    const result = await reconciliationService.reconcileVehicleTwin(vehicleId, user.id);
    res.status(200).json({
      success: true,
      message: 'Twin reconciliation completed.',
      data: result,
    });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] reconcileTwin:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to reconcile vehicle twin' });
  }
}

/**
 * GET /api/vehicles/:vehicleId/digital-twin/reconciliations
 * Retrieves past reconciliation audit runs.
 */
export async function getReconciliationHistory(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const history = await reconciliationService.getReconciliationHistory(vehicleId);
    res.status(200).json({ success: true, data: history });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getReconciliationHistory:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch reconciliation history' });
  }
}

/**
 * POST /api/vehicles/:vehicleId/digital-twin/simulate
 * Executes an isolated what-if hypothetical scenario without modifying authoritative records.
 */
export async function simulateScenario(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;
    const { scenarioType, inputs } = req.body;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!scenarioType || !inputs) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: scenarioType and inputs are required.',
      });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const result = await scenarioService.simulateScenario(vehicleId, user.id, {
      scenarioType,
      inputs,
    });

    res.status(200).json({
      success: true,
      message: 'Hypothetical scenario simulated successfully in memory isolation.',
      data: result,
    });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] simulateScenario:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to simulate scenario' });
  }
}

/**
 * GET /api/vehicles/:vehicleId/digital-twin/scenarios
 * Retrieves past scenario simulations for this vehicle.
 */
export async function getScenarioHistory(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const history = await scenarioService.getScenarioHistory(vehicleId);
    res.status(200).json({ success: true, data: history });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] getScenarioHistory:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch scenario history' });
  }
}

/**
 * POST /api/vehicles/:vehicleId/digital-twin/investigate
 * Hands off a detected twin anomaly to the Phase 8 Autonomous Investigation Agent.
 */
export async function handoffAnomalyToInvestigation(req: Request, res: Response): Promise<void> {
  try {
    const vehicleId = String(req.params.vehicleId);
    const user = (req as any).user;
    const { anomalyId, reason, investigationType } = req.body;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!reason) {
      res.status(400).json({ success: false, error: 'Reason for investigation is required.' });
      return;
    }

    const hasAccess = await authorizeVehicleAccess(vehicleId, user);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const run = await twinService.handoffToInvestigation(vehicleId, user.id, user.role, {
      anomalyId,
      reason,
      investigationType,
    });

    res.status(201).json({
      success: true,
      message: 'Autonomous investigation initiated from twin anomaly.',
      data: run,
    });
  } catch (error: any) {
    console.error('[TWIN CONTROLLER ERROR] handoffAnomalyToInvestigation:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to initiate investigation from twin anomaly',
    });
  }
}
