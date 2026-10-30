import { NextResponse } from 'next/server';
import { getUsers } from '@/lib/serverStore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    const users = getUsers();

    const results = users
      .filter((u) => {
        if (!q) return true;
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.blockchainUserId?.toLowerCase().includes(q)
        );
      })
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        blockchainUserId: u.blockchainUserId,
        isInitialized: u.isInitialized,
      }));

    return NextResponse.json({
      success: true,
      data: { users: results },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
