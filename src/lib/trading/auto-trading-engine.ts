import { prisma } from '@/lib/prisma';
import { recommendationEngine, RecommendationObject } from './recommendation-engine';
import { ExecutionEngine } from './execution-engine';
import { marketDataService } from '../market/market-data-service';
import { tradingFallbackStore } from './trading-fallback-store';
import { TradingBrain, TradingDecisionContext } from './trading-brain';
import { EntryTimingEngine } from './entry-timing-engine';

export interface AllTimeCycleResult {
  userId: string;
  timestamp: string;
  allTimeModeEnabled: boolean;
  status: string;
  assetsEvaluated: string[];
  recommendationsGenerated: number;
  tradesExecuted: number;
  positionsClosed: number;
  shadowModeEvaluations: number;
  logs: string[];
}

export class AutoTradingEngine {
  private static activeCycles = new Set<string>();

  /**
   * Executes one cycle of the All-Time Monitoring & Controlled Auto-Trading loop for a given user.
   */
  static async runMonitoringCycle(userId: string): Promise<AllTimeCycleResult> {
    if (this.activeCycles.has(userId)) {
      return {
        userId,
        timestamp: new Date().toISOString(),
        allTimeModeEnabled: true,
        status: 'BUSY',
        assetsEvaluated: [],
        recommendationsGenerated: 0,
        tradesExecuted: 0,
        positionsClosed: 0,
        shadowModeEvaluations: 0,
        logs: ['Monitoring cycle already running for user. Duplicate cycle execution prevented by mutex lock.']
      };
    }

    this.activeCycles.add(userId);
    try {
      return await this.executeCycleInternal(userId);
    } finally {
      this.activeCycles.delete(userId);
    }
  }

