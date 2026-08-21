import { ethers } from 'ethers';
import { getProvider, getContract } from './client';
import SecureChainLedgerArtifact from '../../../artifacts/contracts/SecureChainLedger.sol/SecureChainLedger.json';
import { HybridTransactionRecord, HybridVerificationResult } from '@/types/hybrid-transaction';

const LEDGER_ABI = SecureChainLedgerArtifact.abi;
const LEDGER_CONTRACT_ADDRESS = process.env.LEDGER_CONTRACT_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';

/**
 * Deterministically canonicalizes transaction parameters to produce an immutable, stable payload.
 */
export function canonicalizePayload(params: {
  applicationTransactionId: string;
  sender: string;
  receiver: string;
  amount: number;
  asset: string;
  idempotencyKey: string;
  timestamp: string;
}): string {
  const cleanSender = params.sender.trim().toLowerCase();
  const cleanReceiver = params.receiver.trim().toLowerCase();
  const cleanAmount = Number(params.amount).toFixed(6);
  const cleanAsset = params.asset.trim().toUpperCase();
  const cleanAppId = params.applicationTransactionId.trim();
  const cleanIdemp = params.idempotencyKey.trim();
  const cleanTimestamp = params.timestamp.trim();

  return `appId:${cleanAppId}|sender:${cleanSender}|receiver:${cleanReceiver}|amount:${cleanAmount}|asset:${cleanAsset}|nonce:${cleanIdemp}|timestamp:${cleanTimestamp}`;
}

/**
 * Computes deterministic SHA-256 hash of the canonical payload
 */
export async function computeCanonicalHash(canonicalPayload: string): Promise<string> {
  const enc = new TextEncoder();
  const digestBuffer = await crypto.subtle.digest('SHA-256', enc.encode(canonicalPayload));
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts an applicationTransactionId into a deterministic 32-byte hash for on-chain storage
 */
export function toTxIdBytes32(applicationTransactionId: string): string {
  return ethers.id(applicationTransactionId);
}

/**
 * Submits the canonical transaction proof to the SecureChainLedger smart contract on-chain.
 */
export async function submitTransactionToLedger(params: {
  applicationTransactionId: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: string;
}): Promise<{
  success: boolean;
  blockchainTransactionHash?: string;
  blockNumber?: number;
  blockHash?: string;
  chainId?: number;
  contractAddress?: string;
  error?: string;
}> {
  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    const contract = getContract(LEDGER_CONTRACT_ADDRESS, LEDGER_ABI, true);
    const txIdBytes32 = toTxIdBytes32(params.applicationTransactionId);

    // Check idempotency on-chain: if already recorded, retrieve existing record
    const alreadyExists = await contract.verifyTransaction(txIdBytes32).catch(() => false);
    if (alreadyExists) {
      console.info(`[HybridLedger] Transaction ${params.applicationTransactionId} already exists on-chain. Retrieving existing record.`);
      const existing = await contract.getTransaction(txIdBytes32);
      return {
        success: true,
        blockchainTransactionHash: null as any,
        blockNumber: null as any,
        blockHash: null as any,
        chainId,
        contractAddress: LEDGER_CONTRACT_ADDRESS,
      };
    }

    // Resolve valid Ethereum addresses
    let senderAddress = params.sender;
    if (!ethers.isAddress(senderAddress)) {
      senderAddress = ethers.computeAddress(ethers.id(params.sender).substring(0, 42));
    }

    let receiverAddress = params.receiver;
    if (!ethers.isAddress(receiverAddress)) {
      // Map arbitrary recipient string (e.g. email/username) deterministically to an address
      receiverAddress = ethers.getAddress('0x' + ethers.id(params.receiver).substring(26));
    }

    // Scale amount by 10^6 for integer precision
    const scaledAmount = BigInt(Math.round(Number(params.amount) * 1_000_000));

    console.info(`[HybridLedger] Submitting tx to SecureChainLedger contract at ${LEDGER_CONTRACT_ADDRESS}...`);
    const tx = await contract.recordTransaction(
      txIdBytes32,
      senderAddress,
      receiverAddress,
      scaledAmount,
      params.currency
    );

    console.info(`[HybridLedger] Submitted! EVM Hash: ${tx.hash}. Waiting for block confirmation...`);
    const receipt = await tx.wait(1);

    if (!receipt || receipt.status !== 1) {
      return {
        success: false,
        error: `Blockchain transaction reverted with receipt status: ${receipt?.status}`,
      };
    }

    console.info(`[HybridLedger] ✓ Confirmed in Block #${receipt.blockNumber} (BlockHash: ${receipt.blockHash})`);

    return {
      success: true,
      blockchainTransactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      chainId,
      contractAddress: LEDGER_CONTRACT_ADDRESS,
    };
  } catch (error: any) {
    console.error('[HybridLedger] Blockchain submission failed:', error);
    return {
      success: false,
      error: error?.message || 'Blockchain submission failed',
    };
  }
}

