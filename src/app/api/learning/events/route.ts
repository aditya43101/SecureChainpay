import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function GET() {
  try {
    try {
      const events = await db.learningEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return NextResponse.json({
        success: true,
        events
      });
    } catch {
      const events = tradingFallbackStore.getLearningEvents(20);
      return NextResponse.json({
        success: true,
        events
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: true, events: [] });
  }
}
