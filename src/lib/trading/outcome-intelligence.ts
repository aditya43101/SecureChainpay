import { db } from '../db';
import { tradingFallbackStore } from './trading-fallback-store';
import { PaperTradeOutcomeRecord } from './paper-trade-lifecycle';
import { PatternIntelligenceEngine, PatternRecord, CandidateLesson } from './pattern-intelligence-engine';

export interface ConfidenceBucketStats {
  score: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  netPnL: number;
  returnPercent: number;
}

export interface RegimePerformanceStats {
  regime: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnL: number;
}

export interface OutcomeAnalyticsSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  lossRate: number;
  totalPnL: number;
  averagePnL: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  averageHoldingDurationMinutes: number;

  byAsset: {
    BTC: {
      trades: number;
      wins: number;
      losses: number;
      winRate: number;
      netPnL: number;
    };
    ETH: {
      trades: number;
      wins: number;
      losses: number;
      winRate: number;
      netPnL: number;
    };
    OTHER: {
      trades: number;
      wins: number;
      losses: number;
      winRate: number;
      netPnL: number;
    };
  };

  byDecisionMode: {
    EXPLORATION: {
      trades: number;
      wins: number;
      losses: number;
      winRate: number;
      netPnL: number;
    };
    EXPLOITATION: {
      trades: number;
      wins: number;
      losses: number;
      winRate: number;
      netPnL: number;
    };
  };

  confidencePerformance: ConfidenceBucketStats[];
  regimePerformance: RegimePerformanceStats[];
  strategyPerformance: {
    strategyId: string;
    strategyVersion: string;
    tradeCount: number;
    winRate: number;
    netPnL: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  }[];
}

export class OutcomeIntelligenceService {
  /**
   * Retrieves a single trade's complete outcome record by tradeId.
   */
  static async getTradeOutcome(tradeId: string): Promise<PaperTradeOutcomeRecord | null> {
    const outcome = tradingFallbackStore.getTradeOutcome(tradeId);
    if (outcome) return outcome;

    try {
      const attribution = await db.tradeAttribution.findFirst({
        where: { id: tradeId },
      });
      if (attribution) {
        return attribution as any;
      }
    } catch {
      // Non-blocking fallback
    }

    return null;
  }

  /**
   * Retrieves structured learning events for a symbol or across the system.
   */
  static async getLearningEvents(symbol?: string, options?: { limit?: number; userId?: string }): Promise<any[]> {
    const limit = options?.limit ?? 50;
    let events: any[] = [];

    try {
      const whereClause: any = {};
      if (options?.userId) whereClause.userId = options.userId;

      events = await db.learningEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch {
      events = tradingFallbackStore.getLearningEvents(limit);
    }

    const fallbackEvents = tradingFallbackStore.getLearningEvents(limit);
    if (!events || events.length === 0) {
      events = fallbackEvents;
    } else {
      const ids = new Set(events.map((e: any) => e.id));
      for (const fe of fallbackEvents) {
        if (!ids.has(fe.id)) events.push(fe);
      }
    }

    if (symbol) {
      const targetSymbol = symbol.toUpperCase().replace(/USDT$/, '');
      events = events.filter(e => {
        let meta = e.metadata;
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch {}
        }
        const sym = (meta?.symbol || e.title || e.description || '').toUpperCase();
        return sym.includes(targetSymbol);
      });
    }

    return events;
  }

  /**
   * Exposes winning trade patterns discovered through pattern intelligence.
   * Consumed by Phase 3 & 4.
   */
  static async getWinningPatterns(symbol?: string): Promise<PatternRecord[] | any[]> {
    const candidatePatterns = await PatternIntelligenceEngine.getWinningPatterns(symbol);
    if (candidatePatterns.length > 0) return candidatePatterns;

    const events = await this.getLearningEvents(symbol, { limit: 100 });
    return events.filter(e => e.eventType === 'WINNING_TRADE_OUTCOME');
  }

  /**
   * Exposes losing trade patterns discovered through pattern intelligence.
   * Consumed by Phase 3 & 4.
   */
  static async getLosingPatterns(symbol?: string): Promise<PatternRecord[] | any[]> {
    const candidatePatterns = await PatternIntelligenceEngine.getLosingPatterns(symbol);
    if (candidatePatterns.length > 0) return candidatePatterns;

    const events = await this.getLearningEvents(symbol, { limit: 100 });
    return events.filter(e => e.eventType === 'LOSING_TRADE_OUTCOME');
  }

  /**
   * Retrieves candidate lessons for display or assistant reasoning.
   */
  static async getCandidateLessons(symbol?: string): Promise<CandidateLesson[]> {
    return PatternIntelligenceEngine.getCandidateLessons(symbol);
  }

  /**
   * Retrieves relevant patterns matching current setup.
   */
  static async getRelevantPatterns(symbol: string, side: 'LONG' | 'SHORT', currentFeatures?: any): Promise<PatternRecord[]> {
    return PatternIntelligenceEngine.getRelevantPatterns(symbol, side, currentFeatures);
  }

