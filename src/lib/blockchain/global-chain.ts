/**
 * Global Shared Blockchain Service
 * 
 * Manages a SINGLE global blockchain that ALL users share.
 * Firestore paths:
 *   blockchain/blocks/{blockId}      — Global block records
 *   blockchain/meta/chain_state      — Global chain state (lastBlockNumber, lastBlockHash, genesisHash)
 * 
 * This replaces user-scoped block numbering and genesis blocks.
 */

import { db } from '@/lib/firebase/client';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  runTransaction,
  query,
  orderBy,
  limit as firestoreLimit,
  where,
} from 'firebase/firestore';
import type { Transaction } from '@/stores/wallet-store';
import { generateHash } from '@/stores/wallet-store';

// ═══════════════════════════════════════════════════════════
// FIRESTORE PATHS
// ═══════════════════════════════════════════════════════════
const GLOBAL_BLOCKS_COLLECTION = 'global_blocks';
const GLOBAL_META_COLLECTION = 'global_chain_meta';
const CHAIN_STATE_DOC_ID = 'chain_state';
const GENESIS_BLOCK_ID = 'GENESIS';

// Prevent multiple concurrent genesis initializations
let genesisInitPromise: Promise<void> | null = null;

export interface GlobalChainState {
  lastBlockNumber: number;
  lastBlockHash: string;
  genesisHash: string;
  totalBlocks: number;
  lastUpdatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// GENESIS BLOCK — ONE for the entire system
// ═══════════════════════════════════════════════════════════

/**
 * Creates the single global genesis block if it doesn't already exist.
 * Uses a Firestore transaction to prevent race conditions.
 * This is idempotent — safe to call multiple times.
 */
export async function initializeGlobalGenesis(): Promise<Transaction> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/blockchain/state', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.genesisBlock) {
        return data.genesisBlock;
      }
    } catch (apiErr) {
      console.warn('[GlobalChain] Genesis API fallback warning:', apiErr);
    }
  }

  if (genesisInitPromise) {
    await genesisInitPromise;
    const genesisDoc = await getDoc(doc(db, GLOBAL_BLOCKS_COLLECTION, GENESIS_BLOCK_ID));
    if (genesisDoc.exists()) {
      return genesisDoc.data() as Transaction;
    }
  }

  const promise = (async () => {
    const genesisRef = doc(db, GLOBAL_BLOCKS_COLLECTION, GENESIS_BLOCK_ID);
    const chainStateRef = doc(db, GLOBAL_META_COLLECTION, CHAIN_STATE_DOC_ID);

    let genesisBlock: Transaction | null = null;

    await runTransaction(db, async (transaction) => {
      const existingGenesis = await transaction.get(genesisRef);

      if (existingGenesis.exists()) {
        genesisBlock = existingGenesis.data() as Transaction;
        console.log('[GlobalChain] Genesis block already exists. Skipping creation.');
        return;
      }

      const genesisTimeISO = '1970-01-01T00:00:00.000Z';
      const genesisHash = await generateHash('genesis:securechainpay:global:v1');

      genesisBlock = {
        id: GENESIS_BLOCK_ID,
        applicationTransactionId: 'TX_GENESIS_GLOBAL',
        userId: 'SYSTEM',
        sender: '0x0000000000000000000000000000000000000000',
        receiver: '0x0000000000000000000000000000000000000000',
        blockNumber: 0,
        hash: genesisHash,
        transactionHash: genesisHash,
        previousHash: '0',
        walletAddress: '0x0000000000000000000000000000000000000000',
        senderPublicKey: 'SYSTEM_GENESIS',
        digitalSignature: 'Genesis Block - System Generated',
        signature: 'Genesis Block - System Generated',
        type: 'genesis',
        amount: 0,
        currency: 'USD',
        asset: 'USD',
        status: 'CONFIRMED',
        date: genesisTimeISO,
        createdAt: genesisTimeISO,
        confirmedAt: genesisTimeISO,
        description: 'SecureChain Pay — Global Genesis Block',
        payload: { message: 'SecureChain Global Blockchain Initialized' },
        difficulty: 1,
        nonce: 0,
        blockSize: 256,
      };

      const chainState: GlobalChainState = {
        lastBlockNumber: 0,
        lastBlockHash: genesisHash,
        genesisHash: genesisHash,
        totalBlocks: 1,
        lastUpdatedAt: new Date().toISOString(),
      };

      transaction.set(genesisRef, genesisBlock);
      transaction.set(chainStateRef, chainState);

      console.log('[GlobalChain] ✓ Global genesis block created.');
    });

    return genesisBlock!;
  })();

  genesisInitPromise = promise.then(() => {});

  const result = await promise;
  genesisInitPromise = null;
  return result;
}

// ═══════════════════════════════════════════════════════════
// CHAIN STATE
// ═══════════════════════════════════════════════════════════

/**
 * Reads the current global chain state.
 * Returns null if genesis hasn't been created yet.
 */
