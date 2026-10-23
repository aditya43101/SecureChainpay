import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { TransactionStateMachine } from '@/lib/payments/transaction-state-machine';
import { ReservationService } from '@/lib/payments/reservation-service';
import { NodeHealthEngine } from '@/lib/blockchain/node-health-engine';
import { getContract } from '@/lib/blockchain/client';
import SecureChainPaymentArtifact from '../../../../../../artifacts/contracts/SecureChainPayment.sol/SecureChainPayment.json';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'User requested cancellation';

    // 1. Fetch Reservation & Temporary Transaction with DB offline protection
    let reservation: any = null;
    try {
      reservation = await Promise.race([
        prisma.reservation.findUnique({
          where: { transactionId },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ]);
    } catch (e: any) {
      console.warn('[API /cancel] Prisma reservation query skipped (DB offline):', e.message);
    }

    let tempTx: any = null;
    try {
      tempTx = await Promise.race([
        prisma.temporaryTransaction.findUnique({
          where: { transactionId },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ]);
    } catch (e: any) {
      console.warn('[API /cancel] Prisma tempTx query skipped (DB offline):', e.message);
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

    if (!reservation && !tempTx) {
      return NextResponse.json(
        { success: false, error: `Transaction ${transactionId} not found.` },
        { status: 404 }
      );
    }

    // Invariant 2: Cannot be both FINALIZED and CANCELLED
    if (tempTx?.status === 'FINALIZED') {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel: Transaction has already been FINALIZED.' },
        { status: 400 }
      );
    }

    // 2. Transition to CANCEL_REQUESTED
    await TransactionStateMachine.transition({
      transactionId,
      newState: 'CANCEL_REQUESTED',
      reason,
      actor: 'User',
      systemComponent: 'PaymentCanceller',
    });

    // 3. If on-chain, attempt smart contract cancelPayment
    const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
    const healthEngine = NodeHealthEngine.getInstance();
    const { provider } = await healthEngine.getHealthyProvider(contractAddress);

    if (provider && contractAddress && (reservation?.reservationType === 'ONCHAIN_LOCKED' || tempTx?.blockchainTxHash)) {
      try {
        const contract = getContract(contractAddress, SecureChainPaymentArtifact.abi, true);
        const txIdBytes32 = ethers.id(transactionId);
        const tx = await contract.cancelPayment(txIdBytes32, reason);
        await tx.wait(1);
        console.info(`[API /payments/[id]/cancel] On-chain payment ${transactionId} cancelled successfully.`);
      } catch (chainErr: any) {
        console.warn(`[API /payments/[id]/cancel] On-chain cancellation warning: ${chainErr.message}`);
      }
    }

    // 4. Release Reserved Funds back to Available Balance
    await ReservationService.releaseReservation(transactionId, reason);

    // 5. Transition to CANCELLED
    await TransactionStateMachine.transition({
      transactionId,
      newState: 'CANCELLED',
      reason,
      actor: 'PaymentOrchestrator',
      systemComponent: 'PaymentCanceller',
    });

    return NextResponse.json({
      success: true,
      status: 'CANCELLED',
      transactionId,
      message: 'Payment cancelled successfully. Reserved funds restored to available balance. Recipient remains uncredited.',
    });
  } catch (error: any) {
    console.error('[API /payments/[id]/cancel] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment cancellation failed' },
      { status: 500 }
    );
  }
}
