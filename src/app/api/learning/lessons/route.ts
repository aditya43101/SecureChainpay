import { NextRequest, NextResponse } from 'next/server';
import { PatternIntelligenceEngine } from '@/lib/trading/pattern-intelligence-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;

    const lessons = await PatternIntelligenceEngine.getCandidateLessons(symbol);

    return NextResponse.json({
      success: true,
      count: lessons.length,
      lessons,
      disclaimer: 'Candidate lessons are grounded in verified historical trade data. Production strategies remain unmutated.'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve candidate lessons',
      lessons: []
    }, { status: 500 });
  }
}
