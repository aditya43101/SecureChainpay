import { NextResponse } from 'next/server';
import { verifyTransactionIntegrity } from '@/lib/blockchain/verification-engine';
import { HybridTransactionRecord } from '@/types/hybrid-transaction';
import { AnchorBatch } from '@/types/merkle';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionRecord, batch, bypassCache, requiredConfirmations, requestingUserId } = body as {
      transactionRecord: HybridTransactionRecord;
      batch?: AnchorBatch;
      bypassCache?: boolean;
      requiredConfirmations?: number;
      requestingUserId?: string;
    };

    if (!transactionRecord || (!transactionRecord.applicationTransactionId && !transactionRecord.id)) {
      return NextResponse.json(
        { error: 'Missing transactionRecord with valid identifier' },
        { status: 400 }
      );
    }

    // Role-based cross-user isolation: If requestingUserId is supplied, prevent inspecting other users' records unless admin
    if (requestingUserId && transactionRecord.userId && transactionRecord.userId !== requestingUserId) {
      return NextResponse.json(
        { error: 'Permission denied: Cannot verify transaction belonging to another user' },
        { status: 403 }
      );
    }

    const verificationResult = await verifyTransactionIntegrity(transactionRecord, {
      batch,
      bypassCache: Boolean(bypassCache),
      requiredConfirmations,
      requestingUserId,
    });

    return NextResponse.json({
      success: true,
      result: verificationResult,
    });
  } catch (err: any) {
    console.error('[API /api/transactions/verify-advanced] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
