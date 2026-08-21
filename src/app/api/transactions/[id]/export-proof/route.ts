import { NextResponse } from 'next/server';
import {
  verifyTransactionIntegrity,
  generateExportableProofReport,
} from '@/lib/blockchain/verification-engine';
import { HybridTransactionRecord } from '@/types/hybrid-transaction';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { transactionRecord, requestingUserId } = body as {
      transactionRecord: HybridTransactionRecord;
      requestingUserId?: string;
    };

    if (!transactionRecord) {
      return NextResponse.json(
        { error: 'Missing transactionRecord in request body' },
        { status: 400 }
      );
    }

    if (requestingUserId && transactionRecord.userId && transactionRecord.userId !== requestingUserId) {
      return NextResponse.json(
        { error: 'Permission denied: Cannot export proof for another user' },
        { status: 403 }
      );
    }

    const verificationResult = await verifyTransactionIntegrity(transactionRecord);
    const exportReport = generateExportableProofReport(transactionRecord, verificationResult);

    return NextResponse.json({
      success: true,
      report: exportReport,
    });
  } catch (err: any) {
    console.error('[API /api/transactions/:id/export-proof] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
