import { NextResponse } from 'next/server';
import { marketDataService } from '@/lib/market/market-data-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const symbol = (await params).symbol;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '1h';
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    
    // Validate timeframe
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
    }

    const candles = await marketDataService.getCandles(formattedSymbol, timeframe, limit);
    
    return NextResponse.json(candles);
  } catch (error: any) {
    console.error('Candles Error:', error);
    return NextResponse.json({ error: 'Market data temporarily unavailable' }, { status: 500 });
  }
}
