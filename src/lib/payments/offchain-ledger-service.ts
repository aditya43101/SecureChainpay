import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { NodeHealthEngine } from '@/lib/blockchain/node-health-engine';
import { getContract } from '@/lib/blockchain/client';
import SecureChainPaymentArtifact from '../../../artifacts/contracts/SecureChainPayment.sol/SecureChainPayment.json';

export type LedgerEventType =
  | 'RESERVATION_CREATED'
  | 'RESERVATION_RELEASED'
  | 'ONCHAIN_RESERVATION_CONFIRMED'
  | 'FINALIZATION_SUBMITTED'
  | 'PAYMENT_FINALIZED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_EXPIRED'
  | 'RECIPIENT_CREDITED'
  | 'ADJUSTMENT';

export interface LedgerEntryData {
  eventType: LedgerEventType;
  transactionId: string;
  walletAddress: string;
  amount: number;
  asset?: string;
  balanceAfter?: number;
}

export class OffchainLedgerService {
  private static GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Append an immutable, hash-chained ledger event within an existing Prisma transaction.
   */
  public static async appendEntryTx(tx: any, data: LedgerEntryData) {
    const asset = (data.asset || 'HSCT').toUpperCase();
    const now = new Date();

    // Fetch latest entry for hash continuity
    const lastEntry = await tx.ledgerEntry.findFirst({
      orderBy: { sequenceNumber: 'desc' },
    });

    const previousHash = lastEntry ? lastEntry.entryHash : this.GENESIS_HASH;
    const nextSeq = lastEntry ? lastEntry.sequenceNumber + 1 : 1;

    const canonicalStr = `seq:${nextSeq}|event:${data.eventType}|txId:${data.transactionId}|wallet:${data.walletAddress}|amt:${data.amount}|asset:${asset}|prev:${previousHash}|time:${now.toISOString()}`;
    const entryHash = crypto.createHash('sha256').update(canonicalStr).digest('hex');

    return await tx.ledgerEntry.create({
      data: {
        sequenceNumber: nextSeq,
        eventType: data.eventType,
        transactionId: data.transactionId,
        walletAddress: data.walletAddress.toLowerCase(),
        amount: data.amount,
        asset,
        balanceAfter: data.balanceAfter !== undefined ? data.balanceAfter : null,
        previousHash,
        entryHash,
        timestamp: now,
      },
    });
  }

  /**
   * Append an immutable ledger event standalone.
   */
  public static async appendEntry(data: LedgerEntryData) {
    return await prisma.$transaction(async (tx) => {
      return await this.appendEntryTx(tx, data);
    });
  }

  /**
   * Complete cryptographic verification of the append-only ledger hash chain.
   */
  public static async verifyLedgerIntegrity(): Promise<{
    isValid: boolean;
    totalEntriesVerified: number;
    corruptedEntry?: any;
    mismatchReason?: string;
  }> {
    const entries = await prisma.ledgerEntry.findMany({
      orderBy: { sequenceNumber: 'asc' },
    });

    if (entries.length === 0) {
      return { isValid: true, totalEntriesVerified: 0 };
    }

    let expectedPrevHash = this.GENESIS_HASH;

    for (const entry of entries) {
      // 1. Check previousHash link
      if (entry.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntriesVerified: entry.sequenceNumber - 1,
          corruptedEntry: entry,
          mismatchReason: `Hash link broken at sequence #${entry.sequenceNumber}. Expected previous ${expectedPrevHash}, found ${entry.previousHash}`,
        };
      }

      // 2. Recompute entryHash
      const canonicalStr = `seq:${entry.sequenceNumber}|event:${entry.eventType}|txId:${entry.transactionId}|wallet:${entry.walletAddress}|amt:${Number(entry.amount)}|asset:${entry.asset}|prev:${entry.previousHash}|time:${entry.timestamp.toISOString()}`;
      const recomputedHash = crypto.createHash('sha256').update(canonicalStr).digest('hex');

      if (recomputedHash !== entry.entryHash) {
        return {
          isValid: false,
          totalEntriesVerified: entry.sequenceNumber - 1,
          corruptedEntry: entry,
          mismatchReason: `Tampering detected at sequence #${entry.sequenceNumber}. Stored hash ${entry.entryHash} does not match recomputed hash ${recomputedHash}`,
        };
      }

      expectedPrevHash = entry.entryHash;
    }

