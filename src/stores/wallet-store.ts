import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db, auth } from '@/lib/firebase/client';
import { doc, getDoc, setDoc, collection, getDocs, runTransaction, serverTimestamp, query, where, addDoc } from 'firebase/firestore';
import { ethers } from 'ethers';
import { encryptPrivateKey } from '@/lib/crypto/client-aes';

// ═══════════════════════════════════════════════════════════
// GLOBAL INITIALIZATION LOCK (Idempotent)
// ═══════════════════════════════════════════════════════════
let initPromise: Promise<void> | null = null;

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
            // Check if genesis block is needed
            const state = get();
            if (state.publicKey && state.address) {
              const genesisTimeISO = new Date().toISOString();
              const payloadToHash = `00SystemSystem0${genesisTimeISO}genesis`;
              const genesisHash = await generateHash(payloadToHash);
              const genesisTxId = `tx_genesis_${uid}`;
              
              const genesisBlock: Transaction = {
                id: genesisTxId,
                blockNumber: 0,
                hash: genesisHash,
                previousHash: '0',
                walletAddress: uid,
                senderPublicKey: state.publicKey,
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
              
              setDoc(doc(db, 'users', uid, 'transactions', genesisTxId), genesisBlock).catch(console.warn);
              set({ transactions: [genesisBlock] });
            }
          }
        } catch (txErr) {
          console.warn('[SecureChain: BackgroundSync] Non-fatal transaction sync warning:', txErr);
        }
      },

      // ═══════════════════════════════════════════════════════
      // INITIALIZE WALLET (Strict Existing vs New User Logic)
      // ═══════════════════════════════════════════════════════
      initializeWallet: async (uid: string) => {
        // IDEMPOTENCY: If already running, wait for the existing promise
        if (initPromise) {
          console.log(`[SecureChain: Init] Already running, waiting for existing initialization...`);
          await initPromise;
          return;
        }

        initPromise = (async () => {
          console.log(`[SecureChain: Init] ▶ Wallet initialization started for UID: ${uid}`);
          
          try {
            const clientSecret = getClientSecret(uid);
            const walletRef = doc(db, 'users', uid, 'wallet', 'data');
            
            // Check Firestore for existing wallet record
            let walletSnap: any = null;
            try {
              walletSnap = await getDoc(walletRef);
            } catch (err) {
              console.warn('[SecureChain: Init] Firestore read error:', err);
              walletSnap = null;
            }
            
            const docExists = walletSnap && typeof walletSnap.exists === 'function' && walletSnap.exists();
            const currentState = get();
            const hasLocalKeys = isValidString(currentState.address) && isValidString(currentState.encryptedPrivateKey);

            if (docExists) {
              // ═══════════════════════════════════════════════════════
              // 1. EXISTING USER (Firestore Record Found)
              // ═══════════════════════════════════════════════════════
              console.log(`[SecureChain: Init] ✓ Existing wallet record found in Firestore. Restoring existing keys...`);
              const data = walletSnap.data();

              // Strict preservation: MUST preserve existing keys
              if (!isValidString(data.address) || !isValidString(data.publicKey) || !isValidString(data.encryptedPrivateKey)) {
                // If local storage has the valid keys, restore them to Firestore
                if (hasLocalKeys) {
                  console.log(`[SecureChain: Init] Restoring valid local keys to Firestore...`);
                  await setDoc(walletRef, {
                    address: currentState.address,
                    publicKey: currentState.publicKey,
                    encryptedPrivateKey: currentState.encryptedPrivateKey,
                    keyGeneratedAt: currentState.keyGeneratedAt || new Date().toISOString(),
                    algorithm: currentState.algorithm || 'ECDSA/secp256k1',
                    walletVersion: currentState.walletVersion || '1.0',
                    keyFingerprint: currentState.keyFingerprint || (await generateHash(currentState.publicKey!)).substring(0, 16),
                    balances: data.balances || currentState.balances || { USD: 0, BTC: 0, ETH: 0 },
                    lastBlockNumber: typeof data.lastBlockNumber === 'number' ? data.lastBlockNumber : 0,
                    lastBlockHash: data.lastBlockHash || '0x0000000000000000000000000000000000000000000000000000000000000000'
                  }, { merge: true });
                } else {
                  throw new Error('Existing wallet keys could not be verified.');
                }
              }

              // Load existing wallet state (NEVER generate new keys for existing user)
              set({
                address: data.address || currentState.address,
                publicKey: data.publicKey || currentState.publicKey,
                encryptedPrivateKey: data.encryptedPrivateKey || currentState.encryptedPrivateKey,
                keyGeneratedAt: data.keyGeneratedAt || currentState.keyGeneratedAt,
                algorithm: data.algorithm || 'ECDSA/secp256k1',
                walletVersion: data.walletVersion || '1.0',
                keyFingerprint: data.keyFingerprint || currentState.keyFingerprint,
                balances: data.balances || { USD: 0, BTC: 0, ETH: 0 },
                lastBlockNumber: typeof data.lastBlockNumber === 'number' ? data.lastBlockNumber : 0,
                lastBlockHash: data.lastBlockHash || null,
                _hasHydrated: true,
                _isWalletReady: true
              });

              console.log(`[SecureChain: Init] ✓ Existing wallet restored successfully. Address: ${data.address || currentState.address}`);

              // Trigger background non-critical synchronization
              get().syncTransactions(uid);

            } else if (hasLocalKeys) {
              // ═══════════════════════════════════════════════════════
              // 2. EXISTING USER (Cached Local Wallet Found)
              // ═══════════════════════════════════════════════════════
              console.log(`[SecureChain: Init] ✓ Existing wallet found in local storage. Preserving keys...`);
              
              set({
                _hasHydrated: true,
                _isWalletReady: true
              });

              // Sync existing local wallet to Firestore in background
              setDoc(walletRef, {
                address: currentState.address,
                publicKey: currentState.publicKey,
                encryptedPrivateKey: currentState.encryptedPrivateKey,
                keyGeneratedAt: currentState.keyGeneratedAt || new Date().toISOString(),
                algorithm: currentState.algorithm || 'ECDSA/secp256k1',
                walletVersion: currentState.walletVersion || '1.0',
                keyFingerprint: currentState.keyFingerprint,
                balances: currentState.balances || { USD: 0, BTC: 0, ETH: 0 },
                lastBlockNumber: currentState.lastBlockNumber || 0,
                lastBlockHash: currentState.lastBlockHash || '0x0000000000000000000000000000000000000000000000000000000000000000'
              }, { merge: true }).catch(err => console.warn('[SecureChain: Init] Background sync warning:', err));

              get().syncTransactions(uid);

            } else {
              // ═══════════════════════════════════════════════════════
              // 3. GENUINE NEW USER (Generate Wallet Once)
              // ═══════════════════════════════════════════════════════
              console.log('[SecureChain: Init] Generating new non-custodial wallet for new user...');
              
              const newWallet = ethers.Wallet.createRandom();
              const generatedAt = new Date().toISOString();
              const encryptedPrivKey = await encryptPrivateKey(newWallet.privateKey, clientSecret);
              const fingerprint = (await generateHash(newWallet.publicKey)).substring(0, 16);
              
              const payloadToHash = `00SystemSystem0${generatedAt}genesis`;
              const genesisHash = await generateHash(payloadToHash);
              const genesisTxId = `tx_genesis_${uid}`;

              const genesisBlock: Transaction = {
                id: genesisTxId,
                blockNumber: 0,
                hash: genesisHash,
                previousHash: '0',
                walletAddress: uid,
                senderPublicKey: newWallet.publicKey,
                digitalSignature: 'Genesis Block - System Generated',
                type: 'genesis',
                amount: 0,
                currency: 'USD',
                status: 'completed',
                date: generatedAt,
                description: 'System Genesis Block Initialization',
                payload: { message: 'SecureChain Genesis Block Created' },
                difficulty: 1,
                nonce: 0,
                blockSize: 256,
              };

              const initData = { 
                address: newWallet.address,
                publicKey: newWallet.publicKey,
                encryptedPrivateKey: encryptedPrivKey,
                keyGeneratedAt: generatedAt,
                algorithm: 'ECDSA/secp256k1',
                walletVersion: '1.0',
                keyFingerprint: fingerprint,
                balances: { USD: 0, BTC: 0, ETH: 0 }, 
                lastBlockNumber: 0,
                lastBlockHash: genesisHash,
              };

              // Persist to Firestore atomically
              const newTxRef = doc(db, 'users', uid, 'transactions', genesisTxId);
              await Promise.all([
                setDoc(newTxRef, genesisBlock),
                setDoc(walletRef, initData)
              ]);
              
              createAuditLog(uid, 'New user wallet created', [
                'address', 'publicKey', 'encryptedPrivateKey', 'keyGeneratedAt',
                'algorithm', 'walletVersion', 'keyFingerprint', 'genesisBlock'
              ], 'SUCCESS');
              
              // Set critical state and unlock UI
              set({ 
                ...initData, 
                lastBlockHash: genesisHash,
                transactions: [genesisBlock],
                _hasHydrated: true, 
                _isWalletReady: true 
              });

              console.log('[SecureChain: Init] ✓ New user wallet created and persisted successfully.');
            }
            
          } catch (error: any) {
            console.error("[SecureChain: Init] Critical wallet initialization failed:", error);
            // Failure Rule: Do NOT mark wallet ready and do NOT create fake data
            const currentState = get();
            if (isValidString(currentState.address) && isValidString(currentState.encryptedPrivateKey)) {
              // If local storage has existing valid keys, keep them
              set({ _hasHydrated: true, _isWalletReady: true });
            } else {
              set({ _hasHydrated: false, _isWalletReady: false });
              throw error;
            }
          } finally {
            initPromise = null;
          }
        })();

        await initPromise;
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
        const { decryptPrivateKey } = await import('@/lib/crypto/client-aes');
        let tempWallet: ethers.Wallet;
        try {
           const decryptedKey = await decryptPrivateKey(state.encryptedPrivateKey!, getClientSecret(uid));
           tempWallet = new ethers.Wallet(decryptedKey);
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
            walletAddress: uid,
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
