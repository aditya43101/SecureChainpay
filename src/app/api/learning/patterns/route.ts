import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const patterns = await db.feedbackMemory.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20
    });

    return NextResponse.json({
      success: true,
      patterns
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
