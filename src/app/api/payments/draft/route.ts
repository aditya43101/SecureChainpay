/**
 * SecureChain Pay — Payment Draft API (Task 11)
 * GET: Lists active non-expired drafts for the user.
 * POST: Explicitly creates a new payment draft with 5-minute TTL.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentCopilot } from '@/lib/payments/payment-copilot';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || (await db.user.findFirst())?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const drafts = await db.paymentDraft.findMany({
      where: {
        userId,
        status: 'DRAFT',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ drafts });
  } catch (err: any) {
    console.error('[Draft API] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch drafts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      recipient,
      recipientName,
      amount,
      currency = 'USD',
      description,
      preferredRoute = 'ADAPTIVE',
      userId: explicitUserId,
    } = body;

    if (!recipient || !amount) {
      return NextResponse.json({ error: 'Recipient and amount are required.' }, { status: 400 });
    }

    let userId = explicitUserId;
    if (!userId) {
      const user = await db.user.findFirst();
      if (!user) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
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

    if (preflight.status === 'BLOCKED') {
      return NextResponse.json(
        {
          error: 'Draft blocked by pre-flight validation.',
          blockReasons: preflight.blockReasons,
          preflight,
        },
        { status: 400 }
      );
    }

    const draft = await PaymentCopilot.createDraft({
      userId,
      recipient,
      recipientName,
      amount: Number(amount),
      currency,
      description,
      preferredRoute: preflight.routeHealth.recommendedRoute,
      securitySummary: preflight,
    });

    return NextResponse.json({
      success: true,
      draft,
      preflight,
    });
  } catch (err: any) {
    console.error('[Draft API] POST error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create draft.' }, { status: 500 });
  }
}
