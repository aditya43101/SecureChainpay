import { NextResponse } from 'next/server';
import { TransactionStateMachine } from '@/lib/payments/transaction-state-machine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const history = await TransactionStateMachine.getHistory(transactionId);

    return NextResponse.json({
      success: true,
      transactionId,
      count: history.length,
      history,
    });
  } catch (error: any) {
    console.error('[API /payments/[id]/history] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
