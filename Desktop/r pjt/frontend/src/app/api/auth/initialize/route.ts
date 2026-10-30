import { NextResponse } from 'next/server';
import { parseSessionToken, initializeUserPassport, createSessionToken } from '@/lib/serverStore';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const currentUser = parseSessionToken(token);

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const updatedUser = initializeUserPassport(currentUser.id);
    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'Failed to initialize vehicle passport profile' }, { status: 500 });
    }

    const updatedToken = createSessionToken(updatedUser);

    return NextResponse.json({
      success: true,
      message: 'Vehicle Passport initialized successfully!',
      data: {
        user: updatedUser,
        token: updatedToken,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
