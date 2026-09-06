import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const whereClause: any = {};
    if (symbol) {
      whereClause.symbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    }

    try {
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
    } catch {
      const fallbackHistory = tradingFallbackStore.getRecommendations(symbol || undefined, limit);
      return NextResponse.json({
        success: true,
        count: fallbackHistory.length,
        history: fallbackHistory
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: true, count: 0, history: [] });
  }
}
