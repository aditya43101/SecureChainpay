import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireFirebaseUser, FirebaseAuthenticationError } from '@/lib/auth/require-firebase-user';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';

export const dynamic = 'force-dynamic';

export interface FriendRecord {
  friendUid: string;
  username: string;
  displayName: string;
  walletAddress: string;
  email?: string | null;
  avatarUrl?: string | null;
  addedAt: string;
  isFavorite?: boolean;
}

// GET: Fetch all friends for current user
export async function GET(request: NextRequest) {
  try {
    let authUser: any;
    try {
      authUser = await requireFirebaseUser(request);
    } catch (err) {
      if (err instanceof FirebaseAuthenticationError) {
        return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
      }
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const snap = await adminDb
      .collection('users')
      .doc(authUser.uid)
      .collection('friends')
      .orderBy('addedAt', 'desc')
      .get();

    const friends: FriendRecord[] = [];
    snap.forEach((doc) => {
      friends.push(doc.data() as FriendRecord);
    });

    return NextResponse.json({ success: true, friends, count: friends.length });
  } catch (err: any) {
    console.error('[API /api/friends GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch friends' }, { status: 500 });
  }
}

// POST: Add a new friend by username, walletAddress, or UID
export async function POST(request: NextRequest) {
  try {
    let authUser: any;
    try {
      authUser = await requireFirebaseUser(request);
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const targetQuery = (body.query || body.username || body.walletAddress || body.friendUid || '').trim();

    if (!targetQuery) {
      return NextResponse.json({ success: false, error: 'Friend identifier (username or address) is required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    let targetUid: string | null = null;
    let targetUserData: any = null;
    let targetWalletAddress = '';

    const cleanQuery = targetQuery.startsWith('@') ? targetQuery.substring(1) : targetQuery;
    const queryLower = cleanQuery.toLowerCase();

    // 1. Direct UID match
    if (body.friendUid) {
      const uSnap = await adminDb.collection('users').doc(body.friendUid).get();
      if (uSnap.exists) {
        targetUid = uSnap.id;
        targetUserData = uSnap.data();
      }
    }

    // 2. Username index lookup
    if (!targetUid) {
      const unameSnap = await adminDb.collection('usernames').doc(queryLower).get();
      if (unameSnap.exists && unameSnap.data()?.uid) {
        targetUid = unameSnap.data()!.uid;
        const uSnap = await adminDb.collection('users').doc(targetUid!).get();
        if (uSnap.exists) targetUserData = uSnap.data();
      }
    }

    // 3. Scan users collection by username or wallet address
    if (!targetUid) {
      const usersSnap = await adminDb.collection('users').get();
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data();
        if (uData.username && uData.username.toLowerCase() === queryLower) {
          targetUid = uDoc.id;
          targetUserData = uData;
          break;
        }

        const wSnap = await uDoc.ref.collection('wallet').doc('data').get();
        if (wSnap.exists && wSnap.data()?.address?.toLowerCase() === queryLower) {
          targetUid = uDoc.id;
          targetUserData = uData;
          targetWalletAddress = wSnap.data()?.address || '';
          break;
        }
      }
    }

    if (!targetUid || !targetUserData) {
      return NextResponse.json({ success: false, error: `User "${targetQuery}" not found on SecureChain Pay.` }, { status: 404 });
    }

    if (targetUid === authUser.uid) {
      return NextResponse.json({ success: false, error: 'You cannot add yourself as a friend.' }, { status: 400 });
    }

    // Fetch target user's wallet address if not already fetched
    if (!targetWalletAddress) {
      const walletSnap = await adminDb.collection('users').doc(targetUid).collection('wallet').doc('data').get();
      targetWalletAddress = walletSnap.data()?.address || '';
    }

    const friendRecord: FriendRecord = {
      friendUid: targetUid,
      username: targetUserData.username || `user_${targetUid.substring(0, 6)}`,
      displayName: targetUserData.displayName || targetUserData.name || targetUserData.username || 'Friend',
      walletAddress: targetWalletAddress,
      email: targetUserData.email || null,
      avatarUrl: targetUserData.avatarUrl || null,
      addedAt: new Date().toISOString(),
      isFavorite: Boolean(body.isFavorite),
    };

    // Save to user's friends subcollection
    await adminDb
      .collection('users')
      .doc(authUser.uid)
      .collection('friends')
      .doc(targetUid)
      .set(friendRecord, { merge: true });

    await SecurityAuditLogger.log({
      type: 'FRIEND_ADDED',
      userId: authUser.uid,
      resource: '/api/friends',
      action: 'addFriend',
      result: 'ALLOWED',
      severity: 'LOW',
      metadata: { friendUid: targetUid, friendUsername: friendRecord.username },
    }).catch(() => {});

    return NextResponse.json({ success: true, friend: friendRecord });
  } catch (err: any) {
    console.error('[API /api/friends POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to add friend' }, { status: 500 });
  }
}

// DELETE: Remove a friend
export async function DELETE(request: NextRequest) {
  try {
    let authUser: any;
    try {
      authUser = await requireFirebaseUser(request);
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const friendUid = searchParams.get('friendUid');

    if (!friendUid) {
      return NextResponse.json({ success: false, error: 'friendUid parameter is required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    await adminDb
      .collection('users')
      .doc(authUser.uid)
      .collection('friends')
      .doc(friendUid)
      .delete();

    return NextResponse.json({ success: true, message: 'Friend removed successfully' });
  } catch (err: any) {
    console.error('[API /api/friends DELETE] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to delete friend' }, { status: 500 });
  }
}
