/**
 * SecureChain Pay — Draft Confirmation & Authorization API (Task 11)
 * POST: Final authorization boundary. Checks draft TTL, policy rules, and executes payment.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentCopilot } from '@/lib/payments/payment-copilot';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params;
    const body = await request.json().catch(() => ({}));
    const { otpCode, userId: explicitUserId } = body;

    let userId = explicitUserId;
    if (!userId) {
      const user = await db.user.findFirst();
      if (!user) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }
      userId = user.id;
    }

    const result = await PaymentCopilot.confirmDraft({
      draftId,
      userId,
      otpCode,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Draft Confirmation API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Payment confirmation failed.' },
      { status: 400 }
    );
  }
}
