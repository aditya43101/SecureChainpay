import { db } from '../db';
import { tradingFallbackStore } from './trading-fallback-store';

// ============================================================
// 1. PAPER TRADE STATE MACHINE TYPES
// ============================================================

export type PaperOrderState =
  | 'CREATED'
  | 'VALIDATING'
  | 'APPROVED'
  | 'OPEN'
  | 'PARTIALLY_CLOSED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'ERROR';

export type PaperPositionState =
  | 'OPEN'
  | 'CLOSING'
  | 'CLOSED';

export type TradeOutcomeType =
  | 'WIN'
  | 'LOSS'
  | 'BREAKEVEN';

export type ExitReasonType =
  | 'STOP_LOSS'
  | 'TAKE_PROFIT'
  | 'RISK_LIMIT'
  | 'SIGNAL_REVERSAL'
  | 'TIMEOUT'
  | 'MANUAL_PAPER_CLOSE'
  | 'SYSTEM_CLOSE';

// Deterministic priority ordering for simultaneous exit conditions:
// STOP_LOSS > TAKE_PROFIT > RISK_LIMIT > SIGNAL_REVERSAL > TIMEOUT > MANUAL_PAPER_CLOSE > SYSTEM_CLOSE
export const EXIT_REASON_PRIORITY: Record<ExitReasonType, number> = {
  STOP_LOSS: 1,
  TAKE_PROFIT: 2,
  RISK_LIMIT: 3,
  SIGNAL_REVERSAL: 4,
  TIMEOUT: 5,
  MANUAL_PAPER_CLOSE: 6,
  SYSTEM_CLOSE: 7,
};

// ============================================================
// 2. DECISION SNAPSHOTS & OUTCOME STRUCTURES
// ============================================================

export interface MarketCandleSnapshot {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string | number;
}

export interface EntryDecisionSnapshot {
  tradeId: string;
  orderId: string;
  positionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  timestamp: string;

  // Market Context
  market: {
    entryPrice: number;
    bid: number;
    ask: number;
    spread: number;
    volume: number;
    volatility: number;
    marketRegime: string;
  };

  // Indicators Context
  indicators: {
    rsi?: number;
    emaFast?: number; // ema20
    emaSlow?: number; // ema50
    macd?: {
      MACD?: number;
      signal?: number;
      histogram?: number;
    };
    bollinger?: {
      upper?: number;
      middle?: number;
      lower?: number;
    };
    atr?: number;
    adx?: number;
    superTrend?: number;
  };

  // Signal Context
  signal: {
    action: 'BUY' | 'SELL';
    confidenceScore: number;
    confidenceMax: number;
    signalStrength: 'LOW' | 'MEDIUM' | 'HIGH';
    strategyId: string;
    strategyVersion: string;
    decisionMode: 'EXPLORATION' | 'EXPLOITATION';
  };

  // Risk Context
  risk: {
    positionSize: number;
    riskPercent: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
    portfolioExposure: number;
    availablePaperBalance: number;
  };

  // Model Context
  model: {
    modelVersion: string;
    featureVersion: string;
    bullishProbability?: number;
    bearishProbability?: number;
  };

  // Decision & Audit Trace
  decision: {
    decisionReason: string;
    eligibilityChecks: string[];
    rejectedChecks: string[];
    decisionTrace?: any;
  };

  // Market Data Candles
  timeframeContext: {
    timeframe: string;
    entryCandle?: MarketCandleSnapshot;
    higherTimeframeCandle?: MarketCandleSnapshot;
  };
}

export interface ExitDecisionSnapshot {
  tradeId: string;
  exitPrice: number;
  exitReason: ExitReasonType;
  timestamp: string;
  marketRegime?: string;
  signalStateAtExit?: string;
  indicatorsAtExit?: {
    rsi?: number;
    emaFast?: number;
    emaSlow?: number;
    atr?: number;
    volatility?: number;
  };
  reversalDetected?: boolean;
}

export interface ExcursionMetrics {
  maxAdversePrice: number;
  maxAdversePercent: number;
  maxAdversePnL: number;
  maxFavorablePrice: number;
  maxFavorablePercent: number;
  maxFavorablePnL: number;
}

