import { NextRequest, NextResponse } from 'next/server';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const validationId = searchParams.get('validationId');

    if (validationId) {
      const result = tradingFallbackStore.getValidationResult(validationId);
      return NextResponse.json({
        success: true,
        result,
      });
    }

    const results = tradingFallbackStore.getAllValidationResults();
    const versions = tradingFallbackStore.getStrategyVersionRecords();
    const shadowEvals = tradingFallbackStore.getShadowEvaluations(10);

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
      strategyVersions: versions,
      shadowEvaluations: shadowEvals,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve validation results',
      results: [],
    }, { status: 500 });
  }
}
