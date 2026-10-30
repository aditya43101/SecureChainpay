import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  return NextResponse.json({
    success: true,
    data: {
      currentMileage: 24500,
      lastRecordedServiceDate: '2026-08-15T00:00:00.000Z',
      lastRecordedServiceMileage: 20000,
      overallMaintenanceRisk: 'LOW',
      summary: 'Powertrain, braking, and battery systems are performing well within nominal tolerances.',
      predictions: [
        {
          id: 'pred-1',
          system: 'Powertrain & Lubrication',
          title: '30,000 km Scheduled Engine Service',
          status: 'SCHEDULED',
          confidence: 'HIGH',
          urgency: 'ROUTINE',
          estimatedDueMileage: 30000,
          estimatedDueDate: '2027-01-15T00:00:00.000Z',
          mileageRemaining: 5500,
          reason: 'Recommended 30k manufacturer service interval for oil, filters, and spark plug check.',
          supportingHistory: {
            lastRelatedServiceDate: '2026-08-15T00:00:00.000Z',
            lastRelatedServiceMileage: 20000,
            recommendedIntervalKm: 10000,
            recommendedIntervalMonths: 6,
            currentMileage: 24500,
          },
          recommendedServiceType: 'Comprehensive Inspection & Synthetic Oil Change',
          fuelTypeSuitability: ['PETROL', 'DIESEL', 'HYBRID'],
        },
      ],
      engineVersion: 'v2.5.0-predictive',
    },
  });
}

