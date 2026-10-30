import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';
import { TwinReconciliationResultDTO } from '@/types/vehicle';

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

    const pastRecon: TwinReconciliationResultDTO = {
      reconciliationId: `recon-seed-${vehicle.id}`,
      vehicleId: vehicle.id,
      status: 'SUCCESS',
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      completedAt: new Date(Date.now() - 86400000 + 120).toISOString(),
      durationMs: 120,
      sourcesCompared: 5,
      discrepanciesCount: 0,
      discrepancies: [],
      repairSummary: 'Initial automated consensus audit verified with zero ledger drift.',
    };

    return NextResponse.json({
      success: true,
      data: [pastRecon],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
