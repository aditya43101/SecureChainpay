import { prisma } from '@/lib/prisma';
import { ExecutionSafetyEngine, PreTradeValidationResult } from './execution-safety';
import { SimulatedExchangeAdapter, ExecutionResult } from './exchange-adapter';
import { RecommendationObject } from './recommendation-engine';

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
    const settings = await prisma.autoTradingSettings.findUnique({
      where: { userId }
    });

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
      strategyVersion: settings.strategyVersion,
      modelVersion: recModelVersion || settings.modelVersion,
      signalId: recommendation.id || `${symbol}_${Date.now()}`,
      idempotencyKey: validation.idempotencyKey,
      maxSlippage: settings.maxSlippage
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
      await prisma.safetyEvent.create({
        data: {
          userId,
          eventType: 'RECONCILIATION_MISMATCH',
          severity: 'WARNING',
          details: `Order submission returned failure: ${orderResult.reason || 'Unknown execution error'}`
        }
      });

      return {
        executed: false,
        validation,
        orderResult,
        message: `Order submission failed: ${orderResult.reason}`
      };
    }

    // 5. Create Trading Journal Entry for Audit
    await prisma.tradingJournalEntry.create({
      data: {
        userId,
        symbol,
        strategy: settings.strategyVersion,
        side: recommendation.action === 'BUY' ? 'LONG' : 'SHORT',
        entryPrice: orderResult.executedPrice,
        exitPrice: 0,
        pnl: 0,
        pnlPercentage: 0,
        exitReason: 'OPEN_POSITION'
      }
    });

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
    const paperAccount = await prisma.paperAccount.findUnique({
      where: { userId },
      include: { positions: true }
    });

    if (!paperAccount || paperAccount.positions.length === 0) {
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
        if (price <= pos.stopLoss) {
          shouldExit = true;
          exitReason = 'STOP_LOSS';
          exitPrice = pos.stopLoss;
        } else if (price >= pos.takeProfit) {
          shouldExit = true;
          exitReason = 'TAKE_PROFIT';
          exitPrice = pos.takeProfit;
        }
      } else if (pos.side === 'SHORT') {
        if (price >= pos.stopLoss) {
          shouldExit = true;
          exitReason = 'STOP_LOSS';
          exitPrice = pos.stopLoss;
        } else if (price <= pos.takeProfit) {
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
        await prisma.paperAccount.update({
          where: { userId },
          data: {
            cashBalance: returnedCash,
            realizedPnL: paperAccount.realizedPnL + pnl
          }
        });

        // Delete open position
        await prisma.paperPosition.delete({
          where: { id: pos.id }
        });

        // Log close trade in Journal
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

        // Update Daily Risk State
        const todayStr = new Date().toISOString().split('T')[0];
        let dailyState = await prisma.dailyRiskState.findUnique({
          where: { userId_date: { userId, date: todayStr } }
        });

        if (!dailyState) {
          dailyState = await prisma.dailyRiskState.create({
            data: {
              userId,
              date: todayStr,
              startingBalance: paperAccount.equity
            }
          });
        }

        const newDailyPnL = dailyState.realizedPnL + pnl;
        const isLossLimitHit = newDailyPnL < 0 && Math.abs(newDailyPnL) >= (dailyState.startingBalance * 0.03); // 3% max daily loss

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

        closedCount++;
      }
    }

    return { closedPositionsCount: closedCount };
  }
}
