import { ethers } from 'ethers';

/**
 * ============================================================================
 * VEHICLE PASSPORT MERKLE TREE SERVICE (PHASE 6)
 * ============================================================================
 * Cryptographic batch anchoring and inclusion proof engine for the Blockchain
 * Vehicle Passport platform.
 *
 * SPECIFICATION:
 * - Version: 1 ("MERKLE_V1")
 * - Leaf Encoding: Domain-separated Keccak-256 ABI encoding
 *     keccak256(abi.encode(LEAF_DOMAIN_TAG, recordIdCommitment, recordTypeHash, recordHashBytes32))
 *     where recordHash is the existing authoritative SHA-256 canonical record hash.
 * - Internal Nodes: Sorted-pair Keccak-256
 *     keccak256(abi.encodePacked(min(left, right), max(left, right)))
 * - Odd-Node Convention: PROMOTE_UNCHANGED (unpaired trailing node promoted to next level)
 * - Input Ordering: Deterministic lexicographical sort on recordId with recordHash tie-break
 * ============================================================================
 */

export const MERKLE_ALGORITHM_VERSION = '1';
export const MERKLE_HASH_ALGORITHM = 'KECCAK256_INTERNAL_SHA256_RECORD';
export const MERKLE_LEAF_ENCODING_VERSION = 'LEAF_V1_ABI_ENCODE';
export const MERKLE_ODD_NODE_CONVENTION = 'PROMOTE_UNCHANGED';

// 32-byte domain separation tag for leaf computation
export const LEAF_DOMAIN_TAG: string = ethers.keccak256(
  ethers.toUtf8Bytes('VEHICLE_PASSPORT_MERKLE_LEAF_V1')
);

export interface MerkleRecordInput {
  recordId: string;
  recordType: string;
  recordHash: string; // 32-byte hex (SHA-256 canonical hash, 0x-prefixed)
  vehicleId?: string | null;
}

export interface MerkleLeafCommitment {
  recordId: string;
  recordType: string;
  recordHash: string;
  leafHash: string;
  leafIndex: number;
  vehicleId?: string | null;
}

export interface ProofStep {
  step: number;
  current: string;
  sibling: string;
  next: string;
}

export interface ProofVerificationResult {
  valid: boolean;
  calculatedRoot: string;
  expectedRoot: string;
  leaf: string;
  proof: string[];
  steps: ProofStep[];
  error?: string;
}

export interface MerkleTreeBuildResult {
  root: string;
  leafCount: number;
  leaves: MerkleLeafCommitment[];
  proofs: Record<string, string[]>; // recordId -> proof array
  levels: string[][];
  algorithmVersion: string;
  hashAlgorithm: string;
  leafEncodingVersion: string;
  oddNodeConvention: string;
}

/**
 * Normalizes a hex string to ensure it has '0x' prefix and valid 32-byte length
 */
export function normalizeBytes32(hexStr: string, fieldName = 'Hash'): string {
  if (!hexStr || typeof hexStr !== 'string') {
    throw new Error(`${fieldName} must be a valid non-empty hex string`);
  }
  const clean = hexStr.trim().startsWith('0x') ? hexStr.trim() : `0x${hexStr.trim()}`;
  if (!ethers.isHexString(clean, 32)) {
    throw new Error(`${fieldName} must be a 32-byte hex string (received: ${hexStr})`);
  }
  return clean.toLowerCase();
}

/**
 * Computes sorted-pair Keccak-256 hash of two 32-byte nodes:
 * parent = keccak256(abi.encodePacked(min(a, b), max(a, b)))
 */
export function hashPair(a: string, b: string): string {
  const normA = normalizeBytes32(a, 'Node A');
  const normB = normalizeBytes32(b, 'Node B');

  // Numerical comparison of unsigned 256-bit integers
  const bigA = BigInt(normA);
  const bigB = BigInt(normB);

  const [left, right] = bigA <= bigB ? [normA, normB] : [normB, normA];
  return ethers.keccak256(ethers.concat([left, right]));
}

