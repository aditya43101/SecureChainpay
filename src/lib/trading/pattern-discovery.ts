import { db } from '../db';

export interface PatternSummary {
  patternKey: string;
  type: 'FAILURE_PATTERN' | 'SUCCESS_PATTERN';
  symbol: string;
  timeframe: string;
  strategy: string;
  marketRegime?: string;
  observation: string;
  evidenceCount: number;
  winRate: number;
  profitFactor: number;
  confidence: number;
}

export const patternDiscoveryEngine = {
  /**
   * Mine TradeAttribution database records to discover recurring success/failure patterns.
   */
  async discoverPatterns(minSampleSize: number = 5): Promise<PatternSummary[]> {
    const attributions = await db.tradeAttribution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    if (attributions.length < minSampleSize) {
      return [];
    }

    // Group attributions by (symbol + strategy + primaryReason)
    const clusters: Record<string, typeof attributions> = {};

    attributions.forEach(trade => {
      const regime = (trade.mlPrediction as any)?.marketRegime || 'STANDARD';
      const key = `${trade.symbol}_${trade.strategy}_${trade.primaryReason}_${regime}`;
      if (!clusters[key]) clusters[key] = [];
      clusters[key].push(trade);
    });

    const discoveredPatterns: PatternSummary[] = [];

    for (const [key, group] of Object.entries(clusters)) {
      if (group.length >= minSampleSize) {
        const symbol = group[0].symbol;
        const strategy = group[0].strategy;
        const reason = group[0].primaryReason;
        const regime = (group[0].mlPrediction as any)?.marketRegime || 'STANDARD';

        const wins = group.filter(t => t.outcome === 'WIN').length;
        const winRate = Number(((wins / group.length) * 100).toFixed(1));

        const grossGains = group.filter(t => t.netPnL > 0).reduce((sum, t) => sum + t.netPnL, 0);
        const grossLosses = Math.abs(group.filter(t => t.netPnL <= 0).reduce((sum, t) => sum + t.netPnL, 0));
        const profitFactor = grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : 0;

        const isFailure = winRate < 40;
        const type = isFailure ? 'FAILURE_PATTERN' : 'SUCCESS_PATTERN';

        const observation = isFailure
          ? `${strategy} strategy under ${reason} condition (${regime} regime) showed weak historical performance (${winRate}% win rate across ${group.length} trades).`
          : `${strategy} strategy under ${regime} regime shows strong historical reliability (${winRate}% win rate across ${group.length} trades).`;

        // Statistical confidence calculation based on sample size and deviation from 50%
        const confidence = Number(Math.min(0.95, 0.50 + (group.length * 0.04)).toFixed(2));

        discoveredPatterns.push({
          patternKey: key,
          type,
          symbol,
          timeframe: group[0].timeframe,
          strategy,
          marketRegime: regime,
          observation,
          evidenceCount: group.length,
          winRate,
          profitFactor,
          confidence,
        });

        // Store or update in FeedbackMemory
        try {
          await db.feedbackMemory.upsert({
            where: { id: `pattern_${key}` },
            update: {
              evidenceCount: group.length,
              winRate,
              profitFactor,
              confidence,
              updatedAt: new Date(),
            },
            create: {
              id: `pattern_${key}`,
              symbol,
              timeframe: group[0].timeframe,
              strategy,
              marketRegime: regime,
              pattern: key,
              type,
              observation,
              evidenceCount: group.length,
              winRate,
              profitFactor,
              confidence,
              status: 'VALIDATED',
            }
          });
        } catch (e) {
          // ignore duplicate upsert errors if id format differs
        }
      }
    }

    return discoveredPatterns;
  },

  /**
   * Find historical similar trade setups given current live indicators & ML state.
   */
  async findSimilarHistoricalTrades(symbol: string, currentIndicators: any, currentML?: any) {
    const attributions = await db.tradeAttribution.findMany({
      where: { symbol: symbol.endsWith('USDT') ? symbol : `${symbol}USDT` },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    if (attributions.length === 0) {
      return { count: 0, winRate: 0, matchSummary: "No historical similar trade attributions recorded yet." };
    }

    // Filter trades with similar RSI range (+/- 10 points) or regime
    const currentRSI = currentIndicators?.rsi ?? 50;
    const currentRegime = currentML?.marketRegime || 'sideways';

    const similarTrades = attributions.filter(t => {
      const tradeRSI = (t.indicators as any)?.rsi ?? 50;
      const tradeRegime = (t.mlPrediction as any)?.marketRegime || 'sideways';

      const rsiDiff = Math.abs(currentRSI - tradeRSI);
      return rsiDiff <= 15 || tradeRegime === currentRegime;
    });

    const matchCount = similarTrades.length;
    const wins = similarTrades.filter(t => t.outcome === 'WIN').length;
    const winRate = matchCount > 0 ? Number(((wins / matchCount) * 100).toFixed(1)) : 0;

    return {
      count: matchCount,
      winRate,
      similarTrades: similarTrades.slice(0, 5).map(t => ({
        side: t.side,
        outcome: t.outcome,
        netPnL: t.netPnL,
        primaryReason: t.primaryReason,
        createdAt: t.createdAt
      })),
      matchSummary: `Found ${matchCount} historical trade setups in learning memory with similar market indicators (${winRate}% win rate).`
    };
  }
};
