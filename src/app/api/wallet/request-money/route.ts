import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export interface PaymentRequestData {
  id: string;
  requestId?: string;
  requestorUid: string;
  requestorUsername: string;
  requestorDisplayName: string;
  requestorWalletAddress?: string;
  receiverUserId?: string;
  receiverName?: string;
  receiverWalletAddress?: string;
  requesteeUid?: string;
  requesteeUsername?: string;
  requesteeDisplayName?: string;
  payerUserId?: string;
  payerWalletAddress?: string;
  amount: number;
  currency: string;
  asset?: string;
  network?: string;
  note?: string;
  memo?: string;
  status: 'PENDING' | 'PAID' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  paidTransactionId?: string | null;
  paidAt?: string | null;
  confirmedAt?: string | null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      requestorUid,
      requesteeUid,
      receiverWalletAddress,
      amount,
      currency = 'USD',
      asset,
      network = 'Ethereum',
      note,
      memo,
      expiresInHours = 48,
    } = body;

    if (!requestorUid || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Requestor UID and positive amount are required.' },
        { status: 400 }
      );
    }

    if (requesteeUid && requestorUid === requesteeUid) {
      return NextResponse.json(
        { success: false, error: 'You cannot request money from yourself.' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const requestorSnap = await adminDb.collection('users').doc(requestorUid).get();

    if (!requestorSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Requestor user account not found.' },
        { status: 404 }
      );
    }

    const requestorData = requestorSnap.data();

    // Fetch requestor wallet address if not explicitly passed
    let walletAddr = receiverWalletAddress || requestorData?.walletAddress;
    if (!walletAddr) {
      const walletSnap = await adminDb.collection('users').doc(requestorUid).collection('wallet').doc('data').get();
      if (walletSnap.exists) {
        walletAddr = walletSnap.data()?.address;
      }
    }

    let requesteeData: any = null;
    if (requesteeUid) {
      const snap = await adminDb.collection('users').doc(requesteeUid).get();
      if (snap.exists) requesteeData = snap.data();
    }

    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAtIso = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000).toISOString();
    const resolvedAsset = asset || currency;

    const requestData: PaymentRequestData = {
      id: requestId,
      requestId,
      requestorUid,
      requestorUsername: requestorData?.username ? `@${requestorData.username.replace(/^@/, '')}` : `@${requestorUid.substring(0, 8)}`,
      requestorDisplayName: requestorData?.displayName || requestorData?.firstName ? `${requestorData.firstName} ${requestorData.lastName || ''}`.trim() : 'SecureChain User',
      requestorWalletAddress: walletAddr || '',
      receiverUserId: requestorUid,
      receiverName: requestorData?.displayName || requestorData?.firstName || 'SecureChain User',
      receiverWalletAddress: walletAddr || '',
      requesteeUid: requesteeUid || undefined,
      requesteeUsername: requesteeData ? (requesteeData.username ? `@${requesteeData.username.replace(/^@/, '')}` : `@${requesteeUid.substring(0, 8)}`) : undefined,
      requesteeDisplayName: requesteeData?.displayName || requesteeData?.firstName || undefined,
      amount: Number(amount),
      currency: resolvedAsset,
      asset: resolvedAsset,
      network,
      note: note || memo || '',
      memo: memo || note || '',
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: expiresAtIso,
    };

    const writes: Promise<any>[] = [
      adminDb.collection('global_payment_requests').doc(requestId).set(requestData),
      adminDb.collection('users').doc(requestorUid).collection('payment_requests').doc(requestId).set(requestData),
    ];

    if (requesteeUid) {
      writes.push(
        adminDb.collection('users').doc(requesteeUid).collection('payment_requests').doc(requestId).set(requestData)
      );
    }

    await Promise.all(writes);

    return NextResponse.json({
      success: true,
      request: requestData,
    });
  } catch (error: any) {
    console.error('[API /api/wallet/request-money POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Payment request creation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const requestId = searchParams.get('requestId') || searchParams.get('id');

    const adminDb = getAdminDb();

    if (requestId) {
      const docSnap = await adminDb.collection('global_payment_requests').doc(requestId).get();
      if (!docSnap.exists) {
        return NextResponse.json({ success: false, error: 'Payment request not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, request: docSnap.data() });
    }

    if (!uid) {
      return NextResponse.json({ success: false, error: 'User ID or Request ID is required' }, { status: 400 });
    }

    const requestsSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('payment_requests')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const requests: PaymentRequestData[] = [];
    requestsSnap.forEach((doc) => {
      requests.push(doc.data() as PaymentRequestData);
    });

    return NextResponse.json({
      success: true,
      requests,
    });
  } catch (error: any) {
    console.error('[API /api/wallet/request-money GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch payment requests' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { requestId, uid, action, transactionId } = body; // action: 'CANCEL' | 'DECLINE' | 'PAID'

    if (!requestId || !action) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const reqDoc = await adminDb.collection('global_payment_requests').doc(requestId).get();

    if (!reqDoc.exists) {
      return NextResponse.json({ success: false, error: 'Payment request not found' }, { status: 404 });
    }

    const reqData = reqDoc.data() as PaymentRequestData;
    if (['PAID', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].includes(reqData.status) && action !== 'PAID') {
      return NextResponse.json(
        { success: false, error: `Payment request is already ${reqData.status}` },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    let newStatus: PaymentRequestData['status'] = 'CANCELLED';
    if (action === 'DECLINE') newStatus = 'DECLINED';
    else if (action === 'PAID') newStatus = 'PAID';

    const updatedData: Partial<PaymentRequestData> = {
      status: newStatus,
      updatedAt: nowIso,
      paidTransactionId: transactionId || reqData.paidTransactionId || null,
      paidAt: action === 'PAID' ? nowIso : reqData.paidAt || null,
      confirmedAt: action === 'PAID' ? nowIso : reqData.confirmedAt || null,
    };

    const writes: Promise<any>[] = [
      adminDb.collection('global_payment_requests').doc(requestId).set(updatedData, { merge: true }),
      adminDb.collection('users').doc(reqData.requestorUid).collection('payment_requests').doc(requestId).set(updatedData, { merge: true }),
    ];

    if (reqData.requesteeUid) {
      writes.push(
        adminDb.collection('users').doc(reqData.requesteeUid).collection('payment_requests').doc(requestId).set(updatedData, { merge: true })
      );
    }

    if (uid && uid !== reqData.requestorUid && uid !== reqData.requesteeUid) {
      writes.push(
        adminDb.collection('users').doc(uid).collection('payment_requests').doc(requestId).set({ ...reqData, ...updatedData }, { merge: true })
      );
    }

    await Promise.all(writes);

    return NextResponse.json({
      success: true,
      request: { ...reqData, ...updatedData },
    });
  } catch (error: any) {
    console.error('[API /api/wallet/request-money PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update payment request' },
      { status: 500 }
    );
  }
}
