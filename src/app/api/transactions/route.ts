import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryUid = searchParams.get('uid') || request.headers.get('x-user-id');
    const queryAddress = searchParams.get('address');

    if (!queryUid && !queryAddress) {
      return NextResponse.json({ success: false, error: 'User ID or wallet address is required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    let targetUid = queryUid || '';
    let targetAddress = (queryAddress || '').toLowerCase().trim();

    // 1. Resolve UID or Address if either is missing
    if (targetUid && !targetAddress) {
      const userWalletSnap = await adminDb.collection('users').doc(targetUid).collection('wallet').doc('data').get();
      if (userWalletSnap.exists) {
        targetAddress = (userWalletSnap.data()?.address || '').toLowerCase().trim();
      }
      if (!targetAddress) {
        const userDoc = await adminDb.collection('users').doc(targetUid).get();
        if (userDoc.exists) {
          const uData = userDoc.data();
          targetAddress = (uData?.walletAddress || uData?.address || '').toLowerCase().trim();
        }
      }
    } else if (!targetUid && targetAddress) {
      const usersSnap = await adminDb.collection('users').get();
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data();
        const docWallet = (uData?.walletAddress || uData?.address || '').toLowerCase().trim();
        if (docWallet === targetAddress) {
          targetUid = uDoc.id;
          break;
        }
        const wSnap = await uDoc.ref.collection('wallet').doc('data').get();
        if (wSnap.exists && (wSnap.data()?.address || '').toLowerCase().trim() === targetAddress) {
          targetUid = uDoc.id;
          break;
        }
      }
    }

    if (!targetUid) {
      return NextResponse.json({ success: true, transactions: [], count: 0 });
    }

    // 2. Fetch User's Existing Subcollection Transactions
    const userTxRef = adminDb.collection('users').doc(targetUid).collection('transactions');
    const userTxSnap = await userTxRef.get();
    const existingTxs: any[] = [];
    const seenIds = new Set<string>();

    userTxSnap.forEach((doc) => {
      const txData = doc.data();
      const txId = txData.applicationTransactionId || txData.id || doc.id;
      seenIds.add(txId);
      if (txData.id) seenIds.add(txData.id);
      if (txData.applicationTransactionId) seenIds.add(txData.applicationTransactionId);
      existingTxs.push({
        ...txData,
        id: txId,
        applicationTransactionId: txData.applicationTransactionId || txId,
      });
    });

    // 3. Scan Global Blocks for Received Payments (e.g., from QR Code or direct transfers)
    if (targetAddress || targetUid) {
      try {
        const globalBlocksSnap = await adminDb.collection('global_blocks').get();
        for (const bDoc of globalBlocksSnap.docs) {
          const bData = bDoc.data();
          const bId = bData.applicationTransactionId || bData.id || bDoc.id;

          const isReceiverByAddress = targetAddress && bData.receiver && bData.receiver.toLowerCase().trim() === targetAddress;
          const isReceiverByUid = bData.payload?.receiverUid === targetUid;

          if ((isReceiverByAddress || isReceiverByUid) && !seenIds.has(bId)) {
            // This is an incoming payment sent to this user!
            const currency = (bData.currency || bData.asset || 'HSCT').toUpperCase();
            const amount = Number(bData.amount) || 0;
            const creditTx = {
              ...bData,
              id: bId,
              applicationTransactionId: bId,
              userId: targetUid,
              type: 'credit',
              status: bData.status || 'CONFIRMED',
              description: bData.description?.includes('Received') ? bData.description : `Received ${amount.toLocaleString()} ${currency}`,
              date: bData.date || bData.createdAt || new Date().toISOString(),
              confirmedAt: bData.confirmedAt || bData.date || new Date().toISOString(),
            };

            // Backfill into user's transactions subcollection asynchronously
            userTxRef.doc(bId).set(creditTx, { merge: true }).catch((err) => {
              console.warn('[API /api/transactions] Error backfilling credit tx:', err);
            });

            // Ensure receiver's wallet data balance is updated if not already credited
            const receiverWalletRef = adminDb.collection('users').doc(targetUid).collection('wallet').doc('data');
            const rWalletSnap = await receiverWalletRef.get();
            if (rWalletSnap.exists) {
              const currentBalances = rWalletSnap.data()?.balances || { HSCT: 0, BTC: 0, ETH: 0 };
              const updatedBalances = {
                ...currentBalances,
                [currency]: (Number(currentBalances[currency]) || 0) + amount,
                lifetimeDeposited: (Number(currentBalances.lifetimeDeposited) || 0) + (currency === 'HSCT' ? amount : 0),
              };
              await receiverWalletRef.set({ balances: updatedBalances }, { merge: true }).catch(() => {});
            }

            seenIds.add(bId);
            existingTxs.push(creditTx);
          }
        }
      } catch (globalErr) {
        console.warn('[API /api/transactions] Error scanning global blocks:', globalErr);
      }
    }

    // 4. Sort Descending by Date / Block Number
    existingTxs.sort((a, b) => {
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.blockNumber || 0) - (a.blockNumber || 0);
    });

    return NextResponse.json({
      success: true,
      transactions: existingTxs,
      count: existingTxs.length,
    });
  } catch (error: any) {
    console.error('[API /api/transactions] Exception:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
