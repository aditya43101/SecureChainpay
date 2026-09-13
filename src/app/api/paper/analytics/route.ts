import { NextResponse } from 'next/server';
import { OutcomeIntelligenceService } from '@/lib/trading/outcome-intelligence';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';

const DEMO_USER_ID = 'demo-user-id';

export async function GET(request: Request) {
  let userId = DEMO_USER_ID;
  try {
    const auth = await requireFirebaseUser(request);
    if (auth && auth.uid) userId = auth.uid;
  } catch {
    // Fallback to demo user
  }

  try {
    const analytics = await OutcomeIntelligenceService.getOutcomeAnalytics(userId);
    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    console.error(`[API /api/paper/analytics] Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch paper trading analytics' },
      { status: 500 }
    );
  }
}
