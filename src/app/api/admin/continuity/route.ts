import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentReconciliationEngine } from '@/lib/payments/reconciliation-engine';

export async function GET() {
  try {
    const intents = await prisma.paymentIntent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { executions: true }
    });

    const metrics = {
      processing: await prisma.paymentIntent.count({ where: { status: 'PROCESSING' } }),
      pendingConfirmation: await prisma.paymentIntent.count({ where: { status: 'PENDING_CONFIRMATION' } }),
      reconciling: await prisma.paymentIntent.count({ where: { status: 'RECONCILING' } }),
      broadcastUnknown: await prisma.paymentIntent.count({ where: { status: 'BROADCAST_UNKNOWN' } }),
      recovered: await prisma.paymentIntent.count({ where: { status: 'RECOVERED' } }),
      manualReview: await prisma.paymentIntent.count({ where: { status: 'MANUAL_REVIEW' } }),
      totalConfirmed: await prisma.paymentIntent.count({ where: { status: 'CONFIRMED' } })
    };

    const failures = await prisma.paymentFailure.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json({ success: true, intents, metrics, failures });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  // Trigger recovery scanner
  try {
    const result = await PaymentReconciliationEngine.runRecoveryScanner();
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
