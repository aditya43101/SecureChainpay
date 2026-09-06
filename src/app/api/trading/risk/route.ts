import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_STRATEGY_CONFIG } from '@/lib/trading/strategy-config';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      defaults: DEFAULT_STRATEGY_CONFIG.riskDefaults
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
