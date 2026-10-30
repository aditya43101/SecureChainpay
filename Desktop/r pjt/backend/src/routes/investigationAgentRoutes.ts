import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createInvestigationHandler,
  listInvestigationsHandler,
  getInvestigationHandler,
  cancelInvestigationHandler,
  getInvestigationReportHandler,
  getInvestigationEvidenceHandler,
  getInvestigationTimelineHandler,
  getInvestigationOverviewHandler,
  listAvailableToolsHandler,
} from '../controllers/investigationAgentController';

const router = Router();

// Enforce authentication on all investigation agent endpoints
router.use(authenticate);

// Overview metrics & available tools
router.get('/overview', getInvestigationOverviewHandler);
router.get('/stats/overview', getInvestigationOverviewHandler);
router.get('/tools', listAvailableToolsHandler);

// Investigation Runs Lifecycle
router.post('/', createInvestigationHandler);
router.get('/', listInvestigationsHandler);
router.get('/:id', getInvestigationHandler);
router.post('/:id/cancel', cancelInvestigationHandler);

// Investigation Artifacts & Evidence
router.get('/:id/report', getInvestigationReportHandler);
router.get('/:id/evidence', getInvestigationEvidenceHandler);
router.get('/:id/timeline', getInvestigationTimelineHandler);

export default router;
