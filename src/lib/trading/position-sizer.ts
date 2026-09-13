/**
 * SecureChain Pay - Confidence-Based Position Sizer
 * 
 * Implements variable risk sizing based on signal confidence and decision mode.
 * - Score 7/7 (EXPLOIT): 100% of standard risk allocation (1.0x)
 * - Score 6/7 (EXPLOIT): 85% of standard risk allocation (0.85x)
 * - Score 5/7 (EXPLOIT): 70% of standard risk allocation (0.70x)
 * - Score 4/7 (EXPLORE): 40% of standard risk allocation (0.40x)
 * - Score 3/7 (EXPLORE): 25% of standard risk allocation (0.25x)
 * - Score < 3 (HOLD): 0% (0.0x)
 * 
 * Hard risk constraints:
 * - maxAssetExposure: Hard ceiling on single asset USD value (e.g. 10% of portfolio)
 * - maxPortfolioExposure: Hard ceiling on total portfolio exposure (e.g. 20%)
 * - Stop loss distance constraint: Position size = Allowed Risk ($) / Distance to SL ($)
 */

export type DecisionMode = 'HOLD' | 'EXPLORE' | 'EXPLOIT';

export interface PositionSizingConfig {
  accountCapital: number;
  baseRiskPerTrade: number;       // e.g. 0.01 (1%)
  maxAssetExposure: number;        // e.g. 0.10 (10%)
  maxPortfolioExposure: number;    // e.g. 0.20 (20%)
  confidenceMultipliers: {
    score7: number;
    score6: number;
    score5: number;
    score4: number;
    score3: number;
    scoreLow: number;
  };
}

export const DEFAULT_POSITION_SIZING_CONFIG: PositionSizingConfig = {
  accountCapital: 100000,
  baseRiskPerTrade: 0.01,
  maxAssetExposure: 0.10,
  maxPortfolioExposure: 0.20,
  confidenceMultipliers: {
    score7: 1.00, // 100% of base risk
    score6: 0.85, // 85%
    score5: 0.70, // 70%
    score4: 0.40, // 40% (Exploration tier)
    score3: 0.25, // 25% (Exploration tier)
    scoreLow: 0.00 // 0% (Hold)
  }
};

export interface PositionSizingResult {
  decisionMode: DecisionMode;
  confidenceScore: number;
  confidenceMultiplier: number;
  effectiveRiskPct: number;
  allowedRiskUSD: number;
  rawPositionSize: number;
  positionSize: number;
  positionValueUSD: number;
  isCappedByExposure: boolean;
  cappedReason?: string;
}

export class PositionSizer {
  /**
   * Determine decision mode based on 7-point confidence score.
   */
  static getDecisionMode(score: number): DecisionMode {
    if (score >= 5) return 'EXPLOIT';
    if (score >= 3) return 'EXPLORE';
    return 'HOLD';
  }

  /**
   * Get the confidence multiplier for a given score out of 7.
   */
  static getConfidenceMultiplier(score: number, config = DEFAULT_POSITION_SIZING_CONFIG): number {
    const rounded = Math.round(score);
    if (rounded >= 7) return config.confidenceMultipliers.score7;
    if (rounded === 6) return config.confidenceMultipliers.score6;
    if (rounded === 5) return config.confidenceMultipliers.score5;
    if (rounded === 4) return config.confidenceMultipliers.score4;
    if (rounded === 3) return config.confidenceMultipliers.score3;
    return config.confidenceMultipliers.scoreLow;
  }

  /**
   * Calculate exact position sizing given confidence, price, and stop loss distance.
   */
  static calculatePositionSize(
    score: number,
    currentPrice: number,
    stopLossPrice: number,
    userAccountCapital?: number,
    userBaseRisk?: number,
    config = DEFAULT_POSITION_SIZING_CONFIG
  ): PositionSizingResult {
    const capital = userAccountCapital || config.accountCapital;
    const baseRisk = userBaseRisk || config.baseRiskPerTrade;
    const decisionMode = this.getDecisionMode(score);
    const confidenceMultiplier = this.getConfidenceMultiplier(score, config);

    if (decisionMode === 'HOLD' || confidenceMultiplier <= 0 || currentPrice <= 0) {
      return {
        decisionMode: 'HOLD',
        confidenceScore: score,
        confidenceMultiplier: 0,
        effectiveRiskPct: 0,
        allowedRiskUSD: 0,
        rawPositionSize: 0,
        positionSize: 0,
        positionValueUSD: 0,
        isCappedByExposure: false,
        cappedReason: 'Score below exploration threshold (< 3/7)'
      };
    }

    const effectiveRiskPct = baseRisk * confidenceMultiplier;
    const allowedRiskUSD = Number((capital * effectiveRiskPct).toFixed(2));
    const riskDistance = Math.abs(currentPrice - stopLossPrice);

    if (riskDistance <= 0) {
      return {
        decisionMode,
        confidenceScore: score,
        confidenceMultiplier,
        effectiveRiskPct,
        allowedRiskUSD,
        rawPositionSize: 0,
        positionSize: 0,
        positionValueUSD: 0,
        isCappedByExposure: false,
        cappedReason: 'Stop loss distance is zero'
      };
    }

    let rawPositionSize = allowedRiskUSD / riskDistance;
    let positionValueUSD = rawPositionSize * currentPrice;
    let isCapped = false;
    let cappedReason: string | undefined;

    // Hard ceiling: maxAssetExposure (e.g. 10% of portfolio)
    const maxAssetLimitUSD = capital * config.maxAssetExposure;
    if (positionValueUSD > maxAssetLimitUSD) {
      positionValueUSD = maxAssetLimitUSD;
      rawPositionSize = positionValueUSD / currentPrice;
      isCapped = true;
      cappedReason = `Position capped to max asset exposure limit of $${maxAssetLimitUSD.toFixed(0)} (${(config.maxAssetExposure * 100).toFixed(0)}% of capital)`;
    }

    // Decimal precision: 6 decimals for crypto (BTC/ETH)
    const positionSize = Number(rawPositionSize.toFixed(6));

    return {
      decisionMode,
      confidenceScore: score,
      confidenceMultiplier,
      effectiveRiskPct,
      allowedRiskUSD,
      rawPositionSize,
      positionSize,
      positionValueUSD: Number(positionValueUSD.toFixed(2)),
      isCappedByExposure: isCapped,
      cappedReason
    };
  }
}
