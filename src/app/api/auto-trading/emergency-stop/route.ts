import { NextResponse } from 'next/server';
import { ExecutionSafetyEngine } from '@/lib/trading/execution-safety';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const user = await prisma.user.findFirst();
    const userId = user ? user.id : 'default-user-id';

    await ExecutionSafetyEngine.triggerEmergencyStop(userId, 'User clicked Emergency Stop button');

    const settings = await prisma.autoTradingSettings.findUnique({
      where: { userId }
    });

    return NextResponse.json({
      success: true,
      message: 'EMERGENCY STOP ACTIVATED. All pending orders cancelled, auto-trading halted.',
      settings
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
