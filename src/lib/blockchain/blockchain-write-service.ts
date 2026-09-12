import { getAdminDb } from '@/lib/firebase/admin';
import { calculateCanonicalBlockHash, sha256Hex } from '@/lib/crypto/canonical-hash';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';
import { ethers } from 'ethers';
import { SmartContractService } from './smart-contract-service';
import { BlockchainReconciliationService } from './blockchain-reconciliation-service';
import { TransactionSecurityGate } from '@/lib/security/transaction-security-gate';

export interface TrustedTransactionIntent {
  applicationTransactionId: string;
  senderUid: string;
  senderAddress: string;
  receiverAddress: string;
  receiverUid?: string | null;
  receiverUsername?: string | null;
  amount: number;
  currency: string;
  type: 'credit' | 'debit' | 'trade' | 'transfer';
  description?: string;
  idempotencyKey?: string;
  canonicalPayload?: string;
  signature?: string;
  senderPublicKey?: string;
  tradeAsset?: string;
  tradeAmount?: number;
  note?: string;
}

export interface TrustedBlockResult {
  success: boolean;
  block?: any;
  error?: string;
  replayed?: boolean;
  onChainTxHash?: string;
}

export interface GlobalChainState {
  lastBlockNumber: number;
  lastBlockHash: string;
  genesisHash: string;
  chainRoot: string;
  chainId?: number;
  chainVersion?: number;
  contractAddress?: string;
  paused?: boolean;
  totalBlocks: number;
  lastUpdatedAt: string;
}

export class BlockchainWriteService {
  private static GLOBAL_BLOCKS = 'global_blocks';
  private static GLOBAL_META = 'global_chain_meta';
  private static CHAIN_STATE_DOC = 'chain_state';
  private static GENESIS_BLOCK_ID = 'GENESIS';

  public static GENESIS_CHAIN_ROOT = ethers.keccak256(
    ethers.toUtf8Bytes('genesis:securechainpay:global:v1:root')
  );

