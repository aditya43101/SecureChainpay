import { SMA, EMA, RSI, MACD, BollingerBands, ATR } from 'technicalindicators';
import { Candle } from './market-data-service';

export interface Indicators {
  rsi?: number;
  sma20?: number;
  ema20?: number;
  ema50?: number;
  macd?: {
    MACD?: number;
    signal?: number;
    histogram?: number;
  };
  bollingerBands?: {
    upper?: number;
    middle?: number;
    lower?: number;
  };
  atr?: number;
  volatility?: number;
}

export const technicalAnalysisService = {
  /**
   * Calculate indicators for a given set of candles.
   * Expects candles to be sorted chronologically (oldest to newest).
   */
  calculateIndicators(candles: Candle[]): Indicators {
    if (!candles || candles.length < 50) {
      return {}; // Not enough data
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // Latest Values
    const getLatest = (arr: any[]) => arr.length > 0 ? arr[arr.length - 1] : undefined;

    // RSI (14 period)
    const rsiResult = RSI.calculate({ values: closes, period: 14 });
    const rsi = getLatest(rsiResult);

    // SMA (20 period)
    const sma20Result = SMA.calculate({ values: closes, period: 20 });
    const sma20 = getLatest(sma20Result);

    // EMA (20 & 50 period)
    const ema20Result = EMA.calculate({ values: closes, period: 20 });
    const ema50Result = EMA.calculate({ values: closes, period: 50 });
    const ema20 = getLatest(ema20Result);
    const ema50 = getLatest(ema50Result);

    // MACD (12, 26, 9)
    const macdResult = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
    const macd = getLatest(macdResult);

    // Bollinger Bands (20 period, 2 std dev)
    const bbResult = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
    const bollingerBands = getLatest(bbResult);

    // ATR (14 period)
    const atrResult = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const atr = getLatest(atrResult);

    // Basic historical volatility estimation based on standard deviation of daily returns
    let volatility;
    if (closes.length >= 20) {
      const returns = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
      const recentReturns = returns.slice(-20);
      const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
      const variance = recentReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentReturns.length;
      const stdDev = Math.sqrt(variance);
      // Annualize volatility assuming typical 365 trading days for crypto
      volatility = stdDev * Math.sqrt(365) * 100;
    }

    return {
      rsi,
      sma20,
      ema20,
      ema50,
      macd: macd ? {
        MACD: macd.MACD,
        signal: macd.signal,
        histogram: macd.histogram
      } : undefined,
      bollingerBands: bollingerBands ? {
        upper: bollingerBands.upper,
        middle: bollingerBands.middle,
        lower: bollingerBands.lower
      } : undefined,
      atr,
      volatility: volatility ? Number(volatility.toFixed(2)) : undefined
    };
  }
};
