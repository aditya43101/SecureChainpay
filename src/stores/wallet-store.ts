import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db, auth } from '@/lib/firebase/client';
import { doc, getDoc, setDoc, collection, getDocs, runTransaction, serverTimestamp, query, where } from 'firebase/firestore';
import { ethers } from 'ethers';
import { encryptPrivateKey } from '@/lib/crypto/client-aes';

// Global lock to prevent concurrent initialization per user
const initializationLocks: Record<string, Promise<void> | null> = {};

// Helper for strict string validation
const isValidString = (val: any) => typeof val === 'string' && val.trim().length > 0;

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
  date: string; // ISO string representation of the exact server timestamp
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

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
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
      
      initializeWallet: async (uid: string) => {
        if (initializationLocks[uid]) {
          console.log(`[SecureChain] initializeWallet already running for ${uid}, waiting...`);
          await initializationLocks[uid];
          return;
        }

        let resolveLock: () => void;
        initializationLocks[uid] = new Promise(resolve => { resolveLock = resolve; });

        try {
          const walletRef = doc(db, 'users', uid, 'wallet', 'data');
          const walletSnap = await getDoc(walletRef);
          
          if (walletSnap.exists()) {
            const data = walletSnap.data();
            let finalData = { ...data };
            let needsHealing = false;
            let repairedFields: string[] = [];
            
            // STRICT SELF-HEALING LOGIC
            const missingAddress = !isValidString(data.address);
            const missingPublicKey = !isValidString(data.publicKey);
            const missingEncryptedKey = !isValidString(data.encryptedPrivateKey);
            
            if (missingAddress || missingPublicKey || missingEncryptedKey) {
               console.warn("[SecureChain: Self-Healing] Missing or corrupted crypto keys detected. Regenerating missing keys securely...");
               needsHealing = true;
               const newWallet = ethers.Wallet.createRandom();
               const clientSecret = getClientSecret(uid);
               
               if (missingAddress) { finalData.address = newWallet.address; repairedFields.push('address'); }
               if (missingPublicKey) { finalData.publicKey = newWallet.publicKey; repairedFields.push('publicKey'); }
               if (missingEncryptedKey) { finalData.encryptedPrivateKey = await encryptPrivateKey(newWallet.privateKey, clientSecret); repairedFields.push('encryptedPrivateKey'); }
               if (!isValidString(data.keyGeneratedAt)) { finalData.keyGeneratedAt = new Date().toISOString(); repairedFields.push('keyGeneratedAt'); }
               if (!isValidString(data.algorithm)) { finalData.algorithm = 'ECDSA/secp256k1'; repairedFields.push('algorithm'); }
               if (!isValidString(data.walletVersion)) { finalData.walletVersion = '1.0'; repairedFields.push('walletVersion'); }
               if (!isValidString(data.keyFingerprint)) { finalData.keyFingerprint = (await generateHash(finalData.publicKey)).substring(0, 16); repairedFields.push('keyFingerprint'); }
            }
            
            if (typeof data.lastBlockNumber !== 'number' || data.lastBlockNumber < 0) {
               needsHealing = true;
               finalData.lastBlockNumber = 0;
               repairedFields.push('lastBlockNumber');
            }
            if (!isValidString(data.lastBlockHash)) {
               needsHealing = true;
               finalData.lastBlockHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
               repairedFields.push('lastBlockHash');
            }
            
            if (needsHealing) {
               await setDoc(walletRef, finalData, { merge: true });
               
               // Create Audit Log
               const auditRef = doc(collection(db, 'users', uid, 'audit_logs'));
               await setDoc(auditRef, {
                 timestamp: new Date().toISOString(),
                 reason: 'Auto-recovery triggered due to missing or invalid fields',
                 repairedFields,
                 status: 'SUCCESS'
               });
               console.log(`[SecureChain: Self-Healing] Wallet data successfully repaired. Repaired: ${repairedFields.join(', ')}`);
            }

            set({ 
              address: finalData.address || null,
              publicKey: finalData.publicKey || null,
              encryptedPrivateKey: finalData.encryptedPrivateKey || null,
              keyGeneratedAt: finalData.keyGeneratedAt || null,
              algorithm: finalData.algorithm || null,
              walletVersion: finalData.walletVersion || null,
              keyFingerprint: finalData.keyFingerprint || null,
              balances: finalData.balances || { USD: 0, BTC: 0, ETH: 0 },
              lastBlockNumber: finalData.lastBlockNumber || 0,
              lastBlockHash: finalData.lastBlockHash || null,
            });

          } else {
            // GENERATE PUBLIC/PRIVATE KEY SYSTEM
            const newWallet = ethers.Wallet.createRandom();
            const generatedAt = new Date().toISOString();
            
            const clientSecret = getClientSecret(uid);
            const encryptedPrivKey = await encryptPrivateKey(newWallet.privateKey, clientSecret);
            const fingerprint = await generateHash(newWallet.publicKey);
            
            const initData = { 
              address: newWallet.address,
              publicKey: newWallet.publicKey,
              encryptedPrivateKey: encryptedPrivKey,
              keyGeneratedAt: generatedAt,
              algorithm: 'ECDSA/secp256k1',
              walletVersion: '1.0',
              keyFingerprint: fingerprint.substring(0, 16),
              balances: { USD: 0, BTC: 0, ETH: 0 }, 
              lastBlockNumber: 0,
              lastBlockHash: null // Will be updated by genesis block
            };
            
            // Check if Genesis block already exists to prevent duplicates
            const genesisCheckQ = query(collection(db, 'users', uid, 'transactions'), where('type', '==', 'genesis'));
            const genesisCheckSnap = await getDocs(genesisCheckQ);
            const genesisExists = !genesisCheckSnap.empty;

            let genesisHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
            
            if (!genesisExists) {
              const genesisTimeISO = generatedAt;
              const payloadToHash = `00SystemSystem0${genesisTimeISO}genesis`;
              genesisHash = await generateHash(payloadToHash);
              
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
              date: genesisTimeISO,
              description: 'System Genesis Block Initialization',
              payload: { message: 'SecureChain Genesis Block Created' },
              difficulty: 1,
              nonce: 0,
              blockSize: 256
            };
            
              // Execute atomic initialization
              await runTransaction(db, async (transaction) => {
                 const newTxRef = doc(db, 'users', uid, 'transactions', genesisTxId);
                 transaction.set(newTxRef, genesisBlock);
                 transaction.set(walletRef, { ...initData, lastBlockHash: genesisHash });
              });
            } else {
              // Genesis already existed but wallet didn't? Just create wallet.
              genesisHash = genesisCheckSnap.docs[0].data().hash;
              await setDoc(walletRef, { ...initData, lastBlockHash: genesisHash });
            }
            
            set({ ...initData, lastBlockHash: genesisHash });
          }

          
          // Fetch transactions
          const txsRef = collection(db, 'users', uid, 'transactions');
          const txsSnap = await getDocs(txsRef);
          const loadedTxs: Transaction[] = [];
          txsSnap.forEach(doc => {
            loadedTxs.push(doc.data() as Transaction);
          });
          
          // Sort by block number descending (newest first)
          loadedTxs.sort((a, b) => b.blockNumber - a.blockNumber);
          
          set({ transactions: loadedTxs, _hasHydrated: true });
        } catch (error) {
          console.error("[SecureChain: Error] Failed to initialize wallet from DB:", error);
          throw error;
        } finally {
          resolveLock!();
          initializationLocks[uid] = null;
        }
      },
      
      executeTransaction: async (type, amount, currency, description, payload) => {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('User not authenticated');
        
        console.log(`[SecureChain: Processing] Initiating atomic transaction for ${amount} ${currency}`);
        
        const serverTimeISO = new Date().toISOString();
        
        const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        let newTransaction: Transaction | null = null;
        let newBalances: Balances | null = null;
        let newBlockNumber = 0;
        let newBlockHash = '';
        
        // PRE-EXECUTION VALIDATIONS
        let state = get();
        
        // 1. Validate Keys Exist. If missing, Auto-Recover.
        if (!isValidString(state.encryptedPrivateKey) || !isValidString(state.address)) {
          console.warn("[SecureChain] Keys missing during transaction execution. Auto-recovering...");
          await get().initializeWallet(uid);
          state = get();
          
          if (!isValidString(state.encryptedPrivateKey)) {
            throw new Error("Wallet Keys Not Found: Auto-recovery failed. Please try again.");
          }
        }
        
        // 2. Validate Genesis Block Exists
        if (!state.transactions.some(t => t.type === 'genesis')) {
          console.warn("[SecureChain] Genesis block missing during transaction. Auto-recovering...");
          await get().initializeWallet(uid);
          state = get();
          if (!state.transactions.some(t => t.type === 'genesis')) {
            throw new Error("Blockchain Metadata Error: Genesis block missing.");
          }
        }

        const { decryptPrivateKey } = await import('@/lib/crypto/client-aes');
        let tempWallet: ethers.Wallet;
        try {
           const decryptedKey = await decryptPrivateKey(state.encryptedPrivateKey!, getClientSecret(uid));
           tempWallet = new ethers.Wallet(decryptedKey);
        } catch (e) {
           throw new Error("Failed to decrypt private key for signing");
        }

        await runTransaction(db, async (transaction) => {
          const walletRef = doc(db, 'users', uid, 'wallet', 'data');
          const walletSnap = await transaction.get(walletRef);
          
          if (!walletSnap.exists()) {
            throw new Error("Wallet data not found!");
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
          
          // Verify that the signature was actually created by the sender's private key
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
          console.log(`[SecureChain: Success] Block #${newBlockNumber} generated and wallet synced.`);
        }
      },
      
      disconnectWallet: () => {
        set({ 
          _hasHydrated: false, 
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
        if (state) state.setHasHydrated(true);
      }
    }
  )
);
