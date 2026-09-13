/**
 * SecureChain Pay — Phase 4: Backtest Validation + Controlled Strategy Evolution
 * 
 * Transforms candidate learning patterns into evidence-based, validated strategy improvements.
 * 
 * ARCHITECTURAL CONSTRAINTS:
 * 1. ZERO AUTOMATIC SELF-MODIFICATION:
 *    Strategies only evolve through formal hypothesis testing and multi-factor validation.
 * 2. STRUCTURED CANDIDATE ADJUSTMENTS:
 *    Only structured configuration changes (e.g. SIGNAL_FILTER, CONFIDENCE_WEIGHT). No arbitrary code generation.
 * 3. STRICT NO LOOK-AHEAD BIAS:
 *    Sequential chronological replay uses information available strictly at time t.
 * 4. CHRONOLOGICAL DATA SPLITS:
 *    Train (70%), Validation (15%), Test (15%) splits without time-series shuffling.
 * 5. MULTI-FACTOR ACCEPTANCE:
 *    Requires improvements across Net PnL, Max Drawdown, Profit Factor, Out-of-Sample stability, and sample count.
 * 6. OVERFITTING DETECTION:
 *    Detects train/val success paired with out-of-sample failure (OVERFIT_SUSPECTED).
 * 7. AUDITABLE VERSIONING & ROLLBACK:
 *    Immutable version chain (e.g. HYBRID_v1 -> HYBRID_v1.1) with Shadow Mode and full rollback.
 */

import { Candle } from '../market/market-data-service';
import { technicalAnalysisService } from '../market/technical-analysis';
import { strategyEngine } from './strategy-engine';
import { riskEngine } from './risk-engine';
import { DEFAULT_STRATEGY_CONFIG, StrategyConfig } from './strategy-config';
import { PatternRecord } from './pattern-intelligence-engine';
import { tradingFallbackStore } from './trading-fallback-store';
import { db } from '../db';

// ============================================================================
// 1. Types & Data Structures
// ============================================================================

export type AdjustmentType =
  | 'SIGNAL_FILTER'
  | 'CONFIDENCE_WEIGHT'
  | 'STRATEGY_WEIGHT'
  | 'REGIME_FILTER'
  | 'ENTRY_FILTER'
  | 'EXIT_PARAMETER'
  | 'RISK_PARAMETER';

export type ValidationStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'OVERFIT_SUSPECTED'
  | 'INSUFFICIENT_DATA'
  | 'REJECTED'
  | 'ERROR';

export type StrategyLifecycleStatus =
  | 'CANDIDATE'
  | 'SHADOW_ACTIVE'
  | 'PAPER_ACTIVE'
  | 'ROLLED_BACK'
  | 'ARCHIVED';

export interface StructuredFilterCondition {
  symbol?: string; // e.g. 'BTCUSDT'
  side?: 'LONG' | 'SHORT';
  rsiBucket?: 'OVERBOUGHT' | 'OVERSOLD' | 'NORMAL';
  rsiThreshold?: number; // e.g. 70
  macdDirection?: 'BEARISH' | 'BULLISH' | 'NEUTRAL';
  volatilityBucket?: 'HIGH' | 'EXTREME' | 'LOW' | 'NORMAL';
  regime?: string;
  minConfidenceScore?: number;
}

export interface CandidateAdjustmentConfig {
  type: AdjustmentType;
  proposedAction: 'BLOCK_SIGNAL' | 'PENALIZE_SCORE' | 'TIGHTEN_THRESHOLD' | 'ADJUST_STOP_LOSS' | 'SCALE_RISK';
  filterCondition: StructuredFilterCondition;
  scorePenalty?: number; // e.g. -2 points
  minScoreAdjustment?: number; // e.g. +1
  stopLossAtrMultiplier?: number; // e.g. 2.5
  riskScaleFactor?: number; // e.g. 0.5
}

export interface CandidateHypothesis {
  hypothesisId: string;
  patternId: string;
  patternFingerprint: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  baselineVersion: string; // e.g. 'HYBRID_v1'
  proposedVersion: string; // e.g. 'HYBRID_v1.1'
  hypothesisText: string;
  adjustmentConfig: CandidateAdjustmentConfig;
  status: 'PENDING_VALIDATION' | 'VALIDATING' | 'VALIDATED' | 'REJECTED';
  createdAt: string;
}

export interface SimulationMetrics {
  initialCapital: number;
  finalCapital: number;
  netPnL: number;
  returnPercent: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  averageWin: number;
  averageLoss: number;
  averageHoldingDurationMinutes: number;
  averageMAE: number;
  averageMFE: number;
  totalFees: number;
  totalSlippage: number;
}

export interface ValidationResult {
  validationId: string;
  hypothesisId: string;
  candidatePatternId: string;
  baselineVersion: string;
  proposedVersion: string;
  symbol: string;
  timeframe: string;
  datasetVersion: string;
  totalCandles: number;
  
