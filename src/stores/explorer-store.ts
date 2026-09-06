/**
 * Explorer Store — Global Blockchain View
 * 
 * A dedicated Zustand store that reads from the GLOBAL blockchain collection.
 * This is separate from the wallet store which handles user-scoped data.
 * 
 * The Explorer page uses this store so that ALL users see the SAME chain.
 */

import { create } from 'zustand';
import {
  getGlobalBlocks,
  getGlobalChainState,
  initializeGlobalGenesis,
  type GlobalChainState,
} from '@/lib/blockchain/global-chain';
import { useWalletStore, type Transaction } from '@/stores/wallet-store';

interface ExplorerState {
  // Global chain data
  globalBlocks: Transaction[];
  chainState: GlobalChainState | null;
  isLoading: boolean;
  lastSyncedAt: string | null;
  error: string | null;

  // Actions
  syncGlobalChain: () => Promise<void>;
  ensureGenesis: () => Promise<void>;
}

// Prevent concurrent syncs
let syncInProgress: Promise<void> | null = null;

export const useExplorerStore = create<ExplorerState>()((set, get) => ({
  globalBlocks: [],
  chainState: null,
  isLoading: false,
  lastSyncedAt: null,
  error: null,

  /**
   * Ensures the global genesis block exists.
   * Called during app initialization (non-blocking).
   */
  ensureGenesis: async () => {
    try {
      await initializeGlobalGenesis();
    } catch (err: any) {
      console.warn('[ExplorerStore] Genesis initialization warning:', err?.message);
    }
  },

  /**
   * Syncs the global blockchain from Firestore and local wallet state.
   */
  syncGlobalChain: async () => {
    // Deduplicate concurrent calls
    if (syncInProgress) {
      await syncInProgress;
      return;
    }

    const promise = (async () => {
      set({ isLoading: true, error: null });

      try {
        let [chainState, blocks] = await Promise.all([
          getGlobalChainState(),
          getGlobalBlocks(),
        ]);

        // Merge with client wallet transactions if global blocks is missing user transactions
        const walletTxs = useWalletStore.getState().transactions || [];
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
          currency: 'USD',
          asset: 'USD',
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

        const blockMap = new Map<string, Transaction>();
        blocks.forEach((b) => blockMap.set(b.id || b.applicationTransactionId || b.hash, b));
        if (!blockMap.has('GENESIS')) {
          blockMap.set('GENESIS', genesisBlock);
        }

        walletTxs.forEach((tx) => {
          const blockId = tx.id || tx.applicationTransactionId || tx.hash;
          if (!blockMap.has(blockId)) {
            blockMap.set(blockId, tx);
          }
        });

        const mergedList = Array.from(blockMap.values());
        const nonGenesis = mergedList.filter((b) => b.type !== 'genesis');
        const genesis = mergedList.find((b) => b.type === 'genesis') || genesisBlock;

        const sortedAsc = [genesis];
        let pHash = genesis.hash;
        nonGenesis.forEach((b, i) => {
          const num = i + 1;
          const h = b.hash || b.transactionHash || `0x${num}a${i}f89e2c4b5a67890123456789abcdef1234567890`;
          sortedAsc.push({
            ...b,
            blockNumber: num,
            previousHash: pHash,
            hash: h,
            transactionHash: h,
            status: b.status || 'CONFIRMED',
          });
          pHash = h;
        });

        const sortedDesc = sortedAsc.reverse();
        chainState = {
          lastBlockNumber: sortedAsc.length - 1,
          lastBlockHash: sortedAsc[0].hash,
          genesisHash: genesis.hash,
          totalBlocks: sortedAsc.length,
          lastUpdatedAt: new Date().toISOString(),
        };

        set({
          globalBlocks: sortedDesc,
          chainState,
          isLoading: false,
          lastSyncedAt: new Date().toISOString(),
          error: null,
        });

        console.log(
          `[ExplorerStore] ✓ Synced ${sortedDesc.length} global blocks. Chain height: ${chainState?.lastBlockNumber ?? 'N/A'}`
        );
      } catch (err: any) {
        console.error('[ExplorerStore] Failed to sync global chain:', err);
        set({
          isLoading: false,
          error: err?.message || 'Failed to sync global blockchain',
        });
      }
    })();

    syncInProgress = promise;
    await promise;
    syncInProgress = null;
  },
}));

