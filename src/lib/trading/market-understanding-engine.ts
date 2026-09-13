import { Candle, CanonicalMarketSnapshot } from '../market/market-data-service';
import { Indicators, technicalAnalysisService } from '../market/technical-analysis';

export type MarketRegime =
  | 'TRENDING_BULL'
  | 'TRENDING_BEAR'
  | 'RANGING'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'BREAKOUT'
  | 'UNKNOWN';

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'SIDEWAYS';
export type MomentumState = 'BULLISH' | 'BEARISH' | 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
export type VolatilityState = 'HIGH' | 'MEDIUM' | 'LOW' | 'EXPANDING' | 'CONTRACTING';
export type VolumeCondition = 'HIGH' | 'NORMAL' | 'LOW' | 'SURGE' | 'DRYING_UP';

export interface MarketUnderstandingContext {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  marketRegime: MarketRegime;
  trend: TrendDirection;
  momentum: MomentumState;
  volatility: VolatilityState;
  volumeCondition: VolumeCondition;
  support: number;
  resistance: number;
  priceActionState: string;
  regimeConfidence: number; // 0 to 1
  indicators: Indicators;
  summary: string;
  observations: string[];
}

export class MarketUnderstandingEngine {
  /**
   * Understand the market context across indicators, price action, volume, and regime.
   */
  static understand(
    snapshot: CanonicalMarketSnapshot,
    indicators?: Indicators
  ): MarketUnderstandingContext {
    const candles = snapshot.candles || [];
    const currentPrice = snapshot.lastPrice;
    const computedIndicators = indicators || technicalAnalysisService.calculateIndicators(candles);
    const observations: string[] = [];

    if (!candles || candles.length < 10) {
      return {
        symbol: snapshot.symbol,
        timeframe: snapshot.timeframe,
        currentPrice,
        marketRegime: 'UNKNOWN',
        trend: 'NEUTRAL',
        momentum: 'NEUTRAL',
        volatility: 'MEDIUM',
        volumeCondition: 'NORMAL',
        support: currentPrice * 0.98,
        resistance: currentPrice * 1.02,
        priceActionState: 'INSUFFICIENT_DATA',
        regimeConfidence: 0.1,
        indicators: computedIndicators,
        summary: 'Insufficient candle history to establish market understanding.',
        observations: ['Candle count < 10']
      };
    }

    const { rsi, ema20, ema50, macd, bollingerBands, atr, adx, superTrend, volume } = computedIndicators;

    // 1. Trend Analysis (EMA20 vs EMA50, SuperTrend, price vs EMA)
    let trend: TrendDirection = 'NEUTRAL';
    let bullTrendPoints = 0;
    let bearTrendPoints = 0;

    if (ema20 && ema50) {
      if (ema20 > ema50) {
        bullTrendPoints += 2;
        observations.push(`Fast EMA20 ($${ema20.toFixed(2)}) > Slow EMA50 ($${ema50.toFixed(2)})`);
      } else {
        bearTrendPoints += 2;
        observations.push(`Fast EMA20 ($${ema20.toFixed(2)}) < Slow EMA50 ($${ema50.toFixed(2)})`);
      }
    }

    if (ema20) {
      if (currentPrice > ema20) bullTrendPoints++;
      else bearTrendPoints++;
    }

    if (superTrend) {
      if (superTrend.direction === 'BULLISH') {
        bullTrendPoints += 2;
        observations.push(`SuperTrend is BULLISH (Support band at $${superTrend.lower})`);
      } else {
        bearTrendPoints += 2;
        observations.push(`SuperTrend is BEARISH (Resistance band at $${superTrend.upper})`);
      }
    }

    if (bullTrendPoints >= 4) trend = 'BULLISH';
    else if (bearTrendPoints >= 4) trend = 'BEARISH';
    else if (Math.abs(bullTrendPoints - bearTrendPoints) <= 1) trend = 'SIDEWAYS';
    else trend = 'NEUTRAL';

    // 2. Momentum Analysis (RSI, MACD)
    let momentum: MomentumState = 'NEUTRAL';
    if (rsi !== undefined) {
      if (rsi >= 70) {
        momentum = 'OVERBOUGHT';
        observations.push(`RSI (${rsi.toFixed(1)}) in Overbought territory (>=70)`);
      } else if (rsi <= 30) {
        momentum = 'OVERSOLD';
        observations.push(`RSI (${rsi.toFixed(1)}) in Oversold territory (<=30)`);
      } else if (rsi > 55) {
        momentum = 'BULLISH';
      } else if (rsi < 45) {
        momentum = 'BEARISH';
      }
    }

    if (macd && macd.histogram !== undefined) {
      if (macd.histogram > 0 && momentum !== 'OVERBOUGHT') {
        if (momentum === 'NEUTRAL') momentum = 'BULLISH';
        observations.push(`MACD histogram positive (+${macd.histogram.toFixed(2)})`);
      } else if (macd.histogram < 0 && momentum !== 'OVERSOLD') {
        if (momentum === 'NEUTRAL') momentum = 'BEARISH';
        observations.push(`MACD histogram negative (${macd.histogram.toFixed(2)})`);
      }
    }

    // 3. Volatility Analysis (ATR, Bollinger Band Width)
    let volatility: VolatilityState = 'MEDIUM';
    let bbWidthPct = 0;
    if (bollingerBands && bollingerBands.middle && bollingerBands.upper && bollingerBands.lower) {
      bbWidthPct = (bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle;
      if (bbWidthPct > 0.04) volatility = 'HIGH';
      else if (bbWidthPct < 0.015) volatility = 'LOW';
      else volatility = 'MEDIUM';
    } else if (atr && currentPrice > 0) {
      const atrPct = atr / currentPrice;
      if (atrPct > 0.02) volatility = 'HIGH';
      else if (atrPct < 0.006) volatility = 'LOW';
    }

    // 4. Volume Condition
    let volumeCondition: VolumeCondition = 'NORMAL';
    if (volume) {
      if (volume.isSurge) {
        volumeCondition = 'SURGE';
        observations.push(`Volume surge detected (${volume.ratio}x 20-period average)`);
      } else if (volume.ratio > 1.2) {
        volumeCondition = 'HIGH';
      } else if (volume.ratio < 0.6) {
        volumeCondition = 'DRYING_UP';
        observations.push(`Volume drying up (${volume.ratio}x 20-period average)`);
      } else if (volume.ratio < 0.8) {
        volumeCondition = 'LOW';
      }
    }

    // 5. Price Action (Support, Resistance, Swings, Wicks)
    const recent20 = candles.slice(-20);
    const highs = recent20.map(c => c.high);
    const lows = recent20.map(c => c.low);
    const resistance = Number(Math.max(...highs).toFixed(2));
    const support = Number(Math.min(...lows).toFixed(2));

    const latestCandle = candles[candles.length - 1];
    const prevCandle = candles.length >= 2 ? candles[candles.length - 2] : latestCandle;

    let priceActionState = 'RANGE_BOUND';
    const isHigherHigh = latestCandle.high > prevCandle.high;
    const isHigherLow = latestCandle.low > prevCandle.low;
    const isLowerHigh = latestCandle.high < prevCandle.high;
    const isLowerLow = latestCandle.low < prevCandle.low;

    const candleRange = latestCandle.high - latestCandle.low;
    const upperWick = latestCandle.high - Math.max(latestCandle.open, latestCandle.close);
    const lowerWick = Math.min(latestCandle.open, latestCandle.close) - latestCandle.low;

    if (candleRange > 0 && upperWick / candleRange > 0.45) {
      priceActionState = 'BEARISH_REJECTION_WICK';
      observations.push('Long upper wick indicates overhead selling pressure');
    } else if (candleRange > 0 && lowerWick / candleRange > 0.45) {
      priceActionState = 'BULLISH_REJECTION_WICK';
      observations.push('Long lower wick indicates dip buying support');
    } else if (isHigherHigh && isHigherLow) {
      priceActionState = 'HIGHER_HIGHS';
    } else if (isLowerHigh && isLowerLow) {
      priceActionState = 'LOWER_LOWS';
    } else if (latestCandle.high <= prevCandle.high && latestCandle.low >= prevCandle.low) {
      priceActionState = 'INSIDE_BAR';
      observations.push('Inside bar consolidation formed');
    }

    // 6. Market Regime Classification
    // Possible regimes: TRENDING_BULL, TRENDING_BEAR, RANGING, HIGH_VOLATILITY, LOW_VOLATILITY, BREAKOUT, UNKNOWN
    let marketRegime: MarketRegime = 'RANGING';
    let regimeConfidence = 0.70;

    const isBreakout = (currentPrice > resistance * 0.998 || currentPrice < support * 1.002) && (volumeCondition === 'SURGE' || volumeCondition === 'HIGH');
    const adxValue = adx || 20;

    if (isBreakout) {
      marketRegime = 'BREAKOUT';
      regimeConfidence = 0.85;
      observations.push(`Breakout in progress at key level with ${volumeCondition} volume`);
    } else if (volatility === 'HIGH' && bbWidthPct > 0.045) {
      marketRegime = 'HIGH_VOLATILITY';
      regimeConfidence = 0.80;
      observations.push('High volatility regime: wide bands and elevated ATR');
    } else if (adxValue >= 25 && trend === 'BULLISH') {
      marketRegime = 'TRENDING_BULL';
      regimeConfidence = Math.min(0.95, 0.65 + (adxValue / 100));
      observations.push(`Strong bullish trend (ADX: ${adxValue.toFixed(1)})`);
    } else if (adxValue >= 25 && trend === 'BEARISH') {
      marketRegime = 'TRENDING_BEAR';
      regimeConfidence = Math.min(0.95, 0.65 + (adxValue / 100));
      observations.push(`Strong bearish trend (ADX: ${adxValue.toFixed(1)})`);
    } else if (volatility === 'LOW' && adxValue < 20) {
      marketRegime = 'LOW_VOLATILITY';
      regimeConfidence = 0.75;
      observations.push('Low volatility squeeze with subdued ADX');
    } else {
      marketRegime = 'RANGING';
      regimeConfidence = 0.70;
      observations.push(`Price oscillating within range [$${support} - $${resistance}]`);
    }

    const summary = `${marketRegime} regime on ${snapshot.symbol} (${snapshot.timeframe}). Trend: ${trend}, Momentum: ${momentum}, Volatility: ${volatility}, Volume: ${volumeCondition}. Price Action: ${priceActionState}.`;

    return {
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      currentPrice,
      marketRegime,
      trend,
      momentum,
      volatility,
      volumeCondition,
      support,
      resistance,
      priceActionState,
      regimeConfidence: Number(regimeConfidence.toFixed(2)),
      indicators: computedIndicators,
      summary,
      observations
    };
  }
}
