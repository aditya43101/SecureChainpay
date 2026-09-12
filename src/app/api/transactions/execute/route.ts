import { NextResponse } from 'next/server';
import { requireFirebaseUser, FirebaseAuthenticationError } from '@/lib/auth/require-firebase-user';
import { BlockchainWriteService } from '@/lib/blockchain/blockchain-write-service';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';
import { getAdminDb } from '@/lib/firebase/admin';
import { TransactionSecurityGate } from '@/lib/security/transaction-security-gate';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let authUser: any = null;
  try {
    // 0. Enforce Global Transaction Security Gate (Phase 4 §13)
    const gateCheck = await TransactionSecurityGate.canProcessTransaction();
    if (!gateCheck.allowed) {
      await SecurityAuditLogger.log({
        type: 'UNAUTHORIZED_WRITE_ATTEMPT',
        userId: 'ANONYMOUS',
        resource: '/api/transactions/execute',
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

    // 1. Enforce Server-Side Authentication
    try {
      authUser = await requireFirebaseUser(request);
    } catch (authErr: any) {
      await SecurityAuditLogger.log({
        type: 'AUTH_FAILURE',
        userId: 'ANONYMOUS',
        resource: '/api/transactions/execute',
        action: 'authenticate',
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
      amount,
      currency = 'HSCT',
      type = 'trade',
      description,
      idempotencyKey,
      tradeAsset,
      tradeAmount,
      canonicalPayload,
      signature,
      note,
      receiverAddress: rawReceiverAddress,
      // Intentionally ignore any client-supplied blockNumber, blockHash, previousHash, status, balance
    } = body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      await SecurityAuditLogger.log({
        type: 'INVALID_PAYLOAD',
        userId: authUser.uid,
        resource: '/api/transactions/execute',
        action: 'validatePayload',
        result: 'DENIED',
        severity: 'MEDIUM',
        metadata: { reason: 'Invalid or negative amount', amount },
      });
      return NextResponse.json(
        { success: false, error: 'Transaction amount must be a non-negative number' },
        { status: 400 }
      );
    }

    // 2. Fetch Authoritative Sender Wallet from Firestore via Admin DB
    const adminDb = getAdminDb();
    const senderWalletDoc = await adminDb
      .collection('users')
      .doc(authUser.uid)
      .collection('wallet')
      .doc('data')
      .get();

    if (!senderWalletDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Sender wallet not found. Please initialize wallet first.' },
        { status: 404 }
      );
    }

    const senderWalletData = senderWalletDoc.data();
    const senderAddress = senderWalletData?.address;

    if (!senderAddress) {
      return NextResponse.json(
        { success: false, error: 'Sender wallet address not registered' },
        { status: 400 }
      );
    }

    const receiverAddress = rawReceiverAddress || '0x0000000000000000000000000000000000000000';
    const txDocId = `TX_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 3. Delegate to Authoritative BlockchainWriteService
    const result = await BlockchainWriteService.executeTrustedTransaction({
      applicationTransactionId: txDocId,
      senderUid: authUser.uid,
      senderAddress,
      receiverAddress,
      amount: parsedAmount,
      currency,
      type: type as any,
      description,
      idempotencyKey: idempotencyKey || txDocId,
      canonicalPayload,
      signature,
      senderPublicKey: senderWalletData?.publicKey,
      tradeAsset,
      tradeAmount: tradeAmount ? Number(tradeAmount) : undefined,
      note,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Transaction execution failed' },
        { status: 400 }
      );
    }

    // Fetch updated authoritative balances
    const updatedWalletDoc = await adminDb
      .collection('users')
      .doc(authUser.uid)
      .collection('wallet')
      .doc('data')
      .get();
    const updatedBalances = updatedWalletDoc.data()?.balances;

    return NextResponse.json({
      success: true,
      block: result.block,
      transaction: result.block,
      balances: updatedBalances,
      replayed: result.replayed || false,
    });
  } catch (err: any) {
    console.error('[API /api/transactions/execute] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
