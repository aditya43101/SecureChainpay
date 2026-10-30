import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createDisclosure,
  getVehicleDisclosures,
  revokeDisclosure,
} from '../controllers/privacyController';

const router = Router({ mergeParams: true });

// All vehicle disclosure management routes require authentication
router.use(authenticate);

// 1. Create a selective disclosure profile for this vehicle
router.post('/', createDisclosure);

// 2. List all disclosure profiles generated for this vehicle
router.get('/', getVehicleDisclosures);

// 3. Revoke a generated disclosure profile
router.post('/:shareId/revoke', revokeDisclosure);

export default router;
