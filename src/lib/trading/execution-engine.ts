import { prisma } from '@/lib/prisma';
import { ExecutionSafetyEngine, PreTradeValidationResult } from './execution-safety';
import { SimulatedExchangeAdapter, ExecutionResult } from './exchange-adapter';
import { RecommendationObject } from './recommendation-engine';
import { tradingFallbackStore } from './trading-fallback-store';
import { PaperTradeLifecycleEngine, EntryDecisionSnapshot } from './paper-trade-lifecycle';

export interface AutoTradeExecutionSummary {
  executed: boolean;
  validation: PreTradeValidationResult;
  orderResult?: ExecutionResult;
  decisionTrace?: any;
  decisionMode?: string;
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
        decisionTrace: validation.decisionTrace || recommendation.decisionTrace,
        decisionMode: recommendation.decisionMode,
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
        decisionTrace: validation.decisionTrace || recommendation.decisionTrace,
        decisionMode: recommendation.decisionMode,
        message: 'Auto-trading is disabled or paused by user configuration.'
      };
    }

    // 3. Prepare Order Parameters & Freeze Entry Snapshot
    const entryPrice = recommendation.entry.suggestedEntry || (recommendation as any).canonicalSnapshot?.lastPrice || recommendation.entry.low || 0;
    const quantity = recommendation.positionSize || 0.01;
    const recModelVersion = recommendation.mlPrediction?.modelVersion;

    const tradeId = PaperTradeLifecycleEngine.generateTradeId(symbol);
    const orderId = `ORD_${tradeId}`;
    const positionId = `POS_${tradeId}`;

    const entrySnapshot: EntryDecisionSnapshot = PaperTradeLifecycleEngine.createEntrySnapshot({
      tradeId,
      orderId,
      positionId,
      symbol,
      side: recommendation.action === 'BUY' ? 'LONG' : 'SHORT',
      entryPrice,
      riskParams: {
        positionSize: quantity,
        riskPercent: settings.riskPerTrade || 0.01,
        stopLoss: recommendation.stopLoss,
        takeProfit: recommendation.takeProfit,
        riskRewardRatio: recommendation.riskReward || 1.5,
        portfolioExposure: (entryPrice * quantity) / 100000,
        availablePaperBalance: 100000,
      },
      timeframe: recommendation.timeframe || '1h',
      recommendation,
    });

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
      maxSlippage: settings.maxSlippage || 0.005,
      decisionMode: recommendation.decisionMode || 'EXPLOIT',
      confidence: recommendation.score,
      tradeId,
      entrySnapshot,
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
        decisionTrace: validation.decisionTrace || recommendation.decisionTrace,
        decisionMode: recommendation.decisionMode,
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
        decisionTrace: validation.decisionTrace || recommendation.decisionTrace,
        decisionMode: recommendation.decisionMode,
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
      decisionTrace: validation.decisionTrace || recommendation.decisionTrace,
      decisionMode: recommendation.decisionMode,
      message: `[${recommendation.decisionMode || 'EXPLOIT'} Mode] Trade successfully executed for ${symbol} (${quantity} units at $${orderResult.executedPrice.toFixed(2)})`
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
      const isStale = (Date.now() - ticker.timestamp) > (5 * 60 * 1000); // 5 min
      if (isStale) {
        console.warn(`[ExecutionEngine] Stale market data for ${pos.symbol}. Skipping exit check.`);
        continue;
      }

      const price = ticker.last;
      const lowestPrice = Math.min(pos.lowestPrice ?? pos.averageEntry, price);
      const highestPrice = Math.max(pos.highestPrice ?? pos.averageEntry, price);

      const exitEval = PaperTradeLifecycleEngine.evaluateExitConditions({
        side: pos.side,
        currentPrice: price,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        openedAt: pos.openedAt,
      });

      if (exitEval.shouldExit && exitEval.exitReason) {
        const tradeId = pos.tradeId || `PT-${pos.symbol.replace(/USDT$/, '')}-${Date.parse(pos.openedAt) || Date.now()}`;
        const entrySnapshot: EntryDecisionSnapshot = pos.entrySnapshot || PaperTradeLifecycleEngine.createEntrySnapshot({
          tradeId,
          orderId: pos.orderId || `ORD_${pos.id}`,
          positionId: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          entryPrice: pos.averageEntry,
          timeframe: '1h',
          riskParams: {
            positionSize: pos.quantity,
            riskPercent: 0.01,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            riskRewardRatio: 1.5,
            portfolioExposure: 0.10,
            availablePaperBalance: paperAccount.cashBalance || 100000,
          }
        });

        const outcomeRecord = await PaperTradeLifecycleEngine.closeTradeAtomically({
          tradeId,
          orderId: pos.orderId,
          positionId: pos.id,
          userId,
          symbol: pos.symbol,
          side: pos.side,
          entryPrice: pos.averageEntry,
          exitPrice: exitEval.exitPrice,
          quantity: pos.quantity,
          openedAt: pos.openedAt,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          exitReason: exitEval.exitReason,
          lowestIntrabarPrice: lowestPrice,
          highestIntrabarPrice: highestPrice,
          entrySnapshot,
        });

        const pnl = outcomeRecord.realizedPnL;

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
      } else {
        // Update intrabar excursion tracking on active position
        tradingFallbackStore.updatePosition(userId, pos.id, {
          currentPrice: price,
          lowestPrice,
          highestPrice,
        });
      }
    }

    return { closedPositionsCount: closedCount };
  }
}
