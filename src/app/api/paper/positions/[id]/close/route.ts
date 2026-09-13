import { NextResponse } from 'next/server';
import { paperEngine } from '@/lib/trading/paper-engine';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';

const DEMO_USER_ID = 'demo-user-id';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId = DEMO_USER_ID;
  try {
    const auth = await requireFirebaseUser(request);
    if (auth && auth.uid) userId = auth.uid;
  } catch {
    // Fallback to demo user
  }

  try {
    const resolvedParams = await params;
    const positionId = resolvedParams.id;

    if (!positionId) {
      return NextResponse.json({ error: 'Position ID is required' }, { status: 400 });
    }

    const outcomeRecord = await paperEngine.closePosition(userId, positionId, 'MANUAL_PAPER_CLOSE');

    return NextResponse.json({
      success: true,
      message: `Position closed successfully. Outcome: ${outcomeRecord.outcome}`,
      outcome: outcomeRecord,
    });
  } catch (error: any) {
    console.error(`[API /api/paper/positions/[id]/close] Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to close position' },
      { status: 400 }
    );
  }
}
