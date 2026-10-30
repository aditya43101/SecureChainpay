import { NextResponse } from 'next/server';
import {
  getVehicles,
  generateRandomHash,
  parseSessionToken,
  saveToDisk,
} from '@/lib/serverStore';
import { Vehicle } from '@/types/vehicle';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const currentUser = parseSessionToken(token);

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const vehicles = getVehicles();

    // Check vehicles owned by this user
    let userVehicles = vehicles.filter((v) => v.currentOwnerId === currentUser.id);

    // Only for ADMIN role without owned vehicles, allow viewing all system vehicles for administrative inspection
    if (currentUser.role === 'ADMIN' && userVehicles.length === 0) {
      userVehicles = vehicles;
    }

    return NextResponse.json({
      success: true,
      data: { vehicles: userVehicles },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const currentUser = parseSessionToken(token);

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    if (!currentUser.isInitialized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Initialize your Vehicle Passport before adding a vehicle.',
          code: 'PASSPORT_NOT_INITIALIZED',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (!body.manufacturer || !body.model || !body.vin || !body.registrationNumber) {
      return NextResponse.json(
        { success: false, error: 'Manufacturer, Model, VIN, and Registration Number are required.' },
        { status: 400 }
      );
    }

    const normalizedVin = body.vin.trim().toUpperCase();
    const normalizedReg = body.registrationNumber.trim().toUpperCase();

    if (normalizedVin.length !== 17) {
      return NextResponse.json(
        { success: false, error: 'VIN must be exactly 17 characters long.' },
        { status: 400 }
      );
    }

    const vehicles = getVehicles();

    // Check VIN uniqueness
    if (vehicles.some((v) => v.vin.toUpperCase() === normalizedVin)) {
      return NextResponse.json(
        { success: false, error: 'Vehicle with this VIN already exists.' },
        { status: 409 }
      );
    }

    // Check Registration Number uniqueness
    if (vehicles.some((v) => v.registrationNumber.toUpperCase() === normalizedReg)) {
      return NextResponse.json(
        { success: false, error: 'Vehicle with this Registration Number already exists.' },
        { status: 409 }
      );
    }

    const index = vehicles.length + 1;
    const passportId = `VP-${String(index).padStart(6, '0')}`;

    const newVehicle: Vehicle = {
      id: `veh-${Date.now()}`,
      passportId,
      vin: normalizedVin,
      registrationNumber: normalizedReg,
      manufacturer: body.manufacturer.trim(),
      model: body.model.trim(),
      variant: body.variant?.trim() || null,
      manufacturingYear: Number(body.manufacturingYear) || 2024,
      fuelType: body.fuelType || 'PETROL',
      color: body.color?.trim() || null,
      engineNumber: body.engineNumber?.trim() || null,
      status: 'ACTIVE',
      blockchainStatus: 'CONFIRMED',
      currentOwnerId: currentUser.id,
      blockchainVehicleId: `VEH-${String(index).padStart(6, '0')}`,
      blockchainTxHash: generateRandomHash(),
      blockchainRegisteredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentOwner: currentUser,
    };

    vehicles.unshift(newVehicle);

    // Update current owner's onboarding status to COMPLETED_WITH_VEHICLE
    currentUser.onboardingStatus = 'COMPLETED_WITH_VEHICLE';
    currentUser.updatedAt = new Date().toISOString();
    saveToDisk();

    return NextResponse.json(
      {
        success: true,
        message: 'Vehicle created and anchored to decentralized ledger',
        data: { vehicle: newVehicle },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
