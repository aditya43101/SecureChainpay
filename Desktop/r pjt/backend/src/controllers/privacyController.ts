import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { SelectiveDisclosureService } from '../services/privacy/SelectiveDisclosureService';

const disclosureService = new SelectiveDisclosureService();

/**
 * POST /api/vehicles/:vehicleId/disclosures
 * Create a new Selective Disclosure profile for a vehicle
 */
export async function createDisclosure(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { title, categories, expiresInDays } = req.body;

    const result = await disclosureService.createDisclosure(vehicleId, userId, userRole, {
      title,
      categories,
      expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : null,
    });

    return res.status(201).json({
      success: true,
      message: 'Shareable verification profile generated successfully.',
      data: result,
    });
  } catch (error: any) {
    console.error('createDisclosure error:', error);
    if (error.message === 'VEHICLE_NOT_FOUND') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found.' } });
    }
    if (error.message === 'FORBIDDEN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the vehicle owner or administrator can generate share profiles.' } });
    }
    if (error.message === 'INVALID_CATEGORIES' || error.message === 'NO_VALID_CATEGORIES_SELECTED') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CATEGORIES', message: 'Please select at least one valid category to disclose.' } });
    }
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create shareable disclosure profile.' } });
  }
}

/**
 * GET /api/vehicles/:vehicleId/disclosures
 * List all generated disclosures for a vehicle
 */
export async function getVehicleDisclosures(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const profiles = await disclosureService.getVehicleDisclosures(vehicleId, userId, userRole);
    return res.status(200).json({
      success: true,
      data: profiles,
    });
  } catch (error: any) {
    console.error('getVehicleDisclosures error:', error);
    if (error.message === 'FORBIDDEN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized to view disclosure history.' } });
    }
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve disclosures.' } });
  }
}

/**
 * POST /api/vehicles/:vehicleId/disclosures/:shareId/revoke
 * Revoke an active share profile
 */
export async function revokeDisclosure(req: AuthenticatedRequest, res: Response) {
  try {
    const shareId = req.params.shareId as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const result = await disclosureService.revokeDisclosure(shareId, userId, userRole);
    return res.status(200).json({
      success: true,
      message: 'Shareable vehicle report has been revoked.',
      data: result,
    });
  } catch (error: any) {
    console.error('revokeDisclosure error:', error);
    if (error.message === 'DISCLOSURE_NOT_FOUND') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Share profile not found.' } });
    }
    if (error.message === 'ALREADY_REVOKED') {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_REVOKED', message: 'Share profile has already been revoked.' } });
    }
    if (error.message === 'FORBIDDEN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized to revoke this share profile.' } });
    }
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to revoke disclosure.' } });
  }
}

/**
 * GET /api/public/share/:shareId
 * Public unauthenticated view of shared vehicle report
 */
export async function getSharedPassport(req: Request, res: Response) {
  try {
    const shareId = req.params.shareId as string;
    if (!shareId || !shareId.startsWith('sh_')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SHARE_ID', message: 'Invalid share identifier format.' },
      });
    }

    const sharedReport = await disclosureService.getSharedPassport(shareId, req.ip);
    return res.status(200).json({
      success: true,
      data: sharedReport,
    });
  } catch (error: any) {
    if (error.code === 'DISCLOSURE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'DISCLOSURE_NOT_FOUND', message: 'The requested share link does not exist.' },
      });
    }
    if (error.code === 'DISCLOSURE_REVOKED') {
      return res.status(410).json({
        success: false,
        error: {
          code: 'DISCLOSURE_REVOKED',
          message: 'This vehicle disclosure is no longer available because it has been revoked by the owner.',
        },
      });
    }
    if (error.code === 'DISCLOSURE_EXPIRED') {
      return res.status(410).json({
        success: false,
        error: {
          code: 'DISCLOSURE_EXPIRED',
          message: 'This shareable verification report has expired.',
        },
      });
    }
    console.error('getSharedPassport error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An error occurred while loading the shared vehicle report.' },
    });
  }
}

// ============================================================================
// PHASE 9: ADVANCED PRIVACY-PRESERVING & ZERO-KNOWLEDGE VERIFICATION
// ============================================================================

import { credentialService } from '../services/privacy/credentialService';

/**
 * POST /api/privacy/credentials
 * Issues a privacy-preserving credential with salt-blinded attributes and Pedersen commitment
 */
export async function issuePrivacyCredential(req: AuthenticatedRequest, res: Response) {
  try {
    const issuerId = req.user!.id;
    const { vehicleId, credentialType, attributes, numericalWitness, validityDays } = req.body;

    if (!vehicleId || !credentialType || !attributes) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'vehicleId, credentialType, and attributes are required.' },
      });
    }

    const credential = await credentialService.issueCredential({
      vehicleId,
      issuerId,
      credentialType,
      attributes,
      numericalWitness,
      validityDays,
    });

    return res.status(201).json({
      success: true,
      message: 'Privacy credential successfully issued and cryptographically committed.',
      data: credential,
    });
  } catch (err: any) {
    console.error('issuePrivacyCredential error:', err);
    return res.status(400).json({
      success: false,
      error: { code: 'ISSUANCE_FAILED', message: err.message },
    });
  }
}

/**
 * GET /api/privacy/credentials/vehicle/:vehicleId
 * Retrieves all privacy credentials issued for a vehicle
 */
