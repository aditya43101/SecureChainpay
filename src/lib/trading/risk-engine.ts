import { Candle } from '../market/market-data-service';
import { Indicators } from '../market/technical-analysis';
import { StrategyEngineOutput, DecisionMode } from './strategy-engine';
import { DEFAULT_STRATEGY_CONFIG, StrategyConfig } from './strategy-config';
import { PositionSizer } from './position-sizer';

export interface UserRiskProfile {
  accountCapital: number;
  maxRiskPerTrade: number;     // e.g. 0.01 (1%)
  maxDailyLoss: number;        // e.g. 0.03 (3%)
  maxPortfolioExposure: number; // e.g. 0.20 (20%)
  maxAssetExposure: number;     // e.g. 0.10 (10%)
  minRiskReward: number;        // e.g. 1.5
}

export interface RiskAssessmentResult {
  status: 'PASS' | 'REJECT';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decisionMode?: DecisionMode;
  entry: {
    type: 'ZONE' | 'EXACT';
    low: number;
    high: number;
    suggestedEntry: number;
  };
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  positionSize: number;      // Quantity of asset (e.g. BTC)
  positionValueUSD: number;  // USD value of position
  allowedRiskUSD: number;    // Budgeted risk in USD
  configuredRiskPercent?: number; // e.g. 0.01 (1%)
  configuredRiskUSD?: number;
  appliedStopRiskUSD?: number;   // Actual stop risk = positionSize * riskDistance
  appliedStopRiskPercent?: number;
  isCappedByExposure?: boolean;
  reconciliationSummary?: string;
  confidenceMultiplier?: number;
  effectiveRiskPct?: number;
  reasons: string[];
  warnings: string[];
}

