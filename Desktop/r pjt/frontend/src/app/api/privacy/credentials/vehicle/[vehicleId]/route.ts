import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';

export async function GET(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const vehicles = getVehicles();
    const vehicle = vehicles.find((v) => v.id === vehicleId || v.passportId === vehicleId);

    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    }

    const txHash = vehicle.blockchainTxHash || '0x5cfc39e120daf8ddfcf7847dafb035e5a157a74058ac2823735dc58f0f06a486';

    const credentials = [
      {
        id: `cred-title-${vehicle.id}`,
        credentialId: `VC-TITLE-${vehicle.passportId}`,
        credentialType: 'VEHICLE_TITLE_CREDENTIAL',
        schemaVersion: '1.0.0',
        rootCommitment: '0x3a4b9c1d2e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef',
        issuer: {
          id: 'user-admin',
          name: 'National Motor Vehicle Authority',
          role: 'ADMIN',
          email: 'regulator@vehiclepassport.dev',
        },
        issuerPublicKey: '0x04bfcab53f0034182e28d0857b4363195a706c47250f0675e2e6dad2f140f241936a048',
        status: 'ACTIVE' as const,
        validFrom: '2024-01-01T00:00:00.000Z',
        validUntil: '2034-01-01T00:00:00.000Z',
        onChainTxHash: txHash,
        createdAt: vehicle.createdAt,
      },
      {
        id: `cred-odo-${vehicle.id}`,
        credentialId: `VC-ODO-${vehicle.passportId}`,
        credentialType: 'ODOMETER_INTEGRITY_CREDENTIAL',
        schemaVersion: '1.0.0',
        rootCommitment: '0x7a35596aa439d77ad6d9a62e8246fa3743d401e60dd13567cc5771e5acf7ca26',
        issuer: {
          id: 'demo-user-garage-001',
          name: 'Apex Certified Garage',
          role: 'GARAGE',
          email: 'garage@vehiclepassport.dev',
        },
        issuerPublicKey: '0x04bfcab53f0034182e28d0857b4363195a706c47250f0675e2e6dad2f140f241936a048',
        status: 'ACTIVE' as const,
        validFrom: '2026-06-15T00:00:00.000Z',
        validUntil: '2027-06-15T00:00:00.000Z',
        onChainTxHash: txHash,
        createdAt: vehicle.createdAt,
      },
    ];

    return NextResponse.json({
      success: true,
      data: credentials,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

