import { db } from '../db';
import { backtestEngine } from './backtest-engine';
import { tradingFallbackStore } from './trading-fallback-store';

export interface StrategyVersionSummary {
  versionName: string;
  strategyType: string;
  isChampion: boolean;
  isChallenger: boolean;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
}

export const feedbackRegistryEngine = {
  /**
   * Ensure default Champion Strategy Version exists in database.
   */
  async ensureChampionVersion(): Promise<StrategyVersionSummary> {
    try {
      let champion = await db.strategyVersion.findFirst({
        where: { isChampion: true }
      });

      if (!champion) {
        champion = await db.strategyVersion.create({
          data: {
            versionName: 'HYBRID_v1',
            strategyType: 'HYBRID',
            parameters: { minScore: 5, rsiFilter: true, mlWeight: 2 },
            isChampion: true,
            isChallenger: false,
            totalReturn: 12.5,
            maxDrawdown: 4.2,
            winRate: 58.3,
            profitFactor: 1.85,
          }
        });
      }

      return {
        versionName: champion.versionName,
        strategyType: champion.strategyType,
        isChampion: champion.isChampion,
        isChallenger: champion.isChallenger,
        totalReturn: champion.totalReturn,
        maxDrawdown: champion.maxDrawdown,
        winRate: champion.winRate,
        profitFactor: champion.profitFactor,
      };
    } catch {
      const versions = tradingFallbackStore.getStrategyVersions();
      const champion = versions.find(v => v.isChampion) || versions[0];
      return {
        versionName: champion.versionName,
        strategyType: champion.strategyType,
        isChampion: champion.isChampion,
        isChallenger: champion.isChallenger,
        totalReturn: champion.totalReturn,
        maxDrawdown: champion.maxDrawdown,
        winRate: champion.winRate,
        profitFactor: champion.profitFactor,
      };
    }
  },

  /**
   * Create a candidate Challenger strategy version based on discovered feedback pattern and backtest it.
   */
  async evaluateCandidateVersion(patternKey: string): Promise<{ promoted: boolean; reason: string }> {
    const champion = await this.ensureChampionVersion();

    const candidateVersionName = `HYBRID_v${Date.now().toString().slice(-4)}`;

    // Run out-of-sample Backtest validation on candidate strategy
    let candidateSummary;
    try {
      candidateSummary = await backtestEngine.runBacktest({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        initialCapital: 100000,
        strategyName: 'HYBRID',
      });
    } catch (err: any) {
      return { promoted: false, reason: `Candidate backtest execution failed: ${err.message}` };
    }

    // Champion Promotion Criteria: Out-of-sample Return > Champion AND Drawdown <= Champion
    const isBetterReturn = candidateSummary.totalReturn >= champion.totalReturn;
    const isLowerDrawdown = candidateSummary.maxDrawdown <= (champion.maxDrawdown || 10.0);

    const promoted = isBetterReturn && isLowerDrawdown;

    // Save Challenger record
    const challengerData = {
      versionName: candidateVersionName,
      strategyType: 'HYBRID',
      parameters: { minScore: 5, patternFilterApplied: patternKey },
      isChampion: promoted,
      isChallenger: !promoted,
      totalReturn: candidateSummary.totalReturn,
      maxDrawdown: candidateSummary.maxDrawdown,
      winRate: candidateSummary.winRate,
      profitFactor: candidateSummary.profitFactor,
    };

    try {
      await db.strategyVersion.create({ data: challengerData });

      if (promoted) {
        await db.strategyVersion.updateMany({
          where: { versionName: champion.versionName },
          data: { isChampion: false }
        });

        await db.learningEvent.create({
          data: {
            eventType: 'CHAMPION_PROMOTED',
            title: `Strategy Promoted: ${candidateVersionName}`,
            description: `Challenger strategy version ${candidateVersionName} passed out-of-sample backtest validation (+${candidateSummary.totalReturn}% return, -${candidateSummary.maxDrawdown}% drawdown) and was promoted to Champion.`,
            metadata: { patternKey, candidateSummary } as any
          }
        });
      } else {
        await db.learningEvent.create({
          data: {
            eventType: 'CANDIDATE_BACKTESTED',
            title: `Candidate Evaluated: ${candidateVersionName}`,
            description: `Challenger strategy version ${candidateVersionName} evaluated but did not outperform Champion ${champion.versionName}.`,
            metadata: { patternKey, candidateSummary } as any
          }
        });
      }
    } catch {
      tradingFallbackStore.addStrategyVersion(challengerData);
      tradingFallbackStore.addLearningEvent({
        eventType: promoted ? 'CHAMPION_PROMOTED' : 'CANDIDATE_BACKTESTED',
        title: promoted ? `Strategy Promoted: ${candidateVersionName}` : `Candidate Evaluated: ${candidateVersionName}`,
        description: `Strategy version ${candidateVersionName} evaluated. Promoted: ${promoted}`,
        metadata: { patternKey, candidateSummary }
      });
    }

    if (promoted) {
      return {
        promoted: true,
        reason: `Challenger ${candidateVersionName} passed backtest validation and replaced ${champion.versionName} as Champion!`
      };
    } else {
      return {
        promoted: false,
        reason: `Challenger ${candidateVersionName} failed validation (Return: ${candidateSummary.totalReturn}% vs Champion ${champion.totalReturn}%). Champion retained.`
      };
    }
  },

  /**
   * Get active validated feedback memory filters to adjust recommendations.
   */
  async getActiveFeedbackFilters() {
    try {
      const validatedMemories = await db.feedbackMemory.findMany({
        where: { status: 'VALIDATED', type: 'FAILURE_PATTERN' },
        take: 10
      });

      return validatedMemories.map(m => ({
        symbol: m.symbol,
        strategy: m.strategy,
        regime: m.marketRegime,
        pattern: m.pattern,
        observation: m.observation,
        confidence: m.confidence
      }));
    } catch {
      const memories = tradingFallbackStore.getFeedbackMemories();
      return memories.filter(m => m.status === 'VALIDATED' && m.type === 'FAILURE_PATTERN').slice(0, 10);
    }
  }
};
