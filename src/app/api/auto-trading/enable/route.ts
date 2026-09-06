import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await prisma.user.findFirst();
    const userId = user ? user.id : (body.userId || 'default-user-id');

    const {
      allowedAssets,
      riskPerTrade,
      maxDailyLoss,
      maxPortfolioExposure,
      allTimeMode,
      mode
    } = body;

    let settings = await prisma.autoTradingSettings.upsert({
      where: { userId },
      update: {
        enabled: true,
        mode: mode || 'AUTO',
        status: 'ENABLED',
        pausedReason: null,
        allowedAssets: allowedAssets || ['BTCUSDT', 'ETHUSDT'],
        riskPerTrade: riskPerTrade || 0.01,
        maxDailyLoss: maxDailyLoss || 0.03,
        maxPortfolioExposure: maxPortfolioExposure || 0.20,
        allTimeMode: allTimeMode !== undefined ? allTimeMode : true
      },
      create: {
        userId,
        enabled: true,
        mode: mode || 'AUTO',
        status: 'ENABLED',
        allowedAssets: allowedAssets || ['BTCUSDT', 'ETHUSDT'],
        riskPerTrade: riskPerTrade || 0.01,
        maxDailyLoss: maxDailyLoss || 0.03,
        maxPortfolioExposure: maxPortfolioExposure || 0.20,
        allTimeMode: allTimeMode !== undefined ? allTimeMode : true
      }
    });

    await prisma.safetyEvent.create({
      data: {
        userId,
        eventType: 'USER_ENABLED_AUTO_TRADING',
        severity: 'INFO',
        details: `User explicitly enabled auto-trading in ${settings.mode} mode with All-Time Mode = ${settings.allTimeMode}`
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
