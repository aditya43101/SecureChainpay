import { db } from '../db';
import { marketDataService } from '../market/market-data-service';
import { recommendationEngine } from './recommendation-engine';
import { convertHsctToUsd, formatCurrency } from '../currency/currency-service';
import { tradingFallbackStore } from './trading-fallback-store';
import { technicalAnalysisService } from '../market/technical-analysis';
import {
  PaperTradeLifecycleEngine,
  PaperPnLService,
  EntryDecisionSnapshot,
  ExitReasonType,
  PaperTradeOutcomeRecord,
} from './paper-trade-lifecycle';

export interface PaperAccountSummary {
  id: string;
  userId: string;
  currency: 'HSCT';
  initialBalance: number;
  cashBalance: number;
  equity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalReturn: number;
  positionsCount: number;
  ordersCount: number;
  structuredEquity?: {
    hsctAmount: number;
    usdEquivalent: number;
    formattedHsct: string;
    formattedUsd: string;
  };
}

export const paperEngine = {
  /**
   * Get or initialize a Paper Account for a user (default $100,000 virtual capital).
   * Monitored open positions are audited against market conditions, SL/TP triggers, and excursions.
   */
  async getOrCreateAccount(userId: string): Promise<PaperAccountSummary> {
    let account: any = null;

    try {
      account = await db.paperAccount.findUnique({
        where: { userId },
        include: {
          positions: true,
          orders: true,
        }
      });

      if (!account) {
        account = await db.paperAccount.create({
          data: {
            userId,
            initialBalance: 100000.0,
            cashBalance: 100000.0,
            equity: 100000.0,
            realizedPnL: 0.0,
          },
          include: {
            positions: true,
            orders: true,
          }
        });
      }
    } catch {
      account = tradingFallbackStore.getPaperAccount(userId);
    }

    if (!account) {
      account = tradingFallbackStore.getPaperAccount(userId);
    }

    if (!account.positions || account.positions.length === 0) {
      const fbAcc = tradingFallbackStore.getPaperAccount(userId);
      if (fbAcc && fbAcc.positions && fbAcc.positions.length > 0) {
        account = {
          ...account,
          positions: fbAcc.positions,
          cashBalance: fbAcc.cashBalance || account.cashBalance,
          equity: fbAcc.equity || account.equity,
          realizedPnL: fbAcc.realizedPnL || account.realizedPnL,
        };
      }
    }

    // Refresh position prices, excursion boundaries, and evaluate deterministic exits
    let totalUnrealizedPnL = 0;
    const updatedPositions = [];
    const positionsList = account.positions || [];

    for (const pos of positionsList) {
      try {
        const ticker = await marketDataService.getTicker(pos.symbol);
        const livePrice = parseFloat(ticker.price) || pos.currentPrice || pos.averageEntry;
        const tickerTimestamp = ticker?.timestamp ? new Date(ticker.timestamp).getTime() : Date.now();
        const isStale = (Date.now() - tickerTimestamp) > (5 * 60 * 1000); // 5 min staleness limit

        if (isStale) {
          console.warn(`[paperEngine] Market data for ${pos.symbol} is stale (${Math.round((Date.now() - tickerTimestamp) / 1000)}s old). Skipping exit evaluation.`);
          updatedPositions.push(pos);
          continue;
        }

        // Excursion tracking (MAE and MFE)
        const lowestPrice = Math.min(pos.lowestPrice ?? pos.averageEntry, livePrice);
        const highestPrice = Math.max(pos.highestPrice ?? pos.averageEntry, livePrice);

        const unrealizedPnL = pos.side === 'LONG'
          ? (livePrice - pos.averageEntry) * pos.quantity
          : (pos.averageEntry - livePrice) * pos.quantity;

        totalUnrealizedPnL += unrealizedPnL;

        // Evaluate deterministic exit conditions with priority:
        // STOP_LOSS > TAKE_PROFIT > RISK_LIMIT > SIGNAL_REVERSAL > TIMEOUT
        const exitEval = PaperTradeLifecycleEngine.evaluateExitConditions({
          side: pos.side,
          currentPrice: livePrice,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          openedAt: pos.openedAt,
        });

        if (exitEval.shouldExit && exitEval.exitReason) {
          const tradeId = pos.tradeId || `PT-${pos.symbol.replace(/USDT$/, '')}-${Date.parse(pos.openedAt) || Date.now()}`;

          // Construct or reconstruct entry snapshot if not already frozen
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
              availablePaperBalance: account.cashBalance,
            }
          });

          // Atomic close with canonical PnL, MAE/MFE, and structured learning event
          await PaperTradeLifecycleEngine.closeTradeAtomically({
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

          continue; // Position closed; omit from active positions list
        } else {
          // Update intrabar excursion tracking and live price
          try {
            await db.paperPosition.update({
              where: { id: pos.id },
              data: {
                currentPrice: livePrice,
                unrealizedPnL
              }
            });
          } catch {
            tradingFallbackStore.updatePosition(userId, pos.id, {
              currentPrice: livePrice,
              unrealizedPnL,
              lowestPrice,
              highestPrice,
            });
          }
          updatedPositions.push({
            ...pos,
            currentPrice: livePrice,
            unrealizedPnL,
            lowestPrice,
            highestPrice,
          });
        }
      } catch (err) {
        console.warn(`[paperEngine] Position update notice for ${pos.symbol}:`, err);
        updatedPositions.push(pos);
      }
    }

    const currentEquity = (account.cashBalance || 100000) + totalUnrealizedPnL;
    const initialBal = account.initialBalance || 100000;
    const totalReturn = initialBal > 0 ? ((currentEquity - initialBal) / initialBal) * 100 : 0;

    try {
      await db.paperAccount.update({
        where: { id: account.id },
        data: { equity: currentEquity }
      });
    } catch {
      tradingFallbackStore.updatePaperAccount(userId, { equity: currentEquity });
    }

    const eqNum = Number(currentEquity.toFixed(2));
    const usdEq = convertHsctToUsd(eqNum);

    return {
      id: account.id || `paper_${userId}`,
      userId: account.userId || userId,
      currency: 'HSCT',
      initialBalance: initialBal,
      cashBalance: Number((account.cashBalance || 100000).toFixed(2)),
      equity: eqNum,
      realizedPnL: Number((account.realizedPnL || 0).toFixed(2)),
      unrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
      totalReturn: Number(totalReturn.toFixed(2)),
      positionsCount: updatedPositions.length,
      ordersCount: (account.orders || []).length,
      structuredEquity: {
        hsctAmount: eqNum,
        usdEquivalent: usdEq,
        formattedHsct: formatCurrency(eqNum, 'HSCT'),
        formattedUsd: formatCurrency(usdEq, 'USD'),
      }
    };
  },

  /**
   * Execute a simulated paper trade order with immutable Entry Decision Snapshot.
   */
  async placePaperOrder(
    userId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity?: number,
    timeframe: string = '1h'
  ) {
    const account = await this.getOrCreateAccount(userId);
    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

    // 1. Generate recommendation to obtain Strategy, Signal, Indicators, SL and TP
    const rec = await recommendationEngine.generateRecommendation(formattedSymbol, timeframe, userId);

    if (rec.action === 'NO_TRADE' && !quantity) {
      throw new Error(`Strategy Engine recommends NO_TRADE for ${formattedSymbol} due to risk/strategy constraints.`);
    }

    // 2. Market price & validation
    const ticker = await marketDataService.getTicker(formattedSymbol);
    const executionPrice = parseFloat(ticker.price) || rec.entry.suggestedEntry;

    if (!executionPrice || executionPrice <= 0) {
      throw new Error(`Unable to fetch valid market price for ${formattedSymbol}`);
    }

    // 3. Mathematical validation of Stop Loss & Take Profit
    const positionSide: 'LONG' | 'SHORT' = side === 'BUY' ? 'LONG' : 'SHORT';
    let stopLoss = rec.stopLoss;
    let takeProfit = rec.takeProfit;

    const riskValidation = PaperPnLService.validateRiskBoundaries({
      side: positionSide,
      entryPrice: executionPrice,
      stopLoss,
      takeProfit,
    });

    if (!riskValidation.valid) {
      // Autocorrect to safe ATR-based default boundaries (2% SL, 3% TP)
      if (positionSide === 'LONG') {
        stopLoss = executionPrice * 0.98;
        takeProfit = executionPrice * 1.03;
      } else {
        stopLoss = executionPrice * 1.02;
        takeProfit = executionPrice * 0.97;
      }
    }

    const tradeQuantity = quantity || rec.positionSize || (1000 / executionPrice);
    const orderCost = tradeQuantity * executionPrice;

    if (orderCost > account.cashBalance) {
      throw new Error(`Insufficient simulated cash ($${account.cashBalance.toFixed(2)}) for $${orderCost.toFixed(2)} paper trade.`);
    }

    const fees = orderCost * PaperPnLService.DEFAULT_FEE_RATE;

    // 4. Generate unique immutable Trade ID & Order ID
    const tradeId = PaperTradeLifecycleEngine.generateTradeId(formattedSymbol);
    const orderId = `ORD_${tradeId}`;
    const positionId = `POS_${tradeId}`;

    // 5. Compute indicators & candles for immutable Entry Snapshot
    const candles = await marketDataService.getCandles(formattedSymbol, timeframe, 50);
    const indicators = technicalAnalysisService.calculateIndicators(candles);
    const entryCandle = candles.length > 0 ? candles[candles.length - 1] : undefined;

    const entrySnapshot = PaperTradeLifecycleEngine.createEntrySnapshot({
      tradeId,
      orderId,
      positionId,
      symbol: formattedSymbol,
      side: positionSide,
      entryPrice: executionPrice,
      bid: (ticker as any).bid ? parseFloat((ticker as any).bid) : executionPrice * 0.9998,
      ask: (ticker as any).ask ? parseFloat((ticker as any).ask) : executionPrice * 1.0002,
      volume: ticker.volume24h ? parseFloat(ticker.volume24h) : entryCandle?.volume,
      indicators,
      recommendation: rec,
      riskParams: {
        positionSize: tradeQuantity,
        riskPercent: 0.01,
        stopLoss,
        takeProfit,
        riskRewardRatio: rec.riskReward || 1.5,
        portfolioExposure: (orderCost / (account.equity || 100000)),
        availablePaperBalance: account.cashBalance - orderCost - fees,
      },
      timeframe,
      entryCandle,
    });

    let paperOrder: any = null;
    let paperPosition: any = null;

    try {
      // Deduct virtual cash
      await db.paperAccount.update({
        where: { id: account.id },
        data: {
          cashBalance: { decrement: orderCost + fees },
        }
      });

      // Create Paper Order Record
      paperOrder = await db.paperOrder.create({
        data: {
          id: orderId,
          accountId: account.id,
          symbol: formattedSymbol,
          side,
          type: 'MARKET',
          quantity: tradeQuantity,
          price: executionPrice,
          stopLoss,
          takeProfit,
          fees,
          status: 'FILLED',
        }
      });

      paperPosition = await db.paperPosition.create({
        data: {
          id: positionId,
          accountId: account.id,
          symbol: formattedSymbol,
          side: positionSide,
          quantity: tradeQuantity,
          averageEntry: executionPrice,
          currentPrice: executionPrice,
          stopLoss,
          takeProfit,
          unrealizedPnL: 0,
        }
      });
    } catch {
      tradingFallbackStore.updatePaperAccount(userId, {
        cashBalance: Math.max(0, account.cashBalance - orderCost - fees)
      });

      paperPosition = tradingFallbackStore.addPosition(userId, {
        tradeId,
        orderId,
        symbol: formattedSymbol,
        side: positionSide,
        quantity: tradeQuantity,
        averageEntry: executionPrice,
        currentPrice: executionPrice,
        lowestPrice: executionPrice,
        highestPrice: executionPrice,
        stopLoss,
        takeProfit,
        unrealizedPnL: 0,
        decisionMode: rec.decisionMode || 'EXPLORATION',
        confidence: rec.score,
        entrySnapshot,
      });

      paperOrder = tradingFallbackStore.addOrder(userId, {
        symbol: formattedSymbol,
        side,
        type: 'MARKET',
        quantity: tradeQuantity,
        requestedPrice: executionPrice,
        executedPrice: executionPrice,
        stopLoss,
        takeProfit,
        fees,
        status: 'FILLED'
      });
    }

    return {
      success: true,
      tradeId,
      message: `Simulated paper ${side} order filled for ${tradeQuantity.toFixed(4)} ${formattedSymbol} at $${executionPrice.toLocaleString()}.`,
      order: paperOrder,
      position: {
        ...paperPosition,
        tradeId,
        entrySnapshot,
      }
    };
  },

  /**
   * Explicit manual position close endpoint.
   * Atomically closes the position, calculates canonical PnL, excursions,
   * generates the exit snapshot, emits a learning event, and returns the full outcome record.
   */
  async closePosition(
    userId: string,
    positionId: string,
    exitReason: ExitReasonType = 'MANUAL_PAPER_CLOSE'
  ): Promise<PaperTradeOutcomeRecord> {
    const account = await this.getOrCreateAccount(userId);
    let position = (account as any).positions?.find((p: any) => p.id === positionId);

    if (!position) {
      const fbPos = tradingFallbackStore.getPositionById(positionId);
      if (fbPos && fbPos.userId === userId) {
        position = fbPos.position;
      }
    }

    if (!position) {
      throw new Error(`Active paper position with ID ${positionId} not found for user.`);
    }

    const ticker = await marketDataService.getTicker(position.symbol);
    const livePrice = parseFloat(ticker.price) || position.currentPrice || position.averageEntry;

    const tradeId = position.tradeId || `PT-${position.symbol.replace(/USDT$/, '')}-${Date.parse(position.openedAt) || Date.now()}`;
    const entrySnapshot: EntryDecisionSnapshot = position.entrySnapshot || PaperTradeLifecycleEngine.createEntrySnapshot({
      tradeId,
      orderId: position.orderId || `ORD_${position.id}`,
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.averageEntry,
      timeframe: '1h',
      riskParams: {
        positionSize: position.quantity,
        riskPercent: 0.01,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        riskRewardRatio: 1.5,
        portfolioExposure: 0.10,
        availablePaperBalance: account.cashBalance,
      }
    });

    const outcomeRecord = await PaperTradeLifecycleEngine.closeTradeAtomically({
      tradeId,
      orderId: position.orderId,
      positionId: position.id,
      userId,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.averageEntry,
      exitPrice: livePrice,
      quantity: position.quantity,
      openedAt: position.openedAt,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      exitReason,
      lowestIntrabarPrice: position.lowestPrice ?? position.averageEntry,
      highestIntrabarPrice: position.highestPrice ?? position.averageEntry,
      entrySnapshot,
    });

    return outcomeRecord;
  },

  /**
   * Reset Paper Account back to initial $100,000 balance.
   */
  async resetAccount(userId: string) {
    try {
      const account = await db.paperAccount.findUnique({ where: { userId } });
      if (account) {
        await db.paperPosition.deleteMany({ where: { accountId: account.id } });
        await db.paperOrder.deleteMany({ where: { accountId: account.id } });

        await db.paperAccount.update({
          where: { id: account.id },
          data: {
            initialBalance: 100000.0,
            cashBalance: 100000.0,
            equity: 100000.0,
            realizedPnL: 0.0,
          }
        });
      }
    } catch {
      tradingFallbackStore.updatePaperAccount(userId, {
        initialBalance: 100000.0,
        cashBalance: 100000.0,
        equity: 100000.0,
        realizedPnL: 0.0,
        positions: [],
        orders: []
      });
    }

    return { success: true, message: 'Paper Account reset to $100,000 simulated balance.' };
  }
};
