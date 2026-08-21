import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { ethers } from 'ethers';
import { submitTransactionToLedger } from '@/lib/blockchain/hybrid-ledger';
import { generateHash } from '@/stores/wallet-store';
import type { Transaction } from '@/stores/wallet-store';

export const dynamic = 'force-dynamic';

export interface GlobalChainState {
  lastBlockNumber: number;
  lastBlockHash: string;
  genesisHash: string;
  totalBlocks: number;
  lastUpdatedAt: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      applicationTransactionId,
      senderUid,
      senderAddress,
      receiverUid,
      receiverAddress,
      receiverUsername,
      receiverDisplayName,
      amount,
      currency = 'USD',
      canonicalPayload,
      signature,
      idempotencyKey,
      note,
    } = body;

    // ─── 1. STRICT VALIDATIONS ───
    if (!applicationTransactionId || !senderUid || !senderAddress || !receiverUid || !receiverAddress || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required transfer fields' },
        { status: 400 }
      );
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Transfer amount must be a positive number' },
        { status: 400 }
      );
    }

    // Self-transfer prevention
    if (
      senderUid === receiverUid ||
      senderAddress.toLowerCase() === receiverAddress.toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: 'You cannot send money to your own wallet.' },
        { status: 400 }
      );
    }

    // Cryptographic Signature Verification
    if (canonicalPayload && signature) {
      try {
        const recovered = ethers.verifyMessage(canonicalPayload, signature);
        if (recovered.toLowerCase() !== senderAddress.toLowerCase()) {
          return NextResponse.json(
            { success: false, error: `Cryptographic signature mismatch: recovered (${recovered}) does not match sender (${senderAddress})` },
            { status: 401 }
          );
        }
      } catch (sigErr: any) {
        return NextResponse.json(
          { success: false, error: `Invalid cryptographic signature: ${sigErr.message}` },
          { status: 400 }
        );
      }
    }

    const adminDb = getAdminDb();
    const serverTimeISO = new Date().toISOString();

    const senderWalletRef = adminDb.collection('users').doc(senderUid).collection('wallet').doc('data');
    const receiverWalletRef = adminDb.collection('users').doc(receiverUid).collection('wallet').doc('data');
    const chainStateRef = adminDb.collection('global_chain_meta').doc('chain_state');
    const globalBlockRef = adminDb.collection('global_blocks').doc(applicationTransactionId);
    const genesisRef = adminDb.collection('global_blocks').doc('GENESIS');

    const senderTxRef = adminDb.collection('users').doc(senderUid).collection('transactions').doc(applicationTransactionId);
    const receiverTxRef = adminDb.collection('users').doc(receiverUid).collection('transactions').doc(applicationTransactionId);

    let senderNewBalances: any = null;
    let receiverNewBalances: any = null;
    let finalBlock: Transaction | null = null;

    // ─── 2. ATOMIC FIRESTORE TRANSACTION (ACID) ───
    await adminDb.runTransaction(async (transaction) => {
      // 1. Read sender wallet
      const senderSnap = await transaction.get(senderWalletRef);
      if (!senderSnap.exists) {
        throw new Error('Sender wallet not found');
      }
      const senderData = senderSnap.data();
      const senderBalances = senderData?.balances || { USD: 0, BTC: 0, ETH: 0 };
      const currentSenderBalance = Number(senderBalances[currency] || 0);

      if (currentSenderBalance < transferAmount) {
        throw new Error(`Insufficient ${currency} balance. Available: $${currentSenderBalance.toFixed(2)}, Required: $${transferAmount.toFixed(2)}`);
      }

      // 2. Read receiver wallet
      const receiverSnap = await transaction.get(receiverWalletRef);
      if (!receiverSnap.exists) {
        throw new Error('Recipient wallet record not found');
      }
      const receiverData = receiverSnap.data();
      const receiverBalances = receiverData?.balances || { USD: 0, BTC: 0, ETH: 0 };

      // 3. Read chain state
      let chainStateSnap = await transaction.get(chainStateRef);
      let chainState: GlobalChainState;

      if (!chainStateSnap.exists) {
        const genesisTimeISO = '1970-01-01T00:00:00.000Z';
        const genesisHash = await generateHash('genesis:securechainpay:global:v1');

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
          date: genesisTimeISO,
          createdAt: genesisTimeISO,
          confirmedAt: genesisTimeISO,
          description: 'SecureChain Pay — Global Genesis Block',
          payload: { message: 'SecureChain Global Blockchain Initialized' },
          difficulty: 1,
          nonce: 0,
          blockSize: 256,
        };

        chainState = {
          lastBlockNumber: 0,
          lastBlockHash: genesisHash,
          genesisHash: genesisHash,
          totalBlocks: 1,
          lastUpdatedAt: new Date().toISOString(),
        };

        transaction.set(genesisRef, genesisBlock);
        transaction.set(chainStateRef, chainState);
      } else {
        chainState = chainStateSnap.data() as GlobalChainState;
      }

      // Check idempotency
      const existingBlock = await transaction.get(globalBlockRef);
      if (existingBlock.exists) {
        finalBlock = existingBlock.data() as Transaction;
        return;
      }

      // Compute sequential block linkage
      const globalBlockNumber = (chainState.lastBlockNumber || 0) + 1;
      const globalPreviousHash = chainState.lastBlockHash || '0x0000000000000000000000000000000000000000000000000000000000000000';

      const hashString = `${globalPreviousHash}${globalBlockNumber}${senderAddress}${receiverAddress}${transferAmount}${serverTimeISO}trade`;
      const globalBlockHash = await generateHash(hashString);
      const canonicalHash = await generateHash(canonicalPayload || hashString);

      // Perform atomic balance calculation
      senderNewBalances = {
        ...senderBalances,
        [currency]: currentSenderBalance - transferAmount,
      };

      receiverNewBalances = {
        ...receiverBalances,
        [currency]: Number(receiverBalances[currency] || 0) + transferAmount,
      };

      // Construct global block record
      finalBlock = {
        id: applicationTransactionId,
        applicationTransactionId,
        userId: senderUid,
        sender: senderAddress,
        receiver: receiverAddress,
        amount: transferAmount,
        currency,
        asset: currency,
        type: 'trade',
        status: 'SUBMITTED',
        date: serverTimeISO,
        createdAt: serverTimeISO,
        submittedAt: serverTimeISO,
        description: note || `Transfer to ${receiverDisplayName || receiverUsername || receiverAddress.substring(0, 10)}`,
        idempotencyKey: idempotencyKey || `idemp_${Date.now()}`,

        canonicalPayload: canonicalPayload || '',
        transactionHash: canonicalHash,
        hash: globalBlockHash,
        previousHash: globalPreviousHash,
        walletAddress: senderAddress,
        senderPublicKey: senderData?.publicKey || senderAddress,
        digitalSignature: signature || '',
        signature: signature || '',

        blockNumber: globalBlockNumber,
        payload: {
          note: note || '',
          senderUid,
          receiverUid,
          receiverUsername: receiverUsername || '',
          receiverDisplayName: receiverDisplayName || '',
        },
        difficulty: 2,
        nonce: Math.floor(Math.random() * 1000000),
        blockSize: 512,
      };

      const updatedChainState: GlobalChainState = {
        lastBlockNumber: globalBlockNumber,
        lastBlockHash: globalBlockHash,
        genesisHash: chainState.genesisHash || globalPreviousHash,
        totalBlocks: (chainState.totalBlocks || 1) + 1,
        lastUpdatedAt: serverTimeISO,
      };

      // 1. Update sender balance
      transaction.update(senderWalletRef, { balances: senderNewBalances });

      // 2. Update receiver balance
      transaction.update(receiverWalletRef, { balances: receiverNewBalances });

      // 3. Write global block
      transaction.set(globalBlockRef, finalBlock);

      // 4. Update chain state
      transaction.set(chainStateRef, updatedChainState);

      // 5. Write sender's transaction index (debit)
      const senderTxRecord = {
        ...finalBlock,
        type: 'debit' as const,
        description: `Sent $${transferAmount.toFixed(2)} to ${receiverDisplayName || receiverUsername || receiverAddress.substring(0, 8)}`,
      };
      transaction.set(senderTxRef, senderTxRecord);

      // 6. Write recipient's transaction index (credit)
      const receiverTxRecord = {
        ...finalBlock,
        type: 'credit' as const,
        description: `Received $${transferAmount.toFixed(2)} from ${senderData?.displayName || senderData?.username || senderAddress.substring(0, 8)}`,
      };
      transaction.set(receiverTxRef, receiverTxRecord);
    });

    if (!finalBlock) {
      return NextResponse.json(
        { success: false, error: 'Atomic transfer transaction failed to commit.' },
        { status: 500 }
      );
    }

    // ─── 3. REAL SMART CONTRACT SUBMISSION (EVM ANCHORING) ───
    let blockchainTransactionHash: string | null = null;
    let evmBlockNumber: number | null = null;
    let blockHash: string | null = null;
    let chainId: number = 31337;
    let contractAddress: string | null = null;

    try {
      const submissionResult = await submitTransactionToLedger({
        applicationTransactionId,
        sender: senderAddress,
        receiver: receiverAddress,
        amount: transferAmount,
        currency: currency.toUpperCase(),
      });

      if (submissionResult.success && submissionResult.blockchainTransactionHash) {
        blockchainTransactionHash = submissionResult.blockchainTransactionHash;
        evmBlockNumber = submissionResult.blockNumber ?? null;
        blockHash = submissionResult.blockHash || null;
        chainId = submissionResult.chainId || 31337;
        contractAddress = submissionResult.contractAddress || null;

        const confirmedFields = {
          status: 'CONFIRMED',
          blockchainTransactionHash,
          blockHash,
          chainId,
          contractAddress,
          confirmedAt: new Date().toISOString(),
        };

        // Update all Firestore records with confirmed on-chain proof
        await Promise.all([
          globalBlockRef.set(confirmedFields, { merge: true }),
          senderTxRef.set(confirmedFields, { merge: true }),
          receiverTxRef.set(confirmedFields, { merge: true }),
        ]);

        finalBlock = {
          ...(finalBlock as Transaction),
          status: 'CONFIRMED',
          blockchainTransactionHash,
          blockHash,
          chainId,
          contractAddress,
          confirmedAt: confirmedFields.confirmedAt,
        };
      }
    } catch (chainErr) {
      console.warn('[API /api/wallet/transfer] Smart contract submission warning:', chainErr);
    }

    return NextResponse.json({
      success: true,
      transaction: finalBlock,
      senderBalances: senderNewBalances,
      blockchainTransactionHash,
      evmBlockNumber,
    });
  } catch (error: any) {
    console.error('[API /api/wallet/transfer] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Transfer failed' },
      { status: 500 }
    );
  }
}
