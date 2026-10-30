import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { findingId: string } }
) {
  try {
    const { findingId } = params;
    return NextResponse.json({
      success: true,
      data: {
        id: findingId,
        status: 'RESOLVED',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

