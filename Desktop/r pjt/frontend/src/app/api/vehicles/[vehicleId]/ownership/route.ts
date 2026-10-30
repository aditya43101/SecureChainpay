import { NextResponse } from 'next/server';
import { getOwnershipHistoryData, getVehicles } from '@/lib/serverStore';

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
      return NextResponse.json(
        { success: false, error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    const history = getOwnershipHistoryData(vehicle.id);

    return NextResponse.json({
      success: true,
      data: {
        ownershipHistory: history,
      },
    });
  } catch (error: any) {
    console.error('API /ownership GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve ownership history' },
      { status: 500 }
    );
  }
}
