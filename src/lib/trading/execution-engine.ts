import { prisma } from '@/lib/prisma';
import { ExecutionSafetyEngine, PreTradeValidationResult } from './execution-safety';
import { SimulatedExchangeAdapter, ExecutionResult } from './exchange-adapter';
import { RecommendationObject } from './recommendation-engine';
import { tradingFallbackStore } from './trading-fallback-store';

export interface AutoTradeExecutionSummary {
  executed: boolean;
  validation: PreTradeValidationResult;
  orderResult?: ExecutionResult;
  message: string;
}

export class ExecutionEngine {
  private static adapter = new SimulatedExchangeAdapter();

  /**
   * Executes a trade recommendation automatically if all safety validation gates pass.
   */
  static async processTradeRecommendation(
    userId: string,
    recommendation: RecommendationObject
  ): Promise<AutoTradeExecutionSummary> {
    const symbol = recommendation.asset || (recommendation as any).symbol;

    // 1. Run 8-Stage Pre-Trade Validation Gate
    const validation = await ExecutionSafetyEngine.validatePreTrade(userId, recommendation);

    if (!validation.allowed) {
      return {
        executed: false,
        validation,
        message: `Trade execution blocked by Safety Gate (${validation.stage}): ${validation.reasons.join('; ')}`
      };
    }

    // 2. Retrieve User Auto-Trading Settings
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

    if (!settings || !settings.enabled || settings.status !== 'ENABLED') {
      return {
        executed: false,
        validation,
        message: 'Auto-trading is disabled or paused by user configuration.'
      };
    }

    // 3. Prepare Order Parameters
    const entryPrice = recommendation.entry.low || recommendation.entry.high || recommendation.entry.suggestedEntry || 0;
    const quantity = recommendation.positionSize || 0.01;
    const recModelVersion = recommendation.mlPrediction?.modelVersion;

    const orderParams = {
      userId,
      symbol,
      side: recommendation.action === 'BUY' ? 'BUY' as const : 'SELL' as const,
      type: 'MARKET' as const,
      quantity,
      requestedPrice: entryPrice,
      stopLoss: recommendation.stopLoss,
      takeProfit: recommendation.takeProfit,
      strategyVersion: settings.strategyVersion || 'HYBRID_v1',
      modelVersion: recModelVersion || settings.modelVersion || 'LOG_v1',
      signalId: recommendation.id || `${symbol}_${Date.now()}`,
      idempotencyKey: validation.idempotencyKey,
      maxSlippage: settings.maxSlippage || 0.005
    };

    // 4. Submit Order via Exchange Adapter
    let orderResult: ExecutionResult;
    try {
      orderResult = await this.adapter.placeOrder(orderParams);
    } catch (err: any) {
      // Trigger Circuit Breaker on execution exception
      await ExecutionSafetyEngine.triggerCircuitBreaker(userId, `Execution exception: ${err.message}`);
      return {
        executed: false,
        validation,
        message: `Exchange order submission failed: ${err.message}`
      };
    }

    if (!orderResult.success) {
      try {
        await prisma.safetyEvent.create({
          data: {
            userId,
            eventType: 'RECONCILIATION_MISMATCH',
            severity: 'WARNING',
            details: `Order submission returned failure: ${orderResult.reason || 'Unknown execution error'}`
          }
        });
      } catch {
        tradingFallbackStore.addSafetyEvent({
          userId,
          eventType: 'RECONCILIATION_MISMATCH',
          severity: 'WARNING',
          details: `Order submission returned failure: ${orderResult.reason || 'Unknown execution error'}`
        });
      }

      return {
        executed: false,
        validation,
        orderResult,
        message: `Order submission failed: ${orderResult.reason}`
      };
    }

    // 5. Create Trading Journal Entry for Audit
    const journalData = {
      userId,
      symbol,
      strategy: settings.strategyVersion || 'HYBRID_v1',
      side: recommendation.action === 'BUY' ? 'LONG' : 'SHORT',
      entryPrice: orderResult.executedPrice,
      exitPrice: 0,
      pnl: 0,
      pnlPercentage: 0,
      exitReason: 'OPEN_POSITION'
    };

    try {
      await prisma.tradingJournalEntry.create({ data: journalData });
    } catch {
      tradingFallbackStore.addJournalEntry(journalData);
    }

    return {
      executed: true,
      validation,
      orderResult,
      message: `Trade successfully executed for ${symbol} at $${orderResult.executedPrice.toFixed(2)}`
    };
  }

