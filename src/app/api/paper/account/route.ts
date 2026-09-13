import { NextResponse } from 'next/server';
import { paperEngine } from '@/lib/trading/paper-engine';
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
    const account = await paperEngine.getOrCreateAccount(userId);
    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let userId = DEMO_USER_ID;
  try {
    const auth = await requireFirebaseUser(request);
    if (auth && auth.uid) userId = auth.uid;
  } catch {
    // Fallback to demo user
  }

  try {
    const res = await paperEngine.resetAccount(userId);
    return NextResponse.json({ success: true, message: res?.message });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
