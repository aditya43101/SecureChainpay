import { ethers } from 'ethers';
import { getProvider, getContract } from './client';
import SecureChainLedgerArtifact from '../../../artifacts/contracts/SecureChainLedger.sol/SecureChainLedger.json';
import {
  AnchorBatch,
  AnchorStatus,
  BatchCreationResult,
  MerkleProof,
  MerkleProofNode,
  MerkleVerificationResult,
} from '@/types/merkle';
import { HybridTransactionRecord } from '@/types/hybrid-transaction';
import { computeCanonicalHash } from './hybrid-ledger';

const LEDGER_ABI = SecureChainLedgerArtifact.abi;
const LEDGER_CONTRACT_ADDRESS = process.env.LEDGER_CONTRACT_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';

export const EMPTY_MERKLE_ROOT = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const DEFAULT_MERKLE_BATCH_SIZE = Number(process.env.MERKLE_BATCH_SIZE) || 10;

/**
 * Deterministically constructs a Merkle leaf hash for a transaction.
 * Leaf = SHA-256("v1:" + applicationTransactionId + ":" + transactionHash)
 */
export async function computeMerkleLeaf(tx: {
  applicationTransactionId: string;
  transactionHash: string;
}): Promise<string> {
  const cleanAppId = (tx.applicationTransactionId || '').trim();
  const cleanTxHash = (tx.transactionHash || '').trim().toLowerCase();
  const leafPayload = `v1:${cleanAppId}:${cleanTxHash}`;
  return computeCanonicalHash(leafPayload);
}

/**
 * Deterministically computes pair hash: SHA-256(left + right)
 */
export async function computePairHash(left: string, right: string): Promise<string> {
  const combined = left.trim().toLowerCase() + right.trim().toLowerCase();
  return computeCanonicalHash(combined);
}

/**
 * Builds a deterministic Merkle tree from an array of leaf hashes.
 *
 * Rules:
 * 1. Empty tree -> 0x0000000000000000000000000000000000000000000000000000000000000000
 * 2. Single leaf -> Merkle Root = leaf
 * 3. Odd-node strategy: Duplicate final node on odd-length levels
 * 4. Pair hashing: computePairHash(left, right)
 */
export async function buildMerkleTree(
  leafHashes: string[]
): Promise<{ root: string; levels: string[][] }> {
  if (!leafHashes || leafHashes.length === 0) {
    return {
      root: EMPTY_MERKLE_ROOT,
      levels: [[]],
    };
  }

  if (leafHashes.length === 1) {
    return {
      root: leafHashes[0],
      levels: [[leafHashes[0]]],
    };
  }

  const levels: string[][] = [];
  let currentLevel = [...leafHashes];
  levels.push([...currentLevel]);

  while (currentLevel.length > 1) {
    // Phase 4G: Odd-node handling strategy — duplicate final node if count is odd
    if (currentLevel.length % 2 === 1) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const parentHash = await computePairHash(currentLevel[i], currentLevel[i + 1]);
      nextLevel.push(parentHash);
    }

    levels.push([...nextLevel]);
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0],
    levels,
  };
}

/**
 * Generates an audit-proof Merkle proof for a given leaf index.
 */
