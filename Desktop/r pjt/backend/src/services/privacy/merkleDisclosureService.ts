import crypto from 'crypto';
import { ethers } from 'ethers';
import { computeVehicleCommitment } from './pedersenZkpService';

export interface CredentialAttribute {
  key: string;
  value: string | number | boolean;
  salt: string; // 32-byte hex salt
}

export interface DisclosedAttributeItem {
  key: string;
  value: string | number | boolean;
  salt: string;
  leafHash: string;
  merkleProof: string[];
}

export interface UndisclosedAttributeItem {
  key: string;
  disclosed: false;
}

export interface SelectiveDisclosurePresentation {
  format: 'MDC_SELECTIVE_DISCLOSURE_V1';
  credentialId: string;
  vehicleCommitment: string;
  validFrom: string;
  validUntil: string;
  merkleRoot: string;
  credentialCommitment: string;
  issuerAddress: string;
  issuerSignature: string;
  disclosedAttributes: DisclosedAttributeItem[];
  undisclosedAttributes: UndisclosedAttributeItem[];
}

export interface SelectiveVerificationResult {
  valid: boolean;
  error?: string;
  credentialId: string;
  issuerAddress: string;
  vehicleCommitment: string;
  verifiedAttributes: Record<string, string | number | boolean>;
  hiddenFieldCount: number;
  isExpired: boolean;
  verificationDurationMs: number;
  timestamp: string;
}

/**
 * Computes canonical leaf hash for an attribute: SHA256("VC_ATTR_V1:" + key + ":" + value + ":" + salt)
 */
export function computeAttributeLeaf(key: string, value: string | number | boolean, salt: string): string {
  const normKey = key.trim();
  const normVal = String(value).trim();
  const normSalt = salt.startsWith('0x') ? salt.slice(2).toLowerCase() : salt.toLowerCase();

  return '0x' + crypto.createHash('sha256')
    .update(`VC_ATTR_V1:${normKey}:${normVal}:${normSalt}`)
    .digest('hex');
}

/**
 * Sorted-pair SHA-256 hash
 */
export function hashPair(a: string, b: string): string {
  const aClean = a.startsWith('0x') ? a.slice(2).toLowerCase() : a.toLowerCase();
  const bClean = b.startsWith('0x') ? b.slice(2).toLowerCase() : b.toLowerCase();

  const [first, second] = aClean <= bClean ? [aClean, bClean] : [bClean, aClean];
  return '0x' + crypto.createHash('sha256')
    .update(Buffer.from(first + second, 'hex'))
    .digest('hex');
}

/**
 * Builds a Merkle Tree from sorted attribute leaves and returns the root + audit proofs for all leaves
 */
export function buildAttributeMerkleTree(leaves: { key: string; leafHash: string }[]): {
  root: string;
  proofs: Record<string, string[]>;
} {
  if (leaves.length === 0) {
    throw new Error('Cannot build Merkle tree from empty attributes');
  }

  // Sort leaves deterministically by leafHash
  const sorted = [...leaves].sort((a, b) => a.leafHash.localeCompare(b.leafHash));
  const proofs: Record<string, string[]> = {};
  for (const item of sorted) {
    proofs[item.key] = [];
  }

  // Track positions of each key
  let currentLevel = sorted.map(item => ({ key: item.key, hash: item.leafHash }));
  let levelHashes = currentLevel.map(item => item.hash);

  // Map each leaf index to its original key
  let currentKeyIndices: (string[])[] = currentLevel.map(item => [item.key]);

  while (levelHashes.length > 1) {
    const nextLevelHashes: string[] = [];
    const nextKeyIndices: (string[])[] = [];

    for (let i = 0; i < levelHashes.length; i += 2) {
      if (i + 1 < levelHashes.length) {
        const left = levelHashes[i];
        const right = levelHashes[i + 1];
        const parent = hashPair(left, right);
        nextLevelHashes.push(parent);

        // Add right to left's keys' proofs
        for (const k of currentKeyIndices[i]) {
          proofs[k].push(right);
        }
        // Add left to right's keys' proofs
        for (const k of currentKeyIndices[i + 1]) {
          proofs[k].push(left);
        }

        nextKeyIndices.push([...currentKeyIndices[i], ...currentKeyIndices[i + 1]]);
      } else {
        // Odd node promoted unchanged
        nextLevelHashes.push(levelHashes[i]);
        nextKeyIndices.push(currentKeyIndices[i]);
      }
    }

    levelHashes = nextLevelHashes;
    currentKeyIndices = nextKeyIndices;
  }

  return {
    root: levelHashes[0],
    proofs,
  };
}

/**
 * Verifies a Merkle inclusion proof for a single leaf
 */
export function verifyAttributeInclusion(leafHash: string, proof: string[], root: string): boolean {
  let current = leafHash;
  for (const sibling of proof) {
    current = hashPair(current, sibling);
  }
  return current.toLowerCase() === root.toLowerCase();
}

