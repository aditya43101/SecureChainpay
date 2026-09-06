import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'default-user-id';

  try {
    let activeUserId = userId;
    try {
      const user = await prisma.user.findFirst();
      if (user) activeUserId = user.id;
    } catch {
      // Prisma user lookup failed, use query param userId
    }

    let settings = await prisma.autoTradingSettings.findUnique({
      where: { userId: activeUserId }
    });

    if (!settings) {
      try {
        settings = await prisma.autoTradingSettings.create({
          data: { userId: activeUserId }
        });
      } catch {
        settings = tradingFallbackStore.getSettings(activeUserId) as any;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const dailyState = await prisma.dailyRiskState.findUnique({
      where: { userId_date: { userId: activeUserId, date: todayStr } }
    });

    const paperAccount = await prisma.paperAccount.findUnique({
      where: { userId: activeUserId },
      include: { positions: true, orders: { take: 10, orderBy: { executedAt: 'desc' } } }
    });

    const recentEvents = await prisma.safetyEvent.findMany({
      where: { userId: activeUserId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json({
      success: true,
      settings: settings || tradingFallbackStore.getSettings(activeUserId),
      dailyState: dailyState || tradingFallbackStore.getDailyState(activeUserId),
      account: paperAccount || tradingFallbackStore.getPaperAccount(activeUserId),
      recentEvents: recentEvents || tradingFallbackStore.getSafetyEvents(activeUserId)
    });
  } catch (error: any) {
    console.warn('[API /api/auto-trading/status] Database unavailable, returning fallback state:', error?.message);
    return NextResponse.json({
      success: true,
      settings: tradingFallbackStore.getSettings(userId),
      dailyState: tradingFallbackStore.getDailyState(userId),
      account: tradingFallbackStore.getPaperAccount(userId),
      recentEvents: tradingFallbackStore.getSafetyEvents(userId)
    });
  }
}
