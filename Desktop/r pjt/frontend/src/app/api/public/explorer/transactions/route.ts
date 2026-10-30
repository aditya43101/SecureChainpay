import { NextResponse } from 'next/server';
import { MERKLE_BATCHES_DATA } from '@/lib/merkleBatchesData';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '15', 10);
    const recordType = searchParams.get('recordType');
    const search = searchParams.get('search')?.toLowerCase();

    // Flatten transactions from all batches
    let allTx: any[] = [];
    for (const batch of MERKLE_BATCHES_DATA.batches) {
      if (Array.isArray(batch.records)) {
        for (const rec of batch.records) {
          allTx.push({
            id: rec.id || `tx-${batch.batchIdentifier}-${rec.leafIndex}`,
            txHash: batch.transactionHash,
            blockNumber: batch.blockNumber,
            recordType: rec.recordType,
            eventType: rec.recordType,
            recordHash: (rec as any).recordHash || batch.merkleRoot,
            network: 'Hardhat Local / EVM L2',
            status: batch.status,
            timestamp: batch.confirmedAt || batch.createdAt,
            passportId: (rec as any).passportId || 'VP-DEMO-001',
            vehicleSummary: (rec as any).vehicleSummary || 'Aurora X1 Sedan',
          });
        }
      }
    }

    if (recordType && recordType !== 'ALL') {
      allTx = allTx.filter((t) => t.recordType === recordType);
    }

    if (search) {
      allTx = allTx.filter(
        (t) =>
          t.txHash?.toLowerCase().includes(search) ||
          t.recordType?.toLowerCase().includes(search) ||
          t.passportId?.toLowerCase().includes(search) ||
          t.vehicleSummary?.toLowerCase().includes(search)
      );
    }

    const total = allTx.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = allTx.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: {
        total,
        page,
        limit,
        totalPages,
        transactions: paginated,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve transactions' },
      { status: 500 }
    );
  }
}

