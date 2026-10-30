import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const runs = [
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
      {
        id: 'inv-run-102',
        investigationType: 'CROSS_BORDER_TITLE_WASHING',
        status: 'COMPLETED',
        targetType: 'VEHICLE',
        targetId: 'demo-veh-008-orbit',
        targetIdentifier: 'VP-DEMO-008',
        startedAt: new Date(Date.now() - 7200000).toISOString(),
        completedAt: new Date(Date.now() - 7100000).toISOString(),
        totalStepsCount: 4,
        confidenceScore: 0.96,
        findingsCount: 0,
        conclusionSummary: 'Traced sequential ownership chain from Rohan Verma → Priya Verma → Aarav Sharma. Clean title confirmed on-chain.',
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        runs,
        total: runs.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

