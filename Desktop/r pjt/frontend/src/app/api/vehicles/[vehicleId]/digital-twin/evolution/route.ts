import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';

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

    const evolution = [
      {
        timestamp: '2025-01-10T00:00:00.000Z',
        stateSummary: 'Vehicle Minted & Genesis Title Anchored',
        sourceEvent: 'REGISTRATION',
        mileage: 0,
        confidence: 100,
      },
      {
        timestamp: '2025-06-15T10:30:00.000Z',
        stateSummary: 'Periodic 10,000 km Service Recorded',
        sourceEvent: 'SERVICE',
        mileage: 10500,
        confidence: 99,
      },
      {
        timestamp: '2025-11-20T14:00:00.000Z',
        stateSummary: 'Brake Overhaul & 22,000 km Telemetry Anchored',
        sourceEvent: 'TELEMETRY',
        mileage: 22000,
        confidence: 100,
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        vehicleId: vehicle.id,
        passportId: vehicle.passportId,
        count: evolution.length,
        evolution,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
