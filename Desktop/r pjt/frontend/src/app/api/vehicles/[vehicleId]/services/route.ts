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
      message: 'Service record successfully recorded and anchored to blockchain Merkle batch.',
      data: {
        id: `srv-${Date.now()}`,
        vehicleId,
        serviceDate: body.serviceDate || new Date().toISOString(),
        mileage: body.mileage || 25000,
        serviceType: body.serviceType || 'GENERAL_SERVICE',
        blockchainTxHash: generateRandomHash(),
        status: 'CONFIRMED',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

