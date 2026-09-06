import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const backtest = await db.backtestRun.findUnique({
      where: { id },
      include: {
        trades: {
          orderBy: { entryTime: 'asc' }
        }
      }
    });

    if (!backtest) {
      return NextResponse.json({ error: 'Backtest not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      backtest
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
