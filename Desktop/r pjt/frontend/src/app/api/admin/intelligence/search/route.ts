import { NextResponse } from 'next/server';
import { getVehicles, getUsers } from '@/lib/serverStore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').toLowerCase();

    const allVehicles = getVehicles();
    const allUsers = getUsers();

    const vehicles = allVehicles.filter(
      (v) =>
        v.passportId.toLowerCase().includes(q) ||
        v.vin.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.manufacturer.toLowerCase().includes(q)
    );

    const users = allUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.blockchainUserId && u.blockchainUserId.toLowerCase().includes(q))
    );

    return NextResponse.json({
      success: true,
      data: {
        vehicles,
        users,
        blockchainRecords: [],
        garages: [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

