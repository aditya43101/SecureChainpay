import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminDb } from '@/lib/firebase/admin';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Production Safeguard
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv === 'production') {
    return NextResponse.json(
      { success: false, error: 'Development reset blocked in production environment.' },
      { status: 403 }
    );
  }

  try {
    // 1. Reset PostgreSQL Development Records
    await db.aIMessage.deleteMany({});
    await db.aIConversation.deleteMany({});
    await db.backtestTrade.deleteMany({});
    await db.backtestRun.deleteMany({});
    await db.paperPosition.deleteMany({});
    await db.paperOrder.deleteMany({});
    await db.paperAccount.deleteMany({});
    await db.tradingJournalEntry.deleteMany({});
    await db.tradeAttribution.deleteMany({});
    await db.feedbackMemory.deleteMany({});
    await db.learningEvent.deleteMany({});
    await db.tradeApproval.deleteMany({});
    await db.executionOrder.deleteMany({});
    await db.safetyEvent.deleteMany({});
    await db.dailyRiskState.deleteMany({});
    await db.autoTradingSettings.deleteMany({});
    await db.modelPrediction.deleteMany({});
    await db.tradingRecommendation.deleteMany({});
    await db.userRiskSettings.deleteMany({});
    await db.chatMessage.deleteMany({});
    await db.auditLog.deleteMany({});
    await db.scheduledPayment.deleteMany({});
    await db.spendingGoal.deleteMany({});
    await db.favouriteContact.deleteMany({});
    await db.report.deleteMany({});
    await db.paymentRequest.deleteMany({});
    await db.settlement.deleteMany({});
    await db.merchant.deleteMany({});
    await db.kycDocument.deleteMany({});
    await db.linkedAccount.deleteMany({});
    await db.transaction.deleteMany({});
    await db.wallet.deleteMany({});
    await db.session.deleteMany({});
    await db.device.deleteMany({});
    await db.loginHistory.deleteMany({});
    await db.notification.deleteMany({});
    await db.user.deleteMany({});

    // 2. Reset Firestore Development Collections
    try {
      const adminDb = getAdminDb();

      const wipeCollection = async (collectionRef: any) => {
        const docs = await collectionRef.listDocuments();
        for (const docRef of docs) {
          const subcolls = await docRef.listCollections();
          for (const subcol of subcolls) {
            await wipeCollection(subcol);
          }
          await docRef.delete();
        }
      };

      const collectionsToClear = [
        'global_blocks',
        'global_chain_meta',
        'users',
        'usernames',
        'wallets',
        'transactions',
        'payment_requests',
        'merchants',
        'settlements'
      ];

      for (const collName of collectionsToClear) {
        const collRef = adminDb.collection(collName);
        try {
          await wipeCollection(collRef);
        } catch (err: any) {
          console.warn(`⚠️ [API reset] Warning clearing ${collName}:`, err?.message);
        }
      }

      // Re-seed Global Genesis Block (#0)
      const genesisHash = crypto
        .createHash('sha256')
        .update('genesis:securechainpay:global:v1')
        .digest('hex');

      const genesisTimeISO = '1970-01-01T00:00:00.000Z';
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

      const chainState = {
        lastBlockNumber: 0,
        lastBlockHash: genesisHash,
        genesisHash: genesisHash,
        totalBlocks: 1,
        lastUpdatedAt: new Date().toISOString(),
      };

      await adminDb.collection('global_blocks').doc('GENESIS').set(genesisBlock);
      await adminDb.collection('global_chain_meta').doc('chain_state').set(chainState);
    } catch (fsErr: any) {
      console.warn('[API /api/dev/reset] Firestore reset warning:', fsErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Development data reset complete. Application state is clean.',
      stateDefaults: {
        autoTradingEnabled: false,
        allTimeMode: false,
        tradingStatus: 'DISABLED'
      }
    });
  } catch (error: any) {
    console.error('[API /api/dev/reset] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to perform development reset' },
      { status: 500 }
    );
  }
}
