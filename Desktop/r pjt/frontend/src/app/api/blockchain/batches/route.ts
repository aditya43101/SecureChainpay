import { NextResponse } from 'next/server';
import { MERKLE_BATCHES_DATA } from '@/lib/merkleBatchesData';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.toLowerCase();

    let allBatches = [...MERKLE_BATCHES_DATA.batches];

    if (status && status !== 'ALL') {
      allBatches = allBatches.filter((b) => b.status === status);
    }

    if (search) {
      allBatches = allBatches.filter(
        (b) =>
          b.batchIdentifier.toLowerCase().includes(search) ||
          b.merkleRoot.toLowerCase().includes(search) ||
          b.transactionHash?.toLowerCase().includes(search)
      );
    }

    const total = allBatches.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedBatches = allBatches.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: {
        batches: paginatedBatches,
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch batches' },
      { status: 500 }
    );
  }
}

