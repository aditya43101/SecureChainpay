/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHAIN RECONCILIATION & HEALING SCRIPT
 * SecureChain Pay — Cryptographic Integrity Healing Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This script resolves the legacy hashing discrepancies on Blocks 1–20 by:
 * 1. Removing non-block rogue doc `TX_P4_REC_ROOT` from `global_blocks`.
 * 2. Sequentially recomputing SHA-256 canonical block hashes from Block 1 to 30.
 * 3. Chaining previousHash unbroken from Genesis (Block 0) to Block 30.
 * 4. Syncing corresponding user transaction documents.
 * 5. Updating `global_chain_meta/chain_state`.
 */

import { getAdminDb } from '../src/lib/firebase/admin';
import { calculateCanonicalBlockHash } from '../src/lib/crypto/canonical-hash';

async function healChain() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🚀 Starting Chain Reconciliation & Cryptographic Healing...');
  console.log('══════════════════════════════════════════════════════════════');

  const adminDb = getAdminDb();

  // 1. Remove stray non-block TX_P4_REC_ROOT if exists
  const strayRef = adminDb.collection('global_blocks').doc('TX_P4_REC_ROOT');
  const straySnap = await strayRef.get();
  if (straySnap.exists) {
    console.log('🧹 Removing stray non-block doc TX_P4_REC_ROOT from global_blocks...');
    // Backup to reconciliation_stray_docs first just in case
    await adminDb.collection('reconciliation_stray_docs').doc('TX_P4_REC_ROOT').set(straySnap.data()!);
    await strayRef.delete();
    console.log('✅ TX_P4_REC_ROOT safely backed up and removed from global_blocks.');
  }

  // 2. Fetch Genesis block
  const genesisSnap = await adminDb.collection('global_blocks').doc('GENESIS').get();
  if (!genesisSnap.exists) {
    throw new Error('GENESIS block not found in global_blocks');
  }
  const genesisData = genesisSnap.data()!;
  const genesisHash = genesisData.hash || 'b6309af41bddfc59b48c0beece3ea89394262e5ab342b15c2e4bbd9785741b57';
  console.log(`📍 Genesis Hash: ${genesisHash}`);

  // 3. Fetch all numbered blocks
  const allBlocksSnap = await adminDb.collection('global_blocks').get();
  const numberedBlocks = allBlocksSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((b: any) => typeof b.blockNumber === 'number' && b.blockNumber > 0)
    .sort((a: any, b: any) => a.blockNumber - b.blockNumber);

  console.log(`📦 Total numbered blocks found: ${numberedBlocks.length}`);

  let currentPreviousHash = genesisHash;
  const updates: Array<{
    docId: string;
    blockNumber: number;
    userId?: string;
    previousHash: string;
    hash: string;
  }> = [];

  for (const block of numberedBlocks as any[]) {
    const bn = block.blockNumber;
    const amount = Number(block.amount || 0);
    const currency = (block.currency || block.asset || 'HSCT').toUpperCase().trim();
    const date = block.date || block.createdAt || '';
    const type = block.type || 'transfer';
    const idempotencyKey = block.idempotencyKey || block.id;

    const canonicalHash = await calculateCanonicalBlockHash({
      blockNumber: bn,
      previousHash: currentPreviousHash,
      sender: block.sender || '',
      receiver: block.receiver || '',
      amount,
      currency,
      date,
      type,
      idempotencyKey,
    });

    updates.push({
      docId: block.id,
      blockNumber: bn,
      userId: block.userId,
      previousHash: currentPreviousHash,
      hash: canonicalHash,
    });

    currentPreviousHash = canonicalHash;
  }

  console.log(`🔄 Applying canonical hash updates to ${updates.length} blocks...`);

  // 4. Batch commit updates
  const BATCH_SIZE = 450;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();

    for (const u of chunk) {
      const blockRef = adminDb.collection('global_blocks').doc(u.docId);
      batch.update(blockRef, {
        hash: u.hash,
        transactionHash: u.hash,
        previousHash: u.previousHash,
      });

      // Also update user transaction doc if exists
      if (u.userId) {
        const userTxRef = adminDb
          .collection('users')
          .doc(u.userId)
          .collection('transactions')
          .doc(u.docId);
        batch.set(
          userTxRef,
          {
            hash: u.hash,
            transactionHash: u.hash,
            previousHash: u.previousHash,
          },
          { merge: true }
        );
      }
    }

    await batch.commit();
    console.log(`✅ Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} blocks)`);
  }

  // 5. Update global_chain_meta/chain_state
  const lastBlock = updates[updates.length - 1];
  console.log(`⛓️ Final Block #${lastBlock.blockNumber} Hash: ${lastBlock.hash}`);

  await adminDb.collection('global_chain_meta').doc('chain_state').set(
    {
      lastBlockNumber: lastBlock.blockNumber,
      lastBlockHash: lastBlock.hash,
      genesisHash,
      totalBlocks: updates.length + 1, // include genesis
      lastUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log('✅ global_chain_meta/chain_state updated successfully.');
  console.log('🎉 Chain Reconciliation & Cryptographic Healing COMPLETE!');
}

healChain()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Chain healing failed:', err);
    process.exit(1);
  });
