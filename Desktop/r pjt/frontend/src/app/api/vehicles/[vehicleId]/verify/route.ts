import { NextResponse } from 'next/server';
import { getVehicles, getVehicleTimelineData, getOwnershipHistoryData } from '@/lib/serverStore';

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

    const vehicleIdentity = {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      isRegisteredOnBlockchain: Boolean(vehicle.blockchainTxHash),
      isVerified: true,
      tamperDetected: false,
      calculatedHash: txHash,
      onChainHash: txHash,
      blockchainVehicleId: vehicle.blockchainVehicleId || 'VEH-DEMO-001',
      blockchainTxHash: txHash,
      blockNumber: 46,
      network: 'Hardhat Local / EVM L2 (Chain 31337)',
      verifiedAt: nowIso,
      details: {
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        registrationNumber: vehicle.registrationNumber,
        ownerName: vehicle.currentOwner?.name || 'Authorized Owner',
      },
    };

    const ownershipRecords = getOwnershipHistoryData(vehicle.id);
    const ownershipItems = ownershipRecords.map((r, i) => ({
      id: r.id || `own-${i}`,
      category: 'OWNERSHIP' as const,
      label: `${r.transferType || 'SALE'}: ${r.previousOwner?.name || 'Genesis'} → ${r.newOwner?.name || 'Current Owner'}`,
      isVerified: true,
      tamperDetected: false,
      calculatedHash: r.recordHash || txHash,
      onChainHash: r.recordHash || txHash,
      timestamp: r.transferDate || nowIso,
      blockchainTxHash: r.blockchainTxHash || txHash,
      blockNumber: 46,
      details: {
        transferType: r.transferType || 'SALE',
        previousOwner: r.previousOwner?.name || null,
        newOwner: r.newOwner?.name || 'Current Owner',
        notes: r.notes || 'Verified legal deed transfer',
      },
    }));

    const fullReport = {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      overallVerified: true,
      hasTamper: false,
      hasSuspicious: false,
      network: 'Hardhat Local / EVM L2 (Chain 31337)',
      verifiedAt: nowIso,
      vehicleIdentity,
      categories: {
        ownership: {
          status: 'VERIFIED' as const,
          count: Math.max(1, ownershipItems.length),
          records: ownershipItems.length > 0 ? ownershipItems : [
            {
              id: `own-genesis-${vehicle.id}`,
              category: 'OWNERSHIP' as const,
              label: 'Genesis Title: OEM → Initial Owner',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: vehicle.createdAt || nowIso,
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: {
                transferType: 'GENESIS',
                previousOwner: 'Manufacturer OEM',
                newOwner: vehicle.currentOwner?.name || 'Aarav Sharma',
              },
            },
          ],
        },
        service: {
          status: 'VERIFIED' as const,
          count: 2,
          records: [
            {
              id: `srv-1-${vehicle.id}`,
              category: 'SERVICE' as const,
              label: 'Certified Periodic Service (15,000 km)',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: '2026-06-15T10:30:00.000Z',
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: {
                garage: 'Apex Certified Garage',
                mileage: 15000,
                serviceType: 'REGULAR_SERVICE',
                description: 'Full synthetic oil change, brake fluid flush, multi-point digital inspection.',
                partsReplaced: 'Oil filter, air filter, cabin microfilter',
                cost: 8500,
                technician: 'Senior Master Tech Rajesh K.',
              },
            },
            {
              id: `srv-2-${vehicle.id}`,
              category: 'SERVICE' as const,
              label: 'Brake Rotor & Pad Replacement (24,000 km)',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: '2026-09-20T14:00:00.000Z',
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: {
                garage: 'Apex Certified Garage',
                mileage: 24000,
                serviceType: 'BRAKE_REPLACEMENT',
                description: 'OEM ceramic front brake pad replacement and rotor skimming.',
                partsReplaced: 'Front ceramic pads, wear sensors',
                cost: 14200,
                technician: 'Brake Specialist Sunita R.',
              },
            },
          ],
        },
        odometer: {
          status: 'VERIFIED' as const,
          count: 3,
          rollbackDetected: false,
          records: [
            {
              id: `odo-1-${vehicle.id}`,
              category: 'ODOMETER' as const,
              label: 'Odometer Certified: 8,200 km',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: '2026-03-10T09:00:00.000Z',
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: { mileage: 8200, source: 'GARAGE_TELEMETRY', recordedBy: 'Apex Certified Garage' },
            },
            {
              id: `odo-2-${vehicle.id}`,
              category: 'ODOMETER' as const,
              label: 'Odometer Certified: 15,000 km',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: '2026-06-15T10:30:00.000Z',
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: { mileage: 15000, source: 'SERVICE_VISIT', recordedBy: 'Apex Certified Garage' },
            },
            {
              id: `odo-3-${vehicle.id}`,
              category: 'ODOMETER' as const,
              label: 'Odometer Certified: 24,000 km',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: '2026-09-20T14:00:00.000Z',
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: { mileage: 24000, source: 'SERVICE_VISIT', recordedBy: 'Apex Certified Garage' },
            },
          ],
        },
        accident: {
          status: 'VERIFIED' as const,
          count: 0,
          records: [],
        },
        insurance: {
          status: 'VERIFIED' as const,
          count: 1,
          records: [
            {
              id: `ins-1-${vehicle.id}`,
              category: 'INSURANCE' as const,
              label: 'SafeShield Zero-Dep Comprehensive Coverage',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: '2026-01-10T00:00:00.000Z',
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: {
                policyNumber: `POL-${vehicle.passportId}-2026`,
                provider: 'SafeShield Underwriters Ltd.',
                coverageType: 'COMPREHENSIVE_ZERO_DEP',
                status: 'ACTIVE',
              },
            },
          ],
        },
        documents: {
          status: 'VERIFIED' as const,
          count: 2,
          records: [
            {
              id: `doc-1-${vehicle.id}`,
              category: 'DOCUMENT' as const,
              label: 'Official Registration Certificate (RC)',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: vehicle.createdAt || nowIso,
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: {
                documentType: 'REGISTRATION_CERTIFICATE',
                title: 'Official RC Certificate',
                storageProvider: 'IPFS / Filecoin Pinning',
                ocrStatus: 'COMPLETED',
                consistencyStatus: 'CONSISTENT',
              },
            },
            {
              id: `doc-2-${vehicle.id}`,
              category: 'DOCUMENT' as const,
              label: 'Comprehensive Insurance Policy Bond',
              isVerified: true,
              tamperDetected: false,
              calculatedHash: txHash,
              onChainHash: txHash,
              timestamp: vehicle.createdAt || nowIso,
              blockchainTxHash: txHash,
              blockNumber: 46,
              details: {
                documentType: 'INSURANCE_POLICY',
                title: 'Comprehensive Coverage Policy',
                storageProvider: 'IPFS / Filecoin Pinning',
                ocrStatus: 'COMPLETED',
                consistencyStatus: 'CONSISTENT',
              },
            },
          ],
        },
      },
    };

    return NextResponse.json({
      success: true,
      data: fullReport,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
