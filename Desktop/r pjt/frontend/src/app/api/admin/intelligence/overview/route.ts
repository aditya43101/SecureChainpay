import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = {
      totalVehicles: 29,
      totalUsers: 16,
      totalAnchoredRecords: 66,
      totalMerkleBatches: 12,
      activeAnomaliesCount: 0,
      blockchainIntegrityScore: 100,
      systemHealth: 'OPERATIONAL',
      recentAlerts: [
        {
          id: 'al-1',
          type: 'MERKLE_BATCH_CONFIRMED',
          title: 'Batch BATCH-2026-000012 Confirmed',
          timestamp: new Date().toISOString(),
        },
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