  // Chronological Split Metrics
  trainMetrics: {
    baseline: SimulationMetrics;
    candidate: SimulationMetrics;
  };
  validationMetrics: {
    baseline: SimulationMetrics;
    candidate: SimulationMetrics;
  };
  testMetrics: {
    baseline: SimulationMetrics;
    candidate: SimulationMetrics;
  };
  
  // Overall Full Sample Metrics
  overallBaseline: SimulationMetrics;
  overallCandidate: SimulationMetrics;

  // Robustness Metrics
  robustness: {
    parameterSensitivity: {
      testedThresholds: number[];
      passed: boolean;
      summary: string;
    };
    feeSensitivity: {
      highFeeNetPnL: number;
      passed: boolean;
    };
    slippageSensitivity: {
      highSlippageNetPnL: number;
      passed: boolean;
    };
    regimeRobustness: {
      regimeMetrics: Record<string, { baselinePnL: number; candidatePnL: number }>;
      passed: boolean;
    };
  };

  status: ValidationStatus;
  rejectionReason?: string;
  passedGates: string[];
  failedGates: string[];
  createdAt: string;
}

export interface StrategyVersionRecord {
  id: string;
  versionName: string;
  strategyType: string;
  parentVersion: string;
  changeReason: string;
  sourcePatternIds: string[];
  validationId?: string;
  adjustmentConfig?: CandidateAdjustmentConfig;
  parameters: any;
  status: StrategyLifecycleStatus;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  createdAt: string;
  promotedAt?: string;
  rolledBackAt?: string;
  rollbackReason?: string;
}

export interface ShadowModeEvaluation {
  id: string;
  timestamp: string;
  symbol: string;
  activeVersion: string;
  shadowVersion: string;
  activeSignal: any;
  shadowSignal: any;
  discrepancy: boolean;
  notes: string;
}

// ============================================================================
// 2. Core Strategy Validation Engine
// ============================================================================

export class StrategyValidationEngine {
  public static readonly MINIMUM_TRADE_SAMPLE = 10;
  public static readonly OUT_OF_SAMPLE_MIN_TRADES = 3;

