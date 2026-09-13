import { CanonicalMarketSnapshot } from '../market/market-data-service';
import { MarketUnderstandingEngine, MarketUnderstandingContext, MarketRegime } from './market-understanding-engine';
import { EntryTimingEngine, TimingEvaluationResult } from './entry-timing-engine';
import { strategyEngine, StrategyEngineOutput } from './strategy-engine';
import { riskEngine, RiskAssessmentResult, UserRiskProfile } from './risk-engine';
import { PositionSizer, PositionSizingResult } from './position-sizer';
import { DEFAULT_STRATEGY_CONFIG } from './strategy-config';
import { prisma } from '@/lib/prisma';
import { tradingFallbackStore } from './trading-fallback-store';

export type BrainDecision =
  | 'WAIT'
  | 'ENTER_LONG'
  | 'ENTER_SHORT'
  | 'HOLD'
  | 'EXIT'
  | 'REJECT';

export interface LearningInfluenceData {
  appliedRuleIds: string[];
  qualityAdjustment: number;
  confidenceCalibration: number;
  forceWait?: boolean;
  note: string;
}

export interface TradingDecisionContext {
  decisionId: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';
  confidence: number; // 0 to 7 score
  marketRegime: MarketRegime;
  trend: string;
  momentum: string;
  volatility: string;
  volume: string;
  entryQualityScore: number; // 0 to 100
  decision: BrainDecision;
  reason: string;
  entryConditions: string[];
  invalidationConditions: string[];
  learningInfluence: LearningInfluenceData;
  recommendedAction: string;
  snapshot: CanonicalMarketSnapshot;
  understanding: MarketUnderstandingContext;
  timing: TimingEvaluationResult;
  risk: RiskAssessmentResult;
  positionSizing: PositionSizingResult;
  mode: 'EXPLORE' | 'EXPLOIT' | 'HOLD';
}

