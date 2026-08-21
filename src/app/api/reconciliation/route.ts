import { NextResponse } from 'next/server';
import {
  reconcileTransaction,
  reconcileMissingDatabaseRecord,
} from '@/lib/blockchain/reconciliation-engine';
import { HybridTransactionRecord } from '@/types/hybrid-transaction';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      transactionRecord,
      transactions,
      missingBlockchainTxHash,
      autoRecover = true,
      uid,
    } = body as {
      transactionRecord?: HybridTransactionRecord;
      transactions?: HybridTransactionRecord[];
      missingBlockchainTxHash?: string;
      autoRecover?: boolean;
      uid?: string;
    };

    // Case 1: Missing off-chain database record reconstruction
    if (missingBlockchainTxHash && uid) {
      const result = await reconcileMissingDatabaseRecord({
        blockchainTxHash: missingBlockchainTxHash,
        uid,
      });
      return NextResponse.json({ success: true, result });
    }

    // Case 2: Single transaction reconciliation
    if (transactionRecord) {
      const result = await reconcileTransaction(transactionRecord, {
        autoRecover,
        uid,
      });
      return NextResponse.json({ success: true, result });
    }

    // Case 3: Batch reconciliation
    if (transactions && Array.isArray(transactions)) {
      // Prioritize pending/unconfirmed first, limit concurrency to avoid RPC spam
      const results = [];
      const batch = transactions.slice(0, 50); // limit to 50
      for (const tx of batch) {
        const res = await reconcileTransaction(tx, { autoRecover, uid });
        results.push(res);
      }
      return NextResponse.json({
        success: true,
        count: results.length,
        results,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request: provide transactionRecord, transactions, or missingBlockchainTxHash' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API /api/reconciliation] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
