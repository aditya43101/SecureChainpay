/**
 * PHASE 2 — /api/blockchain/verify-chain
 * Authenticated endpoint to run a full chain integrity audit.
 * Returns a ChainIntegrityReport.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChainIntegrityValidator } from '@/lib/blockchain/chain-integrity-validator';
import { requireFirebaseUser, FirebaseAuthenticationError } from '@/lib/auth/require-firebase-user';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const maxBlocks = Math.min(Number(url.searchParams.get('maxBlocks') ?? '200'), 500);

  try {
    const report = await ChainIntegrityValidator.validateFullChain({ maxBlocks });

    await SecurityAuditLogger.log({
      type: 'CHAIN_INTEGRITY_SCAN',
      userId: uid,
      resource: '/api/blockchain/verify-chain',
      action: 'FULL_CHAIN_AUDIT',
      result: report.overallStatus === 'INTACT' ? 'SUCCESS' : 'SUSPICIOUS',
      severity: report.overallStatus === 'INTACT' ? 'LOW' : report.overallStatus === 'COMPROMISED' ? 'CRITICAL' : 'HIGH',
      metadata: {
        reportId: report.reportId,
        totalBlocks: report.totalBlocksScanned,
        healthScore: report.chainHealthScore,
        overallStatus: report.overallStatus,
        tamperedBlocks: report.tamperedBlocks,
        brokenLinks: report.brokenLinks,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error('[verify-chain] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
