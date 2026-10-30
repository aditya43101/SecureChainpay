import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';
import { TwinLifecycleEventDTO } from '@/types/vehicle';

export async function GET(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const vehicles = getVehicles();
    const vehicle =
      vehicles.find((v) => v.id === vehicleId || v.passportId === vehicleId || v.vin === vehicleId) ||
      vehicles[0] || {
        id: vehicleId,
        passportId: 'VP-DEMO-001',
      };

    const events: TwinLifecycleEventDTO[] = [
      {
        id: 'evt-1',
        vehicleId: vehicle.id,
        eventType: 'VEHICLE_INITIAL_REGISTRATION',
        sourceRecordId: 'rec-reg-001',
        sourceSystem: 'CORE_REGISTRY',
        eventTime: '2024-01-15T10:00:00.000Z',
        recordedTime: '2024-01-15T10:00:00.000Z',
        ingestionTime: '2024-01-15T10:01:00.000Z',
        actor: 'Manufacturer OEM Registry',
        schemaVersion: '1.0',
        sourceVerificationStatus: 'CONFIRMED',
        contentHash: '0x1fc68184bbbd1ec952f29a439c0d1d76679e7a43fb08fcb3d8994fa34979e447',
        blockchainTxHash: '0xfac8079772ec473f8b1afd98988652c3d5c06cbb4f8bd02f78ba39a3810a271b',
        idempotencyKey: `reg-${vehicle.id}`,
        summary: `Vehicle Passport Minted for ${vehicle.passportId} on EVM Subnet 31337.`,
        payloadJson: JSON.stringify({ registration: 'CONFIRMED', status: 'ACTIVE' }),
      },
      {
        id: 'evt-2',
        vehicleId: vehicle.id,
        eventType: 'PERIODIC_SERVICE_COMPLETED',
        sourceRecordId: 'rec-srv-001',
        sourceSystem: 'GARAGE_PORTAL',
        eventTime: '2025-06-12T11:30:00.000Z',
        recordedTime: '2025-06-12T11:30:00.000Z',
        ingestionTime: '2025-06-12T11:31:00.000Z',
        actor: 'Apex Certified Garage',
        schemaVersion: '1.0',
        sourceVerificationStatus: 'CONFIRMED',
        contentHash: '0x55ab90b683b79964357454f2568c2d254b1f6a258880afbbedf704d98469f2cc',
        blockchainTxHash: '0x55ab90b683b79964357454f2568c2d254b1f6a258880afbbedf704d98469f2cc',
        idempotencyKey: `srv1-${vehicle.id}`,
        summary: 'Periodic 10,000 km general service and multipoint safety inspection.',
        payloadJson: JSON.stringify({ mileage: 10000, cost: 7500 }),
      },
      {
        id: 'evt-3',
        vehicleId: vehicle.id,
        eventType: 'ODOMETER_LOGGED',
        sourceRecordId: 'rec-odo-001',
        sourceSystem: 'TELEMETRY_INGEST',
        eventTime: '2026-08-15T14:00:00.000Z',
        recordedTime: '2026-08-15T14:00:00.000Z',
        ingestionTime: '2026-08-15T14:00:30.000Z',
        actor: 'Apex Certified Garage (Diagnostic OBD)',
        schemaVersion: '1.0',
        sourceVerificationStatus: 'CONFIRMED',
        contentHash: '0x8919a380c626e6de21b95fc3829d33bc80361351f102c608f47853125f03c3fa',
        blockchainTxHash: '0x8919a380c626e6de21b95fc3829d33bc80361351f102c608f47853125f03c3fa',
        idempotencyKey: `odo1-${vehicle.id}`,
        summary: 'Odometer checkpoint logged at 22,000 km. Monotonic progression verified.',
        payloadJson: JSON.stringify({ mileage: 22000, rollbackDetected: false }),
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        vehicleId: vehicle.id,
        count: events.length,
        events,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch twin events timeline' },
      { status: 500 }
    );
  }
}

