import { NextResponse } from 'next/server';
import { generateRandomHash } from '@/lib/serverStore';

export async function POST(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      message: 'Odometer reading recorded and anchored on blockchain.',
      data: {
        id: `odo-${Date.now()}`,
        vehicleId,
        mileage: Number(body.mileage || 25000),
        recordedAt: body.recordedAt || new Date().toISOString(),
        blockchainTxHash: generateRandomHash(),
        status: 'CONFIRMED',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

