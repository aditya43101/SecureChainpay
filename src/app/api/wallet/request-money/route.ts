import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export interface PaymentRequestData {
  id: string;
  requestorUid: string;
  requestorUsername: string;
  requestorDisplayName: string;
  requesteeUid: string;
  requesteeUsername: string;
  requesteeDisplayName: string;
  amount: number;
  currency: string;
  note?: string;
  status: 'PENDING' | 'PAID' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestorUid, requesteeUid, amount, currency = 'USD', note } = body;

    if (!requestorUid || !requesteeUid || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    if (requestorUid === requesteeUid) {
      return NextResponse.json(
        { success: false, error: 'You cannot request money from yourself.' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const [requestorSnap, requesteeSnap] = await Promise.all([
      adminDb.collection('users').doc(requestorUid).get(),
      adminDb.collection('users').doc(requesteeUid).get(),
    ]);

    if (!requestorSnap.exists || !requesteeSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Requestor or recipient user account not found.' },
        { status: 404 }
      );
    }

    const requestorData = requestorSnap.data();
    const requesteeData = requesteeSnap.data();

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const requestData: PaymentRequestData = {
      id: requestId,
      requestorUid,
      requestorUsername: requestorData?.username || requestorUid.substring(0, 8),
      requestorDisplayName: requestorData?.displayName || requestorData?.name || 'SecureChain User',
      requesteeUid,
      requesteeUsername: requesteeData?.username || requesteeUid.substring(0, 8),
      requesteeDisplayName: requesteeData?.displayName || requesteeData?.name || 'SecureChain User',
      amount: Number(amount),
      currency,
      note: note || '',
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Store in requestor and requestee payment_requests subcollections
    await Promise.all([
      adminDb.collection('users').doc(requestorUid).collection('payment_requests').doc(requestId).set(requestData),
      adminDb.collection('users').doc(requesteeUid).collection('payment_requests').doc(requestId).set(requestData),
      adminDb.collection('global_payment_requests').doc(requestId).set(requestData),
    ]);

    return NextResponse.json({
      success: true,
      request: requestData,
    });
  } catch (error: any) {
    console.error('[API /api/wallet/request-money POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Payment request failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const requestsSnap = await adminDb.collection('users').doc(uid).collection('payment_requests').orderBy('createdAt', 'desc').limit(20).get();

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
    const { requestId, uid, action } = body; // action: 'DECLINE' | 'CANCEL'

    if (!requestId || !uid || !action) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const reqDoc = await adminDb.collection('global_payment_requests').doc(requestId).get();

    if (!reqDoc.exists) {
      return NextResponse.json({ success: false, error: 'Payment request not found' }, { status: 404 });
    }

    const reqData = reqDoc.data() as PaymentRequestData;
    const nowIso = new Date().toISOString();
    const newStatus = action === 'CANCEL' ? 'CANCELLED' : 'DECLINED';

    const updatedData = {
      ...reqData,
      status: newStatus,
      updatedAt: nowIso,
    };

    await Promise.all([
      adminDb.collection('global_payment_requests').doc(requestId).set(updatedData, { merge: true }),
      adminDb.collection('users').doc(reqData.requestorUid).collection('payment_requests').doc(requestId).set(updatedData, { merge: true }),
      adminDb.collection('users').doc(reqData.requesteeUid).collection('payment_requests').doc(requestId).set(updatedData, { merge: true }),
    ]);

    return NextResponse.json({
      success: true,
      request: updatedData,
    });
  } catch (error: any) {
    console.error('[API /api/wallet/request-money PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update payment request' },
      { status: 500 }
    );
  }
}