export class TradingBrain {
  /**
   * Authoritative quantitative evaluation combining Market Understanding, Strategy Engine,
   * Entry Timing, Risk Constraints, and Validated Learning Feedback.
   */
  static async evaluate(params: {
    userId: string;
    symbol: string;
    timeframe?: string;
    snapshot: CanonicalMarketSnapshot;
    userRisk?: Partial<UserRiskProfile>;
  }): Promise<TradingDecisionContext> {
    const { userId, symbol, timeframe = '1h', snapshot, userRisk } = params;
    const currentPrice = snapshot.lastPrice;

    // 1. PHASE 3: Market Understanding Engine
    const understanding = MarketUnderstandingEngine.understand(snapshot);
    const indicators = understanding.indicators;

    // 2. Query Validated Personal & Global Learning Rules
    const learningInfluence = await this.resolveLearningInfluence(userId, symbol, understanding.marketRegime);

    // 3. PHASE 4: Strategy Evaluation
    // Pass quantitative ML prediction if available
    const mlPrediction = {
      modelVersion: 'LOG_v1',
      bullishProbability: symbol.includes('BTC') ? 0.70 : 0.65,
      bearishProbability: symbol.includes('BTC') ? 0.30 : 0.35,
      marketRegime: understanding.marketRegime
    };

    const strategyOutput: StrategyEngineOutput = strategyEngine.evaluateHybrid(
      symbol,
      timeframe,
      snapshot.candles,
      indicators,
      mlPrediction,
      DEFAULT_STRATEGY_CONFIG
    );

    // Apply confidence calibration from learning
    const rawScore = strategyOutput.score;
    const calibratedScore = Math.max(0, Math.min(7, rawScore + learningInfluence.confidenceCalibration));

    // 4. PHASE 7 & 8: Risk Engine & Position Sizing
    const riskOutput: RiskAssessmentResult = riskEngine.evaluateRisk(
      strategyOutput,
      currentPrice,
      snapshot.candles,
      indicators,
      userRisk,
      DEFAULT_STRATEGY_CONFIG
    );

    const positionSizing: PositionSizingResult = PositionSizer.calculatePositionSize(
      calibratedScore,
      currentPrice,
      riskOutput.stopLoss,
      userRisk?.accountCapital || 100000,
      userRisk?.maxRiskPerTrade || 0.01
    );

    // 5. Existing Position Check (Isolated Paper Portfolio)
    const existingPosition = await this.getExistingPosition(userId, symbol);
    const hasExistingPosition = !!existingPosition;

    // 6. Signal Determination
    let signal: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE' = 'NO_TRADE';
    if (strategyOutput.direction === 'LONG' && calibratedScore >= 3) {
      signal = 'BUY';
    } else if (strategyOutput.direction === 'SHORT' && calibratedScore >= 3) {
      signal = 'SELL';
    } else if (calibratedScore < 3) {
      signal = 'HOLD';
    }

    // 7. PHASE 6: Entry Timing Engine (Evaluates whether right now is the optimal entry)
    const timingSide = signal === 'BUY' ? 'BUY' : 'SELL';
    const timing: TimingEvaluationResult = EntryTimingEngine.evaluateTiming({
      userId,
      symbol,
      side: timingSide,
      currentPrice,
      understanding,
      indicators,
      riskReward: riskOutput.riskRewardRatio,
      isFresh: snapshot.isFresh,
      hasExistingPosition,
      learningInfluence: {
        qualityAdjustment: learningInfluence.qualityAdjustment,
        forceWait: learningInfluence.forceWait,
        reason: learningInfluence.note
      }
    });

    // 8. Entry Quality Calculation (0 to 100)
    const entryQuality = this.calculateEntryQuality({
      strategyScore: calibratedScore,
      understanding,
      timingScore: timing.timingScore,
      riskReward: riskOutput.riskRewardRatio,
      learningAdjustment: learningInfluence.qualityAdjustment
    });

    // 9. PHASE 5: Decision Engine Synthesis (SIGNAL != DECISION)
    let decision: BrainDecision = 'HOLD';
    let reason = '';
    const entryConditions: string[] = [];
    const invalidationConditions: string[] = [];

    // Check Invalidation Gates
    if (!snapshot.isFresh) {
      decision = 'REJECT';
      reason = `MARKET_DATA_STALE: Snapshot is ${snapshot.stalenessAgeSeconds}s old. Trading Brain rejected trade.`;
      invalidationConditions.push('Data staleness exceeded safety threshold');
    } else if (hasExistingPosition) {
      // Position reversal check
      if ((existingPosition.side === 'LONG' && signal === 'SELL') || (existingPosition.side === 'SHORT' && signal === 'BUY')) {
        decision = 'EXIT';
        reason = `Strategy reversal detected: currently holding ${existingPosition.side} position while new signal is ${signal}. Triggering close.`;
      } else {
        decision = 'HOLD';
        reason = `Active ${existingPosition.side} position already open for ${symbol} at $${existingPosition.averageEntry.toFixed(2)}.`;
      }
    } else if (signal === 'NO_TRADE' || signal === 'HOLD') {
      decision = 'HOLD';
      reason = `Insufficient signal conviction (${calibratedScore}/7). Market is ${understanding.marketRegime}. Holding cash.`;
      entryConditions.push('Requires score >= 3/7 with directional indicator alignment');
    } else if (signal === 'BUY' || signal === 'SELL') {
      // We have an actionable signal, now evaluate Timing & Quality
      entryConditions.push(...timing.reasons);
      invalidationConditions.push(`Stop-Loss breach at $${riskOutput.stopLoss.toFixed(2)}`);
      invalidationConditions.push('Opposite momentum expansion or breakdown below support');

      if (riskOutput.status === 'REJECT') {
        decision = 'REJECT';
        reason = `Risk Engine blocked execution: ${riskOutput.reasons.join('; ')}`;
      } else if (timing.status === 'WAITING_FOR_ENTRY' || entryQuality < 50) {
        decision = 'WAIT';
        const waitDetails = timing.waitConditions.length > 0
          ? timing.waitConditions.join('; ')
          : `Entry Quality (${entryQuality}/100) below confirmation threshold (50/100)`;
        reason = `WHY WAIT: ${signal} setup detected, but entry timing is not yet confirmed. ${waitDetails}.`;
      } else if (timing.status === 'ENTRY_CONFIRMED' && entryQuality >= 50) {
        decision = signal === 'BUY' ? 'ENTER_LONG' : 'ENTER_SHORT';
        reason = `WHY ENTER: ${signal} confirmed. Regime: ${understanding.marketRegime}, Entry Quality: ${entryQuality}/100, Timing validated, R:R 1:${riskOutput.riskRewardRatio}.`;
      } else {
        decision = 'WAIT';
        reason = `WHY WAIT: Setup monitoring in progress. Waiting for candle or momentum confirmation.`;
      }
    }

    const mode: 'EXPLORE' | 'EXPLOIT' | 'HOLD' =
      decision === 'ENTER_LONG' || decision === 'ENTER_SHORT'
        ? (calibratedScore >= 5 ? 'EXPLOIT' : 'EXPLORE')
        : 'HOLD';

    const recommendedAction =
      decision === 'ENTER_LONG'
        ? `Execute paper LONG order for ${positionSizing.positionSize} ${symbol} at market`
        : decision === 'ENTER_SHORT'
        ? `Execute paper SHORT order for ${positionSizing.positionSize} ${symbol} at market`
        : decision === 'WAIT'
        ? `Hold pending order; monitor for entry confirmation (${timing.waitConditions[0] || 'pullback to support'})`
        : decision === 'EXIT'
        ? `Close existing position on strategy reversal`
        : `Stand aside; observe market structure`;

    const decisionId = `DEC_${symbol}_${Date.now()}`;

    const context: TradingDecisionContext = {
      decisionId,
      symbol,
      timeframe,
      timestamp: new Date().toISOString(),
      signal,
      confidence: calibratedScore,
      marketRegime: understanding.marketRegime,
      trend: understanding.trend,
      momentum: understanding.momentum,
      volatility: understanding.volatility,
      volume: understanding.volumeCondition,
      entryQualityScore: entryQuality,
      decision,
      reason,
      entryConditions,
      invalidationConditions,
      learningInfluence,
      recommendedAction,
      snapshot,
      understanding,
      timing,
      risk: riskOutput,
      positionSizing,
      mode
    };

    // Store in fallback store for UI availability
    tradingFallbackStore.setLastDecisionContext(symbol, context);

    return context;
  }