/**
 * Cryptographically and structurally verifies a hybrid transaction against the real EVM blockchain.
 */
export async function verifyHybridTransactionProof(
  txRecord: HybridTransactionRecord
): Promise<HybridVerificationResult> {
  const mismatches: string[] = [];

  // 1. Verify Off-Chain Cryptographic Signature
  try {
    const recoveredAddress = ethers.verifyMessage(txRecord.canonicalPayload, txRecord.signature);
    if (recoveredAddress.toLowerCase() !== txRecord.sender.toLowerCase()) {
      mismatches.push(
        `Digital signature mismatch: recovered (${recoveredAddress}) does not match sender (${txRecord.sender})`
      );
    }
  } catch (sigErr: any) {
    mismatches.push(`Digital signature verification error: ${sigErr.message}`);
  }

  // 2. If blockchain proof is missing or status is not confirmed, report non-confirmed state
  if (!txRecord.blockchainTransactionHash) {
    return {
      verified: mismatches.length === 0 && txRecord.status === 'CONFIRMED',
      status: txRecord.status,
      applicationTransactionId: txRecord.applicationTransactionId,
      blockchainTransactionHash: null,
      blockNumber: null,
      blockHash: null,
      contractAddress: txRecord.contractAddress || null,
      chainId: txRecord.chainId || null,
      mismatches: txRecord.status === 'CONFIRMED' ? ['Missing blockchain transaction hash'] : mismatches,
    };
  }

  // 3. Verify On-Chain Receipt & Smart Contract State
  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txRecord.blockchainTransactionHash);

    if (!receipt) {
      mismatches.push(`Blockchain transaction receipt not found for hash: ${txRecord.blockchainTransactionHash}`);
    } else {
      if (receipt.status !== 1) {
        mismatches.push(`On-chain transaction status failed (status: ${receipt.status})`);
      }
      if (txRecord.blockNumber && receipt.blockNumber !== txRecord.blockNumber) {
        mismatches.push(
          `Block number mismatch: on-chain (${receipt.blockNumber}) vs stored (${txRecord.blockNumber})`
        );
      }
      if (txRecord.blockHash && receipt.blockHash !== txRecord.blockHash) {
        mismatches.push(`Block hash mismatch: on-chain (${receipt.blockHash}) vs stored (${txRecord.blockHash})`);
      }
    }

    // Query smart contract for recorded state
    const contract = getContract(LEDGER_CONTRACT_ADDRESS, LEDGER_ABI, false);
    const txIdBytes32 = toTxIdBytes32(txRecord.applicationTransactionId);
    const onChainRecord = await contract.getTransaction(txIdBytes32);

    if (!onChainRecord || Number(onChainRecord.timestamp) === 0) {
      mismatches.push(`Transaction ID ${txRecord.applicationTransactionId} not found in SecureChainLedger smart contract`);
    } else {
      const storedScaledAmount = BigInt(Math.round(Number(txRecord.amount) * 1_000_000));
      if (onChainRecord.amount !== storedScaledAmount) {
        mismatches.push(
          `On-chain amount mismatch: on-chain (${onChainRecord.amount}) vs stored (${storedScaledAmount})`
        );
      }
      if (onChainRecord.currency !== txRecord.asset) {
        mismatches.push(
          `On-chain currency mismatch: on-chain (${onChainRecord.currency}) vs stored (${txRecord.asset})`
        );
      }
    }

    return {
      verified: mismatches.length === 0,
      status: mismatches.length === 0 ? 'CONFIRMED' : 'CONFIRMATION_FAILED',
      applicationTransactionId: txRecord.applicationTransactionId,
      blockchainTransactionHash: txRecord.blockchainTransactionHash,
      blockNumber: receipt?.blockNumber ?? txRecord.blockNumber,
      blockHash: receipt?.blockHash ?? txRecord.blockHash,
      contractAddress: LEDGER_CONTRACT_ADDRESS,
      chainId: txRecord.chainId || null,
      onChainTimestamp: onChainRecord ? Number(onChainRecord.timestamp) : null,
      mismatches,
    };
  } catch (chainErr: any) {
    mismatches.push(`On-chain verification query failed: ${chainErr.message}`);
    return {
      verified: false,
      status: 'CONFIRMATION_FAILED',
      applicationTransactionId: txRecord.applicationTransactionId,
      blockchainTransactionHash: txRecord.blockchainTransactionHash,
      blockNumber: txRecord.blockNumber,
      blockHash: txRecord.blockHash,
      contractAddress: LEDGER_CONTRACT_ADDRESS,
      chainId: txRecord.chainId,
      mismatches,
    };
  }
}
