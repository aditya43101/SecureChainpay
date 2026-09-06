/**
 * SecureChain Pay — Payment Explanation API (Task 11)
 * GET: Retrieves AI/Failure analysis for a specific payment.
 */

import { NextResponse } from 'next/server';
import { PaymentFailureAnalyzer } from '@/lib/payments/payment-failure-analyzer';
import { PaymentContextEngine } from '@/lib/payments/payment-context-engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentId } = await params;

    const [failureAnalysis, auditContext] = await Promise.all([
      PaymentFailureAnalyzer.analyzeFailure(paymentId),
      PaymentContextEngine.getPaymentAuditContext(paymentId).catch(() => null),
    ]);

    return NextResponse.json({
      paymentId,
      failureAnalysis,
      auditContext,
    });
  } catch (err: any) {
    console.error('[Payment Explanation API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate explanation.' },
      { status: 500 }
    );
  }
}
