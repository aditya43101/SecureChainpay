import { NextResponse } from 'next/server';
import { computeRouteDecision } from '@/lib/payments/transaction-routing-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      paymentId,
      amount,
      currency = 'HSCT',
      riskAssessment,
      securityPolicyRequirement,
    } = body;

    if (!paymentId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required routing parameters (paymentId, amount).' },
        { status: 400 }
      );
    }

    const decision = await computeRouteDecision({
      paymentId,
      amount: Number(amount),
      currency,
      riskAssessment,
      securityPolicyRequirement,
    });

    return NextResponse.json({
      success: true,
      decision,
    });
  } catch (error: any) {
    console.error('[API /api/payments/route-selection] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Route evaluation failed.' },
      { status: 500 }
    );
  }
}
