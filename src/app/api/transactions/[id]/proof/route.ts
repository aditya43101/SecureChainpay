import { NextResponse } from 'next/server';
import {
  computeMerkleLeaf,
  buildMerkleTree,
  generateMerkleProofFromLevels,
  verifyMerkleProof,
} from '@/lib/blockchain/merkle-tree';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing transaction ID parameter' }, { status: 400 });
    }

    // Return the cryptographic structure for the requested transaction ID
    const url = new URL(request.url);
    const hash = url.searchParams.get('hash') || '0x0000000000000000000000000000000000000000000000000000000000000000';
    const leaf = await computeMerkleLeaf({
      applicationTransactionId: id,
      transactionHash: hash,
    });

    const { levels, root } = await buildMerkleTree([leaf]);
    const proof = generateMerkleProofFromLevels(levels, 0);
    const verified = await verifyMerkleProof(leaf, proof, root);

    return NextResponse.json({
      applicationTransactionId: id,
      batchId: `BATCH_${id}`,
      leaf,
      merkleRoot: root,
      proof,
      blockchainTransactionHash: null,
      blockNumber: null,
      blockHash: null,
      verified,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
