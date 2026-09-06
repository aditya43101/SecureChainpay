import { NextResponse } from 'next/server';
import { AutoTradingEngine } from '@/lib/trading/auto-trading-engine';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const user = await prisma.user.findFirst();
    const userId = user ? user.id : 'default-user-id';

    const result = await AutoTradingEngine.runMonitoringCycle(userId);

    return NextResponse.json({
      success: true,
      cycleResult: result
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
