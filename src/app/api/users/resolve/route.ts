import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || searchParams.get('username') || searchParams.get('address');

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ success: false, matches: [] }, { status: 400 });
    }

    const cleanQuery = query.trim().replace(/^@/, '');
    const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(cleanQuery);

    if (isEthAddress) {
      return NextResponse.json({
        success: true,
        isExternalAddress: true,
        matches: [
          {
            uid: null,
            username: undefined,
            displayName: `External Wallet (${cleanQuery.substring(0, 6)}...${cleanQuery.substring(cleanQuery.length - 4)})`,
            walletAddress: cleanQuery,
            isExternal: true,
          },
        ],
        exactMatch: {
          uid: null,
          username: undefined,
          displayName: `External Wallet (${cleanQuery.substring(0, 6)}...${cleanQuery.substring(cleanQuery.length - 4)})`,
          walletAddress: cleanQuery,
          isExternal: true,
        },
      });
    }

    const matches: Array<{
      uid: string;
      username: string;
      displayName: string;
      email?: string;
      walletAddress: string;
    }> = [];

    // 1. Search Firestore users
    try {
      const adminDb = getAdminDb();
      const usersSnap = await adminDb.collection('users').get();
      
      for (const doc of usersSnap.docs) {
        const uData = doc.data();
        const username = (uData.username || uData.email?.split('@')[0] || '').toLowerCase();
        const displayName = (uData.displayName || uData.firstName ? `${uData.firstName} ${uData.lastName || ''}` : uData.name || '').trim();
        const email = (uData.email || '').toLowerCase();

        const isMatch =
          username.includes(cleanQuery.toLowerCase()) ||
          displayName.toLowerCase().includes(cleanQuery.toLowerCase()) ||
          email.includes(cleanQuery.toLowerCase());

        if (isMatch) {
          // Fetch wallet address
          const walletSnap = await doc.ref.collection('wallet').doc('data').get();
          const walletAddress = walletSnap.exists ? walletSnap.data()?.address : null;

          if (walletAddress) {
            matches.push({
              uid: doc.id,
              username: `@${username || doc.id.substring(0, 6)}`,
              displayName: displayName || username || 'SecureChain User',
              email: uData.email,
              walletAddress,
            });
          }
        }
      }
    } catch (fsErr) {
      console.warn('[User Resolve API] Firestore lookup error:', fsErr);
    }

    // 2. Search Prisma DB users if matches are few
    if (matches.length === 0) {
      try {
        const prismaUsers = await db.user.findMany({
          where: {
            OR: [
              { email: { contains: cleanQuery, mode: 'insensitive' } },
              { firstName: { contains: cleanQuery, mode: 'insensitive' } },
              { lastName: { contains: cleanQuery, mode: 'insensitive' } },
            ],
          },
          include: { wallets: true },
          take: 10,
        });

        for (const pu of prismaUsers) {
          const mainWallet = pu.wallets[0]?.address;
          if (mainWallet) {
            const username = pu.email ? pu.email.split('@')[0] : pu.id.substring(0, 6);
            matches.push({
              uid: pu.id,
              username: `@${username}`,
              displayName: `${pu.firstName || ''} ${pu.lastName || ''}`.trim() || username,
              email: pu.email || undefined,
              walletAddress: mainWallet,
            });
          }
        }
      } catch (pErr) {
        console.warn('[User Resolve API] Prisma lookup error:', pErr);
      }
    }

    // Exact match prioritization
    const exactMatch = matches.find(
      (m) =>
        m.username.toLowerCase() === `@${cleanQuery.toLowerCase()}` ||
        m.displayName.toLowerCase() === cleanQuery.toLowerCase() ||
        m.email?.toLowerCase() === cleanQuery.toLowerCase()
    ) || (matches.length === 1 ? matches[0] : null);

    return NextResponse.json({
      success: true,
      matches,
      exactMatch,
    });
  } catch (error: any) {
    console.error('[User Resolve API] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lookup failed' }, { status: 500 });
  }
}
