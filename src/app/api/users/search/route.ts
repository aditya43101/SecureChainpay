import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export interface PublicUserResult {
  uid: string;
  username: string;
  displayName: string;
  walletAddress: string;
  avatarUrl?: string | null;
  email?: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q')?.trim() || '';
    const currentUid = searchParams.get('currentUid')?.trim() || '';

    if (!rawQuery || rawQuery.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const cleanQuery = rawQuery.startsWith('@') ? rawQuery.substring(1) : rawQuery;
    const queryLower = cleanQuery.toLowerCase();
    const isAddressQuery = cleanQuery.startsWith('0x') && cleanQuery.length >= 6;

    const adminDb = getAdminDb();
    const resultsMap = new Map<string, PublicUserResult>();

    // ─── 1. WALLET ADDRESS LOOKUP ───
    if (isAddressQuery) {
      // Search all users whose wallet address matches or starts with the query
      const usersSnap = await adminDb.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        if (currentUid && userDoc.id === currentUid) continue;

        const walletSnap = await userDoc.ref.collection('wallet').doc('data').get();
        if (walletSnap.exists) {
          const walletData = walletSnap.data();
          const walletAddress = walletData?.address || '';
          if (
            walletAddress.toLowerCase() === queryLower ||
            walletAddress.toLowerCase().includes(queryLower)
          ) {
            const userData = userDoc.data();
            const username = userData?.username || `user_${userDoc.id.substring(0, 6)}`;
            const displayName = userData?.displayName || userData?.name || username;

            resultsMap.set(userDoc.id, {
              uid: userDoc.id,
              username,
              displayName,
              walletAddress,
              avatarUrl: userData?.avatarUrl || null,
              email: userData?.email ? `${userData.email.split('@')[0].substring(0, 3)}***@${userData.email.split('@')[1]}` : null,
            });
          }
        }
      }
    }

    // ─── 2. USERNAME DIRECT LOOKUP (via 'usernames' index) ───
    const exactUnameSnap = await adminDb.collection('usernames').doc(queryLower).get();
    if (exactUnameSnap.exists) {
      const targetUid = exactUnameSnap.data()?.uid;
      if (targetUid && targetUid !== currentUid && !resultsMap.has(targetUid)) {
        const userDoc = await adminDb.collection('users').doc(targetUid).get();
        const walletSnap = await adminDb.collection('users').doc(targetUid).collection('wallet').doc('data').get();

        if (walletSnap.exists) {
          const userData = userDoc.data();
          const walletData = walletSnap.data();
          resultsMap.set(targetUid, {
            uid: targetUid,
            username: userData?.username || queryLower,
            displayName: userData?.displayName || userData?.name || queryLower,
            walletAddress: walletData?.address || '',
            avatarUrl: userData?.avatarUrl || null,
          });
        }
      }
    }

    // ─── 3. USERS COLLECTION PREFIX / CONTAINS SEARCH ───
    if (resultsMap.size < 5) {
      const usersSnap = await adminDb.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        if (currentUid && userDoc.id === currentUid) continue;
        if (resultsMap.has(userDoc.id)) continue;

        const userData = userDoc.data();
        const username = (userData?.username || '').toLowerCase();
        const displayName = (userData?.displayName || userData?.name || '').toLowerCase();
        const email = (userData?.email || '').toLowerCase();

        if (
          username.includes(queryLower) ||
          displayName.includes(queryLower) ||
          email.includes(queryLower)
        ) {
          const walletSnap = await userDoc.ref.collection('wallet').doc('data').get();
          if (walletSnap.exists) {
            const walletData = walletSnap.data();
            const walletAddress = walletData?.address || '';
            if (walletAddress) {
              resultsMap.set(userDoc.id, {
                uid: userDoc.id,
                username: userData?.username || `user_${userDoc.id.substring(0, 6)}`,
                displayName: userData?.displayName || userData?.name || userData?.username || 'SecureChain User',
                walletAddress,
                avatarUrl: userData?.avatarUrl || null,
                email: userData?.email ? `${userData.email.split('@')[0].substring(0, 3)}***@${userData.email.split('@')[1]}` : null,
              });
            }
          }
        }

        if (resultsMap.size >= 10) break;
      }
    }

    const results = Array.from(resultsMap.values());
    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('[API /api/users/search] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Search failed' },
      { status: 500 }
    );
  }
}
