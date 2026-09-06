import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;

    if (!requestId) {
      return NextResponse.json({ success: false, error: 'Request ID is required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const reqDoc = await adminDb.collection('global_payment_requests').doc(requestId).get();

    if (!reqDoc.exists) {
      return NextResponse.json({ success: false, error: 'Payment request not found' }, { status: 404 });
    }

    const data = reqDoc.data();
    const now = new Date();

    // Check expiration if set
    let status = data?.status || 'PENDING';
    if (status === 'PENDING' && data?.expiresAt && new Date(data.expiresAt) < now) {
      status = 'EXPIRED';
      // Update DB lazily
      await adminDb.collection('global_payment_requests').doc(requestId).set({ status: 'EXPIRED' }, { merge: true }).catch(() => {});
    }

    const requestData = {
      ...data,
      status,
      isPayable: status === 'PENDING',
    };

    return NextResponse.json({
      success: true,
      request: requestData,
    });
  } catch (error: any) {
    console.error('[API /api/payments/request/[id] GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch payment request' },
      { status: 500 }
    );
  }
}
