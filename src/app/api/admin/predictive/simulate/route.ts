import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeRouteDecision } from '@/lib/payments/transaction-routing-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scenario, provider } = body;

    let predictedReliability = 95;
    let expectedDelay = '18 seconds';

    if (scenario === 'LATENCY_SPIKE') {
      predictedReliability = 65; 
      expectedDelay = '45 seconds';
    } else if (scenario === 'PROVIDER_FAILURE') {
      predictedReliability = 20; 
      expectedDelay = '2+ minutes';
    }

    // Call routing engine for a dummy transaction to see baseline
    const mockDecision = await computeRouteDecision({
       paymentId: 'SIMULATION_TEST',
       amount: 500,
    });

    // Calculate how the routing shifts
    let recommendedRoute = mockDecision.selectedRoute;
    if (predictedReliability < 30) recommendedRoute = 'OFF_CHAIN'; // Evades chain completely
    else if (predictedReliability < 70) recommendedRoute = 'HYBRID'; // Minimizes sync risk

    // Store the simulation in DB for auditing
    const simRecord = await prisma.whatIfSimulation.create({
       data: {
         scenario,
         parameters: { provider },
         predictedImpact: { predictedReliability, expectedDelay, recommendedRoute }
       }
    });

    return NextResponse.json({
      success: true,
      data: {
        simulationId: simRecord.id,
        impact: {
          predictedReliability,
          expectedDelay,
          recommendedRoute,
          affectedTraffic: scenario === 'PROVIDER_FAILURE' ? '30%' : '10%'
        }
      }
    });

  } catch (error: any) {
    console.error('What-If Sim Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
