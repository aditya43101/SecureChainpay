import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  issuePrivacyCredential,
  getVehiclePrivacyCredentials,
  revokePrivacyCredential,
  createVerificationChallenge,
  createSelectiveDisclosure,
  verifySelectiveDisclosure,
  generateZkpRangeProof,
  verifyZkpRangeProof,
  getPrivacyDisclosureLogs,
} from '../controllers/privacyController';

const router = Router();

// --- Ephemeral Challenge Generation (Replay Protection) ---
router.post('/challenge', authenticate, createVerificationChallenge);

// --- Privacy Credentials ---
router.post('/credentials', authenticate, issuePrivacyCredential);
router.get('/credentials/vehicle/:vehicleId', authenticate, getVehiclePrivacyCredentials);
router.post('/credentials/:credentialId/revoke', authenticate, revokePrivacyCredential);

// --- Selective Disclosure Presentations ---
router.post('/selective-disclosure/create', authenticate, createSelectiveDisclosure);
// Independent verification is publicly accessible so any buyer/regulator/verifier can verify without an account
router.post('/selective-disclosure/verify', verifySelectiveDisclosure);

// --- Zero-Knowledge Range Proofs ---
router.post('/zkp/generate-range-proof', authenticate, generateZkpRangeProof);
// Independent ZKP verification is publicly accessible
router.post('/zkp/verify-range-proof', verifyZkpRangeProof);

// --- Audit & Disclosure Logs ---
router.get('/disclosure-logs/vehicle/:vehicleId', authenticate, getPrivacyDisclosureLogs);

export default router;
