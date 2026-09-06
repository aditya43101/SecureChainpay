import { NextResponse } from 'next/server';
import { marketDataService } from '@/lib/market/market-data-service';
import { technicalAnalysisService } from '@/lib/market/technical-analysis';
import { strategyEngine } from '@/lib/trading/strategy-engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '1h';

    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

    const candles = await marketDataService.getCandles(formattedSymbol, timeframe, 100);
    const ticker = await marketDataService.getTicker(formattedSymbol);
    const indicators = technicalAnalysisService.calculateIndicators(candles);

    const strategyOutput = strategyEngine.evaluateHybrid(
      formattedSymbol,
      timeframe,
      candles,
      indicators
    );

    return NextResponse.json({
      success: true,
      data: {
        symbol: formattedSymbol,
        timeframe,
        ticker,
        indicators,
        strategyAnalysis: strategyOutput
      }
    });
  } catch (error: any) {
    console.error('API /api/trading/analysis/[symbol] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
