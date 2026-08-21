import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { generateHash } from '@/stores/wallet-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const adminDb = getAdminDb();
    const stateDoc = await adminDb.collection('global_chain_meta').doc('chain_state').get();

    if (stateDoc.exists) {
      return NextResponse.json({
        success: true,
        chainState: stateDoc.data(),
      });
    }

    return NextResponse.json({
      success: true,
      chainState: null,
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
    const adminDb = getAdminDb();
    const genesisRef = adminDb.collection('global_blocks').doc('GENESIS');
    const chainStateRef = adminDb.collection('global_chain_meta').doc('chain_state');

    const genesisDoc = await genesisRef.get();
    if (genesisDoc.exists) {
      const stateDoc = await chainStateRef.get();
      return NextResponse.json({
        success: true,
        genesisBlock: genesisDoc.data(),
        chainState: stateDoc.exists ? stateDoc.data() : null,
      });
    }

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

    await adminDb.runTransaction(async (transaction) => {
      const check = await transaction.get(genesisRef);
      if (!check.exists) {
        transaction.set(genesisRef, genesisBlock);
        transaction.set(chainStateRef, chainState);
      }
    });

    return NextResponse.json({
      success: true,
      genesisBlock,
      chainState,
    });
  } catch (error: any) {
    console.error('[API /api/blockchain/state POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to initialize genesis' },
      { status: 500 }
    );
  }
}