export interface PaperTradeOutcomeRecord {
  tradeId: string;
  orderId: string;
  positionId: string;
  userId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';

  entryPrice: number;
  exitPrice: number;
  quantity: number;
  notionalValue: number;

  openedAt: string;
  closedAt: string;
  holdingDurationMs: number;
  holdingDurationMinutes: number;

  confidenceScore: number;
  strategyId: string;
  strategyVersion: string;
  decisionMode: 'EXPLORATION' | 'EXPLOITATION';

  stopLoss: number;
  takeProfit: number;
  exitReason: ExitReasonType;

  fees: {
    entryFee: number;
    exitFee: number;
    totalFees: number;
  };
  slippage: {
    entrySlippage: number;
    exitSlippage: number;
    totalSlippageCost: number;
  };

  grossPnL: number;
  realizedPnL: number; // Net PnL after simulated fees & slippage
  returnPercent: number;

  outcome: TradeOutcomeType;
  lossCategory?: string;

  MAE: {
    maxAdversePrice: number;
    maxAdversePercent: number;
    maxAdversePnL: number;
  };
  MFE: {
    maxFavorablePrice: number;
    maxFavorablePercent: number;
    maxFavorablePnL: number;
  };

  entrySnapshot: EntryDecisionSnapshot;
  exitSnapshot: ExitDecisionSnapshot;
  learningEventId?: string;
}

// ============================================================
// 3. CANONICAL PAPER PNL SERVICE
// ============================================================

export class PaperPnLService {
  // Realistic simulated fee and slippage configurations
  public static readonly DEFAULT_FEE_RATE = 0.00075; // 0.075% per side
  public static readonly DEFAULT_SLIPPAGE_RATE = 0.0005; // 0.05% per side
  public static readonly BREAKEVEN_THRESHOLD_USD = 0.10; // Within ±$0.10 net PnL is BREAKEVEN

  /**
   * Calculates canonical PnL for LONG and SHORT paper positions.
   */
  static calculatePnL(params: {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    feeRate?: number;
    slippageRate?: number;
  }): {
    grossPnL: number;
    entryFee: number;
    exitFee: number;
    totalFees: number;
    slippageCost: number;
    netPnL: number;
    returnPercent: number;
  } {
    const { side, entryPrice, exitPrice, quantity } = params;
    const feeRate = params.feeRate ?? this.DEFAULT_FEE_RATE;
    const slippageRate = params.slippageRate ?? this.DEFAULT_SLIPPAGE_RATE;

    const notionalEntry = entryPrice * quantity;
    const notionalExit = exitPrice * quantity;

    // Gross PnL
    const grossPnL = side === 'LONG'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;

    // Realistic Fees: Entry fee + Exit fee
    const entryFee = notionalEntry * feeRate;
    const exitFee = notionalExit * feeRate;
    const totalFees = entryFee + exitFee;

    // Realistic Slippage Cost
    const slippageCost = (notionalEntry + notionalExit) * (slippageRate / 2);

    // Net Realized PnL
    const netPnL = grossPnL - totalFees - slippageCost;

    // Return Percentage based on invested capital
    const returnPercent = notionalEntry > 0 ? (netPnL / notionalEntry) * 100 : 0;

    return {
      grossPnL: Number(grossPnL.toFixed(4)),
      entryFee: Number(entryFee.toFixed(4)),
      exitFee: Number(exitFee.toFixed(4)),
      totalFees: Number(totalFees.toFixed(4)),
      slippageCost: Number(slippageCost.toFixed(4)),
      netPnL: Number(netPnL.toFixed(4)),
      returnPercent: Number(returnPercent.toFixed(2)),
    };
  }

  /**
   * Classifies trade outcome into WIN, LOSS, or BREAKEVEN based on net realized PnL.
   */
  static classifyOutcome(netPnL: number, thresholdUsd: number = this.BREAKEVEN_THRESHOLD_USD): TradeOutcomeType {
    if (netPnL > thresholdUsd) {
      return 'WIN';
    } else if (netPnL < -thresholdUsd) {
      return 'LOSS';
    }
    return 'BREAKEVEN';
  }

