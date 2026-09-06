import { Candle } from '../market/market-data-service';
import { Indicators } from '../market/technical-analysis';
import { DEFAULT_STRATEGY_CONFIG, StrategyConfig } from './strategy-config';

export type SignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL' | 'NO_TRADE';

export interface StrategyResult {
  strategyName: string;
  direction: SignalDirection;
  signalStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  score: number; // Contribution to total hybrid score
  maxScore: number;
  conditions: string[];
  reasoning: string[];
}

export interface MLPredictionData {
  modelVersion?: string;
  bullishProbability?: number;
  bearishProbability?: number;
  marketRegime?: string;
}

export interface StrategyEngineOutput {
  symbol: string;
  timeframe: string;
  direction: SignalDirection;
  score: number;
  maxScore: number;
  primaryStrategy: string;
  subStrategies: StrategyResult[];
  conditions: string[];
  reasoning: string[];
  timestamp: string;
  dataTimestamp: string;
}

export const strategyEngine = {
  /**
   * Evaluate EMA Trend Strategy
   */
  evaluateEMATrend(
    candles: Candle[],
    indicators: Indicators,
    config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
  ): StrategyResult {
    const { ema20, ema50 } = indicators;
    const latestClose = candles.length > 0 ? candles[candles.length - 1].close : 0;
    const conditions: string[] = [];
    const reasoning: string[] = [];

    if (!ema20 || !ema50 || !latestClose) {
      return {
        strategyName: 'EMA Trend',
        direction: 'NO_TRADE',
        signalStrength: 'NONE',
        score: 0,
        maxScore: config.hybrid.weights.emaTrend,
        conditions: ['Insufficient indicator data for EMA Trend'],
        reasoning: ['Missing EMA20 or EMA50 calculation']
      };
    }

    const isBullishCross = ema20 > ema50;
    const isPriceAboveEMA20 = latestClose > ema20;

    const isBearishCross = ema20 < ema50;
    const isPriceBelowEMA20 = latestClose < ema20;

    if (isBullishCross && isPriceAboveEMA20) {
      conditions.push(`EMA20 (${ema20.toFixed(2)}) > EMA50 (${ema50.toFixed(2)})`);
      conditions.push(`Price (${latestClose.toFixed(2)}) > EMA20`);
      reasoning.push('Strong bullish EMA trend alignment (price above EMA20 and fast EMA above slow EMA).');
      return {
        strategyName: 'EMA Trend',
        direction: 'LONG',
        signalStrength: 'STRONG',
        score: config.hybrid.weights.emaTrend,
        maxScore: config.hybrid.weights.emaTrend,
        conditions,
        reasoning
      };
    }

    if (isBullishCross) {
      conditions.push(`EMA20 (${ema20.toFixed(2)}) > EMA50 (${ema50.toFixed(2)})`);
      conditions.push(`Price (${latestClose.toFixed(2)}) <= EMA20`);
      reasoning.push('Moderate bullish trend (EMA20 > EMA50, but price consolidating below EMA20).');
      return {
        strategyName: 'EMA Trend',
        direction: 'LONG',
        signalStrength: 'MODERATE',
        score: Math.floor(config.hybrid.weights.emaTrend / 2),
        maxScore: config.hybrid.weights.emaTrend,
        conditions,
        reasoning
      };
    }

    if (isBearishCross && isPriceBelowEMA20) {
      conditions.push(`EMA20 (${ema20.toFixed(2)}) < EMA50 (${ema50.toFixed(2)})`);
      conditions.push(`Price (${latestClose.toFixed(2)}) < EMA20`);
      reasoning.push('Strong bearish EMA trend alignment.');
      return {
        strategyName: 'EMA Trend',
        direction: 'SHORT',
        signalStrength: 'STRONG',
        score: config.hybrid.weights.emaTrend,
        maxScore: config.hybrid.weights.emaTrend,
        conditions,
        reasoning
      };
    }

    if (isBearishCross) {
      conditions.push(`EMA20 (${ema20.toFixed(2)}) < EMA50 (${ema50.toFixed(2)})`);
      reasoning.push('Moderate bearish trend (EMA20 < EMA50).');
      return {
        strategyName: 'EMA Trend',
        direction: 'SHORT',
        signalStrength: 'MODERATE',
        score: Math.floor(config.hybrid.weights.emaTrend / 2),
        maxScore: config.hybrid.weights.emaTrend,
        conditions,
        reasoning
      };
    }

    return {
      strategyName: 'EMA Trend',
      direction: 'NEUTRAL',
      signalStrength: 'NONE',
      score: 0,
      maxScore: config.hybrid.weights.emaTrend,
      conditions: ['EMA lines flat or merging'],
      reasoning: ['No clear trend direction from EMA alignment']
    };
  },

  /**
   * Evaluate RSI Momentum Strategy
   */
  evaluateRSI(
    indicators: Indicators,
    config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
  ): StrategyResult {
    const { rsi } = indicators;
    const { oversold, overbought } = config.rsi;
    const conditions: string[] = [];
    const reasoning: string[] = [];

    if (rsi === undefined) {
      return {
        strategyName: 'RSI Momentum',
        direction: 'NO_TRADE',
        signalStrength: 'NONE',
        score: 0,
        maxScore: config.hybrid.weights.rsi,
        conditions: ['RSI indicator unavailable'],
        reasoning: ['Cannot evaluate momentum without RSI']
      };
    }

    if (rsi <= oversold) {
      conditions.push(`RSI (${rsi.toFixed(1)}) <= Oversold threshold (${oversold})`);
      reasoning.push('Asset is statistically oversold; high potential for bullish momentum reversal.');
      return {
        strategyName: 'RSI Momentum',
        direction: 'LONG',
        signalStrength: 'STRONG',
        score: config.hybrid.weights.rsi,
        maxScore: config.hybrid.weights.rsi,
        conditions,
        reasoning
      };
    }

    if (rsi >= overbought) {
      conditions.push(`RSI (${rsi.toFixed(1)}) >= Overbought threshold (${overbought})`);
      reasoning.push('Asset is statistically overbought; high risk of bearish pullback.');
      return {
        strategyName: 'RSI Momentum',
        direction: 'SHORT',
        signalStrength: 'STRONG',
        score: config.hybrid.weights.rsi,
        maxScore: config.hybrid.weights.rsi,
        conditions,
        reasoning
      };
    }

    // Mid-range RSI (e.g. 50-60 bullish momentum)
    if (rsi > 50 && rsi < overbought) {
      conditions.push(`RSI (${rsi.toFixed(1)}) in upper neutral zone (50-${overbought})`);
      reasoning.push('Moderate bullish momentum without oversold condition.');
      return {
        strategyName: 'RSI Momentum',
        direction: 'LONG',
        signalStrength: 'WEAK',
        score: 0, // Doesn't add score unless extreme or turning
        maxScore: config.hybrid.weights.rsi,
        conditions,
        reasoning
      };
    }

    if (rsi < 50 && rsi > oversold) {
      conditions.push(`RSI (${rsi.toFixed(1)}) in lower neutral zone (${oversold}-50)`);
      reasoning.push('Moderate bearish momentum.');
      return {
        strategyName: 'RSI Momentum',
        direction: 'SHORT',
        signalStrength: 'WEAK',
        score: 0,
        maxScore: config.hybrid.weights.rsi,
        conditions,
        reasoning
      };
    }

    return {
      strategyName: 'RSI Momentum',
      direction: 'NEUTRAL',
      signalStrength: 'NONE',
      score: 0,
      maxScore: config.hybrid.weights.rsi,
      conditions: [`RSI (${rsi.toFixed(1)}) neutral at 50`],
      reasoning: ['Momentum is strictly balanced']
    };
  },

  /**
   * Evaluate MACD Strategy
   */
  evaluateMACD(
    indicators: Indicators,
    config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
  ): StrategyResult {
    const { macd } = indicators;
    const conditions: string[] = [];
    const reasoning: string[] = [];

    if (!macd || macd.MACD === undefined || macd.signal === undefined || macd.histogram === undefined) {
      return {
        strategyName: 'MACD Momentum',
        direction: 'NO_TRADE',
        signalStrength: 'NONE',
        score: 0,
        maxScore: config.hybrid.weights.macd,
        conditions: ['MACD indicator data incomplete'],
        reasoning: ['Missing MACD line, signal line, or histogram']
      };
    }

    const isBullishCrossover = macd.MACD > macd.signal && macd.histogram > 0;
    const isBearishCrossover = macd.MACD < macd.signal && macd.histogram < 0;

    if (isBullishCrossover) {
      conditions.push(`MACD Line (${macd.MACD.toFixed(2)}) > Signal Line (${macd.signal.toFixed(2)})`);
      conditions.push(`Histogram (${macd.histogram.toFixed(2)}) is positive`);
      reasoning.push('MACD bullish crossover confirmed with positive momentum histogram.');
      return {
        strategyName: 'MACD Momentum',
        direction: 'LONG',
        signalStrength: 'STRONG',
        score: config.hybrid.weights.macd,
        maxScore: config.hybrid.weights.macd,
        conditions,
        reasoning
      };
    }

    if (isBearishCrossover) {
      conditions.push(`MACD Line (${macd.MACD.toFixed(2)}) < Signal Line (${macd.signal.toFixed(2)})`);
      conditions.push(`Histogram (${macd.histogram.toFixed(2)}) is negative`);
      reasoning.push('MACD bearish crossover confirmed with negative histogram expansion.');
      return {
        strategyName: 'MACD Momentum',
        direction: 'SHORT',
        signalStrength: 'STRONG',
        score: config.hybrid.weights.macd,
        maxScore: config.hybrid.weights.macd,
        conditions,
        reasoning
      };
    }

    return {
      strategyName: 'MACD Momentum',
      direction: 'NEUTRAL',
      signalStrength: 'NONE',
      score: 0,
      maxScore: config.hybrid.weights.macd,
      conditions: ['MACD and Signal line neutral'],
      reasoning: ['No clear MACD crossover confirmed']
    };
  },

  /**
   * Evaluate Breakout Strategy
   */
  evaluateBreakout(
    candles: Candle[],
    config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
  ): StrategyResult {
    const { lookbackPeriod, volumeMultiplier } = config.breakout;
    const conditions: string[] = [];
    const reasoning: string[] = [];

    if (!candles || candles.length < lookbackPeriod + 1) {
      return {
        strategyName: 'Swing Breakout',
        direction: 'NO_TRADE',
        signalStrength: 'NONE',
        score: 0,
        maxScore: config.hybrid.weights.breakout,
        conditions: [`Insufficient candles for ${lookbackPeriod}-period lookback`],
        reasoning: ['Not enough price action data']
      };
    }

    const currentCandle = candles[candles.length - 1];
    const previousCandles = candles.slice(candles.length - 1 - lookbackPeriod, candles.length - 1);

    const highestHigh = Math.max(...previousCandles.map(c => c.high));
    const lowestLow = Math.min(...previousCandles.map(c => c.low));

    const avgVolume = previousCandles.reduce((acc, c) => acc + c.volume, 0) / previousCandles.length;
    const isVolumeSurge = currentCandle.volume >= avgVolume * volumeMultiplier;

    if (currentCandle.close > highestHigh && isVolumeSurge) {
      conditions.push(`Current Close (${currentCandle.close.toFixed(2)}) > ${lookbackPeriod}-period High (${highestHigh.toFixed(2)})`);
      conditions.push(`Volume surge confirmed (${currentCandle.volume.toFixed(1)} vs avg ${avgVolume.toFixed(1)})`);
      reasoning.push(`High-conviction bullish breakout above recent ${lookbackPeriod}-period resistance with volume validation.`);
      return {
        strategyName: 'Swing Breakout',
        direction: 'LONG',
        signalStrength: 'STRONG',
        score: config.hybrid.weights.breakout,
        maxScore: config.hybrid.weights.breakout,
        conditions,
        reasoning
      };
    }

    if (currentCandle.close < lowestLow && isVolumeSurge) {
      conditions.push(`Current Close (${currentCandle.close.toFixed(2)}) < ${lookbackPeriod}-period Low (${lowestLow.toFixed(2)})`);
      conditions.push(`Volume surge confirmed on breakdown`);
      reasoning.push(`High-conviction bearish breakdown below ${lookbackPeriod}-period support with volume validation.`);
      return {
        strategyName: 'Swing Breakout',
        direction: 'SHORT',
        signalStrength: 'STRONG',
        score: config.hybrid.weights.breakout,
        maxScore: config.hybrid.weights.breakout,
        conditions,
        reasoning
      };
    }

    return {
      strategyName: 'Swing Breakout',
      direction: 'NEUTRAL',
      signalStrength: 'NONE',
      score: 0,
      maxScore: config.hybrid.weights.breakout,
      conditions: [`Price within ${lookbackPeriod}-period range [${lowestLow.toFixed(2)} - ${highestHigh.toFixed(2)}]`],
      reasoning: ['No resistance breakout or support breakdown detected']
    };
  },

  /**
   * Evaluate ML Model Probability
   */
  evaluateMLPrediction(
    mlPrediction?: MLPredictionData,
    config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
  ): StrategyResult {
    const conditions: string[] = [];
    const reasoning: string[] = [];
    const maxScore = config.hybrid.weights.mlPrediction;

    if (!mlPrediction || mlPrediction.bullishProbability === undefined || mlPrediction.bearishProbability === undefined) {
      return {
        strategyName: 'ML Prediction Engine',
        direction: 'NO_TRADE',
        signalStrength: 'NONE',
        score: 0,
        maxScore,
        conditions: ['ML prediction model unavailable or offline'],
        reasoning: ['Quantitative ML inference omitted']
      };
    }

    const { bullishProbability, bearishProbability, modelVersion, marketRegime } = mlPrediction;

    if (bullishProbability >= config.ml.bullishThreshold) {
      conditions.push(`ML Model (${modelVersion || 'v1'}) Bullish Probability: ${(bullishProbability * 100).toFixed(1)}%`);
      if (marketRegime) conditions.push(`Market Regime: ${marketRegime}`);
      reasoning.push(`Machine learning model predicts high probability of upward price movement over next 5 candles.`);
      return {
        strategyName: 'ML Prediction Engine',
        direction: 'LONG',
        signalStrength: bullishProbability > 0.65 ? 'STRONG' : 'MODERATE',
        score: maxScore,
        maxScore,
        conditions,
        reasoning
      };
    }

    if (bearishProbability >= config.ml.bullishThreshold) {
      conditions.push(`ML Model (${modelVersion || 'v1'}) Bearish Probability: ${(bearishProbability * 100).toFixed(1)}%`);
      if (marketRegime) conditions.push(`Market Regime: ${marketRegime}`);
      reasoning.push(`Machine learning model predicts high probability of downward price movement.`);
      return {
        strategyName: 'ML Prediction Engine',
        direction: 'SHORT',
        signalStrength: bearishProbability > 0.65 ? 'STRONG' : 'MODERATE',
        score: maxScore,
        maxScore,
        conditions,
        reasoning
      };
    }

    return {
      strategyName: 'ML Prediction Engine',
      direction: 'NEUTRAL',
      signalStrength: 'NONE',
      score: 0,
      maxScore,
      conditions: [`ML Bullish Prob (${(bullishProbability * 100).toFixed(1)}%) in neutral zone`],
      reasoning: ['Machine learning probability does not strongly lean bullish or bearish']
    };
  },

  /**
   * Hybrid Strategy Evaluator: Combines all sub-strategies into a unified score.
   */
  evaluateHybrid(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    indicators: Indicators,
    mlPrediction?: MLPredictionData,
    config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
  ): StrategyEngineOutput {
    const emaRes = this.evaluateEMATrend(candles, indicators, config);
    const rsiRes = this.evaluateRSI(indicators, config);
    const macdRes = this.evaluateMACD(indicators, config);
    const breakoutRes = this.evaluateBreakout(candles, config);
    const mlRes = this.evaluateMLPrediction(mlPrediction, config);

    const subStrategies = [emaRes, rsiRes, macdRes, breakoutRes, mlRes];

    let longScore = 0;
    let shortScore = 0;
    let maxScore = 0;

    subStrategies.forEach(s => {
      maxScore += s.maxScore;
      if (s.direction === 'LONG') {
        longScore += s.score;
      } else if (s.direction === 'SHORT') {
        shortScore += s.score;
      }
    });

    const allConditions = subStrategies.flatMap(s => s.conditions);
    const allReasoning = subStrategies.flatMap(s => s.reasoning);

    const dataTimestamp = candles.length > 0 ? candles[candles.length - 1].timestamp : new Date().toISOString();

    // Check for NO_TRADE criteria:
    // 1. Conflict check: Both Long and Short have high scores (> 3)
    if (longScore >= 3 && shortScore >= 3) {
      return {
        symbol,
        timeframe,
        direction: 'NO_TRADE',
        score: Math.max(longScore, shortScore),
        maxScore,
        primaryStrategy: 'HYBRID',
        subStrategies,
        conditions: [...allConditions, 'CONFLICTING SIGNALS: Both bullish and bearish indicators show strong scores'],
        reasoning: [...allReasoning, 'System invalidates setup due to conflicting technical & ML signals.'],
        timestamp: new Date().toISOString(),
        dataTimestamp
      };
    }

    // 2. Score threshold check
    const winningScore = Math.max(longScore, shortScore);
    if (winningScore < config.hybrid.minScoreForTrade) {
      return {
        symbol,
        timeframe,
        direction: 'NO_TRADE',
        score: winningScore,
        maxScore,
        primaryStrategy: 'HYBRID',
        subStrategies,
        conditions: [...allConditions, `INSUFFICIENT CONVICTION: Score ${winningScore}/${maxScore} is below threshold ${config.hybrid.minScoreForTrade}`],
        reasoning: [...allReasoning, `Score ${winningScore} is below minimum requirement (${config.hybrid.minScoreForTrade}/${maxScore}). Market setup is unclear.`],
        timestamp: new Date().toISOString(),
        dataTimestamp
      };
    }

    const direction: SignalDirection = longScore > shortScore ? 'LONG' : 'SHORT';

    return {
      symbol,
      timeframe,
      direction,
      score: winningScore,
      maxScore,
      primaryStrategy: 'HYBRID',
      subStrategies,
      conditions: allConditions,
      reasoning: allReasoning,
      timestamp: new Date().toISOString(),
      dataTimestamp
    };
  }
};
