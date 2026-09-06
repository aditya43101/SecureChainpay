import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { ethers } from 'ethers';
import { submitTransactionToLedger } from '@/lib/blockchain/hybrid-ledger';
import { generateHash } from '@/stores/wallet-store';
import type { Transaction } from '@/stores/wallet-store';
import { PaymentContinuityService } from '@/lib/payments/continuity-service';
import { PaymentRetryEngine } from '@/lib/payments/retry-engine';

export const dynamic = 'force-dynamic';

export interface GlobalChainState {
  lastBlockNumber: number;
  lastBlockHash: string;
  genesisHash: string;
  totalBlocks: number;
  lastUpdatedAt: string;
}

export async function POST(request: Request) {
  let intentId = '';
  
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
      return NextResponse.json({ success: false, error: 'Missing required transfer fields' }, { status: 400 });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Transfer amount must be a positive number' }, { status: 400 });
    }

    if (senderUid === receiverUid || senderAddress.toLowerCase() === receiverAddress.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'You cannot send money to your own wallet.' }, { status: 400 });
    }

    if (canonicalPayload && signature) {
      try {
        const recovered = ethers.verifyMessage(canonicalPayload, signature);
        if (recovered.toLowerCase() !== senderAddress.toLowerCase()) {
          return NextResponse.json({ success: false, error: `Cryptographic signature mismatch` }, { status: 401 });
        }
      } catch (sigErr: any) {
        return NextResponse.json({ success: false, error: `Invalid cryptographic signature: ${sigErr.message}` }, { status: 400 });
      }
    }

    const resolvedIdempotencyKey = idempotencyKey || applicationTransactionId;

    // ─── 2. CREATE PAYMENT INTENT (IDEMPOTENCY & SAGA) ───
    const { isNew, intent } = await PaymentContinuityService.createIntent({
      userId: senderUid,
      sender: senderAddress,
      recipient: receiverAddress,
      amount: transferAmount,
      currency,
      idempotencyKey: resolvedIdempotencyKey,
    });

    intentId = intent.id;

    if (!isNew) {
      // Idempotency hit.
      if (['CONFIRMED', 'PROCESSING', 'BROADCASTING', 'BROADCAST_UNKNOWN'].includes(intent.status)) {
        return NextResponse.json({
          success: true,
          message: 'Payment already in progress or completed.',
          status: intent.status,
          intentId: intent.id
        });
      }
    }

    await PaymentContinuityService.transitionState(intent.id, 'QUEUED', 'Validations passed. Queued for execution.');
    await PaymentContinuityService.transitionState(intent.id, 'PROCESSING', 'Starting off-chain database transactions.');

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
    let finalBlock: any = null;

    // ─── 3. ATOMIC FIRESTORE TRANSACTION (ACID) ───
    try {
      await adminDb.runTransaction(async (transaction) => {
        const senderSnap = await transaction.get(senderWalletRef);
        if (!senderSnap.exists) throw new Error('Sender wallet not found');
        const senderData = senderSnap.data();
        const senderBalances = senderData?.balances || { USD: 0, BTC: 0, ETH: 0 };
        const currentSenderBalance = Number(senderBalances[currency] || 0);

        if (currentSenderBalance < transferAmount) {
          throw new Error(`Insufficient ${currency} balance. Available: $${currentSenderBalance.toFixed(2)}, Required: $${transferAmount.toFixed(2)}`);
        }

        const receiverSnap = await transaction.get(receiverWalletRef);
        if (!receiverSnap.exists) throw new Error('Recipient wallet record not found');
        const receiverData = receiverSnap.data();
        const receiverBalances = receiverData?.balances || { USD: 0, BTC: 0, ETH: 0 };

        let chainStateSnap = await transaction.get(chainStateRef);
        let chainState: GlobalChainState;

        if (!chainStateSnap.exists) {
          const genesisTimeISO = '1970-01-01T00:00:00.000Z';
          const genesisHash = await generateHash('genesis:securechainpay:global:v1');
          
          // Genesis Block logic simplified for brevity ...
          chainState = { lastBlockNumber: 0, lastBlockHash: genesisHash, genesisHash: genesisHash, totalBlocks: 1, lastUpdatedAt: serverTimeISO };
          transaction.set(chainStateRef, chainState);
        } else {
          chainState = chainStateSnap.data() as GlobalChainState;
        }

        const existingBlock = await transaction.get(globalBlockRef);
        if (existingBlock.exists) {
          finalBlock = existingBlock.data() as Transaction;
          return; // Already executed at DB level
        }

        const globalBlockNumber = (chainState.lastBlockNumber || 0) + 1;
        const globalPreviousHash = chainState.lastBlockHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
        const hashString = `${globalPreviousHash}${globalBlockNumber}${senderAddress}${receiverAddress}${transferAmount}${serverTimeISO}trade`;
        const globalBlockHash = await generateHash(hashString);
        const canonicalHash = await generateHash(canonicalPayload || hashString);

        senderNewBalances = { ...senderBalances, [currency]: currentSenderBalance - transferAmount };
        const receiverNewBalances = {
          ...receiverBalances,
          [currency]: Number(receiverBalances[currency] || 0) + transferAmount,
          lifetimeDeposited: Number(receiverBalances?.lifetimeDeposited ?? receiverBalances?.USD ?? 0) + (currency === 'USD' ? transferAmount : 0),
        };

        finalBlock = {
          id: applicationTransactionId, applicationTransactionId, userId: senderUid,
          sender: senderAddress, receiver: receiverAddress, amount: transferAmount,
          currency, asset: currency, type: 'trade', status: 'SUBMITTED',
          date: serverTimeISO, createdAt: serverTimeISO, submittedAt: serverTimeISO,
          description: note || `Transfer`, idempotencyKey: resolvedIdempotencyKey,
          canonicalPayload: canonicalPayload || '', transactionHash: canonicalHash, hash: globalBlockHash, previousHash: globalPreviousHash,
          walletAddress: senderAddress, senderPublicKey: senderData?.publicKey || senderAddress, digitalSignature: signature || '', signature: signature || '',
          blockNumber: globalBlockNumber, payload: { note: note || '', senderUid, receiverUid },
          difficulty: 2, nonce: Math.floor(Math.random() * 1000000), blockSize: 512,
        };

        const updatedChainState: GlobalChainState = {
          lastBlockNumber: globalBlockNumber, lastBlockHash: globalBlockHash, genesisHash: chainState.genesisHash || globalPreviousHash,
          totalBlocks: (chainState.totalBlocks || 1) + 1, lastUpdatedAt: serverTimeISO,
        };

        transaction.update(senderWalletRef, { balances: senderNewBalances });
        transaction.update(receiverWalletRef, { balances: receiverNewBalances });
        transaction.set(globalBlockRef, finalBlock);
        transaction.set(chainStateRef, updatedChainState);
        transaction.set(senderTxRef, { ...finalBlock, type: 'debit', description: `Sent $${transferAmount.toFixed(2)}` });
        transaction.set(receiverTxRef, { ...finalBlock, type: 'credit', description: `Received $${transferAmount.toFixed(2)}` });
      });
    } catch (dbErr: any) {
      await PaymentContinuityService.logFailure(intent.id, null, 'DATABASE_FAILURE', false, 'HIGH');
      await PaymentContinuityService.transitionState(intent.id, 'FAILED', `Database error: ${dbErr.message}`);
      return NextResponse.json({ success: false, error: dbErr.message }, { status: 500 });
    }

    if (!finalBlock) {
      await PaymentContinuityService.transitionState(intent.id, 'FAILED', 'Atomic transfer transaction failed to commit.');
      return NextResponse.json({ success: false, error: 'Atomic transfer transaction failed to commit.' }, { status: 500 });
    }

    // ─── 4. REAL SMART CONTRACT SUBMISSION (FAULT TOLERANT) ───
    const execution = await PaymentContinuityService.createExecutionAttempt(intent.id, 'EVM_HYBRID_LEDGER');
    let blockchainTransactionHash: string | null = null;
    let evmBlockNumber: number | null = null;

    try {
      const submissionResult = await submitTransactionToLedger({
        applicationTransactionId, sender: senderAddress, receiver: receiverAddress,
        amount: transferAmount, currency: currency.toUpperCase(),
      });

      if (submissionResult.success && submissionResult.blockchainTransactionHash) {
        blockchainTransactionHash = submissionResult.blockchainTransactionHash;
        evmBlockNumber = submissionResult.blockNumber ?? null;

        await PaymentContinuityService.updateExecution(execution.id, {
          status: 'CONFIRMED',
          transactionHash: blockchainTransactionHash
        });

        await PaymentRetryEngine.handleExecutionOutcome(intent.id, { type: 'SUCCESS', executionId: execution.id });

        const confirmedFields = {
          status: 'CONFIRMED', blockchainTransactionHash,
          blockHash: submissionResult.blockHash || null, chainId: submissionResult.chainId || 31337,
          contractAddress: submissionResult.contractAddress || null, confirmedAt: new Date().toISOString(),
        };

        await Promise.all([
          globalBlockRef.set(confirmedFields, { merge: true }),
          senderTxRef.set(confirmedFields, { merge: true }),
          receiverTxRef.set(confirmedFields, { merge: true }),
        ]);

        finalBlock = Object.assign({}, finalBlock || {}, confirmedFields);
      } else {
        throw new Error(submissionResult.error || 'Blockchain submission returned false');
      }
    } catch (chainErr: any) {
      console.warn('[API /api/wallet/transfer] Smart contract submission warning:', chainErr);
      
      // Assume timeout or unknown outcome. DO NOT mark as FAILED.
      await PaymentContinuityService.updateExecution(execution.id, {
        status: 'UNKNOWN',
        error: chainErr.message
      });

      const errorCode = chainErr.message.includes('timeout') ? 'RPC_TIMEOUT' : 'UNKNOWN';
      await PaymentRetryEngine.handleExecutionOutcome(intent.id, { type: 'UNKNOWN', code: errorCode, executionId: execution.id });

      // Return a 202 Accepted. The intent is saved and processing.
      return NextResponse.json({
        success: true,
        message: 'Payment recorded, but blockchain confirmation is delayed. Do not resend.',
        transaction: finalBlock,
        status: 'BROADCAST_UNKNOWN',
        intentId: intent.id
      }, { status: 202 });
    }

    return NextResponse.json({
      success: true,
      transaction: finalBlock,
      senderBalances: senderNewBalances,
      blockchainTransactionHash,
      evmBlockNumber,
      intentId: intent.id
    });
  } catch (error: any) {
    console.error('[API /api/wallet/transfer] Error:', error);
    if (intentId) {
      await PaymentContinuityService.transitionState(intentId, 'FAILED', `Unexpected error: ${error.message}`);
    }
    return NextResponse.json({ success: false, error: error?.message || 'Transfer failed' }, { status: 500 });
  }
}
