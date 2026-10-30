import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getGraphOverviewHandler,
  getVehicleGraphHandler,
  getEntityNeighborhoodHandler,
  getFindingsHandler,
  getFindingDetailsHandler,
  updateFindingHandler,
  createInvestigationCaseHandler,
  getInvestigationCasesHandler,
  reconcileGraphHandler,
  findEvidencePathHandler,
} from '../controllers/fraudGraphController';

const router = Router();

// Graph Overview Metrics
router.get('/overview', authenticate, getGraphOverviewHandler);

// Vehicle Graph Extraction
router.get('/vehicles/:vehicleId', authenticate, getVehicleGraphHandler);

// Generic Entity Neighborhood Extraction
router.get('/entities/:entityType/:entityId', authenticate, getEntityNeighborhoodHandler);

// Finding Queries & Detail Inspection
router.get('/findings', authenticate, getFindingsHandler);
router.get('/findings/:findingId', authenticate, getFindingDetailsHandler);

// Finding Status Updates (Admin Reviewer Action)
router.patch('/findings/:findingId', authenticate, requireRole(['ADMIN']), updateFindingHandler);

// Investigation Cases Management
router.get(
  '/investigations',
  authenticate,
  requireRole(['ADMIN', 'INSURANCE_PROVIDER']),
  getInvestigationCasesHandler
);
router.post(
  '/investigations',
  authenticate,
  requireRole(['ADMIN']),
  createInvestigationCaseHandler
);

// Manual Graph Projection & Rules Re-Evaluation
router.post('/reconcile', authenticate, requireRole(['ADMIN']), reconcileGraphHandler);

// Relationship Pathfinding
router.get('/path', authenticate, findEvidencePathHandler);

export default router;
