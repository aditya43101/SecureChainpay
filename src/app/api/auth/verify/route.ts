import { NextResponse } from 'next/server';
import { auth as adminAuth } from '@/lib/firebase/admin';
import { db as prisma } from '@/lib/db';
import { generateTokens } from '@/lib/auth/jwt';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID Token' }, { status: 400 });
    }

    // 1. Verify Firebase ID Token
    let decodedToken;
    try {
      decodedToken = await adminAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Firebase Token Verification Error:', error);
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const phoneNumber = decodedToken.phone_number;
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number missing from authentication' }, { status: 400 });
    }

    // 2. Find or Create User in PostgreSQL
    let user = await prisma.user.findUnique({
      where: { phone: phoneNumber }
    });

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          phone: phoneNumber,
          firstName: 'New',
          lastName: 'User',
          role: 'USER',
        }
      });
      console.log(`New user created: ${user.id} for phone ${phoneNumber}`);
    }

    // Wallet creation belongs to the verified Firebase/Firestore wallet flow.

    // 3. Generate JWT Tokens
    const { accessToken, refreshToken } = generateTokens({ 
      userId: user.id, 
      role: user.role 
    });

    // 5. Set Cookies
    const cookieStore = await cookies();
    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 // 15 minutes
    });

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return NextResponse.json({ 
      success: true, 
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
      }
    });
  } catch (error: any) {
    console.error('Verify Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
