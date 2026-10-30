import { Router } from 'express';
import {
  getMyVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
} from '../controllers/vehicleController';
import { getVehicleBlockchainVerificationHandler } from '../controllers/batchController';
import { authenticate, requireInitialized } from '../middleware/auth';

const router = Router();

// All vehicle operations require authentication
router.use(authenticate);

// Get current user's vehicles
router.get('/', getMyVehicles);

// Phase 6: Detailed blockchain & batch verification
router.get('/:vehicleId/blockchain-verification', getVehicleBlockchainVerificationHandler);

// Get specific vehicle passport details
router.get('/:id', getVehicleById);

// Create new vehicle passport (requires initialized user)
router.post('/', requireInitialized, createVehicle);

// Update vehicle details (owner only)
router.put('/:id', requireInitialized, updateVehicle);
router.patch('/:id', requireInitialized, updateVehicle);

export default router;
