import { PrismaClient, PrivacyCredentialStatus, ZkpSessionStatus } from '@prisma/client';
import crypto from 'crypto';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import {
  createPrivacyCredentialData,
  buildSelectiveDisclosurePresentation,
  verifySelectiveDisclosurePresentation,
  computeCredentialCommitment,
  SelectiveDisclosurePresentation,
  SelectiveVerificationResult,
} from './merkleDisclosureService';
import {
  generateRangeProof,
  verifyRangeProof,
  computeVehicleCommitment,
  createPedersenCommitment,
  generateRandomScalar,
  ZkpRangeProofPayload,
  VerificationResult,
} from './pedersenZkpService';

const prisma = new PrismaClient();

// Load PrivacyVerifier contract deployment if available
let privacyVerifierContract: ethers.Contract | null = null;
let blockchainSigner: ethers.Signer | null = null;

try {
  const deploymentPath = path.join(__dirname, '../../blockchain/contracts/PrivacyVerifier.json');
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat #0
    blockchainSigner = new ethers.Wallet(privateKey, provider);
    privacyVerifierContract = new ethers.Contract(deployment.address, deployment.abi, blockchainSigner);
  }
} catch (err: any) {
  console.warn('PrivacyVerifier contract not loaded; on-chain receipts will be skipped:', err.message);
}

export interface IssueCredentialInput {
  vehicleId: string;
  issuerId: string;
  credentialType: string;
  attributes: Record<string, string | number | boolean>;
  numericalWitness?: {
    claimKey: string;
    value: number;
  };
  validityDays?: number;
}