/**
 * Computes root commitment for a credential: SHA256("VC_CRED_V1:" + credentialId + ":" + root + ":" + vehicleCommitment + ":" + validUntil)
 */
export function computeCredentialCommitment(params: {
  credentialId: string;
  merkleRoot: string;
  vehicleCommitment: string;
  validUntil: string;
}): string {
  const normId = params.credentialId.trim();
  const normRoot = params.merkleRoot.trim().toLowerCase();
  const normVeh = params.vehicleCommitment.trim().toLowerCase();
  const normUntil = new Date(params.validUntil).toISOString();

  return '0x' + crypto.createHash('sha256')
    .update(`VC_CRED_V1:${normId}:${normRoot}:${normVeh}:${normUntil}`)
    .digest('hex');
}

/**
 * Creates a new Merkle Disclosed Credential structure with fresh random salts for each attribute.
 */
export function createPrivacyCredentialData(params: {
  credentialId: string;
  vehicleId: string;
  vin: string;
  attributes: Record<string, string | number | boolean>;
  validUntil: string;
  issuerSigner: ethers.Signer | ethers.Wallet;
}): Promise<{
  credentialId: string;
  vehicleCommitment: string;
  merkleRoot: string;
  credentialCommitment: string;
  issuerAddress: string;
  issuerSignature: string;
  attributesWithSalts: CredentialAttribute[];
  saltsRecord: Record<string, string>;
}> {
  return (async () => {
    const vehicleCommitment = computeVehicleCommitment(params.vehicleId, params.vin);
    const attributesWithSalts: CredentialAttribute[] = [];
    const saltsRecord: Record<string, string> = {};

    const leafItems: { key: string; leafHash: string }[] = [];

    for (const [key, value] of Object.entries(params.attributes)) {
      const salt = '0x' + crypto.randomBytes(32).toString('hex');
      saltsRecord[key] = salt;
      attributesWithSalts.push({ key, value, salt });
      const leafHash = computeAttributeLeaf(key, value, salt);
      leafItems.push({ key, leafHash });
    }

    const { root: merkleRoot } = buildAttributeMerkleTree(leafItems);

    const credentialCommitment = computeCredentialCommitment({
      credentialId: params.credentialId,
      merkleRoot,
      vehicleCommitment,
      validUntil: params.validUntil,
    });

    const issuerAddress = await params.issuerSigner.getAddress();
    const issuerSignature = await params.issuerSigner.signMessage(ethers.getBytes(credentialCommitment));

    return {
      credentialId: params.credentialId,
      vehicleCommitment,
      merkleRoot,
      credentialCommitment,
      issuerAddress,
      issuerSignature,
      attributesWithSalts,
      saltsRecord,
    };
  })();
}

/**
 * Builds a selective disclosure presentation revealing only chosen keys.
 */
export function buildSelectiveDisclosurePresentation(params: {
  credentialId: string;
  vehicleCommitment: string;
  validFrom: string;
  validUntil: string;
  merkleRoot: string;
  credentialCommitment: string;
  issuerAddress: string;
  issuerSignature: string;
  allAttributes: CredentialAttribute[];
  discloseKeys: string[];
}): SelectiveDisclosurePresentation {
  const leafItems = params.allAttributes.map(attr => ({
    key: attr.key,
    leafHash: computeAttributeLeaf(attr.key, attr.value, attr.salt),
  }));

  const { proofs } = buildAttributeMerkleTree(leafItems);
  const discloseSet = new Set(params.discloseKeys);

  const disclosedAttributes: DisclosedAttributeItem[] = [];
  const undisclosedAttributes: UndisclosedAttributeItem[] = [];

  for (const attr of params.allAttributes) {
    if (discloseSet.has(attr.key)) {
      disclosedAttributes.push({
        key: attr.key,
        value: attr.value,
        salt: attr.salt,
        leafHash: computeAttributeLeaf(attr.key, attr.value, attr.salt),
        merkleProof: proofs[attr.key] || [],
      });
    } else {
      undisclosedAttributes.push({
        key: attr.key,
        disclosed: false,
      });
    }
  }

  return {
    format: 'MDC_SELECTIVE_DISCLOSURE_V1',
    credentialId: params.credentialId,
    vehicleCommitment: params.vehicleCommitment,
    validFrom: params.validFrom,
    validUntil: params.validUntil,
    merkleRoot: params.merkleRoot,
    credentialCommitment: params.credentialCommitment,
    issuerAddress: params.issuerAddress,
    issuerSignature: params.issuerSignature,
    disclosedAttributes,
    undisclosedAttributes,
  };
}

/**
 * Independently verifies a Selective Disclosure presentation against cryptographic signatures and Merkle inclusion.
 */
