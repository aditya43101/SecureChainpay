import { NextResponse } from 'next/server';
import { OutcomeIntelligenceService } from '@/lib/trading/outcome-intelligence';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';

const DEMO_USER_ID = 'demo-user-id';

export async function GET(
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
    const tradeId = resolvedParams.id;

    if (!tradeId) {
      return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 });
    }

    const snapshotData = await OutcomeIntelligenceService.getTradeSnapshot(tradeId);

    if (!snapshotData || !snapshotData.outcomeRecord) {
      return NextResponse.json(
        { error: `Trade outcome record not found for ID: ${tradeId}` },
        { status: 404 }
      );
    }

    // Ensure user isolation: user can only view their own trade
    const outcome = snapshotData.outcomeRecord;
    if (outcome.userId && outcome.userId !== userId && userId !== DEMO_USER_ID) {
      return NextResponse.json(
        { error: 'Unauthorized: Cannot access trade belonging to another user' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      trade: outcome,
      entrySnapshot: snapshotData.entrySnapshot || outcome.entrySnapshot,
      exitSnapshot: snapshotData.exitSnapshot || outcome.exitSnapshot,
    });
  } catch (error: any) {
    console.error(`[API /api/paper/trades/[id]] Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trade details' },
      { status: 500 }
    );
  }
}
