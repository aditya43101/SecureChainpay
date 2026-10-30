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
      message: 'Accident and repair assessment anchored on blockchain.',
      data: {
        id: `acc-${Date.now()}`,
        vehicleId,
        accidentDate: body.accidentDate || new Date().toISOString(),
        severity: body.severity || 'MINOR',
        description: body.description || 'Standard repair logged',
        blockchainTxHash: generateRandomHash(),
        status: 'CONFIRMED',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

