import { NextResponse } from 'next/server';
import { findOrCreateUser, createSessionToken } from '@/lib/serverStore';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const authHeader = request.headers.get('authorization');
    const idToken = authHeader?.replace('Bearer ', '') || body.idToken;

    const user = findOrCreateUser({
      firebaseUid: body.firebaseUid,
      email: body.email,
      name: body.name,
      photoUrl: body.photoUrl,
    });

    const token = createSessionToken(user);

    return NextResponse.json({
      success: true,
      message: 'User synchronized with decentralized identity',
      data: {
        user,
        token,
        isNewUser: !user.isInitialized,
      },
    });
  } catch (error: any) {
    console.error('API /api/auth/sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync user' },
      { status: 500 }
    );
  }
}
