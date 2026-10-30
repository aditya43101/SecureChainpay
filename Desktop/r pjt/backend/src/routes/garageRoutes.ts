import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getGarageProfile,
  updateGarageProfile,
} from '../controllers/ecosystemController';

const router = Router();

router.get('/:garageId/profile', getGarageProfile);
router.put('/:garageId/profile', authenticate, updateGarageProfile);

export default router;