/**
 * Computes domain-separated leaf hash for a vehicle lifecycle record:
 * leaf = keccak256(abi.encode(LEAF_DOMAIN_TAG, recordIdCommitment, recordTypeHash, recordHashBytes32))
 */
export function computeLeafHash(record: MerkleRecordInput): string {
  if (!record.recordId || typeof record.recordId !== 'string' || record.recordId.trim().length === 0) {
    throw new Error('Record ID cannot be empty');
  }
  if (!record.recordType || typeof record.recordType !== 'string' || record.recordType.trim().length === 0) {
    throw new Error('Record type cannot be empty');
  }

  const recordHashBytes32 = normalizeBytes32(record.recordHash, 'recordHash');
  const recordIdCommitment = ethers.keccak256(ethers.toUtf8Bytes(record.recordId.trim()));
  const recordTypeHash = ethers.keccak256(ethers.toUtf8Bytes(record.recordType.trim().toUpperCase()));

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [LEAF_DOMAIN_TAG, recordIdCommitment, recordTypeHash, recordHashBytes32]
  );

  return ethers.keccak256(encoded);
}

/**
 * Computes metadata hash for batch commitment on-chain:
 * keccak256(abi.encode(batchIdentifier, leafCount, timestamp))
 */
export function computeBatchMetadataHash(batchIdentifier: string, leafCount: number, timestamp = 0): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ['string', 'uint256', 'uint256'],
    [batchIdentifier.trim(), BigInt(leafCount), BigInt(timestamp)]
  );
  return ethers.keccak256(encoded);
}

/**
 * Validates batch inputs: rejects empty, null, or duplicate record identities.
 */
export function validateBatchRecords(records: MerkleRecordInput[]): void {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Batch cannot be empty: at least 1 record is required');
  }

  const seenIds = new Set<string>();
  for (const rec of records) {
    if (!rec.recordId || rec.recordId.trim().length === 0) {
      throw new Error('Record in batch is missing a valid recordId');
    }
    const cleanId = rec.recordId.trim();
    if (seenIds.has(cleanId)) {
      throw new Error(`Duplicate record ID '${cleanId}' detected in batch inputs`);
    }
    seenIds.add(cleanId);
    normalizeBytes32(rec.recordHash, `recordHash for record ${cleanId}`);
  }
}

/**
 * Deterministically sorts input records by recordId ascending with recordHash tie-breaker.
 */
export function sortBatchRecords(records: MerkleRecordInput[]): MerkleRecordInput[] {
  return [...records].sort((a, b) => {
    const cmp = a.recordId.localeCompare(b.recordId);
    if (cmp !== 0) return cmp;
    return a.recordHash.localeCompare(b.recordHash);
  });
}

/**
 * Builds the deterministic Merkle Tree for a batch of records.
 *
 * Algorithm:
 * 1. Validate inputs (no empty batch, no duplicate IDs).
 * 2. Deterministically sort records.
 * 3. Compute domain-separated leaf hashes for each record.
 * 4. Construct tree levels using sorted-pair hashing and PROMOTE_UNCHANGED convention.
 * 5. Extract inclusion proofs for each leaf.
 * 6. Return root, leaves, proofs, and specification metadata.
 */
