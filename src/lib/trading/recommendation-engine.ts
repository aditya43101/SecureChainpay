import { db } from '../db';
import { marketDataService } from '../market/market-data-service';
import { technicalAnalysisService } from '../market/technical-analysis';
import { strategyEngine, MLPredictionData } from './strategy-engine';
import { riskEngine, UserRiskProfile } from './risk-engine';
import { DEFAULT_STRATEGY_CONFIG } from './strategy-config';
import { tradingFallbackStore } from './trading-fallback-store';

export interface RecommendationObject {
  id?: string;
  asset: string;
  timeframe: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  entry: {
    type: 'ZONE' | 'EXACT';
    low: number;
    high: number;
    suggestedEntry: number;
  };
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  positionSize: number;
  positionValueUSD: number;
  strategy: string;
  score: number;
  maxScore: number;
  mlPrediction?: {
    modelVersion?: string;
    bullishProbability?: number;
    bearishProbability?: number;
    marketRegime?: string;
  };
  riskAssessment: {
    status: 'PASS' | 'REJECT';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasons: string[];
    warnings: string[];
  };
  reasons: string[];
  warnings: string[];
  timestamp: string;
  dataTimestamp: string;
}

async function fetchMLPrediction(symbol: string, timeframe: string): Promise<MLPredictionData | undefined> {
  try {
    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    const res = await fetch('http://127.0.0.1:8000/api/ml/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: formattedSymbol, timeframe })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("ML Service call failed in RecommendationEngine:", err);
  }
  return undefined;
}

export const recommendationEngine = {
  /**
   * Generate a comprehensive quantitative recommendation for an asset.
   */
  async generateRecommendation(
    symbol: string,
    timeframe: string = '1h',
    userId?: string,
    userRiskProfile?: Partial<UserRiskProfile>
  ): Promise<RecommendationObject> {
    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

    // 1. Fetch Market Candles & Ticker
    const candles = await marketDataService.getCandles(formattedSymbol, timeframe, 100);
    const ticker = await marketDataService.getTicker(formattedSymbol);
    const currentPrice = parseFloat(ticker.price) || (candles.length > 0 ? candles[candles.length - 1].close : 0);

    // 2. Compute Technical Indicators
    const indicators = technicalAnalysisService.calculateIndicators(candles);

    // 3. Fetch Phase 4 ML Model Prediction
    const mlPrediction = await fetchMLPrediction(formattedSymbol, timeframe);

    // 4. Run Strategy Engine
    const strategyOutput = strategyEngine.evaluateHybrid(
      formattedSymbol,
      timeframe,
      candles,
      indicators,
      mlPrediction,
      DEFAULT_STRATEGY_CONFIG
    );

    // 5. Run Risk Engine
    const riskOutput = riskEngine.evaluateRisk(
      strategyOutput,
      currentPrice,
      candles,
      indicators,
      userRiskProfile,
      DEFAULT_STRATEGY_CONFIG
    );

    // 6. Synthesize Action & Strength
    let action: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE' = 'NO_TRADE';
    let strength: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if (strategyOutput.direction === 'LONG' && riskOutput.status === 'PASS') {
      action = 'BUY';
    } else if (strategyOutput.direction === 'SHORT' && riskOutput.status === 'PASS') {
      action = 'SELL';
    } else if (strategyOutput.direction === 'LONG' || strategyOutput.direction === 'SHORT') {
      action = 'HOLD'; // Setup exists but failed risk checks -> HOLD / NO_TRADE
    } else {
      action = 'NO_TRADE';
    }

    // Determine Strength based on score & ML alignment
    if (action === 'BUY' || action === 'SELL') {
      const mlSupport = mlPrediction ? (
        (action === 'BUY' && (mlPrediction.bullishProbability || 0) >= 0.6) ||
        (action === 'SELL' && (mlPrediction.bearishProbability || 0) >= 0.6)
      ) : false;

      if (strategyOutput.score >= 6 && mlSupport && riskOutput.riskLevel === 'LOW') {
        strength = 'HIGH';
      } else if (strategyOutput.score >= 5) {
        strength = 'MEDIUM';
      } else {
        strength = 'LOW';
      }
    }

    const reasons = [
      ...strategyOutput.reasoning,
      ...riskOutput.reasons
    ];

    const warnings = [
      ...riskOutput.warnings
    ];

    if (riskOutput.status === 'REJECT') {
      warnings.push(`Trade recommendation invalidated by Risk Engine.`);
    }

    const dataTimestamp = candles.length > 0 ? candles[candles.length - 1].timestamp : new Date().toISOString();

    const recommendation: RecommendationObject = {
      asset: formattedSymbol,
      timeframe,
      action,
      strength,
      entry: riskOutput.entry,
      stopLoss: riskOutput.stopLoss,
      takeProfit: riskOutput.takeProfit,
      riskReward: riskOutput.riskRewardRatio,
      positionSize: riskOutput.positionSize,
      positionValueUSD: riskOutput.positionValueUSD,
      strategy: strategyOutput.primaryStrategy,
      score: strategyOutput.score,
      maxScore: strategyOutput.maxScore,
      mlPrediction: mlPrediction ? {
        modelVersion: mlPrediction.modelVersion,
        bullishProbability: mlPrediction.bullishProbability,
        bearishProbability: mlPrediction.bearishProbability,
        marketRegime: mlPrediction.marketRegime
      } : undefined,
      riskAssessment: {
        status: riskOutput.status,
        riskLevel: riskOutput.riskLevel,
        reasons: riskOutput.reasons,
        warnings: riskOutput.warnings
      },
      reasons,
      warnings,
      timestamp: new Date().toISOString(),
      dataTimestamp
    };

    // 7. Save Recommendation to Database
    try {
      const dbRecord = await db.tradingRecommendation.create({
        data: {
          userId,
          symbol: formattedSymbol,
          timeframe,
          action: recommendation.action,
          strength: recommendation.strength,
          strategy: recommendation.strategy,
          entry: recommendation.entry as any,
          stopLoss: recommendation.stopLoss,
          takeProfit: recommendation.takeProfit,
          riskReward: recommendation.riskReward,
          positionSize: recommendation.positionSize,
          score: recommendation.score,
          modelVersion: mlPrediction?.modelVersion || null,
          mlPrediction: (mlPrediction || {}) as any,
          riskAssessment: recommendation.riskAssessment as any,
          reasons: recommendation.reasons,
          warnings: recommendation.warnings,
          outcome: 'PENDING',
          dataTimestamp: new Date(recommendation.dataTimestamp)
        }
      });
      recommendation.id = dbRecord.id;
    } catch {
      // In-memory fallback
      const saved = tradingFallbackStore.addRecommendation({
        userId,
        symbol: formattedSymbol,
        ...recommendation
      });
      recommendation.id = saved.id;
    }

    return recommendation;
  }
};
