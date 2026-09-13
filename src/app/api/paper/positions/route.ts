import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paperEngine } from '@/lib/trading/paper-engine';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';

const DEMO_USER_ID = 'demo-user-id';

export async function GET(request: Request) {
  let userId = DEMO_USER_ID;
  try {
    const auth = await requireFirebaseUser(request);
    if (auth && auth.uid) userId = auth.uid;
  } catch {
    // Fallback to demo user
  }

  try {
    // Refresh position prices & evaluate deterministic exits
    await paperEngine.getOrCreateAccount(userId);

    let rawPositions: any[] = [];
    try {
      const account = await db.paperAccount.findUnique({
        where: { userId },
        include: {
          positions: { orderBy: { openedAt: 'desc' } }
        }
      });
      if (account && account.positions) {
        rawPositions = account.positions;
      } else {
        rawPositions = tradingFallbackStore.getPaperAccount(userId).positions || [];
      }
    } catch {
      rawPositions = tradingFallbackStore.getPaperAccount(userId).positions || [];
    }

    // Enrich active positions with duration, live excursion info, and decision metadata
    const now = Date.now();
    const enrichedPositions = rawPositions.map(p => {
      const openedMs = new Date(p.openedAt).getTime();
      const durationMinutes = Math.max(0, Math.round((now - openedMs) / 60000));
      return {
        ...p,
        tradeId: p.tradeId || `PT-${p.symbol.replace(/USDT$/, '')}-${openedMs}`,
        durationMinutes,
        lowestPrice: p.lowestPrice ?? p.averageEntry,
        highestPrice: p.highestPrice ?? p.averageEntry,
        decisionMode: p.decisionMode || 'EXPLORATION',
        confidence: p.confidence || 3,
      };
    });

    return NextResponse.json({
      success: true,
      positions: enrichedPositions
    });
  } catch (error: any) {
    const account = tradingFallbackStore.getPaperAccount(userId);
    return NextResponse.json({
      success: true,
      positions: account.positions || []
    });
  }
}
