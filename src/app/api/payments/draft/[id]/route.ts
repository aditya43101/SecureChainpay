/**
 * SecureChain Pay — Single Draft Operations API (Task 11)
 * PATCH: Updates draft amount/recipient (invalidates confirmation / refreshes preflight).
 * DELETE: Cancels/abandons an active draft.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentCopilot } from '@/lib/payments/payment-copilot';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params;
    const body = await request.json();
    const { amount, recipient, currency, description, userId: explicitUserId } = body;

    let userId = explicitUserId;
    if (!userId) {
      const user = await db.user.findFirst();
      if (!user) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }
      userId = user.id;
    }

    const result = await PaymentCopilot.updateDraft({
      draftId,
      userId,
      amount: amount !== undefined ? Number(amount) : undefined,
      recipient,
      currency,
      description,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Draft API] PATCH error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update draft.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params;

    const draft = await db.paymentDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
    }

    const updated = await db.paymentDraft.update({
      where: { id: draftId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true, draft: updated });
  } catch (err: any) {
    console.error('[Draft API] DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Failed to cancel draft.' }, { status: 500 });
  }
}
