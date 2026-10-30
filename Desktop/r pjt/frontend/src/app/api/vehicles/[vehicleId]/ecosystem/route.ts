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

    const isEv = vehicle.fuelType === 'ELECTRIC' || vehicle.fuelType === 'HYBRID';
    const txHash = vehicle.blockchainTxHash || '0x5cfc39e120daf8ddfcf7847dafb035e5a157a74058ac2823735dc58f0f06a486';
    const nowIso = new Date().toISOString();

    const ecosystemOverview = {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      fuelType: vehicle.fuelType,
      isEv,
      manufacturerCertificate: {
        id: `mfg-cert-${vehicle.id}`,
        vehicleId: vehicle.id,
        certificateNumber: `OEM-CERT-${vehicle.passportId}-2024`,
        manufacturerName: vehicle.manufacturer,
        plantLocation: 'Gothenburg Assembly Plant 4',
        assemblyDate: '2024-04-12T08:00:00.000Z',
        chassisSeries: 'CH-X1-SERIES-9',
        powertrainSpec: isEv ? 'Permanent Magnet Synchronous Motor (300kW)' : '2.0L Turbocharged Direct Injection',
        emissionsStandard: isEv ? 'ZERO_EMISSION_ZEV' : 'BS-VI Stage 2 / Euro 6d',
        tamperEvidentSealId: `SEAL-${vehicle.vin.slice(-6)}`,
        blockchainTxHash: txHash,
        verifiedOnChain: true,
      },
      batteryPassport: isEv
        ? {
            id: `bat-pass-${vehicle.id}`,
            vehicleId: vehicle.id,
            batteryId: `BAT-${vehicle.vin.slice(-8)}`,
            chemistry: 'LITHIUM_NICKEL_MANGANESE_COBALT_NMC',
            nominalCapacityKwh: 78.5,
            currentStateOfHealthPct: 97.4,
            cycleCount: 142,
            carbonFootprintKgCo2: 4120,
            manufacturingOrigin: 'CATL Gigafactory Europe',
            recycledMaterialContentPct: 24.5,
            passportStandard: 'EU_BATTERY_REGULATION_2023_1542',
            blockchainTxHash: txHash,
            verifiedOnChain: true,
          }
        : null,
      insuranceIntelligence: {
        totalPoliciesCount: 1,
        activePolicy: {
          id: `pol-${vehicle.id}`,
          policyNumber: `POL-${vehicle.passportId}-2026`,
          providerName: 'SafeShield Underwriters Ltd.',
          provider: 'SafeShield Underwriters Ltd.',
          coverageType: 'COMPREHENSIVE_ZERO_DEP',
          startDate: '2026-01-10T00:00:00.000Z',
          endDate: '2027-01-10T00:00:00.000Z',
          status: 'ACTIVE',
        },
        coverageContinuity: 'CONTINUOUS' as const,
        totalClaimsCount: 0,
        totalClaimAmountApproved: 0,
        claims: [],
        accidentCorrelation: {
          totalAccidents: 0,
          linkedToClaimsCount: 0,
          unlinkedAccidentsCount: 0,
          correlationStatus: 'NO_CLAIMS' as const,
        },
        riskObservations: [
          'Full comprehensive insurance coverage maintained without gaps',
          'Clean claims history verified against immutable policy records',
        ],
        underwritingRiskScore: 95,
        discountRecommendationPct: 15,
      },
      garageIntelligence: {
        vehicleId: vehicle.id,
        totalServicesPerformed: 2,
        servicingGaragesCount: 1,
        allGaragesVerified: true,
        networkSummary: [
          {
            garageId: 'apex-001',
            garageName: 'Apex Certified Garage',
            verificationStatus: 'VERIFIED',
            trustIndex: 98,
            servicesOnThisVehicle: 2,
            hasBlockchainAnchors: true,
          },
        ],
      },
      ecosystemTimeline: [
        {
          id: 'eco-1',
          date: '2024-04-12T08:00:00.000Z',
          category: 'MANUFACTURING',
          title: 'Digital Birth Certificate Minted',
          description: `OEM manufacturing certificate verified and anchored on-chain.`,
          actor: vehicle.manufacturer,
          blockchainTxHash: txHash,
        },
        {
          id: 'eco-2',
          date: '2026-01-10T00:00:00.000Z',
          category: 'INSURANCE',
          title: 'SafeShield Comprehensive Policy Bound',
          description: `Insurance policy committed to decentralized verification registry.`,
          actor: 'SafeShield Underwriters Ltd.',
          blockchainTxHash: txHash,
        },
      ],
      generatedAt: nowIso,
    };

    return NextResponse.json({
      success: true,
      data: ecosystemOverview,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
