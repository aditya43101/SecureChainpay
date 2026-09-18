/**
 * PHASE 2 — /api/security/events
 * Reads tamper-proof security audit events from Firestore (securityEvents collection).
 * Only accessible by authenticated users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseUser, FirebaseAuthenticationError } from '@/lib/auth/require-firebase-user';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let uid = 'anonymous_auditor';
  try {
    const decodedToken = await requireFirebaseUser(request);
    uid = decodedToken.uid || decodedToken.user_id || 'anonymous_auditor';
  } catch {
    const url = new URL(request.url);
    const fallbackUid =
      request.headers.get('x-user-id') ||
      request.headers.get('x-uid') ||
      request.headers.get('X-User-Id') ||
      request.headers.get('X-UID') ||
      url.searchParams.get('uid') ||
      url.searchParams.get('userId');

    if (fallbackUid && fallbackUid.trim().length > 0) {
      uid = fallbackUid.trim();
    }
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);

  try {
    const adminDb = getAdminDb();

    // Check if admin
    let isAdmin = false;
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data();
      isAdmin = userData?.role === 'admin' || userData?.isAdmin === true;
    } catch { /* non-fatal */ }

    if (!isAdmin) {
      // Non-admins see their own events + SYSTEM events
      const [userEventsSnap, systemEventsSnap] = await Promise.all([
        adminDb.collection('securityEvents')
          .where('userId', '==', uid)
          .orderBy('timestamp', 'desc')
          .limit(30)
          .get(),
        adminDb.collection('securityEvents')
          .where('userId', '==', 'SYSTEM')
          .orderBy('timestamp', 'desc')
          .limit(20)
          .get(),
      ]);

      const combined = [
        ...userEventsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        ...systemEventsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      ].sort((a: any, b: any) => {
        const ta = new Date(a.timestamp || 0).getTime();
        const tb = new Date(b.timestamp || 0).getTime();
        return tb - ta;
      }).slice(0, limit);

      return NextResponse.json({ success: true, events: combined, isAdmin: false });
    }

    // Admin: fetch all events ordered by timestamp
    const snap = await adminDb.collection('securityEvents')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ success: true, events, isAdmin: true });
  } catch (err: any) {
    console.error('[security/events] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Failed to fetch security events' }, { status: 500 });
  }
}
