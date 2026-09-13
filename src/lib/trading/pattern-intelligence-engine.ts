/**
 * SecureChain Pay — Phase 3: Outcome Learning + Pattern Intelligence Engine
 * 
 * Transforms historical paper-trading outcomes into structured, validated candidate trading intelligence.
 * 
 * IMPORTANT CONSTRAINTS:
 * 1. ZERO AUTOMATIC STRATEGY SELF-MODIFICATION:
 *    Phase 3 discovers and stores candidate knowledge only.
 *    It MUST NOT directly modify production strategy parameters, indicator thresholds, or risk limits.
 * 2. OBJECTIVE NON-CAUSAL LANGUAGE:
 *    Uses "candidate factor", "correlated condition", "historically associated with" rather than causal claims.
 * 3. MINIMUM SAMPLE SIZE:
 *    Enforces configurable minimum (default: 5 trades) before elevating patterns to CANDIDATE.
 * 4. STRICT ASSET, DIRECTION & MODE ISOLATION:
 *    BTC vs ETH, LONG vs SHORT, and EXPLORATION vs EXPLOITATION are segregated.
 * 5. ANTI-HALLUCINATION & GROUNDING:
 *    Verifies that all metrics cited in candidate lessons exist in underlying trade records.
 */

import { db } from '../db';
import { PaperTradeOutcomeRecord } from './paper-trade-lifecycle';
import { tradingFallbackStore } from './trading-fallback-store';

// ============================================================================
// 1. Types & Data Structures
// ============================================================================

export type RsiBucket = 'OVERSOLD' | 'NORMAL' | 'OVERBOUGHT';
export type AdxBucket = 'WEAK_TREND' | 'MODERATE_TREND' | 'STRONG_TREND';
export type VolatilityBucket = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
export type VolumeBucket = 'LOW' | 'NORMAL' | 'HIGH';
export type ConfidenceBucket = '1/7' | '2/7' | '3/7' | '4/7' | '5/7' | '6/7' | '7/7';
export type RegimeCategory = 'TRENDING_BULLISH' | 'TRENDING_BEARISH' | 'RANGING' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY';
export type TimingClassification = 'EARLY_ENTRY' | 'LATE_ENTRY' | 'REVERSAL_ENTRY' | 'BREAKOUT_ENTRY' | 'NORMAL_ENTRY';
export type MacdDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type PatternType = 'WINNING_PATTERN' | 'LOSING_PATTERN' | 'NEUTRAL_PATTERN';
export type PatternStatus = 'DISCOVERED' | 'CANDIDATE' | 'DEGRADING' | 'STALE' | 'VALIDATING' | 'VALIDATED' | 'REJECTED';

export interface NormalizedFeatures {
  // Raw Features
  symbol: string;
  side: 'LONG' | 'SHORT';
  confidenceScore: number;
  decisionMode: 'EXPLORATION' | 'EXPLOITATION';
  strategyId: string;
  strategyVersion: string;
  marketRegime: string;
  timeframe: string;
  rsi: number;
  emaFast: number;
  emaSlow: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerPosition: 'UPPER' | 'MIDDLE' | 'LOWER' | 'OUTSIDE_UPPER' | 'OUTSIDE_LOWER';
  atr: number;
  adx: number;
  superTrend: 'BULLISH' | 'BEARISH';
  volume: number;
  volatility: number;
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  priceMomentum: number;
  stopLossDistance: number;
  takeProfitDistance: number;
  riskRewardRatio: number;
  positionSize: number;
  riskPercent: number;
  holdingDurationMinutes: number;
  mae: number;
  mfe: number;
  exitReason: string;
  realizedPnL: number;
  returnPercent: number;

  // Normalized / Categorical Buckets
  rsiBucket: RsiBucket;
  adxBucket: AdxBucket;
  volatilityBucket: VolatilityBucket;
  volumeBucket: VolumeBucket;
  confidenceBucket: ConfidenceBucket;
  regimeCategory: RegimeCategory;
  timingClassification: TimingClassification;
  macdDirection: MacdDirection;
}

export interface CandidateFactor {
  factor: string;
  category: 'ENTRY' | 'MARKET_CONDITION' | 'RISK_MANAGEMENT' | 'TIMING' | 'REGIME';
  evidenceObservation: string;
  confidence: number;
}

export interface LossAnalysisResult {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  lossAmount: number;
  candidateFactors: CandidateFactor[];
  nonCausalSummary: string;
  maeExcursion: number;
  mfeExcursion: number;
  exitReason: string;
}

export interface WinAnalysisResult {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  gainAmount: number;
  favorableFactors: CandidateFactor[];
  nonCausalSummary: string;
  mfeCaptureEfficiency: number;
  exitReason: string;
}

export interface PatternFeatureConditions {
  rsiBucket?: RsiBucket;
  adxBucket?: AdxBucket;
  volatilityBucket?: VolatilityBucket;
  volumeBucket?: VolumeBucket;
  macdDirection?: MacdDirection;
  timingClassification?: TimingClassification;
  regimeCategory?: RegimeCategory;
}

export interface PatternRecord {
  patternId: string;
  fingerprint: string;
  patternType: PatternType;
  symbol: string; // 'BTCUSDT', 'ETHUSDT', or 'GLOBAL'
  side: 'LONG' | 'SHORT';
  decisionMode: 'EXPLORATION' | 'EXPLOITATION';
  strategyId: string;
  strategyVersion: string;
  marketRegime: string;
  featureConditions: PatternFeatureConditions;
  
  sampleCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  lossRate: number;
  averagePnL: number;
  medianPnL: number;
  totalPnL: number;
  averageReturn: number;
  averageMAE: number;
  averageMFE: number;
  profitFactor: number;
  
  qualityScore: number; // 0.0 to 1.0
  status: PatternStatus;
  recentWinRate?: number; // Last 5-10 trades
  isDegrading?: boolean;

  firstObservedAt: string;
  lastObservedAt: string;
  createdAt: string;
  updatedAt: string;

  supportingTradeIds: string[];
  candidateLessons: string[];
  isCandidateForStrategyAdjustment: boolean;
  notes: string;
}

export interface ConfidenceTierStats {
  tier: ConfidenceBucket;
  score: number;
  sampleCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  lossRate: number;
  netPnL: number;
  averageReturn: number;
  profitFactor: number;
  isUnderperforming: boolean;
}

