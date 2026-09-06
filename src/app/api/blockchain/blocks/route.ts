import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const adminDb = getAdminDb();
    const snap = await adminDb.collection('global_blocks').get();

    const rawBlocks: any[] = [];
    snap.forEach((doc) => {
      rawBlocks.push(doc.data());
    });

    if (rawBlocks.length === 0) {
      return NextResponse.json({
        success: true,
        blocks: [],
        count: 0,
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
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch global blocks' },
      { status: 500 }
    );
  }
}