export function verifySelectiveDisclosurePresentation(
  presentation: SelectiveDisclosurePresentation,
  expectedVehicleCommitment?: string
): SelectiveVerificationResult {
  const startTime = Date.now();
  const verifiedAttributes: Record<string, string | number | boolean> = {};

  try {
    if (presentation.format !== 'MDC_SELECTIVE_DISCLOSURE_V1') {
      return {
        valid: false,
        error: `Unsupported presentation format: ${presentation.format}`,
        credentialId: presentation.credentialId,
        issuerAddress: presentation.issuerAddress,
        vehicleCommitment: presentation.vehicleCommitment,
        verifiedAttributes: {},
        hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
        isExpired: false,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    const now = new Date();
    const expiry = new Date(presentation.validUntil);
    const isExpired = now > expiry;
    if (isExpired) {
      return {
        valid: false,
        error: `Credential expired on ${expiry.toISOString()}`,
        credentialId: presentation.credentialId,
        issuerAddress: presentation.issuerAddress,
        vehicleCommitment: presentation.vehicleCommitment,
        verifiedAttributes: {},
        hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
        isExpired: true,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    if (expectedVehicleCommitment &&
        presentation.vehicleCommitment.toLowerCase() !== expectedVehicleCommitment.toLowerCase()) {
      return {
        valid: false,
        error: 'Vehicle commitment mismatch: credential is bound to a different vehicle',
        credentialId: presentation.credentialId,
        issuerAddress: presentation.issuerAddress,
        vehicleCommitment: presentation.vehicleCommitment,
        verifiedAttributes: {},
        hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
        isExpired: false,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    const expectedCommitment = computeCredentialCommitment({
      credentialId: presentation.credentialId,
      merkleRoot: presentation.merkleRoot,
      vehicleCommitment: presentation.vehicleCommitment,
      validUntil: presentation.validUntil,
    });

    if (expectedCommitment.toLowerCase() !== presentation.credentialCommitment.toLowerCase()) {
      return {
        valid: false,
        error: 'Credential commitment mismatch; Merkle root or validity dates have been altered',
        credentialId: presentation.credentialId,
        issuerAddress: presentation.issuerAddress,
        vehicleCommitment: presentation.vehicleCommitment,
        verifiedAttributes: {},
        hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
        isExpired: false,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    const recoveredAddress = ethers.verifyMessage(
      ethers.getBytes(presentation.credentialCommitment),
      presentation.issuerSignature
    );

    if (recoveredAddress.toLowerCase() !== presentation.issuerAddress.toLowerCase()) {
      return {
        valid: false,
        error: `Invalid issuer signature; recovered ${recoveredAddress}, expected ${presentation.issuerAddress}`,
        credentialId: presentation.credentialId,
        issuerAddress: presentation.issuerAddress,
        vehicleCommitment: presentation.vehicleCommitment,
        verifiedAttributes: {},
        hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
        isExpired: false,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    if (!presentation.disclosedAttributes || presentation.disclosedAttributes.length === 0) {
      return {
        valid: false,
        error: 'No disclosed attributes presented for verification',
        credentialId: presentation.credentialId,
        issuerAddress: presentation.issuerAddress,
        vehicleCommitment: presentation.vehicleCommitment,
        verifiedAttributes: {},
        hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
        isExpired: false,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    for (const item of presentation.disclosedAttributes) {
      const computedLeaf = computeAttributeLeaf(item.key, item.value, item.salt);
      if (computedLeaf.toLowerCase() !== item.leafHash.toLowerCase()) {
        return {
          valid: false,
          error: `Attribute leaf hash mismatch for key '${item.key}'`,
          credentialId: presentation.credentialId,
          issuerAddress: presentation.issuerAddress,
          vehicleCommitment: presentation.vehicleCommitment,
          verifiedAttributes: {},
          hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
          isExpired: false,
          verificationDurationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      const isValidInclusion = verifyAttributeInclusion(
        computedLeaf,
        item.merkleProof,
        presentation.merkleRoot
      );

      if (!isValidInclusion) {
        return {
          valid: false,
          error: `Cryptographic Merkle inclusion check failed for attribute '${item.key}'`,
          credentialId: presentation.credentialId,
          issuerAddress: presentation.issuerAddress,
          vehicleCommitment: presentation.vehicleCommitment,
          verifiedAttributes: {},
          hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
          isExpired: false,
          verificationDurationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      verifiedAttributes[item.key] = item.value;
    }

    return {
      valid: true,
      credentialId: presentation.credentialId,
      issuerAddress: presentation.issuerAddress,
      vehicleCommitment: presentation.vehicleCommitment,
      verifiedAttributes,
      hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
      isExpired: false,
      verificationDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Selective disclosure verification error: ${err.message}`,
      credentialId: presentation.credentialId,
      issuerAddress: presentation.issuerAddress,
      vehicleCommitment: presentation.vehicleCommitment,
      verifiedAttributes: {},
      hiddenFieldCount: presentation.undisclosedAttributes?.length || 0,
      isExpired: false,
      verificationDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}