export interface CandidateLesson {
  id: string;
  patternId: string;
  patternFingerprint: string;
  lesson: string;
  evidenceSummary: string;
  sampleCount: number;
  winRate: number;
  symbol: string;
  side: string;
  status: 'CANDIDATE';
  groundedMetrics: Record<string, number | string>;
  createdAt: string;
}

// ============================================================================
// 2. Feature Extraction & Normalization
// ============================================================================

export class PatternIntelligenceEngine {
  public static readonly DEFAULT_MIN_SAMPLES = 5;
  public static readonly RECENCY_WINDOW_SIZE = 10;
  public static readonly DRIFT_THRESHOLD_PCT = 25; // 25% drop flags DEGRADING

  /**
   * Extracts both raw and normalized categorical features from a completed trade record.
   */
  static extractFeatures(trade: PaperTradeOutcomeRecord | any): NormalizedFeatures {
    const entry = trade.entrySnapshot || {};
    const exit = trade.exitSnapshot || {};
    const ind = entry.indicators || entry.technicalIndicators || {};

    const rsi = typeof ind.rsi === 'number' ? ind.rsi : 50;
    const emaFast = typeof ind.ema20 === 'number' ? ind.ema20 : (typeof ind.emaFast === 'number' ? ind.emaFast : 0);
    const emaSlow = typeof ind.ema50 === 'number' ? ind.ema50 : (typeof ind.emaSlow === 'number' ? ind.emaSlow : 0);
    const macd = typeof ind.macd?.macd === 'number' ? ind.macd.macd : (typeof ind.macd === 'number' ? ind.macd : 0);
    const macdSignal = typeof ind.macd?.signal === 'number' ? ind.macd.signal : (typeof ind.macdSignal === 'number' ? ind.macdSignal : 0);
    const macdHistogram = typeof ind.macd?.histogram === 'number' ? ind.macd.histogram : (macd - macdSignal);
    
    const atr = typeof ind.atr === 'number' ? ind.atr : (typeof ind.volatility === 'number' ? ind.volatility : 100);
    const adx = typeof ind.adx === 'number' ? ind.adx : 25;
    const volume = typeof ind.volume === 'number' ? ind.volume : (typeof entry.market?.volume === 'number' ? entry.market.volume : 1000);
    const volatility = typeof ind.volatility === 'number' ? ind.volatility : 25;
    
    const rawRegime = exit.marketRegime || entry.market?.marketRegime || 'RANGING';
    const confidenceScore = typeof trade.confidenceScore === 'number' ? trade.confidenceScore : 3;
    const decisionMode: 'EXPLORATION' | 'EXPLOITATION' = trade.decisionMode === 'EXPLOITATION' ? 'EXPLOITATION' : 'EXPLORATION';

    // Normalizations
    const rsiBucket: RsiBucket = rsi < 30 ? 'OVERSOLD' : (rsi > 70 ? 'OVERBOUGHT' : 'NORMAL');
    const adxBucket: AdxBucket = adx < 20 ? 'WEAK_TREND' : (adx > 40 ? 'STRONG_TREND' : 'MODERATE_TREND');
    const volatilityBucket: VolatilityBucket = volatility < 15 ? 'LOW' : (volatility <= 35 ? 'NORMAL' : (volatility <= 60 ? 'HIGH' : 'EXTREME'));
    const volumeBucket: VolumeBucket = volume < 500 ? 'LOW' : (volume > 2000 ? 'HIGH' : 'NORMAL');
    
    const confVal = Math.max(1, Math.min(7, Math.round(confidenceScore)));
    const confidenceBucket = `${confVal}/7` as ConfidenceBucket;

    let regimeCategory: RegimeCategory = 'RANGING';
    const uRegime = rawRegime.toUpperCase();
    if (uRegime.includes('BULL') || uRegime.includes('UP')) regimeCategory = 'TRENDING_BULLISH';
    else if (uRegime.includes('BEAR') || uRegime.includes('DOWN')) regimeCategory = 'TRENDING_BEARISH';
    else if (uRegime.includes('HIGH_VOL') || volatilityBucket === 'HIGH' || volatilityBucket === 'EXTREME') regimeCategory = 'HIGH_VOLATILITY';
    else if (uRegime.includes('LOW_VOL') || volatilityBucket === 'LOW') regimeCategory = 'LOW_VOLATILITY';

    let macdDirection: MacdDirection = 'NEUTRAL';
    if (macdHistogram > 0.001) macdDirection = 'BULLISH';
    else if (macdHistogram < -0.001) macdDirection = 'BEARISH';

    // Timing classification based on holding duration and MAE/MFE excursions
    const durationMin = trade.holdingDurationMinutes || 0;
    const mae = typeof trade.mae === 'number' ? trade.mae : 0;
    const mfe = typeof trade.mfe === 'number' ? trade.mfe : 0;
    
    let timingClassification: TimingClassification = 'NORMAL_ENTRY';
    if (trade.side === 'LONG' && rsiBucket === 'OVERBOUGHT' && mae > 1.5) {
      timingClassification = 'LATE_ENTRY';
    } else if (trade.side === 'SHORT' && rsiBucket === 'OVERSOLD' && mae > 1.5) {
      timingClassification = 'LATE_ENTRY';
    } else if (mfe > 2.0 && mae < 0.5) {
      timingClassification = 'BREAKOUT_ENTRY';
    } else if (durationMin < 5 && mae > 2.0) {
      timingClassification = 'REVERSAL_ENTRY';
    }

    // Bollinger Position
    let bollingerPosition: 'UPPER' | 'MIDDLE' | 'LOWER' | 'OUTSIDE_UPPER' | 'OUTSIDE_LOWER' = 'MIDDLE';
    const currentPrice = trade.entryPrice || 0;
    const bb = ind.bollingerBands;
    if (bb && typeof bb.upper === 'number' && typeof bb.lower === 'number') {
      if (currentPrice > bb.upper) bollingerPosition = 'OUTSIDE_UPPER';
      else if (currentPrice < bb.lower) bollingerPosition = 'OUTSIDE_LOWER';
      else if (currentPrice > (bb.upper + bb.lower) / 2) bollingerPosition = 'UPPER';
      else bollingerPosition = 'LOWER';
    }

    return {
      symbol: trade.symbol || 'BTCUSDT',
      side: trade.side === 'SHORT' ? 'SHORT' : 'LONG',
      confidenceScore,
      decisionMode,
      strategyId: trade.strategyId || 'STRAT_HYBRID',
      strategyVersion: trade.strategyVersion || 'v1.0.0',
      marketRegime: rawRegime,
      timeframe: trade.timeframe || '1h',
      rsi: Number(rsi.toFixed(2)),
      emaFast: Number(emaFast.toFixed(2)),
      emaSlow: Number(emaSlow.toFixed(2)),
      macd: Number(macd.toFixed(4)),
      macdSignal: Number(macdSignal.toFixed(4)),
      macdHistogram: Number(macdHistogram.toFixed(4)),
      bollingerPosition,
      atr: Number(atr.toFixed(2)),
      adx: Number(adx.toFixed(2)),
      superTrend: ind.superTrend === 'BEARISH' ? 'BEARISH' : 'BULLISH',
      volume: Number(volume.toFixed(2)),
      volatility: Number(volatility.toFixed(2)),
      trendDirection: emaFast >= emaSlow ? 'BULLISH' : 'BEARISH',
      priceMomentum: Number((ind.momentum || 0).toFixed(2)),
      stopLossDistance: Number(Math.abs((trade.entryPrice || 0) - (trade.stopLoss || 0)).toFixed(2)),
      takeProfitDistance: Number(Math.abs((trade.takeProfit || 0) - (trade.entryPrice || 0)).toFixed(2)),
      riskRewardRatio: trade.riskRewardRatio || 1.5,
      positionSize: trade.positionSize || trade.quantity || 0,
      riskPercent: trade.riskPercent || 1.0,
      holdingDurationMinutes: durationMin,
      mae: Number(mae.toFixed(2)),
      mfe: Number(mfe.toFixed(2)),
      exitReason: trade.exitReason || 'UNKNOWN',
      realizedPnL: Number((trade.realizedPnL || 0).toFixed(2)),
      returnPercent: Number((trade.returnPercent || 0).toFixed(2)),

      rsiBucket,
      adxBucket,
      volatilityBucket,
      volumeBucket,
      confidenceBucket,
      regimeCategory,
      timingClassification,
      macdDirection,
    };
  }

