import { NextRequest, NextResponse } from 'next/server';
import { StrategyValidationEngine, CandidateHypothesis } from '@/lib/trading/strategy-validation-engine';
import { PatternIntelligenceEngine } from '@/lib/trading/pattern-intelligence-engine';
import { marketDataService } from '@/lib/market/market-data-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patternId, symbol = 'BTCUSDT' } = body;

    // 1. Fetch Candidate Pattern from stored patterns
    const patterns = await PatternIntelligenceEngine.getAllStoredPatterns();
    let targetPattern = patterns.find(p => p.patternId === patternId || p.fingerprint === patternId);

    if (!targetPattern) {
      // If no specific pattern requested, take the strongest candidate
      targetPattern = patterns.find(p => p.status === 'CANDIDATE' && p.sampleCount >= 5) || patterns[0];
    }

    if (!targetPattern) {
      return NextResponse.json({
        success: false,
        error: 'No candidate pattern found for validation. Ensure Phase 3 pattern mining has run.',
      }, { status: 400 });
    }

    // 2. Generate Candidate Hypothesis
    const hypothesis: CandidateHypothesis = StrategyValidationEngine.generateHypothesisFromPattern(targetPattern);

    // 3. Fetch Historical Candles (up to 500 for chronological evaluation)
    const candles = await marketDataService.getCandles(symbol, '1h', 500);

    // 4. Execute Phase 4 Backtest Validation
    const validationResult = await StrategyValidationEngine.validateCandidateHypothesis(hypothesis, candles);

    return NextResponse.json({
      success: true,
      validationResult,
      hypothesis,
      disclaimer: 'Phase 4 Validation Complete. Only PASSED candidates may be promoted to SHADOW or PAPER_ACTIVE.',
    });
  } catch (error: any) {
    console.error('API /api/learning/validation/run error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Backtest validation failed',
    }, { status: 500 });
  }
}
