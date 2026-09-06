import { prisma } from '@/lib/prisma';
import { recommendationEngine } from './recommendation-engine';
import { ExecutionEngine } from './execution-engine';
import { marketDataService } from '../market/market-data-service';
import { tradingFallbackStore } from './trading-fallback-store';

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
  /**
   * Executes one cycle of the All-Time Monitoring & Controlled Auto-Trading loop for a given user.
   */
  static async runMonitoringCycle(userId: string): Promise<AllTimeCycleResult> {
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
          // Fetch candles to ensure indicators are fresh
          await marketDataService.getCandles(symbol, timeframe, 100);

          // Generate recommendation using Champion Model & Strategy Engine
          const rec = await recommendationEngine.generateRecommendation(symbol, timeframe, userId);
          recommendationsGenerated++;

          logs.push(`[${symbol} ${timeframe}] Signal: ${rec.action} (Score: ${rec.score.toFixed(1)}, Strength: ${rec.strength})`);

          // Only attempt execution if signal is BUY or SELL
          if (rec.action === 'BUY' || rec.action === 'SELL') {
            const result = await ExecutionEngine.processTradeRecommendation(userId, rec);
            logs.push(`[${symbol} ${timeframe}] Execution: ${result.message}`);

            if (result.executed) {
              tradesExecuted++;
            }
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
              description: `Evaluated ${symbol} ${timeframe} under Challenger ${challenger.versionName}. Signal: ${rec.action}`,
              metadata: {
                symbol,
                timeframe,
                challengerVersion: challenger.versionName,
                championSignal: rec.action,
                championScore: rec.score
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
