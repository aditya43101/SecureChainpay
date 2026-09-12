import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';
import { getAdminDb } from '@/lib/firebase/admin';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Enforce Server-Side Authentication
    let authUser: any;
    try {
      authUser = await requireFirebaseUser(request);
    } catch (authErr: any) {
      await SecurityAuditLogger.log({
        type: 'AUTH_FAILURE',
        userId: 'ANONYMOUS',
        resource: '/api/wallet/provision',
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
    const { address, publicKey, encryptedPrivateKey, algorithm, walletVersion, keyFingerprint } = body;

    if (!address || !publicKey || !encryptedPrivateKey) {
      return NextResponse.json(
        { success: false, error: 'Missing required wallet cryptographic parameters' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const walletRef = adminDb.collection('users').doc(authUser.uid).collection('wallet').doc('data');

    // 2. Atomic check: only provision if wallet does not exist
    let created = false;
    let existingData: any = null;

    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(walletRef);
      if (snap.exists) {
        existingData = snap.data();
        return;
      }

      const generatedAt = new Date().toISOString();
      const initData = {
        ownerUid: authUser.uid,
        address,
        publicKey,
        encryptedPrivateKey,
        keyGeneratedAt: generatedAt,
        algorithm: algorithm || 'ECDSA/secp256k1',
        walletVersion: walletVersion || '1.0',
        keyFingerprint: keyFingerprint || 'Verified',
        balances: {
          HSCT: 0,
          USD: 0,
          BTC: 0,
          ETH: 0,
          lifetimeDeposited: 0,
        },
      };

      transaction.set(walletRef, initData);
      created = true;
      existingData = initData;
    });

    if (created) {
      await SecurityAuditLogger.log({
        type: 'WALLET_PROVISIONED',
        userId: authUser.uid,
        resource: 'wallet/data',
        action: 'provision',
        result: 'COMMITTED',
        severity: 'LOW',
        metadata: { address, keyFingerprint },
      });
    }

    return NextResponse.json({
      success: true,
      created,
      wallet: existingData,
    });
  } catch (err: any) {
    console.error('[API /api/wallet/provision] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to provision wallet' },
      { status: 500 }
    );
  }
}
