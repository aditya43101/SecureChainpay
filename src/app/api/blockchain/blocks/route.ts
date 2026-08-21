import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const adminDb = getAdminDb();
    const snap = await adminDb
      .collection('global_blocks')
      .orderBy('blockNumber', 'desc')
      .get();

    const blocks: any[] = [];
    snap.forEach((doc) => {
      blocks.push(doc.data());
    });

    return NextResponse.json({
      success: true,
      blocks,
      count: blocks.length,
    });
  } catch (error: any) {
    console.error('[API /api/blockchain/blocks] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch global blocks' },
      { status: 500 }
    );
  }
}
