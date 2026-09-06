import { NextResponse } from 'next/server';
import { backtestEngine } from '@/lib/trading/backtest-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol = 'BTCUSDT', timeframe = '1h', initialCapital = 100000, strategyName = 'HYBRID', feeRate, slippageRate, riskPerTrade } = body;

    const summary = await backtestEngine.runBacktest({
      symbol,
      timeframe,
      initialCapital: parseFloat(initialCapital),
      strategyName,
      feeRate: feeRate ? parseFloat(feeRate) : undefined,
      slippageRate: slippageRate ? parseFloat(slippageRate) : undefined,
      riskPerTrade: riskPerTrade ? parseFloat(riskPerTrade) : undefined,
    });

    return NextResponse.json({
      success: true,
      summary
    });
  } catch (error: any) {
    console.error('API /api/backtest/run error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
