import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const overview = {
      totalRuns: 14,
      runningRuns: 0,
      completedRuns: 13,
      reviewRequiredRuns: 1,
      failedRuns: 0,
      recentRuns: [
        {
          id: 'inv-run-101',
          investigationType: 'ODOMETER_ROLLBACK_AUDIT',
          status: 'COMPLETED',
          targetType: 'VEHICLE',
          targetId: 'demo-veh-001-aurora',
          targetIdentifier: 'VP-DEMO-001',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3500000).toISOString(),
          totalStepsCount: 5,
          confidenceScore: 0.98,
          findingsCount: 0,
          conclusionSummary: 'Audited all 3 physical odometer telemetry records against blockchain Merkle roots. Zero rollbacks detected.',
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

