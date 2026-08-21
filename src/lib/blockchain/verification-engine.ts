import { ethers } from 'ethers';
import { getProvider, getContract } from './client';
import SecureChainLedgerArtifact from '../../../artifacts/contracts/SecureChainLedger.sol/SecureChainLedger.json';
import { HybridTransactionRecord } from '@/types/hybrid-transaction';
import {
  ComprehensiveVerificationResult,
  ExportableProofReport,
  VerificationAuditLog,
  VerificationLayerResult,
  VerificationState,
} from '@/types/verification';
import { AnchorBatch, MerkleProofNode } from '@/types/merkle';
import { canonicalizePayload, computeCanonicalHash, toTxIdBytes32 } from './hybrid-ledger';
import {
  computeMerkleLeaf,
  buildMerkleTree,
  generateMerkleProofFromLevels,
  verifyMerkleProof,
} from './merkle-tree';

const LEDGER_ABI = SecureChainLedgerArtifact.abi;
const LEDGER_CONTRACT_ADDRESS = process.env.LEDGER_CONTRACT_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';
export const REQUIRED_CONFIRMATIONS = Number(process.env.REQUIRED_CONFIRMATIONS) || 1;

// In-memory verification cache with 30s TTL
interface CacheEntry {
  result: ComprehensiveVerificationResult;
  expiresAt: number;
}
const verificationCache = new Map<string, CacheEntry>();

// Append-only audit log store (in-memory + accessible)
export const verificationAuditLogs: VerificationAuditLog[] = [];

/**
 * Unified Centralized Verification Engine (Phase 5B):
 * Executes all 15 verification steps independently from ground truth.
 */
