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

    // Search in TemporaryTransaction with DB offline protection
    let tempTx: any = null;
    try {
      tempTx = await Promise.race([
        prisma.temporaryTransaction.findUnique({
          where: { transactionId },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ]);
    } catch (e: any) {
      console.warn('[API /payments/[id]] Prisma tempTx query skipped (DB offline):', e.message);
    }

    // Search in Reservation with DB offline protection
    let reservation: any = null;
    try {
      reservation = await Promise.race([
        prisma.reservation.findUnique({
          where: { transactionId },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ]);
    } catch (e: any) {
      console.warn('[API /payments/[id]] Prisma reservation query skipped (DB offline):', e.message);
    }

    // Firestore fallback
    if (!tempTx) {
      try {
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adminDb = getAdminDb();
        const docSnap = await adminDb.collection('temporary_transactions').doc(transactionId).get();
        if (docSnap.exists) {
          tempTx = docSnap.data();
        }
      } catch (fsErr) {
        // ignore
      }
    }

    // Search in History with fail-safe
    let history: any[] = [];
    try {
      history = (await Promise.race([
        TransactionStateMachine.getHistory(transactionId),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ])) as any[];
    } catch {
      // ignore
    }

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
