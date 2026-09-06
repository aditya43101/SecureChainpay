/**
 * SecureChain Pay — Copilot Feedback API (Task 11)
 * POST: Records user feedback on a Copilot recommendation.
 */

import { NextResponse } from 'next/server';
import { PaymentCopilot } from '@/lib/payments/payment-copilot';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { decisionId, feedback } = body;

    if (!decisionId || !feedback) {
      return NextResponse.json(
        { error: 'decisionId and feedback (HELPFUL | UNHELPFUL | INCORRECT) are required.' },
        { status: 400 }
      );
    }

    await PaymentCopilot.recordFeedback(decisionId, feedback);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Copilot Feedback API] Error:', err);
    return NextResponse.json({ error: 'Failed to record feedback.' }, { status: 500 });
  }
}
