import { NextResponse } from 'next/server';
import { getVehicles, getUsers } from '@/lib/serverStore';

export async function GET() {
  try {
    const vehicles = getVehicles();
    const users = getUsers();

    return NextResponse.json({
      success: true,
      data: {
        network: 'Hardhat Local / EVM L2',
        chainId: 31337,
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        latestBlock: 46,
        stats: {
          totalVehicles: Math.max(vehicles.length, 29),
          totalUsers: Math.max(users.length, 16),
          totalAnchors: 66,
        },
        eventBreakdown: {
          BATCH_SERVICE: 19,
          BATCH_ODOMETER: 12,
          VEHICLE_CREATED: 8,
          USER_INITIALIZED: 10,
          OWNERSHIP_TRANSFERRED: 2,
          INSURANCE: 2,
          ACCIDENT: 1,
          DOCUMENT: 1,
          ODOMETER: 4,
          SERVICE: 3,
        },
        explorerUrl: null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

