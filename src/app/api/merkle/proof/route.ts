import { NextResponse } from 'next/server';
import {
  computeMerkleLeaf,
  buildMerkleTree,
  generateMerkleProofFromLevels,
  verifyMerkleProof,
  sortTransactionsDeterministically,
} from '@/lib/blockchain/merkle-tree';
import { AnchorBatch } from '@/types/merkle';
import { HybridTransactionRecord } from '@/types/hybrid-transaction';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { batch, transactions, targetTransactionId } = body as {
      batch?: AnchorBatch;
      transactions?: HybridTransactionRecord[];
      targetTransactionId: string;
    };

    if (!targetTransactionId) {
      return NextResponse.json(
        { error: 'Missing targetTransactionId' },
        { status: 400 }
      );
    }

    if (batch) {
      const targetIndex = batch.transactionIds.indexOf(targetTransactionId);
      if (targetIndex === -1) {
        return NextResponse.json(
          { error: `Transaction ${targetTransactionId} not found in batch ${batch.batchId}` },
          { status: 404 }
        );
      }

      const { levels, root } = await buildMerkleTree(batch.leafHashes);
      const proofNodes = generateMerkleProofFromLevels(levels, targetIndex);
      const leaf = batch.leafHashes[targetIndex];
      const verified = await verifyMerkleProof(leaf, proofNodes, root);

      return NextResponse.json({
        success: true,
        proof: {
          batchId: batch.batchId,
          applicationTransactionId: targetTransactionId,
          leaf,
          proof: proofNodes,
          merkleRoot: root,
          verified,
          blockchainTransactionHash: batch.blockchainTransactionHash,
          blockNumber: batch.blockNumber,
          blockHash: batch.blockHash,
        },
      });
    }

    if (transactions && transactions.length > 0) {
      const sorted = sortTransactionsDeterministically(transactions);
      const targetIndex = sorted.findIndex(
        (t) => (t.applicationTransactionId || t.id) === targetTransactionId
      );

      if (targetIndex === -1) {
        return NextResponse.json(
          { error: `Transaction ${targetTransactionId} not found in provided transactions list` },
          { status: 404 }
        );
      }

      const leaves: string[] = [];
      for (const t of sorted) {
        const leaf = await computeMerkleLeaf({
          applicationTransactionId: t.applicationTransactionId || t.id,
          transactionHash: t.transactionHash || t.hash,
        });
        leaves.push(leaf);
      }

      const { levels, root } = await buildMerkleTree(leaves);
      const proofNodes = generateMerkleProofFromLevels(levels, targetIndex);
      const leaf = leaves[targetIndex];
      const verified = await verifyMerkleProof(leaf, proofNodes, root);

      return NextResponse.json({
        success: true,
        proof: {
          applicationTransactionId: targetTransactionId,
          leaf,
          proof: proofNodes,
          merkleRoot: root,
          verified,
        },
      });
    }

    return NextResponse.json(
      { error: 'Provide either batch or transactions list' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[API /api/merkle/proof] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
