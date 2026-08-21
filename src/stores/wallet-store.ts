import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db, auth } from '@/lib/firebase/client';
import { doc, getDoc, collection, getDocs, runTransaction, addDoc } from 'firebase/firestore';
import { ethers } from 'ethers';
import { encryptPrivateKey } from '@/lib/crypto/client-aes';
import { getWalletSigner } from '@/lib/wallet/key-access';

// ═══════════════════════════════════════════════════════════
// GLOBAL INITIALIZATION LOCK (Idempotent)
// ═══════════════════════════════════════════════════════════
const initPromises = new Map<string, Promise<void>>();

// Helper for strict string validation
const isValidString = (val: any): val is string => typeof val === 'string' && val.trim().length > 0;

export interface Transaction {
  id: string;
  blockNumber: number;
  hash: string;
  previousHash: string;
  walletAddress?: string;
  senderPublicKey?: string;
  digitalSignature?: string;
  type: 'credit' | 'debit' | 'trade' | 'genesis';
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  description: string;
  payload?: any;
  difficulty?: number;
  nonce?: number;
  blockSize?: number;
}

interface Balances {
  USD: number;
  BTC: number;
  ETH: number;
}

interface WalletState {
  _hasHydrated: boolean;
  _isWalletReady: boolean;
  ownerUid: string | null;
  identityStatus: 'pending' | 'loaded' | 'verified' | 'error';
  address: string | null;
  publicKey: string | null;
  encryptedPrivateKey: string | null;
  keyGeneratedAt: string | null;
  algorithm: string | null;
  walletVersion: string | null;
  keyFingerprint: string | null;
  
  balances: Balances;
  transactions: Transaction[];
  lastBlockNumber: number;
  lastBlockHash: string | null;
  setHasHydrated: (state: boolean) => void;
  initializeWallet: (uid: string) => Promise<void>;
  syncTransactions: (uid: string) => Promise<void>;
  
  executeTransaction: (
    type: Transaction['type'],
    amount: number,
    currency: keyof Balances,
    description: string,
    payload?: any
  ) => Promise<void>;
  
  disconnectWallet: () => void;
}

// Generate consistent SHA-256 hash deterministically
export async function generateHash(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hashHex;
}

const getClientSecret = (uid: string) => `securechain_client_${uid}_secret`;

