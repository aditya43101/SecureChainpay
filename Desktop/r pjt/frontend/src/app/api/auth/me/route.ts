import { NextResponse } from 'next/server';
import { parseSessionToken } from '@/lib/serverStore';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = parseSessionToken(token);

    if (!user) {
      return NextResponse.json({ success: false, error: 'User session expired or not found' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
