import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';

export const dynamic = 'force-dynamic';

/**
 * GET /api/security/incidents
 * Authenticated endpoint to fetch security incidents and forensic records.
 */
export async function GET(request: Request) {
  try {
    try {
      await requireFirebaseUser(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 20), 100);

    const adminDb = getAdminDb();
    const snap = await adminDb
      .collection('securityIncidents')
      .orderBy('detectedAt', 'desc')
      .limit(limit)
      .get();

    const incidents: any[] = [];
    snap.forEach((doc) => {
      incidents.push(doc.data());
    });

    return NextResponse.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error: any) {
    console.error('[API /api/security/incidents GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch security incidents' },
      { status: 500 }
    );
  }
}
