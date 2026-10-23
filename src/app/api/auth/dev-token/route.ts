import { NextResponse } from 'next/server';
import { auth as adminAuth } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    let uid = 'TS9MJCioBBeuQ5RFHafERm1E6JY2'; // Default test sender UID
    try {
      const body = await request.json();
      if (body?.uid) uid = body.uid;
    } catch {
      // Use default
    }

    const customToken = await adminAuth().createCustomToken(uid);
    return NextResponse.json({ success: true, customToken, uid });
  } catch (error: any) {
    console.error('Error generating dev custom token:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
