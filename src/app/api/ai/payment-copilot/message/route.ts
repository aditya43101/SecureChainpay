/**
 * SecureChain Pay — Payment Copilot Message API (Task 11)
 * POST: Handles conversational queries, intent parsing, pre-flight checks, and drafting.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentCopilot } from '@/lib/payments/payment-copilot';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, conversationId, userId: explicitUserId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message text is required.' }, { status: 400 });
    }

    // Resolve or fallback user
    let userId = explicitUserId;
    if (!userId) {
      try {
        let user = await db.user.findFirst({
          include: { wallets: true },
        });
        if (!user) {
          user = await db.user.create({
            data: {
              email: 'demo@securechain.pay',
              firstName: 'Aditya',
              lastName: 'Singh',
              wallets: {
                create: [
                  { address: '0x71C8363837F881234567890abcdef1234567890a', balance: 5000.0, currency: 'USD' },
                  { address: '0x71C8363837F881234567890abcdef1234567890b', balance: 10000.0, currency: 'HSCT' },
                ],
              },
            },
            include: { wallets: true },
          });
        }
        if (user) userId = user.id;
      } catch (dbErr) {
        console.warn('[Copilot API] Prisma DB unreachable, using fallback demo user ID:', dbErr);
        userId = 'demo-user-id';
      }
    }

    const response = await PaymentCopilot.handleMessage({
      userId,
      message,
      conversationId,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[Copilot API] Message error:', err);
    return NextResponse.json(
      {
        message: `An error occurred processing your request: ${err.message || 'Internal server error'}`,
        intent: 'GENERAL_QUESTION',
        actionRequired: 'NONE',
        quickReplies: ['Retry', 'Check Route Status'],
        confidence: 0.5,
      },
      { status: 500 }
    );
  }
}
