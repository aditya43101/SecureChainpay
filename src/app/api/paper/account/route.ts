import { NextResponse } from 'next/server';
import { paperEngine } from '@/lib/trading/paper-engine';

const DEMO_USER_ID = 'demo-user-id';

export async function GET() {
  try {
    const account = await paperEngine.getOrCreateAccount(DEMO_USER_ID);
    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const res = await paperEngine.resetAccount(DEMO_USER_ID);
    return NextResponse.json({ success: true, message: res?.message });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
