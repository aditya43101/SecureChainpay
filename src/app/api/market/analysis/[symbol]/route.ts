import { NextResponse } from 'next/server';
import { marketDataService } from '@/lib/market/market-data-service';
import { technicalAnalysisService } from '@/lib/market/technical-analysis';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const symbol = (await params).symbol;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '1h';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    
    // Validate timeframe
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
    }

    // Need enough candles for 50-period EMA
    const fetchLimit = Math.max(limit, 100); 
    const candles = await marketDataService.getCandles(formattedSymbol, timeframe, fetchLimit);
    
    if (candles.length === 0) {
      return NextResponse.json({ error: 'No data available for analysis' }, { status: 404 });
    }

    const currentPrice = candles[candles.length - 1].close;
    const indicators = technicalAnalysisService.calculateIndicators(candles);
    
    return NextResponse.json({
      symbol: formattedSymbol,
      timeframe,
      price: currentPrice,
      timestamp: candles[candles.length - 1].timestamp,
      indicators
    });
  } catch (error: any) {
    console.error('Analysis Error:', error);
    return NextResponse.json({ error: 'Market data temporarily unavailable' }, { status: 500 });
  }
}
