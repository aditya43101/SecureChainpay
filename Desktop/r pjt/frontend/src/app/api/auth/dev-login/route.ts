import { NextResponse } from 'next/server';
import { getUsers, findOrCreateUser, createSessionToken } from '@/lib/serverStore';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const users = getUsers();
    let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      user = findOrCreateUser({
        email,
        name: email.split('@')[0],
      });
    }

    const token = createSessionToken(user);

    return NextResponse.json({
      success: true,
      message: 'Authenticated successfully',
      data: {
        user,
        token,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
