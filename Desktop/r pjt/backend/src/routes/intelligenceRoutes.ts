import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getVehicleIntelligenceReport,
  getVehicleHealthAssessment,
  getVehicleAnomalies,
  getVehicleRiskAssessment,
  getPredictiveMaintenance,
  askVehicleIntelligenceQuestion,
} from '../controllers/intelligenceController';

const router = Router();

// Consolidated Intelligence Report
router.get('/:vehicleId/intelligence', authenticate, getVehicleIntelligenceReport);
router.get('/:vehicleId/intelligence/report', authenticate, getVehicleIntelligenceReport);

// Component Endpoints
router.get('/:vehicleId/health', authenticate, getVehicleHealthAssessment);
router.get('/:vehicleId/anomalies', authenticate, getVehicleAnomalies);
router.get('/:vehicleId/risk', authenticate, getVehicleRiskAssessment);
router.get('/:vehicleId/maintenance', authenticate, getPredictiveMaintenance);

// Evidence-Grounded AI Assistant Q&A
router.post('/:vehicleId/intelligence/ask', authenticate, askVehicleIntelligenceQuestion);

export default router;
