import { NextResponse } from 'next/server';
import { getVehicles, getVehicleTimelineData } from '@/lib/serverStore';

export async function GET(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const vehicles = getVehicles();
    const vehicle =
      vehicles.find((v) => v.id === vehicleId || v.passportId === vehicleId || v.vin === vehicleId) ||
      vehicles[0];

    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    }

    const timeline = getVehicleTimelineData(vehicle.id);

    return NextResponse.json({
      success: true,
      data: {
        vehicleId: vehicle.id,
        passportId: vehicle.passportId,
        count: timeline.length,
        timeline,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
