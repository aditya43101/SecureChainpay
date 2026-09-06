import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user-id';

    const user = await prisma.user.findFirst();
    const activeUserId = user ? user.id : userId;

    let settings = await prisma.autoTradingSettings.findUnique({
      where: { userId: activeUserId }
    });

    if (!settings) {
      settings = await prisma.autoTradingSettings.create({
        data: { userId: activeUserId }
      });
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
      settings,
      dailyState: dailyState || {
        date: todayStr,
        startingBalance: paperAccount?.equity || 100000,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        dailyLossLimitReached: false
      },
      account: paperAccount || { cashBalance: 100000, equity: 100000, positions: [], orders: [] },
      recentEvents
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
