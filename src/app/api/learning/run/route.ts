import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PatternIntelligenceEngine } from '@/lib/trading/pattern-intelligence-engine';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function POST() {
  try {
    // 1. Gather all completed paper trade outcomes
    const allTrades = tradingFallbackStore.getAllTradeOutcomes();

    // 2. Discover patterns using canonical fingerprints & quality scoring
    const { patterns, lessons, insufficientEvidenceTrades } = PatternIntelligenceEngine.discoverPatterns(allTrades, 5);

    // 3. Persist discovered candidate patterns and lessons
    await PatternIntelligenceEngine.persistDiscoveredPatterns(patterns, lessons);

    // 4. Run confidence calibration across 1/7 to 7/7
    const calibration = PatternIntelligenceEngine.calibrateConfidence(allTrades);
    if (calibration.calibrationEvents.length > 0) {
      tradingFallbackStore.saveCalibrationEvents(calibration.calibrationEvents);
      for (const ev of calibration.calibrationEvents) {
        try {
          await db.learningEvent.create({
            data: {
              eventType: ev.eventType,
              title: ev.title,
              description: ev.description,
              metadata: ev as any,
            }
          });
        } catch {
          tradingFallbackStore.addLearningEvent(ev);
        }
      }
    }

    // 5. Emit summary learning event
    const summaryEvent = {
      eventType: 'PATTERN_DISCOVERED',
      title: `Pattern Intelligence Run Completed`,
      description: `Analyzed ${allTrades.length} paper trades. Identified ${patterns.length} candidate patterns (${lessons.length} grounded lessons). ${insufficientEvidenceTrades} trades categorized as insufficient evidence (< 5 samples).`,
      metadata: {
        totalTrades: allTrades.length,
        candidatePatternsCount: patterns.length,
        candidateLessonsCount: lessons.length,
        insufficientEvidenceTrades,
      }
    };

    try {
      await db.learningEvent.create({ data: summaryEvent as any });
    } catch {
      tradingFallbackStore.addLearningEvent(summaryEvent);
    }

    return NextResponse.json({
      success: true,
      tradesAnalyzed: allTrades.length,
      patternsDiscovered: patterns.length,
      lessonsGenerated: lessons.length,
      insufficientEvidenceTrades,
      patterns,
      lessons,
      calibrationEvents: calibration.calibrationEvents,
      disclaimer: 'Phase 3 Candidate Knowledge only. Production strategy parameters remain unmodified awaiting Phase 4 backtesting.'
    });
  } catch (error: any) {
    console.error('API /api/learning/run error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Pattern discovery run failed',
      patternsDiscovered: 0,
    }, { status: 500 });
  }
}
