import { NextResponse } from 'next/server';
import {
  getVehicles,
  getUsers,
  parseSessionToken,
  generateRandomHash,
  getVehicleTimelineData,
  addOwnershipHistoryRecord,
  saveToDisk,
} from '@/lib/serverStore';
import { TimelineEvent, OwnershipHistoryRecord } from '@/types/vehicle';

export async function POST(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    // 1. Authentication requirement (Rule 2 & 6)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();
    const caller = parseSessionToken(token);

    if (!caller) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required to transfer ownership' },
        { status: 401 }
      );
    }

    const { vehicleId } = params;
    const body = await request.json().catch(() => ({}));
    const { targetUserIdentifier, transferType, notes } = body;

    // 2. Target user parameter validation
    if (!targetUserIdentifier || typeof targetUserIdentifier !== 'string' || !targetUserIdentifier.trim()) {
      return NextResponse.json(
        { success: false, error: 'Target user email or user ID is required' },
        { status: 400 }
      );
    }

    // 3. Vehicle existence & status check (Rule 5)
    const vehicles = getVehicles();
    const vehicle = vehicles.find((v) => v.id === vehicleId || v.passportId === vehicleId);

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    if (vehicle.status && vehicle.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Cannot transfer an inactive vehicle' },
        { status: 400 }
      );
    }

    // 4. Server-enforced authorization: caller must be current owner (Rule 2 & 6)
    if (vehicle.currentOwnerId !== caller.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Only the authenticated current vehicle owner can initiate an ownership transfer',
        },
        { status: 403 }
      );
    }

    // 5. Target recipient resolution (Rule 3)
    const users = getUsers();
    const identifier = targetUserIdentifier.trim().toLowerCase();

    const targetUser = users.find(
      (u) =>
        u.id.toLowerCase() === identifier ||
        u.email.toLowerCase() === identifier ||
        u.blockchainUserId?.toLowerCase() === identifier ||
        u.firebaseUid?.toLowerCase() === identifier
    );

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Target owner not found. The recipient must be a registered user in the system.',
        },
        { status: 404 }
      );
    }

    // 6. Prohibit self-transfer (Rule 4)
    if (
      targetUser.id === caller.id ||
      targetUser.email.toLowerCase() === caller.email.toLowerCase() ||
      vehicle.currentOwnerId === targetUser.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot transfer vehicle to current owner (self-transfer is prohibited)',
        },
        { status: 400 }
      );
    }

    // 7. Verify recipient is initialized
    if (!targetUser.isInitialized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Target owner has not initialized their Vehicle Passport identity.',
        },
        { status: 400 }
      );
    }

    // 8. Execute ownership transfer atomically
    const previousOwner = vehicle.currentOwner || caller;
    const txHash = generateRandomHash();
    const blockNumber = Math.floor(12500000 + Math.random() * 50000);
    const transferDate = new Date().toISOString();
    const recordHash = generateRandomHash();
    const blockchainRecordId = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
    const effectiveTransferType = transferType || 'SALE';

    // Update vehicle current owner
    vehicle.currentOwnerId = targetUser.id;
    vehicle.currentOwner = targetUser;
    vehicle.updatedAt = transferDate;

    // Record structured OwnershipHistory (Rule 8)
    const historyRecord: OwnershipHistoryRecord = {
      id: `own-hist-${Date.now()}`,
      vehicleId: vehicle.id,
      previousOwnerId: previousOwner.id,
      previousOwner: {
        id: previousOwner.id,
        name: previousOwner.name,
        email: previousOwner.email,
        role: previousOwner.role,
      },
      newOwnerId: targetUser.id,
      newOwner: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
      transferType: effectiveTransferType,
      transferDate,
      notes: notes?.trim() || null,
      recordHash,
      blockchainRecordId,
      blockchainTxHash: txHash,
      blockNumber,
      status: 'CONFIRMED',
    };
    addOwnershipHistoryRecord(vehicle.id, historyRecord);

    // Append to timeline (Rule 10: Preserves all previous events)
    const timeline = getVehicleTimelineData(vehicle.id);
    const ownershipEvent: TimelineEvent = {
      id: `event-transfer-${Date.now()}`,
      category: 'OWNERSHIP',
      date: transferDate,
      year: new Date().getFullYear(),
      title: `Ownership Transferred: ${previousOwner.name} → ${targetUser.name}`,
      description: `Vehicle Passport ${vehicle.passportId} legally transferred from ${previousOwner.name} (${previousOwner.blockchainUserId || 'USR-PREV'}) to ${targetUser.name} (${targetUser.blockchainUserId || 'USR-NEW'}). Transfer type: ${effectiveTransferType}. Notes: ${notes?.trim() || 'Verified bill of sale'}.`,
      actor: `${previousOwner.name} & ${targetUser.name}`,
      status: 'CONFIRMED',
      blockchainTxHash: txHash,
      details: {
        evidenceRef: `TransferDeed#${vehicle.passportId}-${Date.now().toString().slice(-4)}`,
        level: 'VERIFIED',
      },
    };

    timeline.unshift(ownershipEvent);
    saveToDisk();

    return NextResponse.json({
      success: true,
      message: `Ownership successfully transferred to ${targetUser.name} (${targetUser.blockchainUserId})`,
      data: {
        transactionHash: txHash,
        blockchainTxHash: txHash,
        vehicleId: vehicle.id,
        passportId: vehicle.passportId,
        previousOwnerId: previousOwner.id,
        previousOwnerName: previousOwner.name,
        previousOwnerEmail: previousOwner.email,
        newOwnerId: targetUser.id,
        newOwnerName: targetUser.name,
        newOwnerEmail: targetUser.email,
        newOwnerBlockchainId: targetUser.blockchainUserId,
        transferType: effectiveTransferType,
        blockNumber,
        recordHash,
        blockchainRecordId,
      },
    });
  } catch (error: any) {
    console.error('API /ownership/transfer error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to transfer ownership' },
      { status: 500 }
    );
  }
}
