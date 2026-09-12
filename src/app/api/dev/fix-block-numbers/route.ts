import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const adminDb = getAdminDb();
    const snap = await adminDb.collection('global_blocks').get();
    
    const blocks: any[] = [];
    snap.forEach((doc) => {
      blocks.push({ id: doc.id, ...doc.data() });
    });

    // Find genesis block
    const genesis = blocks.find((b) => b.type === 'genesis' || b.previousHash === '0' || b.blockNumber === 0);
    if (!genesis) {
      return NextResponse.json({ error: 'No genesis block found' }, { status: 400 });
    }

    // Follow previousHash chain to order blocks chronologically
    const chain: any[] = [genesis];
    const remaining = blocks.filter((b) => b.id !== genesis.id);

    while (remaining.length > 0) {
      const last = chain[chain.length - 1];
      const nextIndex = remaining.findIndex((b) => b.previousHash === last.hash);
      if (nextIndex === -1) break;
      chain.push(remaining[nextIndex]);
      remaining.splice(nextIndex, 1);
    }

    // Remaining blocks that might not be in the direct chain (if any)
    for (const b of remaining) {
      chain.push(b);
    }

    // Now update sequential blockNumber in Firestore
    const batch = adminDb.batch();
    let updatedCount = 0;

    for (let i = 0; i < chain.length; i++) {
      const b = chain[i];
      if (b.blockNumber !== i) {
        const ref = adminDb.collection('global_blocks').doc(b.id);
        batch.update(ref, {
          blockNumber: i,
          onChainBlockNumber: b.onChainBlockNumber || (b.blockNumber > 1000 ? b.blockNumber : null)
        });
        updatedCount++;
      }
    }

    // Update global_chain_meta
    const metaRef = adminDb.collection('global_chain_meta').doc('chain_state');
    const lastBlock = chain[chain.length - 1];
    batch.set(metaRef, {
      lastBlockNumber: chain.length - 1,
      lastBlockHash: lastBlock.hash,
      totalBlocks: chain.length,
      lastUpdatedAt: new Date().toISOString()
    }, { merge: true });

    await batch.commit();

    return NextResponse.json({
      success: true,
      totalBlocks: chain.length,
      updatedCount,
      chainSequence: chain.map((b, idx) => ({ index: idx, id: b.id, originalBn: b.blockNumber }))
    });
  } catch (err: any) {
    console.error('[fix-block-numbers] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
