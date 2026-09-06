import { db } from '../db';

export type LossCategory =
  | 'WRONG_DIRECTION'
  | 'FALSE_BREAKOUT'
  | 'TREND_REVERSAL'
  | 'HIGH_VOLATILITY'
  | 'LOW_MOMENTUM'
  | 'STOP_TOO_TIGHT'
  | 'TARGET_TOO_FAR'
  | 'NONE';

export interface TradeAttributionInput {
  userId?: string;
  symbol: string;
  timeframe: string;
  strategy: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  lowestIntrabarPrice?: number;
  highestIntrabarPrice?: number;
  netPnL: number;
  returnPercent: number;
  exitReason: string;
  indicators?: any;
  mlPrediction?: any;
}

export const tradeAttributionEngine = {
  /**
   * Calculate MAE (Maximum Adverse Excursion) % and MFE (Maximum Favorable Excursion) %
   */
  calculateExcursions(
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    lowestPrice?: number,
    highestPrice?: number,
    exitPrice?: number
  ) {
    const low = lowestPrice ?? Math.min(entryPrice, exitPrice ?? entryPrice);
    const high = highestPrice ?? Math.max(entryPrice, exitPrice ?? entryPrice);

    let mae = 0; // % moved against position
    let mfe = 0; // % moved in favor of position

    if (side === 'LONG') {
      mae = ((entryPrice - low) / entryPrice) * 100;
      mfe = ((high - entryPrice) / entryPrice) * 100;
    } else {
      // SHORT
      mae = ((high - entryPrice) / entryPrice) * 100;
      mfe = ((entryPrice - low) / entryPrice) * 100;
    }

    return {
      mae: Number(Math.max(0, mae).toFixed(2)),
      mfe: Number(Math.max(0, mfe).toFixed(2)),
    };
  },

  /**
   * Deterministically classify the primary reason for trade loss or outcome.
   */
  classifyTradeOutcome(
    netPnL: number,
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    exitPrice: number,
    stopLoss: number,
    takeProfit: number,
    mae: number,
    mfe: number,
    indicators?: any,
    mlPrediction?: any
  ): { outcome: 'WIN' | 'LOSS' | 'BREAKEVEN'; primaryReason: LossCategory } {
    if (netPnL > 0) {
      return { outcome: 'WIN', primaryReason: 'NONE' };
    }

    if (Math.abs(netPnL) < entryPrice * 0.0005) {
      return { outcome: 'BREAKEVEN', primaryReason: 'NONE' };
    }

    const volatility = indicators?.volatility ?? 30;
    const atr = indicators?.atr ?? (entryPrice * 0.015);
    const rsi = indicators?.rsi;

    // 1. High Volatility Spike check
    if (volatility > 60 || mae > 3.0) {
      return { outcome: 'LOSS', primaryReason: 'HIGH_VOLATILITY' };
    }

    // 2. Stop Loss too tight check: MFE was positive (> 1%), but MAE hit SL
    if (mfe >= 1.0 && mae >= Math.abs((entryPrice - stopLoss) / entryPrice) * 100) {
      return { outcome: 'LOSS', primaryReason: 'STOP_TOO_TIGHT' };
    }

    // 3. Target too far: MFE reached > 75% of TP target before reversing to SL
    const tpDistance = Math.abs(takeProfit - entryPrice);
    const maxFavDistance = (mfe / 100) * entryPrice;
    if (maxFavDistance >= tpDistance * 0.75) {
      return { outcome: 'LOSS', primaryReason: 'TARGET_TOO_FAR' };
    }

    // 4. False Breakout check: RSI was overbought/oversold at entry and immediately reversed
    if ((side === 'LONG' && rsi && rsi > 68) || (side === 'SHORT' && rsi && rsi < 32)) {
      return { outcome: 'LOSS', primaryReason: 'FALSE_BREAKOUT' };
    }

    // 5. Trend Reversal vs Wrong Direction
    const ema20 = indicators?.ema20;
    const ema50 = indicators?.ema50;
    if (ema20 && ema50) {
      const isTrendMismatch = (side === 'LONG' && ema20 < ema50) || (side === 'SHORT' && ema20 > ema50);
      if (isTrendMismatch) {
        return { outcome: 'LOSS', primaryReason: 'TREND_REVERSAL' };
      }
    }

    return { outcome: 'LOSS', primaryReason: 'WRONG_DIRECTION' };
  },

  /**
   * Process a completed trade and save `TradeAttribution` record to DB.
   */
  async recordAttribution(input: TradeAttributionInput) {
    const { mae, mfe } = this.calculateExcursions(
      input.side,
      input.entryPrice,
      input.lowestIntrabarPrice,
      input.highestIntrabarPrice,
      input.exitPrice
    );

    const { outcome, primaryReason } = this.classifyTradeOutcome(
      input.netPnL,
      input.side,
      input.entryPrice,
      input.exitPrice,
      input.stopLoss,
      input.takeProfit,
      mae,
      mfe,
      input.indicators,
      input.mlPrediction
    );

    try {
      const dbRecord = await db.tradeAttribution.create({
        data: {
          userId: input.userId,
          symbol: input.symbol,
          timeframe: input.timeframe,
          strategy: input.strategy,
          side: input.side,
          entryPrice: input.entryPrice,
          exitPrice: input.exitPrice,
          stopLoss: input.stopLoss,
          takeProfit: input.takeProfit,
          mae,
          mfe,
          netPnL: input.netPnL,
          returnPercent: input.returnPercent,
          outcome,
          primaryReason,
          indicators: (input.indicators || {}) as any,
          mlPrediction: (input.mlPrediction || {}) as any,
        }
      });
      return dbRecord;
    } catch (err) {
      console.error("Failed to store TradeAttribution in DB:", err);
      return null;
    }
  }
};
