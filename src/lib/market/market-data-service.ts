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

export const marketDataService = {
  /**
   * Get live ticker data directly from the provider (Binance)
   */
  async getTicker(symbol: string): Promise<Ticker> {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch ticker for ${symbol}`);
    }
    const data = await res.json();
    return {
      symbol,
      price: data.lastPrice,
      change24h: data.priceChangePercent,
      high24h: data.highPrice,
      low24h: data.lowPrice,
      volume24h: data.volume,
      timestamp: new Date(data.closeTime).toISOString()
    };
  },

  /**
   * Get candles, prioritizing DB cache and backfilling from Provider
   */
  async getCandles(symbol: string, timeframe: string, limit: number = 200): Promise<Candle[]> {
    // 1. Fetch latest from DB
    const cached = await db.marketCandle.findMany({
      where: { symbol, timeframe },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    let candles: Candle[] = cached.map(c => ({
      id: c.id,
      symbol: c.symbol,
      timeframe: c.timeframe,
      timestamp: c.timestamp.toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    // If we have enough data and the latest candle is fresh enough, return it.
    // To simplify: we'll just always fetch the latest few from Binance to ensure it's up to date and merge.
    
    try {
      const binanceInterval = toBinanceInterval(timeframe);
      // Fetch the most recent 100 candles to ensure we are up to date
      const fetchLimit = candles.length === 0 ? limit : 100;
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${fetchLimit}`);
      
      if (res.ok) {
        const data = await res.json();
        
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

        // Validate and insert missing candles to DB in background
        this.saveCandles(fetchedCandles).catch(console.error);

        // Merge fetched with cached, distinct by timestamp
        const allCandlesMap = new Map<string, Candle>();
        candles.forEach(c => allCandlesMap.set(c.timestamp, c));
        fetchedCandles.forEach(c => allCandlesMap.set(c.timestamp, c));

        // Sort ascending
        const sorted = Array.from(allCandlesMap.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return sorted.slice(-limit);
      }
    } catch (e) {
      console.error("Provider unavailable:", e);
      // Fallback to cached entirely if fetch fails
    }

    // Sort ascending for the chart
    return candles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  /**
   * Save candles to DB safely, preventing duplicates
   */
  async saveCandles(candles: Candle[]) {
    // Validate
    const valid = candles.filter(c => 
      !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close) && !isNaN(c.volume) &&
      c.open >= 0 && c.high >= 0 && c.low >= 0 && c.close >= 0 && c.volume >= 0 &&
      c.high >= c.open && c.high >= c.close && c.low <= c.open && c.low <= c.close &&
      !isNaN(new Date(c.timestamp).getTime())
    );

    if (valid.length === 0) return;

    // Insert ignoring duplicates (Postgres ON CONFLICT DO NOTHING equivalent in Prisma)
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
  }
};
