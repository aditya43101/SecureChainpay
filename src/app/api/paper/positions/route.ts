import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paperEngine } from '@/lib/trading/paper-engine';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

const DEMO_USER_ID = 'demo-user-id';

export async function GET() {
  try {
    // Refresh position prices & account equity
    await paperEngine.getOrCreateAccount(DEMO_USER_ID);

    try {
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
    } catch {
      const account = tradingFallbackStore.getPaperAccount(DEMO_USER_ID);
      return NextResponse.json({
        success: true,
        positions: account.positions || []
      });
    }
  } catch (error: any) {
    const account = tradingFallbackStore.getPaperAccount(DEMO_USER_ID);
    return NextResponse.json({
      success: true,
      positions: account.positions || []
    });
  }
}