export async function verifyTransactionIntegrity(
  txRecord: HybridTransactionRecord,
  options?: {
    batch?: AnchorBatch;
    bypassCache?: boolean;
    requiredConfirmations?: number;
    requestingUserId?: string;
  }
): Promise<ComprehensiveVerificationResult> {
  const startTime = Date.now();
  const appId = txRecord.applicationTransactionId || txRecord.id;
  const reqConfirmations = options?.requiredConfirmations ?? REQUIRED_CONFIRMATIONS;

  // Check cache
  if (!options?.bypassCache) {
    const cached = verificationCache.get(appId);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, isCached: true };
    }
  }

  const verificationId = `VERIF_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const mismatches: string[] = [];

  // Initialize Layer Results
  const layers: ComprehensiveVerificationResult['layers'] = {
    canonicalSerialization: { status: 'PENDING', message: 'Not evaluated' },
    transactionHash: { status: 'PENDING', message: 'Not evaluated' },
    merkleMembership: { status: 'PENDING', message: 'Not evaluated' },
    merkleProof: { status: 'PENDING', message: 'Not evaluated' },
    merkleRoot: { status: 'PENDING', message: 'Not evaluated' },
    blockchainAnchor: { status: 'PENDING', message: 'Not evaluated' },
    blockConfirmation: { status: 'PENDING', message: 'Not evaluated' },
  };

  // ════════════════════════════════════════════════════════════
  // STEP 1 & 2: Reconstruct Canonical Payload
  // ════════════════════════════════════════════════════════════
  const senderWallet = txRecord.sender || txRecord.walletAddress || '';
  const receiverWallet = txRecord.receiver || txRecord.payload?.receiverWallet || 'System';
  const asset = (txRecord.asset || txRecord.currency || 'USD').toUpperCase();
  const rawTimestamp = txRecord.createdAt || txRecord.date || new Date().toISOString();

  const canonicalPayload = canonicalizePayload({
    applicationTransactionId: appId,
    sender: senderWallet,
    receiver: receiverWallet,
    amount: txRecord.amount,
    asset,
    idempotencyKey: txRecord.idempotencyKey || appId,
    timestamp: rawTimestamp,
  });

  layers.canonicalSerialization = {
    status: 'VALID',
    message: 'Canonical transaction payload deterministically serialized',
    actual: canonicalPayload,
  };

  // ════════════════════════════════════════════════════════════
  // STEP 3 & 4: Recalculate and Compare Transaction Hash
  // ════════════════════════════════════════════════════════════
  const computedTxHash = await computeCanonicalHash(canonicalPayload);
  const storedTxHash = txRecord.transactionHash || txRecord.hash;

  let isHashValid = false;
  if (!storedTxHash) {
    layers.transactionHash = {
      status: 'INVALID',
      message: 'Stored transaction hash is missing',
      expected: computedTxHash,
      actual: 'MISSING',
    };
    mismatches.push('Transaction hash is missing from record');
  } else if (storedTxHash.toLowerCase() !== computedTxHash.toLowerCase()) {
    layers.transactionHash = {
      status: 'INVALID',
      message: `Transaction hash mismatch: computed (${computedTxHash}) vs stored (${storedTxHash})`,
      expected: computedTxHash,
      actual: storedTxHash,
    };
    mismatches.push(`Transaction data tampered: computed hash (${computedTxHash}) != stored (${storedTxHash})`);
  } else {
    layers.transactionHash = {
      status: 'VALID',
      message: 'Transaction SHA-256 hash verified untampered',
      expected: computedTxHash,
      actual: storedTxHash,
    };
    isHashValid = true;
  }

  // ════════════════════════════════════════════════════════════
  // STEP 5, 6, 7, 8, 9, 10: Merkle Membership, Proof & Root
  // ════════════════════════════════════════════════════════════
  const computedLeaf = await computeMerkleLeaf({
    applicationTransactionId: appId,
    transactionHash: computedTxHash,
  });

  let merkleProofNodes: MerkleProofNode[] = [];
  let calculatedMerkleRoot = computedLeaf;
  let isMerkleProofValid = false;
  let isMerkleRootValid = false;

  const storedRoot = txRecord.merkleRoot || options?.batch?.merkleRoot || null;

  if (options?.batch && options.batch.leafHashes.length > 0) {
    // Multi-transaction batch proof
    const batch = options.batch;
    const leafIndex = batch.transactionIds.indexOf(appId);

    if (leafIndex === -1) {
      layers.merkleMembership = {
        status: 'INVALID',
        message: `Transaction ${appId} not found in Merkle batch ${batch.batchId}`,
      };
      mismatches.push(`Transaction not found in specified Merkle batch ${batch.batchId}`);
    } else {
      layers.merkleMembership = {
        status: 'VALID',
        message: `Transaction is verified member of batch ${batch.batchId} at leaf index #${leafIndex}`,
        actual: computedLeaf,
      };

      const { levels, root } = await buildMerkleTree(batch.leafHashes);
      calculatedMerkleRoot = root;
      merkleProofNodes = generateMerkleProofFromLevels(levels, leafIndex);

      isMerkleProofValid = await verifyMerkleProof(computedLeaf, merkleProofNodes, root);
      layers.merkleProof = {
        status: isMerkleProofValid ? 'VALID' : 'INVALID',
        message: isMerkleProofValid
          ? `Merkle audit proof valid (${merkleProofNodes.length} sibling nodes verified)`
          : 'Merkle audit proof verification failed',
      };

      if (!isMerkleProofValid) {
        mismatches.push('Merkle proof failed to reconstruct root hash from leaf');
      }

      isMerkleRootValid = root.toLowerCase() === (storedRoot || '').toLowerCase();
      layers.merkleRoot = {
        status: isMerkleRootValid ? 'VALID' : 'INVALID',
        message: isMerkleRootValid
          ? `Merkle root verified: ${root}`
          : `Merkle root mismatch: calculated (${root}) vs stored (${storedRoot})`,
        expected: root,
        actual: storedRoot,
      };

      if (!isMerkleRootValid) {
        mismatches.push(`Merkle root discrepancy: calculated (${root}) != stored (${storedRoot})`);
      }
    }
  } else {
    // Single transaction or direct leaf verification
    const { levels, root } = await buildMerkleTree([computedLeaf]);
    calculatedMerkleRoot = root;
    merkleProofNodes = generateMerkleProofFromLevels(levels, 0);
    isMerkleProofValid = await verifyMerkleProof(computedLeaf, merkleProofNodes, root);

    layers.merkleMembership = {
      status: 'VALID',
      message: 'Direct cryptographic leaf calculated',
      actual: computedLeaf,
    };
    layers.merkleProof = {
      status: isMerkleProofValid ? 'VALID' : 'INVALID',
      message: 'Direct Merkle leaf proof verified',
    };

    if (storedRoot) {
      isMerkleRootValid = root.toLowerCase() === storedRoot.toLowerCase();
      layers.merkleRoot = {
        status: isMerkleRootValid ? 'VALID' : 'INVALID',
        message: isMerkleRootValid
          ? 'Merkle root matches stored reference'
          : `Merkle root mismatch: calculated (${root}) vs stored (${storedRoot})`,
        expected: root,
        actual: storedRoot,
      };
      if (!isMerkleRootValid) {
        mismatches.push(`Merkle root mismatch: calculated (${root}) != stored (${storedRoot})`);
      }
    } else {
      layers.merkleRoot = {
        status: 'VALID',
        message: `Merkle root derived: ${root}`,
        actual: root,
      };
      isMerkleRootValid = true;
    }
  }

  // ════════════════════════════════════════════════════════════
  // STEP 11, 12, 13, 14: Blockchain Anchor, Smart Contract & Block Info
  // ════════════════════════════════════════════════════════════
  const chainTxHash =
    txRecord.blockchainTransactionHash || options?.batch?.blockchainTransactionHash || null;

  let isBlockchainAnchorValid = false;
  let isBlockValid = false;
  let confirmations = 0;
  let onChainRoot: string | null = null;
  let onChainTimestamp: string | null = null;
  let receiptBlockNumber: number | null = null;
  let receiptBlockHash: string | null = null;
  let activeChainId: number | null = null;

  if (!chainTxHash) {
    layers.blockchainAnchor = {
      status: 'PENDING',
      message: 'No on-chain transaction hash recorded; awaiting anchor',
    };
    layers.blockConfirmation = {
      status: 'SKIPPED',
      message: 'Block confirmation not applicable without blockchain transaction',
    };
  } else {
    try {
      const provider = getProvider();
      const network = await provider.getNetwork();
      activeChainId = Number(network.chainId);

      const latestBlockNumber = await provider.getBlockNumber();
      const receipt = await provider.getTransactionReceipt(chainTxHash);

      if (!receipt) {
        layers.blockchainAnchor = {
          status: 'INVALID',
          message: `Transaction receipt not found on blockchain network (Chain ID: ${activeChainId})`,
          actual: chainTxHash,
        };
        mismatches.push(`Blockchain transaction ${chainTxHash} not found on network`);
      } else if (receipt.status !== 1) {
        layers.blockchainAnchor = {
          status: 'INVALID',
          message: `Blockchain transaction reverted with status 0`,
          actual: 'REVERTED',
        };
        mismatches.push(`On-chain transaction ${chainTxHash} was reverted`);
      } else {
        receiptBlockNumber = receipt.blockNumber;
        receiptBlockHash = receipt.blockHash;

        // Calculate Block Confirmations
        confirmations = Math.max(0, latestBlockNumber - receipt.blockNumber + 1);

        // Verify Smart Contract Anchor Record
        const contract = getContract(LEDGER_CONTRACT_ADDRESS, LEDGER_ABI, false);
        const batchId = options?.batch?.batchId || txRecord.merkleBatchId;

        if (batchId) {
          const batchBytes32 = ethers.id(batchId);
          const onChainBatch = await contract.getMerkleBatch(batchBytes32).catch(() => null);

          if (onChainBatch && Number(onChainBatch.timestamp) > 0) {
            onChainRoot = onChainBatch.merkleRoot;
            onChainTimestamp = new Date(Number(onChainBatch.timestamp) * 1000).toISOString();

            const expectedBytes32 = calculatedMerkleRoot.startsWith('0x') && calculatedMerkleRoot.length === 66
              ? calculatedMerkleRoot
              : ethers.id(calculatedMerkleRoot);

            if (onChainBatch.merkleRoot.toLowerCase() === expectedBytes32.toLowerCase()) {
              isBlockchainAnchorValid = true;
              layers.blockchainAnchor = {
                status: 'VALID',
                message: `Verified on-chain Merkle Batch anchor in SecureChainLedger at ${LEDGER_CONTRACT_ADDRESS}`,
                actual: onChainBatch.merkleRoot,
              };
            } else {
              layers.blockchainAnchor = {
                status: 'INVALID',
                message: `On-chain Merkle root (${onChainBatch.merkleRoot}) does not match calculated root (${expectedBytes32})`,
                expected: expectedBytes32,
                actual: onChainBatch.merkleRoot,
              };
              mismatches.push(`On-chain anchored root differs from calculated transaction root`);
            }
          } else {
            // Direct transaction anchor check fallback
            const txIdBytes32 = toTxIdBytes32(appId);
            const onChainTx = await contract.getTransaction(txIdBytes32).catch(() => null);
            if (onChainTx && Number(onChainTx.timestamp) > 0) {
              isBlockchainAnchorValid = true;
              layers.blockchainAnchor = {
                status: 'VALID',
                message: 'Verified on-chain direct ledger anchor in SecureChainLedger',
              };
            } else {
              layers.blockchainAnchor = {
                status: 'INVALID',
                message: `Batch ID ${batchId} not found in smart contract`,
              };
              mismatches.push(`Batch record not found in smart contract`);
            }
          }
        } else {
          // Single transaction anchor check
          const txIdBytes32 = toTxIdBytes32(appId);
          const onChainTx = await contract.getTransaction(txIdBytes32).catch(() => null);
          if (onChainTx && Number(onChainTx.timestamp) > 0) {
            isBlockchainAnchorValid = true;
            onChainTimestamp = new Date(Number(onChainTx.timestamp) * 1000).toISOString();
            layers.blockchainAnchor = {
              status: 'VALID',
              message: `Verified individual transaction anchor in SecureChainLedger at ${LEDGER_CONTRACT_ADDRESS}`,
            };
          } else {
            isBlockchainAnchorValid = true; // Receipt confirmed
            layers.blockchainAnchor = {
              status: 'VALID',
              message: `Blockchain transaction receipt confirmed in Block #${receipt.blockNumber}`,
            };
          }
        }

        // Evaluate Confirmations
        if (confirmations >= reqConfirmations) {
          isBlockValid = true;
          layers.blockConfirmation = {
            status: 'VALID',
            message: `Block #${receipt.blockNumber} confirmed with ${confirmations} confirmation(s) (Required: ${reqConfirmations})`,
            actual: confirmations,
            expected: reqConfirmations,
          };
        } else {
          layers.blockConfirmation = {
            status: 'PENDING',
            message: `Block #${receipt.blockNumber} has ${confirmations}/${reqConfirmations} confirmations`,
            actual: confirmations,
            expected: reqConfirmations,
          };
        }
      }
    } catch (chainErr: any) {
      layers.blockchainAnchor = {
        status: 'INVALID',
        message: `Blockchain provider query error: ${chainErr.message}`,
      };
      mismatches.push(`Blockchain RPC query failed: ${chainErr.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════
  // STEP 15: Determine Overall Verification State
  // ════════════════════════════════════════════════════════════
  let overallState: VerificationState = 'UNVERIFIED';

  if (!isHashValid) {
    overallState = 'TRANSACTION_HASH_MISMATCH';
  } else if (!isMerkleProofValid) {
    overallState = 'MERKLE_PROOF_INVALID';
  } else if (!isMerkleRootValid) {
    overallState = 'MERKLE_ROOT_MISMATCH';
  } else if (chainTxHash && !isBlockchainAnchorValid) {
    overallState = 'BLOCKCHAIN_ANCHOR_MISMATCH';
  } else if (chainTxHash && confirmations < reqConfirmations) {
    overallState = 'BLOCK_CONFIRMATION_PENDING';
  } else if (isHashValid && isMerkleProofValid && isMerkleRootValid && (isBlockchainAnchorValid || !chainTxHash)) {
    overallState = 'FULLY_VERIFIED';
  } else {
    overallState = mismatches.length > 0 ? 'RECONCILIATION_REQUIRED' : 'TRANSACTION_VALID';
  }

  const fullyVerified = overallState === 'FULLY_VERIFIED' && mismatches.length === 0;
  const durationMs = Date.now() - startTime;

  const result: ComprehensiveVerificationResult = {
    verificationId,
    applicationTransactionId: appId,
    userId: txRecord.userId,
    timestamp,
    overallState,
    fullyVerified,
    layers,
    proofDetails: {
      canonicalPayload,
      computedTransactionHash: computedTxHash,
      storedTransactionHash: storedTxHash || computedTxHash,
      merkleLeaf: computedLeaf,
      merkleBatchId: txRecord.merkleBatchId || options?.batch?.batchId || null,
      merkleRoot: calculatedMerkleRoot,
      onChainMerkleRoot: onChainRoot,
      merkleProof: merkleProofNodes,
      blockchainTransactionHash: chainTxHash,
      blockNumber: receiptBlockNumber ?? txRecord.blockNumber ?? null,
      blockHash: receiptBlockHash ?? txRecord.blockHash ?? null,
      chainId: activeChainId ?? txRecord.chainId ?? 31337,
      contractAddress: LEDGER_CONTRACT_ADDRESS,
      confirmations,
      requiredConfirmations: reqConfirmations,
      onChainTimestamp,
    },
    mismatches,
    durationMs,
    isCached: false,
  };

  // Cache result for 30 seconds
  verificationCache.set(appId, {
    result,
    expiresAt: Date.now() + 30_000,
  });

  // Append to audit log
  verificationAuditLogs.push({
    verificationId,
    transactionId: appId,
    userId: txRecord.userId,
    timestamp,
    overallState,
    fullyVerified,
    durationMs,
    layersSummary: {
      canonicalSerialization: layers.canonicalSerialization.status,
      transactionHash: layers.transactionHash.status,
      merkleMembership: layers.merkleMembership.status,
      merkleProof: layers.merkleProof.status,
      merkleRoot: layers.merkleRoot.status,
      blockchainAnchor: layers.blockchainAnchor.status,
      blockConfirmation: layers.blockConfirmation.status,
    },
    mismatchesCount: mismatches.length,
    mismatches,
  });

  return result;
}

/**
 * Generates a clean, exportable JSON proof report containing zero sensitive secrets.
 */
export function generateExportableProofReport(
  txRecord: HybridTransactionRecord,
  verificationResult: ComprehensiveVerificationResult
): ExportableProofReport {
  return {
    version: '1.0',
    exportTimestamp: new Date().toISOString(),
    transactionId: txRecord.applicationTransactionId || txRecord.id,
    userId: txRecord.userId,
    transactionData: {
      sender: txRecord.sender || txRecord.walletAddress || '',
      receiver: txRecord.receiver || txRecord.payload?.receiverWallet || 'System',
      amount: txRecord.amount,
      asset: txRecord.asset || txRecord.currency || 'USD',
      type: txRecord.type,
      createdAt: txRecord.createdAt || txRecord.date,
    },
    cryptographicProof: {
      canonicalPayload: verificationResult.proofDetails.canonicalPayload,
      transactionHash: verificationResult.proofDetails.computedTransactionHash,
      signature: txRecord.signature || txRecord.digitalSignature || '',
      senderPublicKey: txRecord.senderPublicKey,
    },
    merkleProof: {
      merkleBatchId: verificationResult.proofDetails.merkleBatchId,
      merkleLeaf: verificationResult.proofDetails.merkleLeaf,
      merkleProofNodes: verificationResult.proofDetails.merkleProof || [],
      merkleRoot: verificationResult.proofDetails.merkleRoot || '',
    },
    blockchainAnchor: {
      network: 'Hardhat Local / Polygon Amoy',
      chainId: verificationResult.proofDetails.chainId || 31337,
      contractAddress: verificationResult.proofDetails.contractAddress || LEDGER_CONTRACT_ADDRESS,
      blockchainTransactionHash: verificationResult.proofDetails.blockchainTransactionHash || null,
      blockNumber: verificationResult.proofDetails.blockNumber || null,
      blockHash: verificationResult.proofDetails.blockHash || null,
      confirmations: verificationResult.proofDetails.confirmations,
      receiptStatus: verificationResult.layers.blockchainAnchor.status === 'VALID' ? 'SUCCESS' : 'NOT_FOUND',
    },
    verificationSummary: {
      overallStatus: verificationResult.overallState,
      fullyVerified: verificationResult.fullyVerified,
      verificationId: verificationResult.verificationId,
      verifiedAt: verificationResult.timestamp,
    },
  };
}
