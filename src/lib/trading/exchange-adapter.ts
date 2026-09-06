import { prisma } from '@/lib/prisma';
import { marketDataService } from '../market/market-data-service';

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
    const paperAccount = await prisma.paperAccount.findUnique({
      where: { userId }
    });

    if (!paperAccount) {
      return [{ currency: 'HSCT', free: 100000, used: 0, total: 100000 }];
    }

    const used = Math.max(0, paperAccount.equity - paperAccount.cashBalance);
    return [
      { currency: 'HSCT', free: paperAccount.cashBalance, used, total: paperAccount.equity }
    ];
  }

  /**
   * Fetches latest ticker price.
   */
  async getTicker(symbol: string): Promise<TickerData> {
    const ticker = await marketDataService.getTicker(symbol);
    const price = ticker && ticker.price ? parseFloat(ticker.price) : (symbol.startsWith('BTC') ? 65000 : 3500);
    const spread = price * 0.0002; // 0.02% spread simulation

    return {
      symbol,
      bid: price - spread,
      ask: price + spread,
      last: price,
      timestamp: Date.now()
    };
  }

  /**
   * Submits an order to the exchange adapter with idempotency & slippage check.
   */
  async placeOrder(params: PlaceOrderParams): Promise<ExecutionResult> {
    // 1. Idempotency Check
    const existingOrder = await prisma.executionOrder.findUnique({
      where: { idempotencyKey: params.idempotencyKey }
    });

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
    const priceDiffPct = Math.abs(executionPrice - params.requestedPrice) / params.requestedPrice;
    const maxSlippage = params.maxSlippage || 0.005; // 0.5% default

    if (priceDiffPct > maxSlippage) {
      const dbOrder = await prisma.executionOrder.create({
        data: {
          userId: params.userId,
          symbol: params.symbol,
          side: params.side,
          type: params.type,
          requestedPrice: params.requestedPrice,
          executedPrice: executionPrice,
          quantity: params.quantity,
          filledQuantity: 0,
          status: 'REJECTED',
          fees: 0,
          slippage: priceDiffPct,
          strategyVersion: params.strategyVersion,
          modelVersion: params.modelVersion,
          signalId: params.signalId,
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
          idempotencyKey: params.idempotencyKey
        }
      });

      return {
        success: false,
        orderId: dbOrder.orderId,
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
    const filledQuantity = params.quantity; // 100% fill for market orders

    // Create Execution Order record in DB
    const dbOrder = await prisma.executionOrder.create({
      data: {
        userId: params.userId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        requestedPrice: params.requestedPrice,
        executedPrice: executionPrice,
        quantity: params.quantity,
        filledQuantity,
        status: 'FILLED',
        fees,
        slippage: priceDiffPct,
        strategyVersion: params.strategyVersion,
        modelVersion: params.modelVersion,
        signalId: params.signalId,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        idempotencyKey: params.idempotencyKey,
        reconciledAt: new Date()
      }
    });

    // 4. Mirror to Paper Account for Portfolio Reconciliation
    let paperAccount = await prisma.paperAccount.findUnique({
      where: { userId: params.userId }
    });

    if (!paperAccount) {
      paperAccount = await prisma.paperAccount.create({
        data: { userId: params.userId }
      });
    }

    const notionalCost = filledQuantity * executionPrice + fees;

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

    return {
      success: true,
      orderId: dbOrder.orderId,
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
  }

  /**
   * Retrieves order status.
   */
  async getOrder(userId: string, orderId: string): Promise<any> {
    return prisma.executionOrder.findFirst({
      where: { userId, orderId }
    });
  }

  /**
   * Reconciles local state vs simulated exchange portfolio.
   */
  async reconcileState(userId: string): Promise<{ matched: boolean; discrepancies: string[] }> {
    const discrepancies: string[] = [];
    const paperAccount = await prisma.paperAccount.findUnique({
      where: { userId },
      include: { positions: true }
    });

    if (!paperAccount) {
      return { matched: true, discrepancies: [] };
    }

    // Check positions integrity
    for (const pos of paperAccount.positions) {
      if (pos.quantity <= 0) {
        discrepancies.push(`Position for ${pos.symbol} has invalid quantity ${pos.quantity}`);
      }
    }

    return {
      matched: discrepancies.length === 0,
      discrepancies
    };
  }
}
