import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { generateHash } from '@/stores/wallet-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const adminDb = getAdminDb();
    
    // 1. Delete existing global_blocks
    const blocksSnap = await adminDb.collection('global_blocks').get();
    const batch = adminDb.batch();
    blocksSnap.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // 2. Initialize fresh global Genesis Block #0
    const genesisTimeISO = '1970-01-01T00:00:00.000Z';
    const genesisHash = await generateHash('genesis:securechainpay:global:v1');

    const genesisBlock = {
      id: 'GENESIS',
      applicationTransactionId: 'TX_GENESIS_GLOBAL',
      userId: 'SYSTEM',
      sender: '0x0000000000000000000000000000000000000000',
      receiver: '0x0000000000000000000000000000000000000000',
      blockNumber: 0,
      hash: genesisHash,
      transactionHash: genesisHash,
      previousHash: '0',
      walletAddress: '0x0000000000000000000000000000000000000000',
      senderPublicKey: 'SYSTEM_GENESIS',
      digitalSignature: 'Genesis Block - System Generated',
      signature: 'Genesis Block - System Generated',
      type: 'genesis',
      amount: 0,
      currency: 'USD',
      asset: 'USD',
      status: 'CONFIRMED',
      date: genesisTimeISO,
      createdAt: genesisTimeISO,
      confirmedAt: genesisTimeISO,
      description: 'SecureChain Pay — Global Genesis Block',
      payload: { message: 'SecureChain Global Blockchain Initialized' },
      difficulty: 1,
      nonce: 0,
      blockSize: 256,
    };

    const chainState = {
      lastBlockNumber: 0,
      lastBlockHash: genesisHash,
      genesisHash: genesisHash,
      totalBlocks: 1,
      lastUpdatedAt: new Date().toISOString(),
    };

    await adminDb.collection('global_blocks').doc('GENESIS').set(genesisBlock);
    await adminDb.collection('global_chain_meta').doc('chain_state').set(chainState);

    return NextResponse.json({
      success: true,
      message: 'Global chain initialized cleanly with Genesis Block #0',
      genesisBlock,
      chainState,
    });
  } catch (error: any) {
    console.error('[API /api/blockchain/reset] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reset global chain' },
      { status: 500 }
    );
  }
}
