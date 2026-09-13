import { NextRequest, NextResponse } from 'next/server';
import { PatternIntelligenceEngine } from '@/lib/trading/pattern-intelligence-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;

    let patterns = await PatternIntelligenceEngine.getAllStoredPatterns();

    if (symbol) {
      const cleanSym = symbol.toUpperCase().replace(/USDT$/, '');
      patterns = patterns.filter(p => p.symbol === 'GLOBAL' || p.symbol.toUpperCase().includes(cleanSym));
    }

    if (status) {
      patterns = patterns.filter(p => p.status === status);
    }

    if (type) {
      patterns = patterns.filter(p => p.patternType === type);
    }

    return NextResponse.json({
      success: true,
      count: patterns.length,
      patterns,
      disclaimer: 'Phase 3 Candidate Knowledge: Awaiting Phase 4 backtesting before strategy parameter adaptation.'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve patterns',
      patterns: []
    }, { status: 500 });
  }
}