    return { isValid: true, totalEntriesVerified: entries.length };
  }

  /**
   * Computes a standard Merkle Root from an array of hashes.
   */
  public static computeMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return '0x0000000000000000000000000000000000000000000000000000000000000000';
    let currentLevel = hashes.map((h) => (h.startsWith('0x') ? h : '0x' + h));

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const combined = ethers.solidityPacked(['bytes32', 'bytes32'], [currentLevel[i], currentLevel[i + 1]]);
          nextLevel.push(ethers.keccak256(combined));
        } else {
          nextLevel.push(currentLevel[i]);
        }
      }
      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  /**
   * Creates a canonical Merkle checkpoint and anchors it on blockchain if a healthy node is available.
   */
  public static async createAndAnchorCheckpoint(batchSize = 50): Promise<{
    checkpointId: string;
    merkleRoot: string;
    entriesCount: number;
    anchoredOnChain: boolean;
    blockchainTxHash?: string;
  }> {
    // 1. Find last checkpointed sequence
    const lastCheckpoint = await prisma.merkleCheckpointRecord.findFirst({
      orderBy: { lastSequence: 'desc' },
    });

    const startSeq = lastCheckpoint ? lastCheckpoint.lastSequence + 1 : 1;

    // 2. Fetch next batch of entries
    const entries = await prisma.ledgerEntry.findMany({
      where: { sequenceNumber: { gte: startSeq } },
      orderBy: { sequenceNumber: 'asc' },
      take: batchSize,
    });

    if (entries.length === 0) {
      return {
        checkpointId: lastCheckpoint?.checkpointId || 'NONE',
        merkleRoot: lastCheckpoint?.merkleRoot || '0x0',
        entriesCount: 0,
        anchoredOnChain: false,
      };
    }

    const firstSequence = entries[0].sequenceNumber;
    const lastSequence = entries[entries.length - 1].sequenceNumber;
    const checkpointId = `CHK_${Date.now()}_${firstSequence}_${lastSequence}`;

    // 3. Compute Merkle Root
    const leaves = entries.map((e) =>
      ethers.keccak256(
        ethers.toUtf8Bytes(
          `${e.sequenceNumber}:${e.eventType}:${e.transactionId}:${e.walletAddress}:${e.amount}:${e.entryHash}`
        )
      )
    );
    const merkleRoot = this.computeMerkleRoot(leaves);

    // 4. Check if a healthy RPC is available to anchor on-chain
    let anchoredOnChain = false;
    let blockchainTxHash: string | undefined = undefined;
    let blockNumber: number | undefined = undefined;

    const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
    const nodeEngine = NodeHealthEngine.getInstance();
    const { provider } = await nodeEngine.getHealthyProvider(contractAddress);

    if (provider && contractAddress) {
      try {
        const contract = getContract(contractAddress, SecureChainPaymentArtifact.abi, true);
        const batchIdBytes32 = ethers.id(checkpointId);
        const tx = await contract.recordMerkleBatch(batchIdBytes32, merkleRoot, entries.length);
        const receipt = await tx.wait(1);

        if (receipt && receipt.status === 1) {
          anchoredOnChain = true;
          blockchainTxHash = receipt.hash;
          blockNumber = receipt.blockNumber;
          console.info(`[OffchainLedgerService] ✓ Merkle root anchored on blockchain: ${blockchainTxHash}`);
        }
      } catch (anchorErr: any) {
        console.warn('[OffchainLedgerService] Merkle on-chain anchor deferred (EVM offline/degraded):', anchorErr.message);
      }
    }

    // 5. Store checkpoint record in PostgreSQL
    await prisma.merkleCheckpointRecord.create({
      data: {
        checkpointId,
        firstSequence,
        lastSequence,
        merkleRoot,
        blockchainTxHash: blockchainTxHash || null,
        blockNumber: blockNumber || null,
        status: anchoredOnChain ? 'ANCHORED' : 'PENDING',
      },
    });

    return {
      checkpointId,
      merkleRoot,
      entriesCount: entries.length,
      anchoredOnChain,
      blockchainTxHash,
    };
  }
}
