import { NextResponse } from 'next/server';
import { SecurityStateService } from '@/lib/security/security-state-service';
import { BlockchainIntegrityMonitor } from '@/lib/security/blockchain-integrity-monitor';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';

export const dynamic = 'force-dynamic';

/**
 * GET /api/security/state
 * Returns the public/safe security state and freeze status.
 */
export async function GET() {
  try {
    const secState = await SecurityStateService.getSecurityState();
    return NextResponse.json({
      success: true,
      state: secState.state,
      isTransactionFrozen: secState.isTransactionFrozen,
      isContractPaused: secState.isContractPaused,
      isEmergencyLockActive: secState.isEmergencyLockActive,
      lastStateChange: secState.lastStateChange,
      lastCheckedAt: secState.lastCheckedAt,
      reason: secState.reason || null,
      activeIncidentId: secState.activeIncidentId || null,
      lastTrustedBlockNumber: secState.lastTrustedBlockNumber ?? null,
    });
  } catch (error: any) {
    console.error('[API /api/security/state GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch security state' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/security/state
 * Authenticated admin endpoint to trigger an incremental integrity scan or administrative reset.
 */
export async function POST(request: Request) {
  try {
    let authUser: any = null;
    try {
      authUser = await requireFirebaseUser(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action = 'scan', targetState, reason } = body;

    if (action === 'scan') {
      const result = await BlockchainIntegrityMonitor.runIncrementalCheck();
      return NextResponse.json({
        success: true,
        action: 'scan',
        result,
      });
    }

    if (action === 'audit') {
      const audit = await BlockchainIntegrityMonitor.runFullChainIntegrityAudit(body.maxBlocks || 500);
      return NextResponse.json({
        success: true,
        action: 'audit',
        audit,
      });
    }

    if (action === 'reset') {
      const resetDoc = await SecurityStateService.resetToHealthy(
        reason || `Admin reset triggered by ${authUser.uid}`
      );
      return NextResponse.json({
        success: true,
        action: 'reset',
        state: resetDoc,
      });
    }

    if (action === 'transition' && targetState) {
      const updatedDoc = await SecurityStateService.transitionState(
        targetState,
        reason || `Admin manual transition by ${authUser.uid}`
      );
      return NextResponse.json({
        success: true,
        action: 'transition',
        state: updatedDoc,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action parameter' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API /api/security/state POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute security action' },
      { status: 500 }
    );
  }
}