  /**
   * Prepares pattern evidence for Phase 4 backtesting.
   */
  static async getPatternEvidence(patternId: string) {
    return PatternIntelligenceEngine.getPatternEvidence(patternId);
  }

  /**
   * Prepares backtest dataset for Phase 4 validation.
   */
  static async getPatternBacktestDataset(patternId: string) {
    return PatternIntelligenceEngine.getPatternBacktestDataset(patternId);
  }

  /**
   * Compares pattern performance against overall baseline.
   */
  static async comparePatternPerformance(patternId: string) {
    return PatternIntelligenceEngine.comparePatternPerformance(patternId);
  }

  /**
   * Generates candidate strategy adjustment for Phase 4 backtest.
   * STRICT: Does NOT apply or modify live parameters.
   */
  static generateCandidateStrategyAdjustment(pattern: PatternRecord) {
    return PatternIntelligenceEngine.generateCandidateStrategyAdjustment(pattern);
  }

  /**
   * Retrieves complete Entry + Exit snapshot for auditing or debugging.
   */
  static async getTradeSnapshot(tradeId: string): Promise<{
    tradeId: string;
    entrySnapshot?: any;
    exitSnapshot?: any;
    outcomeRecord?: PaperTradeOutcomeRecord | null;
  }> {
    const outcome = await this.getTradeOutcome(tradeId);
    return {
      tradeId,
      entrySnapshot: outcome?.entrySnapshot,
      exitSnapshot: outcome?.exitSnapshot,
      outcomeRecord: outcome,
    };
  }

