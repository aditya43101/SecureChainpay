import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdminUser } from '@/lib/auth/require-admin-user';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';
import { calculateCanonicalBlockHash } from '@/lib/crypto/canonical-hash';

const USD_TO_HSCT = 83.5;

export async function POST(request: Request) {
  try {
    // 1. Enforce Admin Authorization
    let adminUser: any;
    try {
      adminUser = await requireAdminUser(request);
    } catch (authErr: any) {
      await SecurityAuditLogger.log({
        type: 'PRIVILEGE_ESCALATION_ATTEMPT',
        userId: 'UNKNOWN',
        resource: '/api/blockchain/convert-hsct',
        action: 'convertLedger',
        result: 'DENIED',
        severity: 'CRITICAL',
        metadata: { error: authErr.message },
      });
      return NextResponse.json(
        { success: false, error: authErr.message || 'Unauthorized: Admin access required' },
        { status: authErr.status || 403 }
      );
    }

    console.log('[SecureChain: HSCT Convert] Starting administrative ledger conversion...');
    const db = getAdminDb();

    // 1. Fetch Genesis Hash
    const genesisDoc = await db.collection('global_blocks').doc('GENESIS').get();
    if (!genesisDoc.exists) {
      return NextResponse.json({ success: false, error: 'Genesis block not found' }, { status: 400 });
    }
    const genesisHash = genesisDoc.data()?.hash;

    // 2. Fetch and Sort All Blocks
    const blocksSnap = await db.collection('global_blocks').get();
    const blocksList: any[] = [];
    blocksSnap.forEach((doc) => {
      const data = doc.data();
      if (doc.id !== 'GENESIS') {
        blocksList.push({ id: doc.id, ...data });
      }
    });

    // Sort blocks by blockNumber ascending
    blocksList.sort((a, b) => a.blockNumber - b.blockNumber);

    // 3. Recalculate block statistics, amounts, descriptions, and hashes canonically
    let previousHash = genesisHash;
    const blockBatch = db.batch();

    for (const block of blocksList) {
      let amount = Number(block.amount || 0);
      let currency = block.currency || 'USD';
      let description = block.description || '';
      let payload = block.payload || null;

      // Convert USD currency to HSCT
      if (currency === 'USD') {
        amount = amount * USD_TO_HSCT;
        currency = 'HSCT';
      }

      // Convert trade payloads if they store USD amount
      if (payload) {
        if (payload.tradeAsset === 'USD') {
          payload.tradeAsset = 'HSCT';
          if (typeof payload.tradeAmount === 'number') {
            payload.tradeAmount = payload.tradeAmount * USD_TO_HSCT;
          }
        }
      }

      // Reformat description dollar amounts to HSCT
      if (description.includes('$') || description.includes('USD')) {
        description = description
          .replace(/\$([0-9.,]+)/g, (_: string, val: string) => {
            const parsedVal = Number(val.replace(/,/g, ''));
            const convertedVal = parsedVal * USD_TO_HSCT;
            return `${convertedVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT`;
          })
          .replace(/USD/g, 'HSCT');
      }

      // Recompute Canonical Hash
      const newHash = await calculateCanonicalBlockHash({
        blockNumber: block.blockNumber,
        previousHash,
        sender: block.sender,
        receiver: block.receiver,
        amount,
        currency,
        date: block.date,
        type: block.type,
      });

      blockBatch.update(db.collection('global_blocks').doc(block.id), {
        amount,
        currency,
        asset: currency,
        description,
        payload,
        previousHash,
        hash: newHash,
      });

      previousHash = newHash;
    }

    if (blocksList.length > 0) {
      await blockBatch.commit();
    }
    console.log('[SecureChain: HSCT Convert] Global blockchain blocks converted.');

    // 4. Update Chain Meta State
    if (blocksList.length > 0) {
      await db.collection('global_chain_meta').doc('chain_state').update({
        lastBlockHash: previousHash,
      });
    }

    // 5. Update User Balances & User Transactions
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;

      const walletRef = db.collection('users').doc(uid).collection('wallet').doc('data');
      const walletSnap = await walletRef.get();
      if (walletSnap.exists) {
        const walletData = walletSnap.data();
        if (walletData?.balances && typeof walletData.balances.USD === 'number') {
          const currentUsd = walletData.balances.USD;
          if (currentUsd < 50000) {
            const hsctBalance = currentUsd * USD_TO_HSCT;
            await walletRef.update({
              'balances.USD': hsctBalance,
            });
            console.log(`[SecureChain: HSCT Convert] Converted wallet balances for user ${uid}.`);
          }
        }
      }

      // Convert user transactions
      const txsSnap = await db.collection('users').doc(uid).collection('transactions').get();
      const txBatch = db.batch();
      let hasTxUpdates = false;

      txsSnap.forEach((txDoc) => {
        const txData = txDoc.data();
        let amount = Number(txData.amount || 0);
        let currency = txData.currency || 'USD';
        let description = txData.description || '';
        let payload = txData.payload || null;
        let needsUpdate = false;

        if (currency === 'USD') {
          amount = amount * USD_TO_HSCT;
          currency = 'HSCT';
          needsUpdate = true;
        }

        if (payload) {
          if (payload.tradeAsset === 'USD') {
            payload.tradeAsset = 'HSCT';
            if (typeof payload.tradeAmount === 'number') {
              payload.tradeAmount = payload.tradeAmount * USD_TO_HSCT;
            }
            needsUpdate = true;
          }
        }

        if (description.includes('$') || description.includes('USD')) {
          description = description
            .replace(/\$([0-9.,]+)/g, (_: string, val: string) => {
              const parsedVal = Number(val.replace(/,/g, ''));
              const convertedVal = parsedVal * USD_TO_HSCT;
              return `${convertedVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT`;
            })
            .replace(/USD/g, 'HSCT');
          needsUpdate = true;
        }

        if (needsUpdate) {
          txBatch.update(db.collection('users').doc(uid).collection('transactions').doc(txDoc.id), {
            amount,
            currency,
            asset: currency,
            description,
            payload,
          });
          hasTxUpdates = true;
        }
      });

      if (hasTxUpdates) {
        await txBatch.commit();
      }
    }

    await SecurityAuditLogger.log({
      type: 'ADMIN_LEDGER_CONVERSION',
      userId: adminUser.uid,
      resource: 'global_blocks',
      action: 'convertHSCT',
      result: 'COMMITTED',
      severity: 'HIGH',
      metadata: { initiatedBy: adminUser.uid },
    });

    return NextResponse.json({ success: true, message: 'All transactions converted to HSCT successfully' });
  } catch (error: any) {
    console.error('[SecureChain: HSCT Convert] Failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
