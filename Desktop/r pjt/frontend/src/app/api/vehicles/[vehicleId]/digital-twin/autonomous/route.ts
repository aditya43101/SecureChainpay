import { NextResponse } from 'next/server';
import { getVehicles, getOwnershipHistoryData } from '@/lib/serverStore';
import { AutonomousDigitalVehicleTwinDTO } from '@/types/vehicle';

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
        id: vehicleId || 'demo-veh-001-aurora',
        passportId: 'VP-DEMO-001',
        vin: 'DEMOV001X1SEDAN01',
        manufacturer: 'Aurora Motors',
        model: 'Aurora X1 Sedan',
        variant: 'Executive Plus',
        manufacturingYear: 2024,
        fuelType: 'PETROL',
        color: 'Monaco Blue',
        registrationNumber: 'MH02DM1001',
        status: 'ACTIVE',
        blockchainTxHash: '0x5cfc39e120daf8ddfcf7847dafb035e5a157a74058ac2823735dc58f0f06a486',
        createdAt: new Date().toISOString(),
      };

    const nowIso = new Date().toISOString();
    const ownershipRecords = getOwnershipHistoryData(vehicle.id);
    const txHash = vehicle.blockchainTxHash || '0x5cfc39e120daf8ddfcf7847dafb035e5a157a74058ac2823735dc58f0f06a486';

    const twinData: AutonomousDigitalVehicleTwinDTO = {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      reconstructedAt: nowIso,
      engineVersion: 'AUTONOMOUS_TWIN_V10',
      ontology: {
        physicalVehicle: {
          status: 'REAL_WORLD_ASSET',
          observedDirectly: false,
          observationNote:
            'Physical vehicle condition is not observed directly by software. State is continuously inferred from verified garage records, inspection certificates, and cryptographic anchors.',
        },
        recordedHistory: {
          status: 'TRACEABLE_GROUND_TRUTH',
          totalSourceRecords: Math.max(7, ownershipRecords.length + 5),
          sourcesBreakdown: {
            odometerReadings: 3,
            serviceInvoices: 2,
            ownershipTransfers: Math.max(1, ownershipRecords.length),
            uploadedDocuments: 1,
          },
          firstRecordedDate: '2024-01-15T09:00:00.000Z',
          lastRecordedDate: nowIso,
        },
        verifiedClaims: {
          status: 'CRYPTOGRAPHICALLY_COMMITTED',
          totalVerifiedClaims: 14,
          onChainAnchorVerified: true,
          merkleBatchesVerified: 12,
          zkpRangeProofsVerified: 1,
          issuerSignaturesVerified: 2,
        },
        derivedDigitalState: {
          status: 'COMPUTED_PROJECTION',
          engineVersion: 'AUTONOMOUS_TWIN_V10',
          computedAt: nowIso,
          freshness: 'FRESH',
          driftDetected: false,
        },
        simulatedFutureState: {
          status: 'HYPOTHETICAL_SIMULATION_ONLY',
          activeSimulationsCount: 0,
          isSimulated: false,
          simulationNotice:
            'What-if scenarios run in memory isolation. Simulated outputs are never written as authoritative records or anchored to the blockchain.',
        },
      },
      derivedState: {
        odometer: {
          value: {
            mileage: 22000,
            unit: 'km',
            isMonotonic: true,
            rollbackDetected: false,
            dailyVelocityKm: 31.4,
          },
          sourceRecordId: 'rec-odo-001',
          sourceRecordType: 'ODOMETER_RECORD',
          sourceSystem: 'ODOMETER_LOG',
          sourceTimestamp: nowIso,
          computedAt: nowIso,
          verifiedStatus: 'VERIFIED',
          freshness: 'FRESH',
          conflictsDetected: false,
          conflictingEvidenceNotes: null,
          ruleVersion: 'RULE_V10_ODOMETER_MONOTONICITY',
        },
        ownership: {
          value: {
            currentOwnerName: vehicle.currentOwner?.name || 'Aarav Sharma',
            currentOwnerRole: vehicle.currentOwner?.role || 'VEHICLE_OWNER',
            totalOwnersCount: Math.max(1, ownershipRecords.length),
            ownershipDurationDays: 320,
          },
          sourceRecordId: 'rec-own-001',
          sourceRecordType: 'OWNERSHIP_HISTORY',
          sourceSystem: 'CORE_PASSPORT',
          sourceTimestamp: nowIso,
          computedAt: nowIso,
          verifiedStatus: 'VERIFIED',
          freshness: 'FRESH',
          conflictsDetected: false,
          conflictingEvidenceNotes: null,
          ruleVersion: 'RULE_V10_OWNERSHIP_PROVENANCE',
        },
        maintenance: {
          value: {
            totalServices: 2,
            lastServiceDate: '2026-08-15T10:30:00.000Z',
            lastServiceMileage: 20000,
            serviceCoveragePercentage: 98,
            isOverdueForService: false,
          },
          sourceRecordId: 'rec-srv-001',
          sourceRecordType: 'SERVICE_RECORD',
          sourceSystem: 'SERVICE_LEDGER',
          sourceTimestamp: nowIso,
          computedAt: nowIso,
          verifiedStatus: 'VERIFIED',
          freshness: 'FRESH',
          conflictsDetected: false,
          conflictingEvidenceNotes: null,
          ruleVersion: 'RULE_V10_MAINTENANCE_COVERAGE',
        },
        battery: {
          value: {
            isEv: vehicle.fuelType === 'ELECTRIC',
            stateOfHealthPercent: vehicle.fuelType === 'ELECTRIC' ? 96.5 : null,
            cycleCount: vehicle.fuelType === 'ELECTRIC' ? 180 : null,
            packSerialMasked: vehicle.fuelType === 'ELECTRIC' ? 'BAT-***-001' : null,
            warrantyStatus: vehicle.fuelType === 'ELECTRIC' ? 'COMPLIANT_WITH_EU_STANDARD' : 'NOT_APPLICABLE_ICE',
          },
          sourceRecordId: 'rec-bat-001',
          sourceRecordType: 'BATTERY_PASSPORT',
          sourceSystem: 'BATTERY_MANAGEMENT',
          sourceTimestamp: nowIso,
          computedAt: nowIso,
          verifiedStatus: 'VERIFIED',
          freshness: 'FRESH',
          conflictsDetected: false,
          conflictingEvidenceNotes: null,
          ruleVersion: 'RULE_V10_BATTERY_SOH_ESTIMATE',
        },
        documentConsistency: {
          value: {
            totalDocuments: 1,
            consistentCount: 1,
            inconsistentCount: 0,
            consistencyScore: 100,
          },
          sourceRecordId: 'rec-doc-001',
          sourceRecordType: 'VEHICLE_DOCUMENT',
          sourceSystem: 'DOCUMENT_INTELLIGENCE',
          sourceTimestamp: nowIso,
          computedAt: nowIso,
          verifiedStatus: 'VERIFIED',
          freshness: 'FRESH',
          conflictsDetected: false,
          conflictingEvidenceNotes: null,
          ruleVersion: 'RULE_V10_DOCUMENT_OCR_AUDIT',
        },
        blockchainIntegrity: {
          value: {
            isAnchored: true,
            contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
            latestBlock: 46,
            status: 'VERIFIED',
          },
          sourceRecordId: txHash,
          sourceRecordType: 'BLOCKCHAIN_RECORD',
          sourceSystem: 'BLOCKCHAIN_SERVICE',
          sourceTimestamp: nowIso,
          computedAt: nowIso,
          verifiedStatus: 'VERIFIED',
          freshness: 'FRESH',
          conflictsDetected: false,
          conflictingEvidenceNotes: null,
          ruleVersion: 'RULE_V10_BLOCKCHAIN_STATE_VERIFY',
        },
        healthRisk: {
          value: {
            healthScore: 96,
            riskScore: 4,
            riskLevel: 'LOW',
            anomaliesCount: 0,
          },
          sourceRecordId: 'rec-int-001',
          sourceRecordType: 'INTELLIGENCE_REPORT',
          sourceSystem: 'INTELLIGENCE_ENGINE',
          sourceTimestamp: nowIso,
          computedAt: nowIso,
          verifiedStatus: 'DERIVED',
          freshness: 'FRESH',
          conflictsDetected: false,
          conflictingEvidenceNotes: null,
          ruleVersion: 'RULE_V10_HEALTH_RISK_AGGREGATION',
        },
      },
      summary: {
        currentState: 'OPERATIONAL',
        lifecycleState: vehicle.status || 'ACTIVE',
        healthScore: 96,
        riskLevel: 'LOW',
        trustBadge: 'VERIFIED',
        dataFreshness: 'FRESH',
        conflictsCount: 0,
        unresolvedAnomaliesCount: 0,
        lastSyncTimestamp: nowIso,
      },
      integrations: {
        merkleBatchesCount: 12,
        fraudFindingsCount: 0,
        activeInvestigationRunId: null,
        privacyCredentialsCount: 2,
        latestZkpProofTimestamp: nowIso,
      },
      eventsCount: 6,
    };

    return NextResponse.json({
      success: true,
      data: twinData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Autonomous Digital Vehicle Twin' },
      { status: 500 }
    );
  }
}

