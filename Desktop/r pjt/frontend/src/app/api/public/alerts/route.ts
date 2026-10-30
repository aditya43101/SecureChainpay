import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const alerts = [
      {
        id: 'alt-1',
        type: 'BLOCKCHAIN_SYNC',
        severity: 'INFO',
        title: 'EVM L2 Avalanche Subnet Finality Active',
        message: 'Merkle batch commitments anchoring every 10 blocks with 99.0% gas compression.',
        timestamp: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: { alerts },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

