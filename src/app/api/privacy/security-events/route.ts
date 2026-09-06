/**
 * SecureChain Pay — Security Events API (Task 10)
 * Returns privacy incidents and AI access events for admin view.
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrivacyIncidentDetector } from '@/lib/privacy/privacy-incident-detector';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type'); // incident type filter

    const [incidents, accessEvents, aiRecords] = await Promise.all([
      db.privacyIncident.findMany({
        where: type ? { incidentType: type } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }).catch(() => []),
      db.dataAccessEvent.findMany({
        where: { authorizationResult: 'DENIED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).catch(() => []),
      db.aIDataAccessRecord.findMany({
        where: { resultType: 'BLOCKED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).catch(() => []),
    ]);

    return NextResponse.json({
      incidents,
      deniedAccesses: accessEvents,
      blockedAIRequests: aiRecords,
    });
  } catch (err) {
    console.error('[Privacy API] Security events error:', err);
    return NextResponse.json({ error: 'Security events unavailable.' }, { status: 500 });
  }
}
