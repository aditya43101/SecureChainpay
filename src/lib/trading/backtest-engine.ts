import { db } from '../db';
import { marketDataService, Candle } from '../market/market-data-service';
import { technicalAnalysisService } from '../market/technical-analysis';
import { strategyEngine } from './strategy-engine';
import { riskEngine } from './risk-engine';
import { DEFAULT_STRATEGY_CONFIG } from './strategy-config';

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  strategyName?: string; // HYBRID, EMA_TREND, RSI, MACD, BREAKOUT
  feeRate?: number;      // e.g., 0.00075 (0.075%)
  slippageRate?: number; // e.g., 0.0005 (0.05%)
  riskPerTrade?: number; // e.g., 0.01 (1%)
  minRiskReward?: number;
}

export interface BacktestTradeResult {
  tradeNumber: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  fees: number;
  slippage: number;
  grossPnL: number;
  netPnL: number;
  returnPercentage: number;
  exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'SIGNAL_EXIT' | 'END_OF_BACKTEST';
  marketRegime?: string;
}

export interface BacktestSummary {
  id?: string;
  symbol: string;
  timeframe: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  benchmarkReturn: number; // Buy & Hold return %
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalFees: number;
  totalSlippage: number;
  equityCurve: { timestamp: string; equity: number; drawdown: number }[];
  trades: BacktestTradeResult[];
}

