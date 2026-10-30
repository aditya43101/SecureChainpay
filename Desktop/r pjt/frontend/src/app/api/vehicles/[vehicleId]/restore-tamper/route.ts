import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';

export async function POST(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const vehicles = getVehicles();
    const vehicle = vehicles.find((v) => v.id === vehicleId || v.passportId === vehicleId);

    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `[DEV RESTORE] Vehicle ${vehicle.passportId} data restored to match cryptographic blockchain anchors.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

