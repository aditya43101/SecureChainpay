import { NextResponse } from 'next/server';
import { getVehicles } from '@/lib/serverStore';

export async function GET(
  request: Request,
  { params }: { params: { passportId: string } }
) {
  try {
    const rawParam = params?.passportId;
    if (!rawParam) {
      return NextResponse.json({ success: false, error: 'Passport ID required' }, { status: 400 });
    }

    const decodedId = decodeURIComponent(rawParam).trim().toLowerCase();
    const vehicles = getVehicles();

    let vehicle = vehicles.find(
      (v) =>
        v.passportId.toLowerCase() === decodedId ||
        v.id.toLowerCase() === decodedId ||
        v.vin.toLowerCase() === decodedId ||
        v.registrationNumber.toLowerCase().replace(/\s+/g, '') === decodedId.replace(/\s+/g, '')
    );

    if (!vehicle) {
      vehicle = vehicles.find((v) => v.passportId.toLowerCase().includes(decodedId) || v.vin.toLowerCase().includes(decodedId));
    }
    if (!vehicle) {
      vehicle = vehicles[0];
    }

    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    }

    const vin = vehicle.vin || 'MAT612345NEXON001';
    const vinMasked = `${vin.substring(0, 3)}***${vin.substring(vin.length - 3)}`;
    const isEv = vehicle.fuelType === 'ELECTRIC';

    const ecosystemSummary = {
      passportId: vehicle.passportId,
      vinMasked,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      variant: vehicle.variant || 'Standard Edition',
      manufacturingYear: vehicle.manufacturingYear,
      fuelType: vehicle.fuelType,
      isEv,
      manufacturerCertificate: {
        isIssued: true,
        certificateNumber: `OEM-CERT-${vehicle.manufacturingYear}-${vehicle.passportId.replace(/[^a-zA-Z0-9]/g, '')}`,
        manufacturerName: vehicle.manufacturer,
        manufacturingPlant: 'Pune Industrial Gigafactory, Plant 4',
        manufacturingDate: `${vehicle.manufacturingYear}-01-15T08:00:00.000Z`,
        initialOdometer: 12,
        verificationStatus: 'GENESIS_ANCHORED',
        blockchainTxHash: vehicle.blockchainTxHash || '0x1111111111111111111111111111111111111111111111111111111111111111',
      },
      batteryPassport: isEv
        ? {
            batterySerialMasked: 'BAT9***882',
            chemistry: 'LFP (Lithium Iron Phosphate)',
            nominalCapacityKwh: 40.5,
            capacityRetainedPercentage: 97.4,
            currentHealthPct: 98,
            cycleCount: 142,
            status: 'HEALTHY',
            evidenceClassification: 'OEM_BMS_TELEMETRY_CERTIFIED',
          }
        : null,
      insurance: {
        activePolicyPresent: true,
        coverageContinuity: 'UNINTERRUPTED',
        settledClaimsCount: 0,
      },
      servicingGaragesSummary: {
        totalServices: 3,
        allGaragesVerified: true,
        verifiedGarages: [
          {
            garageName: 'Authorized Apex Workshop Center',
            verificationStatus: 'AUTHORIZED_OEM_DEALER',
            trustIndex: 99,
          },
          {
            garageName: 'Metro Automotive Certified Hub',
            verificationStatus: 'CERTIFIED_INDEPENDENT',
            trustIndex: 96,
          },
        ],
      },
    };

    return NextResponse.json({
      success: true,
      data: ecosystemSummary,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

