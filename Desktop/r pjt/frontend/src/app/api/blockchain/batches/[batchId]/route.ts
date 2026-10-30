import { NextResponse } from 'next/server';
import { MERKLE_BATCHES_DATA } from '@/lib/merkleBatchesData';

export async function GET(
  request: Request,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;
    const batch = MERKLE_BATCHES_DATA.batches.find(
      (b) => b.id === batchId || b.batchIdentifier === batchId || b.batchIdHex === batchId
    );

    if (!batch) {
      return NextResponse.json(
        { success: false, error: `Batch '${batchId}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: batch,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch batch' },
      { status: 500 }
    );
  }
}

