import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedbackRegistryEngine } from '@/lib/trading/feedback-registry';

export async function GET() {
  try {
    const championStrategy = await feedbackRegistryEngine.ensureChampionVersion();
    const totalAttributions = await db.tradeAttribution.count();
    const totalLosses = await db.tradeAttribution.count({ where: { outcome: 'LOSS' } });
    const totalWins = await db.tradeAttribution.count({ where: { outcome: 'WIN' } });
    const validatedPatterns = await db.feedbackMemory.count({ where: { status: 'VALIDATED' } });
    const learningEventsCount = await db.learningEvent.count();

    const latestStrategies = await db.strategyVersion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

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
    console.error('API /api/learning/summary error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
