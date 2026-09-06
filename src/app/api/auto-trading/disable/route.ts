import { NextResponse } from 'next/server';
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
      // Prisma user lookup failed, continue with userId
    }

    const settings = await prisma.autoTradingSettings.update({
      where: { userId },
      data: {
        enabled: false,
        allTimeMode: false,
        status: 'DISABLED',
        pausedReason: 'Disabled by user action'
      }
    });

    try {
      await prisma.safetyEvent.create({
        data: {
          userId,
          eventType: 'USER_DISABLED_AUTO_TRADING',
          severity: 'INFO',
          details: 'Auto-trading disabled by user'
        }
      });
    } catch {
      // Non-blocking
    }

    tradingFallbackStore.updateSettings(userId, {
      enabled: false,
      allTimeMode: false,
      status: 'DISABLED',
      pausedReason: 'Disabled by user action'
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.warn('[API /api/auto-trading/disable] Prisma DB unavailable, updating in-memory store:', error?.message);

    const fallbackSettings = tradingFallbackStore.updateSettings(userId, {
      enabled: false,
      allTimeMode: false,
      status: 'DISABLED',
      pausedReason: 'Disabled by user action'
    });

    tradingFallbackStore.addSafetyEvent({
      userId,
      eventType: 'USER_DISABLED_AUTO_TRADING',
      severity: 'INFO',
      details: 'Auto-trading disabled by user'
    });

    return NextResponse.json({ success: true, settings: fallbackSettings });
  }
}
