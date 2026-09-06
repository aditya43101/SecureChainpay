import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paperEngine } from '@/lib/trading/paper-engine';

const DEMO_USER_ID = 'demo-user-id';

export async function GET() {
  try {
    // Refresh position prices & account equity
    await paperEngine.getOrCreateAccount(DEMO_USER_ID);

    const account = await db.paperAccount.findUnique({
      where: { userId: DEMO_USER_ID },
      include: {
        positions: { orderBy: { openedAt: 'desc' } }
      }
    });

    return NextResponse.json({
      success: true,
      positions: account ? account.positions : []
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
