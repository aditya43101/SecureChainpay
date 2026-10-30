import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getPublicPassportVerification,
  getBlockchainExplorerOverview,
  getBlockchainExplorerTransactions,
  getPublicSystemAlerts,
} from '../controllers/publicController';
import { getPublicBuyerSummary } from '../controllers/twinController';
import { getPublicEcosystemSummary } from '../controllers/ecosystemController';
import { getSharedPassport } from '../controllers/privacyController';

const router = Router();

// Strict rate limiter for public verification endpoint (prevents scraping/DDoS)
const publicVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many verification queries from this IP. Please wait a few minutes.',
    },
  },
});

// Explorer rate limiter
const explorerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many explorer requests. Please slow down.',
    },
  },
});

// 1. Public Vehicle Passport Verification (Unauthenticated)
router.get('/passport/:passportId', publicVerifyLimiter, getPublicPassportVerification);
router.get('/verify/:passportId', publicVerifyLimiter, getPublicPassportVerification); // Alias

// 2. Public Used-Car Buyer Intelligence Summary (Unauthenticated, Sanitized)
router.get('/passport/:passportId/buyer-summary', publicVerifyLimiter, getPublicBuyerSummary);
router.get('/verify/:passportId/buyer-summary', publicVerifyLimiter, getPublicBuyerSummary); // Alias

// 3. Public Vehicle Ecosystem Summary (Unauthenticated, Sanitized)
router.get('/passport/:passportId/ecosystem-summary', publicVerifyLimiter, getPublicEcosystemSummary);
router.get('/verify/:passportId/ecosystem-summary', publicVerifyLimiter, getPublicEcosystemSummary); // Alias

// 4. Public Selective Disclosure Shared Passport (Unauthenticated, Scope-Filtered, Sanitized)
router.get('/share/:shareId', publicVerifyLimiter, getSharedPassport);
router.get('/verify/share/:shareId', publicVerifyLimiter, getSharedPassport); // Alias

// 5. Public Blockchain Explorer (Unauthenticated)
router.get('/explorer/overview', explorerLimiter, getBlockchainExplorerOverview);
router.get('/explorer/transactions', explorerLimiter, getBlockchainExplorerTransactions);

// 6. Public System Alerts (Unauthenticated)
router.get('/alerts', explorerLimiter, getPublicSystemAlerts);

export default router;
