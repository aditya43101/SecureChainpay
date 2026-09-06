import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export async function GET() {
  try {
    try {
      const patterns = await db.feedbackMemory.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 20
      });

      return NextResponse.json({
        success: true,
        patterns
      });
    } catch {
      const patterns = tradingFallbackStore.getFeedbackMemories(20);
      return NextResponse.json({
        success: true,
        patterns
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: true, patterns: [] });
  }
}
