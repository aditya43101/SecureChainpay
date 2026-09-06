import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paperEngine } from '@/lib/trading/paper-engine';

const DEMO_USER_ID = 'demo-user-id';

export async function GET() {
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
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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