export async function getGlobalChainState(): Promise<GlobalChainState | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/blockchain/state');
      const data = await res.json();
      if (data.success) {
        return data.chainState;
      }
    } catch (err) {
      console.warn('[GlobalChain] Chain state API fallback warning:', err);
    }
  }

  try {
    const chainStateRef = doc(db, GLOBAL_META_COLLECTION, CHAIN_STATE_DOC_ID);
    const snap = await getDoc(chainStateRef);
    if (snap.exists()) {
      return snap.data() as GlobalChainState;
    }
    return null;
  } catch (err) {
    console.error('[GlobalChain] Failed to read chain state:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// APPEND BLOCK — Atomic, concurrency-safe
// ═══════════════════════════════════════════════════════════

/**
 * Atomically appends a block to the global chain.
 * 
 * 1. Reads current chain_state (lastBlockNumber, lastBlockHash)
 * 2. Sets block.blockNumber = lastBlockNumber + 1
 * 3. Sets block.previousHash = lastBlockHash
 * 4. Computes block.hash using global chain linkage
 * 5. Writes block to global_blocks/{id}
 * 6. Updates global_chain_meta/chain_state
 * 
 * Returns the finalized block with correct global block number.
 */
export async function appendBlockToGlobalChain(
  block: Transaction
): Promise<Transaction> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/blockchain/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block }),
      });
      const data = await res.json();
      if (data.success && data.block) {
        console.log(`[GlobalChain] ✓ Block #${data.block.blockNumber} appended via API. Hash: ${data.block.hash?.substring(0, 16)}...`);
        return data.block;
      }
      throw new Error(data.error || 'Failed to append block via API');
    } catch (apiErr: any) {
      console.warn('[GlobalChain] Append API call failed, attempting fallback:', apiErr?.message);
      throw apiErr;
    }
  }

  const chainStateRef = doc(db, GLOBAL_META_COLLECTION, CHAIN_STATE_DOC_ID);
  const blockRef = doc(db, GLOBAL_BLOCKS_COLLECTION, block.id);

  let finalBlock: Transaction | null = null;

  await runTransaction(db, async (transaction) => {
    const chainStateSnap = await transaction.get(chainStateRef);

    if (!chainStateSnap.exists()) {
      throw new Error('[GlobalChain] Chain state not found. Genesis must be initialized first.');
    }

    const chainState = chainStateSnap.data() as GlobalChainState;

    const existingBlock = await transaction.get(blockRef);
    if (existingBlock.exists()) {
      console.warn(`[GlobalChain] Block ${block.id} already exists in global chain. Returning existing.`);
      finalBlock = existingBlock.data() as Transaction;
      return;
    }

    const globalBlockNumber = chainState.lastBlockNumber + 1;
    const globalPreviousHash = chainState.lastBlockHash;

    const hashString = `${globalPreviousHash}${globalBlockNumber}${block.sender}${block.receiver}${block.amount}${block.date}${block.type}`;
    const globalBlockHash = await generateHash(hashString);

    finalBlock = {
      ...block,
      blockNumber: globalBlockNumber,
      previousHash: globalPreviousHash,
      hash: globalBlockHash,
    };

    const updatedChainState: GlobalChainState = {
      lastBlockNumber: globalBlockNumber,
      lastBlockHash: globalBlockHash,
      genesisHash: chainState.genesisHash,
      totalBlocks: chainState.totalBlocks + 1,
      lastUpdatedAt: new Date().toISOString(),
    };

    transaction.set(blockRef, finalBlock);
    transaction.set(chainStateRef, updatedChainState);

    console.log(`[GlobalChain] ✓ Block #${globalBlockNumber} appended to global chain. Hash: ${globalBlockHash.substring(0, 16)}...`);
  });

  if (!finalBlock) {
    throw new Error('[GlobalChain] Failed to append block to global chain.');
  }

  return finalBlock;
}

// ═══════════════════════════════════════════════════════════
// QUERY GLOBAL BLOCKS
// ═══════════════════════════════════════════════════════════

/**
 * Fetches all blocks from the global chain, ordered by blockNumber descending.
 * Supports optional limit.
 */
export async function getGlobalBlocks(options?: {
  limitCount?: number;
}): Promise<Transaction[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/blockchain/blocks');
      const data = await res.json();
      if (data.success && Array.isArray(data.blocks)) {
        return data.blocks;
      }
    } catch (err) {
      console.warn('[GlobalChain] Blocks API fallback warning:', err);
    }
  }

  try {
    const blocksRef = collection(db, GLOBAL_BLOCKS_COLLECTION);
    let q = query(blocksRef, orderBy('blockNumber', 'desc'));

    if (options?.limitCount) {
      q = query(q, firestoreLimit(options.limitCount));
    }

    const snap = await getDocs(q);
    const blocks: Transaction[] = [];
    snap.forEach((d) => {
      blocks.push(d.data() as Transaction);
    });

    return blocks;
  } catch (err) {
    console.error('[GlobalChain] Failed to fetch global blocks:', err);
    return [];
  }
}

/**
 * Fetches a specific block by its global block number.
 */
export async function getBlockByNumber(blockNumber: number): Promise<Transaction | null> {
  try {
    const blocksRef = collection(db, GLOBAL_BLOCKS_COLLECTION);
    const q = query(blocksRef, where('blockNumber', '==', blockNumber), firestoreLimit(1));
    const snap = await getDocs(q);

    if (snap.empty) return null;
    return snap.docs[0].data() as Transaction;
  } catch (err) {
    console.error(`[GlobalChain] Failed to fetch block #${blockNumber}:`, err);
    return null;
  }
}

/**
 * Fetches a specific block by its document ID.
 */
export async function getBlockById(blockId: string): Promise<Transaction | null> {
  try {
    const blockRef = doc(db, GLOBAL_BLOCKS_COLLECTION, blockId);
    const snap = await getDoc(blockRef);
    if (snap.exists()) {
      return snap.data() as Transaction;
    }
    return null;
  } catch (err) {
    console.error(`[GlobalChain] Failed to fetch block ${blockId}:`, err);
    return null;
  }
}
