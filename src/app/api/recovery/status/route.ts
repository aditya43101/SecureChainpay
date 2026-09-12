import { NextResponse } from 'next/server';
import { RecoveryLockService } from '@/lib/recovery/recovery-lock-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recovery/status
 * Queries the current recovery job stage and progress.
 */
export async function GET() {
  try {
    const job = await RecoveryLockService.getActiveJob();

    if (!job) {
      return NextResponse.json({
        success: true,
        active: false,
        status: 'IDLE',
        stage: 'IDLE',
        progressPercent: 0,
      });
    }

    const stageWeights: Record<string, number> = {
      RECOVERY_REQUIRED: 5,
      RECOVERY_INITIALIZING: 10,
      SOURCE_VALIDATION: 20,
      RECONSTRUCTION: 40,
      BLOCK_VALIDATION: 55,
      CHAIN_ROOT_VALIDATION: 65,
      ON_CHAIN_ANCHOR_VALIDATION: 75,
      DATABASE_RECONCILIATION: 85,
      POST_RECOVERY_AUDIT: 95,
      RECOVERY_VERIFIED: 98,
      READY_TO_RESUME: 99,
      RESUMING: 99,
      RECOVERED: 100,
      RECOVERY_FAILED: 0,
    };

    const progressPercent = stageWeights[job.currentStage] ?? 50;

    return NextResponse.json({
      success: true,
      active: job.status === 'ACTIVE',
      job,
      stage: job.currentStage,
      status: job.status,
      progressPercent,
      error: job.error || null,
    });
  } catch (error: any) {
    console.error('[API /api/recovery/status GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch recovery status' },
      { status: 500 }
    );
  }
}
