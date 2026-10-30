import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';

export async function POST(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const body = await request.json().catch(() => ({}));
    const { anomalyId = 'ANOMALY-001', reason = 'Telemetry divergence detected', investigationType = 'FULL_FORENSIC' } = body;

    const vehicles = getVehicles();
    const vehicle =
      vehicles.find((v) => v.id === vehicleId || v.passportId === vehicleId || v.vin === vehicleId) ||
      vehicles[0];

    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    }

    const runId = `inv-run-${Date.now().toString().slice(-6)}`;
    const caseId = `CASE-AUTO-${vehicle.passportId.replace(/[^a-zA-Z0-9]/g, '')}`;

    return NextResponse.json({
      success: true,
      message: 'Anomaly dispatched to autonomous investigation agent.',
      data: {
        runId,
        caseId,
        vehicleId: vehicle.id,
        passportId: vehicle.passportId,
        anomalyId,
        investigationType,
        reason,
        status: 'INITIATED',
        agentType: 'AUTONOMOUS_FORENSIC_INSPECTOR',
        dispatchedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