export function buildMerkleTree(records: MerkleRecordInput[]): MerkleTreeBuildResult {
  validateBatchRecords(records);
  const sorted = sortBatchRecords(records);

  const leaves: MerkleLeafCommitment[] = sorted.map((rec, index) => ({
    recordId: rec.recordId.trim(),
    recordType: rec.recordType.trim().toUpperCase(),
    recordHash: normalizeBytes32(rec.recordHash, 'recordHash'),
    leafHash: computeLeafHash(rec),
    leafIndex: index,
    vehicleId: rec.vehicleId || null,
  }));

  const leafHashes = leaves.map((l) => l.leafHash);

  // Build tree levels bottom-up
  const levels: string[][] = [leafHashes];
  let currentLevel = leafHashes;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    const len = currentLevel.length;

    for (let i = 0; i < len; i += 2) {
      if (i + 1 < len) {
        // Paired nodes: hash sorted pair
        nextLevel.push(hashPair(currentLevel[i], currentLevel[i + 1]));
      } else {
        // Odd node at the end: PROMOTE_UNCHANGED
        nextLevel.push(currentLevel[i]);
      }
    }

    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  const root = currentLevel[0];

  // Generate inclusion proofs for every leaf
  const proofs: Record<string, string[]> = {};
  for (let leafIdx = 0; leafIdx < leaves.length; leafIdx++) {
    const proof: string[] = [];
    let idx = leafIdx;

    for (let levelIdx = 0; levelIdx < levels.length - 1; levelIdx++) {
      const level = levels[levelIdx];
      const isOdd = level.length % 2 === 1;
      const isLastNode = idx === level.length - 1;

      if (isOdd && isLastNode) {
        // Node was promoted without sibling at this level
        // No sibling added to proof; next level index is idx / 2
        idx = Math.floor(idx / 2);
      } else if (idx % 2 === 0) {
        // Even index: sibling is idx + 1
        proof.push(level[idx + 1]);
        idx = Math.floor(idx / 2);
      } else {
        // Odd index: sibling is idx - 1
        proof.push(level[idx - 1]);
        idx = Math.floor(idx / 2);
      }
    }

    proofs[leaves[leafIdx].recordId] = proof;
  }

  return {
    root,
    leafCount: leaves.length,
    leaves,
    proofs,
    levels,
    algorithmVersion: MERKLE_ALGORITHM_VERSION,
    hashAlgorithm: MERKLE_HASH_ALGORITHM,
    leafEncodingVersion: MERKLE_LEAF_ENCODING_VERSION,
    oddNodeConvention: MERKLE_ODD_NODE_CONVENTION,
  };
}

/**
 * Verifies an inclusion proof against an expected Merkle root.
 *
 * Algorithm:
 * 1. Validate inputs (leaf, proof elements, root must be 32-byte hex strings).
 * 2. Iteratively hash leaf with each sibling using sorted-pair convention.
 * 3. Track each step for explainable verification auditing.
 * 4. Compare calculated root with expected root.
 */
export function verifyInclusionProof(
  leaf: string,
  proof: string[],
  expectedRoot: string
): ProofVerificationResult {
  const steps: ProofStep[] = [];

  try {
    const normLeaf = normalizeBytes32(leaf, 'Leaf');
    const normRoot = normalizeBytes32(expectedRoot, 'Expected Root');

    if (!Array.isArray(proof)) {
      return {
        valid: false,
        calculatedRoot: ethers.ZeroHash,
        expectedRoot: normRoot,
        leaf: normLeaf,
        proof: [],
        steps: [],
        error: 'Proof must be an array of 32-byte hex strings',
      };
    }

    let current = normLeaf;

    for (let i = 0; i < proof.length; i++) {
      const sibling = normalizeBytes32(proof[i], `Proof element at index ${i}`);
      const next = hashPair(current, sibling);
      steps.push({
        step: i + 1,
        current,
        sibling,
        next,
      });
      current = next;
    }

    const valid = current.toLowerCase() === normRoot.toLowerCase();

    return {
      valid,
      calculatedRoot: current,
      expectedRoot: normRoot,
      leaf: normLeaf,
      proof: proof.map((p) => p.toLowerCase()),
      steps,
      error: valid ? undefined : 'Calculated root does not match expected root',
    };
  } catch (err: any) {
    return {
      valid: false,
      calculatedRoot: ethers.ZeroHash,
      expectedRoot: expectedRoot || ethers.ZeroHash,
      leaf: leaf || ethers.ZeroHash,
      proof: Array.isArray(proof) ? proof : [],
      steps,
      error: err.message || 'Verification failed due to invalid cryptographic inputs',
    };
  }
}
