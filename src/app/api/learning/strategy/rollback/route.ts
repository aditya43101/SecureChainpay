import { NextRequest, NextResponse } from 'next/server';
import { StrategyValidationEngine } from '@/lib/trading/strategy-validation-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { versionName, reason = 'Operator triggered rollback' } = body;

    if (!versionName) {
      return NextResponse.json({
        success: false,
        error: 'versionName is required for rollback.',
      }, { status: 400 });
    }

    const rollbackResult = await StrategyValidationEngine.rollbackStrategy(versionName, reason);

    return NextResponse.json({
      success: true,
      rollback: rollbackResult,
      message: `Successfully rolled back from ${rollbackResult.rolledBackVersion} to ${rollbackResult.restoredVersion}.`,
    });
  } catch (error: any) {
    console.error('API /api/learning/strategy/rollback error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Rollback failed',
    }, { status: 500 });
  }
}
