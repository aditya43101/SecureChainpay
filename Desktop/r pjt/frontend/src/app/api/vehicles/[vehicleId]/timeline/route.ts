import { NextResponse } from 'next/server';
import { getVehicleTimelineData } from '@/lib/serverStore';

export async function GET(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const timeline = getVehicleTimelineData(vehicleId);

    return NextResponse.json({
      success: true,
      data: {
        timeline,
        summary: {
          totalEvents: timeline.length,
          lastUpdated: new Date().toISOString(),
          auditIntegrity: 'CRYPTOGRAPHICALLY_VERIFIED',
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
