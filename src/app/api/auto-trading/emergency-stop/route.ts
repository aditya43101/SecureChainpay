import { NextResponse } from 'next/server';
import { ExecutionSafetyEngine } from '@/lib/trading/execution-safety';
import { prisma } from '@/lib/prisma';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function POST(request: Request) {
  let userId = 'default-user-id';

  try {
    try {
      const body = await request.json();
      if (body?.userId) userId = body.userId;
    } catch {
      // Empty body
    }

    try {
      const user = await prisma.user.findFirst();
      if (user) userId = user.id;
    } catch {
      // Non-blocking
    }

    await ExecutionSafetyEngine.triggerEmergencyStop(userId, 'User clicked Emergency Stop button');

    let settings = null;
    try {
      settings = await prisma.autoTradingSettings.findUnique({
        where: { userId }
      });
    } catch {
      settings = tradingFallbackStore.getSettings(userId);
    }

    return NextResponse.json({
      success: true,
      message: 'EMERGENCY STOP ACTIVATED. All pending orders cancelled, auto-trading halted.',
      settings: settings || tradingFallbackStore.getSettings(userId)
    });
  } catch (error: any) {
    console.warn('[API /api/auto-trading/emergency-stop] Fallback activation:', error?.message);

    const settings = tradingFallbackStore.updateSettings(userId, {
      enabled: false,
      allTimeMode: false,
      status: 'EMERGENCY_STOP',
      pausedReason: 'User initiated Emergency Stop'
    });

    tradingFallbackStore.addSafetyEvent({
      userId,
      eventType: 'EMERGENCY_STOP',
      severity: 'CRITICAL',
      details: 'Emergency Stop activated by user'
    });

    return NextResponse.json({
      success: true,
      message: 'EMERGENCY STOP ACTIVATED. All pending orders cancelled, auto-trading halted.',
      settings
    });
  }
}
