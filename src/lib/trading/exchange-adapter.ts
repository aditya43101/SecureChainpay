import { prisma } from '@/lib/prisma';
import { marketDataService } from '../market/market-data-service';
import { tradingFallbackStore } from './trading-fallback-store';

export interface ExchangeBalance {
  currency: string;
  free: number;
  used: number;
  total: number;
}

export interface TickerData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: number;
}

export interface PlaceOrderParams {
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  requestedPrice: number;
  stopLoss: number;
  takeProfit: number;
  strategyVersion: string;
  modelVersion: string;
  signalId?: string;
  idempotencyKey: string;
  maxSlippage?: number; // e.g. 0.005 (0.5%)
}

export interface ExecutionResult {
  success: boolean;
  orderId: string;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED' | 'CANCELLED' | 'FAILED';
  executedPrice: number;
  filledQuantity: number;
  fees: number;
  slippage: number;
  reason?: string;
}

export interface ExchangeAdapter {
  getBalance(userId: string): Promise<ExchangeBalance[]>;
  getTicker(symbol: string): Promise<TickerData>;
  placeOrder(params: PlaceOrderParams): Promise<ExecutionResult>;
  cancelOrder(userId: string, orderId: string): Promise<boolean>;
  getOrder(userId: string, orderId: string): Promise<any>;
  reconcileState(userId: string): Promise<{ matched: boolean; discrepancies: string[] }>;
}

export class SimulatedExchangeAdapter implements ExchangeAdapter {
  /**
   * Retrieves free/total balances for user.
   */
  async getBalance(userId: string): Promise<ExchangeBalance[]> {
    let paperAccount: any = null;
    try {
      paperAccount = await prisma.paperAccount.findUnique({
        where: { userId }
      });
    } catch {
      paperAccount = tradingFallbackStore.getPaperAccount(userId);
    }

    if (!paperAccount) {
      paperAccount = tradingFallbackStore.getPaperAccount(userId);
    }

    const cash = paperAccount.cashBalance !== undefined ? paperAccount.cashBalance : 100000;
    const equity = paperAccount.equity !== undefined ? paperAccount.equity : 100000;
    const used = Math.max(0, equity - cash);

    return [
      { currency: 'HSCT', free: cash, used, total: equity }
    ];
  }

