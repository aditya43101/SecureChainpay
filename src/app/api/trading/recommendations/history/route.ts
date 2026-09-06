import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const whereClause: any = {};
    if (symbol) {
      whereClause.symbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    }

    const history = await db.tradingRecommendation.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error: any) {
    console.error('API /api/trading/recommendations/history error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
