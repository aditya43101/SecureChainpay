import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    let rawBlocks: any[] = [];
    try {
      const adminDb = getAdminDb();
      const snap = await adminDb.collection('global_blocks').get();
      snap.forEach((doc) => {
        rawBlocks.push(doc.data());
      });
    } catch (dbErr) {
      console.warn('[API /api/blockchain/blocks] Admin DB unavailable, returning genesis fallback:', dbErr);
    }

    if (rawBlocks.length === 0) {
      const genesisTimeISO = '1970-01-01T00:00:00.000Z';
      const genesisHash = '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
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
        currency: 'HSCT',
        asset: 'HSCT',
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

      return NextResponse.json({
        success: true,
        blocks: [genesisBlock],
        count: 1,
      });
    }

    // Read-only presentation: order descending by blockNumber
    const sortedDesc = [...rawBlocks].sort((a, b) => (b.blockNumber ?? 0) - (a.blockNumber ?? 0));

    return NextResponse.json({
      success: true,
      blocks: sortedDesc,
      count: sortedDesc.length,
    });
  } catch (error: any) {
    console.error('[API /api/blockchain/blocks] Error:', error);
    const genesisHash = '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
    return NextResponse.json({
      success: true,
      blocks: [{
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
        currency: 'HSCT',
        asset: 'HSCT',
        status: 'CONFIRMED',
        date: '1970-01-01T00:00:00.000Z',
        createdAt: '1970-01-01T00:00:00.000Z',
        confirmedAt: '1970-01-01T00:00:00.000Z',
        description: 'SecureChain Pay — Global Genesis Block',
        payload: { message: 'SecureChain Global Blockchain Initialized' },
        difficulty: 1,
        nonce: 0,
        blockSize: 256,
      }],
      count: 1,
    });
  }
}
