import { NextResponse } from 'next/server';
import { getVehicles, saveToDisk } from '@/lib/serverStore';

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

    return NextResponse.json({
      success: true,
      data: { vehicle },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
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

    if (body.color !== undefined) vehicle.color = body.color;
    if (body.variant !== undefined) vehicle.variant = body.variant;
    if (body.engineNumber !== undefined) vehicle.engineNumber = body.engineNumber;
    vehicle.updatedAt = new Date().toISOString();
    saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Vehicle details updated successfully',
      data: { vehicle },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
