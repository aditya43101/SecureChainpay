import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let authUser: any;
    try {
      authUser = await requireFirebaseUser(request);
    } catch (authErr: any) {
      await SecurityAuditLogger.log({
        type: 'AUTH_FAILURE',
        userId: 'ANONYMOUS',
        resource: '/api/blockchain/append',
        action: 'appendBlock',
        result: 'DENIED',
        severity: 'HIGH',
        metadata: { error: authErr.message },
      });
      return NextResponse.json(
        { success: false, error: authErr.message || 'Authentication required' },
        { status: 401 }
      );
    }

    // Direct block appending from client is deprecated in Phase 1; all writes must use /api/transactions/execute
    await SecurityAuditLogger.log({
      type: 'UNAUTHORIZED_MUTATION_ATTEMPT',
      userId: authUser.uid,
      resource: 'global_blocks',
      action: 'directBlockAppend',
      result: 'DENIED',
      severity: 'CRITICAL',
      metadata: { reason: 'Direct client block appending is prohibited. Use /api/transactions/execute.' },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Direct block appending is deprecated and prohibited. Use /api/transactions/execute or /api/wallet/transfer.',
      },
      { status: 403 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to append block' },
      { status: 500 }
    );
  }
}