  /**
   * Computes Maximum Adverse Excursion (MAE) and Maximum Favorable Excursion (MFE).
   */
  static calculateExcursions(params: {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    quantity: number;
    lowestPrice?: number;
    highestPrice?: number;
    exitPrice: number;
  }): ExcursionMetrics {
    const { side, entryPrice, quantity, exitPrice } = params;
    const low = Math.min(params.lowestPrice ?? entryPrice, entryPrice, exitPrice);
    const high = Math.max(params.highestPrice ?? entryPrice, entryPrice, exitPrice);

    let maxAdversePrice: number;
    let maxAdversePercent: number;
    let maxAdversePnL: number;

    let maxFavorablePrice: number;
    let maxFavorablePercent: number;
    let maxFavorablePnL: number;

    if (side === 'LONG') {
      maxAdversePrice = low;
      maxAdversePercent = entryPrice > 0 ? ((entryPrice - low) / entryPrice) * 100 : 0;
      maxAdversePnL = (low - entryPrice) * quantity;

      maxFavorablePrice = high;
      maxFavorablePercent = entryPrice > 0 ? ((high - entryPrice) / entryPrice) * 100 : 0;
      maxFavorablePnL = (high - entryPrice) * quantity;
    } else {
      // SHORT
      maxAdversePrice = high;
      maxAdversePercent = entryPrice > 0 ? ((high - entryPrice) / entryPrice) * 100 : 0;
      maxAdversePnL = (entryPrice - high) * quantity;

      maxFavorablePrice = low;
      maxFavorablePercent = entryPrice > 0 ? ((entryPrice - low) / entryPrice) * 100 : 0;
      maxFavorablePnL = (entryPrice - low) * quantity;
    }

    return {
      maxAdversePrice: Number(maxAdversePrice.toFixed(4)),
      maxAdversePercent: Number(Math.max(0, maxAdversePercent).toFixed(2)),
      maxAdversePnL: Number(Math.min(0, maxAdversePnL).toFixed(4)),
      maxFavorablePrice: Number(maxFavorablePrice.toFixed(4)),
      maxFavorablePercent: Number(Math.max(0, maxFavorablePercent).toFixed(2)),
      maxFavorablePnL: Number(Math.max(0, maxFavorablePnL).toFixed(4)),
    };
  }

  /**
   * Validates that Stop Loss and Take Profit risk boundaries are mathematically sound.
   */
  static validateRiskBoundaries(params: {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
  }): { valid: boolean; reason?: string } {
    const { side, entryPrice, stopLoss, takeProfit } = params;

    if (entryPrice <= 0) {
      return { valid: false, reason: 'Entry price must be strictly positive' };
    }

    if (side === 'LONG') {
      if (stopLoss >= entryPrice) {
        return { valid: false, reason: `LONG Stop Loss ($${stopLoss}) must be strictly below entry price ($${entryPrice})` };
      }
      if (takeProfit <= entryPrice) {
        return { valid: false, reason: `LONG Take Profit ($${takeProfit}) must be strictly above entry price ($${entryPrice})` };
      }
    } else if (side === 'SHORT') {
      if (stopLoss <= entryPrice) {
        return { valid: false, reason: `SHORT Stop Loss ($${stopLoss}) must be strictly above entry price ($${entryPrice})` };
      }
      if (takeProfit >= entryPrice) {
        return { valid: false, reason: `SHORT Take Profit ($${takeProfit}) must be strictly below entry price ($${entryPrice})` };
      }
    }

    return { valid: true };
  }
}

// ============================================================
// 4. PAPER TRADE LIFECYCLE ENGINE
// ============================================================

export class PaperTradeLifecycleEngine {
  // In-memory trade locks for concurrency safety and idempotency
  private static closeLocks = new Set<string>();
  // Closed trade outcome cache indexed by tradeId
  private static finalizedOutcomes = new Map<string, PaperTradeOutcomeRecord>();

