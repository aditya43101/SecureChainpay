import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getManufacturerCertificate,
  createManufacturerCertificate,
  getBatteryPassport,
  createBatteryPassport,
  logBatteryEvent,
  getInsuranceIntelligence,
  fileInsuranceClaim,
  getGarageProfile,
  updateGarageProfile,
  getVehicleGarageIntelligence,
  getVehicleEcosystem,
  getEcosystemTimeline,
} from '../controllers/ecosystemController';

const router = Router({ mergeParams: true });

// 1. Digital Birth Certificate
router.get('/:vehicleId/birth-certificate', authenticate, getManufacturerCertificate);
router.post('/:vehicleId/birth-certificate', authenticate, createManufacturerCertificate);

// 2. EV Battery Passport
router.get('/:vehicleId/battery-passport', authenticate, getBatteryPassport);
router.post('/:vehicleId/battery-passport', authenticate, createBatteryPassport);
router.post('/:vehicleId/battery/events', authenticate, logBatteryEvent);

// 3. Insurance Intelligence & Claims
router.get('/:vehicleId/insurance-intelligence', authenticate, getInsuranceIntelligence);
router.post('/:vehicleId/insurance/claims', authenticate, fileInsuranceClaim);

// 4. Garage Verification Intelligence
router.get('/:vehicleId/garage-intelligence', authenticate, getVehicleGarageIntelligence);

// 5. Consolidated Vehicle Ecosystem & Timeline
router.get('/:vehicleId/ecosystem', authenticate, getVehicleEcosystem);
router.get('/:vehicleId/ecosystem/timeline', authenticate, getEcosystemTimeline);

export default router;
