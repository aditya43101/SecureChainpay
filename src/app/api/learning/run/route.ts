import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { patternDiscoveryEngine } from '@/lib/trading/pattern-discovery';
import { feedbackRegistryEngine } from '@/lib/trading/feedback-registry';

export async function POST() {
  try {
    // 1. Discover Patterns from stored attributions
    const discoveredPatterns = await patternDiscoveryEngine.discoverPatterns(3); // min sample size 3 for test/demo

    let evaluationResult = null;
    if (discoveredPatterns.length > 0) {
      // Evaluate candidate Challenger version for top pattern
      evaluationResult = await feedbackRegistryEngine.evaluateCandidateVersion(discoveredPatterns[0].patternKey);
    } else {
      // Record Learning Event
      await db.learningEvent.create({
        data: {
          eventType: 'PATTERN_DISCOVERED',
          title: 'Batch Learning Executed',
          description: 'Learning run completed. Insufficient recurring trade attribution clusters to form new candidate feedback pattern.',
        }
      });
    }

    return NextResponse.json({
      success: true,
      patternsDiscovered: discoveredPatterns.length,
      patterns: discoveredPatterns,
      evaluationResult
    });
  } catch (error: any) {
    console.error('API /api/learning/run error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
