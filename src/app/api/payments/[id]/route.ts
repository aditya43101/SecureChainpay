import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TransactionStateMachine } from '@/lib/payments/transaction-state-machine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;

    // Search in TemporaryTransaction
    const tempTx = await prisma.temporaryTransaction.findUnique({
      where: { transactionId },
    });

    // Search in Reservation
    const reservation = await prisma.reservation.findUnique({
      where: { transactionId },
    });

    // Search in History
    const history = await TransactionStateMachine.getHistory(transactionId);

    if (!tempTx && !reservation && history.length === 0) {
      return NextResponse.json(
        { success: false, error: `Transaction ${transactionId} not found.` },
        { status: 404 }
      );
    }

    const latestState = history.length > 0 ? history[history.length - 1].newState : tempTx?.status || 'CREATED';

    return NextResponse.json({
      success: true,
      transactionId,
      status: latestState,
      amount: tempTx ? Number(tempTx.amount) : reservation ? Number(reservation.amount) : 0,
      asset: tempTx?.asset || reservation?.asset || 'HSCT',
      senderWallet: tempTx?.senderWallet || reservation?.walletAddress,
      recipientWallet: tempTx?.recipientWallet,
      reservationId: reservation?.reservationId,
      reservationType: reservation?.reservationType || (tempTx ? 'OFFCHAIN_RESERVED' : null),
      reservationStatus: reservation?.status,
      blockchainTxHash: tempTx?.blockchainTxHash || history[history.length - 1]?.blockchainTxHash || null,
      blockNumber: tempTx?.blockNumber || history[history.length - 1]?.blockNumber || null,
      createdAt: tempTx?.createdAt || reservation?.createdAt,
      expiresAt: tempTx?.expiresAt || reservation?.expiresAt,
      historyCount: history.length,
    });
  } catch (error: any) {
    console.error('[API /payments/[id]] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch transaction details' },
      { status: 500 }
    );
  }
}