  /**
   * Computes comprehensive Outcome Analytics across all paper trades.
   */
  static async getOutcomeAnalytics(userId?: string): Promise<OutcomeAnalyticsSummary> {
    const allOutcomes: PaperTradeOutcomeRecord[] = tradingFallbackStore.getAllTradeOutcomes(userId);

    const totalTrades = allOutcomes.length;
    let wins = 0;
    let losses = 0;
    let breakevens = 0;
    let totalPnL = 0;
    let grossWinsPnL = 0;
    let grossLossesPnL = 0;
    let totalDurationMinutes = 0;

    const btcStats = { trades: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0 };
    const ethStats = { trades: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0 };
    const otherStats = { trades: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0 };

    const exploreStats = { trades: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0 };
    const exploitStats = { trades: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0 };

    const confidenceBuckets: Record<number, { trades: number; wins: number; losses: number; breakevens: number; netPnL: number; returns: number[] }> = {
      1: { trades: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      2: { trades: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      3: { trades: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      4: { trades: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      5: { trades: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      6: { trades: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
      7: { trades: 0, wins: 0, losses: 0, breakevens: 0, netPnL: 0, returns: [] },
    };

    const regimeMap = new Map<string, { trades: number; wins: number; losses: number; netPnL: number }>();
    const strategyMap = new Map<string, { trades: number; wins: number; losses: number; netPnL: number; grossWins: number; grossLosses: number }>();

    for (const trade of allOutcomes) {
      const pnl = trade.realizedPnL;
      totalPnL += pnl;
      totalDurationMinutes += trade.holdingDurationMinutes || 0;

      if (trade.outcome === 'WIN') {
        wins++;
        grossWinsPnL += pnl;
      } else if (trade.outcome === 'LOSS') {
        losses++;
        grossLossesPnL += Math.abs(pnl);
      } else {
        breakevens++;
      }

      // Asset categorization
      const sym = trade.symbol.toUpperCase();
      const assetTarget = sym.includes('BTC') ? btcStats : (sym.includes('ETH') ? ethStats : otherStats);
      assetTarget.trades++;
      assetTarget.netPnL += pnl;
      if (trade.outcome === 'WIN') assetTarget.wins++;
      if (trade.outcome === 'LOSS') assetTarget.losses++;

      // Decision Mode
      const mode = trade.decisionMode === 'EXPLOITATION' ? exploitStats : exploreStats;
      mode.trades++;
      mode.netPnL += pnl;
      if (trade.outcome === 'WIN') mode.wins++;
      if (trade.outcome === 'LOSS') mode.losses++;

      // Confidence score bucket (1 to 7)
      const conf = Math.max(1, Math.min(7, Math.round(trade.confidenceScore || 3)));
      const bucket = confidenceBuckets[conf];
      bucket.trades++;
      bucket.netPnL += pnl;
      bucket.returns.push(trade.returnPercent);
      if (trade.outcome === 'WIN') bucket.wins++;
      else if (trade.outcome === 'LOSS') bucket.losses++;
      else bucket.breakevens++;

      // Market Regime
      const regime = trade.exitSnapshot?.marketRegime || trade.entrySnapshot?.market?.marketRegime || 'RANGING';
      const regObj = regimeMap.get(regime) || { trades: 0, wins: 0, losses: 0, netPnL: 0 };
      regObj.trades++;
      regObj.netPnL += pnl;
      if (trade.outcome === 'WIN') regObj.wins++;
      if (trade.outcome === 'LOSS') regObj.losses++;
      regimeMap.set(regime, regObj);

      // Strategy
      const stratKey = `${trade.strategyId}_${trade.strategyVersion}`;
      const stratObj = strategyMap.get(stratKey) || { trades: 0, wins: 0, losses: 0, netPnL: 0, grossWins: 0, grossLosses: 0 };
      stratObj.trades++;
      stratObj.netPnL += pnl;
      if (trade.outcome === 'WIN') {
        stratObj.wins++;
        stratObj.grossWins += pnl;
      } else if (trade.outcome === 'LOSS') {
        stratObj.losses++;
        stratObj.grossLosses += Math.abs(pnl);
      }
      strategyMap.set(stratKey, stratObj);
    }

    btcStats.winRate = btcStats.trades > 0 ? Number(((btcStats.wins / btcStats.trades) * 100).toFixed(1)) : 0;
    ethStats.winRate = ethStats.trades > 0 ? Number(((ethStats.wins / ethStats.trades) * 100).toFixed(1)) : 0;
    otherStats.winRate = otherStats.trades > 0 ? Number(((otherStats.wins / otherStats.trades) * 100).toFixed(1)) : 0;

    exploreStats.winRate = exploreStats.trades > 0 ? Number(((exploreStats.wins / exploreStats.trades) * 100).toFixed(1)) : 0;
    exploitStats.winRate = exploitStats.trades > 0 ? Number(((exploitStats.wins / exploitStats.trades) * 100).toFixed(1)) : 0;

    const confidencePerformance: ConfidenceBucketStats[] = Object.entries(confidenceBuckets).map(([scoreStr, b]) => {
      const score = parseInt(scoreStr, 10);
      const avgReturn = b.returns.length > 0 ? b.returns.reduce((a, c) => a + c, 0) / b.returns.length : 0;
      return {
        score,
        totalTrades: b.trades,
        wins: b.wins,
        losses: b.losses,
        breakevens: b.breakevens,
        winRate: b.trades > 0 ? Number(((b.wins / b.trades) * 100).toFixed(1)) : 0,
        netPnL: Number(b.netPnL.toFixed(2)),
        returnPercent: Number(avgReturn.toFixed(2)),
      };
    });

    const regimePerformance: RegimePerformanceStats[] = Array.from(regimeMap.entries()).map(([regime, r]) => ({
      regime,
      totalTrades: r.trades,
      wins: r.wins,
      losses: r.losses,
      winRate: r.trades > 0 ? Number(((r.wins / r.trades) * 100).toFixed(1)) : 0,
      netPnL: Number(r.netPnL.toFixed(2)),
    }));

    const strategyPerformance = Array.from(strategyMap.entries()).map(([stratKey, s]) => {
      const [strategyId, strategyVersion] = stratKey.split('_');
      return {
        strategyId,
        strategyVersion,
        tradeCount: s.trades,
        winRate: s.trades > 0 ? Number(((s.wins / s.trades) * 100).toFixed(1)) : 0,
        netPnL: Number(s.netPnL.toFixed(2)),
        avgWin: s.wins > 0 ? Number((s.grossWins / s.wins).toFixed(2)) : 0,
        avgLoss: s.losses > 0 ? Number((s.grossLosses / s.losses).toFixed(2)) : 0,
        profitFactor: s.grossLosses > 0 ? Number((s.grossWins / s.grossLosses).toFixed(2)) : (s.grossWins > 0 ? 99.9 : 1.0),
      };
    });

    const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
    const lossRate = totalTrades > 0 ? Number(((losses / totalTrades) * 100).toFixed(1)) : 0;
    const averagePnL = totalTrades > 0 ? Number((totalPnL / totalTrades).toFixed(2)) : 0;
    const averageWin = wins > 0 ? Number((grossWinsPnL / wins).toFixed(2)) : 0;
    const averageLoss = losses > 0 ? Number((grossLossesPnL / losses).toFixed(2)) : 0;
    const profitFactor = grossLossesPnL > 0 ? Number((grossWinsPnL / grossLossesPnL).toFixed(2)) : (grossWinsPnL > 0 ? 99.9 : 1.0);
    const averageHoldingDurationMinutes = totalTrades > 0 ? Number((totalDurationMinutes / totalTrades).toFixed(1)) : 0;

    return {
      totalTrades,
      wins,
      losses,
      breakevens,
      winRate,
      lossRate,
      totalPnL: Number(totalPnL.toFixed(2)),
      averagePnL,
      averageWin,
      averageLoss,
      profitFactor,
      averageHoldingDurationMinutes,
      byAsset: {
        BTC: { ...btcStats, netPnL: Number(btcStats.netPnL.toFixed(2)) },
        ETH: { ...ethStats, netPnL: Number(ethStats.netPnL.toFixed(2)) },
        OTHER: { ...otherStats, netPnL: Number(otherStats.netPnL.toFixed(2)) },
      },
      byDecisionMode: {
        EXPLORATION: { ...exploreStats, netPnL: Number(exploreStats.netPnL.toFixed(2)) },
        EXPLOITATION: { ...exploitStats, netPnL: Number(exploitStats.netPnL.toFixed(2)) },
      },
      confidencePerformance,
      regimePerformance,
      strategyPerformance,
    };
  }
}
