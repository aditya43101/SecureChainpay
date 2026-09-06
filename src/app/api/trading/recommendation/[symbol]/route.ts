import { NextResponse } from 'next/server';
import { recommendationEngine } from '@/lib/trading/recommendation-engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '1h';

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    const recommendation = await recommendationEngine.generateRecommendation(symbol, timeframe);

    return NextResponse.json({
      success: true,
      recommendation
    });
  } catch (error: any) {
    console.error('API /api/trading/recommendation/[symbol] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
