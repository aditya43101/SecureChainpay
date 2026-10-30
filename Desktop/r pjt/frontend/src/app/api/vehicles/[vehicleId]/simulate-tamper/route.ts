import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';

export async function POST(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const body = await request.json().catch(() => ({}));
    const vehicles = getVehicles();
    const vehicle = vehicles.find((v) => v.id === vehicleId || v.passportId === vehicleId);

    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    }

    const field = body.field || body.scenario || 'odometer';
    const tamperedValue = body.tamperedValue !== undefined ? body.tamperedValue : 12000;

    return NextResponse.json({
      success: true,
      message: `[DEV TAMPER] ${field} altered to ${tamperedValue} in simulation registry. Cryptographic mismatch guaranteed on next verify!`,
      data: {
        vehicleId: vehicle.id,
        field,
        tamperedValue,
        simulatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

