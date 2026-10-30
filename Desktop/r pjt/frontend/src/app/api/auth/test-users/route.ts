import { NextResponse } from 'next/server';
import { getUsers } from '@/lib/serverStore';

export async function GET() {
  const users = getUsers();
  return NextResponse.json({
    success: true,
    data: {
      testUsers: users,
    },
  });
}
