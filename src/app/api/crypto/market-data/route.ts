import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

export async function GET() {
  const cmcKey = process.env.COINMARKETCAP_API_KEY;

  if (cmcKey) {
    try {
      console.log('[API Crypto] Fetching quotes from CoinMarketCap...');
      const response = await fetch(
        'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL,BNB,ADA',
        {
          headers: {
            'X-CMC_PRO_API_KEY': cmcKey,
            'Accept': 'application/json',
          },
          next: { revalidate: 0 },
          cache: 'no-store'
        }
      );

      const data = await response.json();
      if (data.status?.error_code === 0 && data.data) {
        const formatted: CryptoAsset[] = Object.keys(data.data).map((symbol) => {
          const item = data.data[symbol];
          const quote = item.quote?.USD || {};
          return {
            id: item.slug || item.name.toLowerCase(),
            symbol: item.symbol,
            name: item.name,
            price: Number(quote.price || 0),
            change24h: Number(quote.percent_change_24h || 0),
            marketCap: Number(quote.market_cap || 0),
            volume24h: Number(quote.volume_24h || 0),
          };
        });

        return NextResponse.json({ success: true, source: 'CoinMarketCap', data: formatted });
      } else {
        console.warn('[API Crypto] CoinMarketCap error response:', data.status);
      }
    } catch (err: any) {
      console.error('[API Crypto] CoinMarketCap request failed:', err.message);
    }
  }

  // Fallback to CoinCap API (completely public, no key, CORS friendly)
  try {
    console.log('[API Crypto] Fetching assets from CoinCap (Fallback)...');
    const response = await fetch('https://api.coincap.io/v2/assets?limit=10', {
      cache: 'no-store'
    });
    const data = await response.json();

    if (data && Array.isArray(data.data)) {
      const allowedSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOT', 'DOGE', 'LINK', 'MATIC'];
      const formatted: CryptoAsset[] = data.data
        .filter((item: any) => allowedSymbols.includes(item.symbol))
        .map((item: any) => ({
          id: item.id,
          symbol: item.symbol,
          name: item.name,
          price: Number(item.priceUsd || 0),
          change24h: Number(item.changePercent24Hr || 0),
          marketCap: Number(item.marketCapUsd || 0),
          volume24h: Number(item.volumeUsd24Hr || 0),
        }));

      return NextResponse.json({ success: true, source: 'CoinCap', data: formatted });
    }
  } catch (err: any) {
    console.error('[API Crypto] CoinCap request failed:', err.message);
  }

  // Double fallback to simulated prices with micro-fluctuation so portfolio updates live every second
  const jitter = (Math.sin(Date.now() / 2000) * 0.003);
  const mockData: CryptoAsset[] = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: Number((64230.50 * (1 + jitter)).toFixed(2)), change24h: 1.25, marketCap: 1260000000000, volume24h: 28000000000 },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: Number((3450.20 * (1 + jitter * 1.5)).toFixed(2)), change24h: -0.45, marketCap: 415000000000, volume24h: 14000000000 },
    { id: 'solana', symbol: 'SOL', name: 'Solana', price: Number((142.75 * (1 + jitter * 2)).toFixed(2)), change24h: 4.82, marketCap: 66000000000, volume24h: 3200000000 },
    { id: 'binance-coin', symbol: 'BNB', name: 'BNB', price: Number((575.40 * (1 + jitter)).toFixed(2)), change24h: 0.15, marketCap: 84000000000, volume24h: 1100000000 },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', price: Number((0.38 * (1 + jitter)).toFixed(4)), change24h: -1.20, marketCap: 13000000000, volume24h: 280000000 }
  ];

  return NextResponse.json({ success: true, source: 'Simulated', data: mockData });
}
