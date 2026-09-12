import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { BlockchainWriteService } from '@/lib/blockchain/blockchain-write-service';
import { OnChainStateReader } from '@/lib/blockchain/on-chain-state-reader';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const adminDb = getAdminDb();
    const stateDoc = await adminDb.collection('global_chain_meta').doc('chain_state').get();

    const onChainState = await OnChainStateReader.getChainState();

    if (stateDoc.exists) {
      return NextResponse.json({
        success: true,
        chainState: stateDoc.data(),
        onChainAnchor: onChainState,
      });
    }

    return NextResponse.json({
      success: true,
      chainState: null,
      onChainAnchor: onChainState,
    });
  } catch (error: any) {
    console.error('[API /api/blockchain/state] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch chain state' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const chainState = await BlockchainWriteService.ensureGenesisBlock();
    const adminDb = getAdminDb();
    const genesisDoc = await adminDb.collection('global_blocks').doc('GENESIS').get();
    const onChainState = await OnChainStateReader.getChainState();

    return NextResponse.json({
      success: true,
      genesisBlock: genesisDoc.exists ? genesisDoc.data() : null,
      chainState,
      onChainAnchor: onChainState,
    });
  } catch (error: any) {
    console.error('[API /api/blockchain/state POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to initialize genesis' },
      { status: 500 }
    );
  }
}
