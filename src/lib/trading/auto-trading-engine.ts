import { prisma } from '@/lib/prisma';
import { recommendationEngine } from './recommendation-engine';
import { ExecutionEngine } from './execution-engine';
import { marketDataService } from '../market/market-data-service';

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
    const settings = await prisma.autoTradingSettings.findUnique({
      where: { userId }
    });

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
        allTimeModeEnabled: settings.allTimeMode,
        status: settings.status,
        assetsEvaluated: [],
        recommendationsGenerated: 0,
        tradesExecuted: 0,
        positionsClosed: 0,
        shadowModeEvaluations: 0,
        logs: [`Auto-trading is ${settings.status}. Cycle skipped.`]
      };
    }

    logs.push(`Starting All-Time Monitoring cycle for user ${userId} at ${new Date().toISOString()}`);

    // 2. First: Monitor active open positions and execute SL/TP exits
    const { closedPositionsCount } = await ExecutionEngine.monitorPositionsAndExits(userId);
    if (closedPositionsCount > 0) {
      logs.push(`Closed ${closedPositionsCount} active positions via Stop-Loss or Take-Profit targets.`);
    }

    let recommendationsGenerated = 0;
    let tradesExecuted = 0;
    let shadowModeEvaluations = 0;
    const assetsEvaluated = settings.allowedAssets;

    // 3. Loop through configured assets (BTCUSDT, ETHUSDT)
    for (const symbol of assetsEvaluated) {
      for (const timeframe of settings.allowedTimeframes) {
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
            logs.push(`[${symbol} ${timeframe}] Execution result: ${result.message}`);

            if (result.executed) {
              tradesExecuted++;
            }
          }

          // 4. Shadow Mode Evaluation for Challenger Models
          const challengerVersions = await prisma.strategyVersion.findMany({
            where: { isChallenger: true }
          });

          for (const challenger of challengerVersions) {
            shadowModeEvaluations++;
            // Log hypothetical signal without execution
            await prisma.learningEvent.create({
              data: {
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
              }
            });
          }
        } catch (err: any) {
          logs.push(`[${symbol} ${timeframe}] Error during evaluation cycle: ${err.message}`);
        }
      }
    }

    logs.push(`Completed cycle. Recommendations: ${recommendationsGenerated}, Executed Trades: ${tradesExecuted}`);

    return {
      userId,
      timestamp: new Date().toISOString(),
      allTimeModeEnabled: settings.allTimeMode,
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
