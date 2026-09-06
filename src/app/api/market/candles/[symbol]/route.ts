import { NextResponse } from 'next/server';
import { marketDataService } from '@/lib/market/market-data-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const symbol = (await params).symbol;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || searchParams.get('interval') || '1h';
    const limit = parseInt(searchParams.get('limit') || '150', 10);

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    
    // Normalize timeframe
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    const selectedTimeframe = validTimeframes.includes(timeframe) ? timeframe : '1h';

    const candles = await marketDataService.getCandles(formattedSymbol, selectedTimeframe, limit);
    
    return NextResponse.json(candles);
  } catch (error: any) {
    console.error('Candles Route Error:', error);
    // Return empty array instead of 500 so client fallback kicks in cleanly
    return NextResponse.json([]);
  }
}
