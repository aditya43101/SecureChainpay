import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { generateHash } from '@/stores/wallet-store';
import type { Transaction } from '@/stores/wallet-store';

export const dynamic = 'force-dynamic';

export interface GlobalChainState {
  lastBlockNumber: number;
  lastBlockHash: string;
  genesisHash: string;
  totalBlocks: number;
  lastUpdatedAt: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { block } = body as { block: Transaction };

    if (!block || !block.id) {
      return NextResponse.json(
        { success: false, error: 'Missing block payload' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const chainStateRef = adminDb.collection('global_chain_meta').doc('chain_state');
    const blockRef = adminDb.collection('global_blocks').doc(block.id);
    const genesisRef = adminDb.collection('global_blocks').doc('GENESIS');

    let finalBlock: Transaction | null = null;

    await adminDb.runTransaction(async (transaction) => {
      let chainStateSnap = await transaction.get(chainStateRef);

      // If chain state doesn't exist, create genesis block on the fly
      let chainState: GlobalChainState;
      if (!chainStateSnap.exists) {
        const genesisTimeISO = '1970-01-01T00:00:00.000Z';
        const genesisHash = await generateHash('genesis:securechainpay:global:v1');

        const genesisBlock: Transaction = {
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

        chainState = {
          lastBlockNumber: 0,
          lastBlockHash: genesisHash,
          genesisHash: genesisHash,
          totalBlocks: 1,
          lastUpdatedAt: new Date().toISOString(),
        };

        transaction.set(genesisRef, genesisBlock);
        transaction.set(chainStateRef, chainState);
      } else {
        chainState = chainStateSnap.data() as GlobalChainState;
      }

      // Check if block already exists
      const existingBlock = await transaction.get(blockRef);
      if (existingBlock.exists) {
        finalBlock = existingBlock.data() as Transaction;
        return;
      }

      const globalBlockNumber = (chainState.lastBlockNumber || 0) + 1;
      const globalPreviousHash = chainState.lastBlockHash || '0x0000000000000000000000000000000000000000000000000000000000000000';

      const hashString = `${globalPreviousHash}${globalBlockNumber}${block.sender}${block.receiver}${block.amount}${block.date}${block.type}`;
      const globalBlockHash = await generateHash(hashString);

      finalBlock = {
        ...block,
        blockNumber: globalBlockNumber,
        previousHash: globalPreviousHash,
        hash: globalBlockHash,
      };

      const updatedChainState: GlobalChainState = {
        lastBlockNumber: globalBlockNumber,
        lastBlockHash: globalBlockHash,
        genesisHash: chainState.genesisHash || globalPreviousHash,
        totalBlocks: (chainState.totalBlocks || 1) + 1,
        lastUpdatedAt: new Date().toISOString(),
      };

      transaction.set(blockRef, finalBlock);
      transaction.set(chainStateRef, updatedChainState);
    });

    if (!finalBlock) {
      return NextResponse.json(
        { success: false, error: 'Failed to append block to global chain' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      block: finalBlock,
    });
  } catch (error: any) {
    console.error('[API /api/blockchain/append] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to append block' },
      { status: 500 }
    );
  }
}
