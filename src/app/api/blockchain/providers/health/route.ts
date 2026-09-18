import { NextResponse } from 'next/server';
import { NodeHealthEngine } from '@/lib/blockchain/node-health-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
    const healthEngine = NodeHealthEngine.getInstance();
    const reports = await healthEngine.checkAllProviders(contractAddress);

    const healthyCount = reports.filter((r) => r.status === 'HEALTHY').length;
    const isOperational = healthyCount > 0;

    return NextResponse.json({
      success: true,
      isOperational,
      healthyCount,
      totalProviders: reports.length,
      evaluatedAt: new Date().toISOString(),
      providers: reports,
    });
  } catch (error: any) {
    console.error('[API /blockchain/providers/health] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Health check failed' },
      { status: 500 }
    );
  }
}