  /**
   * Fetches latest ticker price.
   */
  async getTicker(symbol: string): Promise<TickerData> {
    try {
      const ticker = await marketDataService.getTicker(symbol);
      const price = ticker && ticker.price ? parseFloat(ticker.price) : (symbol.startsWith('BTC') ? 65000 : 3500);
      const spread = price * 0.0002;

      return {
        symbol,
        bid: price - spread,
        ask: price + spread,
        last: price,
        timestamp: Date.now()
      };
    } catch {
      const price = symbol.startsWith('BTC') ? 65000 : 3500;
      return {
        symbol,
        bid: price * 0.9998,
        ask: price * 1.0002,
        last: price,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Submits an order to the exchange adapter with idempotency & slippage check.
   */
  async placeOrder(params: PlaceOrderParams): Promise<ExecutionResult> {
    // 1. Idempotency Check
    let existingOrder: any = null;
    try {
      existingOrder = await prisma.executionOrder.findUnique({
        where: { idempotencyKey: params.idempotencyKey }
      });
    } catch {
      existingOrder = tradingFallbackStore.findOrderByKey(params.idempotencyKey);
    }

    if (existingOrder) {
      return {
        success: existingOrder.status === 'FILLED' || existingOrder.status === 'PARTIALLY_FILLED',
        orderId: existingOrder.orderId,
        status: existingOrder.status as any,
        executedPrice: existingOrder.executedPrice || params.requestedPrice,
        filledQuantity: existingOrder.filledQuantity,
        fees: existingOrder.fees,
        slippage: existingOrder.slippage,
        reason: 'Order returned from idempotency cache'
      };
    }

    // 2. Fetch Live Price for Slippage Check
    const ticker = await this.getTicker(params.symbol);
    const executionPrice = params.side === 'BUY' ? ticker.ask : ticker.bid;
    const priceDiffPct = params.requestedPrice > 0 ? Math.abs(executionPrice - params.requestedPrice) / params.requestedPrice : 0;
    const maxSlippage = params.maxSlippage || 0.005;

    if (priceDiffPct > maxSlippage && params.requestedPrice > 0) {
      const rejectedOrderData = {
        userId: params.userId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        requestedPrice: params.requestedPrice,
        executedPrice: executionPrice,
        quantity: params.quantity,
        filledQuantity: 0,
        status: 'REJECTED' as const,
        fees: 0,
        slippage: priceDiffPct,
        strategyVersion: params.strategyVersion,
        modelVersion: params.modelVersion,
        signalId: params.signalId,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        idempotencyKey: params.idempotencyKey
      };

      try {
        await prisma.executionOrder.create({ data: rejectedOrderData });
      } catch {
        tradingFallbackStore.addOrder(params.userId, rejectedOrderData);
      }

      return {
        success: false,
        orderId: `ORD_${Date.now()}`,
        status: 'REJECTED',
        executedPrice: executionPrice,
        filledQuantity: 0,
        fees: 0,
        slippage: priceDiffPct,
        reason: `Slippage ${(priceDiffPct * 100).toFixed(2)}% exceeds max allowed ${(maxSlippage * 100).toFixed(2)}%`
      };
    }

    // 3. Simulate Order Execution & Fee Calculation
    const feeRate = 0.001; // 0.1% fee
    const fees = params.quantity * executionPrice * feeRate;
    const filledQuantity = params.quantity;

    const filledOrderData = {
      userId: params.userId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      requestedPrice: params.requestedPrice,
      executedPrice: executionPrice,
      quantity: params.quantity,
      filledQuantity,
      status: 'FILLED' as const,
      fees,
      slippage: priceDiffPct,
      strategyVersion: params.strategyVersion,
      modelVersion: params.modelVersion,
      signalId: params.signalId,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      idempotencyKey: params.idempotencyKey
    };

    let orderId = `ORDER_${Date.now()}`;
    try {
      const dbOrder = await prisma.executionOrder.create({
        data: {
          ...filledOrderData,
          reconciledAt: new Date()
        }
      });
      orderId = dbOrder.orderId;
    } catch {
      const fbOrder = tradingFallbackStore.addOrder(params.userId, filledOrderData);
      orderId = fbOrder.orderId;
    }

    // 4. Mirror to Paper Account for Portfolio Reconciliation
    const notionalCost = filledQuantity * executionPrice + fees;

    try {
      let paperAccount = await prisma.paperAccount.findUnique({
        where: { userId: params.userId }
      });

      if (!paperAccount) {
        paperAccount = await prisma.paperAccount.create({
          data: { userId: params.userId }
        });
      }

      if (params.side === 'BUY') {
        const updatedCash = Math.max(0, paperAccount.cashBalance - notionalCost);
        await prisma.paperAccount.update({
          where: { userId: params.userId },
          data: { cashBalance: updatedCash }
        });

        await prisma.paperPosition.create({
          data: {
            accountId: paperAccount.id,
            symbol: params.symbol,
            side: 'LONG',
            quantity: filledQuantity,
            averageEntry: executionPrice,
            currentPrice: executionPrice,
            stopLoss: params.stopLoss,
            takeProfit: params.takeProfit,
            unrealizedPnL: 0
          }
        });
      }
    } catch {
      const acc = tradingFallbackStore.getPaperAccount(params.userId);
      if (params.side === 'BUY') {
        const updatedCash = Math.max(0, acc.cashBalance - notionalCost);
        tradingFallbackStore.updatePaperAccount(params.userId, { cashBalance: updatedCash });
        tradingFallbackStore.addPosition(params.userId, {
          symbol: params.symbol,
          side: 'LONG',
          quantity: filledQuantity,
          averageEntry: executionPrice,
          currentPrice: executionPrice,
          stopLoss: params.stopLoss || 0,
          takeProfit: params.takeProfit || 0,
          unrealizedPnL: 0
        });
      }
    }

    return {
      success: true,
      orderId,
      status: 'FILLED',
      executedPrice: executionPrice,
      filledQuantity,
      fees,
      slippage: priceDiffPct
    };
  }

  /**
   * Cancels an order.
   */
  async cancelOrder(userId: string, orderId: string): Promise<boolean> {
    try {
      const order = await prisma.executionOrder.findFirst({
        where: { userId, orderId }
      });

      if (!order || order.status === 'FILLED' || order.status === 'CANCELLED') {
        return false;
      }

      await prisma.executionOrder.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' }
      });

      return true;
    } catch {
      return true;
    }
  }

  /**
   * Retrieves order status.
   */
  async getOrder(userId: string, orderId: string): Promise<any> {
    try {
      return await prisma.executionOrder.findFirst({
        where: { userId, orderId }
      });
    } catch {
      const orders = tradingFallbackStore.getOrders(userId);
      return orders.find(o => o.orderId === orderId || o.id === orderId) || null;
    }
  }

  /**
   * Reconciles local state vs simulated exchange portfolio.
   */
  async reconcileState(userId: string): Promise<{ matched: boolean; discrepancies: string[] }> {
    const discrepancies: string[] = [];
    let paperAccount: any = null;

    try {
      paperAccount = await prisma.paperAccount.findUnique({
        where: { userId },
        include: { positions: true }
      });
    } catch {
      paperAccount = tradingFallbackStore.getPaperAccount(userId);
    }

    if (!paperAccount) {
      return { matched: true, discrepancies: [] };
    }

    if (paperAccount.positions) {
      for (const pos of paperAccount.positions) {
        if (pos.quantity <= 0) {
          discrepancies.push(`Position for ${pos.symbol} has invalid quantity ${pos.quantity}`);
        }
      }
    }

    return {
      matched: discrepancies.length === 0,
      discrepancies
    };
  }
}