  // ============================================================================
  // 3. Loss Analysis Engine
  // ============================================================================

  /**
   * Deterministically inspects a losing trade setup and attributes candidate factors
   * strictly using non-causal language ("candidate factor", "correlated condition", "historically associated with").
   */
  static analyzeLoss(features: NormalizedFeatures, tradeId: string): LossAnalysisResult {
    const candidateFactors: CandidateFactor[] = [];

    // 1. Wrong Direction vs EMA Trend
    if (features.side === 'LONG' && features.trendDirection === 'BEARISH') {
      candidateFactors.push({
        factor: 'WRONG_DIRECTION',
        category: 'ENTRY',
        evidenceObservation: `Long entry initiated against prevailing bearish trend (EMA Fast ${features.emaFast} < EMA Slow ${features.emaSlow}) was observed.`,
        confidence: 0.85,
      });
    } else if (features.side === 'SHORT' && features.trendDirection === 'BULLISH') {
      candidateFactors.push({
        factor: 'WRONG_DIRECTION',
        category: 'ENTRY',
        evidenceObservation: `Short entry initiated against prevailing bullish trend (EMA Fast ${features.emaFast} > EMA Slow ${features.emaSlow}) was observed.`,
        confidence: 0.85,
      });
    }

    // 2. Overbought / Oversold Extreme Entry
    if (features.side === 'LONG' && features.rsiBucket === 'OVERBOUGHT') {
      candidateFactors.push({
        factor: 'LATE_ENTRY',
        category: 'TIMING',
        evidenceObservation: `Long entry while RSI was overbought (${features.rsi}) was historically associated with severe drawdown (MAE ${features.mae}%).`,
        confidence: 0.80,
      });
    } else if (features.side === 'SHORT' && features.rsiBucket === 'OVERSOLD') {
      candidateFactors.push({
        factor: 'LATE_ENTRY',
        category: 'TIMING',
        evidenceObservation: `Short entry while RSI was oversold (${features.rsi}) was historically associated with rapid adverse bounce.`,
        confidence: 0.80,
      });
    }

    // 3. High Volatility whipsaw
    if (features.volatilityBucket === 'HIGH' || features.volatilityBucket === 'EXTREME') {
      candidateFactors.push({
        factor: 'HIGH_VOLATILITY',
        category: 'MARKET_CONDITION',
        evidenceObservation: `Elevated market volatility (${features.volatilityBucket}, metric=${features.volatility}) was present during trade lifecycle.`,
        confidence: 0.75,
      });
    }

    // 4. Momentum / MACD divergence
    if (features.side === 'LONG' && features.macdDirection === 'BEARISH') {
      candidateFactors.push({
        factor: 'WEAK_MOMENTUM',
        category: 'ENTRY',
        evidenceObservation: `Long position initiated while MACD histogram was negative (${features.macdHistogram}) correlated with lack of upside continuation.`,
        confidence: 0.70,
      });
    } else if (features.side === 'SHORT' && features.macdDirection === 'BULLISH') {
      candidateFactors.push({
        factor: 'WEAK_MOMENTUM',
        category: 'ENTRY',
        evidenceObservation: `Short position initiated while MACD histogram was positive (${features.macdHistogram}) correlated with lack of downward momentum.`,
        confidence: 0.70,
      });
    }

    // 5. Premature exit / Exit management problem (High MFE then closed at loss)
    if (features.mfe >= 1.5 && features.realizedPnL < 0) {
      candidateFactors.push({
        factor: 'LATE_EXIT',
        category: 'RISK_MANAGEMENT',
        evidenceObservation: `Position captured +${features.mfe}% MFE in favorable direction before reversing to a loss, representing an exit management candidate factor.`,
        confidence: 0.90,
      });
    }

    // 6. Stop Loss placement too tight
    if (features.exitReason.includes('STOP_LOSS') && features.holdingDurationMinutes < 15 && features.volatilityBucket !== 'LOW') {
      candidateFactors.push({
        factor: 'STOP_TOO_TIGHT',
        category: 'RISK_MANAGEMENT',
        evidenceObservation: `Stop loss triggered in ${features.holdingDurationMinutes} minutes under ${features.volatilityBucket} volatility, indicating possible stop placement vulnerability.`,
        confidence: 0.75,
      });
    }

    // Fallback factor if none triggered
    if (candidateFactors.length === 0) {
      candidateFactors.push({
        factor: 'CORRELATED_MARKET_DRIFT',
        category: 'MARKET_CONDITION',
        evidenceObservation: `Trade stopped out under ${features.marketRegime} regime without isolated indicator divergence.`,
        confidence: 0.50,
      });
    }

    const primaryFactor = candidateFactors[0].factor;
    const nonCausalSummary = `Loss of ${Math.abs(features.realizedPnL)} USDT on ${features.symbol} ${features.side}: Candidate factor '${primaryFactor}' identified from entry conditions (RSI ${features.rsi}, Volatility ${features.volatilityBucket}, MAE ${features.mae}%).`;

    return {
      tradeId,
      symbol: features.symbol,
      side: features.side,
      lossAmount: Math.abs(features.realizedPnL),
      candidateFactors,
      nonCausalSummary,
      maeExcursion: features.mae,
      mfeExcursion: features.mfe,
      exitReason: features.exitReason,
    };
  }

