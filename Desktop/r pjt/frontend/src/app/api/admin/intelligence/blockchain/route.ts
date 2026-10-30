import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = {
      network: 'Hardhat Local / EVM L2 (Chain 31337)',
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      latestBlock: 46,
      totalAnchoredRecords: 66,
      totalBatches: 12,
      gasSavingsPct: 99.0,
      dailyTransactions: [
        { date: '2026-10-24', count: 8 },
        { date: '2026-10-25', count: 12 },
        { date: '2026-10-26', count: 15 },
        { date: '2026-10-27', count: 14 },
        { date: '2026-10-28', count: 17 },
      ],
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

