import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await context.params;
    if (!txId) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    const body = await request.json();
    const { status, source } = body as { status: string; source?: string };

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const updateData: Record<string, string> = {
      reconciliationStatus: status,
      updatedAt: new Date().toISOString(),
    };
    if (source) {
      updateData.reconciliationSource = source;
    }

    // Update in global_blocks
    await adminDb.collection('global_blocks').doc(txId).set(updateData, { merge: true });

    // Also try to update in users collection (search by appId)
    // Since we don't have userId here, update via global_blocks is primary
    // The UI will show the updated status from local state anyway

    return NextResponse.json({ success: true, txId, status });
  } catch (err: any) {
    console.error('[Reconcile API] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
