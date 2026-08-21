import { NextResponse } from 'next/server';
import { reconcileTransaction } from '@/lib/blockchain/reconciliation-engine';
import { HybridTransactionRecord } from '@/types/hybrid-transaction';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionRecord, autoRecover, uid } = body as {
      transactionRecord: HybridTransactionRecord;
      autoRecover?: boolean;
      uid?: string;
    };

    if (!transactionRecord || !transactionRecord.applicationTransactionId) {
      return NextResponse.json(
        { error: 'Missing transactionRecord with applicationTransactionId in request body' },
        { status: 400 }
      );
    }

    const reconciliationResult = await reconcileTransaction(transactionRecord, {
      autoRecover: Boolean(autoRecover),
      uid,
    });

    return NextResponse.json({
      success: true,
      result: {
        verified: reconciliationResult.verified,
        status: reconciliationResult.reconciliationStatus,
        applicationTransactionId: reconciliationResult.applicationTransactionId,
        offChainStatus: reconciliationResult.offChainStatus,
        blockchainStatus: reconciliationResult.blockchainStatus,
        reconciliationStatus: reconciliationResult.reconciliationStatus,
        severity: reconciliationResult.severity,
        actionPerformed: reconciliationResult.actionPerformed,
        blockchainTransactionHash: reconciliationResult.blockchainTransactionHash,
        blockNumber: reconciliationResult.blockNumber,
        blockHash: reconciliationResult.blockHash,
        contractAddress: reconciliationResult.contractAddress,
        chainId: reconciliationResult.chainId,
        recoveredFields: reconciliationResult.recoveredFields,
        mismatches: reconciliationResult.mismatches.map((m) => m.message),
        detailedMismatches: reconciliationResult.mismatches,
        isRetryable: reconciliationResult.isRetryable,
      },
    });
  } catch (err: any) {
    console.error('[API /api/transactions/verify] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
