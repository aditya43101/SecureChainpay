import { NextResponse } from 'next/server';
import { createAndAnchorMerkleBatch } from '@/lib/blockchain/merkle-tree';
import { HybridTransactionRecord } from '@/types/hybrid-transaction';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactions, batchId, force } = body as {
      transactions: HybridTransactionRecord[];
      batchId?: string;
      force?: boolean;
    };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: provide an array of finalized transactions' },
        { status: 400 }
      );
    }

    const result = await createAndAnchorMerkleBatch(transactions, {
      batchId,
      force,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create Merkle batch' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      batch: result.batch,
      anchoredOnChain: result.anchoredOnChain,
    });
  } catch (err: any) {
    console.error('[API /api/merkle/batch] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
