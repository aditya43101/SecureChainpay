import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db, auth } from '@/lib/firebase/client';
import { doc, getDoc, getDocFromCache, collection, getDocs, runTransaction, addDoc, setDoc } from 'firebase/firestore';
import { ethers } from 'ethers';
import { encryptPrivateKey, decryptPrivateKey } from '@/lib/crypto/client-aes';
import { getWalletSigner } from '@/lib/wallet/key-access';
import { initializeGlobalGenesis, appendBlockToGlobalChain } from '@/lib/blockchain/global-chain';

// ═══════════════════════════════════════════════════════════
// GLOBAL INITIALIZATION LOCK (Idempotent per UID)
// ═══════════════════════════════════════════════════════════
const initPromises = new Map<string, Promise<void>>();

// Typed Error Codes for Wallet Lifecycle
export type WalletErrorCode =
  | 'WALLET_NOT_FOUND'
  | 'WALLET_CREATION_REQUIRED'
  | 'WALLET_CLOUD_UNAVAILABLE'
  | 'WALLET_PERMISSION_DENIED'
  | 'WALLET_DECRYPTION_FAILED'
  | 'WALLET_ADDRESS_MISMATCH'
  | 'WALLET_PUBLIC_KEY_MISMATCH'
  | 'GENESIS_CREATION_FAILED'
  | 'WALLET_PERSISTENCE_FAILED'
  | 'WALLET_INITIALIZATION_FAILED';

export type TransactionStatus =
  | 'CREATED'
  | 'VALIDATED'
  | 'SIGNED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FINALIZED'
  | 'VALIDATION_FAILED'
  | 'SIGNING_FAILED'
  | 'SUBMISSION_FAILED'
  | 'CONFIRMATION_FAILED'
  | 'completed'
  | 'pending'
  | 'failed';

// Helper for strict string validation
const isValidString = (val: any): val is string => typeof val === 'string' && val.trim().length > 0;

export interface Transaction {
  // Canonical Application Identifier
  id: string; // matches applicationTransactionId
  applicationTransactionId?: string;
  userId?: string;
  sender?: string;
  receiver?: string;
  amount: number;
  currency: string;
  asset?: string;
  type: 'credit' | 'debit' | 'trade' | 'genesis';
  status: TransactionStatus;
  date: string;
  description: string;
  idempotencyKey?: string;

  // Off-Chain Cryptographic Proof
  canonicalPayload?: string;
  transactionHash?: string;
  hash: string;
  previousHash: string;
  signature?: string;
  digitalSignature?: string;
  walletAddress?: string;
  senderPublicKey?: string;

  // Real EVM On-Chain Proof
  blockchainTransactionHash?: string | null;
  blockNumber: number;
  blockHash?: string | null;
  chainId?: number | null;
  contractAddress?: string | null;

  // Lifecycle Timestamps
  createdAt?: string;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  finalizedAt?: string | null;

  // Phase 3 Reconciliation
  reconciliationStatus?: string | null;
  lastReconciledAt?: string | null;

  // Phase 4 Merkle Anchoring
  merkleBatchId?: string | null;
  merkleLeaf?: string | null;
  merkleRoot?: string | null;
  anchorStatus?: string | null;
  anchoredAt?: string | null;

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
  initializationErrorCode: WalletErrorCode | string | null;
  initializationErrorMessage: string | null;
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
  reconcileTransaction: (txId: string, autoRecover?: boolean) => Promise<any>;
  triggerBackgroundReconciliation: () => Promise<void>;
  
  executeTransaction: (
    type: Transaction['type'],
    amount: number,
    currency: keyof Balances,
    description: string,
    payload?: any
  ) => Promise<Transaction>;

  transferFunds: (params: {
    receiverUid: string;
    receiverAddress: string;
    receiverUsername?: string;
    receiverDisplayName?: string;
    amount: number;
    currency?: keyof Balances;
    note?: string;
  }) => Promise<Transaction>;
  
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
  const cleanSender = (params.sender || '').trim().toLowerCase();
  const cleanReceiver = (params.receiver || 'system').trim().toLowerCase();
  const cleanAmount = Number(params.amount).toFixed(6);
  const cleanAsset = (params.asset || 'USD').trim().toUpperCase();
  const cleanAppId = (params.applicationTransactionId || '').trim();
  const cleanIdemp = (params.idempotencyKey || '').trim();
  const cleanTimestamp = (params.timestamp || '').trim();

