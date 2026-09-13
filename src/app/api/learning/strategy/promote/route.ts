import { NextRequest, NextResponse } from 'next/server';
import { StrategyValidationEngine } from '@/lib/trading/strategy-validation-engine';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { validationId, targetStatus = 'SHADOW_ACTIVE' } = body;

    const validation = tradingFallbackStore.getValidationResult(validationId);
    if (!validation) {
      return NextResponse.json({
        success: false,
        error: `Validation result '${validationId}' not found. Run validation first.`,
      }, { status: 404 });
    }

    if (validation.status !== 'PASSED') {
      return NextResponse.json({
        success: false,
        error: `Cannot promote candidate with validation status '${validation.status}'. Must be 'PASSED'.`,
      }, { status: 400 });
    }

    const versionRecord = await StrategyValidationEngine.promoteCandidate(validation, targetStatus);

    return NextResponse.json({
      success: true,
      promotedVersion: versionRecord,
      message: `Strategy promoted to ${targetStatus}: ${versionRecord.versionName}`,
    });
  } catch (error: any) {
    console.error('API /api/learning/strategy/promote error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Promotion failed',
    }, { status: 500 });
  }
}
