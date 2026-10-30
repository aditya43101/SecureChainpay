import { Router } from 'express';
import {
  syncUser,
  getMe,
  initializeUser,
  setOnboardingStatus,
  logout,
  getTestUsers,
  devLogin,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public auth endpoints
router.post('/sync', syncUser);
router.get('/test-users', getTestUsers);
router.post('/dev-login', devLogin);

// Protected auth endpoints
router.get('/me', authenticate, getMe);
router.post('/initialize', authenticate, initializeUser);
router.post('/initialize-passport', authenticate, initializeUser); // alias
router.post('/onboarding', authenticate, setOnboardingStatus);
router.post('/logout', authenticate, logout);

export default router;
