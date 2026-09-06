/**
 * SecureChain Pay — Payment Preflight API (Task 11)
 * POST: Runs balance, risk, policy, and network checks prior to drafting or execution.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentCopilot } from '@/lib/payments/payment-copilot';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, currency = 'USD', recipient, preferredRoute = 'ADAPTIVE', userId: explicitUserId } = body;

    if (!amount || !recipient) {
      return NextResponse.json(
        { error: 'Amount and recipient are required for preflight check.' },
        { status: 400 }
      );
    }

    let userId = explicitUserId;
    if (!userId) {
      const user = await db.user.findFirst();
      if (!user) {
        return NextResponse.json({ error: 'No active user found.' }, { status: 404 });
      }
      userId = user.id;
    }

    const preflight = await PaymentCopilot.runPreflightCheck({
      userId,
      amount: Number(amount),
      currency,
      recipient,
      preferredRoute,
    });

    return NextResponse.json(preflight);
  } catch (err: any) {
    console.error('[Copilot Preflight API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Preflight check failed.' },
      { status: 500 }
    );
  }
}
