import { NextResponse } from 'next/server';
import { marketDataService } from '@/lib/market/market-data-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const symbol = (await params).symbol;
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Force append USDT if it's just BTC or ETH
    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

    const ticker = await marketDataService.getTicker(formattedSymbol);
    
    return NextResponse.json(ticker);
  } catch (error: any) {
    console.error('Ticker Error:', error);
    return NextResponse.json({ error: 'Market data temporarily unavailable' }, { status: 500 });
  }
}
