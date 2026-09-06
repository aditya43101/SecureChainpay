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

      return NextResponse.json({
        success: true,
        blocks: [genesisBlock],
        count: 1,
      });
    }

    // Sort chronologically (Genesis first)
    const sortedAsc = rawBlocks.sort((a, b) => {
      if (a.type === 'genesis') return -1;
      if (b.type === 'genesis') return 1;
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    let needsRepair = false;

    // Check & repair sequential block numbers and hash linkages
    for (let i = 0; i < sortedAsc.length; i++) {
      const expectedBlockNum = i;
      const currentBlock = sortedAsc[i];

      let isModified = false;

      if (currentBlock.blockNumber !== expectedBlockNum) {
        currentBlock.blockNumber = expectedBlockNum;
        isModified = true;
      }

      if (i > 0) {
        const expectedPrevHash = sortedAsc[i - 1].hash;
        if (currentBlock.previousHash !== expectedPrevHash) {
          currentBlock.previousHash = expectedPrevHash;
          isModified = true;
        }
      } else {
        if (currentBlock.type === 'genesis' && currentBlock.previousHash !== '0') {
          currentBlock.previousHash = '0';
          isModified = true;
        }
      }

      if (isModified) {
        needsRepair = true;
        try {
          const adminDb = getAdminDb();
          const blockDocId = currentBlock.id || currentBlock.applicationTransactionId;
          const patch = {
            blockNumber: currentBlock.blockNumber,
            previousHash: currentBlock.previousHash,
          };
          await adminDb.collection('global_blocks').doc(blockDocId).set(patch, { merge: true });

          if (currentBlock.userId) {
            await adminDb
              .collection('users')
              .doc(currentBlock.userId)
              .collection('transactions')
              .doc(blockDocId)
              .set(patch, { merge: true });
          }
        } catch (dbErr) {
          console.warn('[API /api/blockchain/blocks] Repair sync warning:', dbErr);
        }
      }
    }

    // Update global chain metadata if repaired
    if (needsRepair && sortedAsc.length > 0) {
      const lastBlock = sortedAsc[sortedAsc.length - 1];
      try {
        const adminDb = getAdminDb();
        await adminDb.collection('global_chain_meta').doc('chain_state').set(
          {
            lastBlockNumber: lastBlock.blockNumber,
            lastBlockHash: lastBlock.hash,
            totalBlocks: sortedAsc.length,
            lastUpdatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (metaErr) {
        console.warn('[API /api/blockchain/blocks] Meta sync warning:', metaErr);
      }
    }

    // Return descending for UI presentation (latest block first)
    const sortedDesc = [...sortedAsc].sort((a, b) => b.blockNumber - a.blockNumber);

    return NextResponse.json({
      success: true,
      blocks: sortedDesc,
      count: sortedDesc.length,
      repaired: needsRepair,
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
        currency: 'USD',
        asset: 'USD',
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
