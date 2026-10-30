import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const logs = [
      {
        id: 'log-1',
        action: 'BATCH_CONFIRMED',
        entityType: 'MERKLE_BATCH',
        entityId: 'BATCH-2026-000012',
        performedBy: 'System Engine',
        status: 'SUCCESS',
        details: 'Anchored 2 leaf records in Block #46',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'log-2',
        action: 'PASSPORT_VERIFIED',
        entityType: 'VEHICLE',
        entityId: 'demo-veh-001-aurora',
        performedBy: 'Public Verifier',
        status: 'SUCCESS',
        details: 'Cryptographic match confirmed on EVM Subnet',
        timestamp: new Date(Date.now() - 600000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        total: logs.length,
        page,
        limit,
        totalPages: 1,
        logs,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

