import { NextResponse } from 'next/server';
import { getGlobalChainState } from '@/lib/blockchain/global-chain';
import { OnChainStateReader } from '@/lib/blockchain/on-chain-state-reader';
import { BlockchainReconciliationService } from '@/lib/blockchain/blockchain-reconciliation-service';

export async function GET() {
  try {
    const dbState = await getGlobalChainState();
    const onChainState = await OnChainStateReader.getChainState();

    const reconciliation = BlockchainReconciliationService.compareDbToChain(dbState, onChainState);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      dbState,
      onChainState,
      reconciliation,
      phase3Status: {
        active: Boolean(onChainState && onChainState.initialized),
        contractAddress: onChainState?.contractAddress || null,
        contractPaused: Boolean(onChainState?.paused),
        isSynchronized: !reconciliation.isDivergent,
      },
    });
  } catch (error: any) {
    console.error('[ChainStatus API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch chain status',
      },
      { status: 500 }
    );
  }
}
