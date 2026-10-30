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
    const nowIso = new Date().toISOString();

    const graphData = {
      vehicle: {
        id: vehicle.id,
        passportId: vehicle.passportId,
        vin: vehicle.vin,
        registrationNumber: vehicle.registrationNumber,
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
      },
      nodes: [
        {
          id: `node-v-${vehicle.id}`,
          nodeKey: `VEHICLE:${vehicle.id}`,
          entityType: 'VEHICLE',
          entityId: vehicle.id,
          label: `${vehicle.manufacturer} ${vehicle.model}`,
          isAnchored: true,
          anomalyScore: 0.02,
          lastSyncedAt: nowIso,
        },
        {
          id: `node-u-${vehicle.currentOwnerId}`,
          nodeKey: `USER:${vehicle.currentOwnerId}`,
          entityType: 'USER',
          entityId: vehicle.currentOwnerId,
          label: vehicle.currentOwner?.name || 'Aarav Sharma',
          isAnchored: true,
          anomalyScore: 0.01,
          lastSyncedAt: nowIso,
        },
        {
          id: `node-g-apex`,
          nodeKey: `GARAGE:apex-001`,
          entityType: 'GARAGE',
          entityId: 'apex-001',
          label: 'Apex Certified Garage',
          isAnchored: true,
          anomalyScore: 0.0,
          lastSyncedAt: nowIso,
        },
        {
          id: `node-i-safeshield`,
          nodeKey: `INSURER:safeshield-001`,
          entityType: 'INSURER',
          entityId: 'safeshield-001',
          label: 'SafeShield Underwriters',
          isAnchored: true,
          anomalyScore: 0.0,
          lastSyncedAt: nowIso,
        },
      ],
      edges: [
        {
          id: `edge-owns-${vehicle.id}`,
          sourceNodeId: `node-u-${vehicle.currentOwnerId}`,
          targetNodeId: `node-v-${vehicle.id}`,
          relationshipType: 'OWNS',
          isDirect: true,
          isInferred: false,
          confidence: 1.0,
          sourceReference: txHash,
          createdAt: nowIso,
        },
        {
          id: `edge-service-${vehicle.id}`,
          sourceNodeId: `node-g-apex`,
          targetNodeId: `node-v-${vehicle.id}`,
          relationshipType: 'SERVICED_BY',
          isDirect: true,
          isInferred: false,
          confidence: 0.99,
          sourceReference: txHash,
          createdAt: nowIso,
        },
        {
          id: `edge-insured-${vehicle.id}`,
          sourceNodeId: `node-i-safeshield`,
          targetNodeId: `node-v-${vehicle.id}`,
          relationshipType: 'INSURED_BY',
          isDirect: true,
          isInferred: false,
          confidence: 1.0,
          sourceReference: txHash,
          createdAt: nowIso,
        },
      ],
      findings: [],
    };

    return NextResponse.json({
      success: true,
      data: graphData,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

