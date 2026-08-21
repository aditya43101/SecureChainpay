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
import type { Transaction } from '@/stores/wallet-store';

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
   * Syncs the global blockchain from Firestore.
   * This fetches ALL blocks from the shared `blockchain/blocks/` collection.
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
        // Fetch chain state and blocks in parallel
        const [chainState, blocks] = await Promise.all([
          getGlobalChainState(),
          getGlobalBlocks(),
        ]);

        set({
          globalBlocks: blocks,
          chainState,
          isLoading: false,
          lastSyncedAt: new Date().toISOString(),
          error: null,
        });

        console.log(
          `[ExplorerStore] ✓ Synced ${blocks.length} global blocks. Chain height: ${chainState?.lastBlockNumber ?? 'N/A'}`
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
