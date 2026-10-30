import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const overview = {
      totalNodes: 38,
      totalEdges: 54,
      lastSyncedAt: new Date().toISOString(),
      status: 'SYNCHRONIZED',
      syncDurationMs: 312,
      nodeTypeDistribution: [
        { type: 'VEHICLE', count: 8 },
        { type: 'USER', count: 6 },
        { type: 'GARAGE', count: 4 },
        { type: 'INSURER', count: 2 },
        { type: 'DOCUMENT', count: 18 },
      ],
      edgeTypeDistribution: [
        { type: 'OWNS', count: 8 },
        { type: 'TRANSFERRED_TO', count: 4 },
        { type: 'SERVICED_BY', count: 16 },
        { type: 'INSURED_BY', count: 6 },
        { type: 'VERIFIED_DOCUMENT', count: 20 },
      ],
      findingsSummary: {
        totalFindings: 3,
        highSeverity: 1,
        openFindings: 2,
        totalCases: 2,
        byCategory: [
          { category: 'ODOMETER_ROLLBACK', count: 1 },
          { category: 'RAPID_FLIP', count: 1 },
          { category: 'DOCUMENT_MISMATCH', count: 1 },
        ],
        bySeverity: [
          { severity: 'HIGH', count: 1 },
          { severity: 'MEDIUM', count: 1 },
          { severity: 'LOW', count: 1 },
        ],
      },
    };

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