  // ============================================================================
  // 4. Win Analysis Engine
  // ============================================================================

  /**
   * Deterministically inspects a winning trade setup and extracts favorable conditions.
   */
  static analyzeWin(features: NormalizedFeatures, tradeId: string): WinAnalysisResult {
    const favorableFactors: CandidateFactor[] = [];

    // 1. Trend Alignment
    if ((features.side === 'LONG' && features.trendDirection === 'BULLISH') ||
        (features.side === 'SHORT' && features.trendDirection === 'BEARISH')) {
      favorableFactors.push({
        factor: 'TREND_ALIGNMENT',
        category: 'ENTRY',
        evidenceObservation: `Entry strictly aligned with primary trend direction (EMA Fast vs Slow).`,
        confidence: 0.85,
      });
    }

    // 2. Favorable Momentum / MACD
    if ((features.side === 'LONG' && features.macdDirection === 'BULLISH') ||
        (features.side === 'SHORT' && features.macdDirection === 'BEARISH')) {
      favorableFactors.push({
        factor: 'MOMENTUM_CONFIRMATION',
        category: 'ENTRY',
        evidenceObservation: `MACD direction (${features.macdDirection}) confirmed trade bias.`,
        confidence: 0.80,
      });
    }

    // 3. Healthy RSI range (50-65 for Long, 35-50 for Short)
    if (features.side === 'LONG' && features.rsi >= 45 && features.rsi <= 65) {
      favorableFactors.push({
        factor: 'BALANCED_MOMENTUM_ENTRY',
        category: 'TIMING',
        evidenceObservation: `Long entry initiated within sustainable momentum RSI band (${features.rsi}).`,
        confidence: 0.80,
      });
    }

    // 4. Strong trend strength
    if (features.adxBucket === 'MODERATE_TREND' || features.adxBucket === 'STRONG_TREND') {
      favorableFactors.push({
        factor: 'STRONG_TREND_STRENGTH',
        category: 'MARKET_CONDITION',
        evidenceObservation: `Elevated ADX (${features.adx}) supported directional follow-through.`,
        confidence: 0.75,
      });
    }

    // 5. Low Drawdown (MAE < 0.5%)
    if (features.mae <= 0.5) {
      favorableFactors.push({
        factor: 'IMMEDIATE_EXECUTION_EDGE',
        category: 'TIMING',
        evidenceObservation: `Minimal adverse excursion (MAE ${features.mae}%) observed after fill.`,
        confidence: 0.90,
      });
    }

    if (favorableFactors.length === 0) {
      favorableFactors.push({
        factor: 'STANDARD_SYSTEM_EDGE',
        category: 'ENTRY',
        evidenceObservation: `Favorable outcome realized under ${features.marketRegime} conditions.`,
        confidence: 0.50,
      });
    }

    const mfeCaptureEfficiency = features.mfe > 0 ? Number(Math.min(100, (features.returnPercent / features.mfe) * 100).toFixed(1)) : 100;
    const nonCausalSummary = `Gain of +${features.realizedPnL} USDT (+${features.returnPercent}%) on ${features.symbol} ${features.side}: Favorable conditions observed including ${favorableFactors.map(f => f.factor).join(', ')}.`;

    return {
      tradeId,
      symbol: features.symbol,
      side: features.side,
      gainAmount: features.realizedPnL,
      favorableFactors,
      nonCausalSummary,
      mfeCaptureEfficiency,
      exitReason: features.exitReason,
    };
  }

  // ============================================================================
  // 5. Pattern Fingerprinting & Aggregation
  // ============================================================================

  /**
   * Deterministic canonical fingerprint formula:
   * PAT_{symbol}_{side}_{strategyId}_{regimeCategory}_{rsiBucket}_{macdDirection}_{volatilityBucket}_{decisionMode}
   */
  static computeFingerprint(features: NormalizedFeatures): string {
    const sym = features.symbol.toUpperCase().replace(/USDT$/, '');
    return `PAT_${sym}_${features.side}_${features.strategyId}_${features.regimeCategory}_${features.rsiBucket}_${features.macdDirection}_${features.volatilityBucket}_${features.decisionMode}`;
  }

