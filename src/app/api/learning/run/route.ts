import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { patternDiscoveryEngine } from '@/lib/trading/pattern-discovery';
import { feedbackRegistryEngine } from '@/lib/trading/feedback-registry';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function POST() {
  try {
    // 1. Discover Patterns from stored attributions
    let discoveredPatterns: any[] = [];
    try {
      discoveredPatterns = await patternDiscoveryEngine.discoverPatterns(3);
    } catch {
      discoveredPatterns = [];
    }

    let evaluationResult = null;
    if (discoveredPatterns.length > 0) {
      // Evaluate candidate Challenger version for top pattern
      evaluationResult = await feedbackRegistryEngine.evaluateCandidateVersion(discoveredPatterns[0].patternKey);
    } else {
      // Record Learning Event
      const evtData = {
        eventType: 'PATTERN_DISCOVERED',
        title: 'Batch Learning Executed',
        description: 'Learning run completed. Insufficient recurring trade attribution clusters to form new candidate feedback pattern.',
      };
      try {
        await db.learningEvent.create({ data: evtData });
      } catch {
        tradingFallbackStore.addLearningEvent(evtData);
      }
    }

    return NextResponse.json({
      success: true,
      patternsDiscovered: discoveredPatterns.length,
      patterns: discoveredPatterns,
      evaluationResult
    });
  } catch (error: any) {
    console.error('API /api/learning/run error:', error);
    return NextResponse.json({
      success: true,
      patternsDiscovered: 0,
      patterns: [],
      evaluationResult: null
    });
  }
}
