import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDigitalTwin,
  getDigitalTwinTimeline,
  getDigitalTwinEvolution,
  getBuyerReport,
  getAutonomousTwin,
  getTwinEvents,
  syncTwinEvents,
  reconcileTwin,
  getReconciliationHistory,
  simulateScenario,
  getScenarioHistory,
  handoffAnomalyToInvestigation,
} from '../controllers/twinController';

const router = Router();

// All twin and buyer endpoints require authentication
router.use(authenticate);

// 1. Digital Vehicle Twin Endpoints (Phase 3 Legacy Compatibility)
router.get('/:vehicleId/digital-twin', getDigitalTwin);
router.get('/:vehicleId/digital-twin/timeline', getDigitalTwinTimeline);
router.get('/:vehicleId/digital-twin/evolution', getDigitalTwinEvolution);

// 2. Used-Car Buyer Intelligence Endpoints
router.get('/:vehicleId/buyer-report', getBuyerReport);

// 3. Phase 10: Autonomous Digital Vehicle Twin Endpoints
router.get('/:vehicleId/digital-twin/autonomous', getAutonomousTwin);
router.get('/:vehicleId/digital-twin/events', getTwinEvents);
router.post('/:vehicleId/digital-twin/sync', syncTwinEvents);
router.post('/:vehicleId/digital-twin/reconcile', reconcileTwin);
router.get('/:vehicleId/digital-twin/reconciliations', getReconciliationHistory);
router.post('/:vehicleId/digital-twin/simulate', simulateScenario);
router.get('/:vehicleId/digital-twin/scenarios', getScenarioHistory);
router.post('/:vehicleId/digital-twin/investigate', handoffAnomalyToInvestigation);

export default router;
