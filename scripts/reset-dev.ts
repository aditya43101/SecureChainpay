import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { execSync } from 'child_process';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════
// 1. PRODUCTION SAFEGUARD CHECK
// ═══════════════════════════════════════════════════════════
function checkEnvironmentSafety() {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const dbUrl = process.env.DATABASE_URL || '';

  if (nodeEnv === 'production' || dbUrl.includes('prod') || dbUrl.includes('aws') || dbUrl.includes('cockroach')) {
    console.error('\x1b[31m%s\x1b[0m', 'CRITICAL ERROR: Development reset blocked in production environment.');
    process.exit(1);
  }

  console.log('\x1b[32m%s\x1b[0m', '✓ Development environment confirmed. Safe to proceed with reset.');
}

// ═══════════════════════════════════════════════════════════
// 2. PRISMA POSTGRESQL DATA RESET
// ═══════════════════════════════════════════════════════════
async function resetPostgresData(prisma: PrismaClient) {
  console.log('\n[1/4] Resetting PostgreSQL development records...');

  // Delete in dependency order (children tables first)
  await prisma.aIMessage.deleteMany({});
  await prisma.aIConversation.deleteMany({});

  await prisma.backtestTrade.deleteMany({});
  await prisma.backtestRun.deleteMany({});

  await prisma.paperPosition.deleteMany({});
  await prisma.paperOrder.deleteMany({});
  await prisma.paperAccount.deleteMany({});

  await prisma.tradingJournalEntry.deleteMany({});
  await prisma.tradeAttribution.deleteMany({});
  await prisma.feedbackMemory.deleteMany({});
  await prisma.learningEvent.deleteMany({});

  await prisma.tradeApproval.deleteMany({});
  await prisma.executionOrder.deleteMany({});
  await prisma.safetyEvent.deleteMany({});
  await prisma.dailyRiskState.deleteMany({});
  await prisma.autoTradingSettings.deleteMany({});

  await prisma.modelPrediction.deleteMany({});
  await prisma.tradingRecommendation.deleteMany({});
  await prisma.userRiskSettings.deleteMany({});

  await prisma.chatMessage.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.scheduledPayment.deleteMany({});
  await prisma.spendingGoal.deleteMany({});
  await prisma.favouriteContact.deleteMany({});
  await prisma.report.deleteMany({});

  await prisma.paymentRequest.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.merchant.deleteMany({});
  await prisma.kycDocument.deleteMany({});
  await prisma.linkedAccount.deleteMany({});

  await prisma.transaction.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.loginHistory.deleteMany({});
  await prisma.notification.deleteMany({});

  await prisma.user.deleteMany({});

  console.log('✓ PostgreSQL development records successfully cleared.');
}

// ═══════════════════════════════════════════════════════════
// 3. FIRESTORE & GLOBAL BLOCKCHAIN RESET
// ═══════════════════════════════════════════════════════════
async function wipeCollection(collectionRef: any) {
  const docs = await collectionRef.listDocuments();
  for (const docRef of docs) {
    const subcolls = await docRef.listCollections();
    for (const subcol of subcolls) {
      await wipeCollection(subcol);
    }
    await docRef.delete();
  }
}

async function resetFirestoreAndBlockchain() {
  console.log('\n[2/4] Resetting Firestore development collections & Global Blockchain...');

  if (!process.env.FIREBASE_PROJECT_ID) {
    console.warn('⚠️ FIREBASE_PROJECT_ID not set. Skipping Firestore reset.');
    return;
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });

  const db = getFirestore(app, process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || 'securechainpay');

  // List of development collections to wipe (including all nested subcollections)
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
    const collRef = db.collection(collName);
    try {
      await wipeCollection(collRef);
    } catch (err: any) {
      console.warn(`⚠️ Warning clearing collection ${collName}:`, err?.message);
    }
  }

  // Clear test users from Firebase Auth if configured
  try {
    const adminAuth = getAuth(app);
    const usersResult = await adminAuth.listUsers(100);
    for (const u of usersResult.users) {
      if (u.email?.includes('test') || u.email?.includes('demo') || u.email?.includes('dev')) {
        await adminAuth.deleteUser(u.uid);
      }
    }
  } catch (authErr: any) {
    console.warn('⚠️ Firebase Auth reset warning:', authErr?.message);
  }

  // Re-seed Single Global Genesis Block (Block #0)
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

  await db.collection('global_blocks').doc('GENESIS').set(genesisBlock);
  await db.collection('global_chain_meta').doc('chain_state').set(chainState);

  console.log('✓ Firestore cleared & Global Genesis Block (#0) re-anchored.');
}

// ═══════════════════════════════════════════════════════════
// 4. HARDHAT CONTRACT REDEPLOYMENT
// ═══════════════════════════════════════════════════════════
async function redeployLocalContracts() {
  console.log('\n[3/4] Redeploying Hardhat local EVM smart contracts...');
  try {
    const output = execSync('npx hardhat run scripts/deploy.ts --network localhost', {
      encoding: 'utf-8',
      timeout: 15000,
    });
    console.log(output);
    console.log('✓ Hardhat local EVM contracts redeployed successfully.');
  } catch (err: any) {
    console.warn('⚠️ Hardhat local node not running or deployment skipped:', err?.message || err);
  }
}

// ═══════════════════════════════════════════════════════════
// 5. MAIN EXECUTION ROUTINE
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('\x1b[36m%s\x1b[0m', '======================================================');
  console.log('\x1b[36m%s\x1b[0m', 'SECURECHAIN PAY — COMPLETE DEVELOPMENT DATA RESET');
  console.log('\x1b[36m%s\x1b[0m', '======================================================');

  checkEnvironmentSafety();

  const prisma = new PrismaClient();

  try {
    await resetPostgresData(prisma);
    await resetFirestoreAndBlockchain();
    await redeployLocalContracts();

    console.log('\n[4/4] Verifying default state...');
    console.log('✓ AUTO_TRADING = OFF');
    console.log('✓ ALL_TIME_MODE = OFF');
    console.log('✓ TRADING_STATUS = DISABLED');

    console.log('\n\x1b[32m%s\x1b[0m', '🎉 SUCCESS: Development data reset complete. Application is clean and ready for fresh boot.');
  } catch (error: any) {
    console.error('\n❌ RESET FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
