import { NextResponse } from 'next/server';
import { RecoveryController } from '@/lib/recovery/recovery-controller';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recovery/start
 * Server-authorized endpoint to trigger Phase 5 Self-Healing Recovery.
 */
export async function POST(request: Request) {
  try {
    let authUser: any = null;
    try {
      authUser = await requireFirebaseUser(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Authentication required to initiate blockchain recovery' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { incidentId, recoveryVersion = 1 } = body;

    if (!incidentId) {
      return NextResponse.json(
        { success: false, error: 'incidentId is required to start recovery' },
        { status: 400 }
      );
    }

    const report = await RecoveryController.executeRecovery({
      incidentId,
      recoveryVersion: Number(recoveryVersion) || 1,
      initiatedBy: authUser.uid,
    });

    return NextResponse.json({
      success: report.status === 'RECOVERED' || report.status === 'RECOVERY_VERIFIED',
      report,
    });
  } catch (error: any) {
    console.error('[API /api/recovery/start POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start recovery' },
      { status: 500 }
    );
  }
}
