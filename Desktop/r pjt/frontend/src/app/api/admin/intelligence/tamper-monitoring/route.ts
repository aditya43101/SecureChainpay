import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = {
      tamperMonitoredVehiclesCount: 29,
      tamperEventsCount: 0,
      activeAlertsCount: 0,
      lastAuditTimestamp: new Date().toISOString(),
      recentAudits: [
        {
          vehicleId: 'demo-veh-001-aurora',
          passportId: 'VP-DEMO-001',
          status: 'MATCH',
          tamperDetected: false,
          auditedAt: new Date().toISOString(),
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

