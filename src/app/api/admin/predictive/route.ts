import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PredictiveEngine } from '@/lib/payments/predictive-engine';
import { getBlockchainHealth, getOffChainHealth } from '@/lib/payments/transaction-routing-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [chainHealth, dbHealth, reliabilityForecast, incidents] = await Promise.all([
      getBlockchainHealth(),
      getOffChainHealth(),
      PredictiveEngine.getReliabilityForecast('Primary_EVM_Node'),
      prisma.predictiveIncident.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    // Fetch AI explanations for incidents
    const enrichedIncidents = await Promise.all(
       incidents.map(async (inc) => {
          const aiExplanation = await PredictiveEngine.explainIncident(inc.id);
          return { ...inc, aiExplanation };
       })
    );

    return NextResponse.json({
      success: true,
      data: {
        health: {
          blockchain: chainHealth,
          database: dbHealth
        },
        forecast: {
           provider: 'Primary_EVM_Node',
           ...reliabilityForecast
        },
        incidents: enrichedIncidents
      }
    });

  } catch (error: any) {
    console.error('Predictive API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
