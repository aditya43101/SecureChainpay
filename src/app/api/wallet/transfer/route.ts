import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { ethers } from 'ethers';
import { submitTransactionToLedger } from '@/lib/blockchain/hybrid-ledger';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';
import { BlockchainWriteService } from '@/lib/blockchain/blockchain-write-service';
import { PaymentContinuityService } from '@/lib/payments/continuity-service';
import { PaymentRetryEngine } from '@/lib/payments/retry-engine';
import { TransactionSecurityGate } from '@/lib/security/transaction-security-gate';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let intentId = '';
  let authUser: any = null;

  try {
    // ─── -1. GLOBAL TRANSACTION SECURITY GATE (PHASE 4 §13) ───
    const gateCheck = await TransactionSecurityGate.canProcessTransaction();
    if (!gateCheck.allowed) {
      await SecurityAuditLogger.log({
        type: 'UNAUTHORIZED_WRITE_ATTEMPT',
        userId: 'ANONYMOUS',
        resource: '/api/wallet/transfer',
        action: 'securityGate',
        result: 'DENIED',
        severity: 'HIGH',
        metadata: { gateDecision: gateCheck.code, reason: gateCheck.reason },
      });
      return NextResponse.json(
        {
          success: false,
          error: gateCheck.reason || 'Blockchain transactions are temporarily paused while ledger integrity is being verified.',
          code: gateCheck.code,
        },
        { status: 403 }
      );
    }

    // ─── 0. MANDATORY SERVER-SIDE AUTHENTICATION ───
    try {
      authUser = await requireFirebaseUser(request);
    } catch (authErr: any) {
      await SecurityAuditLogger.log({
        type: 'AUTH_FAILURE',
        userId: 'ANONYMOUS',
        resource: '/api/wallet/transfer',
        action: 'transferFunds',
        result: 'DENIED',
        severity: 'HIGH',
        metadata: { error: authErr.message },
      });
      return NextResponse.json(
        { success: false, error: authErr.message || 'Authentication required' },
        { status: authErr.status || 401 }
      );
    }

    const body = await request.json();
    const {
      applicationTransactionId,
      senderUid: clientSenderUid,
      senderAddress: clientSenderAddress,
      receiverUid,
      receiverAddress,
      receiverUsername,
      receiverDisplayName,
      amount,
      currency = 'HSCT',
      canonicalPayload,
      signature,
      idempotencyKey,
      note,
    } = body;

    // ─── 1. STRICT AUTHORIZATION: FORCE SENDER UID TO AUTHENTICATED UID ───
    const senderUid = authUser.uid;
    if (clientSenderUid && clientSenderUid !== senderUid) {
      await SecurityAuditLogger.log({
        type: 'CROSS_USER_ACCESS_ATTEMPT',
        userId: senderUid,
        resource: 'wallet/transfer',
        action: 'transferFunds',
        result: 'DENIED',
        severity: 'CRITICAL',
        metadata: {
          clientSenderUid,
          actualSenderUid: senderUid,
        },
      });
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot initiate transfers on behalf of another user' },
        { status: 403 }
      );
    }

    if (!applicationTransactionId || !receiverAddress || !amount) {
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

    const adminDb = getAdminDb();

    // ─── 2. LOOKUP AUTHORITATIVE SENDER WALLET DATA ───
    const senderWalletSnap = await adminDb
      .collection('users')
      .doc(senderUid)
      .collection('wallet')
      .doc('data')
      .get();

    if (!senderWalletSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Sender wallet not initialized' },
        { status: 404 }
      );
    }

    const senderWalletData = senderWalletSnap.data();
    const authoritativeSenderAddress = senderWalletData?.address;

    if (!authoritativeSenderAddress) {
      return NextResponse.json(
        { success: false, error: 'Sender wallet address not found' },
        { status: 400 }
      );
    }

    // Auto-resolve receiverUid by wallet address if missing
    let targetReceiverUid = receiverUid || '';
    if (!targetReceiverUid && receiverAddress) {
      try {
        const usersSnap = await adminDb.collection('users').get();
        for (const uDoc of usersSnap.docs) {
          const wSnap = await uDoc.ref.collection('wallet').doc('data').get();
          if (wSnap.exists && wSnap.data()?.address?.toLowerCase() === receiverAddress.toLowerCase()) {
            targetReceiverUid = uDoc.id;
            break;
          }
        }
      } catch (lookupErr) {
        console.warn('[API /api/wallet/transfer] Recipient UID lookup warning:', lookupErr);
      }
    }

    // ─── 3. CRYPTOGRAPHIC SIGNATURE CHECK ───
    if (canonicalPayload && signature) {
      try {
        const recovered = ethers.verifyMessage(canonicalPayload, signature);
        if (recovered.toLowerCase() !== authoritativeSenderAddress.toLowerCase()) {
          await SecurityAuditLogger.log({
            type: 'SIGNATURE_MISMATCH',
            userId: senderUid,
            resource: '/api/wallet/transfer',
            action: 'verifySignature',
            result: 'DENIED',
            severity: 'CRITICAL',
            metadata: {
              expectedSender: authoritativeSenderAddress,
              recoveredAddress: recovered,
            },
          });
          return NextResponse.json(
            { success: false, error: 'Cryptographic signature mismatch' },
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

    const resolvedIdempotencyKey = idempotencyKey || applicationTransactionId;

    // ─── 4. SAGA INTENT CREATION ───
    const { isNew, intent } = await PaymentContinuityService.createIntent({
      userId: senderUid,
      sender: authoritativeSenderAddress,
      recipient: receiverAddress,
      amount: transferAmount,
      currency,
      idempotencyKey: resolvedIdempotencyKey,
    });

    intentId = intent.id;

    if (!isNew) {
      if (['CONFIRMED', 'PROCESSING', 'BROADCASTING', 'BROADCAST_UNKNOWN'].includes(intent.status)) {
        return NextResponse.json({
          success: true,
          message: 'Payment already in progress or completed.',
          status: intent.status,
          intentId: intent.id,
        });
      }
    }

    await PaymentContinuityService.transitionState(intent.id, 'QUEUED', 'Validations passed. Queued for execution.');
    await PaymentContinuityService.transitionState(intent.id, 'PROCESSING', 'Starting off-chain database transactions.');

    // ─── 5. ATOMIC WRITE VIA AUTHORITATIVE BLOCKCHAIN WRITE SERVICE ───
    const trustedResult = await BlockchainWriteService.executeTrustedTransaction({
      applicationTransactionId,
      senderUid,
      senderAddress: authoritativeSenderAddress,
      receiverAddress,
      receiverUid: targetReceiverUid || null,
      receiverUsername,
      amount: transferAmount,
      currency,
      type: 'transfer',
      description: note || `Transfer of ${transferAmount.toLocaleString()} ${currency}`,
      idempotencyKey: resolvedIdempotencyKey,
      canonicalPayload,
      signature,
      senderPublicKey: senderWalletData?.publicKey,
      note,
    });

    if (!trustedResult.success || !trustedResult.block) {
      await PaymentContinuityService.logFailure(intent.id, null, 'DATABASE_FAILURE', false, 'HIGH').catch(() => {});
      await PaymentContinuityService.transitionState(intent.id, 'FAILED', trustedResult.error || 'Ledger write failed').catch(() => {});
      return NextResponse.json(
        { success: false, error: trustedResult.error || 'Database transaction error' },
        { status: 400 }
      );
    }

    let finalBlock = trustedResult.block;

    // Read updated sender balances from Firestore
    const updatedSenderWalletSnap = await adminDb
      .collection('users')
      .doc(senderUid)
      .collection('wallet')
      .doc('data')
      .get();
    const senderNewBalances = updatedSenderWalletSnap.data()?.balances;

    // ─── 6. REAL SMART CONTRACT SUBMISSION (FAULT TOLERANT) ───
    const execution = await PaymentContinuityService.createExecutionAttempt(intent.id, 'EVM_HYBRID_LEDGER').catch(() => ({ id: 'exec_default' }));
    let blockchainTransactionHash: string | null = null;
    let evmBlockNumber: number | null = null;

    try {
      const submissionResult = await submitTransactionToLedger({
        applicationTransactionId,
        sender: authoritativeSenderAddress,
        receiver: receiverAddress,
        amount: transferAmount,
        currency: currency.toUpperCase(),
      });

      if (submissionResult.success && submissionResult.blockchainTransactionHash) {
        blockchainTransactionHash = submissionResult.blockchainTransactionHash;
        evmBlockNumber = submissionResult.blockNumber ?? null;

        await PaymentContinuityService.updateExecution(execution.id, {
          status: 'CONFIRMED',
          transactionHash: blockchainTransactionHash,
        }).catch(() => {});

        await PaymentRetryEngine.handleExecutionOutcome(intent.id, { type: 'SUCCESS', executionId: execution.id }).catch(() => {});

        const confirmedFields = {
          status: 'CONFIRMED',
          blockchainTransactionHash,
          blockHash: submissionResult.blockHash || null,
          chainId: submissionResult.chainId || 31337,
          contractAddress: submissionResult.contractAddress || null,
          confirmedAt: new Date().toISOString(),
        };

        const globalBlockRef = adminDb.collection('global_blocks').doc(applicationTransactionId);
        const senderTxRef = adminDb.collection('users').doc(senderUid).collection('transactions').doc(applicationTransactionId);
        const receiverTxRef = targetReceiverUid
          ? adminDb.collection('users').doc(targetReceiverUid).collection('transactions').doc(applicationTransactionId)
          : null;

        const confirmedPromises: Promise<any>[] = [
          globalBlockRef.set(confirmedFields, { merge: true }),
          senderTxRef.set(confirmedFields, { merge: true }),
        ];
        if (receiverTxRef) {
          confirmedPromises.push(receiverTxRef.set(confirmedFields, { merge: true }));
        }
        await Promise.all(confirmedPromises);

        finalBlock = Object.assign({}, finalBlock || {}, confirmedFields);
      } else {
        throw new Error(submissionResult.error || 'Blockchain submission returned false');
      }
    } catch (chainErr: any) {
      console.warn('[API /api/wallet/transfer] Smart contract submission warning:', chainErr);

      await PaymentContinuityService.updateExecution(execution.id, {
        status: 'UNKNOWN',
        error: chainErr.message,
      }).catch(() => {});

      const errorCode = chainErr?.message?.includes('timeout') ? 'RPC_TIMEOUT' : 'UNKNOWN';
      await PaymentRetryEngine.handleExecutionOutcome(intent.id, { type: 'UNKNOWN', code: errorCode, executionId: execution.id }).catch(() => {});

      return NextResponse.json(
        {
          success: true,
          message: 'Payment recorded, but blockchain confirmation is delayed. Do not resend.',
          transaction: finalBlock,
          status: 'BROADCAST_UNKNOWN',
          intentId: intent.id,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: finalBlock,
      senderBalances: senderNewBalances,
      blockchainTransactionHash,
      evmBlockNumber,
      intentId: intent.id,
    });
  } catch (error: any) {
    console.error('[API /api/wallet/transfer] Error:', error);
    if (intentId) {
      await PaymentContinuityService.transitionState(intentId, 'FAILED', `Unexpected error: ${error.message}`).catch(() => {});
    }
    return NextResponse.json(
      { success: false, error: error?.message || 'Transfer failed' },
      { status: 400 }
    );
  }
}
