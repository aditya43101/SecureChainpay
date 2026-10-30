import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';
import { ScenarioSimulationResultDTO } from '@/types/vehicle';

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

    const initialScenario: ScenarioSimulationResultDTO = {
      scenarioId: `sim-seed-${vehicle.id}`,
      vehicleId: vehicle.id,
      scenarioType: 'SCHEDULED_MAINTENANCE',
      status: 'COMPLETED',
      baseTwinVersion: '2.4.0-autonomous',
      simulatedAt: new Date(Date.now() - 3600000).toISOString(),
      assumptions: ['Baseline audit model assuming 15,000 km annual highway usage'],
      inputs: { gapMonths: 12 },
      diffs: [
        {
          attribute: 'services.coveragePercentage',
          baseValue: 100,
          simulatedValue: 80,
          changeExplanation: 'Projected service coverage drops 20% due to postponed periodic maintenance',
          impactLevel: 'WARNING',
        },
      ],
      simulatedStateSummary: {
        projectedHealthScore: 88,
        projectedRiskLevel: 'LOW_RISK',
        projectedServiceCoverage: 80,
        projectedMileage: 28450,
        projectedBatterySoH: 96,
        warningFlags: [],
      },
      explanation: 'Simulated 12-month service postponement indicates acceptable buffer before brake and fluid wear accelerates.',
      isSimulated: true,
    };

    return NextResponse.json({
      success: true,
      data: [initialScenario],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
