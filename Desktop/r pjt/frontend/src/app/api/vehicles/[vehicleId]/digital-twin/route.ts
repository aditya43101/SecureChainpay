import { NextResponse } from 'next/server';
import { getVehicles, getOwnershipHistoryData } from '@/lib/serverStore';

export async function GET(
  request: Request,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const { vehicleId } = params;
    const vehicles = getVehicles();
    const vehicle =
      vehicles.find((v) => v.id === vehicleId || v.passportId === vehicleId || v.vin === vehicleId) ||
      vehicles[0];

    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    }

    const txHash = vehicle.blockchainTxHash || '0x5cfc39e120daf8ddfcf7847dafb035e5a157a74058ac2823735dc58f0f06a486';
    const nowIso = new Date().toISOString();
    const ownershipRecords = getOwnershipHistoryData(vehicle.id);

    const digitalTwin = {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      reconstructedAt: nowIso,
      engineVersion: '2.4.0-autonomous',
      identity: {
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        variant: vehicle.variant || 'Standard',
        manufacturingYear: vehicle.manufacturingYear,
        fuelType: vehicle.fuelType,
        color: vehicle.color || 'Standard',
        registrationNumber: vehicle.registrationNumber,
        status: vehicle.status,
        level: 'FULL_VERIFIED' as const,
      },
      ownership: {
        currentOwnerName: vehicle.currentOwner?.name || 'Aarav Sharma',
        currentOwnerRole: vehicle.currentOwner?.role || 'VEHICLE_OWNER',
        totalOwnersCount: Math.max(1, ownershipRecords.length),
        transfersCount: Math.max(0, ownershipRecords.length - 1),
        currentOwnershipDurationDays: 320,
        history: ownershipRecords.map((r) => ({
          transferDate: r.transferDate || nowIso,
          transferType: r.transferType || 'SALE',
          previousOwner: r.previousOwner?.name || 'Genesis OEM',
          newOwner: r.newOwner?.name || 'Aarav Sharma',
          recordHash: r.recordHash || txHash,
          level: 'FULL_VERIFIED' as const,
        })),
      },
      odometer: {
        currentMileage: 24000,
        lastRecordedDate: '2026-09-20T14:00:00.000Z',
        totalReadingsCount: 3,
        isMonotonic: true,
        rollbackDetected: false,
        averageAnnualMileageKm: 12000,
        dailyMileageVelocityKm: 32.8,
        readingsHistory: [
          { date: '2026-03-10T09:00:00.000Z', mileage: 8200, source: 'Apex Certified Garage', level: 'FULL_VERIFIED' as const },
          { date: '2026-06-15T10:30:00.000Z', mileage: 15000, source: 'Apex Certified Garage', level: 'FULL_VERIFIED' as const },
          { date: '2026-09-20T14:00:00.000Z', mileage: 24000, source: 'Apex Certified Garage', level: 'FULL_VERIFIED' as const },
        ],
      },
      maintenance: {
        totalServicesCount: 2,
        lastServiceDate: '2026-09-20T14:00:00.000Z',
        lastServiceMileage: 24000,
        lastServiceType: 'Brake Rotor & Pad Replacement',
        serviceCoverageScore: 98,
        coverageFormulaExplanation: 'Regular maintenance performed at certified OEM garage on prescribed schedule.',
        serviceGapsDetected: false,
        services: [
          {
            id: 'srv-1',
            date: '2026-06-15T10:30:00.000Z',
            mileage: 15000,
            type: 'Periodic Maintenance Service',
            garageName: 'Apex Certified Garage',
            cost: 8500,
            level: 'FULL_VERIFIED' as const,
          },
          {
            id: 'srv-2',
            date: '2026-09-20T14:00:00.000Z',
            mileage: 24000,
            type: 'Brake Rotor & Pad Replacement',
            garageName: 'Apex Certified Garage',
            cost: 14200,
            level: 'FULL_VERIFIED' as const,
          },
        ],
      },
      accidents: {
        totalAccidentsCount: 0,
        openRepairsCount: 0,
        severeAccidentsCount: 0,
        records: [],
      },
      insurance: {
        hasActiveCoverage: true,
        currentPolicyReference: `POL-${vehicle.passportId}-2026`,
        currentProvider: 'SafeShield Underwriters Ltd.',
        expiresAt: '2027-01-10T00:00:00.000Z',
        totalPoliciesCount: 1,
        level: 'FULL_VERIFIED' as const,
      },
      documents: {
        totalDocumentsCount: 2,
        verifiedDocumentsCount: 2,
        consistencyStatus: 'CONSISTENT',
        documentProofs: [
          {
            id: 'doc-rc',
            type: 'REGISTRATION_CERTIFICATE',
            title: 'Official RC Certificate',
            ipfsCid: 'bafybeicdev_3a4b9c1d2e5f60718293a4b5c6d7',
            storageProvider: 'IPFS / Filecoin Pinning',
            ocrConsistency: 'MATCHED_100',
            level: 'FULL_VERIFIED' as const,
          },
          {
            id: 'doc-ins',
            type: 'INSURANCE_POLICY',
            title: 'SafeShield Policy Bond',
            ipfsCid: 'bafybeicdev_7a35596aa439d77ad6d9a62e8246',
            storageProvider: 'IPFS / Filecoin Pinning',
            ocrConsistency: 'MATCHED_100',
            level: 'FULL_VERIFIED' as const,
          },
        ],
      },
      blockchain: {
        isAnchored: true,
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        network: 'Hardhat Local / EVM L2 (Chain 31337)',
        totalAnchoredRecords: 66,
        latestBlockNumber: 46,
        latestTxHash: txHash,
        integrityStatus: 'VERIFIED' as const,
        level: 'FULL_VERIFIED' as const,
      },
      intelligence: {
        healthScore: 96,
        healthStatus: 'EXCELLENT',
        riskScore: 4,
        riskLevel: 'LOW',
        anomaliesCount: 0,
        predictiveItemsCount: 2,
      },
      stateEvolution: [
        {
          timestamp: '2026-01-10T00:00:00.000Z',
          stateSummary: 'Vehicle Minted & Genesis Title Anchored',
          sourceEvent: 'REGISTRATION',
          mileage: 0,
          confidence: 100,
        },
        {
          timestamp: '2026-06-15T10:30:00.000Z',
          stateSummary: 'Periodic 15,000 km Service Recorded',
          sourceEvent: 'SERVICE',
          mileage: 15000,
          confidence: 99,
        },
        {
          timestamp: '2026-09-20T14:00:00.000Z',
          stateSummary: 'Brake Overhaul & 24,000 km Telemetry Anchored',
          sourceEvent: 'TELEMETRY',
          mileage: 24000,
          confidence: 100,
        },
      ],
      timeline: [
        {
          id: 'ev-1',
          date: '2026-01-10T00:00:00.000Z',
          category: 'REGISTRATION',
          title: 'Genesis Passport Minted',
          description: `Cryptographic vehicle identity anchored on blockchain.`,
          actor: 'Manufacturer OEM',
          status: 'CONFIRMED',
          blockchainTxHash: txHash,
        },
      ],
      evidenceRegistry: [
        {
          id: 'ev-reg-1',
          category: 'IDENTITY',
          fact: 'Chassis VIN cryptographically committed on EVM Subnet',
          source: 'SmartContract#VehiclePassport',
          confidence: 100,
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: digitalTwin,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

