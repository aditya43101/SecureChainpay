import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getSystemOverview,
  getBlockchainAnalytics,
  getBlockchainRecords,
  getTamperAndAnomalyIncidents,
  createAdminCase,
  updateAdminCase,
  getDataQualityAudits,
  getAuditLogs,
  globalAdminSearch,
} from '../controllers/adminController';

const router = Router();

// Strictly restrict entire admin router to authenticated ADMIN role
router.use(authenticate, requireRole(['ADMIN']));

// 1. System-wide Overview KPIs
router.get('/overview', getSystemOverview);

// 2. Blockchain Infrastructure Analytics & Node Telemetry
router.get('/blockchain', getBlockchainAnalytics);

// 3. Searchable Blockchain Record Explorer
router.get('/explorer', getBlockchainRecords);

// 4. Tamper & Anomaly Incident Monitoring
router.get('/tamper-monitoring', getTamperAndAnomalyIncidents);

// 5. Case Management (Create & Update incident case status)
router.post('/cases', createAdminCase);
router.patch('/cases/:caseId', updateAdminCase);

// 6. Vehicle Data Quality Gaps Audits
router.get('/data-quality', getDataQualityAudits);

// 7. System Audit Trail Log Inspector
router.get('/audit-logs', getAuditLogs);

// 8. Global Cross-Entity Search
router.get('/search', globalAdminSearch);

export default router;