export class CredentialService {
  /**
   * Issues a new privacy-preserving credential with salt-blinded attributes and optional Pedersen commitment
   */
  async issueCredential(input: IssueCredentialInput) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      include: { currentOwner: true },
    });
    if (!vehicle) {
      throw new Error(`Vehicle with ID ${input.vehicleId} not found`);
    }

    const issuer = await prisma.user.findUnique({
      where: { id: input.issuerId },
    });
    if (!issuer) {
      throw new Error(`Issuer with ID ${input.issuerId} not found`);
    }

    // Role verification
    const allowedRoles = ['GARAGE', 'MANUFACTURER', 'INSURANCE_PROVIDER', 'ADMIN'];
    if (!allowedRoles.includes(issuer.role)) {
      throw new Error(`User with role ${issuer.role} is not authorized to issue vehicle credentials`);
    }

    const credentialCount = await prisma.privacyCredential.count();
    const credentialId = `VC-2026-${String(credentialCount + 1).padStart(6, '0')}`;

    const days = input.validityDays || 365;
    const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    // Use blockchain signer or a dedicated deterministic issuer wallet
    const signer = blockchainSigner || ethers.Wallet.createRandom();

    // If a numerical witness is provided (e.g. mileage or battery SoH), generate Pedersen commitment
    let pedersenData: { commitment: string; blinding: string } | null = null;
    if (input.numericalWitness) {
      const blinding = generateRandomScalar();
      const commitment = createPedersenCommitment(BigInt(input.numericalWitness.value), blinding);
      pedersenData = {
        commitment,
        blinding: '0x' + blinding.toString(16).padStart(64, '0'),
      };
      // Inject commitment into attributes map without exposing private value
      input.attributes[`${input.numericalWitness.claimKey}_commitment`] = commitment;
    }

    // Generate Merkle Disclosed Credential structure
    const credData = await createPrivacyCredentialData({
      credentialId,
      vehicleId: vehicle.id,
      vin: vehicle.vin,
      attributes: input.attributes,
      validUntil,
      issuerSigner: signer,
    });

    // Optional on-chain registration
    let onChainTxHash: string | null = null;
    if (privacyVerifierContract) {
      try {
        const idBytes32 = ethers.id(credentialId);
        const rootBytes32 = credData.merkleRoot;
        const validUntilTimestamp = Math.floor(new Date(validUntil).getTime() / 1000);
        const tx = await privacyVerifierContract.registerCredential(
          idBytes32,
          rootBytes32,
          validUntilTimestamp
        );
        const receipt = await tx.wait();
        onChainTxHash = receipt.hash;
      } catch (chainErr: any) {
        console.warn('On-chain credential registration failed (non-fatal):', chainErr.message);
      }
    }

    // Store in database
    const saved = await prisma.privacyCredential.create({
      data: {
        credentialId,
        vehicleId: vehicle.id,
        issuerId: issuer.id,
        credentialType: input.credentialType,
        schemaVersion: '1.0',
        rootCommitment: credData.merkleRoot,
        issuerPublicKey: credData.issuerAddress,
        issuerSignature: credData.issuerSignature,
        saltBlindingsJson: JSON.stringify({
          salts: credData.saltsRecord,
          pedersen: pedersenData,
        }),
        attributesJson: JSON.stringify(credData.attributesWithSalts),
        status: PrivacyCredentialStatus.ACTIVE,
        validUntil: new Date(validUntil),
        onChainTxHash,
      },
      include: {
        issuer: { select: { id: true, name: true, role: true, email: true } },
        vehicle: { select: { id: true, passportId: true, vin: true, manufacturer: true, model: true } },
      },
    });

    return {
      credentialId: saved.credentialId,
      vehicleId: saved.vehicleId,
      credentialType: saved.credentialType,
      rootCommitment: saved.rootCommitment,
      issuerAddress: saved.issuerPublicKey,
      validFrom: saved.validFrom.toISOString(),
      validUntil: saved.validUntil.toISOString(),
      status: saved.status,
      onChainTxHash: saved.onChainTxHash,
      attributesCount: Object.keys(input.attributes).length,
      hasPedersenCommitment: !!pedersenData,
      pedersenCommitment: pedersenData?.commitment,
    };
  }

  /**
   * Retrieves active and historical credentials for a vehicle
   */
  async getVehicleCredentials(vehicleId: string) {
    const credentials = await prisma.privacyCredential.findMany({
      where: { vehicleId },
      include: {
        issuer: { select: { id: true, name: true, role: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    // Update expired statuses in-memory and in db if needed
    return credentials.map(c => {
      const isExpired = now > c.validUntil && c.status === PrivacyCredentialStatus.ACTIVE;
      return {
        id: c.id,
        credentialId: c.credentialId,
        credentialType: c.credentialType,
        schemaVersion: c.schemaVersion,
        rootCommitment: c.rootCommitment,
        issuer: c.issuer,
        issuerPublicKey: c.issuerPublicKey,
        status: isExpired ? 'EXPIRED' : c.status,
        validFrom: c.validFrom.toISOString(),
        validUntil: c.validUntil.toISOString(),
        revokedAt: c.revokedAt?.toISOString(),
        revocationReason: c.revocationReason,
        onChainTxHash: c.onChainTxHash,
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  /**
   * Revokes an existing privacy credential
   */
  async revokeCredential(credentialId: string, revokerUserId: string, reason: string) {
    const cred = await prisma.privacyCredential.findUnique({
      where: { credentialId },
      include: { issuer: true },
    });
    if (!cred) {
      throw new Error(`Credential ${credentialId} not found`);
    }

    const revoker = await prisma.user.findUnique({
      where: { id: revokerUserId },
    });
    if (!revoker) {
      throw new Error(`User ${revokerUserId} not found`);
    }

    if (cred.issuerId !== revoker.id && revoker.role !== 'ADMIN') {
      throw new Error('Only the issuing authority or an admin can revoke this credential');
    }

    // Optional on-chain revocation
    if (privacyVerifierContract) {
      try {
        const idBytes32 = ethers.id(credentialId);
        const tx = await privacyVerifierContract.revokeCredential(idBytes32, reason);
        await tx.wait();
      } catch (chainErr: any) {
        console.warn('On-chain credential revocation failed (non-fatal):', chainErr.message);
      }
    }

    const updated = await prisma.privacyCredential.update({
      where: { credentialId },
      data: {
        status: PrivacyCredentialStatus.REVOKED,
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    return {
      credentialId: updated.credentialId,
      status: updated.status,
      revokedAt: updated.revokedAt?.toISOString(),
      reason: updated.revocationReason,
    };
  }

  /**
   * Creates an ephemeral verification session challenge nonce to protect against replay attacks
   */
  async createVerificationChallenge(params: {
    vehicleId: string;
    claimType: string;
    policyThreshold?: number;
    verifierId?: string;
  }) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
    });
    if (!vehicle) {
      throw new Error(`Vehicle with ID ${params.vehicleId} not found`);
    }

    const sessionCount = await prisma.zkpVerificationSession.count();
    const sessionId = `ZKP-SESS-${String(sessionCount + 1).padStart(6, '0')}`;

    // Cryptographically secure 256-bit random nonce
    const nonce = '0x' + crypto.randomBytes(32).toString('hex');
    const vehicleCommitment = computeVehicleCommitment(vehicle.id, vehicle.vin);

    // 15-minute challenge expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const session = await prisma.zkpVerificationSession.create({
      data: {
        sessionId,
        vehicleId: vehicle.id,
        verifierId: params.verifierId,
        claimType: params.claimType,
        policyThreshold: params.policyThreshold,
        nonce,
        status: ZkpSessionStatus.PENDING,
        expiresAt,
      },
    });

    return {
      sessionId: session.sessionId,
      vehicleId: session.vehicleId,
      vehicleCommitment,
      claimType: session.claimType,
      policyThreshold: session.policyThreshold,
      nonce: session.nonce,
      expiresAt: session.expiresAt.toISOString(),
      instructions: 'Submit this nonce and vehicleCommitment as public inputs when generating the zero-knowledge proof.',
    };
  }

  /**
   * Generates a Selective Disclosure presentation for a vehicle's credential
   */
  async createSelectiveDisclosure(params: {
    credentialId: string;
    requestingUserId: string;
    discloseKeys: string[];
  }) {
    const cred = await prisma.privacyCredential.findUnique({
      where: { credentialId: params.credentialId },
      include: { vehicle: true },
    });
    if (!cred) {
      throw new Error(`Credential ${params.credentialId} not found`);
    }

    // Access authorization: user must be vehicle owner or issuer or admin
    const requester = await prisma.user.findUnique({ where: { id: params.requestingUserId } });
    if (!requester) throw new Error('Requester not found');

    const isOwner = cred.vehicle.currentOwnerId === requester.id;
    const isIssuer = cred.issuerId === requester.id;
    const isAdmin = requester.role === 'ADMIN';

    if (!isOwner && !isIssuer && !isAdmin) {
      throw new Error('Access denied: only vehicle owner, issuer, or admin may generate disclosures');
    }

    if (cred.status === PrivacyCredentialStatus.REVOKED) {
      throw new Error(`Cannot disclose revoked credential: ${cred.revocationReason}`);
    }

    const attributes = JSON.parse(cred.attributesJson);
    const vehicleCommitment = computeVehicleCommitment(cred.vehicle.id, cred.vehicle.vin);
    const validUntilIso = cred.validUntil.toISOString();

    const credentialCommitment = computeCredentialCommitment({
      credentialId: cred.credentialId,
      merkleRoot: cred.rootCommitment,
      vehicleCommitment,
      validUntil: validUntilIso,
    });

    const presentation = buildSelectiveDisclosurePresentation({
      credentialId: cred.credentialId,
      vehicleCommitment,
      validFrom: cred.validFrom.toISOString(),
      validUntil: validUntilIso,
      merkleRoot: cred.rootCommitment,
      credentialCommitment,
      issuerAddress: cred.issuerPublicKey,
      issuerSignature: cred.issuerSignature,
      allAttributes: attributes,
      discloseKeys: params.discloseKeys,
    });

    return presentation;
  }

  /**
   * Independently verifies a Selective Disclosure presentation and records audit log
   */
  async verifySelectiveDisclosure(presentation: SelectiveDisclosurePresentation, verifierIdentifier?: string) {
    // 1. Check database revocation status
    const dbCred = await prisma.privacyCredential.findUnique({
      where: { credentialId: presentation.credentialId },
    });

    if (dbCred && dbCred.status === PrivacyCredentialStatus.REVOKED) {
      return {
        valid: false,
        error: `Credential has been revoked: ${dbCred.revocationReason}`,
        credentialId: presentation.credentialId,
        issuerAddress: presentation.issuerAddress,
        vehicleCommitment: presentation.vehicleCommitment,
        verifiedAttributes: {},
        hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
        isExpired: false,
        verificationDurationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const result = verifySelectiveDisclosurePresentation(presentation);

    // Record audit log
    if (dbCred) {
      const logCount = await prisma.privacyDisclosureLog.count();
      const logNumber = `DISC-2026-${String(logCount + 1).padStart(6, '0')}`;

      await prisma.privacyDisclosureLog.create({
        data: {
          logNumber,
          vehicleId: dbCred.vehicleId,
          credentialId: dbCred.id,
          disclosureType: 'SELECTIVE_DISCLOSURE',
          claimType: 'SELECTIVE_ATTRIBUTES',
          disclosedFields: JSON.stringify(presentation.disclosedAttributes.map(a => a.key)),
          verifierIdentifier: verifierIdentifier || 'ANONYMOUS_VERIFIER',
          verificationStatus: result.valid ? 'VALID' : 'INVALID',
          verificationDetails: JSON.stringify({
            verifiedCount: Object.keys(result.verifiedAttributes).length,
            hiddenCount: result.hiddenFieldCount,
            durationMs: result.verificationDurationMs,
            error: result.error,
          }),
        },
      });
    }

    return result;
  }

  /**
   * Generates a genuine ZKP range proof using credential witness data
   */
  async generateZkpRangeProofForVehicle(params: {
    vehicleId: string;
    requestingUserId: string;
    claimType: string;
    threshold: number;
    nonce: string;
  }) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
      include: {
        odometerRecords: { orderBy: { recordedAt: 'desc' }, take: 1 },
        batteryPassport: true,
      },
    });
    if (!vehicle) throw new Error('Vehicle not found');

    const vehicleCommitment = computeVehicleCommitment(vehicle.id, vehicle.vin);

    // Determine value to prove based on claimType
    let valueToProve: number | null = null;
    let registeredCommitment: string | null = null;
    let blindingScalar: bigint = generateRandomScalar();

    if (params.claimType === 'ODOMETER_BELOW_THRESHOLD') {
      const latestOdo = vehicle.odometerRecords[0];
      if (!latestOdo) throw new Error('No verified odometer records found for vehicle');
      valueToProve = latestOdo.mileage;
    } else if (params.claimType === 'BATTERY_SOH_ABOVE_THRESHOLD') {
      if (!vehicle.batteryPassport) throw new Error('No battery passport found for vehicle');
      valueToProve = Math.round(vehicle.batteryPassport.sohPercentage);
    } else {
      throw new Error(`Unsupported claim type: ${params.claimType}`);
    }

    // Check if there is an active credential with a matching Pedersen commitment
    const cred = await prisma.privacyCredential.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: PrivacyCredentialStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (cred && cred.saltBlindingsJson) {
      try {
        const blindings = JSON.parse(cred.saltBlindingsJson);
        if (blindings.pedersen) {
          registeredCommitment = blindings.pedersen.commitment;
          blindingScalar = BigInt(blindings.pedersen.blinding);
        }
      } catch (e) {}
    }

    const proof = generateRangeProof({
      value: valueToProve,
      blinding: blindingScalar,
      threshold: params.threshold,
      vehicleCommitment,
      claimType: params.claimType,
      nonce: params.nonce,
    });

    return {
      proof,
      publicStatement: `Proves that vehicle's private value satisfies ${params.claimType} (<= ${params.threshold}) without revealing exact value`,
      undisclosedPrivateWitness: 'Mileage / Battery SoH value and random Pedersen blinding factor remain 100% private',
      registeredCommitment,
    };
  }

  /**
   * Independently verifies a ZKP Range Proof against an active verification session
   */
  async verifyZkpRangeProof(
    proof: ZkpRangeProofPayload,
    verifierIdentifier?: string
  ): Promise<VerificationResult & { onChainReceiptTx?: string }> {
    // 1. Replay protection: look up session by nonce
    const session = await prisma.zkpVerificationSession.findUnique({
      where: { nonce: proof.nonce },
      include: { vehicle: true },
    });

    if (!session) {
      return {
        valid: false,
        error: 'Invalid or unknown session nonce; potential replay attack or session expired',
        statement: 'Session challenge nonce verification',
        publicInputs: {
          vehicleCommitment: proof.vehicleCommitment,
          claimType: proof.claimType,
          threshold: proof.threshold,
          commitment: proof.commitment,
          nonce: proof.nonce,
        },
        verificationDurationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    if (new Date() > session.expiresAt) {
      await prisma.zkpVerificationSession.update({
        where: { id: session.id },
        data: { status: ZkpSessionStatus.EXPIRED },
      });
      return {
        valid: false,
        error: `Session expired on ${session.expiresAt.toISOString()}`,
        statement: 'Session challenge nonce expiration',
        publicInputs: {
          vehicleCommitment: proof.vehicleCommitment,
          claimType: proof.claimType,
          threshold: proof.threshold,
          commitment: proof.commitment,
          nonce: proof.nonce,
        },
        verificationDurationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Perform independent cryptographic verification
    const result = verifyRangeProof(proof, {
      vehicleCommitment: computeVehicleCommitment(session.vehicle.id, session.vehicle.vin),
      claimType: session.claimType,
      threshold: session.policyThreshold || proof.threshold,
      nonce: session.nonce,
    });

    // 3. Update session status
    await prisma.zkpVerificationSession.update({
      where: { id: session.id },
      data: {
        status: result.valid ? ZkpSessionStatus.VERIFIED : ZkpSessionStatus.REJECTED,
        verifiedAt: result.valid ? new Date() : null,
        proofSummaryJson: JSON.stringify({
          valid: result.valid,
          durationMs: result.verificationDurationMs,
          commitment: proof.commitment,
          error: result.error,
        }),
      },
    });

    // 4. Record on-chain receipt if contract is available
    let onChainReceiptTx: string | undefined = undefined;
    if (result.valid && privacyVerifierContract) {
      try {
        const sessionBytes32 = ethers.id(session.sessionId);
        const vehCommitment = computeVehicleCommitment(session.vehicle.id, session.vehicle.vin);
        const vehBytes32 = vehCommitment.startsWith('0x')
          ? vehCommitment
          : ethers.id(vehCommitment);
        const claimHash = ethers.id(session.claimType);
        const thresholdInt = Math.floor(proof.threshold);
        const pedersenBytes32 = ethers.id(proof.commitment);
        const nonceBytes32 = session.nonce.startsWith('0x')
          ? session.nonce
          : ethers.id(session.nonce);

        const tx = await privacyVerifierContract.recordZkpReceipt(
          sessionBytes32,
          vehBytes32,
          claimHash,
          thresholdInt,
          pedersenBytes32,
          nonceBytes32,
          true
        );
        const receipt = await tx.wait();
        onChainReceiptTx = receipt.hash;
      } catch (chainErr: any) {
        console.warn('On-chain ZKP receipt recording failed (non-fatal):', chainErr.message);
      }
    }

    // 5. Create disclosure log
    const logCount = await prisma.privacyDisclosureLog.count();
    const logNumber = `DISC-2026-${String(logCount + 1).padStart(6, '0')}`;

    await prisma.privacyDisclosureLog.create({
      data: {
        logNumber,
        vehicleId: session.vehicleId,
        disclosureType: 'ZKP_THRESHOLD_PROOF',
        claimType: session.claimType,
        disclosedFields: JSON.stringify([session.claimType, 'POLICY_THRESHOLD', 'PEDERSEN_COMMITMENT']),
        verifierIdentifier: verifierIdentifier || session.verifierId || 'ANONYMOUS_VERIFIER',
        verificationStatus: result.valid ? 'VALID' : 'INVALID',
        verificationDetails: JSON.stringify({
          threshold: proof.threshold,
          durationMs: result.verificationDurationMs,
          error: result.error,
        }),
        blockchainReceiptTx: onChainReceiptTx,
      },
    });

    return {
      ...result,
      onChainReceiptTx,
    };
  }

  /**
   * Retrieves disclosure history
   */
  async getDisclosureLogs(vehicleId: string) {
    return prisma.privacyDisclosureLog.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export const credentialService = new CredentialService();
