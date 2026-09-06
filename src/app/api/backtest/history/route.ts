import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const history = await db.backtestRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json({
      success: true,
      history
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
