import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  transferOwnership,
  getOwnershipHistory,
  addServiceRecord,
  getServiceRecords,
  addOdometerRecord,
  getOdometerRecords,
  addAccidentRecord,
  updateAccidentRepair,
  getAccidentRecords,
  addInsuranceRecord,
  getInsuranceRecords,
  addDocumentRecord,
  processDocumentOCR,
  getDocumentRecords,
  getVehicleTimeline,
  verifyVehiclePassportFull,
  simulateTamper,
  restoreTamper,
} from '../controllers/lifecycleController';

const router = Router();

// All lifecycle operations require authentication
router.use(authenticate);

// 1. Ownership History & Transfer
router.post('/:vehicleId/ownership/transfer', transferOwnership);
router.get('/:vehicleId/ownership', getOwnershipHistory);

// 2. Service Records
router.post('/:vehicleId/services', addServiceRecord);
router.get('/:vehicleId/services', getServiceRecords);

// 3. Odometer Records
router.post('/:vehicleId/odometer', addOdometerRecord);
router.get('/:vehicleId/odometer', getOdometerRecords);

// 4. Accident & Repair Records
router.post('/:vehicleId/accidents', addAccidentRecord);
router.patch('/:vehicleId/accidents/:accidentId/repair', updateAccidentRepair);
router.get('/:vehicleId/accidents', getAccidentRecords);

// 5. Insurance Records
router.post('/:vehicleId/insurance', addInsuranceRecord);
router.get('/:vehicleId/insurance', getInsuranceRecords);

// 6. Documents & OCR
router.post('/:vehicleId/documents', addDocumentRecord);
router.post('/:vehicleId/documents/:documentId/ocr', processDocumentOCR);
router.get('/:vehicleId/documents', getDocumentRecords);

// 7. Unified Timeline
router.get('/:vehicleId/timeline', getVehicleTimeline);

// 8. Full Multi-Category Verification Engine
router.get('/:vehicleId/verify', verifyVehiclePassportFull);
router.get('/:vehicleId/verify-full', verifyVehiclePassportFull);

// 9. Development Tamper Simulation (Dev Only)
router.post('/:vehicleId/simulate-tamper', simulateTamper);
router.post('/:vehicleId/tamper', simulateTamper);
router.post('/:vehicleId/restore-tamper', restoreTamper);

export default router;