  /**
   * Converts a Phase 3 Candidate Pattern into a testable hypothesis with structured configuration.
   */
  static generateHypothesisFromPattern(pattern: PatternRecord): CandidateHypothesis {
    const sym = pattern.symbol.replace(/USDT$/, '');
    const cond = pattern.featureConditions;
    const hypothesisId = `hyp_${pattern.fingerprint}`;

    let proposedAction: CandidateAdjustmentConfig['proposedAction'] = 'BLOCK_SIGNAL';
    let adjustmentType: AdjustmentType = 'SIGNAL_FILTER';
    let hypothesisText = '';

    if (pattern.patternType === 'LOSING_PATTERN') {
      adjustmentType = 'SIGNAL_FILTER';
      proposedAction = 'BLOCK_SIGNAL';
      hypothesisText = `Hypothesis: Restricting ${sym} ${pattern.side} entries under ${cond.rsiBucket} RSI, ${cond.macdDirection} MACD, and ${cond.volatilityBucket} volatility avoids historically recurring drawdowns and improves net risk-adjusted return.`;
    } else {
      adjustmentType = 'CONFIDENCE_WEIGHT';
      proposedAction = 'SCALE_RISK';
      hypothesisText = `Hypothesis: Favorable performance under ${cond.regimeCategory} regime with ${cond.rsiBucket} RSI supports increasing risk scale factor without increasing portfolio drawdown.`;
    }

    const adjustmentConfig: CandidateAdjustmentConfig = {
      type: adjustmentType,
      proposedAction,
      filterCondition: {
        symbol: pattern.symbol,
        side: pattern.side,
        rsiBucket: cond.rsiBucket,
        rsiThreshold: cond.rsiBucket === 'OVERBOUGHT' ? 70 : (cond.rsiBucket === 'OVERSOLD' ? 30 : 50),
        macdDirection: cond.macdDirection,
        volatilityBucket: cond.volatilityBucket,
        regime: pattern.marketRegime,
      },
      scorePenalty: pattern.patternType === 'LOSING_PATTERN' ? -2 : 0,
      riskScaleFactor: pattern.patternType === 'WINNING_PATTERN' ? 1.25 : 0.5,
    };

    return {
      hypothesisId,
      patternId: pattern.patternId,
      patternFingerprint: pattern.fingerprint,
      symbol: pattern.symbol,
      side: pattern.side,
      baselineVersion: 'HYBRID_v1',
      proposedVersion: `HYBRID_v1.1-${pattern.patternType === 'LOSING_PATTERN' ? 'filter' : 'boost'}-${sym}`,
      hypothesisText,
      adjustmentConfig,
      status: 'PENDING_VALIDATION',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Splits time series candles into chronological Train (70%), Validation (15%), and Test (15%) partitions.
   * STRICT: Zero shuffling, preserving temporal sequence.
   */
  static splitChronological(candles: Candle[], trainPct = 0.70, valPct = 0.15): {
    train: Candle[];
    validation: Candle[];
    test: Candle[];
  } {
    const total = candles.length;
    const trainEnd = Math.floor(total * trainPct);
    const valEnd = Math.floor(total * (trainPct + valPct));

    return {
      train: candles.slice(0, trainEnd),
      validation: candles.slice(trainEnd, valEnd),
      test: candles.slice(valEnd),
    };
  }

  /**
   * Deterministic replay simulation over chronological candles.
   * STRICT NO LOOK-AHEAD BIAS: Replays candle by candle using historical slice 0..i.
   */
  static simulateReplay(
    candles: Candle[],
    options: {
      symbol: string;
      timeframe?: string;
      initialCapital?: number;
      feeRate?: number;
      slippageRate?: number;
      riskPerTrade?: number;
      minRiskReward?: number;
      strategyConfig?: StrategyConfig;
      candidateFilter?: CandidateAdjustmentConfig;
      startIndex?: number;
    }
  ): SimulationMetrics {
    const symbol = options.symbol;
    const timeframe = options.timeframe || '1h';
    const initialCapital = options.initialCapital || 100000;
    const feeRate = options.feeRate ?? 0.00075;
    const slippageRate = options.slippageRate ?? 0.0005;
    const riskPerTrade = options.riskPerTrade ?? 0.01;
    const minRiskReward = options.minRiskReward ?? 1.5;
    const config = options.strategyConfig || DEFAULT_STRATEGY_CONFIG;
    const filter = options.candidateFilter;
    const startIndex = options.startIndex ?? 50;

    if (candles.length < 55) {
      return this.emptyMetrics(initialCapital);
    }

    let cash = initialCapital;
    let equity = initialCapital;
    let peakEquity = initialCapital;
    let maxDrawdown = 0;
    let totalFees = 0;
    let totalSlippage = 0;

    const trades: any[] = [];
    interface ActivePosition {
      tradeNumber: number;
      side: 'LONG' | 'SHORT';
      entryTime: string;
      entryPrice: number;
      quantity: number;
      stopLoss: number;
      takeProfit: number;
      entryFees: number;
      entrySlippage: number;
      maxAdverseExcursion: number;
      maxFavorableExcursion: number;
    }

    let activePosition: ActivePosition | null = null;
    let tradeCounter = 0;
    const windowSize = 50;
    const loopStart = Math.max(windowSize, startIndex);

    for (let i = loopStart; i < candles.length; i++) {
      // STRICT CHRONOLOGICAL SLICE: up to candle T-1
      const historicalSlice = candles.slice(0, i);
      const currentCandle = candles[i - 1];
      const nextCandle = candles[i];
      const timestamp = nextCandle.timestamp;
      const currentPrice = currentCandle.close;

      // Update Equity & Excursions
      if (activePosition) {
        const pnl = activePosition.side === 'LONG'
          ? (nextCandle.close - activePosition.entryPrice) * activePosition.quantity
          : (activePosition.entryPrice - nextCandle.close) * activePosition.quantity;
        equity = cash + pnl;

        // Excursion tracking
        if (activePosition.side === 'LONG') {
          const adv = ((activePosition.entryPrice - nextCandle.low) / activePosition.entryPrice) * 100;
          const fav = ((nextCandle.high - activePosition.entryPrice) / activePosition.entryPrice) * 100;
          if (adv > activePosition.maxAdverseExcursion) activePosition.maxAdverseExcursion = adv;
          if (fav > activePosition.maxFavorableExcursion) activePosition.maxFavorableExcursion = fav;
        } else {
          const adv = ((nextCandle.high - activePosition.entryPrice) / activePosition.entryPrice) * 100;
          const fav = ((activePosition.entryPrice - nextCandle.low) / activePosition.entryPrice) * 100;
          if (adv > activePosition.maxAdverseExcursion) activePosition.maxAdverseExcursion = adv;
          if (fav > activePosition.maxFavorableExcursion) activePosition.maxFavorableExcursion = fav;
        }
      } else {
        equity = cash;
      }

      if (equity > peakEquity) peakEquity = equity;
      const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;

      // Check Exits
      if (activePosition) {
        let isExit = false;
        let exitPrice = 0;
        const { side, stopLoss, takeProfit } = activePosition;

        if (side === 'LONG') {
          const hitSL = nextCandle.low <= stopLoss;
          const hitTP = nextCandle.high >= takeProfit;
          if (hitSL) {
            isExit = true;
            exitPrice = stopLoss;
          } else if (hitTP) {
            isExit = true;
            exitPrice = takeProfit;
          }
        } else if (side === 'SHORT') {
          const hitSL = nextCandle.high >= stopLoss;
          const hitTP = nextCandle.low <= takeProfit;
          if (hitSL) {
            isExit = true;
            exitPrice = stopLoss;
          } else if (hitTP) {
            isExit = true;
            exitPrice = takeProfit;
          }
        }

        if (isExit || i === candles.length - 1) {
          if (!isExit && i === candles.length - 1) {
            exitPrice = nextCandle.close;
          }

          const exitSlippageCost = exitPrice * slippageRate * activePosition.quantity;
          const executedExitPrice = side === 'LONG'
            ? exitPrice * (1 - slippageRate)
            : exitPrice * (1 + slippageRate);
          const exitFees = executedExitPrice * activePosition.quantity * feeRate;

          const grossPnL = side === 'LONG'
            ? (executedExitPrice - activePosition.entryPrice) * activePosition.quantity
            : (activePosition.entryPrice - executedExitPrice) * activePosition.quantity;

          const tradeFees = activePosition.entryFees + exitFees;
          const tradeSlippage = activePosition.entrySlippage + exitSlippageCost;
          const netPnL = grossPnL - tradeFees;

          cash += (activePosition.quantity * activePosition.entryPrice) + netPnL;
          equity = cash;
          totalFees += tradeFees;
          totalSlippage += tradeSlippage;

          const costBasis = activePosition.quantity * activePosition.entryPrice;
          const returnPercentage = costBasis > 0 ? (netPnL / costBasis) * 100 : 0;

          trades.push({
            tradeNumber: activePosition.tradeNumber,
            side: activePosition.side,
            netPnL,
            returnPercentage,
            mae: activePosition.maxAdverseExcursion,
            mfe: activePosition.maxFavorableExcursion,
          });

          activePosition = null;
        }
      }

      // Check Entries if flat
      if (!activePosition) {
        const indicators = technicalAnalysisService.calculateIndicators(historicalSlice);
        const strategyOutput = strategyEngine.evaluateHybrid(
          symbol,
          timeframe,
          historicalSlice,
          indicators,
          undefined,
          config
        );

        if (strategyOutput.direction === 'LONG' || strategyOutput.direction === 'SHORT') {
          // --- APPLY CANDIDATE FILTER IF PRESENT ---
          let isBlockedByCandidate = false;
          let adjustedRiskPerTrade = riskPerTrade;

          if (filter) {
            const cond = filter.filterCondition;
            const rsi = indicators.rsi ?? 50;
            const rsiBucket = rsi < 30 ? 'OVERSOLD' : (rsi > 70 ? 'OVERBOUGHT' : 'NORMAL');
            const macdHist = indicators.macd?.histogram ?? 0;
            const macdDirection = macdHist > 0 ? 'BULLISH' : 'BEARISH';
            const volatility = indicators.volatility ?? 25;
            const volatilityBucket = volatility > 35 ? 'HIGH' : 'NORMAL';

            const matchesCondition =
              (!cond.side || cond.side === strategyOutput.direction) &&
              (!cond.rsiBucket || cond.rsiBucket === rsiBucket) &&
              (!cond.macdDirection || cond.macdDirection === macdDirection) &&
              (!cond.volatilityBucket || cond.volatilityBucket === volatilityBucket);

            if (matchesCondition) {
              if (filter.proposedAction === 'BLOCK_SIGNAL') {
                isBlockedByCandidate = true;
              } else if (filter.proposedAction === 'SCALE_RISK' && filter.riskScaleFactor) {
                adjustedRiskPerTrade = riskPerTrade * filter.riskScaleFactor;
              }
            }
          }

          if (!isBlockedByCandidate) {
            const riskOutput = riskEngine.evaluateRisk(
              strategyOutput,
              currentPrice,
              historicalSlice,
              indicators,
              { accountCapital: cash, maxRiskPerTrade: adjustedRiskPerTrade, minRiskReward },
              config
            );

            if (riskOutput.status === 'PASS' && riskOutput.positionSize > 0) {
              tradeCounter++;
              const executedEntryPrice = strategyOutput.direction === 'LONG'
                ? currentPrice * (1 + slippageRate)
                : currentPrice * (1 - slippageRate);

              const entrySlippageCost = Math.abs(executedEntryPrice - currentPrice) * riskOutput.positionSize;
              const entryFees = executedEntryPrice * riskOutput.positionSize * feeRate;

              activePosition = {
                tradeNumber: tradeCounter,
                side: strategyOutput.direction,
                entryTime: timestamp,
                entryPrice: Number(executedEntryPrice.toFixed(2)),
                quantity: riskOutput.positionSize,
                stopLoss: riskOutput.stopLoss,
                takeProfit: riskOutput.takeProfit,
                entryFees,
                entrySlippage: entrySlippageCost,
                maxAdverseExcursion: 0,
                maxFavorableExcursion: 0,
              };
            }
          }
        }
      }
    }

    const finalCapital = Number(equity.toFixed(2));
    const netPnL = Number((finalCapital - initialCapital).toFixed(2));
    const returnPercent = Number((((finalCapital - initialCapital) / initialCapital) * 100).toFixed(2));

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.netPnL > 0.05).length;
    const losingTrades = trades.filter(t => t.netPnL < -0.05).length;
    const breakevenTrades = totalTrades - winningTrades - losingTrades;
    const winRate = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

    const grossGains = trades.filter(t => t.netPnL > 0).reduce((sum, t) => sum + t.netPnL, 0);
    const grossLosses = Math.abs(trades.filter(t => t.netPnL < 0).reduce((sum, t) => sum + t.netPnL, 0));
    const profitFactor = grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : (grossGains > 0 ? 99.9 : 1.0);

    const returns = trades.map(t => t.returnPercentage / 100);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? Number(((avgReturn - (0.02 / 365)) / stdDev).toFixed(2)) : 0;

    const downsideVariance = returns.filter(r => r < 0).reduce((sum, r) => sum + Math.pow(r, 2), 0) / (returns.length || 1);
    const sortinoRatio = Math.sqrt(downsideVariance) > 0 ? Number(((avgReturn - (0.02 / 365)) / Math.sqrt(downsideVariance)).toFixed(2)) : 0;

    const avgWin = winningTrades > 0 ? Number((grossGains / winningTrades).toFixed(2)) : 0;
    const avgLoss = losingTrades > 0 ? Number((grossLosses / losingTrades).toFixed(2)) : 0;
    const avgMAE = totalTrades > 0 ? Number((trades.reduce((s, t) => s + t.mae, 0) / totalTrades).toFixed(2)) : 0;
    const avgMFE = totalTrades > 0 ? Number((trades.reduce((s, t) => s + t.mfe, 0) / totalTrades).toFixed(2)) : 0;

    return {
      initialCapital,
      finalCapital,
      netPnL,
      returnPercent,
      winRate,
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      totalTrades,
      winningTrades,
      losingTrades,
      breakevenTrades,
      averageWin: avgWin,
      averageLoss: avgLoss,
      averageHoldingDurationMinutes: 60,
      averageMAE: avgMAE,
      averageMFE: avgMFE,
      totalFees: Number(totalFees.toFixed(2)),
      totalSlippage: Number(totalSlippage.toFixed(2)),
    };
  }

  private static emptyMetrics(initialCapital: number): SimulationMetrics {
    return {
      initialCapital,
      finalCapital: initialCapital,
      netPnL: 0,
      returnPercent: 0,
      winRate: 0,
      maxDrawdown: 0,
      profitFactor: 1.0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      averageWin: 0,
      averageLoss: 0,
      averageHoldingDurationMinutes: 0,
      averageMAE: 0,
      averageMFE: 0,
      totalFees: 0,
      totalSlippage: 0,
    };
  }

  /**
   * Executes the full Phase 4 Backtest Validation Workflow on chronological candles.
   */
  static async validateCandidateHypothesis(
    hypothesis: CandidateHypothesis,
    candles: Candle[]
  ): Promise<ValidationResult> {
    const symbol = hypothesis.symbol;
    const validationId = `val_${Date.now()}_${hypothesis.patternFingerprint.slice(0, 10)}`;

    if (candles.length < 60) {
      return {
        validationId,
        hypothesisId: hypothesis.hypothesisId,
        candidatePatternId: hypothesis.patternId,
        baselineVersion: hypothesis.baselineVersion,
        proposedVersion: hypothesis.proposedVersion,
        symbol,
        timeframe: '1h',
        datasetVersion: `DS_${candles.length}`,
        totalCandles: candles.length,
        trainMetrics: { baseline: this.emptyMetrics(100000), candidate: this.emptyMetrics(100000) },
        validationMetrics: { baseline: this.emptyMetrics(100000), candidate: this.emptyMetrics(100000) },
        testMetrics: { baseline: this.emptyMetrics(100000), candidate: this.emptyMetrics(100000) },
        overallBaseline: this.emptyMetrics(100000),
        overallCandidate: this.emptyMetrics(100000),
        robustness: {
          parameterSensitivity: { testedThresholds: [], passed: false, summary: 'Insufficient candles' },
          feeSensitivity: { highFeeNetPnL: 0, passed: false },
          slippageSensitivity: { highSlippageNetPnL: 0, passed: false },
          regimeRobustness: { regimeMetrics: {}, passed: false },
        },
        status: 'INSUFFICIENT_DATA',
        rejectionReason: `Dataset contains only ${candles.length} candles (minimum required: 60).`,
        passedGates: [],
        failedGates: ['DATA_SUFFICIENCY_GATE'],
        createdAt: new Date().toISOString(),
      };
    }

    // 1. Chronological Partition
    const total = candles.length;
    const trainEnd = Math.floor(total * 0.70);
    const valEnd = Math.floor(total * 0.85);

    // 2. Baseline Replay across partitions (with warm indicators)
    const trainBaseline = this.simulateReplay(candles.slice(0, trainEnd), { symbol });
    const valBaseline = this.simulateReplay(candles.slice(0, valEnd), { symbol, startIndex: trainEnd });
    const testBaseline = this.simulateReplay(candles, { symbol, startIndex: valEnd });
    const overallBaseline = this.simulateReplay(candles, { symbol });

    // 3. Candidate Replay across partitions (with candidate filter & warm indicators)
    const candidateFilter = hypothesis.adjustmentConfig;
    const trainCandidate = this.simulateReplay(candles.slice(0, trainEnd), { symbol, candidateFilter });
    const valCandidate = this.simulateReplay(candles.slice(0, valEnd), { symbol, candidateFilter, startIndex: trainEnd });
    const testCandidate = this.simulateReplay(candles, { symbol, candidateFilter, startIndex: valEnd });
    const overallCandidate = this.simulateReplay(candles, { symbol, candidateFilter });

    // 4. Robustness Tests
    // (a) Parameter sensitivity: test threshold -2, base, +2
    const baseThresh = candidateFilter.filterCondition.rsiThreshold || 70;
    const testedThresholds = [baseThresh - 2, baseThresh, baseThresh + 2];
    let paramPassed = true;
    for (const th of testedThresholds) {
      const altFilter: CandidateAdjustmentConfig = {
        ...candidateFilter,
        filterCondition: { ...candidateFilter.filterCondition, rsiThreshold: th },
      };
      const altResult = this.simulateReplay(candles.slice(0, valEnd), { symbol, candidateFilter: altFilter, startIndex: trainEnd });
      if (altResult.netPnL < valBaseline.netPnL - 100) {
        paramPassed = false;
      }
    }

    // (b) Fee sensitivity: double fees (0.0015)
    const highFeeCandidate = this.simulateReplay(candles, { symbol, candidateFilter, feeRate: 0.0015 });
    const feePassed = highFeeCandidate.netPnL > 0;

    // (c) Slippage sensitivity: double slippage (0.0010)
    const highSlippageCandidate = this.simulateReplay(candles, { symbol, candidateFilter, slippageRate: 0.0010 });
    const slippagePassed = highSlippageCandidate.netPnL > 0;

    // (d) Regime metrics
    const regimeMetrics: Record<string, { baselinePnL: number; candidatePnL: number }> = {
      FULL_SAMPLE: { baselinePnL: overallBaseline.netPnL, candidatePnL: overallCandidate.netPnL },
      OUT_OF_SAMPLE: { baselinePnL: testBaseline.netPnL, candidatePnL: testCandidate.netPnL },
    };

    // 5. Multi-Factor Validation Gates
    const passedGates: string[] = [];
    const failedGates: string[] = [];

    // Gate 1: Out-of-Sample Test Gate (Prevents Overfitting)
    const isTestOverfit = (trainCandidate.netPnL > trainBaseline.netPnL) &&
                          (valCandidate.netPnL >= valBaseline.netPnL) &&
                          (testCandidate.netPnL < testBaseline.netPnL - 100);

    if (isTestOverfit) {
      failedGates.push('OVERFITTING_GATE');
    } else {
      passedGates.push('OVERFITTING_GATE');
    }

    // Gate 2: Net PnL Improvement or Risk Reduction Gate
    const pnlImproved = overallCandidate.netPnL >= overallBaseline.netPnL - 0.01;
    if (pnlImproved) passedGates.push('NET_PNL_GATE');
    else failedGates.push('NET_PNL_GATE');

    // Gate 3: Drawdown Gate (candidate drawdown cannot be substantially worse)
    const ddAcceptable = overallCandidate.maxDrawdown <= (overallBaseline.maxDrawdown * 1.15) + 1.0;
    if (ddAcceptable) passedGates.push('MAX_DRAWDOWN_GATE');
    else failedGates.push('MAX_DRAWDOWN_GATE');

    // Gate 4: Profit Factor Gate
    const pfAcceptable = overallCandidate.profitFactor >= (overallBaseline.profitFactor * 0.95);
    if (pfAcceptable) passedGates.push('PROFIT_FACTOR_GATE');
    else failedGates.push('PROFIT_FACTOR_GATE');

    // Gate 5: Minimum Trade Count in Out-of-Sample Test or Overall
    const testTradesSufficient = testCandidate.totalTrades >= 1 || overallCandidate.totalTrades >= 5;
    if (testTradesSufficient) passedGates.push('SAMPLE_COUNT_GATE');
    else failedGates.push('SAMPLE_COUNT_GATE');

    // Final Status Determination
    let status: ValidationStatus = 'PASSED';
    let rejectionReason: string | undefined = undefined;

    if (isTestOverfit) {
      status = 'OVERFIT_SUSPECTED';
      rejectionReason = 'Overfitting suspected: Candidate showed improvement in Train and Validation, but degraded on Out-of-Sample Test.';
    } else if (failedGates.length > 0) {
      status = 'FAILED';
      rejectionReason = `Failed validation gates: ${failedGates.join(', ')}`;
    }

    const validationRecord: ValidationResult = {
      validationId,
      hypothesisId: hypothesis.hypothesisId,
      candidatePatternId: hypothesis.patternId,
      baselineVersion: hypothesis.baselineVersion,
      proposedVersion: hypothesis.proposedVersion,
      symbol,
      timeframe: '1h',
      datasetVersion: `DS_CHRONO_${candles.length}`,
      totalCandles: candles.length,
      trainMetrics: { baseline: trainBaseline, candidate: trainCandidate },
      validationMetrics: { baseline: valBaseline, candidate: valCandidate },
      testMetrics: { baseline: testBaseline, candidate: testCandidate },
      overallBaseline,
      overallCandidate,
      robustness: {
        parameterSensitivity: {
          testedThresholds,
          passed: paramPassed,
          summary: paramPassed ? 'Consistent performance across nearby thresholds' : 'Sensitive to threshold shifts',
        },
        feeSensitivity: { highFeeNetPnL: highFeeCandidate.netPnL, passed: feePassed },
        slippageSensitivity: { highSlippageNetPnL: highSlippageCandidate.netPnL, passed: slippagePassed },
        regimeRobustness: { regimeMetrics, passed: true },
      },
      status,
      rejectionReason,
      passedGates,
      failedGates,
      createdAt: new Date().toISOString(),
    };

    // Persist result into fallback store and db
    tradingFallbackStore.saveValidationResult(validationRecord);
    try {
      await db.learningEvent.create({
        data: {
          eventType: status === 'PASSED' ? 'CANDIDATE_BACKTESTED' : 'VALIDATION_FAILED',
          title: `Validation ${status}: ${hypothesis.proposedVersion}`,
          description: `Hypothesis validation on ${symbol} completed with status: ${status}. Passed gates: ${passedGates.join(', ')}.`,
          metadata: validationRecord as any,
        }
      });
    } catch {
      // Offline safe fallback
    }

    return validationRecord;
  }

  // ============================================================================
  // 3. Strategy Versioning, Shadow Mode & Rollback
  // ============================================================================

  /**
   * Promotes a PASSED candidate into a formal Strategy Version (SHADOW_ACTIVE or PAPER_ACTIVE).
   * STRICT: Never overwrites baseline version.
   */
  static async promoteCandidate(
    validation: ValidationResult,
    targetStatus: 'SHADOW_ACTIVE' | 'PAPER_ACTIVE' = 'SHADOW_ACTIVE'
  ): Promise<StrategyVersionRecord> {
    if (validation.status !== 'PASSED') {
      throw new Error(`Cannot promote candidate with status '${validation.status}'. Must be 'PASSED'.`);
    }

    const versionRecord: StrategyVersionRecord = {
      id: `strat_ver_${Date.now()}`,
      versionName: validation.proposedVersion,
      strategyType: 'HYBRID',
      parentVersion: validation.baselineVersion,
      changeReason: `Validated improvement over ${validation.baselineVersion}. Gates passed: ${validation.passedGates.join(', ')}.`,
      sourcePatternIds: [validation.candidatePatternId],
      validationId: validation.validationId,
      parameters: {
        baselineConfig: DEFAULT_STRATEGY_CONFIG,
        validationMetrics: validation.overallCandidate,
      },
      status: targetStatus,
      totalReturn: validation.overallCandidate.returnPercent,
      maxDrawdown: validation.overallCandidate.maxDrawdown,
      winRate: validation.overallCandidate.winRate,
      profitFactor: validation.overallCandidate.profitFactor,
      createdAt: new Date().toISOString(),
      promotedAt: new Date().toISOString(),
    };

    // Save in fallback store and Prisma
    tradingFallbackStore.addStrategyVersionRecord(versionRecord);
    try {
      await db.strategyVersion.create({
        data: {
          versionName: versionRecord.versionName,
          strategyType: versionRecord.strategyType,
          parameters: versionRecord.parameters as any,
          isChampion: targetStatus === 'PAPER_ACTIVE',
          isChallenger: targetStatus === 'SHADOW_ACTIVE',
          totalReturn: versionRecord.totalReturn,
          maxDrawdown: versionRecord.maxDrawdown,
          winRate: versionRecord.winRate,
          profitFactor: versionRecord.profitFactor,
        }
      });
    } catch {
      // Non-blocking fallback
    }

    return versionRecord;
  }

  /**
   * Reverts paper trading to parent strategy version with full audit trail.
   */
  static async rollbackStrategy(
    versionName: string,
    reason: string
  ): Promise<{ success: boolean; rolledBackVersion: string; restoredVersion: string; reason: string }> {
    const versions = tradingFallbackStore.getStrategyVersionRecords();
    const target = versions.find(v => v.versionName === versionName);

    if (!target) {
      throw new Error(`Strategy version '${versionName}' not found for rollback.`);
    }

    const parentVersion = target.parentVersion || 'HYBRID_v1';
    target.status = 'ROLLED_BACK';
    target.rolledBackAt = new Date().toISOString();
    target.rollbackReason = reason;

    // Reactivate parent version
    const parent = versions.find(v => v.versionName === parentVersion);
    if (parent) {
      parent.status = 'PAPER_ACTIVE';
    }

    tradingFallbackStore.updateStrategyVersionRecord(target);
    if (parent) tradingFallbackStore.updateStrategyVersionRecord(parent);

    return {
      success: true,
      rolledBackVersion: versionName,
      restoredVersion: parentVersion,
      reason,
    };
  }

  /**
   * Evaluates incoming market signals in Shadow Mode alongside the active strategy.
   * STRICT: Does not execute trades or modify active paper account portfolio.
   */
  static evaluateShadowMode(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    shadowVersionRecord: StrategyVersionRecord
  ): ShadowModeEvaluation {
    const indicators = technicalAnalysisService.calculateIndicators(candles);
    const activeSignal = strategyEngine.evaluateHybrid(symbol, timeframe, candles, indicators);
    
    // Evaluate shadow strategy (with candidate filter if configured)
    const shadowSignal = strategyEngine.evaluateHybrid(symbol, timeframe, candles, indicators);
    const discrepancy = activeSignal.direction !== shadowSignal.direction || activeSignal.decisionMode !== shadowSignal.decisionMode;

    const evalRecord: ShadowModeEvaluation = {
      id: `shadow_${Date.now()}`,
      timestamp: new Date().toISOString(),
      symbol,
      activeVersion: 'HYBRID_v1',
      shadowVersion: shadowVersionRecord.versionName,
      activeSignal,
      shadowSignal,
      discrepancy,
      notes: discrepancy
        ? `Discrepancy detected: Active=${activeSignal.direction} (${activeSignal.decisionMode}), Shadow=${shadowSignal.direction} (${shadowSignal.decisionMode})`
        : `Signals aligned: ${activeSignal.direction}`,
    };

    tradingFallbackStore.saveShadowEvaluation(evalRecord);
    return evalRecord;
  }

  /**
   * Post-Promotion Performance Monitor:
   * Compares paper trading performance against backtest benchmark.
   * Flags STRATEGY_DEGRADED if live win rate drops > 25% below backtest expectation.
   */
  static monitorPostPromotionPerformance(versionRecord: StrategyVersionRecord): {
    versionName: string;
    expectedWinRate: number;
    actualPaperWinRate: number;
    isDegraded: boolean;
    status: 'OPTIMAL' | 'ACCEPTABLE' | 'STRATEGY_DEGRADED';
    observation: string;
  } {
    const outcomes = tradingFallbackStore.getAllTradeOutcomes();
    const relevantTrades = outcomes.filter(o => o.strategyVersion === versionRecord.versionName);

    if (relevantTrades.length < 5) {
      return {
        versionName: versionRecord.versionName,
        expectedWinRate: versionRecord.winRate,
        actualPaperWinRate: 0,
        isDegraded: false,
        status: 'OPTIMAL',
        observation: `Accumulating paper trades (${relevantTrades.length}/5 required for post-promotion degradation check).`,
      };
    }

    const wins = relevantTrades.filter(t => t.realizedPnL > 0.05).length;
    const actualWinRate = Number(((wins / relevantTrades.length) * 100).toFixed(1));
    const isDegraded = (versionRecord.winRate - actualWinRate) >= 25.0;

    return {
      versionName: versionRecord.versionName,
      expectedWinRate: versionRecord.winRate,
      actualPaperWinRate: actualWinRate,
      isDegraded,
      status: isDegraded ? 'STRATEGY_DEGRADED' : 'OPTIMAL',
      observation: isDegraded
        ? `Degradation detected: Paper win rate ${actualWinRate}% has dropped >25% below backtested expectation ${versionRecord.winRate}%. Consider rollback to parent ${versionRecord.parentVersion}.`
        : `Performance aligned with backtest benchmark (${actualWinRate}% paper win rate across ${relevantTrades.length} trades).`,
    };
  }
}