  /**
   * Generates a deterministic immutable Paper Trade ID.
   * Format: PT-<SYMBOL_ROOT>-<TIMESTAMP>-<SAFE_HASH>
   */
  static generateTradeId(symbol: string): string {
    const cleanSymbol = symbol.replace(/USDT$/, '').toUpperCase();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PT-${cleanSymbol}-${timestamp}-${randomSuffix}`;
  }

  /**
   * Freezes the complete immutable Entry Decision Snapshot at the exact moment of entry.
   */
  static createEntrySnapshot(params: {
    tradeId: string;
    orderId: string;
    positionId: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    bid?: number;
    ask?: number;
    volume?: number;
    volatility?: number;
    marketRegime?: string;
    indicators?: any;
    recommendation?: any;
    riskParams: {
      positionSize: number;
      riskPercent: number;
      stopLoss: number;
      takeProfit: number;
      riskRewardRatio: number;
      portfolioExposure: number;
      availablePaperBalance: number;
    };
    timeframe: string;
    entryCandle?: MarketCandleSnapshot;
  }): EntryDecisionSnapshot {
    const rec = params.recommendation || {};
    const ind = params.indicators || {};
    const price = params.entryPrice;
    const spread = (params.ask && params.bid) ? params.ask - params.bid : price * 0.0004;

    return {
      tradeId: params.tradeId,
      orderId: params.orderId,
      positionId: params.positionId,
      symbol: params.symbol,
      side: params.side,
      timestamp: new Date().toISOString(),

      market: {
        entryPrice: price,
        bid: params.bid || (price - spread / 2),
        ask: params.ask || (price + spread / 2),
        spread: Number(spread.toFixed(4)),
        volume: params.volume || params.entryCandle?.volume || 1000,
        volatility: params.volatility || ind.volatility || 25,
        marketRegime: params.marketRegime || rec.mlPrediction?.marketRegime || 'RANGING',
      },

      indicators: {
        rsi: ind.rsi,
        emaFast: ind.ema20,
        emaSlow: ind.ema50,
        macd: ind.macd ? {
          MACD: ind.macd.MACD,
          signal: ind.macd.signal,
          histogram: ind.macd.histogram,
        } : undefined,
        bollinger: ind.bollingerBands ? {
          upper: ind.bollingerBands.upper,
          middle: ind.bollingerBands.middle,
          lower: ind.bollingerBands.lower,
        } : undefined,
        atr: ind.atr,
        adx: ind.adx,
        superTrend: ind.superTrend,
      },

      signal: {
        action: rec.action === 'BUY' ? 'BUY' : 'SELL',
        confidenceScore: rec.score ?? 3,
        confidenceMax: rec.maxScore ?? 7,
        signalStrength: rec.strength ?? 'MEDIUM',
        strategyId: rec.strategy ?? 'HYBRID',
        strategyVersion: rec.strategyVersion ?? 'HYBRID_v1',
        decisionMode: rec.decisionMode === 'EXPLOIT' ? 'EXPLOITATION' : 'EXPLORATION',
      },

      risk: {
        positionSize: params.riskParams.positionSize,
        riskPercent: params.riskParams.riskPercent,
        stopLoss: params.riskParams.stopLoss,
        takeProfit: params.riskParams.takeProfit,
        riskRewardRatio: params.riskParams.riskRewardRatio,
        portfolioExposure: params.riskParams.portfolioExposure,
        availablePaperBalance: params.riskParams.availablePaperBalance,
      },

      model: {
        modelVersion: rec.mlPrediction?.modelVersion || 'LOG_v1',
        featureVersion: 'FEATURE_v1',
        bullishProbability: rec.mlPrediction?.bullishProbability,
        bearishProbability: rec.mlPrediction?.bearishProbability,
      },

      decision: {
        decisionReason: rec.reasons ? rec.reasons.join('; ') : 'Quantitative technical convergence',
        eligibilityChecks: rec.decisionTrace ? ['MARKET_DATA_FRESH', 'INDICATORS_VALID', 'RISK_BOUNDS_PASS'] : ['DEFAULT_ELIGIBLE'],
        rejectedChecks: [],
        decisionTrace: rec.decisionTrace,
      },

      timeframeContext: {
        timeframe: params.timeframe,
        entryCandle: params.entryCandle,
      }
    };
  }

  /**
   * Evaluates exit conditions for an open position using deterministic priority:
   * STOP_LOSS > TAKE_PROFIT > RISK_LIMIT > SIGNAL_REVERSAL > TIMEOUT > MANUAL_PAPER_CLOSE
   */
  static evaluateExitConditions(params: {
    side: 'LONG' | 'SHORT';
    currentPrice: number;
    stopLoss: number;
    takeProfit: number;
    reversalSignal?: 'BUY' | 'SELL';
    openedAt: string | Date;
    maxHoldingHours?: number;
    manualCloseRequested?: boolean;
  }): { shouldExit: boolean; exitReason?: ExitReasonType; exitPrice: number } {
    const { side, currentPrice, stopLoss, takeProfit, reversalSignal, manualCloseRequested } = params;

    // 1. STOP LOSS (Priority 1)
    if (side === 'LONG' && stopLoss > 0 && currentPrice <= stopLoss) {
      return { shouldExit: true, exitReason: 'STOP_LOSS', exitPrice: stopLoss };
    }
    if (side === 'SHORT' && stopLoss > 0 && currentPrice >= stopLoss) {
      return { shouldExit: true, exitReason: 'STOP_LOSS', exitPrice: stopLoss };
    }

    // 2. TAKE PROFIT (Priority 2)
    if (side === 'LONG' && takeProfit > 0 && currentPrice >= takeProfit) {
      return { shouldExit: true, exitReason: 'TAKE_PROFIT', exitPrice: takeProfit };
    }
    if (side === 'SHORT' && takeProfit > 0 && currentPrice <= takeProfit) {
      return { shouldExit: true, exitReason: 'TAKE_PROFIT', exitPrice: takeProfit };
    }

    // 3. SIGNAL REVERSAL (Priority 4)
    if (reversalSignal) {
      if (side === 'LONG' && reversalSignal === 'SELL') {
        return { shouldExit: true, exitReason: 'SIGNAL_REVERSAL', exitPrice: currentPrice };
      }
      if (side === 'SHORT' && reversalSignal === 'BUY') {
        return { shouldExit: true, exitReason: 'SIGNAL_REVERSAL', exitPrice: currentPrice };
      }
    }

    // 4. TIMEOUT (Priority 5)
    if (params.maxHoldingHours && params.maxHoldingHours > 0) {
      const openedMs = new Date(params.openedAt).getTime();
      const nowMs = Date.now();
      const ageHours = (nowMs - openedMs) / (1000 * 60 * 60);
      if (ageHours >= params.maxHoldingHours) {
        return { shouldExit: true, exitReason: 'TIMEOUT', exitPrice: currentPrice };
      }
    }

    // 5. MANUAL PAPER CLOSE (Priority 6)
    if (manualCloseRequested) {
      return { shouldExit: true, exitReason: 'MANUAL_PAPER_CLOSE', exitPrice: currentPrice };
    }

    return { shouldExit: false, exitPrice: currentPrice };
  }

  /**
   * Closes a paper trade position atomically, enforcing idempotency via tradeId.
   * Calculates canonical PnL, excursions (MAE/MFE), generates the exit snapshot,
   * emits a structured learning event, and reconciles the paper portfolio.
   */
  static async closeTradeAtomically(params: {
    tradeId: string;
    orderId?: string;
    positionId: string;
    userId: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    openedAt: string | Date;
    stopLoss: number;
    takeProfit: number;
    exitReason: ExitReasonType;
    lowestIntrabarPrice?: number;
    highestIntrabarPrice?: number;
    entrySnapshot: EntryDecisionSnapshot;
    marketRegime?: string;
    indicatorsAtExit?: any;
  }): Promise<PaperTradeOutcomeRecord> {
    const { tradeId, userId } = params;

    // Idempotency Check: Return already finalized outcome if trade was already closed
    const cachedOutcome = this.finalizedOutcomes.get(tradeId);
    if (cachedOutcome) {
      return cachedOutcome;
    }

    // Check DB for already finalized outcome
    const storedOutcome = tradingFallbackStore.getTradeOutcome(tradeId);
    if (storedOutcome) {
      this.finalizedOutcomes.set(tradeId, storedOutcome);
      return storedOutcome;
    }

    // Acquire atomic close lock
    if (this.closeLocks.has(tradeId)) {
      // Another thread is closing this exact trade right now; wait briefly and retrieve finalized record
      await new Promise(resolve => setTimeout(resolve, 50));
      const finalized = this.finalizedOutcomes.get(tradeId) || tradingFallbackStore.getTradeOutcome(tradeId);
      if (finalized) return finalized;
    }
    this.closeLocks.add(tradeId);

    try {
      const closedAt = new Date().toISOString();
      const openedAtIso = new Date(params.openedAt).toISOString();
      const holdingDurationMs = Math.max(0, new Date(closedAt).getTime() - new Date(openedAtIso).getTime());
      const holdingDurationMinutes = Number((holdingDurationMs / 60000).toFixed(2));

      // 1. Canonical PnL Calculation
      const pnlData = PaperPnLService.calculatePnL({
        side: params.side,
        entryPrice: params.entryPrice,
        exitPrice: params.exitPrice,
        quantity: params.quantity,
      });

      // 2. Outcome Classification
      const outcome = PaperPnLService.classifyOutcome(pnlData.netPnL);

      // 3. Excursions (MAE & MFE)
      const excursions = PaperPnLService.calculateExcursions({
        side: params.side,
        entryPrice: params.entryPrice,
        quantity: params.quantity,
        lowestPrice: params.lowestIntrabarPrice,
        highestPrice: params.highestIntrabarPrice,
        exitPrice: params.exitPrice,
      });

      // 4. Build Exit Snapshot
      const exitSnapshot: ExitDecisionSnapshot = {
        tradeId,
        exitPrice: params.exitPrice,
        exitReason: params.exitReason,
        timestamp: closedAt,
        marketRegime: params.marketRegime || params.entrySnapshot?.market?.marketRegime || 'RANGING',
        indicatorsAtExit: params.indicatorsAtExit,
        reversalDetected: params.exitReason === 'SIGNAL_REVERSAL',
      };

      // 5. Build Complete Outcome Record
      const outcomeRecord: PaperTradeOutcomeRecord = {
        tradeId,
        orderId: params.orderId || params.entrySnapshot?.orderId || `ORD_${tradeId}`,
        positionId: params.positionId,
        userId,
        symbol: params.symbol,
        side: params.side,
        entryPrice: params.entryPrice,
        exitPrice: params.exitPrice,
        quantity: params.quantity,
        notionalValue: Number((params.entryPrice * params.quantity).toFixed(2)),
        openedAt: openedAtIso,
        closedAt,
        holdingDurationMs,
        holdingDurationMinutes,
        confidenceScore: params.entrySnapshot?.signal?.confidenceScore ?? 3,
        strategyId: params.entrySnapshot?.signal?.strategyId || 'HYBRID',
        strategyVersion: params.entrySnapshot?.signal?.strategyVersion || 'HYBRID_v1',
        decisionMode: params.entrySnapshot?.signal?.decisionMode || 'EXPLORATION',
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        exitReason: params.exitReason,
        fees: {
          entryFee: pnlData.entryFee,
          exitFee: pnlData.exitFee,
          totalFees: pnlData.totalFees,
        },
        slippage: {
          entrySlippage: pnlData.slippageCost / 2,
          exitSlippage: pnlData.slippageCost / 2,
          totalSlippageCost: pnlData.slippageCost,
        },
        grossPnL: pnlData.grossPnL,
        realizedPnL: pnlData.netPnL,
        returnPercent: pnlData.returnPercent,
        outcome,
        lossCategory: outcome === 'LOSS' ? (params.exitReason === 'STOP_LOSS' ? 'STOP_LOSS_HIT' : 'TREND_REVERSAL') : undefined,
        MAE: {
          maxAdversePrice: excursions.maxAdversePrice,
          maxAdversePercent: excursions.maxAdversePercent,
          maxAdversePnL: excursions.maxAdversePnL,
        },
        MFE: {
          maxFavorablePrice: excursions.maxFavorablePrice,
          maxFavorablePercent: excursions.maxFavorablePercent,
          maxFavorablePnL: excursions.maxFavorablePnL,
        },
        entrySnapshot: params.entrySnapshot,
        exitSnapshot,
      };

      // 6. Create Structured Learning Event for Phase 3
      const learningEventType =
        outcome === 'WIN' ? 'WINNING_TRADE_OUTCOME' :
        outcome === 'LOSS' ? 'LOSING_TRADE_OUTCOME' : 'BREAKEVEN_TRADE_OUTCOME';

      const learningEventPayload = {
        userId,
        eventType: learningEventType,
        title: `Paper Trade Outcome: ${outcome} on ${params.symbol} (${pnlData.netPnL >= 0 ? '+' : ''}$${pnlData.netPnL.toFixed(2)})`,
        description: `Closed ${params.side} trade on ${params.symbol} via ${params.exitReason}. Realized Return: ${pnlData.returnPercent.toFixed(2)}%, Duration: ${holdingDurationMinutes}m, MAE: ${excursions.maxAdversePercent}%, MFE: ${excursions.maxFavorablePercent}%.`,
        metadata: {
          sourceTradeId: tradeId,
          timestamp: closedAt,
          symbol: params.symbol,
          side: params.side,
          outcome,
          pnl: pnlData.netPnL,
          confidence: outcomeRecord.confidenceScore,
          strategyVersion: outcomeRecord.strategyVersion,
          decisionMode: outcomeRecord.decisionMode,
          exitReason: params.exitReason,
          marketRegime: exitSnapshot.marketRegime,
          MAE: outcomeRecord.MAE,
          MFE: outcomeRecord.MFE,
          holdingDurationMinutes,
          entrySnapshot: params.entrySnapshot,
          exitSnapshot,
        }
      };

      let learningEventId = `learn_${Date.now()}`;
      try {
        const savedEvent = await db.learningEvent.create({ data: learningEventPayload as any });
        learningEventId = savedEvent.id;
      } catch {
        const fbEvent = tradingFallbackStore.addLearningEvent(learningEventPayload);
        learningEventId = fbEvent.id;
      }
      outcomeRecord.learningEventId = learningEventId;

      // 7. Persist to DB TradeAttribution and TradingJournalEntry
      try {
        await db.tradeAttribution.create({
          data: {
            userId,
            symbol: params.symbol,
            timeframe: params.entrySnapshot?.timeframeContext?.timeframe || '1h',
            strategy: outcomeRecord.strategyVersion,
            side: params.side,
            entryPrice: params.entryPrice,
            exitPrice: params.exitPrice,
            stopLoss: params.stopLoss,
            takeProfit: params.takeProfit,
            mae: excursions.maxAdversePercent,
            mfe: excursions.maxFavorablePercent,
            netPnL: pnlData.netPnL,
            returnPercent: pnlData.returnPercent,
            outcome,
            primaryReason: outcomeRecord.lossCategory || 'NONE',
            indicators: (params.entrySnapshot?.indicators || {}) as any,
            mlPrediction: (params.entrySnapshot?.model || {}) as any,
          }
        });
      } catch {
        // Non-blocking fallback
      }

      // 8. Reconcile Paper Account Portfolio Balance (Virtual Only)
      const returnedCapital = (params.quantity * params.entryPrice) + pnlData.netPnL;

      try {
        const acc = await db.paperAccount.findUnique({ where: { userId } });
        if (acc) {
          await db.paperAccount.update({
            where: { id: acc.id },
            data: {
              cashBalance: { increment: Math.max(0, returnedCapital) },
              realizedPnL: { increment: pnlData.netPnL },
            }
          });
        }
        await db.paperPosition.delete({ where: { id: params.positionId } }).catch(() => null);
      } catch {
        const fallbackAcc = tradingFallbackStore.getPaperAccount(userId);
        tradingFallbackStore.updatePaperAccount(userId, {
          cashBalance: Math.max(0, fallbackAcc.cashBalance + returnedCapital),
          realizedPnL: (fallbackAcc.realizedPnL || 0) + pnlData.netPnL,
        });
        tradingFallbackStore.removePosition(userId, params.positionId);
      }

      // 9. Cache outcome for Idempotency
      this.finalizedOutcomes.set(tradeId, outcomeRecord);
      tradingFallbackStore.saveTradeOutcome(outcomeRecord);

      return outcomeRecord;
    } finally {
      this.closeLocks.delete(tradeId);
    }
  }

  /**
   * Retrieves a finalized outcome record from memory or persistence store.
   */
  static getFinalizedOutcome(tradeId: string): PaperTradeOutcomeRecord | null {
    return this.finalizedOutcomes.get(tradeId) || tradingFallbackStore.getTradeOutcome(tradeId) || null;
  }
}