  private static async executeCycleInternal(userId: string): Promise<AllTimeCycleResult> {
    const logs: string[] = [];

    // 1. Fetch user auto-trading settings
    let settings: any = null;
    try {
      settings = await prisma.autoTradingSettings.findUnique({
        where: { userId }
      });
    } catch {
      settings = tradingFallbackStore.getSettings(userId);
    }

    if (!settings) {
      settings = tradingFallbackStore.getSettings(userId);
    }

    if (!settings) {
      return {
        userId,
        timestamp: new Date().toISOString(),
        allTimeModeEnabled: false,
        status: 'DISABLED',
        assetsEvaluated: [],
        recommendationsGenerated: 0,
        tradesExecuted: 0,
        positionsClosed: 0,
        shadowModeEvaluations: 0,
        logs: ['Auto-trading settings not initialized.']
      };
    }

    if (!settings.enabled || settings.status !== 'ENABLED') {
      return {
        userId,
        timestamp: new Date().toISOString(),
        allTimeModeEnabled: settings.allTimeMode || false,
        status: settings.status,
        assetsEvaluated: [],
        recommendationsGenerated: 0,
        tradesExecuted: 0,
        positionsClosed: 0,
        shadowModeEvaluations: 0,
        logs: [`Auto-trading is ${settings.status}. Cycle skipped.`]
      };
    }

    logs.push(`Starting All-Time Monitoring cycle for user ${userId} at ${new Date().toLocaleTimeString()}`);

    // 2. First: Monitor active open positions and execute SL/TP exits
    let closedPositionsCount = 0;
    try {
      const exitRes = await ExecutionEngine.monitorPositionsAndExits(userId);
      closedPositionsCount = exitRes.closedPositionsCount;
      if (closedPositionsCount > 0) {
        logs.push(`Closed ${closedPositionsCount} active positions via Stop-Loss or Take-Profit targets.`);
      }
    } catch (err: any) {
      logs.push(`Position monitor notice: ${err.message}`);
    }

    let recommendationsGenerated = 0;
    let tradesExecuted = 0;
    let shadowModeEvaluations = 0;
    const assetsEvaluated = settings.allowedAssets || ['BTCUSDT', 'ETHUSDT'];
    const timeframes = settings.allowedTimeframes || ['1h'];

    // 3. Loop through configured assets (BTCUSDT, ETHUSDT)
    for (const symbol of assetsEvaluated) {
      for (const timeframe of timeframes) {
        try {
          // Steps 1-3: Fetch Canonical Market Snapshot
          const snapshot = await marketDataService.getCanonicalSnapshot(symbol, timeframe, 100);

          // Steps 4-11: Trading Brain evaluation (Market Understanding, Regime, Timing, Risk, Learning)
          const brainContext: TradingDecisionContext = await TradingBrain.evaluate({
            userId,
            symbol,
            timeframe,
            snapshot,
            userRisk: {
              accountCapital: 100000,
              maxRiskPerTrade: settings.riskPerTrade || 0.01,
              maxDailyLoss: settings.maxDailyLoss || 0.03,
              maxAssetExposure: settings.maxAssetExposure || 0.10,
              minRiskReward: settings.minRiskReward || 1.5,
            }
          });
          recommendationsGenerated++;

          logs.push(`[${symbol} ${timeframe}] [${brainContext.marketRegime}] Brain Decision: ${brainContext.decision} (Signal: ${brainContext.signal}, Score: ${brainContext.confidence}/7, Quality: ${brainContext.entryQualityScore}/100, Mode: ${brainContext.mode})`);
          logs.push(`[${symbol} ${timeframe}] Reason: ${brainContext.reason}`);

          // Step 12 & 13: Act on Brain Decision (SIGNAL != DECISION)
          if (brainContext.decision === 'ENTER_LONG' || brainContext.decision === 'ENTER_SHORT') {
            const rec: RecommendationObject = {
              id: brainContext.decisionId,
              asset: symbol,
              timeframe,
              action: brainContext.decision === 'ENTER_LONG' ? 'BUY' : 'SELL',
              strength: brainContext.confidence >= 6 ? 'HIGH' : (brainContext.confidence >= 4 ? 'MEDIUM' : 'LOW'),
              decisionMode: brainContext.mode,
              entry: brainContext.risk.entry,
              stopLoss: brainContext.risk.stopLoss,
              takeProfit: brainContext.risk.takeProfit,
              riskReward: brainContext.risk.riskRewardRatio,
              positionSize: brainContext.positionSizing.positionSize,
              positionValueUSD: brainContext.positionSizing.positionValueUSD,
              strategy: brainContext.mode === 'EXPLOIT' ? 'HYBRID' : 'HYBRID_EXPLORATION',
              score: brainContext.confidence,
              maxScore: 7,
              riskAssessment: brainContext.risk,
              reasons: [brainContext.reason, ...brainContext.entryConditions],
              warnings: brainContext.risk.warnings,
              canonicalSnapshot: snapshot,
              brainContext,
              timestamp: brainContext.timestamp,
              dataTimestamp: snapshot.candleTimestamp,
            };

            const result = await ExecutionEngine.processTradeRecommendation(userId, rec);
            logs.push(`[${symbol} ${timeframe}] [${brainContext.mode} Mode] Paper Execution: ${result.executed ? 'APPROVED & FILLED' : 'REJECTED'} (${result.message})`);

            if (result.executed) {
              tradesExecuted++;
              EntryTimingEngine.clearPendingSignal(userId, symbol);
            }
          } else if (brainContext.decision === 'WAIT') {
            logs.push(`[${symbol} ${timeframe}] Entry Timing: WAITING_FOR_ENTRY (${brainContext.timing.waitConditions.join('; ') || 'Waiting for favorable confirmation'})`);
          } else if (brainContext.decision === 'EXIT') {
            logs.push(`[${symbol} ${timeframe}] Strategy Reversal detected: closing open position.`);
            await ExecutionEngine.monitorPositionsAndExits(userId);
          } else {
            logs.push(`[${symbol} ${timeframe}] Decision: ${brainContext.decision} (Monitoring market)`);
          }

          // 4. Shadow Mode Evaluation for Challenger Models
          let challengerVersions: any[] = [];
          try {
            challengerVersions = await prisma.strategyVersion.findMany({
              where: { isChallenger: true }
            });
          } catch {
            challengerVersions = tradingFallbackStore.getStrategyVersions().filter(v => v.isChallenger);
          }

          for (const challenger of challengerVersions) {
            shadowModeEvaluations++;
            const shadowEvt = {
              userId,
              eventType: 'SHADOW_MODE_EVALUATION',
              title: `Shadow Evaluation: ${challenger.versionName}`,
              description: `Evaluated ${symbol} ${timeframe} under Challenger ${challenger.versionName}. Signal: ${brainContext.signal}`,
              metadata: {
                symbol,
                timeframe,
                challengerVersion: challenger.versionName,
                championSignal: brainContext.signal,
                championScore: brainContext.confidence
              }
            };

            try {
              await prisma.learningEvent.create({ data: shadowEvt });
            } catch {
              tradingFallbackStore.addLearningEvent(shadowEvt);
            }
          }
        } catch (err: any) {
          logs.push(`[${symbol} ${timeframe}] Evaluation notice: ${err.message}`);
        }
      }
    }

    logs.push(`Cycle complete. Signals evaluated: ${recommendationsGenerated}, Trades placed: ${tradesExecuted}`);

    return {
      userId,
      timestamp: new Date().toISOString(),
      allTimeModeEnabled: settings.allTimeMode || false,
      status: settings.status,
      assetsEvaluated,
      recommendationsGenerated,
      tradesExecuted,
      positionsClosed: closedPositionsCount,
      shadowModeEvaluations,
      logs
    };
  }
}
