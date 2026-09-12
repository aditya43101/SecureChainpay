/**
 * Global Shared Blockchain Service
 * 
 * Manages access to the SINGLE global blockchain that ALL users share.
 * In Phase 1 Architecture:
 * - Read operations query the server APIs or Firestore read-only collections.
 * - All mutations MUST go through authoritative server endpoints (/api/transactions/execute, /api/wallet/transfer).
 * - Direct client-side runTransaction / setDoc on global_blocks and global_chain_meta are blocked.
 */

import { db } from '@/lib/firebase/client';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
  where,
} from 'firebase/firestore';
import type { Transaction } from '@/stores/wallet-store';

// ═══════════════════════════════════════════════════════════
// FIRESTORE PATHS
// ═══════════════════════════════════════════════════════════
const GLOBAL_BLOCKS_COLLECTION = 'global_blocks';
const GLOBAL_META_COLLECTION = 'global_chain_meta';
const CHAIN_STATE_DOC_ID = 'chain_state';
const GENESIS_BLOCK_ID = 'GENESIS';

export interface GlobalChainState {
  lastBlockNumber: number;
  lastBlockHash: string;
  genesisHash: string;
  chainRoot?: string;
  chainId?: number;
  chainVersion?: number;
  contractAddress?: string;
  paused?: boolean;
  totalBlocks: number;
  lastUpdatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// SAFE HTTP HELPER
// ═══════════════════════════════════════════════════════════
async function safeFetchJson(url: string, init?: RequestInit): Promise<any> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.warn(`[GlobalChain API] Endpoint ${url} returned non-JSON (${res.status})`);
      return null;
    }
  } catch (err) {
    console.warn(`[GlobalChain API] Endpoint ${url} network error:`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// GENESIS BLOCK — Idempotent Server Verification
// ═══════════════════════════════════════════════════════════

export async function initializeGlobalGenesis(): Promise<Transaction | null> {
  if (typeof window !== 'undefined') {
    try {
      const data = await safeFetchJson('/api/blockchain/state', { method: 'POST' });
      if (data && data.success && data.genesisBlock) {
        return data.genesisBlock;
      }
    } catch (apiErr) {
      console.warn('[GlobalChain] Genesis API fallback warning:', apiErr);
    }
  }

  try {
    const genesisDoc = await getDoc(doc(db, GLOBAL_BLOCKS_COLLECTION, GENESIS_BLOCK_ID));
    if (genesisDoc.exists()) {
      return genesisDoc.data() as Transaction;
    }
  } catch (err) {
    console.warn('[GlobalChain] Genesis read error:', err);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// LOCAL FALLBACK GENERATOR (For Client/Offline Environments)
// ═══════════════════════════════════════════════════════════

export function getLocalFallbackBlocks(): Transaction[] {
  const genesisHash = '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
  const genesisBlock: Transaction = {
    id: 'GENESIS',
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
    currency: 'HSCT',
    asset: 'HSCT',
    status: 'CONFIRMED',
    date: '1970-01-01T00:00:00.000Z',
    createdAt: '1970-01-01T00:00:00.000Z',
    confirmedAt: '1970-01-01T00:00:00.000Z',
    description: 'SecureChain Pay — Global Genesis Block',
    payload: { message: 'SecureChain Global Blockchain Initialized' },
    difficulty: 1,
    nonce: 0,
    blockSize: 256,
  };

  let walletTxs: Transaction[] = [];
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('securechain-wallet')) {
          const data = localStorage.getItem(key);
          if (data) {
            const p = JSON.parse(data);
            if (Array.isArray(p?.state?.transactions) && p.state.transactions.length > 0) {
              walletTxs = p.state.transactions;
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[GlobalChain] Fallback local storage parse error:', e);
    }
  }

  const allBlocks: Transaction[] = [genesisBlock];
  let prevHash = genesisHash;

  const nonGenesisTxs = walletTxs.filter((t) => t.type !== 'genesis');

  nonGenesisTxs.forEach((tx, idx) => {
    const blockNum = idx + 1;
    const blockHash = tx.hash || tx.transactionHash || `0x${blockNum}f${idx}89e2c4b5a67890123456789abcdef1234567890`;
    allBlocks.push({
      ...tx,
      blockNumber: blockNum,
      previousHash: prevHash,
      hash: blockHash,
      transactionHash: blockHash,
      status: tx.status || 'CONFIRMED',
    });
    prevHash = blockHash;
  });

  return allBlocks.reverse();
}

/**
 * Fetches all blocks from the global chain, ordered by blockNumber descending.
 * Supports optional limit.
 */
export async function getGlobalBlocks(options?: {
  limitCount?: number;
}): Promise<Transaction[]> {
  if (typeof window !== 'undefined') {
    try {
      const data = await safeFetchJson('/api/blockchain/blocks');
      if (data && data.success && Array.isArray(data.blocks) && data.blocks.length > 0) {
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

    if (blocks.length > 0) {
      return blocks;
    }
  } catch (err) {
    console.warn('[GlobalChain] Failed to fetch global blocks from Firestore, using wallet fallback:', err);
  }

  return getLocalFallbackBlocks();
}

/**
 * Reads the current global chain state.
 */
export async function getGlobalChainState(): Promise<GlobalChainState | null> {
  if (typeof window !== 'undefined') {
    try {
      const data = await safeFetchJson('/api/blockchain/state');
      if (data && data.success && data.chainState) {
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
  } catch (err) {
    console.warn('[GlobalChain] Failed to read chain state from Firestore:', err);
  }

  const fallbackBlocks = getLocalFallbackBlocks();
  const latestBlock = fallbackBlocks[0];
  return {
    lastBlockNumber: latestBlock ? latestBlock.blockNumber : 0,
    lastBlockHash: latestBlock ? latestBlock.hash : '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    genesisHash: '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    totalBlocks: fallbackBlocks.length,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Fetches a specific block by its global block number.
 */
export async function getBlockByNumber(blockNumber: number): Promise<Transaction | null> {
  try {
    const blocksRef = collection(db, GLOBAL_BLOCKS_COLLECTION);
    const q = query(blocksRef, where('blockNumber', '==', blockNumber), firestoreLimit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      return snap.docs[0].data() as Transaction;
    }
  } catch (err) {
    console.warn(`[GlobalChain] Failed to fetch block #${blockNumber} from Firestore:`, err);
  }

  const fallbackBlocks = getLocalFallbackBlocks();
  return fallbackBlocks.find((b) => b.blockNumber === blockNumber) || null;
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
  } catch (err) {
    console.warn(`[GlobalChain] Failed to fetch block ${blockId} from Firestore:`, err);
  }

  const fallbackBlocks = getLocalFallbackBlocks();
  return fallbackBlocks.find((b) => b.id === blockId || b.applicationTransactionId === blockId) || null;
}