export const backtestEngine = {
  /**
   * Execute historical backtest over available candles.
   */
  async runBacktest(
    config: BacktestConfig,
    userId?: string
  ): Promise<BacktestSummary> {
    const symbol = config.symbol.endsWith('USDT') ? config.symbol : `${config.symbol}USDT`;
    const timeframe = config.timeframe || '1h';
    const initialCapital = config.initialCapital || 100000;
    const feeRate = config.feeRate ?? 0.00075;
    const slippageRate = config.slippageRate ?? 0.0005;
    const riskPerTrade = config.riskPerTrade ?? 0.01;
    const minRiskReward = config.minRiskReward ?? 1.5;
    const strategyName = config.strategyName || 'HYBRID';

    // 1. Fetch Historical Candles
    const candles = await marketDataService.getCandles(symbol, timeframe, 1000);
    
    if (candles.length < 60) {
      throw new Error(`Insufficient historical candles (${candles.length}) for backtesting.`);
    }

    // Filter by date if provided
    let evalCandles = candles;
    if (config.startDate) {
      evalCandles = evalCandles.filter(c => new Date(c.timestamp) >= new Date(config.startDate!));
    }
    if (config.endDate) {
      evalCandles = evalCandles.filter(c => new Date(c.timestamp) <= new Date(config.endDate!));
    }

    if (evalCandles.length < 50) {
      evalCandles = candles.slice(-500); // Fallback to last 500
    }

    // 2. Simulation State Initialization
    let cash = initialCapital;
    let equity = initialCapital;
    let peakEquity = initialCapital;
    let maxDrawdown = 0;
    let totalFees = 0;
    let totalSlippage = 0;

    const trades: BacktestTradeResult[] = [];
    const equityCurve: { timestamp: string; equity: number; drawdown: number }[] = [];

    interface ActivePosition {
      tradeNumber: number;
      side: 'LONG' | 'SHORT';
      entryTime: string;
      entryPrice: number;
      quantity: number;
      stopLoss: number;
      takeProfit: number;
      entryFees: number;
      entrySlippage: number;
    }

    let activePosition: ActivePosition | null = null;
    let tradeCounter = 0;

    // Minimum window size for technical indicators calculation
    const windowSize = 50;

    // Replay loop chronologically
    for (let i = windowSize; i < evalCandles.length; i++) {
      const historicalSlice = evalCandles.slice(0, i); // Up to current candle T
      const currentCandle = evalCandles[i - 1];
      const nextCandle = evalCandles[i];

      const timestamp = nextCandle.timestamp;
      const currentPrice = currentCandle.close;

      // Update Equity if position is open
      if (activePosition) {
        const unrealizedPnL = activePosition.side === 'LONG'
          ? (nextCandle.close - activePosition.entryPrice) * activePosition.quantity
          : (activePosition.entryPrice - nextCandle.close) * activePosition.quantity;
        equity = cash + unrealizedPnL;
      } else {
        equity = cash;
      }

      // Track Peak Equity & Drawdown
      if (equity > peakEquity) peakEquity = equity;
      const currentDrawdown = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
      if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;

      equityCurve.push({
        timestamp,
        equity: Number(equity.toFixed(2)),
        drawdown: Number(currentDrawdown.toFixed(2))
      });

      // --- CHECK ACTIVE POSITION EXITS (SL / TP) ---
      if (activePosition) {
        let isExit = false;
        let exitPrice = 0;
        let exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'SIGNAL_EXIT' | 'END_OF_BACKTEST' = 'STOP_LOSS';

        const { side, stopLoss, takeProfit } = activePosition;

        if (side === 'LONG') {
          const hitSL = nextCandle.low <= stopLoss;
          const hitTP = nextCandle.high >= takeProfit;

          if (hitSL && hitTP) {
            // Intrabar conflict rule: Assume Stop Loss hit first (conservative)
            isExit = true;
            exitPrice = stopLoss;
            exitReason = 'STOP_LOSS';
          } else if (hitSL) {
            isExit = true;
            exitPrice = stopLoss;
            exitReason = 'STOP_LOSS';
          } else if (hitTP) {
            isExit = true;
            exitPrice = takeProfit;
            exitReason = 'TAKE_PROFIT';
          }
        } else if (side === 'SHORT') {
          const hitSL = nextCandle.high >= stopLoss;
          const hitTP = nextCandle.low <= takeProfit;

          if (hitSL && hitTP) {
            isExit = true;
            exitPrice = stopLoss;
            exitReason = 'STOP_LOSS';
          } else if (hitSL) {
            isExit = true;
            exitPrice = stopLoss;
            exitReason = 'STOP_LOSS';
          } else if (hitTP) {
            isExit = true;
            exitPrice = takeProfit;
            exitReason = 'TAKE_PROFIT';
          }
        }

        // Execute Exit if triggered or at end of backtest
        if (isExit || i === evalCandles.length - 1) {
          if (!isExit && i === evalCandles.length - 1) {
            exitPrice = nextCandle.close;
            exitReason = 'END_OF_BACKTEST';
          }

          // Account for Exit Slippage & Fees
          const exitSlippageCost = exitPrice * slippageRate * activePosition.quantity;
          const executedExitPrice = side === 'LONG' 
            ? exitPrice * (1 - slippageRate) 
            : exitPrice * (1 + slippageRate);
          
          const exitFees = executedExitPrice * activePosition.quantity * feeRate;

          const grossPnL = side === 'LONG'
            ? (executedExitPrice - activePosition.entryPrice) * activePosition.quantity
            : (activePosition.entryPrice - executedExitPrice) * activePosition.quantity;

          const tradeFees = activePosition.entryFees + exitFees;
          const tradeSlippage = activePosition.entrySlippage + exitSlippageCost;
          const netPnL = grossPnL - tradeFees;

          cash += (activePosition.quantity * activePosition.entryPrice) + netPnL;
          equity = cash;

          totalFees += tradeFees;
          totalSlippage += tradeSlippage;

          const costBasis = activePosition.quantity * activePosition.entryPrice;
          const returnPercentage = costBasis > 0 ? (netPnL / costBasis) * 100 : 0;

          trades.push({
            tradeNumber: activePosition.tradeNumber,
            symbol,
            side: activePosition.side,
            entryTime: activePosition.entryTime,
            entryPrice: activePosition.entryPrice,
            exitTime: timestamp,
            exitPrice: Number(executedExitPrice.toFixed(2)),
            quantity: activePosition.quantity,
            stopLoss: activePosition.stopLoss,
            takeProfit: activePosition.takeProfit,
            fees: Number(tradeFees.toFixed(2)),
            slippage: Number(tradeSlippage.toFixed(2)),
            grossPnL: Number(grossPnL.toFixed(2)),
            netPnL: Number(netPnL.toFixed(2)),
            returnPercentage: Number(returnPercentage.toFixed(2)),
            exitReason
          });

          activePosition = null;
        }
      }

      // --- EVALUATE NEW SIGNAL & ENTRY ---
      if (!activePosition) {
        const indicators = technicalAnalysisService.calculateIndicators(historicalSlice);
        
        const strategyOutput = strategyEngine.evaluateHybrid(
          symbol,
          timeframe,
          historicalSlice,
          indicators,
          undefined,
          DEFAULT_STRATEGY_CONFIG
        );

        if (strategyOutput.direction === 'LONG' || strategyOutput.direction === 'SHORT') {
          const riskOutput = riskEngine.evaluateRisk(
            strategyOutput,
            currentPrice,
            historicalSlice,
            indicators,
            { accountCapital: cash, maxRiskPerTrade: riskPerTrade, minRiskReward },
            DEFAULT_STRATEGY_CONFIG
          );

          if (riskOutput.status === 'PASS' && riskOutput.positionSize > 0) {
            tradeCounter++;

            // Entry execution with slippage & fee
            const rawEntryPrice = currentPrice;
            const executedEntryPrice = strategyOutput.direction === 'LONG'
              ? rawEntryPrice * (1 + slippageRate)
              : rawEntryPrice * (1 - slippageRate);

            const entrySlippageCost = Math.abs(executedEntryPrice - rawEntryPrice) * riskOutput.positionSize;
            const entryFees = executedEntryPrice * riskOutput.positionSize * feeRate;

            activePosition = {
              tradeNumber: tradeCounter,
              side: strategyOutput.direction,
              entryTime: timestamp,
              entryPrice: Number(executedEntryPrice.toFixed(2)),
              quantity: riskOutput.positionSize,
              stopLoss: riskOutput.stopLoss,
              takeProfit: riskOutput.takeProfit,
              entryFees,
              entrySlippage: entrySlippageCost
            };
          }
        }
      }
    }

    // 3. Compute Metrics
    const finalCapital = Number(equity.toFixed(2));
    const totalReturn = Number((((finalCapital - initialCapital) / initialCapital) * 100).toFixed(2));

    // Buy & Hold Benchmark Return
    const startPrice = evalCandles[0].close;
    const endPrice = evalCandles[evalCandles.length - 1].close;
    const benchmarkReturn = Number((((endPrice - startPrice) / startPrice) * 100).toFixed(2));

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.netPnL > 0).length;
    const losingTrades = trades.filter(t => t.netPnL <= 0).length;
    const winRate = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

    const grossGains = trades.filter(t => t.netPnL > 0).reduce((sum, t) => sum + t.netPnL, 0);
    const grossLosses = Math.abs(trades.filter(t => t.netPnL <= 0).reduce((sum, t) => sum + t.netPnL, 0));
    const profitFactor = grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : (grossGains > 0 ? 99.99 : 0);

    // Calculate Sharpe & Sortino Ratios (Daily Returns)
    const returns = trades.map(t => t.returnPercentage / 100);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
    const stdDev = Math.sqrt(variance);

    const downsideVariance = returns.filter(r => r < 0).reduce((sum, r) => sum + Math.pow(r, 2), 0) / (returns.length || 1);
    const downsideStdDev = Math.sqrt(downsideVariance);

    const riskFreeRate = 0.02 / 365; // ~2% annual risk-free rate per trade period
    const sharpeRatio = stdDev > 0 ? Number(((avgReturn - riskFreeRate) / stdDev).toFixed(2)) : 0;
    const sortinoRatio = downsideStdDev > 0 ? Number(((avgReturn - riskFreeRate) / downsideStdDev).toFixed(2)) : 0;

    const startDate = evalCandles[0].timestamp;
    const endDate = evalCandles[evalCandles.length - 1].timestamp;

    const summary: BacktestSummary = {
      symbol,
      timeframe,
      strategy: strategyName,
      startDate,
      endDate,
      initialCapital,
      finalCapital,
      totalReturn,
      benchmarkReturn,
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      winRate,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      totalTrades,
      winningTrades,
      losingTrades,
      totalFees: Number(totalFees.toFixed(2)),
      totalSlippage: Number(totalSlippage.toFixed(2)),
      equityCurve,
      trades
    };

    // 4. Save to Database
    try {
      const dbRecord = await db.backtestRun.create({
        data: {
          userId,
          symbol,
          timeframe,
          strategy: strategyName,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          initialCapital,
          finalCapital,
          totalReturn,
          benchmarkReturn,
          maxDrawdown: summary.maxDrawdown,
          winRate,
          profitFactor,
          sharpeRatio,
          sortinoRatio,
          totalTrades,
          winningTrades,
          losingTrades,
          totalFees: summary.totalFees,
          totalSlippage: summary.totalSlippage,
          configJson: config as any,
          equityCurve: equityCurve as any,
        }
      });
      summary.id = dbRecord.id;

      // Save individual trades (up to 100 max for DB storage optimization)
      if (trades.length > 0) {
        await db.backtestTrade.createMany({
          data: trades.slice(-100).map(t => ({
            backtestId: dbRecord.id,
            symbol: t.symbol,
            side: t.side,
            entryTime: new Date(t.entryTime),
            entryPrice: t.entryPrice,
            exitTime: new Date(t.exitTime),
            exitPrice: t.exitPrice,
            quantity: t.quantity,
            stopLoss: t.stopLoss,
            takeProfit: t.takeProfit,
            fees: t.fees,
            slippage: t.slippage,
            grossPnL: t.grossPnL,
            netPnL: t.netPnL,
            returnPercentage: t.returnPercentage,
            exitReason: t.exitReason,
          }))
        });
      }
    } catch (err) {
      console.error("Failed to store BacktestRun in DB:", err);
    }

    return summary;
  }
};