  /**
   * Monitor and reconcile active positions against stop-loss and take-profit targets.
   */
  static async monitorPositionsAndExits(userId: string): Promise<{ closedPositionsCount: number }> {
    let paperAccount: any = null;
    try {
      paperAccount = await prisma.paperAccount.findUnique({
        where: { userId },
        include: { positions: true }
      });
    } catch {
      paperAccount = tradingFallbackStore.getPaperAccount(userId);
    }

    if (!paperAccount || !paperAccount.positions || paperAccount.positions.length === 0) {
      return { closedPositionsCount: 0 };
    }

    let closedCount = 0;

    for (const pos of paperAccount.positions) {
      const ticker = await this.adapter.getTicker(pos.symbol);
      const price = ticker.last;
      let shouldExit = false;
      let exitReason = '';
      let exitPrice = price;

      if (pos.side === 'LONG') {
        if (pos.stopLoss && price <= pos.stopLoss) {
          shouldExit = true;
          exitReason = 'STOP_LOSS';
          exitPrice = pos.stopLoss;
        } else if (pos.takeProfit && price >= pos.takeProfit) {
          shouldExit = true;
          exitReason = 'TAKE_PROFIT';
          exitPrice = pos.takeProfit;
        }
      } else if (pos.side === 'SHORT') {
        if (pos.stopLoss && price >= pos.stopLoss) {
          shouldExit = true;
          exitReason = 'STOP_LOSS';
          exitPrice = pos.stopLoss;
        } else if (pos.takeProfit && price <= pos.takeProfit) {
          shouldExit = true;
          exitReason = 'TAKE_PROFIT';
          exitPrice = pos.takeProfit;
        }
      }

      if (shouldExit) {
        // Calculate PnL
        const pnl = pos.side === 'LONG'
          ? (exitPrice - pos.averageEntry) * pos.quantity
          : (pos.averageEntry - exitPrice) * pos.quantity;

        // Return capital to cash balance
        const returnedCash = paperAccount.cashBalance + (pos.quantity * exitPrice) + pnl;

        try {
          await prisma.paperAccount.update({
            where: { userId },
            data: {
              cashBalance: returnedCash,
              realizedPnL: (paperAccount.realizedPnL || 0) + pnl
            }
          });

          await prisma.paperPosition.delete({
            where: { id: pos.id }
          });

          await prisma.tradingJournalEntry.create({
            data: {
              userId,
              symbol: pos.symbol,
              strategy: 'HYBRID_v1',
              side: pos.side,
              entryPrice: pos.averageEntry,
              exitPrice,
              pnl,
              pnlPercentage: (pnl / (pos.averageEntry * pos.quantity)) * 100,
              exitReason
            }
          });
        } catch {
          tradingFallbackStore.updatePaperAccount(userId, {
            cashBalance: returnedCash,
            realizedPnL: (paperAccount.realizedPnL || 0) + pnl
          });
          tradingFallbackStore.removePosition(userId, pos.id);
          tradingFallbackStore.addJournalEntry({
            userId,
            symbol: pos.symbol,
            strategy: 'HYBRID_v1',
            side: pos.side,
            entryPrice: pos.averageEntry,
            exitPrice,
            pnl,
            pnlPercentage: (pnl / (pos.averageEntry * pos.quantity)) * 100,
            exitReason
          });
        }

        // Update Daily Risk State
        const todayStr = new Date().toISOString().split('T')[0];
        let dailyState: any = null;
        try {
          dailyState = await prisma.dailyRiskState.findUnique({
            where: { userId_date: { userId, date: todayStr } }
          });

          if (!dailyState) {
            dailyState = await prisma.dailyRiskState.create({
              data: {
                userId,
                date: todayStr,
                startingBalance: paperAccount.equity || 100000
              }
            });
          }

          const newDailyPnL = (dailyState.realizedPnL || 0) + pnl;
          const isLossLimitHit = newDailyPnL < 0 && Math.abs(newDailyPnL) >= (dailyState.startingBalance * 0.03);

          await prisma.dailyRiskState.update({
            where: { id: dailyState.id },
            data: {
              realizedPnL: newDailyPnL,
              totalTrades: dailyState.totalTrades + 1,
              winningTrades: pnl > 0 ? dailyState.winningTrades + 1 : dailyState.winningTrades,
              losingTrades: pnl < 0 ? dailyState.losingTrades + 1 : dailyState.losingTrades,
              dailyLossLimitReached: isLossLimitHit
            }
          });

          if (isLossLimitHit) {
            await ExecutionSafetyEngine.triggerCircuitBreaker(
              userId,
              `Daily loss limit of 3% reached (${newDailyPnL.toFixed(2)} USD). Auto-trading paused.`
            );
          }
        } catch {
          const currentDaily = tradingFallbackStore.getDailyState(userId, todayStr);
          const newDailyPnL = currentDaily.realizedPnL + pnl;
          const isLossLimitHit = newDailyPnL < 0 && Math.abs(newDailyPnL) >= (currentDaily.startingBalance * 0.03);

          tradingFallbackStore.updateDailyState(userId, todayStr, {
            realizedPnL: newDailyPnL,
            totalTrades: currentDaily.totalTrades + 1,
            winningTrades: pnl > 0 ? currentDaily.winningTrades + 1 : currentDaily.winningTrades,
            losingTrades: pnl < 0 ? currentDaily.losingTrades + 1 : currentDaily.losingTrades,
            dailyLossLimitReached: isLossLimitHit
          });

          if (isLossLimitHit) {
            await ExecutionSafetyEngine.triggerCircuitBreaker(
              userId,
              `Daily loss limit of 3% reached (${newDailyPnL.toFixed(2)} USD). Auto-trading paused.`
            );
          }
        }

        closedCount++;
      }
    }

    return { closedPositionsCount: closedCount };
  }
}