  return `appId:${cleanAppId}|sender:${cleanSender}|receiver:${cleanReceiver}|amount:${cleanAmount}|asset:${cleanAsset}|nonce:${cleanIdemp}|timestamp:${cleanTimestamp}`;
}

async function createGenesisBlock(uid: string, walletAddress: string, publicKey: string): Promise<Transaction> {
  const genesisTimeISO = '1970-01-01T00:00:00.000Z';
  const appId = `TX_GENESIS_${uid}`;
  const genesisHash = await generateHash(`genesis:${uid}:${walletAddress}:${publicKey}`);
  return {
    id: appId,
    applicationTransactionId: appId,
    userId: uid,
    sender: walletAddress,
    receiver: walletAddress,
    blockNumber: 0,
    hash: genesisHash,
    transactionHash: genesisHash,
    previousHash: '0',
    walletAddress,
    senderPublicKey: publicKey,
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
    description: 'System Genesis Block Initialization',
    payload: { message: 'SecureChain Genesis Block Created' },
    difficulty: 1,
    nonce: 0,
    blockSize: 256,
  };
}

/**
 * Cryptographically verifies that the encrypted private key decrypts properly,
 * and derives the exact matching Ethereum address and public key.
 */
async function verifyWalletIntegrity(params: {
  uid: string;
  address: string;
  publicKey?: string | null;
  encryptedPrivateKey: string;
}): Promise<{
  isValid: boolean;
  derivedAddress?: string;
  derivedPublicKey?: string;
  errorCode?: WalletErrorCode;
  errorMessage?: string;
}> {
  try {
    if (!isValidString(params.uid) || !isValidString(params.address) || !isValidString(params.encryptedPrivateKey)) {
      return {
        isValid: false,
        errorCode: 'WALLET_INITIALIZATION_FAILED',
        errorMessage: 'Incomplete wallet parameters for cryptographic verification',
      };
    }

    const clientSecret = getClientSecret(params.uid);
    let decryptedPrivKey: string;
    try {
      decryptedPrivKey = await decryptPrivateKey(params.encryptedPrivateKey, clientSecret);
    } catch {
      return {
        isValid: false,
        errorCode: 'WALLET_DECRYPTION_FAILED',
        errorMessage: 'Failed to decrypt private key with client secret. Decryption payload may be corrupted or invalid.',
      };
    }

    let signer: ethers.Wallet;
    try {
      signer = new ethers.Wallet(decryptedPrivKey);
    } catch {
      return {
        isValid: false,
        errorCode: 'WALLET_DECRYPTION_FAILED',
        errorMessage: 'Decrypted key is not a valid ECDSA private key.',
      };
    }

    if (signer.address.toLowerCase() !== params.address.toLowerCase()) {
      return {
        isValid: false,
        errorCode: 'WALLET_ADDRESS_MISMATCH',
        errorMessage: `Cryptographic address mismatch: derived address (${signer.address}) does not match stored address (${params.address}).`,
      };
    }

    if (params.publicKey && isValidString(params.publicKey)) {
      if (signer.signingKey.publicKey !== params.publicKey) {
        return {
          isValid: false,
          errorCode: 'WALLET_PUBLIC_KEY_MISMATCH',
          errorMessage: 'Cryptographic public key mismatch: derived public key does not match stored public key.',
        };
      }
    }

    return {
      isValid: true,
      derivedAddress: signer.address,
      derivedPublicKey: signer.signingKey.publicKey,
    };
  } catch (e: any) {
    return {
      isValid: false,
      errorCode: 'WALLET_INITIALIZATION_FAILED',
      errorMessage: e?.message || 'Unexpected error during cryptographic verification',
    };
  }
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
      initializationErrorCode: null,
      initializationErrorMessage: null,
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

            // Trigger non-blocking background reconciliation for any pending/unreconciled records
            setTimeout(() => {
              get().triggerBackgroundReconciliation().catch(() => null);
            }, 1000);
          } else {
            console.warn('[SecureChain: BackgroundSync] No transactions found; genesis is only created with a new wallet transaction.');
            set({ transactions: [] });
          }
        } catch (txErr) {
          console.warn('[SecureChain: BackgroundSync] Non-fatal transaction sync warning:', txErr);
        }
      },

      // ═══════════════════════════════════════════════════════
      // RECONCILE TRANSACTION (Phase 3 Engine)
      // ═══════════════════════════════════════════════════════
      reconcileTransaction: async (txId: string, autoRecover = true) => {
        const uid = auth.currentUser?.uid || get().ownerUid;
        const tx = get().transactions.find((t) => t.id === txId || t.applicationTransactionId === txId);
        if (!tx) return null;

        try {
          const res = await fetch('/api/reconciliation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactionRecord: {
                ...tx,
                applicationTransactionId: tx.applicationTransactionId || tx.id,
                userId: tx.userId || uid,
                sender: tx.sender || tx.walletAddress || '',
                receiver: tx.receiver || tx.payload?.receiverWallet || 'System',
                asset: tx.asset || tx.currency || 'USD',
                canonicalPayload: tx.canonicalPayload || '',
                transactionHash: tx.transactionHash || tx.hash,
                signature: tx.signature || tx.digitalSignature || '',
                senderPublicKey: tx.senderPublicKey || '',
                blockchainTransactionHash: tx.blockchainTransactionHash || null,
                blockNumber: tx.blockNumber,
                blockHash: tx.blockHash || null,
                chainId: tx.chainId || null,
                contractAddress: tx.contractAddress || null,
                createdAt: tx.createdAt || tx.date,
              },
              autoRecover,
              uid,
            }),
          });
          const data = await res.json();
          if (data.success && data.result) {
            const result = data.result;
            const updates: Partial<Transaction> = {
              reconciliationStatus: result.reconciliationStatus,
              lastReconciledAt: result.timestamp,
            };
            if (result.recoveredFields) {
              Object.assign(updates, result.recoveredFields);
            }
            if (uid) {
              const txRef = doc(db, 'users', uid, 'transactions', tx.id);
              await setDoc(txRef, updates, { merge: true }).catch(() => null);
            }
            set((state) => ({
              transactions: state.transactions.map((t) =>
                t.id === tx.id ? { ...t, ...updates } : t
              ),
            }));
            return result;
          }
          return null;
        } catch (err) {
          console.warn('[SecureChain: Reconciliation] Request failed:', err);
          return null;
        }
      },

      triggerBackgroundReconciliation: async () => {
        const uid = auth.currentUser?.uid || get().ownerUid;
        if (!uid) return;
        const txs = get().transactions;
        const candidates = txs.filter(
          (t) =>
            t.type !== 'genesis' &&
            (t.status === 'SUBMITTED' ||
              t.status === 'pending' ||
              !t.reconciliationStatus ||
              t.reconciliationStatus === 'RECOVERY_REQUIRED')
        ).slice(0, 5);

        for (const candidate of candidates) {
          await get().reconcileTransaction(candidate.id, true).catch(() => null);
        }
      },

      // ═══════════════════════════════════════════════════════
      // INITIALIZE WALLET (Strict Existing vs New User Logic)
      // ═══════════════════════════════════════════════════════
      initializeWallet: async (uid: string) => {
        if (!isValidString(uid)) {
          throw new Error('initializeWallet called without a valid UID');
        }

        // Lock check per UID
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
            const walletRef = doc(db, 'users', uid, 'wallet', 'data');
            const currentState = get();
            
            // Isolate session: If local state belongs to another UID, clear it first
            if (currentState.ownerUid && currentState.ownerUid !== uid) {
              console.warn(`[WALLET ${getWElapsed()}] Switching UID context from ${currentState.ownerUid} to ${uid}. Resetting local state.`);
              set({
                _isWalletReady: false,
                ownerUid: uid,
                identityStatus: 'pending',
                initializationErrorCode: null,
                initializationErrorMessage: null,
                address: null,
                publicKey: null,
                encryptedPrivateKey: null,
                balances: { USD: 0, BTC: 0, ETH: 0 },
                transactions: [],
                lastBlockNumber: 0,
                lastBlockHash: null
              });
            }

            const stateAfterIsolation = get();
            const hasLocalKeys = (
              stateAfterIsolation.ownerUid === uid &&
              isValidString(stateAfterIsolation.address) &&
              isValidString(stateAfterIsolation.encryptedPrivateKey)
            );

            // ─── HELPER: RESTORE AND CRYPTOGRAPHICALLY VERIFY WALLET ───
            const restoreWalletState = async (data: any, source: 'CLOUD' | 'CACHE' | 'LOCAL') => {
              const resolvedAddress = data.address || data.walletAddress || (stateAfterIsolation.ownerUid === uid ? stateAfterIsolation.address : null);
              const resolvedEncryptedKey = data.encryptedPrivateKey || data.encryptedKey || (stateAfterIsolation.ownerUid === uid ? stateAfterIsolation.encryptedPrivateKey : null);
              let resolvedPublicKey = data.publicKey || data.senderPublicKey || (stateAfterIsolation.ownerUid === uid ? stateAfterIsolation.publicKey : null);

              if (!isValidString(resolvedAddress) || !isValidString(resolvedEncryptedKey)) {
                set({
                  _hasHydrated: true,
                  _isWalletReady: false,
                  ownerUid: uid,
                  identityStatus: 'error',
                  initializationErrorCode: 'WALLET_NOT_FOUND',
                  initializationErrorMessage: 'Wallet integrity failure: wallet address or encrypted key is missing. No keys were changed.',
                });
                return false;
              }

              // PHASE 1D: Cryptographic verification before marking ready
              const verification = await verifyWalletIntegrity({
                uid,
                address: resolvedAddress,
                publicKey: resolvedPublicKey,
                encryptedPrivateKey: resolvedEncryptedKey,
              });

              if (!verification.isValid) {
                console.error(`[WALLET ${getWElapsed()}] Cryptographic verification FAILED (${verification.errorCode}): ${verification.errorMessage}`);
                set({
                  _hasHydrated: true,
                  _isWalletReady: false,
                  ownerUid: uid,
                  identityStatus: 'error',
                  initializationErrorCode: verification.errorCode || 'WALLET_INITIALIZATION_FAILED',
                  initializationErrorMessage: verification.errorMessage || 'Wallet cryptographic verification failed. Stored keys were preserved.',
                });
                return false;
              }

              const verifiedPublicKey = verification.derivedPublicKey || resolvedPublicKey || null;
              const verifiedAddress = verification.derivedAddress || resolvedAddress;
              const fingerprint = data.keyFingerprint || (verifiedPublicKey ? (await generateHash(verifiedPublicKey)).substring(0, 16) : 'Pending');

              // If publicKey was derived and missing in cloud doc, backfill in background
              if (!isValidString(data.publicKey) && source === 'CLOUD' && verifiedPublicKey) {
                setDoc(walletRef, { publicKey: verifiedPublicKey }, { merge: true }).catch((err) => {
                  console.warn('[WalletInit] Non-fatal public key backfill warning:', err);
                });
              }

              set({
                ownerUid: uid,
                identityStatus: 'verified',
                initializationErrorCode: null,
                initializationErrorMessage: null,
                address: verifiedAddress,
                publicKey: verifiedPublicKey,
                encryptedPrivateKey: resolvedEncryptedKey,
                keyGeneratedAt: data.keyGeneratedAt || stateAfterIsolation.keyGeneratedAt || null,
                algorithm: data.algorithm || 'ECDSA/secp256k1',
                walletVersion: data.walletVersion || '1.0',
                keyFingerprint: fingerprint,
                balances: data.balances || stateAfterIsolation.balances || { USD: 0, BTC: 0, ETH: 0 },
                lastBlockNumber: typeof data.lastBlockNumber === 'number' ? data.lastBlockNumber : 0,
                lastBlockHash: data.lastBlockHash || null,
                _hasHydrated: true,
                _isWalletReady: true,
              });

              get().syncTransactions(uid);
              return true;
            };

            console.info(`[WalletInit] Checking Firestore for UID: ${uid}`);
            
            // ─── FIRESTORE WALLET LOOKUP WITH TIMEOUT GUARD ───
            const readResult = await Promise.race([
              getDoc(walletRef)
                .then((snapshot) => ({
                  status: snapshot.exists() ? 'FOUND' as const : 'NOT_FOUND' as const,
                  snapshot,
                }))
                .catch((error) => ({
                  status: 'ERROR' as const,
                  snapshot: null,
                  error,
                })),
              new Promise<{ status: 'ERROR'; snapshot: null; error: any }>((resolve) =>
                setTimeout(() => resolve({
                  status: 'ERROR',
                  snapshot: null,
                  error: { code: 'timeout', message: 'Firestore wallet lookup timed out' }
                }), 4000)
              )
            ]);

            console.info(`[WalletInit] Firestore lookup result: ${readResult.status}`);

            // ═══════════════════════════════════════════════════════
            // STATE C: FIRESTORE ERROR / TIMEOUT / UNAVAILABLE
            // ═══════════════════════════════════════════════════════
            if (readResult.status === 'ERROR') {
              const errCode = readResult.error?.code;
              const errMessage = readResult.error?.message || 'Firestore wallet lookup failed';

              let normalizedErrorCode: WalletErrorCode = 'WALLET_CLOUD_UNAVAILABLE';
              if (errCode === 'permission-denied') {
                normalizedErrorCode = 'WALLET_PERMISSION_DENIED';
              } else if (errCode === 'unavailable' || errCode === 'timeout') {
                normalizedErrorCode = 'WALLET_CLOUD_UNAVAILABLE';
              } else {
                normalizedErrorCode = 'WALLET_INITIALIZATION_FAILED';
              }

              // Try Firestore offline cache first if cloud is unavailable
              if (errCode === 'unavailable' || errCode === 'timeout') {
                const cachedSnapshot = await getDocFromCache(walletRef).catch(() => null);
                if (cachedSnapshot?.exists()) {
                  const restored = await restoreWalletState(cachedSnapshot.data() ?? {}, 'CACHE');
                  if (restored) {
                    console.warn(`[WALLET ${getWElapsed()}] Restored UID-owned wallet from Firestore local cache. No keys were changed.`);
                    return;
                  }
                }
              }

              // Fallback to local verified keys if available
              if (hasLocalKeys) {
                const restored = await restoreWalletState(stateAfterIsolation, 'LOCAL');
                if (restored) {
                  console.warn(`[WALLET ${getWElapsed()}] Firestore unavailable; verified local wallet is being used offline. No cloud write performed.`);
                  return;
                }
              }

              // NEVER CREATE A REPLACEMENT WALLET ON STATE C
              set({
                _hasHydrated: true,
                _isWalletReady: false,
                ownerUid: uid,
                identityStatus: 'error',
                initializationErrorCode: normalizedErrorCode,
                initializationErrorMessage: errMessage,
              });
              console.warn(`[WALLET ${getWElapsed()}] Wallet lookup unavailable (${errMessage}). No wallet was created or changed; retry is required.`);
              return;
            }

            // ═══════════════════════════════════════════════════════
            // STATE A: WALLET FOUND IN CLOUD
            // ═══════════════════════════════════════════════════════
            if (readResult.status === 'FOUND') {
              console.info('[WalletInit] Existing wallet confirmed in cloud. Restoring...');
              const data = readResult.snapshot.data() ?? {};
              await restoreWalletState(data, 'CLOUD');
              return;
            }

            // ═══════════════════════════════════════════════════════
            // STATE B: WALLET CONFIRMED NOT TO EXIST IN CLOUD
            // ═══════════════════════════════════════════════════════
            // If local state has valid keys for this UID, preserve them
            if (hasLocalKeys) {
              const restored = await restoreWalletState(stateAfterIsolation, 'LOCAL');
              if (restored) {
                console.warn(`[WALLET ${getWElapsed()}] Firestore returned NOT_FOUND, but valid local keys exist for this UID. Restored without generating replacement.`);
                return;
              }
            }

            // ─── NEW USER WALLET GENERATION (GENUINELY NEW USER ONLY) ───
            console.info(`[WalletInit] Genuinely new user confirmed for UID: ${uid}. Generating new wallet...`);
            
            const clientSecret = getClientSecret(uid);
            const newWallet = ethers.Wallet.createRandom();
            const generatedAt = new Date().toISOString();
            const encryptedPrivKey = await encryptPrivateKey(newWallet.privateKey, clientSecret);
            const newPublicKey = newWallet.signingKey.publicKey;
            const fingerprint = (await generateHash(newPublicKey)).substring(0, 16);
            
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
            };

            // Pre-verify before persisting
            const preVerify = await verifyWalletIntegrity({
              uid,
              address: newWallet.address,
              publicKey: newPublicKey,
              encryptedPrivateKey: encryptedPrivKey,
            });

            if (!preVerify.isValid) {
              throw new Error(`Generated wallet failed pre-persistence verification: ${preVerify.errorMessage}`);
            }

            let created = false;

            // Atomic Firestore Transaction for Wallet Data (no per-user genesis)
            await runTransaction(db, async (transaction) => {
              const existing = await transaction.get(walletRef);
              if (existing.exists()) {
                // Another tab or process already created the wallet
                return;
              }
              transaction.set(walletRef, initData);
              created = true;
            });

            if (!created) {
              // Concurrently created by another process, restore that one
              const concurrentWallet = await getDoc(walletRef);
              if (concurrentWallet.exists()) {
                await restoreWalletState(concurrentWallet.data() ?? {}, 'CLOUD');
                console.info('[WalletInit] Concurrent wallet creation detected; restored existing wallet.');
                return;
              }
              throw new Error('Wallet creation was not committed. Please retry.');
            }

            // Initialize global genesis (idempotent — only creates once for entire system)
            initializeGlobalGenesis().catch((err) => {
              console.warn('[WalletInit] Non-fatal global genesis initialization warning:', err);
            });

            createAuditLog(uid, 'New user wallet created', ['wallet'], 'SUCCESS');
            set({
              ...initData,
              identityStatus: 'verified',
              initializationErrorCode: null,
              initializationErrorMessage: null,
              transactions: [],
              _hasHydrated: true,
              _isWalletReady: true,
            });
            console.log(`[WALLET ${getWElapsed()}] New wallet persisted. Global genesis initialized.`);
          } catch (error: any) {
            console.error(`[WALLET ${getWElapsed()}] Critical wallet initialization failed:`, error);
            set({
              _hasHydrated: true,
              _isWalletReady: false,
              identityStatus: 'error',
              initializationErrorCode: typeof error?.code === 'string' ? error.code : 'WALLET_INITIALIZATION_FAILED',
              initializationErrorMessage: error instanceof Error ? error.message : 'Wallet initialization failed',
            });
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
        
        // Check 2: Ensure global genesis exists (idempotent)
        await initializeGlobalGenesis().catch(() => null);

        console.log("[SecureChain: Tx] All pre-flight checks passed. Initiating Hybrid Transaction...");
        
        const serverTimeISO = new Date().toISOString();
        const applicationTransactionId = `TX_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const idempotencyKey = payload?.idempotencyKey || `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const txId = applicationTransactionId;

        const senderWallet = state.address || uid;
        const receiverWallet = payload?.receiverWallet || 'System';

        // ─── CANONICAL PAYLOAD & CRYPTOGRAPHIC SIGNING ───
        const canonical = canonicalizePayload({
          applicationTransactionId,
          sender: senderWallet,
          receiver: receiverWallet,
          amount,
          asset: currency,
          idempotencyKey,
          timestamp: serverTimeISO,
        });

        const canonicalHash = await generateHash(canonical);
        
        // Decrypt key in memory for signing ONLY
        let tempWallet: ethers.Wallet;
        let digitalSignature: string;
        try {
          tempWallet = await getWalletSigner({
            uid,
            encryptedPrivateKey: state.encryptedPrivateKey!,
            address: state.address!,
            publicKey: state.publicKey!,
          });
          set({ identityStatus: 'verified' });
          digitalSignature = await tempWallet.signMessage(canonical);
        } catch (e) {
          console.error("[SecureChain: Tx] ✗ Failed to decrypt private key for signing:", e);
          throw new Error("Failed to decrypt private key for signing");
        }

        const recoveredAddress = ethers.verifyMessage(canonical, digitalSignature);
        if (recoveredAddress.toLowerCase() !== senderWallet.toLowerCase()) {
          throw new Error("Cryptographic verification failed: Signature does not match sender address");
        }

        let newTransaction: Transaction | null = null;
        let newBalances: Balances | null = null;
        let newBlockNumber = 0;
        let newBlockHash = '';

        // ─── STEP 1: BALANCE UPDATE (per-user) + DUAL-WRITE TO GLOBAL CHAIN ───
        // Step 1a: Atomically update user balances
        await runTransaction(db, async (transaction) => {
          const walletRef = doc(db, 'users', uid, 'wallet', 'data');
          const walletSnap = await transaction.get(walletRef);
          
          if (!walletSnap.exists()) {
            throw new Error("Wallet data not found in Firestore!");
          }
          
          const currentData = walletSnap.data();
          const currentBalances = currentData.balances || { USD: 0, BTC: 0, ETH: 0 };
          
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

          transaction.update(walletRef, {
            balances: newBalances,
          });
        });

        // Step 1b: Build provisional transaction record
        // Block number, previousHash, and hash will be assigned by the global chain
        const provisionalTransaction: Transaction = {
          id: applicationTransactionId,
          applicationTransactionId,
          userId: uid,
          sender: senderWallet,
          receiver: receiverWallet,
          amount,
          currency,
          asset: currency,
          type,
          status: 'SUBMITTED',
          date: serverTimeISO,
          createdAt: serverTimeISO,
          submittedAt: serverTimeISO,
          description,
          idempotencyKey,

          canonicalPayload: canonical,
          transactionHash: canonicalHash,
          hash: '', // Will be set by global chain
          previousHash: '', // Will be set by global chain
          walletAddress: senderWallet,
          senderPublicKey: state.publicKey || tempWallet.address,
          digitalSignature: digitalSignature,
          signature: digitalSignature,

          blockNumber: 0, // Will be set by global chain
          payload: { ...payload, canonicalPayload: canonical, idempotencyKey },
          difficulty: 2,
          nonce: Math.floor(Math.random() * 1000000),
          blockSize: 512,
        };

        // Step 1c: Append to the GLOBAL chain (atomic, concurrency-safe)
        // This assigns the correct blockNumber, previousHash, and hash
        const globalBlock = await appendBlockToGlobalChain(provisionalTransaction);
        newTransaction = globalBlock;
        newBlockNumber = globalBlock.blockNumber;
        newBlockHash = globalBlock.hash;

        // Step 1d: Dual-write — also store in user's transaction subcollection (for "My Transactions")
        const userTxRef = doc(db, 'users', uid, 'transactions', applicationTransactionId);
        await setDoc(userTxRef, globalBlock).catch((err) => {
          console.warn('[SecureChain: Tx] Non-fatal user transaction index write warning:', err);
        });

        if (newTransaction && newBalances) {
          set((state) => ({
            balances: newBalances!,
            transactions: [newTransaction!, ...state.transactions.filter(t => t.id !== newTransaction!.id)],
            lastBlockNumber: newBlockNumber,
            lastBlockHash: newBlockHash
          }));
          console.log(`[SecureChain: Tx] ✓ Transaction #${newBlockNumber} recorded in GLOBAL chain and user index.`);
        }

        // ─── STEP 2: REAL BLOCKCHAIN SUBMISSION & ANCHORING ───
        try {
          console.log(`[SecureChain: Tx] Submitting transaction ${applicationTransactionId} to smart contract...`);
          const submitRes = await fetch('/api/transactions/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              applicationTransactionId,
              sender: senderWallet,
              receiver: receiverWallet,
              amount,
              currency,
              canonicalPayload: canonical,
              signature: digitalSignature,
              idempotencyKey,
            }),
          });

          const submitData = await submitRes.json();

          if (submitData.success && submitData.blockchainTransactionHash) {
            const confirmedAt = submitData.confirmedAt || new Date().toISOString();
            console.log(`[SecureChain: Tx] ✓ Blockchain Anchored! EVM Hash: ${submitData.blockchainTransactionHash} (Block #${submitData.blockNumber})`);
            
            const confirmedFields = {
              status: 'CONFIRMED' as const,
              blockchainTransactionHash: submitData.blockchainTransactionHash,
              blockNumber: newBlockNumber,
              blockHash: submitData.blockHash || null,
              chainId: submitData.chainId || 31337,
              contractAddress: submitData.contractAddress || null,
              confirmedAt,
            };

            // Update Firestore with confirmed on-chain proof (DUAL WRITE: global + user)
            const globalBlockRef = doc(db, 'global_blocks', applicationTransactionId);
            const userTxDocRef = doc(db, 'users', uid, 'transactions', applicationTransactionId);
            await Promise.all([
              setDoc(globalBlockRef, confirmedFields, { merge: true }).catch((err) => {
                console.warn('[SecureChain: Tx] Non-fatal global chain confirmation update warning:', err);
              }),
              setDoc(userTxDocRef, confirmedFields, { merge: true }).catch((err) => {
                console.warn('[SecureChain: Tx] Non-fatal user tx confirmation update warning:', err);
              }),
            ]);

            // Update local state with confirmed proof
            newTransaction = {
              ...newTransaction!,
              ...confirmedFields,
            };

            set((state) => ({
              transactions: state.transactions.map((t) =>
                t.id === applicationTransactionId ? { ...t, ...confirmedFields } : t
              ),
            }));
          } else {
            console.warn(`[SecureChain: Tx] Smart contract submission response:`, submitData);
            const failureFields = {
              status: 'SUBMISSION_FAILED' as const,
            };
            const globalBlockRef2 = doc(db, 'global_blocks', applicationTransactionId);
            const userTxDocRef2 = doc(db, 'users', uid, 'transactions', applicationTransactionId);
            await Promise.all([
              setDoc(globalBlockRef2, failureFields, { merge: true }).catch(() => null),
              setDoc(userTxDocRef2, failureFields, { merge: true }).catch(() => null),
            ]);
            newTransaction = { ...newTransaction!, ...failureFields };
            set((state) => ({
              transactions: state.transactions.map((t) =>
                t.id === applicationTransactionId ? { ...t, ...failureFields } : t
              ),
            }));
          }
        } catch (chainSubmitErr: any) {
          console.warn('[SecureChain: Tx] Blockchain submission network/execution warning:', chainSubmitErr);
          const failureFields = {
            status: 'SUBMISSION_FAILED' as const,
          };
          const globalBlockRef3 = doc(db, 'global_blocks', applicationTransactionId);
          const userTxDocRef3 = doc(db, 'users', uid, 'transactions', applicationTransactionId);
          await Promise.all([
            setDoc(globalBlockRef3, failureFields, { merge: true }).catch(() => null),
            setDoc(userTxDocRef3, failureFields, { merge: true }).catch(() => null),
          ]);
          newTransaction = { ...newTransaction!, ...failureFields };
          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.id === applicationTransactionId ? { ...t, ...failureFields } : t
            ),
          }));
        }

        return newTransaction!;
      },

      // ═══════════════════════════════════════════════════════
      // REALISTIC USER-TO-USER TRANSFER FUNDS
      // ═══════════════════════════════════════════════════════
      transferFunds: async ({
        receiverUid,
        receiverAddress,
        receiverUsername,
        receiverDisplayName,
        amount,
        currency = 'USD',
        note,
      }) => {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('User not authenticated');

        console.log(`[SecureChain: Transfer] ▶ Initiating transfer of $${amount} ${currency} to ${receiverAddress}`);

        let state = get();

        // 1. Key check & Auto-recovery
        if (!isValidString(state.encryptedPrivateKey) || !isValidString(state.address) || !isValidString(state.publicKey)) {
          console.warn("[SecureChain: Transfer] Keys missing. Triggering auto-recovery...");
          await get().initializeWallet(uid);
          state = get();

          if (!isValidString(state.encryptedPrivateKey) || !isValidString(state.address)) {
            throw new Error("Wallet recovery failed. Please refresh the page.");
          }
        }

        // 2. Balance Check
        const currentBalance = Number(state.balances[currency] || 0);
        if (currentBalance < amount) {
          throw new Error(`Insufficient balance. You have $${currentBalance.toFixed(2)} ${currency}.`);
        }

        // 3. Self-transfer check
        if (uid === receiverUid || state.address?.toLowerCase() === receiverAddress.toLowerCase()) {
          throw new Error("You cannot send money to your own wallet.");
        }

        const serverTimeISO = new Date().toISOString();
        const applicationTransactionId = `TX_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const senderWallet = state.address!;

        // 4. Canonical Payload & Cryptographic Signing
        const canonical = canonicalizePayload({
          applicationTransactionId,
          sender: senderWallet,
          receiver: receiverAddress,
          amount,
          asset: currency,
          idempotencyKey,
          timestamp: serverTimeISO,
        });

        let tempWallet: ethers.Wallet;
        let digitalSignature: string;
        try {
          tempWallet = await getWalletSigner({
            uid,
            encryptedPrivateKey: state.encryptedPrivateKey!,
            address: state.address!,
            publicKey: state.publicKey!,
          });
          digitalSignature = await tempWallet.signMessage(canonical);
        } catch (e: any) {
          console.error("[SecureChain: Transfer] ✗ Failed to sign transfer message:", e);
          throw new Error("Failed to sign transfer with private key");
        }

        // 5. Call Atomic Server Endpoint
        const res = await fetch('/api/wallet/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationTransactionId,
            senderUid: uid,
            senderAddress: senderWallet,
            receiverUid,
            receiverAddress,
            receiverUsername,
            receiverDisplayName,
            amount,
            currency,
            canonicalPayload: canonical,
            signature: digitalSignature,
            idempotencyKey,
            note,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Transfer failed on server');
        }

        const completedTx = data.transaction as Transaction;
        const updatedBalances = data.senderBalances || {
          ...state.balances,
          [currency]: currentBalance - amount,
        };

        // 6. Update local state
        set((s) => ({
          balances: updatedBalances,
          transactions: [completedTx, ...s.transactions.filter((t) => t.id !== completedTx.id)],
          lastBlockNumber: completedTx.blockNumber,
          lastBlockHash: completedTx.hash,
        }));

        console.log(`[SecureChain: Transfer] ✓ Transfer of $${amount} ${currency} completed successfully! Block #${completedTx.blockNumber}`);
        return completedTx;
      },
      
      disconnectWallet: () => {
        set({ 
          _hasHydrated: false,
          _isWalletReady: false,
          ownerUid: null,
          identityStatus: 'pending',
          initializationErrorCode: null,
          initializationErrorMessage: null,
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
