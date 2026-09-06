import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedbackRegistryEngine } from '@/lib/trading/feedback-registry';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function GET() {
  try {
    const championStrategy = await feedbackRegistryEngine.ensureChampionVersion();

    let totalAttributions = 0;
    let totalLosses = 0;
    let totalWins = 0;
    let validatedPatterns = 0;
    let learningEventsCount = 0;
    let latestStrategies: any[] = [];

    try {
      totalAttributions = await db.tradeAttribution.count();
      totalLosses = await db.tradeAttribution.count({ where: { outcome: 'LOSS' } });
      totalWins = await db.tradeAttribution.count({ where: { outcome: 'WIN' } });
      validatedPatterns = await db.feedbackMemory.count({ where: { status: 'VALIDATED' } });
      learningEventsCount = await db.learningEvent.count();
      latestStrategies = await db.strategyVersion.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      });
    } catch {
      latestStrategies = tradingFallbackStore.getStrategyVersions();
      validatedPatterns = tradingFallbackStore.getFeedbackMemories().length;
      learningEventsCount = tradingFallbackStore.getLearningEvents().length;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalAttributions,
        totalLosses,
        totalWins,
        validatedPatterns,
        learningEventsCount,
        championStrategy,
        latestStrategies
      }
    });
  } catch (error: any) {
    const versions = tradingFallbackStore.getStrategyVersions();
    return NextResponse.json({
      success: true,
      data: {
        totalAttributions: 0,
        totalLosses: 0,
        totalWins: 0,
        validatedPatterns: 0,
        learningEventsCount: 0,
        championStrategy: versions[0],
        latestStrategies: versions
      }
    });
  }
}
