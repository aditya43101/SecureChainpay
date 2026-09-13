import { SMA, EMA, RSI, MACD, BollingerBands, ATR, ADX } from 'technicalindicators';
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
  adx?: number;
  superTrend?: {
    direction: 'BULLISH' | 'BEARISH';
    upper: number;
    lower: number;
    value: number;
  };
  volume?: {
    current: number;
    average20: number;
    ratio: number;
    isSurge: boolean;
  };
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

    // ADX (14 period)
    let adx: number | undefined;
    try {
      const adxResult = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
      const latestAdx = getLatest(adxResult);
      if (latestAdx && typeof latestAdx.adx === 'number') {
        adx = Number(latestAdx.adx.toFixed(2));
      }
    } catch {
      // Non-blocking fallback
    }

    // SuperTrend (period 10, multiplier 3.0)
    let superTrend: { direction: 'BULLISH' | 'BEARISH'; upper: number; lower: number; value: number } | undefined;
    if (atr && closes.length >= 10) {
      const latestClose = closes[closes.length - 1];
      const latestHigh = highs[highs.length - 1];
      const latestLow = lows[lows.length - 1];
      const hl2 = (latestHigh + latestLow) / 2;
      const upper = hl2 + 3.0 * atr;
      const lower = hl2 - 3.0 * atr;
      const direction: 'BULLISH' | 'BEARISH' = latestClose >= lower ? 'BULLISH' : 'BEARISH';
      superTrend = {
        direction,
        upper: Number(upper.toFixed(2)),
        lower: Number(lower.toFixed(2)),
        value: Number((direction === 'BULLISH' ? lower : upper).toFixed(2))
      };
    }

    // Volume Analysis (vs 20-period moving average)
    let volumeMetric: { current: number; average20: number; ratio: number; isSurge: boolean } | undefined;
    const volumes = candles.map(c => c.volume);
    if (volumes.length >= 5) {
      const currentVol = volumes[volumes.length - 1];
      const lookback = Math.min(20, volumes.length);
      const avg20 = volumes.slice(-lookback).reduce((a, b) => a + b, 0) / lookback;
      const ratio = avg20 > 0 ? Number((currentVol / avg20).toFixed(2)) : 1;
      volumeMetric = {
        current: Number(currentVol.toFixed(2)),
        average20: Number(avg20.toFixed(2)),
        ratio,
        isSurge: ratio >= 1.5
      };
    }

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
      adx,
      superTrend,
      volume: volumeMetric,
      volatility: volatility ? Number(volatility.toFixed(2)) : undefined
    };
  }
};