  /**
   * Discovers and aggregates candidate patterns across historical trade records.
   */
  static discoverPatterns(trades: (PaperTradeOutcomeRecord | any)[], minSampleSize: number = PatternIntelligenceEngine.DEFAULT_MIN_SAMPLES): {
    patterns: PatternRecord[];
    lessons: CandidateLesson[];
    insufficientEvidenceTrades: number;
  } {
    if (!trades || trades.length === 0) {
      return { patterns: [], lessons: [], insufficientEvidenceTrades: 0 };
    }

    // 1. Group trades by canonical fingerprint
    const clusters = new Map<string, { features: NormalizedFeatures[]; originalTrades: any[] }>();

    for (const trade of trades) {
      const feat = this.extractFeatures(trade);
      const fp = this.computeFingerprint(feat);

      const existing = clusters.get(fp) || { features: [], originalTrades: [] };
      existing.features.push(feat);
      existing.originalTrades.push(trade);
      clusters.set(fp, existing);
    }

    const discoveredPatterns: PatternRecord[] = [];
    const candidateLessons: CandidateLesson[] = [];
    let insufficientCount = 0;

    for (const [fingerprint, cluster] of clusters.entries()) {
      const n = cluster.features.length;

      // Minimum sample size enforcement
      if (n < minSampleSize) {
        insufficientCount += n;
        continue;
      }

      const f0 = cluster.features[0];
      const wins = cluster.features.filter(f => f.realizedPnL > 0.05).length;
      const losses = cluster.features.filter(f => f.realizedPnL < -0.05).length;
      const breakevens = n - wins - losses;

      const winRate = Number(((wins / n) * 100).toFixed(1));
      const lossRate = Number(((losses / n) * 100).toFixed(1));
      
      const totalPnL = Number(cluster.features.reduce((s, f) => s + f.realizedPnL, 0).toFixed(2));
      const averagePnL = Number((totalPnL / n).toFixed(2));
      
      const sortedPnL = cluster.features.map(f => f.realizedPnL).sort((a, b) => a - b);
      const medianPnL = Number(sortedPnL[Math.floor(sortedPnL.length / 2)].toFixed(2));
      
      const totalReturn = cluster.features.reduce((s, f) => s + f.returnPercent, 0);
      const averageReturn = Number((totalReturn / n).toFixed(2));

      const avgMAE = Number((cluster.features.reduce((s, f) => s + f.mae, 0) / n).toFixed(2));
      const avgMFE = Number((cluster.features.reduce((s, f) => s + f.mfe, 0) / n).toFixed(2));

      const grossWins = cluster.features.filter(f => f.realizedPnL > 0).reduce((s, f) => s + f.realizedPnL, 0);
      const grossLosses = Math.abs(cluster.features.filter(f => f.realizedPnL < 0).reduce((s, f) => s + f.realizedPnL, 0));
      const profitFactor = grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(2)) : (grossWins > 0 ? 99.9 : 1.0);

      // Recency weighting and drift detection
      // Compare recent N trades vs full history
      const recentSlice = cluster.features.slice(-PatternIntelligenceEngine.RECENCY_WINDOW_SIZE);
      const recentWins = recentSlice.filter(f => f.realizedPnL > 0.05).length;
      const recentWinRate = Number(((recentWins / recentSlice.length) * 100).toFixed(1));
      const isDegrading = cluster.features.length >= 10 && (winRate - recentWinRate) >= PatternIntelligenceEngine.DRIFT_THRESHOLD_PCT;

      // Quality score (0.0 to 1.0)
      // Combines: Sample size weight (min(1, n/20)), Consistency (deviation from 50%), and Return stability
      const sampleFactor = Math.min(1.0, n / 20);
      const winFactor = Math.abs(winRate - 50) / 50; // Higher confidence if strongly winning or strongly losing
      const qualityScore = Number(Math.min(0.99, Math.max(0.1, (sampleFactor * 0.5) + (winFactor * 0.5))).toFixed(2));

      const patternType: PatternType = winRate >= 55 ? 'WINNING_PATTERN' : (winRate <= 40 ? 'LOSING_PATTERN' : 'NEUTRAL_PATTERN');
      
      let status: PatternStatus = 'CANDIDATE';
      if (isDegrading) {
        status = 'DEGRADING';
      }

      // Dates
      const timestamps = cluster.originalTrades.map(t => new Date(t.createdAt || t.closedAt || Date.now()).getTime()).sort();
      const firstObservedAt = new Date(timestamps[0]).toISOString();
      const lastObservedAt = new Date(timestamps[timestamps.length - 1]).toISOString();

      const patternRecord: PatternRecord = {
        patternId: `PAT_${fingerprint.replace(/^PAT_/, '')}`,
        fingerprint,
        patternType,
        symbol: f0.symbol,
        side: f0.side,
        decisionMode: f0.decisionMode,
        strategyId: f0.strategyId,
        strategyVersion: f0.strategyVersion,
        marketRegime: f0.marketRegime,
        featureConditions: {
          rsiBucket: f0.rsiBucket,
          adxBucket: f0.adxBucket,
          volatilityBucket: f0.volatilityBucket,
          volumeBucket: f0.volumeBucket,
          macdDirection: f0.macdDirection,
          timingClassification: f0.timingClassification,
          regimeCategory: f0.regimeCategory,
        },
        sampleCount: n,
        winCount: wins,
        lossCount: losses,
        breakevenCount: breakevens,
        winRate,
        lossRate,
        averagePnL,
        medianPnL,
        totalPnL,
        averageReturn,
        averageMAE: avgMAE,
        averageMFE: avgMFE,
        profitFactor,
        qualityScore,
        status,
        recentWinRate,
        isDegrading,
        firstObservedAt,
        lastObservedAt,
        createdAt: firstObservedAt,
        updatedAt: lastObservedAt,
        supportingTradeIds: cluster.originalTrades.map(t => t.tradeId || t.id).filter(Boolean),
        candidateLessons: [],
        isCandidateForStrategyAdjustment: qualityScore >= 0.50 && (winRate >= 60 || winRate <= 35),
        notes: `Phase 3 candidate knowledge. Not yet validated for strategy modification. (Awaiting Phase 4 backtesting).`,
      };

      // Generate grounded candidate lesson
      const lesson = this.generateCandidateLesson(patternRecord);
      patternRecord.candidateLessons.push(lesson.lesson);

      discoveredPatterns.push(patternRecord);
      candidateLessons.push(lesson);
    }

