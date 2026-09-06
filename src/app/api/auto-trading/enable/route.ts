import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function POST(request: Request) {
  let userId = 'default-user-id';
  let body: any = {};

  try {
    body = await request.json();
    if (body.userId) userId = body.userId;
  } catch {
    // Empty body fallback
  }

  const {
    allowedAssets,
    riskPerTrade,
    maxDailyLoss,
    maxPortfolioExposure,
    allTimeMode,
    mode
  } = body;

  try {
    try {
      const user = await prisma.user.findFirst();
      if (user) userId = user.id;
    } catch {
      // Prisma user lookup failed, proceed with fallback userId
    }

    const settings = await prisma.autoTradingSettings.upsert({
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

    try {
      await prisma.safetyEvent.create({
        data: {
          userId,
          eventType: 'USER_ENABLED_AUTO_TRADING',
          severity: 'INFO',
          details: `User explicitly enabled auto-trading in ${settings.mode} mode with All-Time Mode = ${settings.allTimeMode}`
        }
      });
    } catch {
      // Non-blocking safety event creation
    }

    // Sync in-memory store
    tradingFallbackStore.updateSettings(userId, {
      enabled: true,
      mode: mode || 'AUTO',
      status: 'ENABLED',
      pausedReason: null,
      allowedAssets: allowedAssets || ['BTCUSDT', 'ETHUSDT'],
      riskPerTrade: riskPerTrade || 0.01,
      maxDailyLoss: maxDailyLoss || 0.03,
      maxPortfolioExposure: maxPortfolioExposure || 0.20,
      allTimeMode: allTimeMode !== undefined ? allTimeMode : true
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.warn('[API /api/auto-trading/enable] Prisma DB unavailable, saving to in-memory fallback store:', error?.message);

    const fallbackSettings = tradingFallbackStore.updateSettings(userId, {
      enabled: true,
      mode: mode || 'AUTO',
      status: 'ENABLED',
      pausedReason: null,
      allowedAssets: allowedAssets || ['BTCUSDT', 'ETHUSDT'],
      riskPerTrade: riskPerTrade || 0.01,
      maxDailyLoss: maxDailyLoss || 0.03,
      maxPortfolioExposure: maxPortfolioExposure || 0.20,
      allTimeMode: allTimeMode !== undefined ? allTimeMode : true
    });

    tradingFallbackStore.addSafetyEvent({
      userId,
      eventType: 'USER_ENABLED_AUTO_TRADING',
      severity: 'INFO',
      details: `User enabled auto-trading in ${fallbackSettings.mode} mode with All-Time Mode = ${fallbackSettings.allTimeMode}`
    });

    return NextResponse.json({ success: true, settings: fallbackSettings });
  }
}
