import { db } from '../db';
import { marketDataService } from '../market/market-data-service';
import { recommendationEngine } from './recommendation-engine';
import { convertHsctToUsd, formatCurrency } from '../currency/currency-service';

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
   */
  async getOrCreateAccount(userId: string): Promise<PaperAccountSummary> {
    let account = await db.paperAccount.findUnique({
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

    // Update positions with live prices and calculate unrealized PnL
    let totalUnrealizedPnL = 0;
    const updatedPositions = [];

    for (const pos of account.positions) {
      try {
        const ticker = await marketDataService.getTicker(pos.symbol);
        const livePrice = parseFloat(ticker.price) || pos.currentPrice;

        const unrealizedPnL = pos.side === 'LONG'
          ? (livePrice - pos.averageEntry) * pos.quantity
          : (pos.averageEntry - livePrice) * pos.quantity;

        totalUnrealizedPnL += unrealizedPnL;

        // Auto SL/TP Check against Live Market Price
        let isClosed = false;
        let exitReason = '';

        if (pos.side === 'LONG') {
          if (livePrice <= pos.stopLoss) {
            isClosed = true;
            exitReason = 'STOP_LOSS';
          } else if (livePrice >= pos.takeProfit) {
            isClosed = true;
            exitReason = 'TAKE_PROFIT';
          }
        } else if (pos.side === 'SHORT') {
          if (livePrice >= pos.stopLoss) {
            isClosed = true;
            exitReason = 'STOP_LOSS';
          } else if (livePrice <= pos.takeProfit) {
            isClosed = true;
            exitReason = 'TAKE_PROFIT';
          }
        }

        if (isClosed) {
          // Close position
          const realizedGain = unrealizedPnL;
          const returnedCash = (pos.quantity * pos.averageEntry) + realizedGain;

          await db.paperAccount.update({
            where: { id: account.id },
            data: {
              cashBalance: { increment: returnedCash },
              realizedPnL: { increment: realizedGain },
            }
          });

          await db.paperPosition.delete({ where: { id: pos.id } });

          // Record Journal Entry
          await db.tradingJournalEntry.create({
            data: {
              userId,
              symbol: pos.symbol,
              strategy: 'HYBRID',
              side: pos.side,
              entryPrice: pos.averageEntry,
              exitPrice: livePrice,
              pnl: realizedGain,
              pnlPercentage: (realizedGain / (pos.quantity * pos.averageEntry)) * 100,
              exitReason,
              lossCategory: realizedGain < 0 ? (exitReason === 'STOP_LOSS' ? 'STOP_LOSS_HIT' : 'TREND_REVERSAL') : undefined,
            }
          });

          continue; // Skip adding to active list
        } else {
          // Update live position price in DB
          await db.paperPosition.update({
            where: { id: pos.id },
            data: {
              currentPrice: livePrice,
              unrealizedPnL
            }
          });
          updatedPositions.push({ ...pos, currentPrice: livePrice, unrealizedPnL });
        }
      } catch (err) {
        console.error(`Failed to update live paper position ${pos.symbol}:`, err);
        updatedPositions.push(pos);
      }
    }

    const currentEquity = account.cashBalance + totalUnrealizedPnL;
    const totalReturn = ((currentEquity - account.initialBalance) / account.initialBalance) * 100;

    await db.paperAccount.update({
      where: { id: account.id },
      data: { equity: currentEquity }
    });

    const eqNum = Number(currentEquity.toFixed(2));
    const usdEq = convertHsctToUsd(eqNum);

    return {
      id: account.id,
      userId: account.userId,
      currency: 'HSCT',
      initialBalance: account.initialBalance,
      cashBalance: account.cashBalance,
      equity: eqNum,
      realizedPnL: Number(account.realizedPnL.toFixed(2)),
      unrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
      totalReturn: Number(totalReturn.toFixed(2)),
      positionsCount: updatedPositions.length,
      ordersCount: account.orders.length,
      structuredEquity: {
        hsctAmount: eqNum,
        usdEquivalent: usdEq,
        formattedHsct: formatCurrency(eqNum, 'HSCT'),
        formattedUsd: formatCurrency(usdEq, 'USD'),
      }
    };
  },

  /**
   * Execute a simulated paper trade order.
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

    // Generate recommendation to get entry, SL, and TP
    const rec = await recommendationEngine.generateRecommendation(formattedSymbol, timeframe, userId);

    if (rec.action === 'NO_TRADE' && !quantity) {
      throw new Error(`Strategy Engine recommends NO_TRADE for ${formattedSymbol} due to risk/strategy constraints.`);
    }

    const ticker = await marketDataService.getTicker(formattedSymbol);
    const executionPrice = parseFloat(ticker.price) || rec.entry.suggestedEntry;

    const tradeQuantity = quantity || rec.positionSize || (1000 / executionPrice);
    const orderCost = tradeQuantity * executionPrice;

    if (orderCost > account.cashBalance) {
      throw new Error(`Insufficient simulated cash ($${account.cashBalance.toFixed(2)}) for $${orderCost.toFixed(2)} paper trade.`);
    }

    const fees = orderCost * 0.00075; // 0.075% simulated fee

    // Deduct virtual cash
    await db.paperAccount.update({
      where: { id: account.id },
      data: {
        cashBalance: { decrement: orderCost + fees },
      }
    });

    // Create Paper Order Record
    const paperOrder = await db.paperOrder.create({
      data: {
        accountId: account.id,
        symbol: formattedSymbol,
        side,
        type: 'MARKET',
        quantity: tradeQuantity,
        price: executionPrice,
        stopLoss: rec.stopLoss,
        takeProfit: rec.takeProfit,
        fees,
        status: 'FILLED',
      }
    });

    // Create or update Paper Position
    const positionSide = side === 'BUY' ? 'LONG' : 'SHORT';
    const paperPosition = await db.paperPosition.create({
      data: {
        accountId: account.id,
        symbol: formattedSymbol,
        side: positionSide,
        quantity: tradeQuantity,
        averageEntry: executionPrice,
        currentPrice: executionPrice,
        stopLoss: rec.stopLoss,
        takeProfit: rec.takeProfit,
        unrealizedPnL: 0,
      }
    });

    return {
      success: true,
      message: `Simulated paper ${side} order filled for ${tradeQuantity.toFixed(4)} ${formattedSymbol} at $${executionPrice.toLocaleString()}.`,
      order: paperOrder,
      position: paperPosition
    };
  },

  /**
   * Reset Paper Account back to initial $100,000 balance.
   */
  async resetAccount(userId: string) {
    const account = await db.paperAccount.findUnique({ where: { userId } });
    if (!account) return;

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

    return { success: true, message: 'Paper Account reset to $100,000 simulated balance.' };
  }
};
