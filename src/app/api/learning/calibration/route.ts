import { NextRequest, NextResponse } from 'next/server';
import { PatternIntelligenceEngine } from '@/lib/trading/pattern-intelligence-engine';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;

    const allTrades = tradingFallbackStore.getAllTradeOutcomes();
    const filteredTrades = symbol
      ? allTrades.filter(t => t.symbol.toUpperCase().includes(symbol.toUpperCase().replace(/USDT$/, '')))
      : allTrades;

    const calibration = PatternIntelligenceEngine.calibrateConfidence(filteredTrades);

    return NextResponse.json({
      success: true,
      tierStats: calibration.tierStats,
      calibrationEvents: calibration.calibrationEvents,
      totalTradesSampled: filteredTrades.length,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to calculate confidence calibration',
      tierStats: [],
      calibrationEvents: []
    }, { status: 500 });
  }
}
