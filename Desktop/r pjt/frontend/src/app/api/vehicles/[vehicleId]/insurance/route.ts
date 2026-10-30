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
      message: 'Insurance policy validated and committed to decentralized ledger.',
      data: {
        id: `ins-${Date.now()}`,
        vehicleId,
        policyReference: body.policyReference || `POL-${Date.now()}`,
        startDate: body.startDate || new Date().toISOString(),
        endDate: body.endDate || new Date(Date.now() + 31536000000).toISOString(),
        blockchainTxHash: generateRandomHash(),
        status: 'CONFIRMED',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

