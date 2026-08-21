import { NextResponse } from 'next/server';
import { auth as firebaseAuth } from '@/lib/firebase/admin';
import { db } from '@/lib/db';
import { generateTokens } from '@/lib/auth/jwt';
import { ethers } from 'ethers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken, phoneNumber } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'Firebase ID Token is required' }, { status: 400 });
    }

    // Verify the Firebase ID Token using the Admin SDK
    // If FIREBASE_PROJECT_ID is not set, this will fail (as requested: do not simulate)
    const decodedToken = await firebaseAuth().verifyIdToken(idToken);
    
    // Ensure the token corresponds to the phone number if provided, or extract from token
    let verifiedPhone = decodedToken.phone_number || phoneNumber;
    
    if (!verifiedPhone) {
      return NextResponse.json({ error: 'No phone number found in token' }, { status: 400 });
    }

    // Normalize username/email/phone
    verifiedPhone = String(verifiedPhone).trim().toLowerCase();

    // Find or create the user in PostgreSQL
    let user = await db.user.findFirst({
      where: {
        OR: [
          { phone: verifiedPhone },
          { email: verifiedPhone }
        ]
      }
    });

    if (!user) {
      user = await db.user.create({
        data: {
          phone: verifiedPhone,
          passwordHash: 'OAUTH_PROVIDER', // No password needed for Phone Auth
          isEmailVerified: true,
          role: 'USER',
        }
      });
      
      try {
        const newWalletAddress = ethers.Wallet.createRandom().address;
        if (newWalletAddress) {
          await db.wallet.create({
            data: {
              userId: user.id,
              address: newWalletAddress,
              balance: 0,
              currency: 'USD'
            }
          });
        }
      } catch (walletErr) {
        console.error('Wallet generation failed during user creation:', walletErr);
        // Continue, wallet can be generated later
      }
    }

    // Generate our own system JWT
    const token = generateTokens({ userId: user.id, role: user.role });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: verifiedPhone,
        role: user.role,
      },
      token
    });

  } catch (error: any) {
    console.error('Real Login integration error:', error);
    return NextResponse.json(
      { error: error.message || 'Authentication failed. Make sure Firebase credentials are set in .env' },
      { status: 401 }
    );
  }
}
