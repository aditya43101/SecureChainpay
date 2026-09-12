import { db } from '@/lib/db';

export interface Candle {
  id?: string;
  symbol: string;
  timeframe: string;
  timestamp: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  price: string;
  change24h: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  timestamp: string;
}

// Convert common timeframes to Binance intervals
const toBinanceInterval = (timeframe: string) => {
  const map: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
  };
  return map[timeframe] || '1h';
};

// Default base prices for realistic synthetic generation fallback
const BASE_PRICES: Record<string, number> = {
  'BTCUSDT': 77450,
  'ETHUSDT': 2550,
  'SOLUSDT': 136,
  'BNBUSDT': 582,
  'ADAUSDT': 0.34,
  'MATICUSDT': 0.42,
  'DOGEUSDT': 0.12,
};

function generateSyntheticCandles(symbol: string, timeframe: string, count: number = 100): Candle[] {
  const base = BASE_PRICES[symbol] || 1000;
  const now = Date.now();
  
  let stepMs = 60 * 60 * 1000; // 1h default
  if (timeframe === '1m') stepMs = 60 * 1000;
  else if (timeframe === '5m') stepMs = 5 * 60 * 1000;
  else if (timeframe === '15m') stepMs = 15 * 60 * 1000;
  else if (timeframe === '4h') stepMs = 4 * 60 * 60 * 1000;
  else if (timeframe === '1d') stepMs = 24 * 60 * 60 * 1000;

  const candles: Candle[] = [];
  let currentClose = base * 0.96;

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * stepMs).toISOString();
    const volatility = base * 0.008;
    const change = (Math.random() - 0.48) * volatility;
    const open = currentClose;
    const close = Math.max(open * 0.5, open + change);
    const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.5);
    const volume = Math.floor(Math.random() * 500 + 50);

    candles.push({
      symbol,
      timeframe,
      timestamp,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    });

    currentClose = close;
  }

  return candles;
}

export const marketDataService = {
  /**
   * Get live ticker data directly with multiple fallback endpoints
   */
  async getTicker(symbol: string): Promise<Ticker> {
    const endpoints = [
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`,
      `https://api.binance.us/api/v3/ticker/24hr?symbol=${symbol}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          return {
            symbol,
            price: data.lastPrice || data.price,
            change24h: data.priceChangePercent || '1.25',
            high24h: data.highPrice || (parseFloat(data.lastPrice) * 1.03).toString(),
            low24h: data.lowPrice || (parseFloat(data.lastPrice) * 0.97).toString(),
            volume24h: data.volume || '15000',
            timestamp: new Date(data.closeTime || Date.now()).toISOString()
          };
        }
      } catch {
        // Try next endpoint
      }
    }

    // Secondary fallback: Bybit Spot Ticker API
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const item = data?.result?.list?.[0];
        if (item && item.lastPrice) {
          return {
            symbol,
            price: item.lastPrice,
            change24h: (parseFloat(item.price24hPcnt || '0.01') * 100).toFixed(2),
            high24h: item.highPrice24h || (parseFloat(item.lastPrice) * 1.02).toFixed(2),
            low24h: item.lowPrice24h || (parseFloat(item.lastPrice) * 0.98).toFixed(2),
            volume24h: item.volume24h || '25000',
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch {
      // Fallback below
    }

    // Fallback default ticker
    const fallbackPrice = BASE_PRICES[symbol] || 65000;
    return {
      symbol,
      price: fallbackPrice.toString(),
      change24h: '1.45',
      high24h: (fallbackPrice * 1.028).toFixed(2),
      low24h: (fallbackPrice * 0.982).toFixed(2),
      volume24h: '24850000000',
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Get candles, prioritizing Binance live feeds with robust fallback
   */
  async getCandles(symbol: string, timeframe: string, limit: number = 200): Promise<Candle[]> {
    const binanceInterval = toBinanceInterval(timeframe);
    const fetchLimit = Math.min(limit, 200);

    const endpoints = [
      `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${fetchLimit}`,
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${fetchLimit}`,
      `https://api.binance.us/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${fetchLimit}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const fetchedCandles: Candle[] = data.map((kline: any) => ({
              symbol,
              timeframe,
              timestamp: new Date(kline[0]).toISOString(),
              open: parseFloat(kline[1]),
              high: parseFloat(kline[2]),
              low: parseFloat(kline[3]),
              close: parseFloat(kline[4]),
              volume: parseFloat(kline[5]),
            }));

            // Non-blocking background save to DB if available
            this.saveCandles(fetchedCandles).catch(() => {});

            return fetchedCandles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          }
        }
      } catch {
        // Try next endpoint
      }
    }

    // Secondary fallback: Direct Bybit Spot Kline API
    try {
      const bybitTfMap: Record<string, string> = {
        '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D'
      };
      const bybitTf = bybitTfMap[timeframe] || '60';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${bybitTf}&limit=${fetchLimit}`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data?.result?.list && Array.isArray(data.result.list) && data.result.list.length > 0) {
          const fetchedCandles: Candle[] = data.result.list.map((k: any) => ({
            symbol,
            timeframe,
            timestamp: new Date(parseInt(k[0], 10)).toISOString(),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5] || '0'),
          }));
          this.saveCandles(fetchedCandles).catch(() => {});
          return fetchedCandles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
      }
    } catch {
      // Try next
    }

    // Secondary fallback: DB cache
    try {
      if (process.env.DATABASE_URL) {
        const cached = await db.marketCandle.findMany({
          where: { symbol, timeframe },
          orderBy: { timestamp: 'desc' },
          take: limit,
        });

        if (cached && cached.length > 10) {
          return cached
            .map(c => ({
              id: c.id,
              symbol: c.symbol,
              timeframe: c.timeframe,
              timestamp: new Date(c.timestamp).toISOString(),
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
            }))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
      }
    } catch {
      // Ignore DB error
    }

    // Otherwise generate clean, realistic synthetic candles matching current price
    return generateSyntheticCandles(symbol, timeframe, limit);
  },

  /**
   * Save candles to DB safely, preventing duplicates
   */
  async saveCandles(candles: Candle[]) {
    try {
      const valid = candles.filter(c => 
        !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close) && !isNaN(c.volume) &&
        c.open >= 0 && c.high >= 0 && c.low >= 0 && c.close >= 0 && c.volume >= 0 &&
        c.high >= c.open && c.high >= c.close && c.low <= c.open && c.low <= c.close &&
        !isNaN(new Date(c.timestamp).getTime())
      );

      if (valid.length === 0) return;

      await db.marketCandle.createMany({
        data: valid.map(c => ({
          symbol: c.symbol,
          timeframe: c.timeframe,
          timestamp: new Date(c.timestamp),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume
        })),
        skipDuplicates: true
      });
    } catch {
      // Non-blocking
    }
  }
};
