import { ethers } from 'ethers';
import { getProvider, getContract } from './client';
import SecureChainLedgerArtifact from '../../../artifacts/contracts/SecureChainLedger.sol/SecureChainLedger.json';
import { HybridTransactionRecord, TransactionStatus } from '@/types/hybrid-transaction';
import {
  ReconciliationResult,
  ReconciliationState,
  ReconciliationMismatch,
  ReconciliationAuditLog,
  MismatchSeverity,
} from '@/types/reconciliation';
import { canonicalizePayload, computeCanonicalHash, toTxIdBytes32 } from './hybrid-ledger';

const LEDGER_ABI = SecureChainLedgerArtifact.abi;
const LEDGER_CONTRACT_ADDRESS = process.env.LEDGER_CONTRACT_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';

/**
 * Executes an async operation with exponential backoff for retryable network errors.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 300
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err?.code === 'NETWORK_ERROR' ||
        err?.code === 'TIMEOUT' ||
        err?.code === 'SERVER_ERROR' ||
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('ECONNREFUSED');

      if (!isRetryable || attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * Dedicated Reconciliation Engine:
 * Compares Off-Chain Database Record ↔ Real Blockchain State.
 * Detects mismatches, classifies integrity status, and executes safe recovery where unambiguous.
 */
export async function reconcileTransaction(
  txRecord: HybridTransactionRecord,
  options?: { autoRecover?: boolean; uid?: string }
): Promise<ReconciliationResult> {
  const reconciliationId = `REC_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const mismatches: ReconciliationMismatch[] = [];
  const autoRecover = options?.autoRecover ?? false;

  const offChainStatus = txRecord.status || 'SUBMITTED';
  let blockchainStatus = 'UNKNOWN';
  let reconciliationStatus: ReconciliationState = 'NOT_CHECKED';
  let severity: MismatchSeverity = 'INFO';
  let actionPerformed = 'VERIFICATION_ONLY';
  let isRetryable = false;
  let recoveredFields: Partial<HybridTransactionRecord> | undefined = undefined;

  // Genesis block special handling
  if (txRecord.type === 'genesis') {
    return {
      reconciliationId,
      applicationTransactionId: txRecord.applicationTransactionId || txRecord.id,
      userId: txRecord.userId,
      timestamp,
      offChainStatus: 'CONFIRMED',
      blockchainStatus: 'GENESIS_ANCHOR',
      reconciliationStatus: 'MATCHED',
      verified: true,
      severity: 'INFO',
      actionPerformed: 'GENESIS_BLOCK_VERIFIED',
      mismatches: [],
      isRetryable: false,
      blockNumber: 0,
    };
  }

  // ════════════════════════════════════════════════════════════
  // 1. CRYPTOGRAPHIC INTEGRITY CHECK (Phase 3F)
  // ════════════════════════════════════════════════════════════
  let isCryptoValid = true;

  // Reconstruct canonical payload
  const reconstructedPayload = canonicalizePayload({
    applicationTransactionId: txRecord.applicationTransactionId || txRecord.id,
    sender: txRecord.sender || txRecord.walletAddress || '',
    receiver: txRecord.receiver || txRecord.payload?.receiverWallet || 'System',
    amount: txRecord.amount,
    asset: txRecord.asset || txRecord.currency || 'USD',
    idempotencyKey: txRecord.idempotencyKey || txRecord.id,
    timestamp: txRecord.createdAt || txRecord.date,
  });

  const expectedCanonicalHash = await computeCanonicalHash(reconstructedPayload);

  // Check stored canonical hash vs expected
  const storedHash = txRecord.transactionHash || txRecord.hash;
  if (storedHash && storedHash !== expectedCanonicalHash && txRecord.canonicalPayload) {
    // Only flag if canonicalPayload exists and diverges
    mismatches.push({
      field: 'transactionHash',
      offChain: storedHash,
      onChain: expectedCanonicalHash,
      severity: 'CRITICAL',
      message: `Canonical transaction hash mismatch: stored (${storedHash}) vs computed (${expectedCanonicalHash})`,
    });
    isCryptoValid = false;
  }

  // Verify ECDSA Signature
  const signature = txRecord.signature || txRecord.digitalSignature;
  const payloadToVerify = txRecord.canonicalPayload || reconstructedPayload;

  if (!signature) {
    mismatches.push({
      field: 'signature',
      offChain: 'MISSING',
      onChain: null,
      severity: 'CRITICAL',
      message: 'Digital signature is missing from transaction record',
    });
    isCryptoValid = false;
  } else {
    try {
      const recoveredAddress = ethers.verifyMessage(payloadToVerify, signature);
      const expectedSender = (txRecord.sender || txRecord.walletAddress || '').toLowerCase();
      if (recoveredAddress.toLowerCase() !== expectedSender) {
        mismatches.push({
          field: 'signature',
          offChain: signature,
          onChain: recoveredAddress,
          severity: 'CRITICAL',
          message: `Signature recovery address mismatch: recovered (${recoveredAddress}) does not match sender (${expectedSender})`,
        });
        isCryptoValid = false;
      }
    } catch (sigErr: any) {
      mismatches.push({
        field: 'signature',
        offChain: signature,
        onChain: null,
        severity: 'CRITICAL',
        message: `Cryptographic signature verification failed: ${sigErr.message}`,
      });
      isCryptoValid = false;
    }
  }

  // ════════════════════════════════════════════════════════════
  // 1B. PHASE 4 MERKLE LEAF & ROOT INTEGRITY CHECK
  // ════════════════════════════════════════════════════════════
  let isMerkleValid = true;
  if (txRecord.merkleLeaf || txRecord.merkleBatchId || txRecord.merkleRoot) {
    const expectedLeaf = await computeCanonicalHash(
      `v1:${txRecord.applicationTransactionId || txRecord.id}:${(txRecord.transactionHash || txRecord.hash).toLowerCase()}`
    );

    if (txRecord.merkleLeaf && txRecord.merkleLeaf.toLowerCase() !== expectedLeaf.toLowerCase()) {
      mismatches.push({
        field: 'merkleLeaf',
        offChain: txRecord.merkleLeaf,
        onChain: expectedLeaf,
        severity: 'CRITICAL',
        message: `Merkle leaf mismatch: stored (${txRecord.merkleLeaf}) vs computed (${expectedLeaf})`,
      });
      isMerkleValid = false;
    }
  }
  // 2. BLOCKCHAIN QUERY & STATE VERIFICATION (Phase 3G, 3J, 3O)
  // ════════════════════════════════════════════════════════════
  const chainTxHash = txRecord.blockchainTransactionHash;

  if (!chainTxHash) {
    // No on-chain hash recorded
    if (offChainStatus === 'CONFIRMED' || offChainStatus === 'completed') {
      mismatches.push({
        field: 'blockchainTransactionHash',
        offChain: 'CONFIRMED_WITHOUT_ONCHAIN_PROOF',
        onChain: null,
        severity: 'CRITICAL',
        message: 'Off-chain status is CONFIRMED but no blockchain transaction hash exists',
      });
      reconciliationStatus = 'MISMATCH';
      severity = 'CRITICAL';
      actionPerformed = 'MANUAL_REVIEW_REQUIRED';
    } else {
      reconciliationStatus = 'BLOCKCHAIN_PENDING';
      severity = 'INFO';
      actionPerformed = 'WAITING_FOR_BLOCKCHAIN_SUBMISSION';
    }

    return {
      reconciliationId,
      applicationTransactionId: txRecord.applicationTransactionId || txRecord.id,
      userId: txRecord.userId,
      timestamp,
      offChainStatus,
      blockchainStatus: 'NO_TX_HASH',
      reconciliationStatus,
      verified: isCryptoValid && mismatches.length === 0,
      severity,
      actionPerformed,
      mismatches,
      isRetryable: false,
    };
  }

  // Query Real Blockchain Provider with retry
  let provider: ethers.Provider;
  let receipt: ethers.TransactionReceipt | null = null;
  let onChainTx: ethers.TransactionResponse | null = null;
  let onChainContractRecord: any = null;
  let chainId: number | null = null;

  try {
    provider = getProvider();
    const network = await withRetry(() => provider.getNetwork());
    chainId = Number(network.chainId);

    // Query Transaction Receipt
    receipt = await withRetry(() => provider.getTransactionReceipt(chainTxHash));

    if (!receipt) {
      // Check if transaction is in mempool / pending
      onChainTx = await withRetry(() => provider.getTransaction(chainTxHash));
      if (onChainTx) {
        blockchainStatus = 'PENDING_CONFIRMATION';
        reconciliationStatus = 'BLOCKCHAIN_PENDING';
        severity = 'INFO';
        actionPerformed = 'AWAITING_BLOCK_MINING';
      } else {
        blockchainStatus = 'NOT_FOUND';
        reconciliationStatus = 'BLOCKCHAIN_NOT_FOUND';
        severity = 'CRITICAL';
        mismatches.push({
          field: 'blockchainTransactionHash',
          offChain: chainTxHash,
          onChain: 'NOT_FOUND_ON_CHAIN',
          severity: 'CRITICAL',
          message: `Transaction ${chainTxHash} could not be found on blockchain network (Chain ID ${chainId})`,
        });
        actionPerformed = 'MANUAL_REVIEW_REQUIRED';
      }
    } else {
      // Receipt found
      blockchainStatus = receipt.status === 1 ? 'SUCCESS' : 'REVERTED';

      if (receipt.status !== 1) {
        mismatches.push({
          field: 'receiptStatus',
          offChain: offChainStatus,
          onChain: 'REVERTED (0)',
          severity: 'CRITICAL',
          message: `Blockchain transaction was reverted/failed on-chain (receipt status: 0)`,
        });
        reconciliationStatus = 'MISMATCH';
        severity = 'CRITICAL';
        actionPerformed = 'MANUAL_REVIEW_REQUIRED';
      } else {
        // Query Smart Contract on-chain record
        const contract = getContract(LEDGER_CONTRACT_ADDRESS, LEDGER_ABI, false);
        const txIdBytes32 = toTxIdBytes32(txRecord.applicationTransactionId || txRecord.id);
        
        try {
          onChainContractRecord = await withRetry(() => contract.getTransaction(txIdBytes32));
        } catch (contractErr: any) {
          console.warn('[Reconciliation] Smart contract read warning:', contractErr?.message);
        }

        // ════════════════════════════════════════════════════════════
        // 3. FIELD-BY-FIELD COMPARISON (Phase 3E)
        // ════════════════════════════════════════════════════════════
        if (onChainContractRecord && Number(onChainContractRecord.timestamp) > 0) {
          // Compare Amount
          const expectedScaledAmount = BigInt(Math.round(Number(txRecord.amount) * 1_000_000));
          if (onChainContractRecord.amount !== expectedScaledAmount) {
            mismatches.push({
              field: 'amount',
              offChain: txRecord.amount,
              onChain: Number(onChainContractRecord.amount) / 1_000_000,
              severity: 'CRITICAL',
              message: `Amount mismatch: off-chain (${txRecord.amount}) vs on-chain (${Number(onChainContractRecord.amount) / 1_000_000})`,
            });
          }

          // Compare Asset / Currency
          const expectedCurrency = (txRecord.asset || txRecord.currency || 'USD').toUpperCase();
          if (onChainContractRecord.currency.toUpperCase() !== expectedCurrency) {
            mismatches.push({
              field: 'asset',
              offChain: expectedCurrency,
              onChain: onChainContractRecord.currency,
              severity: 'CRITICAL',
              message: `Currency mismatch: off-chain (${expectedCurrency}) vs on-chain (${onChainContractRecord.currency})`,
            });
          }

          // Compare Sender
          const expectedSender = (txRecord.sender || txRecord.walletAddress || '').toLowerCase();
          if (onChainContractRecord.sender.toLowerCase() !== expectedSender && ethers.isAddress(expectedSender)) {
            mismatches.push({
              field: 'sender',
              offChain: expectedSender,
              onChain: onChainContractRecord.sender.toLowerCase(),
              severity: 'CRITICAL',
              message: `Sender mismatch: off-chain (${expectedSender}) vs on-chain (${onChainContractRecord.sender})`,
            });
          }

          // Compare Receiver
          const expectedReceiver = (txRecord.receiver || txRecord.payload?.receiverWallet || 'System').toLowerCase();
          if (onChainContractRecord.receiver.toLowerCase() !== expectedReceiver && ethers.isAddress(expectedReceiver)) {
            mismatches.push({
              field: 'receiver',
              offChain: expectedReceiver,
              onChain: onChainContractRecord.receiver.toLowerCase(),
              severity: 'CRITICAL',
              message: `Receiver mismatch: off-chain (${expectedReceiver}) vs on-chain (${onChainContractRecord.receiver})`,
            });
          }
        }

        // Compare Block Number
        if (txRecord.blockNumber && txRecord.blockNumber > 0 && txRecord.blockNumber !== receipt.blockNumber) {
          mismatches.push({
            field: 'blockNumber',
            offChain: txRecord.blockNumber,
            onChain: receipt.blockNumber,
            severity: 'WARNING',
            message: `Block number mismatch: off-chain (${txRecord.blockNumber}) vs receipt (${receipt.blockNumber})`,
          });
        }

        // Compare Block Hash
        if (txRecord.blockHash && txRecord.blockHash !== receipt.blockHash) {
          mismatches.push({
            field: 'blockHash',
            offChain: txRecord.blockHash,
            onChain: receipt.blockHash,
            severity: 'WARNING',
            message: `Block hash mismatch: off-chain (${txRecord.blockHash}) vs receipt (${receipt.blockHash})`,
          });
        }

        // ════════════════════════════════════════════════════════════
        // 4. CONFLICT RESOLUTION & RECOVERY CLASSIFICATION (Phase 3I, 3K, 3L)
        // ════════════════════════════════════════════════════════════
        const criticalMismatches = mismatches.filter((m) => m.severity === 'CRITICAL');

        if (criticalMismatches.length > 0 || !isCryptoValid) {
          reconciliationStatus = 'MISMATCH';
          severity = 'CRITICAL';
          actionPerformed = 'MANUAL_REVIEW_REQUIRED';
        } else {
          // Off-chain state updates needed?
          const isStaleStatus = offChainStatus === 'SUBMITTED' || offChainStatus === 'pending';
          const isMissingBlockData = !txRecord.blockNumber || !txRecord.blockHash;

          if (isStaleStatus || isMissingBlockData) {
            reconciliationStatus = autoRecover ? 'RECOVERY_COMPLETED' : 'RECOVERY_REQUIRED';
            severity = 'INFO';
            actionPerformed = autoRecover
              ? 'SAFE_AUTO_RECOVERY_APPLIED'
              : 'DATABASE_UPDATE_PENDING';

            recoveredFields = {
              status: 'CONFIRMED' as TransactionStatus,
              blockNumber: receipt.blockNumber,
              blockHash: receipt.blockHash,
              chainId,
              contractAddress: LEDGER_CONTRACT_ADDRESS,
              confirmedAt: txRecord.confirmedAt || new Date().toISOString(),
              reconciliationStatus: 'MATCHED',
              lastReconciledAt: timestamp,
            };
          } else {
            reconciliationStatus = 'MATCHED';
            severity = 'INFO';
            actionPerformed = 'VERIFIED_MATCHED';
          }
        }
      }
    }
  } catch (providerErr: any) {
    console.error('[Reconciliation Engine] RPC/Network error:', providerErr);
    isRetryable = true;
    blockchainStatus = 'RPC_ERROR';
    reconciliationStatus = 'BLOCKCHAIN_PENDING';
    severity = 'WARNING';
    actionPerformed = 'RETRY_REQUIRED_ON_RPC';
    mismatches.push({
      field: 'networkProvider',
      offChain: null,
      onChain: null,
      severity: 'WARNING',
      message: `Blockchain provider query failed: ${providerErr.message || 'Transient RPC failure'}`,
    });
  }

  const isFullyVerified =
    isCryptoValid &&
    mismatches.filter((m) => m.severity === 'CRITICAL').length === 0 &&
    (reconciliationStatus === 'MATCHED' || reconciliationStatus === 'RECOVERY_COMPLETED');

  return {
    reconciliationId,
    applicationTransactionId: txRecord.applicationTransactionId || txRecord.id,
    userId: txRecord.userId,
    timestamp,
    offChainStatus,
    blockchainStatus,
    reconciliationStatus,
    verified: isFullyVerified,
    severity,
    actionPerformed,
    recoveredFields,
    mismatches,
    isRetryable,
    blockchainTransactionHash: chainTxHash,
    blockNumber: receipt?.blockNumber ?? txRecord.blockNumber ?? null,
    blockHash: receipt?.blockHash ?? txRecord.blockHash ?? null,
    contractAddress: LEDGER_CONTRACT_ADDRESS,
    chainId,
  };
}

/**
 * Reconciles an on-chain transaction that has no matching Firestore record (Phase 3H).
 * Safe recovery constructs an off-chain record without creating a duplicate blockchain submission.
 */
export async function reconcileMissingDatabaseRecord(params: {
  blockchainTxHash: string;
  uid: string;
}): Promise<ReconciliationResult> {
  const reconciliationId = `REC_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const provider = getProvider();

  try {
    const receipt = await withRetry(() => provider.getTransactionReceipt(params.blockchainTxHash));
    if (!receipt || receipt.status !== 1) {
      return {
        reconciliationId,
        applicationTransactionId: `RECOVERED_${params.blockchainTxHash.substring(0, 10)}`,
        userId: params.uid,
        timestamp,
        offChainStatus: 'NOT_FOUND',
        blockchainStatus: receipt ? 'REVERTED' : 'NOT_FOUND',
        reconciliationStatus: 'BLOCKCHAIN_NOT_FOUND',
        verified: false,
        severity: 'CRITICAL',
        actionPerformed: 'MANUAL_REVIEW_REQUIRED',
        mismatches: [
          {
            field: 'databaseRecord',
            offChain: null,
            onChain: params.blockchainTxHash,
            severity: 'CRITICAL',
            message: 'Blockchain receipt not found or reverted; cannot safely reconstruct record',
          },
        ],
        isRetryable: false,
      };
    }

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    const recoveredRecord: Partial<HybridTransactionRecord> = {
      applicationTransactionId: `TX_RECOVERED_${receipt.blockNumber}_${params.blockchainTxHash.substring(2, 8)}`,
      userId: params.uid,
      status: 'CONFIRMED',
      blockchainTransactionHash: params.blockchainTxHash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      chainId,
      contractAddress: receipt.to || LEDGER_CONTRACT_ADDRESS,
      createdAt: timestamp,
      confirmedAt: timestamp,
      reconciliationStatus: 'RECOVERY_COMPLETED',
      lastReconciledAt: timestamp,
    };

    return {
      reconciliationId,
      applicationTransactionId: recoveredRecord.applicationTransactionId!,
      userId: params.uid,
      timestamp,
      offChainStatus: 'DATABASE_RECORD_MISSING',
      blockchainStatus: 'SUCCESS',
      reconciliationStatus: 'RECOVERY_COMPLETED',
      verified: true,
      severity: 'INFO',
      actionPerformed: 'DATABASE_RECORD_RECONSTRUCTED',
      recoveredFields: recoveredRecord,
      mismatches: [],
      isRetryable: false,
      blockchainTransactionHash: params.blockchainTxHash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      contractAddress: LEDGER_CONTRACT_ADDRESS,
      chainId,
    };
  } catch (err: any) {
    return {
      reconciliationId,
      applicationTransactionId: `RECOVERED_${params.blockchainTxHash.substring(0, 10)}`,
      userId: params.uid,
      timestamp,
      offChainStatus: 'DATABASE_RECORD_MISSING',
      blockchainStatus: 'RPC_ERROR',
      reconciliationStatus: 'BLOCKCHAIN_PENDING',
      verified: false,
      severity: 'WARNING',
      actionPerformed: 'RETRY_REQUIRED_ON_RPC',
      mismatches: [
        {
          field: 'networkProvider',
          offChain: null,
          onChain: null,
          severity: 'WARNING',
          message: err.message || 'RPC error during missing record reconstruction',
        },
      ],
      isRetryable: true,
    };
  }
}