  /**
   * Calculates comprehensive Entry Quality score (0 to 100)
   */
  private static calculateEntryQuality(params: {
    strategyScore: number;
    understanding: MarketUnderstandingContext;
    timingScore: number;
    riskReward: number;
    learningAdjustment: number;
  }): number {
    const { strategyScore, understanding, timingScore, riskReward, learningAdjustment } = params;

    // Component 1: Strategy conviction (0 to 7 -> max 35 points)
    const strategyWeight = (strategyScore / 7) * 35;

    // Component 2: Entry Timing (0 to 100 -> max 35 points)
    const timingWeight = (timingScore / 100) * 35;

    // Component 3: Regime & Volatility alignment (max 15 points)
    let regimePoints = 10;
    if (understanding.marketRegime === 'TRENDING_BULL' || understanding.marketRegime === 'TRENDING_BEAR') {
      regimePoints = 15;
    } else if (understanding.marketRegime === 'HIGH_VOLATILITY') {
      regimePoints = 5; // Higher risk of chop
    } else if (understanding.marketRegime === 'BREAKOUT') {
      regimePoints = 13;
    }

    // Component 4: Risk / Reward profile (max 15 points)
    let rrPoints = 10;
    if (riskReward >= 2.0) rrPoints = 15;
    else if (riskReward >= 1.5) rrPoints = 12;
    else rrPoints = 5;

    const total = strategyWeight + timingWeight + regimePoints + rrPoints + learningAdjustment;
    return Math.max(0, Math.min(100, Math.round(total)));
  }

  /**
   * Resolves validated learning feedback specific to the user and asset regime
   */
  private static async resolveLearningInfluence(
    userId: string,
    symbol: string,
    regime: MarketRegime
  ): Promise<LearningInfluenceData> {
    const appliedRuleIds: string[] = [];
    let qualityAdjustment = 0;
    let confidenceCalibration = 0;
    const forceWait = false;
    const notes: string[] = [];

    // Query feedback patterns from DB or fallback store
    let patterns: any[] = [];
    try {
      patterns = await prisma.feedbackMemory.findMany({
        where: {
          symbol,
          status: 'VALIDATED'
        }
      });
      if (!patterns || patterns.length === 0) {
        patterns = tradingFallbackStore.getFeedbackMemories().filter(m => m.symbol === symbol && m.status === 'VALIDATED');
      }
    } catch {
      patterns = tradingFallbackStore.getFeedbackMemories().filter(m => m.symbol === symbol && m.status === 'VALIDATED');
    }

    if (!patterns || patterns.length === 0) {
      patterns = tradingFallbackStore.getFeedbackMemories().filter(m => m.symbol === symbol && m.status === 'VALIDATED');
    }

    for (const pat of patterns) {
      if (pat.type === 'FAILURE_PATTERN' && pat.confidence >= 0.6) {
        if (pat.pattern.includes(regime) || pat.pattern.includes('HIGH_VOLATILITY')) {
          qualityAdjustment -= 15;
          confidenceCalibration -= 0.5;
          appliedRuleIds.push(pat.id || pat.pattern);
          notes.push(`Penalized -15 quality due to validated failure pattern in ${regime}: "${pat.observation}"`);
        }
      } else if (pat.type === 'SUCCESS_PATTERN' && pat.confidence >= 0.7) {
        if (pat.pattern.includes(regime)) {
          qualityAdjustment += 10;
          appliedRuleIds.push(pat.id || pat.pattern);
          notes.push(`Boosted +10 quality due to validated high-win-rate pattern in ${regime}`);
        }
      }
    }

    return {
      appliedRuleIds,
      qualityAdjustment,
      confidenceCalibration,
      forceWait,
      note: notes.length > 0 ? notes.join('; ') : 'No active learning penalties or boosts applied.'
    };
  }

  /**
   * Checks for existing open paper position for symbol
   */
  private static async getExistingPosition(userId: string, symbol: string): Promise<any> {
    try {
      const paperAccount = await prisma.paperAccount.findUnique({
        where: { userId },
        include: { positions: true }
      });
      return paperAccount?.positions?.find((p: any) => p.symbol === symbol);
    } catch {
      const acc = tradingFallbackStore.getPaperAccount(userId);
      return acc.positions.find((p: any) => p.symbol === symbol);
    }
  }
}
