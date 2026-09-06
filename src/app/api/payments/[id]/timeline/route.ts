/**
 * SecureChain Pay — Payment Timeline API (Task 11)
 * GET: Retrieves chronological timeline events for a payment.
 */

import { NextResponse } from 'next/server';
import { PaymentCopilot } from '@/lib/payments/payment-copilot';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentId } = await params;

    const timelineData = await PaymentCopilot.getPaymentTimeline(paymentId);
    return NextResponse.json(timelineData);
  } catch (err: any) {
    console.error('[Payment Timeline API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch payment timeline.' },
      { status: 404 }
    );
  }
}