  /**
   * Helper to compute next sequential chain root: keccak256(previousChainRoot + blockHash)
   */
  public static computeChainRoot(previousChainRoot: string, blockHash: string): string {
    return ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'bytes32'], [previousChainRoot, blockHash])
    );
  }

  /**
   * Initializes the Genesis block idempotently on the server.
   */
  public static async ensureGenesisBlock(): Promise<GlobalChainState> {
    const adminDb = getAdminDb();
    const chainStateRef = adminDb.collection(this.GLOBAL_META).doc(this.CHAIN_STATE_DOC);
    const genesisRef = adminDb.collection(this.GLOBAL_BLOCKS).doc(this.GENESIS_BLOCK_ID);

    const genesisSnap = await chainStateRef.get();
    if (genesisSnap.exists) {
      return genesisSnap.data() as GlobalChainState;
    }

    const genesisTimeISO = '1970-01-01T00:00:00.000Z';
    const genesisHash = await sha256Hex('genesis:securechainpay:global:v1');

    const genesisBlock = {
      id: this.GENESIS_BLOCK_ID,
      applicationTransactionId: 'TX_GENESIS_GLOBAL',
      userId: 'SYSTEM',
      sender: '0x0000000000000000000000000000000000000000',
      receiver: '0x0000000000000000000000000000000000000000',
      blockNumber: 0,
      hash: genesisHash,
      transactionHash: genesisHash,
      previousHash: '0',
      chainRoot: this.GENESIS_CHAIN_ROOT,
      walletAddress: '0x0000000000000000000000000000000000000000',
      senderPublicKey: 'SYSTEM_GENESIS',
      digitalSignature: 'Genesis Block - System Generated',
      signature: 'Genesis Block - System Generated',
      type: 'genesis',
      amount: 0,
      currency: 'HSCT',
      asset: 'HSCT',
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

    const initialChainState: GlobalChainState = {
      lastBlockNumber: 0,
      lastBlockHash: genesisHash,
      genesisHash,
      chainRoot: this.GENESIS_CHAIN_ROOT,
      chainId: 31337,
      chainVersion: 1,
      paused: false,
      totalBlocks: 1,
      lastUpdatedAt: new Date().toISOString(),
    };

    await adminDb.runTransaction(async (t) => {
      const stateCheck = await t.get(chainStateRef);
      if (!stateCheck.exists) {
        t.set(genesisRef, genesisBlock);
        t.set(chainStateRef, initialChainState);
      }
    });

    return initialChainState;
  }

  /**
   * PHASE 3 AUTHORITATIVE TRANSACTION EXECUTION
   * FLOW:
   *  1. Validate Inputs & Signatures
   *  2. Read current DB chain state & check idempotency
   *  3. Construct candidate block (blockNumber, previousHash, blockHash, chainRoot)
   *  4. SMART CONTRACT FIRST WRITE: Commit candidate block to SecureChainAnchor smart contract ON-CHAIN
   *  5. FIRESTORE SECOND WRITE: Commit atomic transaction updating Firestore blocks, state & user balances
   */
  public static async executeTrustedTransaction(intent: TrustedTransactionIntent): Promise<TrustedBlockResult> {
    const adminDb = getAdminDb();
    const serverTimeISO = new Date().toISOString();
    const resolvedCurrency = (intent.currency || 'HSCT').toUpperCase().trim();
    const transferAmount = Number(intent.amount);

    // 1. Strict Input Validations
    if (isNaN(transferAmount) || transferAmount < 0) {
      await SecurityAuditLogger.log({
        type: 'INVALID_PAYLOAD',
        userId: intent.senderUid,
        resource: 'BlockchainWriteService',
        action: 'executeTransaction',
        result: 'DENIED',
        severity: 'HIGH',
        metadata: { reason: 'Negative or invalid transaction amount', amount: intent.amount },
      });
      return { success: false, error: 'Transaction amount must be non-negative' };
    }

    // 2. Cryptographic signature check if provided
    if (intent.signature && intent.canonicalPayload) {
      try {
        const recovered = ethers.verifyMessage(intent.canonicalPayload, intent.signature);
        if (recovered.toLowerCase() !== intent.senderAddress.toLowerCase()) {
          await SecurityAuditLogger.log({
            type: 'SIGNATURE_MISMATCH',
            userId: intent.senderUid,
            resource: 'BlockchainWriteService',
            action: 'verifySignature',
            result: 'DENIED',
            severity: 'CRITICAL',
            metadata: {
              expectedSender: intent.senderAddress,
              recoveredAddress: recovered,
            },
          });
          return { success: false, error: 'Cryptographic signature mismatch' };
        }
      } catch (err: any) {
        return { success: false, error: `Invalid cryptographic signature: ${err.message}` };
      }
    }

    // Ensure Genesis Block
    const currentGlobalState = await this.ensureGenesisBlock();

    // Idempotency check: Has this block already been committed in Firestore?
    const blockDocId = intent.applicationTransactionId;
    const globalBlockRef = adminDb.collection(this.GLOBAL_BLOCKS).doc(blockDocId);
    const existingBlockSnap = await globalBlockRef.get();
    if (existingBlockSnap.exists) {
      const existingData = existingBlockSnap.data();
      await SecurityAuditLogger.log({
        type: 'REPLAY_ATTEMPT',
        userId: intent.senderUid,
        resource: 'BlockchainWriteService',
        action: 'executeTransaction',
        result: 'ALLOWED',
        severity: 'LOW',
        metadata: { message: 'Duplicate transaction id acknowledged safely', blockId: blockDocId },
      });
      return { success: true, block: existingData, replayed: true };
    }

    // Prepare Document References
    const chainStateRef = adminDb.collection(this.GLOBAL_META).doc(this.CHAIN_STATE_DOC);
    const senderWalletRef = adminDb.collection('users').doc(intent.senderUid).collection('wallet').doc('data');
    const senderTxRef = adminDb.collection('users').doc(intent.senderUid).collection('transactions').doc(blockDocId);

    let targetReceiverUid = intent.receiverUid || null;
    if (!targetReceiverUid && intent.receiverAddress) {
      try {
        const usersSnap = await adminDb.collection('users').get();
        for (const uDoc of usersSnap.docs) {
          const wSnap = await uDoc.ref.collection('wallet').doc('data').get();
          if (wSnap.exists && wSnap.data()?.address?.toLowerCase() === intent.receiverAddress.toLowerCase()) {
            targetReceiverUid = uDoc.id;
            break;
          }
        }
      } catch {}
    }

    const receiverWalletRef = targetReceiverUid
      ? adminDb.collection('users').doc(targetReceiverUid).collection('wallet').doc('data')
      : null;
    const receiverTxRef = targetReceiverUid
      ? adminDb.collection('users').doc(targetReceiverUid).collection('transactions').doc(blockDocId)
      : null;

    // Calculate Candidate Block Details
    const nextBlockNumber = (currentGlobalState.lastBlockNumber || 0) + 1;
    const previousHash = currentGlobalState.lastBlockHash;
    const previousChainRoot = currentGlobalState.chainRoot || this.GENESIS_CHAIN_ROOT;

    const canonicalBlockHash = await calculateCanonicalBlockHash({
      blockNumber: nextBlockNumber,
      previousHash,
      sender: intent.senderAddress,
      receiver: intent.receiverAddress,
      amount: transferAmount,
      currency: resolvedCurrency,
      date: serverTimeISO,
      type: intent.type,
      idempotencyKey: intent.idempotencyKey,
    });

    const newChainRoot = this.computeChainRoot(previousChainRoot, canonicalBlockHash);

    // ─── STEP 3.5: RACE CONDITION REVALIDATION (PHASE 4 §14) ───
    const isGateStillOpen = await TransactionSecurityGate.revalidateBeforeCommit();
    if (!isGateStillOpen) {
      return {
        success: false,
        error: 'Transaction aborted: A blockchain security incident or freeze was triggered during execution.',
      };
    }

    // ─── STEP 4: SMART CONTRACT FIRST WRITE (PHASE 3 REQUIREMENT) ───
    let onChainTxHash: string | undefined = undefined;

    try {
      console.info(`[BlockchainWriteService] Phase 3 Contract-First Commit: Block #${nextBlockNumber}...`);
      const contractResult = await SmartContractService.commitBlock({
        blockNumber: nextBlockNumber,
        blockHash: canonicalBlockHash,
        previousHash,
        newChainRoot,
      });

      if (!contractResult.success) {
        console.error(`[BlockchainWriteService] Smart contract commit failed: ${contractResult.error}`);
        
        // If smart contract fails, block write MUST fail (unless EVM node is offline/unreachable in local/cloud mode)
        const isEvmOffline =
          contractResult.error?.includes('ECONNREFUSED') ||
          contractResult.error?.includes('could not detect network') ||
          contractResult.error?.includes('ENOTFOUND') ||
          contractResult.error?.includes('ETIMEDOUT') ||
          contractResult.error?.includes('fetch failed') ||
          contractResult.error?.includes('network error') ||
          contractResult.error?.includes('SERVER_ERROR') ||
          contractResult.error?.includes('TIMEOUT') ||
          contractResult.error?.includes('bad response');
        
        if (!isEvmOffline) {
          await SecurityAuditLogger.log({
            type: 'SMART_CONTRACT_COMMIT_FAILED',
            userId: intent.senderUid,
            resource: 'BlockchainWriteService',
            action: 'commitOnChain',
            result: 'DENIED',
            severity: 'HIGH',
            metadata: { error: contractResult.error, blockNumber: nextBlockNumber },
          });
          return {
            success: false,
            error: `On-Chain Smart Contract Commit Reverted: ${contractResult.error}`,
          };
        } else {
          console.warn('[BlockchainWriteService] EVM node offline or unreachable — continuing in offline fallback mode.');
        }
      } else {
        onChainTxHash = contractResult.txHash;
        console.info(`[BlockchainWriteService] ✓ On-Chain Smart Contract Commit Success! Tx: ${onChainTxHash}`);
      }
    } catch (err: any) {
      console.error('[BlockchainWriteService] Smart contract commit exception:', err);
    }

    // ─── STEP 5: FIRESTORE SECOND WRITE (ATOMIC ACCORDING TO CONTRACT STATE) ───
    let committedBlock: any = null;

    try {
      await adminDb.runTransaction(async (transaction) => {
        // Read Chain State again in transaction
        const chainStateSnap = await transaction.get(chainStateRef);
        if (!chainStateSnap.exists) {
          throw new Error('Global chain state missing in Firestore');
        }
        const chainState = chainStateSnap.data() as GlobalChainState;

        // Read Sender Wallet
        const senderWalletSnap = await transaction.get(senderWalletRef);
        let senderBalances = senderWalletSnap.exists
          ? senderWalletSnap.data()?.balances || { HSCT: 0, BTC: 0, ETH: 0 }
          : { HSCT: 0, BTC: 0, ETH: 0 };

        const currentSenderBalance = Number(senderBalances[resolvedCurrency] ?? senderBalances.HSCT ?? 0);

        if (intent.type === 'debit' || intent.type === 'transfer' || intent.type === 'trade') {
          if (currentSenderBalance < transferAmount) {
            throw new Error(`Insufficient funds: Required ${transferAmount} ${resolvedCurrency}, available ${currentSenderBalance} ${resolvedCurrency}`);
          }
          senderBalances = {
            ...senderBalances,
            [resolvedCurrency]: Math.max(0, currentSenderBalance - transferAmount),
          };

          if (intent.type === 'trade' && intent.tradeAsset && intent.tradeAmount) {
            const assetKey = intent.tradeAsset.toUpperCase();
            senderBalances[assetKey] = (Number(senderBalances[assetKey]) || 0) + Number(intent.tradeAmount);
          }
        } else if (intent.type === 'credit') {
          senderBalances = {
            ...senderBalances,
            [resolvedCurrency]: currentSenderBalance + transferAmount,
            lifetimeDeposited: (Number(senderBalances.lifetimeDeposited) || 0) + transferAmount,
          };
        }

        let receiverBalances: any = null;
        if (receiverWalletRef) {
          const receiverWalletSnap = await transaction.get(receiverWalletRef);
          if (receiverWalletSnap.exists) {
            const data = receiverWalletSnap.data();
            receiverBalances = data?.balances || { HSCT: 0, BTC: 0, ETH: 0 };
            receiverBalances = {
              ...receiverBalances,
              [resolvedCurrency]: (Number(receiverBalances[resolvedCurrency]) || 0) + transferAmount,
              lifetimeDeposited: (Number(receiverBalances.lifetimeDeposited) || 0) + (resolvedCurrency === 'HSCT' ? transferAmount : 0),
            };
          }
        }

        committedBlock = {
          id: blockDocId,
          applicationTransactionId: blockDocId,
          userId: intent.senderUid,
          sender: intent.senderAddress,
          receiver: intent.receiverAddress,
          amount: transferAmount,
          currency: resolvedCurrency,
          asset: resolvedCurrency,
          type: intent.type,
          status: 'CONFIRMED',
          date: serverTimeISO,
          createdAt: serverTimeISO,
          confirmedAt: serverTimeISO,
          description: intent.description || `${intent.type.toUpperCase()}: ${transferAmount.toLocaleString()} ${resolvedCurrency}`,
          idempotencyKey: intent.idempotencyKey || blockDocId,
          canonicalPayload: intent.canonicalPayload || '',
          transactionHash: canonicalBlockHash,
          hash: canonicalBlockHash,
          previousHash,
          chainRoot: newChainRoot,
          onChainTxHash: onChainTxHash || null,
          blockNumber: nextBlockNumber,
          walletAddress: intent.senderAddress,
          senderPublicKey: intent.senderPublicKey || '',
          digitalSignature: intent.signature || '',
          signature: intent.signature || '',
          difficulty: 2,
          nonce: Math.floor(Math.random() * 1000000),
          blockSize: 512,
          payload: {
            note: intent.note || '',
            senderUid: intent.senderUid,
            receiverUid: targetReceiverUid,
            tradeAsset: intent.tradeAsset || null,
            tradeAmount: intent.tradeAmount || null,
          },
        };

        const updatedChainState: GlobalChainState = {
          lastBlockNumber: nextBlockNumber,
          lastBlockHash: canonicalBlockHash,
          genesisHash: chainState.genesisHash,
          chainRoot: newChainRoot,
          chainId: 31337,
          chainVersion: 1,
          totalBlocks: (chainState.totalBlocks || 1) + 1,
          lastUpdatedAt: serverTimeISO,
        };

        transaction.set(globalBlockRef, committedBlock);
        transaction.set(chainStateRef, updatedChainState);
        transaction.set(senderWalletRef, { balances: senderBalances }, { merge: true });
        transaction.set(senderTxRef, {
          ...committedBlock,
          type: intent.type === 'credit' ? 'credit' : 'debit',
        });

        if (receiverWalletRef && receiverBalances && receiverTxRef) {
          transaction.set(receiverWalletRef, { balances: receiverBalances }, { merge: true });
          transaction.set(receiverTxRef, {
            ...committedBlock,
            type: 'credit',
            description: `Received ${transferAmount.toLocaleString()} ${resolvedCurrency}`,
          });
        }
      });

      await SecurityAuditLogger.log({
        type: 'TRUSTED_BLOCK_COMMITTED',
        userId: intent.senderUid,
        resource: 'BlockchainWriteService',
        action: 'commitBlock',
        result: 'COMMITTED',
        severity: 'LOW',
        metadata: {
          blockNumber: committedBlock.blockNumber,
          blockHash: committedBlock.hash,
          chainRoot: committedBlock.chainRoot,
          onChainTxHash: onChainTxHash || null,
          amount: transferAmount,
          currency: resolvedCurrency,
          sender: intent.senderAddress,
          receiver: intent.receiverAddress,
        },
      });

      return { success: true, block: committedBlock, onChainTxHash };
    } catch (err: any) {
      console.error('[BlockchainWriteService] Firestore transaction failure:', err.message);

      // If smart contract was committed on-chain, but Firestore failed, record pending reconciliation!
      if (onChainTxHash) {
        await BlockchainReconciliationService.recordPendingReconciliation({
          blockNumber: nextBlockNumber,
          blockHash: canonicalBlockHash,
          txHash: onChainTxHash,
          errorReason: `Firestore write failed: ${err.message}`,
        });
      }

      await SecurityAuditLogger.log({
        type: 'UNAUTHORIZED_WRITE_ATTEMPT',
        userId: intent.senderUid,
        resource: 'BlockchainWriteService',
        action: 'executeTransaction',
        result: 'DENIED',
        severity: 'MEDIUM',
        metadata: { error: err.message },
      });

      return { success: false, error: err.message || 'Atomic transaction failed to commit.' };
    }
  }
}