export const riskEngine = {
  /**
   * Evaluate risk parameters and calculate precise SL, TP, and Position Size.
   */
  evaluateRisk(
    strategyOutput: StrategyEngineOutput,
    currentPrice: number,
    candles: Candle[],
    indicators: Indicators,
    userRisk?: Partial<UserRiskProfile>,
    config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
  ): RiskAssessmentResult {
    const riskProfile: UserRiskProfile = {
      accountCapital: userRisk?.accountCapital ?? config.riskDefaults.accountCapital,
      maxRiskPerTrade: userRisk?.maxRiskPerTrade ?? config.riskDefaults.maxRiskPerTrade,
      maxDailyLoss: userRisk?.maxDailyLoss ?? config.riskDefaults.maxDailyLoss,
      maxPortfolioExposure: userRisk?.maxPortfolioExposure ?? config.riskDefaults.maxPortfolioExposure,
      maxAssetExposure: userRisk?.maxAssetExposure ?? config.riskDefaults.maxAssetExposure,
      minRiskReward: userRisk?.minRiskReward ?? config.riskDefaults.minRiskReward,
    };

    const reasons: string[] = [];
    const warnings: string[] = [];

    const { direction } = strategyOutput;

    // Handle NO_TRADE or NEUTRAL directions immediately
    if (direction === 'NO_TRADE' || direction === 'NEUTRAL') {
      return {
        status: 'REJECT',
        riskLevel: 'HIGH',
        entry: { type: 'EXACT', low: currentPrice, high: currentPrice, suggestedEntry: currentPrice },
        stopLoss: currentPrice,
        takeProfit: currentPrice,
        riskRewardRatio: 0,
        positionSize: 0,
        positionValueUSD: 0,
        allowedRiskUSD: 0,
        reasons: ['Strategy Engine evaluated signal as NO_TRADE or NEUTRAL.'],
        warnings: ['No risk parameters calculated for non-actionable signals.']
      };
    }

    // 1. Entry Zone Calculation
    // Entry zone: +/- 0.15% around current price
    const entryLow = Number((currentPrice * 0.9985).toFixed(2));
    const entryHigh = Number((currentPrice * 1.0015).toFixed(2));
    const suggestedEntry = currentPrice;

    // 2. Stop Loss Calculation (ATR-based or swing high/low)
    const atr = indicators.atr || (currentPrice * 0.015); // Fallback to 1.5% if ATR missing
    let stopLoss = 0;
    let takeProfit = 0;

    const atrSLDistance = atr * config.riskDefaults.atrMultiplierSL;
    const atrTPDistance = atr * config.riskDefaults.atrMultiplierTP;

    if (direction === 'LONG') {
      // Recent 10-candle low as secondary SL anchor
      const recentLow = candles.length >= 10 
        ? Math.min(...candles.slice(-10).map(c => c.low)) 
        : currentPrice - atrSLDistance;
      
      // Stop Loss must be strictly below entry for BUY
      stopLoss = Number(Math.min(suggestedEntry - atrSLDistance, recentLow * 0.998).toFixed(2));
      if (stopLoss >= suggestedEntry) {
        stopLoss = Number((suggestedEntry - atrSLDistance).toFixed(2));
      }
    } else {
      // SHORT
      const recentHigh = candles.length >= 10 
        ? Math.max(...candles.slice(-10).map(c => c.high)) 
        : currentPrice + atrSLDistance;

      // Stop Loss must be strictly above entry for SELL
      stopLoss = Number(Math.max(suggestedEntry + atrSLDistance, recentHigh * 1.002).toFixed(2));
      if (stopLoss <= suggestedEntry) {
        stopLoss = Number((suggestedEntry + atrSLDistance).toFixed(2));
      }
    }

    // 3. Risk / Reward & Take Profit Calculation
    const riskDistance = Math.abs(suggestedEntry - stopLoss);
    const targetReward = Math.max(atrTPDistance, riskDistance * config.riskDefaults.minRiskReward);

    if (direction === 'LONG') {
      // Take Profit must be strictly above entry for BUY
      takeProfit = Number((suggestedEntry + targetReward).toFixed(2));
    } else {
      // Take Profit must be strictly below entry for SELL
      takeProfit = Number((suggestedEntry - targetReward).toFixed(2));
    }

    const rewardDistance = Math.abs(takeProfit - suggestedEntry);
    const riskRewardRatio = Number((rewardDistance / (riskDistance || 1)).toFixed(2));

    // 4. Confidence-Based Position Sizing via PositionSizer
    const sizingResult = PositionSizer.calculatePositionSize(
      strategyOutput.score,
      suggestedEntry,
      stopLoss,
      riskProfile.accountCapital,
      riskProfile.maxRiskPerTrade
    );

    const allowedRiskUSD = sizingResult.allowedRiskUSD;
    const positionSize = sizingResult.positionSize;
    const positionValueUSD = sizingResult.positionValueUSD;
    const decisionMode = sizingResult.decisionMode;

    if (sizingResult.isCappedByExposure && sizingResult.cappedReason) {
      warnings.push(sizingResult.cappedReason);
    }

    // 5. Volatility & Risk Level Assessment
    const volatility = indicators.volatility || 30; // default 30%
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    if (volatility > 80) {
      riskLevel = 'CRITICAL';
      warnings.push(`Extreme market volatility detected (${volatility.toFixed(1)}%). Position risk is heightened.`);
    } else if (volatility > 50) {
      riskLevel = 'HIGH';
      warnings.push(`Elevated market volatility (${volatility.toFixed(1)}%).`);
    } else if (volatility > 25) {
      riskLevel = 'MEDIUM';
    }

    // 6. Rejection Criteria Checks
    let status: 'PASS' | 'REJECT' = 'PASS';

    // R:R Check
    if (riskRewardRatio < riskProfile.minRiskReward) {
      status = 'REJECT';
      reasons.push(`Risk/Reward Ratio (1:${riskRewardRatio}) is below required minimum (1:${riskProfile.minRiskReward}).`);
    }

    // Risk Distance check (SL too tight or zero)
    if (riskDistance < currentPrice * 0.002) {
      status = 'REJECT';
      reasons.push('Stop loss distance is too narrow (< 0.2%), vulnerable to market noise.');
    }

    if (status === 'PASS') {
      reasons.push(`Risk checks passed with 1:${riskRewardRatio} Risk/Reward ratio.`);
      reasons.push(`[${decisionMode} Mode] Risk budget: $${allowedRiskUSD.toFixed(2)} (${(sizingResult.effectiveRiskPct * 100).toFixed(2)}%). Actual Stop Risk: $${sizingResult.appliedStopRiskUSD.toFixed(2)} (${(sizingResult.appliedStopRiskPercent * 100).toFixed(3)}%).`);
    }

    return {
      status,
      riskLevel,
      decisionMode,
      entry: {
        type: 'ZONE',
        low: entryLow,
        high: entryHigh,
        suggestedEntry
      },
      stopLoss,
      takeProfit,
      riskRewardRatio,
      positionSize,
      positionValueUSD: Number(positionValueUSD.toFixed(2)),
      allowedRiskUSD,
      configuredRiskPercent: sizingResult.configuredRiskPercent,
      configuredRiskUSD: sizingResult.configuredRiskUSD,
      appliedStopRiskUSD: sizingResult.appliedStopRiskUSD,
      appliedStopRiskPercent: sizingResult.appliedStopRiskPercent,
      isCappedByExposure: sizingResult.isCappedByExposure,
      reconciliationSummary: sizingResult.reconciliationSummary,
      confidenceMultiplier: sizingResult.confidenceMultiplier,
      effectiveRiskPct: sizingResult.effectiveRiskPct,
      reasons,
      warnings
    };
  }
};
