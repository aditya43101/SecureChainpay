import { NextResponse } from 'next/server';
import {
  getBlockchainHealth,
  getOffChainHealth,
  ROUTING_POLICY_VERSION,
} from '@/lib/payments/transaction-routing-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [blockchainHealth, offChainHealth] = await Promise.all([
      getBlockchainHealth(),
      getOffChainHealth(),
    ]);

    const performanceMetrics = {
      overallSuccessRate: 99.8,
      activePendingCount: 14,
      routes: [
        {
          route: 'HYBRID',
          name: 'Hybrid Settlement',
          usageShare: '62%',
          successRate: 99.9,
          avgLatencyMs: 180,
          avgCostHsct: 0.0,
          activeCount: 9,
        },
        {
          route: 'ON_CHAIN',
          name: 'Direct EVM On-Chain',
          usageShare: '24%',
          successRate: 99.4,
          avgLatencyMs: 2400,
          avgCostHsct: 0.05,
          activeCount: 3,
        },
        {
          route: 'OFF_CHAIN',
          name: 'Sub-Second Off-Chain',
          usageShare: '11%',
          successRate: 99.99,
          avgLatencyMs: 80,
          avgCostHsct: 0.0,
          activeCount: 2,
        },
        {
          route: 'DEFERRED_ON_CHAIN',
          name: 'Deferred Anchoring',
          usageShare: '3%',
          successRate: 98.5,
          avgLatencyMs: 120,
          avgCostHsct: 0.0,
          activeCount: 0,
        },
      ],
    };

    const policyConfiguration = {
      version: ROUTING_POLICY_VERSION,
      securityWeight: 0.4,
      reliabilityWeight: 0.25,
      availabilityWeight: 0.15,
      latencyWeight: 0.1,
      costWeight: 0.1,
      securityOverrideEnabled: true,
      autoFallbackEnabled: true,
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      blockchainHealth,
      offChainHealth,
      performanceMetrics,
      policyConfiguration,
    });
  } catch (error: any) {
    console.error('[API /api/system/health] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch system health status' },
      { status: 500 }
    );
  }
}
