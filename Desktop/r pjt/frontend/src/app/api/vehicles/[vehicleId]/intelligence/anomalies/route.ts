import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  return NextResponse.json({
    success: true,
    data: {
      totalCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      items: [],
    },
  });
}