async function createGenesisBlock(uid: string, walletAddress: string, publicKey: string): Promise<Transaction> {
  const genesisTimeISO = '1970-01-01T00:00:00.000Z';
  const genesisHash = await generateHash(`genesis:${uid}:${walletAddress}:${publicKey}`);
  return {
    id: `tx_genesis_${uid}`,
    blockNumber: 0,
    hash: genesisHash,
    previousHash: '0',
    walletAddress,
    senderPublicKey: publicKey,
    digitalSignature: 'Genesis Block - System Generated',
    type: 'genesis',
    amount: 0,
    currency: 'USD',
    status: 'completed',
    date: genesisTimeISO,
    description: 'System Genesis Block Initialization',
    payload: { message: 'SecureChain Genesis Block Created' },
    difficulty: 1,
    nonce: 0,
    blockSize: 256,
  };
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOG HELPER
// ═══════════════════════════════════════════════════════════
async function createAuditLog(uid: string, reason: string, repairedFields: string[], status: string) {
  try {
    const auditRef = collection(db, 'users', uid, 'audit_logs');
    await addDoc(auditRef, {
      timestamp: new Date().toISOString(),
      reason,
      repairedFields,
      status,
    });
    console.log(`[SecureChain: Audit] Logged: ${reason} | Fields: ${repairedFields.join(', ')} | Status: ${status}`);
  } catch (e) {
    console.error('[SecureChain: Audit] Failed to write audit log:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// WALLET STORE
// ═══════════════════════════════════════════════════════════
export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      _isWalletReady: false,
      ownerUid: null,
      identityStatus: 'pending',
      address: null,
      publicKey: null,
      encryptedPrivateKey: null,
      keyGeneratedAt: null,
      algorithm: null,
      walletVersion: null,
      keyFingerprint: null,
      
      balances: { USD: 0, BTC: 0, ETH: 0 },
      transactions: [],
      lastBlockNumber: 0,
      lastBlockHash: null,
      
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      
      // ═══════════════════════════════════════════════════════
      // ═══════════════════════════════════════════════════════
      // SYNC TRANSACTIONS (Background Non-Blocking)
      // ═══════════════════════════════════════════════════════
      syncTransactions: async (uid: string) => {
        try {
          console.log('[SecureChain: BackgroundSync] Syncing blockchain transactions...');
          const txsRef = collection(db, 'users', uid, 'transactions');
          const txsSnap = await getDocs(txsRef);
          
          if (txsSnap && !txsSnap.empty) {
            const loadedTxs: Transaction[] = [];
            txsSnap.forEach((d: any) => {
              loadedTxs.push(d.data() as Transaction);
            });
            loadedTxs.sort((a: Transaction, b: Transaction) => b.blockNumber - a.blockNumber);
            console.log(`[SecureChain: BackgroundSync] ✓ Loaded ${loadedTxs.length} transaction(s)`);
            set({ transactions: loadedTxs });
          } else {
            console.warn('[SecureChain: BackgroundSync] No transactions found; genesis is only created with a new wallet transaction.');
            set({ transactions: [] });
          }
        } catch (txErr) {
          console.warn('[SecureChain: BackgroundSync] Non-fatal transaction sync warning:', txErr);
        }
      },

      // ═══════════════════════════════════════════════════════
      // INITIALIZE WALLET (Strict Existing vs New User Logic)
      // ═══════════════════════════════════════════════════════
      initializeWallet: async (uid: string) => {
        const existingPromise = initPromises.get(uid);
        if (existingPromise) {
          await existingPromise;
          return;
        }

        const initialization = (async () => {
          const wStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const getWElapsed = () => `+${Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - wStart)}ms`;

          console.log(`[WALLET ${getWElapsed()}] initializeWallet START for UID: ${uid}`);

          try {
            const clientSecret = getClientSecret(uid);
            const walletRef = doc(db, 'users', uid, 'wallet', 'data');
            const currentState = get();
            const hasLocalKeys = currentState.ownerUid === uid && isValidString(currentState.address) && isValidString(currentState.publicKey) && isValidString(currentState.encryptedPrivateKey);
            const restoreWalletState = async (data: any) => {
              const fields = [data.address, data.publicKey, data.encryptedPrivateKey];
              if (!fields.every(isValidString)) {
                throw new Error('Wallet integrity failure: wallet data is incomplete. No keys were changed.');
              }
              const fingerprint = data.keyFingerprint || (await generateHash(data.publicKey)).substring(0, 16);
              set({
                ownerUid: uid,
                identityStatus: 'loaded',
                address: data.address,
                publicKey: data.publicKey,
                encryptedPrivateKey: data.encryptedPrivateKey,
                keyGeneratedAt: data.keyGeneratedAt || null,
                algorithm: data.algorithm || 'ECDSA/secp256k1',
                walletVersion: data.walletVersion || '1.0',
                keyFingerprint: fingerprint,
                balances: data.balances || { USD: 0, BTC: 0, ETH: 0 },
                lastBlockNumber: typeof data.lastBlockNumber === 'number' ? data.lastBlockNumber : 0,
                lastBlockHash: data.lastBlockHash || null,
                _hasHydrated: true,
                _isWalletReady: true,
              });
              get().syncTransactions(uid);
            };
            console.info(`[WalletInit] UID: ${uid}`);
            console.info(`[WalletInit] Wallet path: users/${uid}/wallet/data`);
            const readResult = await getDoc(walletRef)
              .then((snapshot) => ({
                status: snapshot.exists() ? 'FOUND' as const : 'NOT_FOUND' as const,
                snapshot,
              }))
              .catch((error) => ({
                status: 'ERROR' as const,
                snapshot: null,
                error,
              }));
            console.info(`[WalletInit] Wallet document exists: ${readResult.status === 'FOUND'}`);

            if (readResult.status === 'ERROR') {
              if (hasLocalKeys) {
                set({ _hasHydrated: true, _isWalletReady: true, ownerUid: uid, identityStatus: 'loaded' });
                console.warn(`[WALLET ${getWElapsed()}] Firestore lookup unavailable; verified local wallet is being used offline. No cloud write performed.`);
                get().syncTransactions(uid);
                return;
              }
              const reason = 'error' in readResult && readResult.error instanceof Error
                ? readResult.error.message
                : 'Unknown Firestore failure';
              set({ _hasHydrated: true, _isWalletReady: false, ownerUid: uid, identityStatus: 'error' });
              console.error(`[WALLET ${getWElapsed()}] Wallet lookup unavailable (${reason}). No wallet was created or changed; retry is required.`);
              return;
            }

            if (readResult.status === 'FOUND') {
              console.info('[WalletInit] Existing wallet detected: true');
              const data = readResult.snapshot.data() ?? {};
              await restoreWalletState(data);
              console.info(`[WalletInit] Address available: ${isValidString(data.address)}`);
              console.info(`[WalletInit] Public key available: ${isValidString(data.publicKey)}`);
              console.info('[WalletInit] Zustand wallet state updated: true');
              return;
            }

            if (hasLocalKeys) {
              await restoreWalletState(currentState);
              console.warn(`[WALLET ${getWElapsed()}] Firestore returned NOT_FOUND, but a valid wallet for this UID exists locally. Restored local identity without generating or writing a replacement wallet.`);
              return;
            }

            const newWallet = ethers.Wallet.createRandom();
            const generatedAt = new Date().toISOString();
            const encryptedPrivKey = await encryptPrivateKey(newWallet.privateKey, clientSecret);
            const newPublicKey = newWallet.signingKey.publicKey;
            const fingerprint = (await generateHash(newPublicKey)).substring(0, 16);
            const genesisBlock = await createGenesisBlock(uid, newWallet.address, newPublicKey);
            const initData = {
              ownerUid: uid,
              address: newWallet.address,
              publicKey: newPublicKey,
              encryptedPrivateKey: encryptedPrivKey,
              keyGeneratedAt: generatedAt,
              algorithm: 'ECDSA/secp256k1',
              walletVersion: '1.0',
              keyFingerprint: fingerprint,
              balances: { USD: 0, BTC: 0, ETH: 0 },
              lastBlockNumber: 0,
              lastBlockHash: genesisBlock.hash,
            };
            const genesisRef = doc(db, 'users', uid, 'transactions', genesisBlock.id);
            let created = false;
            await runTransaction(db, async (transaction) => {
              const existing = await transaction.get(walletRef);
              if (existing.exists()) return;
              transaction.set(walletRef, initData);
              transaction.set(genesisRef, genesisBlock);
              created = true;
            });
            if (!created) {
              const concurrentWallet = await getDoc(walletRef);
              if (!concurrentWallet.exists()) {
                throw new Error('Wallet creation was not committed. No wallet was generated again. Please retry.');
              }
              await restoreWalletState(concurrentWallet.data() ?? {});
              console.info('[WalletInit] Concurrent wallet creation detected; restored the existing wallet.');
              return;
            }
            createAuditLog(uid, 'New user wallet created', ['wallet', 'genesisBlock'], 'SUCCESS');
            set({ ...initData, identityStatus: 'verified', transactions: [genesisBlock], _hasHydrated: true, _isWalletReady: true });
            console.log(`[WALLET ${getWElapsed()}] New wallet and genesis persisted atomically.`);
          } catch (error: any) {
            console.error(`[WALLET ${getWElapsed()}] Critical wallet initialization failed:`, error);
            set({ _hasHydrated: true, _isWalletReady: false, identityStatus: 'error' });
            throw error;
          } finally {
            initPromises.delete(uid);
          }
        })();
        initPromises.set(uid, initialization);
        await initialization;
      },
      
      // ═══════════════════════════════════════════════════════
      // EXECUTE TRANSACTION (with pre-flight checks + auto-recovery)
      // ═══════════════════════════════════════════════════════
      executeTransaction: async (type, amount, currency, description, payload) => {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('User not authenticated');
        
        console.log(`[SecureChain: Tx] ▶ Initiating ${type} transaction: ${amount} ${currency}`);
        
        // ─── PRE-FLIGHT VALIDATIONS ───
        let state = get();
        
        // Check 1: Keys must exist
        if (!isValidString(state.encryptedPrivateKey) || !isValidString(state.address) || !isValidString(state.publicKey)) {
          console.warn("[SecureChain: Tx] Pre-flight FAIL: Keys missing. Triggering auto-recovery...");
          await get().initializeWallet(uid);
          state = get();
          
          if (!isValidString(state.encryptedPrivateKey) || !isValidString(state.address)) {
            throw new Error("Wallet recovery failed. Please refresh the page.");
          }
          console.log("[SecureChain: Tx] Pre-flight PASS: Keys recovered successfully.");
        }
        
        // Check 2: Genesis block must exist
        if (!state.transactions.some(t => t.type === 'genesis')) {
          console.warn("[SecureChain: Tx] Pre-flight FAIL: Genesis block missing. Triggering auto-recovery...");
          await get().initializeWallet(uid);
          state = get();
          if (!state.transactions.some(t => t.type === 'genesis')) {
            throw new Error("Blockchain metadata error: Genesis block could not be created.");
          }
          console.log("[SecureChain: Tx] Pre-flight PASS: Genesis block recovered.");
        }
        
        // Check 3: lastBlockHash must exist
        if (!isValidString(state.lastBlockHash)) {
          console.warn("[SecureChain: Tx] Pre-flight FAIL: lastBlockHash missing. Triggering auto-recovery...");
          await get().initializeWallet(uid);
          state = get();
        }

        console.log("[SecureChain: Tx] All pre-flight checks passed. Decrypting key for signing...");
        
        const serverTimeISO = new Date().toISOString();
        const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        let newTransaction: Transaction | null = null;
        let newBalances: Balances | null = null;
        let newBlockNumber = 0;
        let newBlockHash = '';
        
        // Decrypt key in memory for signing ONLY
        let tempWallet: ethers.Wallet;
        try {
           tempWallet = await getWalletSigner({
             uid,
             encryptedPrivateKey: state.encryptedPrivateKey!,
             address: state.address!,
             publicKey: state.publicKey!,
           });
           set({ identityStatus: 'verified' });
        } catch (e) {
           console.error("[SecureChain: Tx] ✗ Failed to decrypt private key:", e);
           throw new Error("Failed to decrypt private key for signing");
        }

        await runTransaction(db, async (transaction) => {
          const walletRef = doc(db, 'users', uid, 'wallet', 'data');
          const walletSnap = await transaction.get(walletRef);
          
          if (!walletSnap.exists()) {
            throw new Error("Wallet data not found in Firestore!");
          }
          
          const currentData = walletSnap.data();
          const currentBalances = currentData.balances || { USD: 0, BTC: 0, ETH: 0 };
          const currentLastBlock = currentData.lastBlockNumber || 0;
          
          newBalances = { ...currentBalances } as Balances;
          if (type === 'credit') {
            newBalances![currency] += amount;
          } else if (type === 'debit') {
            if (newBalances![currency] < amount) throw new Error("Insufficient funds");
            newBalances![currency] -= amount;
          } else if (type === 'trade') {
            if (newBalances![currency] < amount) throw new Error("Insufficient funds");
            newBalances![currency] -= amount;
            if (payload?.tradeAsset && payload?.tradeAmount) {
              const asset = payload.tradeAsset as keyof Balances;
              newBalances![asset] = (newBalances![asset] || 0) + payload.tradeAmount;
            }
          }
          
          newBlockNumber = currentLastBlock + 1;
          
          let prevHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
          if (currentLastBlock >= 0) {
            const prevTx = get().transactions.find(t => t.blockNumber === currentLastBlock);
            if (prevTx) {
              const prevTxRef = doc(db, 'users', uid, 'transactions', prevTx.id);
              const prevTxSnap = await transaction.get(prevTxRef);
              if (prevTxSnap.exists()) {
                prevHash = prevTxSnap.data().hash;
              }
            }
          }
          
          const receiverWallet = payload?.receiverWallet || 'System';
          const senderWallet = state.address || uid;
          
          const hashString = `${prevHash}${newBlockNumber}${senderWallet}${receiverWallet}${amount}${serverTimeISO}${type}`;
          const hash = await generateHash(hashString);
          
          // TRANSACTION SIGNING & VERIFICATION
          const signPayload = `${senderWallet}${receiverWallet}${amount}${serverTimeISO}${prevHash}${newBlockNumber}`;
          const digitalSignature = await tempWallet.signMessage(signPayload);
          
          const recoveredAddress = ethers.verifyMessage(signPayload, digitalSignature);
          if (recoveredAddress !== tempWallet.address) {
            throw new Error("Cryptographic verification failed: Signature does not match the private key");
          }
          if (senderWallet !== uid && recoveredAddress !== senderWallet) {
             throw new Error("Cryptographic verification failed: Sender address mismatch");
          }
          
          newTransaction = {
            id: txId,
            blockNumber: newBlockNumber,
            hash,
            previousHash: prevHash,
          walletAddress: senderWallet,
            senderPublicKey: state.publicKey || tempWallet.address,
            digitalSignature: digitalSignature,
            type,
            amount,
            currency,
            status: 'completed',
            date: serverTimeISO,
            description,
            payload: { ...payload, signPayload },
            difficulty: 2,
            nonce: Math.floor(Math.random() * 1000000),
            blockSize: 512
          };
          
          const newTxRef = doc(db, 'users', uid, 'transactions', txId);
          transaction.set(newTxRef, newTransaction);
          
          newBlockHash = hash;

          transaction.update(walletRef, {
            balances: newBalances,
            lastBlockNumber: newBlockNumber,
            lastBlockHash: newBlockHash
          });
        });
        
        if (newTransaction && newBalances) {
          set((state) => ({
            balances: newBalances!,
            transactions: [newTransaction!, ...state.transactions],
            lastBlockNumber: newBlockNumber,
            lastBlockHash: newBlockHash
          }));
          console.log(`[SecureChain: Tx] ✓ Block #${newBlockNumber} mined. Wallet synced.`);
        }
      },
      
      disconnectWallet: () => {
        set({ 
          _hasHydrated: false,
          _isWalletReady: false,
          ownerUid: null,
          identityStatus: 'pending',
          address: null, 
          publicKey: null,
          encryptedPrivateKey: null,
          keyGeneratedAt: null,
          algorithm: null,
          walletVersion: null,
          keyFingerprint: null,
          balances: { USD: 0, BTC: 0, ETH: 0 }, 
          transactions: [], 
          lastBlockNumber: 0,
          lastBlockHash: null
        });
      }
    }),
    {
      name: 'securechain-wallet-persist',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const uid = localStorage.getItem('securechain_uid');
          if (!uid) return null;
          return localStorage.getItem(`securechain-wallet-${uid}`);
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          const uid = localStorage.getItem('securechain_uid');
          if (uid) localStorage.setItem(`securechain-wallet-${uid}`, value);
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return;
          const uid = localStorage.getItem('securechain_uid');
          if (uid) localStorage.removeItem(`securechain-wallet-${uid}`);
        }
      })),
      onRehydrateStorage: () => (state) => {
        // NOTE: Do NOT set _isWalletReady here.
        // _isWalletReady is ONLY set after initializeWallet completes with verified Firestore data.
        // This prevents stale localStorage data from allowing dashboard render.
        if (state) state.setHasHydrated(true);
      }
    }
  )
);