export async function getVehiclePrivacyCredentials(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const credentials = await credentialService.getVehicleCredentials(vehicleId);

    return res.status(200).json({
      success: true,
      data: credentials,
    });
  } catch (err: any) {
    console.error('getVehiclePrivacyCredentials error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/privacy/credentials/:credentialId/revoke
 * Revokes a privacy credential
 */
export async function revokePrivacyCredential(req: AuthenticatedRequest, res: Response) {
  try {
    const credentialId = req.params.credentialId as string;
    const revokerId = req.user!.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Revocation reason is required.' },
      });
    }

    const result = await credentialService.revokeCredential(credentialId, revokerId, reason);
    return res.status(200).json({
      success: true,
      message: 'Credential successfully revoked.',
      data: result,
    });
  } catch (err: any) {
    console.error('revokePrivacyCredential error:', err);
    return res.status(400).json({
      success: false,
      error: { code: 'REVOCATION_FAILED', message: err.message },
    });
  }
}

/**
 * POST /api/privacy/challenge
 * Creates an ephemeral verifier challenge nonce to protect against proof replay attacks
 */
export async function createVerificationChallenge(req: AuthenticatedRequest, res: Response) {
  try {
    const { vehicleId, claimType, policyThreshold } = req.body;
    const verifierId = req.user?.id;

    if (!vehicleId || !claimType) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'vehicleId and claimType are required.' },
      });
    }

    const challenge = await credentialService.createVerificationChallenge({
      vehicleId,
      claimType,
      policyThreshold: policyThreshold ? Number(policyThreshold) : undefined,
      verifierId,
    });

    return res.status(200).json({
      success: true,
      data: challenge,
    });
  } catch (err: any) {
    console.error('createVerificationChallenge error:', err);
    return res.status(400).json({
      success: false,
      error: { code: 'CHALLENGE_FAILED', message: err.message },
    });
  }
}

/**
 * POST /api/privacy/selective-disclosure/create
 * Builds a selective disclosure presentation revealing only requested attributes
 */
export async function createSelectiveDisclosure(req: AuthenticatedRequest, res: Response) {
  try {
    const { credentialId, discloseKeys } = req.body;
    const userId = req.user!.id;

    if (!credentialId || !Array.isArray(discloseKeys) || discloseKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'credentialId and a non-empty array of discloseKeys are required.' },
      });
    }

    const presentation = await credentialService.createSelectiveDisclosure({
      credentialId,
      requestingUserId: userId,
      discloseKeys,
    });

    return res.status(200).json({
      success: true,
      message: 'Selective disclosure presentation generated successfully.',
      data: presentation,
    });
  } catch (err: any) {
    console.error('createSelectiveDisclosure error:', err);
    return res.status(400).json({
      success: false,
      error: { code: 'DISCLOSURE_GENERATION_FAILED', message: err.message },
    });
  }
}

/**
 * POST /api/privacy/selective-disclosure/verify
 * Independently verifies a Selective Disclosure presentation against Merkle inclusion proofs & signatures
 */
export async function verifySelectiveDisclosure(req: Request, res: Response) {
  try {
    const { presentation, verifierIdentifier } = req.body;
    if (!presentation) {
      return res.status(400).json({
        success: false,
        error: { code: 'PRESENTATION_REQUIRED', message: 'Selective disclosure presentation is required.' },
      });
    }

    const result = await credentialService.verifySelectiveDisclosure(presentation, verifierIdentifier);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('verifySelectiveDisclosure error:', err);
    return res.status(400).json({
      success: false,
      error: { code: 'VERIFICATION_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/privacy/zkp/generate-range-proof
 * Generates a genuine Non-Interactive Zero-Knowledge Range Proof (v <= threshold)
 */
export async function generateZkpRangeProof(req: AuthenticatedRequest, res: Response) {
  try {
    const { vehicleId, claimType, threshold, nonce } = req.body;
    const userId = req.user!.id;

    if (!vehicleId || !claimType || threshold === undefined || !nonce) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'vehicleId, claimType, threshold, and nonce are required.' },
      });
    }

    const result = await credentialService.generateZkpRangeProofForVehicle({
      vehicleId,
      requestingUserId: userId,
      claimType,
      threshold: Number(threshold),
      nonce,
    });

    return res.status(200).json({
      success: true,
      message: 'Genuine Zero-Knowledge Range Proof successfully generated.',
      data: result,
    });
  } catch (err: any) {
    console.error('generateZkpRangeProof error:', err);
    return res.status(400).json({
      success: false,
      error: { code: 'PROVING_FAILED', message: err.message },
    });
  }
}

/**
 * POST /api/privacy/zkp/verify-range-proof
 * Independently verifies a Zero-Knowledge Range Proof against an active verification session
 */
export async function verifyZkpRangeProof(req: Request, res: Response) {
  try {
    const { proof, verifierIdentifier } = req.body;
    if (!proof) {
      return res.status(400).json({
        success: false,
        error: { code: 'PROOF_REQUIRED', message: 'ZKP range proof payload is required.' },
      });
    }

    const result = await credentialService.verifyZkpRangeProof(proof, verifierIdentifier);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('verifyZkpRangeProof error:', err);
    return res.status(400).json({
      success: false,
      error: { code: 'VERIFICATION_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/privacy/disclosure-logs/vehicle/:vehicleId
 * Returns audit disclosure logs for a vehicle
 */
export async function getPrivacyDisclosureLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const logs = await credentialService.getDisclosureLogs(vehicleId);

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (err: any) {
    console.error('getPrivacyDisclosureLogs error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message },
    });
  }
}

