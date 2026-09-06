import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import crypto from 'crypto';

const USD_TO_HSCT = 83.5;

function nodeGenerateHash(message: string): string {
  const hash = crypto.createHash('sha256').update(message).digest('hex');
  return '0x' + hash;
}

export async function POST() {
  try {
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

    // 3. Recalculate block statistics, amounts, descriptions, and hashes
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

      // Recompute Hash
      const hashString = `${previousHash}${block.blockNumber}${block.sender}${block.receiver}${amount}${block.date}${block.type}`;
      const newHash = nodeGenerateHash(hashString);

      blockBatch.update(db.collection('global_blocks').doc(block.id), {
        amount,
        currency,
        asset: currency,
        description,
        payload,
        previousHash,
        hash: newHash
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
        lastBlockHash: previousHash
      });
    }

    // 5. Update User Balances & User Transactions
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;

      // Update balances located in users/{uid}/wallet/data
      const walletRef = db.collection('users').doc(uid).collection('wallet').doc('data');
      const walletSnap = await walletRef.get();
      if (walletSnap.exists) {
        const walletData = walletSnap.data();
        if (walletData?.balances && typeof walletData.balances.USD === 'number') {
          const currentUsd = walletData.balances.USD;
          
          // We only scale if the value is reasonably small (e.g. less than 100,000 USD/HSCT)
          // or we can detect if it hasn't been converted yet to avoid double conversion.
          // Since the user balance starts at 300 USD (which becomes 25050 HSCT),
          // let's do a safe threshold check: if currentUsd < 50000 (pre-conversion USD), convert it!
          if (currentUsd < 50000) {
            const hsctBalance = currentUsd * USD_TO_HSCT;
            await walletRef.update({
              'balances.USD': hsctBalance
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
            payload
          });
          hasTxUpdates = true;
        }
      });

      if (hasTxUpdates) {
        await txBatch.commit();
      }
    }

    console.log('[SecureChain: HSCT Convert] User transactions and balances converted.');

    return NextResponse.json({ success: true, message: 'All transactions converted to HSCT successfully' });
  } catch (error: any) {
    console.error('[SecureChain: HSCT Convert] Failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
