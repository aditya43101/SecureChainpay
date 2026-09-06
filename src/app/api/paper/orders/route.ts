import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paperEngine } from '@/lib/trading/paper-engine';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

const DEMO_USER_ID = 'demo-user-id';

export async function GET() {
  try {
    try {
      const account = await db.paperAccount.findUnique({
        where: { userId: DEMO_USER_ID },
        include: {
          orders: { orderBy: { executedAt: 'desc' }, take: 50 }
        }
      });

      return NextResponse.json({
        success: true,
        orders: account ? account.orders : []
      });
    } catch {
      const account = tradingFallbackStore.getPaperAccount(DEMO_USER_ID);
      return NextResponse.json({
        success: true,
        orders: account.orders || []
      });
    }
  } catch (error: any) {
    const account = tradingFallbackStore.getPaperAccount(DEMO_USER_ID);
    return NextResponse.json({
      success: true,
      orders: account.orders || []
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol = 'BTCUSDT', side = 'BUY', quantity, timeframe = '1h' } = body;

    const result = await paperEngine.placePaperOrder(
      DEMO_USER_ID,
      symbol,
      side,
      quantity ? parseFloat(quantity) : undefined,
      timeframe
    );

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('API /api/paper/orders error:', error);
    return NextResponse.json({ error: error.message || 'Failed to place paper order' }, { status: 400 });
  }
}
