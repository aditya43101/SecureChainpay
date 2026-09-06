export interface StrategyConfig {
  ema: {
    fastPeriod: number;
    slowPeriod: number;
  };
  rsi: {
    period: number;
    oversold: number;
    overbought: number;
  };
  macd: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
  };
  breakout: {
    lookbackPeriod: number;
    volumeMultiplier: number;
  };
  hybrid: {
    minScoreForTrade: number;
    maxScore: number;
    weights: {
      emaTrend: number;
      macd: number;
      rsi: number;
      breakout: number;
      mlPrediction: number;
    };
  };
  riskDefaults: {
    accountCapital: number;
    maxRiskPerTrade: number;
    maxDailyLoss: number;
    maxPortfolioExposure: number;
    maxAssetExposure: number;
    minRiskReward: number;
    atrMultiplierSL: number;
    atrMultiplierTP: number;
  };
  ml: {
    bullishThreshold: number;
    bearishThreshold: number;
  };
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  ema: {
    fastPeriod: 20,
    slowPeriod: 50,
  },
  rsi: {
    period: 14,
    oversold: 30,
    overbought: 70,
  },
  macd: {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
  },
  breakout: {
    lookbackPeriod: 20,
    volumeMultiplier: 1.5,
  },
  hybrid: {
    minScoreForTrade: 5,
    maxScore: 7,
    weights: {
      emaTrend: 2,
      macd: 1,
      rsi: 1,
      breakout: 1,
      mlPrediction: 2,
    },
  },
  riskDefaults: {
    accountCapital: 100000, // Simulated $100k
    maxRiskPerTrade: 0.01,  // 1% per trade
    maxDailyLoss: 0.03,     // 3% max daily loss
    maxPortfolioExposure: 0.20, // 20% max total crypto exposure
    maxAssetExposure: 0.10,     // 10% max single asset exposure
    minRiskReward: 1.5,     // 1:1.5 minimum R:R
    atrMultiplierSL: 2.0,   // 2 x ATR for Stop Loss
    atrMultiplierTP: 3.5,   // 3.5 x ATR for Take Profit
  },
  ml: {
    bullishThreshold: 0.55,
    bearishThreshold: 0.45,
  },
};
