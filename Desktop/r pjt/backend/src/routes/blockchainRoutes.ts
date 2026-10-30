import { Router } from 'express';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth';
import {
  initializeBlockchainUser,
  registerVehicleOnBlockchain,
  getVehicleBlockchainInfo,
  verifyVehiclePassport,
  getBlockchainUser,
} from '../controllers/blockchainController';
import {
  createBatchHandler,
  listBatchesHandler,
  getEligibleRecordsHandler,
  getBatchDetailsHandler,
  getRecordProofHandler,
  reconcileBatchHandler,
  verifyBatchRecordHandler,
  verifyProofDirectHandler,
} from '../controllers/batchController';

const router = Router();

// ============================================================================
// PHASE 6: MERKLE BATCH ANCHORING & PROOF VERIFICATION
// ============================================================================

// Batch listing and details (open to both authenticated & public verification queries)
router.get('/batches', optionalAuthenticate, listBatchesHandler);
router.get('/batches/eligible', authenticate, getEligibleRecordsHandler);
router.get('/batches/:batchId', optionalAuthenticate, getBatchDetailsHandler);
router.get('/batches/:batchId/proof/:recordId', optionalAuthenticate, getRecordProofHandler);

// Batch creation & reconciliation (restricted to ADMIN, GARAGE, MANUFACTURER)
router.post(
  '/batches',
  authenticate,
  requireRole(['ADMIN', 'GARAGE', 'MANUFACTURER']),
  createBatchHandler
);
router.post(
  '/batches/:batchId/reconcile',
  authenticate,
  requireRole(['ADMIN', 'GARAGE', 'MANUFACTURER']),
  reconcileBatchHandler
);

// Proof verification endpoints
router.post('/batches/:batchId/verify', optionalAuthenticate, verifyBatchRecordHandler);
router.post('/verify-proof', optionalAuthenticate, verifyProofDirectHandler);

// ============================================================================
// LEGACY & USER / VEHICLE ON-CHAIN OPERATIONS
// ============================================================================

// User blockchain initialization
router.post('/user/initialize', authenticate, initializeBlockchainUser);
router.get('/user/:userId', authenticate, getBlockchainUser);

// Vehicle blockchain operations
router.post('/vehicle/:vehicleId/register', authenticate, registerVehicleOnBlockchain);
router.get('/vehicle/:vehicleId', authenticate, getVehicleBlockchainInfo);
router.get('/vehicle/:vehicleId/verify', authenticate, verifyVehiclePassport);

export default router;