export function generateMerkleProofFromLevels(
  levels: string[][],
  targetIndex: number
): MerkleProofNode[] {
  if (levels.length <= 1) return [];

  const proof: MerkleProofNode[] = [];
  let currentIndex = targetIndex;

  for (let i = 0; i < levels.length - 1; i++) {
    let currentLevel = [...levels[i]];
    if (currentLevel.length % 2 === 1) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

    if (siblingIndex < currentLevel.length) {
      proof.push({
        hash: currentLevel[siblingIndex],
        position: isRightNode ? 'left' : 'right',
      });
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
}

/**
 * Independently verifies a Merkle proof against an expected Merkle root.
 */
export async function verifyMerkleProof(
  leaf: string,
  proof: MerkleProofNode[],
  expectedMerkleRoot: string
): Promise<boolean> {
  if (!expectedMerkleRoot || expectedMerkleRoot === EMPTY_MERKLE_ROOT) {
    return false;
  }

  if (proof.length === 0) {
    return leaf.toLowerCase() === expectedMerkleRoot.toLowerCase();
  }

  let currentHash = leaf.toLowerCase();

  for (const node of proof) {
    const siblingHash = node.hash.toLowerCase();
    if (node.position === 'left') {
      currentHash = (await computePairHash(siblingHash, currentHash)).toLowerCase();
    } else {
      currentHash = (await computePairHash(currentHash, siblingHash)).toLowerCase();
    }
  }

  return currentHash.toLowerCase() === expectedMerkleRoot.toLowerCase();
}

/**
 * Selects eligible finalized transactions for Merkle batching.
 * Filters out unsigned, failed, or already anchored records.
 */
export function filterEligibleTransactions(
  transactions: HybridTransactionRecord[]
): HybridTransactionRecord[] {
  return transactions.filter((tx) => {
    // Must be a valid confirmed transaction
    const isConfirmed =
      tx.status === 'CONFIRMED' ||
      tx.status === 'FINALIZED' ||
      tx.status === 'completed';

    // Must have valid canonical IDs and hashes
    const hasValidIdentity =
      Boolean(tx.applicationTransactionId || tx.id) &&
      Boolean(tx.transactionHash || tx.hash) &&
      Boolean(tx.signature || tx.digitalSignature);

    // Must not already be anchored in a confirmed Merkle batch
    const notYetAnchored = tx.anchorStatus !== 'ANCHOR_CONFIRMED';

    return isConfirmed && hasValidIdentity && notYetAnchored;
  });
}

/**
 * Deterministically sorts transactions by applicationTransactionId to ensure
 * exact reproducible Merkle root across all distributed workers/nodes.
 */
export function sortTransactionsDeterministically(
  transactions: HybridTransactionRecord[]
): HybridTransactionRecord[] {
  return [...transactions].sort((a, b) => {
    const idA = a.applicationTransactionId || a.id;
    const idB = b.applicationTransactionId || b.id;
    return idA.localeCompare(idB);
  });
}

/**
 * Creates and anchors a Merkle batch to the real EVM smart contract on-chain.
 */
export async function createAndAnchorMerkleBatch(
  transactions: HybridTransactionRecord[],
  options?: { batchId?: string; force?: boolean }
): Promise<BatchCreationResult> {
  const eligible = filterEligibleTransactions(transactions);

  if (eligible.length === 0) {
    return {
      success: false,
      error: 'No eligible finalized transactions available for Merkle batching',
    };
  }

  const sortedTxs = sortTransactionsDeterministically(eligible);
  const batchId =
    options?.batchId ||
    `BATCH_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const createdAt = new Date().toISOString();

  // Compute deterministic leaf for each transaction
  const leafHashes: string[] = [];
  for (const tx of sortedTxs) {
    const appId = tx.applicationTransactionId || tx.id;
    const txHash = tx.transactionHash || tx.hash;
    const leaf = await computeMerkleLeaf({
      applicationTransactionId: appId,
      transactionHash: txHash,
    });
    leafHashes.push(leaf);
  }

  // Build Merkle Tree
  const { root: merkleRoot } = await buildMerkleTree(leafHashes);

  const provider = getProvider();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  const batchRecord: AnchorBatch = {
    batchId,
    merkleRoot,
    transactionCount: sortedTxs.length,
    firstTransactionId: sortedTxs[0].applicationTransactionId || sortedTxs[0].id,
    lastTransactionId: sortedTxs[sortedTxs.length - 1].applicationTransactionId || sortedTxs[sortedTxs.length - 1].id,
    transactionIds: sortedTxs.map((t) => t.applicationTransactionId || t.id),
    leafHashes,
    chainId,
    contractAddress: LEDGER_CONTRACT_ADDRESS,
    blockchainTransactionHash: null,
    blockNumber: null,
    blockHash: null,
    status: 'ANCHOR_SUBMITTED',
    createdAt,
    submittedAt: createdAt,
    anchoredAt: null,
  };

  // Submit to Real EVM Smart Contract
  try {
    const contract = getContract(LEDGER_CONTRACT_ADDRESS, LEDGER_ABI, true);
    const batchIdBytes32 = ethers.id(batchId);
    const rootBytes32 = merkleRoot.startsWith('0x') && merkleRoot.length === 66
      ? merkleRoot
      : ethers.id(merkleRoot);

    // Check on-chain idempotency: avoid duplicate anchor submission
    const alreadyExists = await contract.verifyMerkleBatch(batchIdBytes32).catch(() => false);
    if (alreadyExists) {
      console.info(`[MerkleService] Batch ${batchId} already anchored on-chain.`);
      const existing = await contract.getMerkleBatch(batchIdBytes32);
      batchRecord.status = 'ANCHOR_CONFIRMED';
      batchRecord.blockNumber = Number(existing.blockNumber);
      batchRecord.anchoredAt = new Date(Number(existing.timestamp) * 1000).toISOString();
      return {
        success: true,
        batch: batchRecord,
        anchoredOnChain: true,
      };
    }

    console.info(`[MerkleService] Anchoring Merkle Root ${merkleRoot} for ${sortedTxs.length} txs to contract...`);
    const tx = await contract.recordMerkleBatch(
      batchIdBytes32,
      rootBytes32,
      sortedTxs.length
    );

    console.info(`[MerkleService] Anchor submitted! Tx Hash: ${tx.hash}. Awaiting block confirmation...`);
    const receipt = await tx.wait(1);

    if (!receipt || receipt.status !== 1) {
      batchRecord.status = 'ANCHOR_FAILED';
      batchRecord.errorMessage = `Anchor transaction reverted on blockchain (status: ${receipt?.status})`;
      return {
        success: false,
        batch: batchRecord,
        error: batchRecord.errorMessage,
        anchoredOnChain: false,
      };
    }

    const anchoredAt = new Date().toISOString();
    batchRecord.status = 'ANCHOR_CONFIRMED';
    batchRecord.blockchainTransactionHash = receipt.hash;
    batchRecord.blockNumber = receipt.blockNumber;
    batchRecord.blockHash = receipt.blockHash;
    batchRecord.anchoredAt = anchoredAt;

    console.info(`[MerkleService] ✓ Merkle Batch ${batchId} Anchored in Block #${receipt.blockNumber} (Tx: ${receipt.hash})`);

    return {
      success: true,
      batch: batchRecord,
      anchoredOnChain: true,
    };
  } catch (chainErr: any) {
    console.error('[MerkleService] Blockchain anchor submission failed:', chainErr);
    batchRecord.status = 'ANCHOR_REQUIRES_RETRY';
    batchRecord.errorMessage = chainErr?.message || 'Anchor submission failed';
    return {
      success: false,
      batch: batchRecord,
      error: chainErr?.message || 'Blockchain anchor error',
      anchoredOnChain: false,
    };
  }
}

/**
 * Generates an end-to-end Merkle Proof for a specific transaction in an AnchorBatch.
 */
export async function generateProofForTransaction(
  batch: AnchorBatch,
  applicationTransactionId: string
): Promise<MerkleProof | null> {
  const index = batch.transactionIds.indexOf(applicationTransactionId);
  if (index === -1) return null;

  const { levels, root } = await buildMerkleTree(batch.leafHashes);
  const proofNodes = generateMerkleProofFromLevels(levels, index);
  const leaf = batch.leafHashes[index];

  const verified = await verifyMerkleProof(leaf, proofNodes, root);

  return {
    batchId: batch.batchId,
    applicationTransactionId,
    leaf,
    proof: proofNodes,
    merkleRoot: root,
    verified,
    blockchainTransactionHash: batch.blockchainTransactionHash,
    blockNumber: batch.blockNumber,
    blockHash: batch.blockHash,
  };
}

/**
 * Cryptographically and structurally verifies complete Merkle Batch integrity:
 * Off-Chain Transactions ↔ Recalculated Leaves ↔ Merkle Root ↔ Real On-Chain Blockchain Anchor.
 */
export async function verifyMerkleBatchIntegrity(
  batch: AnchorBatch,
  transactions: HybridTransactionRecord[]
): Promise<MerkleVerificationResult> {
  const mismatches: string[] = [];

  // Filter and sort transactions matching this batch
  const batchTxs = transactions.filter((t) =>
    batch.transactionIds.includes(t.applicationTransactionId || t.id)
  );

  const sortedTxs = sortTransactionsDeterministically(batchTxs);

  // Recalculate leaves
  const recalculatedLeaves: string[] = [];
  for (const tx of sortedTxs) {
    const leaf = await computeMerkleLeaf({
      applicationTransactionId: tx.applicationTransactionId || tx.id,
      transactionHash: tx.transactionHash || tx.hash,
    });
    recalculatedLeaves.push(leaf);
  }

  // Check leaf array match
  let leafMatch = true;
  if (recalculatedLeaves.length !== batch.leafHashes.length) {
    leafMatch = false;
    mismatches.push(
      `Leaf count mismatch: recalculated (${recalculatedLeaves.length}) vs stored (${batch.leafHashes.length})`
    );
  } else {
    for (let i = 0; i < recalculatedLeaves.length; i++) {
      if (recalculatedLeaves[i].toLowerCase() !== batch.leafHashes[i].toLowerCase()) {
        leafMatch = false;
        mismatches.push(
          `Leaf mismatch at index ${i}: recalculated (${recalculatedLeaves[i]}) vs stored (${batch.leafHashes[i]})`
        );
      }
    }
  }

  // Recalculate Merkle root
  const { root: calculatedRoot } = await buildMerkleTree(recalculatedLeaves);
  const rootMatch = calculatedRoot.toLowerCase() === batch.merkleRoot.toLowerCase();

  if (!rootMatch) {
    mismatches.push(
      `Calculated Merkle Root (${calculatedRoot}) does not match stored root (${batch.merkleRoot})`
    );
  }

  // Query Real Blockchain for On-Chain Anchor
  let onChainMatch = false;
  let onChainRoot: string | null = null;

  try {
    const contract = getContract(LEDGER_CONTRACT_ADDRESS, LEDGER_ABI, false);
    const batchIdBytes32 = ethers.id(batch.batchId);
    const onChainBatch = await contract.getMerkleBatch(batchIdBytes32);

    if (onChainBatch && Number(onChainBatch.timestamp) > 0) {
      onChainRoot = onChainBatch.merkleRoot;
      const expectedBytes32 = batch.merkleRoot.startsWith('0x') && batch.merkleRoot.length === 66
        ? batch.merkleRoot
        : ethers.id(batch.merkleRoot);

      onChainMatch = onChainBatch.merkleRoot.toLowerCase() === expectedBytes32.toLowerCase();
      if (!onChainMatch) {
        mismatches.push(
          `On-chain anchored Merkle Root (${onChainBatch.merkleRoot}) does not match batch root (${expectedBytes32})`
        );
      }
    } else {
      mismatches.push(`Batch ID ${batch.batchId} not found in SecureChainLedger contract`);
    }
  } catch (chainErr: any) {
    mismatches.push(`Failed to query on-chain Merkle batch: ${chainErr.message}`);
  }

  const verified = leafMatch && rootMatch && onChainMatch && mismatches.length === 0;

  return {
    verified,
    leafMatch,
    rootMatch,
    onChainMatch,
    mismatches,
    calculatedRoot,
    storedRoot: batch.merkleRoot,
    onChainRoot,
    batchId: batch.batchId,
  };
}