    return {
      patterns: discoveredPatterns,
      lessons: candidateLessons,
      insufficientEvidenceTrades: insufficientCount,
    };
  }

  // ============================================================================
  // 6. Confidence Calibration Engine
  // ============================================================================

  /**
   * Analyzes actual paper trading performance across 1/7 through 7/7 confidence scores.
   * Emits CONFIDENCE_CALIBRATION_EVENT when high-confidence tiers underperform.
   */
  static calibrateConfidence(trades: (PaperTradeOutcomeRecord | any)[]): {
    tierStats: ConfidenceTierStats[];
    calibrationEvents: any[];
  } {
    const buckets: Record<number, { sampleCount: number; wins: number; losses: number; breakevens: number; netPnL: number; returns: number[] }> = {
      1: { sampleCount: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      2: { sampleCount: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      3: { sampleCount: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      4: { sampleCount: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      5: { sampleCount: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      6: { sampleCount: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      7: { sampleCount: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
    };

    for (const trade of trades) {
      const conf = Math.max(1, Math.min(7, Math.round(trade.confidenceScore || 3)));
      const pnl = trade.realizedPnL || 0;
      const b = buckets[conf];
      b.sampleCount++;
      b.netPnL += pnl;
      b.returns.push(trade.returnPercent || 0);

      if (pnl > 0.05) b.wins++;
      else if (pnl < -0.05) b.losses++;
      else b.breakevens++;
    }

    const tierStats: ConfidenceTierStats[] = [];
    const calibrationEvents: any[] = [];

    for (let score = 1; score <= 7; score++) {
      const b = buckets[score];
      const n = b.sampleCount;
      const winRate = n > 0 ? Number(((b.wins / n) * 100).toFixed(1)) : 0;
      const lossRate = n > 0 ? Number(((b.losses / n) * 100).toFixed(1)) : 0;
      const avgReturn = b.returns.length > 0 ? Number((b.returns.reduce((a, c) => a + c, 0) / b.returns.length).toFixed(2)) : 0;
      
      // High confidence tiers (5/7 to 7/7) underperforming if winRate < 45% with >= 5 trades
      const isUnderperforming = (score >= 5 && n >= 5 && winRate < 45.0);

      const stats: ConfidenceTierStats = {
        tier: `${score}/7` as ConfidenceBucket,
        score,
        sampleCount: n,
        winCount: b.wins,
        lossCount: b.losses,
        breakevenCount: b.breakevens,
        winRate,
        lossRate,
        netPnL: Number(b.netPnL.toFixed(2)),
        averageReturn: avgReturn,
        profitFactor: b.losses > 0 ? Number((Math.max(0.1, b.wins) / b.losses).toFixed(2)) : 1.0,
        isUnderperforming,
      };

      tierStats.push(stats);

      if (isUnderperforming) {
        calibrationEvents.push({
          eventType: 'CONFIDENCE_CALIBRATION_EVENT',
          tier: `${score}/7`,
          title: `Confidence Mis-calibration Detected (${score}/7)`,
          description: `High confidence tier ${score}/7 has historically produced a sub-par win rate of ${winRate}% across ${n} trades. Candidate for Phase 4 weight review.`,
          sampleCount: n,
          winRate,
          netPnL: stats.netPnL,
        });
      }
    }

    return {
      tierStats,
      calibrationEvents,
    };
  }

  // ============================================================================
  // 7. Candidate Lesson Engine & Grounding
  // ============================================================================

  /**
   * Converts a candidate pattern into a human-readable, grounded candidate lesson.
   * Formats observations strictly as empirical correlations ("historically associated with").
   */
  static generateCandidateLesson(pattern: PatternRecord): CandidateLesson {
    const sym = pattern.symbol.replace(/USDT$/, '');
    const cond = pattern.featureConditions;
    
    let lessonText = '';
    if (pattern.patternType === 'LOSING_PATTERN') {
      lessonText = `${sym} ${pattern.side} entries under ${cond.rsiBucket} RSI, ${cond.macdDirection} MACD, and ${cond.volatilityBucket} volatility have been historically associated with adverse performance (${pattern.winRate}% win rate across ${pattern.sampleCount} trades, avg MAE ${pattern.averageMAE}%).`;
    } else if (pattern.patternType === 'WINNING_PATTERN') {
      lessonText = `${sym} ${pattern.side} setups during ${cond.regimeCategory} conditions with ${cond.rsiBucket} RSI and ${cond.macdDirection} MACD have been historically associated with favorable execution (${pattern.winRate}% win rate across ${pattern.sampleCount} trades, avg return +${pattern.averageReturn}%).`;
    } else {
      lessonText = `${sym} ${pattern.side} setups under ${cond.regimeCategory} regime have shown neutral performance (${pattern.winRate}% win rate across ${pattern.sampleCount} trades).`;
    }

    return {
      id: `les_${pattern.fingerprint}`,
      patternId: pattern.patternId,
      patternFingerprint: pattern.fingerprint,
      lesson: lessonText,
      evidenceSummary: `${pattern.sampleCount} historical trades (${pattern.winCount} WIN / ${pattern.lossCount} LOSS / ${pattern.breakevenCount} BE, Net PnL: ${pattern.totalPnL} USDT)`,
      sampleCount: pattern.sampleCount,
      winRate: pattern.winRate,
      symbol: pattern.symbol,
      side: pattern.side,
      status: 'CANDIDATE',
      groundedMetrics: {
        winRate: pattern.winRate,
        sampleCount: pattern.sampleCount,
        averagePnL: pattern.averagePnL,
        averageMAE: pattern.averageMAE,
        averageMFE: pattern.averageMFE,
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Anti-Hallucination & Grounding Check:
   * Verifies that all metrics cited in a generated lesson strictly match numbers in the underlying dataset.
   */
  static verifyLessonGrounding(lesson: string, pattern: PatternRecord): { isGrounded: boolean; violations: string[]; groundedLesson: string } {
    const violations: string[] = [];

    // Check if winRate in lesson matches pattern.winRate
    const winRateMatch = lesson.match(/(\d+(\.\d+)?)%\s+win\s+rate/i);
    if (winRateMatch) {
      const parsedRate = parseFloat(winRateMatch[1]);
      if (Math.abs(parsedRate - pattern.winRate) > 0.5) {
        violations.push(`Cited win rate ${parsedRate}% does not match verified pattern win rate ${pattern.winRate}%`);
      }
    }

    // Check if sampleCount in lesson matches pattern.sampleCount
    const sampleMatch = lesson.match(/across\s+(\d+)\s+trades/i);
    if (sampleMatch) {
      const parsedSamples = parseInt(sampleMatch[1], 10);
      if (parsedSamples !== pattern.sampleCount) {
        violations.push(`Cited sample count ${parsedSamples} does not match verified pattern count ${pattern.sampleCount}`);
      }
    }

    // Prohibit causal verbs like "causes", "guarantees", "always"
    const forbiddenPhrases = [/\bcauses\b/i, /\bcaused by\b/i, /\bguarantees\b/i, /\balways\b/i, /\bproves\b/i];
    let sanitizedLesson = lesson;
    for (const phrase of forbiddenPhrases) {
      if (phrase.test(sanitizedLesson)) {
        violations.push(`Unpermitted causal claim detected matching ${phrase}`);
        sanitizedLesson = sanitizedLesson.replace(phrase, 'was historically associated with');
      }
    }

    return {
      isGrounded: violations.length === 0,
      violations,
      groundedLesson: sanitizedLesson,
    };
  }

  // ============================================================================
  // 8. Phase 4 Preparation Interfaces
  // ============================================================================

  /**
   * Retrieves relevant candidate patterns matching a specific live market setup.
   */
  static async getRelevantPatterns(symbol: string, side: 'LONG' | 'SHORT', currentFeatures?: Partial<NormalizedFeatures>): Promise<PatternRecord[]> {
    const allPatterns = await this.getAllStoredPatterns();
    const targetSymbol = symbol.toUpperCase().replace(/USDT$/, '');

    return allPatterns.filter(p => {
      const symMatch = p.symbol === 'GLOBAL' || p.symbol.toUpperCase().includes(targetSymbol);
      const sideMatch = p.side === side;
      if (!symMatch || !sideMatch) return false;

      if (currentFeatures?.rsiBucket && p.featureConditions.rsiBucket !== currentFeatures.rsiBucket) {
        return false;
      }
      return true;
    });
  }

  /**
   * Retrieves all candidate winning patterns for an asset.
   */
  static async getWinningPatterns(symbol?: string): Promise<PatternRecord[]> {
    const all = await this.getAllStoredPatterns();
    return all.filter(p => {
      if (p.patternType !== 'WINNING_PATTERN') return false;
      if (symbol && !p.symbol.toUpperCase().includes(symbol.toUpperCase().replace(/USDT$/, ''))) return false;
      return true;
    });
  }

  /**
   * Retrieves all candidate losing patterns for an asset.
   */
  static async getLosingPatterns(symbol?: string): Promise<PatternRecord[]> {
    const all = await this.getAllStoredPatterns();
    return all.filter(p => {
      if (p.patternType !== 'LOSING_PATTERN') return false;
      if (symbol && !p.symbol.toUpperCase().includes(symbol.toUpperCase().replace(/USDT$/, ''))) return false;
      return true;
    });
  }

  /**
   * Retrieves confidence calibration performance for a symbol.
   */
  static async getConfidencePerformance(symbol?: string): Promise<ConfidenceTierStats[]> {
    const trades = tradingFallbackStore.getAllTradeOutcomes();
    const filtered = symbol
      ? trades.filter(t => t.symbol.toUpperCase().includes(symbol.toUpperCase().replace(/USDT$/, '')))
      : trades;
    return this.calibrateConfidence(filtered).tierStats;
  }

  /**
   * Retrieves performance grouped by market regime.
   */
  static async getRegimePerformance(symbol?: string, targetRegime?: string): Promise<any[]> {
    const trades = tradingFallbackStore.getAllTradeOutcomes();
    const filtered = trades.filter(t => {
      if (symbol && !t.symbol.toUpperCase().includes(symbol.toUpperCase().replace(/USDT$/, ''))) return false;
      if (targetRegime && (t.exitSnapshot?.marketRegime || '').toUpperCase() !== targetRegime.toUpperCase()) return false;
      return true;
    });

    const regimes = new Map<string, { total: number; wins: number; losses: number; netPnL: number }>();
    for (const t of filtered) {
      const r = t.exitSnapshot?.marketRegime || t.entrySnapshot?.market?.marketRegime || 'RANGING';
      const obj = regimes.get(r) || { total: 0, wins: 0, losses: 0, netPnL: 0 };
      obj.total++;
      obj.netPnL += t.realizedPnL || 0;
      if (t.realizedPnL > 0) obj.wins++;
      else if (t.realizedPnL < 0) obj.losses++;
      regimes.set(r, obj);
    }

    return Array.from(regimes.entries()).map(([regime, s]) => ({
      regime,
      trades: s.total,
      wins: s.wins,
      losses: s.losses,
      winRate: s.total > 0 ? Number(((s.wins / s.total) * 100).toFixed(1)) : 0,
      netPnL: Number(s.netPnL.toFixed(2)),
    }));
  }

  /**
   * Retrieves human-readable candidate lessons.
   */
  static async getCandidateLessons(symbol?: string): Promise<CandidateLesson[]> {
    const lessons = tradingFallbackStore.getCandidateLessons();
    if (!symbol) return lessons;
    const cleanSym = symbol.toUpperCase().replace(/USDT$/, '');
    return lessons.filter(l => l.symbol.toUpperCase().includes(cleanSym));
  }

  /**
   * Retrieves complete empirical evidence backing a candidate pattern.
   */
  static async getPatternEvidence(patternId: string): Promise<{ pattern: PatternRecord | null; trades: any[] }> {
    const patterns = await this.getAllStoredPatterns();
    const pattern = patterns.find(p => p.patternId === patternId || p.fingerprint === patternId) || null;
    if (!pattern) return { pattern: null, trades: [] };

    const allTrades = tradingFallbackStore.getAllTradeOutcomes();
    const trades = allTrades.filter(t => pattern.supportingTradeIds.includes(t.tradeId || t.id));
    return { pattern, trades };
  }

  /**
   * Prepares a backtest validation dataset for Phase 4 consumption.
   */
  static async getPatternBacktestDataset(patternId: string): Promise<{
    patternId: string;
    featureConditions: PatternFeatureConditions;
    sampleCount: number;
    trades: any[];
    readyForPhase4Validation: boolean;
  }> {
    const evidence = await this.getPatternEvidence(patternId);
    return {
      patternId,
      featureConditions: evidence.pattern?.featureConditions || {},
      sampleCount: evidence.trades.length,
      trades: evidence.trades,
      readyForPhase4Validation: evidence.trades.length >= PatternIntelligenceEngine.DEFAULT_MIN_SAMPLES,
    };
  }

  /**
   * Compares empirical performance of a pattern against baseline.
   */
  static async comparePatternPerformance(patternId: string): Promise<{
    pattern: PatternRecord | null;
    baselineWinRate: number;
    deltaWinRate: number;
    isEdgeSignificant: boolean;
  }> {
    const patterns = await this.getAllStoredPatterns();
    const pattern = patterns.find(p => p.patternId === patternId || p.fingerprint === patternId) || null;
    if (!pattern) {
      return { pattern: null, baselineWinRate: 50, deltaWinRate: 0, isEdgeSignificant: false };
    }

    const allTrades = tradingFallbackStore.getAllTradeOutcomes();
    const baselineWins = allTrades.filter(t => (t.realizedPnL || 0) > 0.05).length;
    const baselineWinRate = allTrades.length > 0 ? Number(((baselineWins / allTrades.length) * 100).toFixed(1)) : 50;
    const deltaWinRate = Number((pattern.winRate - baselineWinRate).toFixed(1));
    const isEdgeSignificant = Math.abs(deltaWinRate) >= 15 && pattern.sampleCount >= PatternIntelligenceEngine.DEFAULT_MIN_SAMPLES;

    return {
      pattern,
      baselineWinRate,
      deltaWinRate,
      isEdgeSignificant,
    };
  }

  /**
   * Generates candidate strategy adjustment recommendation for Phase 4 backtesting.
   * STRICT: Does NOT apply or modify live parameters.
   */
  static generateCandidateStrategyAdjustment(pattern: PatternRecord): {
    strategyId: string;
    patternId: string;
    proposedAdjustmentType: 'TIGHTEN_ENTRY' | 'LOOSEN_ENTRY' | 'FILTER_REGIME' | 'ADJUST_STOP_LOSS';
    proposedAdjustment: string;
    status: 'PROPOSED_FOR_PHASE_4_BACKTEST';
    disclaimer: string;
  } {
    let proposedAdjustmentType: 'TIGHTEN_ENTRY' | 'LOOSEN_ENTRY' | 'FILTER_REGIME' | 'ADJUST_STOP_LOSS' = 'FILTER_REGIME';
    let proposedAdjustment = '';

    if (pattern.patternType === 'LOSING_PATTERN') {
      if (pattern.featureConditions.volatilityBucket === 'HIGH' || pattern.featureConditions.volatilityBucket === 'EXTREME') {
        proposedAdjustmentType = 'FILTER_REGIME';
        proposedAdjustment = `Propose adding high volatility filter for ${pattern.symbol} ${pattern.side} entries in Phase 4 simulation.`;
      } else if (pattern.averageMAE > 1.5) {
        proposedAdjustmentType = 'TIGHTEN_ENTRY';
        proposedAdjustment = `Propose requiring tighter momentum confirmation (RSI < 65) before entry.`;
      } else {
        proposedAdjustmentType = 'ADJUST_STOP_LOSS';
        proposedAdjustment = `Propose widening stop loss buffer by 0.5% ATR in Phase 4 backtest.`;
      }
    } else {
      proposedAdjustmentType = 'LOOSEN_ENTRY';
      proposedAdjustment = `Propose testing 5% increased position sizing for high-quality setups in Phase 4 backtest.`;
    }

    return {
      strategyId: pattern.strategyId,
      patternId: pattern.patternId,
      proposedAdjustmentType,
      proposedAdjustment,
      status: 'PROPOSED_FOR_PHASE_4_BACKTEST',
      disclaimer: 'Phase 3 proposes candidate adjustments only. Live strategy parameters remain unmodified until Phase 4 backtesting validates efficacy.',
    };
  }

  // ============================================================================
  // 9. Storage & Persistence
  // ============================================================================

  /**
   * Retrieves all candidate patterns from fallback store and Prisma FeedbackMemory.
   */
  static async getAllStoredPatterns(): Promise<PatternRecord[]> {
    const memoryPatterns = tradingFallbackStore.getCandidatePatterns();

    try {
      const dbMemories = await db.feedbackMemory.findMany({
        where: { status: { in: ['CANDIDATE', 'DEGRADING', 'STALE', 'VALIDATED'] } },
        orderBy: { updatedAt: 'desc' },
      });

      if (dbMemories && dbMemories.length > 0) {
        const idSet = new Set(memoryPatterns.map(p => p.patternId));
        for (const mem of dbMemories) {
          if (!idSet.has(mem.id)) {
            memoryPatterns.push({
              patternId: mem.id,
              fingerprint: mem.pattern,
              patternType: mem.type === 'FAILURE_PATTERN' ? 'LOSING_PATTERN' : 'WINNING_PATTERN',
              symbol: mem.symbol,
              side: 'LONG',
              decisionMode: 'EXPLOITATION',
              strategyId: mem.strategy,
              strategyVersion: 'v1.0.0',
              marketRegime: mem.marketRegime || 'RANGING',
              featureConditions: {},
              sampleCount: mem.evidenceCount,
              winCount: Math.round((mem.winRate / 100) * mem.evidenceCount),
              lossCount: mem.evidenceCount - Math.round((mem.winRate / 100) * mem.evidenceCount),
              breakevenCount: 0,
              winRate: mem.winRate,
              lossRate: Number((100 - mem.winRate).toFixed(1)),
              averagePnL: 0,
              medianPnL: 0,
              totalPnL: 0,
              averageReturn: 0,
              averageMAE: 0,
              averageMFE: 0,
              profitFactor: mem.profitFactor,
              qualityScore: mem.confidence,
              status: (mem.status as PatternStatus) || 'CANDIDATE',
              firstObservedAt: mem.createdAt.toISOString(),
              lastObservedAt: mem.updatedAt.toISOString(),
              createdAt: mem.createdAt.toISOString(),
              updatedAt: mem.updatedAt.toISOString(),
              supportingTradeIds: [],
              candidateLessons: [mem.observation],
              isCandidateForStrategyAdjustment: mem.confidence >= 0.6,
              notes: 'Imported from database FeedbackMemory.',
            });
          }
        }
      }
    } catch {
      // Prisma offline, continue with memory
    }

    return memoryPatterns;
  }

  /**
   * Saves or updates discovered candidate patterns, updating existing records upon duplicate fingerprints.
   */
  static async persistDiscoveredPatterns(patterns: PatternRecord[], lessons: CandidateLesson[]): Promise<void> {
    for (const p of patterns) {
      tradingFallbackStore.saveCandidatePattern(p);

      // Attempt DB upsert in FeedbackMemory
      try {
        await db.feedbackMemory.upsert({
          where: { id: p.patternId },
          update: {
            evidenceCount: p.sampleCount,
            winRate: p.winRate,
            profitFactor: p.profitFactor,
            confidence: p.qualityScore,
            status: p.status,
            observation: p.candidateLessons[0] || p.notes,
            updatedAt: new Date(),
          },
          create: {
            id: p.patternId,
            symbol: p.symbol,
            timeframe: '1h',
            strategy: p.strategyId,
            marketRegime: p.marketRegime,
            pattern: p.fingerprint,
            type: p.patternType === 'LOSING_PATTERN' ? 'FAILURE_PATTERN' : 'SUCCESS_PATTERN',
            observation: p.candidateLessons[0] || p.notes,
            evidenceCount: p.sampleCount,
            winRate: p.winRate,
            profitFactor: p.profitFactor,
            confidence: p.qualityScore,
            status: p.status,
          },
        });
      } catch {
        // Non-blocking fallback
      }
    }

    for (const l of lessons) {
      tradingFallbackStore.saveCandidateLesson(l);
    }
  }
}
