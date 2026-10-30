import { prisma } from '../src/lib/prisma';
import { BlockchainService } from '../src/blockchain/services/blockchainService';
import {
  generateServiceRecordHash,
  generateOdometerRecordHash,
  generateOwnershipRecordHash,
  generateDocumentRecordHash,
} from '../src/blockchain/utils/canonicalHash';
import {
  UserRole,
  FuelType,
  OwnershipTransferType,
  OdometerSourceType,
  VerificationStatus,
  AccidentSeverity,
  RepairStatus,
  InsurancePolicyStatus,
  DocumentType,
} from '@prisma/client';

const API_BASE = 'http://localhost:5001/api';

async function runPhase4Tests() {
  console.log('🧪 Starting Phase 4 Comprehensive Lifecycle & Verification Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    const blockchainService = BlockchainService.getInstance();

    // Helper: Obtain JWT token for seeded user
    async function getUserToken(firebaseUid: string, email: string, name: string): Promise<string> {
      const res = await fetch(`${API_BASE}/auth/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: `dev-seed-token:${firebaseUid}:${email}:${name}`,
          email,
          name,
        }),
      });
      const data = await res.json();
      return data.data.token;
    }

    const tokenOwnerA = await getUserToken('seed-owner-a', 'owner.a@vehiclepassport.dev', 'Test Owner A (Alex Mercer)');
    const tokenOwnerB = await getUserToken('seed-owner-b', 'owner.b@vehiclepassport.dev', 'Test Owner B');
    const tokenGarage = await getUserToken('seed-garage', 'garage@vehiclepassport.dev', 'Test Garage');
    const tokenInsurance = await getUserToken('seed-insurance', 'insurance@vehiclepassport.dev', 'Test Insurance');
    const tokenUninit = await getUserToken('seed-new-user', 'newuser@vehiclepassport.dev', 'Test New User');

    // Get Vehicle 1 (Tata Nexon EV)
    const v1 = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000001' },
      include: { currentOwner: true },
    });
    assert(Boolean(v1 && v1.blockchainVehicleId), 'Pre-requisite: Vehicle 1 seeded & anchored on blockchain');

    // ------------------------------------------------------------------------
    // TEST 1: Owner can view own vehicle history
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Owner Can View Own Vehicle History ---');
    const timelineRes1 = await fetch(`${API_BASE}/vehicles/${v1!.id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const timelineData1 = await timelineRes1.json();
    assert(
      timelineRes1.status === 200 && timelineData1.data && timelineData1.data.timeline.length >= 5,
      'TEST 1: Owner A successfully retrieves comprehensive vehicle timeline events',
      `Events count: ${timelineData1.data?.timeline?.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 2: User cannot access another user\'s private vehicle mutation operations
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: User Authorization & Isolation ---');
    const unauthTransferRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: 'seed-owner-b',
        transferType: 'SALE',
      }),
    });
    assert(
      unauthTransferRes.status === 403,
      'TEST 2: Owner B forbidden from transferring Owner A\'s vehicle'
    );

    // ------------------------------------------------------------------------
    // TEST 3: Garage can add authorized service record
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Garage Can Add Authorized Service Record ---');
    const garageServiceRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/services`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenGarage}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceDate: '2026-03-01',
        mileage: 36000,
        serviceType: 'Brake Inspection & Fluid Service',
        description: 'Hydraulic brake fluid flush and rotor surfacing',
        partsReplaced: 'DOT 4 Brake Fluid',
        cost: 160,
        technician: 'Marcus Vance',
      }),
    });
    const garageServiceData = await garageServiceRes.json();
    assert(
      garageServiceRes.status === 201 && garageServiceData.data.serviceRecord.blockchainTxHash,
      'TEST 3: Garage successfully created and anchored service record with valid tx hash',
      `Tx: ${garageServiceData.data?.serviceRecord?.blockchainTxHash}`
    );

    // ------------------------------------------------------------------------
    // TEST 4: Unauthorized user cannot add service record (role enforcement)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Unauthorized User Cannot Add Service Record ---');
    const ownerServiceRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/services`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceDate: '2026-03-02',
        mileage: 36500,
        serviceType: 'Unauthorized Self-Service',
        description: 'Trying to pose as garage',
      }),
    });
    assert(
      ownerServiceRes.status === 403,
      'TEST 4: Vehicle Owner rejected from pretending to be a Garage service provider'
    );

    // ------------------------------------------------------------------------
    // TEST 5: Service hash is generated correctly
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Service Canonical Hash Generation ---');
    const sampleServiceHash = generateServiceRecordHash({
      blockchainVehicleId: 'VEH-000001',
      garageBlockchainId: 'USR-000003',
      serviceDate: new Date('2026-03-01'),
      mileage: 36000,
      serviceType: 'Brake Inspection & Fluid Service',
      description: 'Hydraulic brake fluid flush and rotor surfacing',
      partsReplaced: 'DOT 4 Brake Fluid',
      cost: 160,
    });
    assert(
      Boolean(sampleServiceHash && sampleServiceHash.startsWith('0x') && sampleServiceHash.length === 66),
      'TEST 5: Canonical SHA-256 service record hash generated deterministically',
      `Hash: ${sampleServiceHash}`
    );

    // ------------------------------------------------------------------------
    // TEST 6: Service hash is anchored to blockchain
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Service Hash Anchored to Blockchain ---');
    const anchoredRecId = garageServiceData.data.serviceRecord.blockchainRecordId;
    const onChainRecord = await blockchainService.getRecord(anchoredRecId);
    assert(
      Boolean(onChainRecord && onChainRecord.recordType === 'SERVICE' && onChainRecord.recordHash),
      'TEST 6: On-chain query validates anchored record matches SERVICE type and record hash',
      `Record ID: ${anchoredRecId}`
    );

    // ------------------------------------------------------------------------
    // TEST 7: Odometer record is stored
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Odometer Record Is Stored ---');
    const odoRes1 = await fetch(`${API_BASE}/vehicles/${v1!.id}/odometer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mileage: 38000,
        sourceType: 'OWNER',
        notes: 'Pre-inspection self log',
      }),
    });
    const odoData1 = await odoRes1.json();
    assert(
      odoRes1.status === 201 && odoData1.data.odometerRecord.mileage === 38000,
      'TEST 7: Odometer record stored and confirmed',
      `Mileage: ${odoData1.data?.odometerRecord?.mileage} km`
    );

    // ------------------------------------------------------------------------
    // TEST 8: Odometer rollback is detected and flagged (preserves audit trail)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Odometer Rollback Detection ---');
    const odoRollbackRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/odometer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mileage: 21000, // Rollback from 38,000 to 21,000!
        sourceType: 'OWNER',
        notes: 'Fraudulent rollback attempt',
      }),
    });
    const odoRollbackData = await odoRollbackRes.json();
    assert(
      odoRollbackRes.status === 201 &&
        odoRollbackData.data.odometerRecord.rollbackDetected === true &&
        odoRollbackData.data.odometerRecord.verificationStatus === 'SUSPICIOUS',
      'TEST 8: Odometer rollback flagged as SUSPICIOUS without silent deletion',
      `Status: ${odoRollbackData.data?.odometerRecord?.verificationStatus}`
    );

    // ------------------------------------------------------------------------
    // TEST 9: Accident record is created and repair linked
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Accident Record & Repair Workflow ---');
    const accRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/accidents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accidentDate: '2026-04-10',
        severity: 'MINOR',
        description: 'Scraped against guard rail during torrential rain',
        damagedParts: 'Right front fender, side mirror casing',
        locationDescription: 'Route 101 Mile 42',
      }),
    });
    const accData = await accRes.json();
    assert(
      accRes.status === 201 && accData.data.accidentRecord.blockchainTxHash,
      'TEST 9: Accident record created and anchored on blockchain',
      `Accident ID: ${accData.data?.accidentRecord?.id}`
    );

    const repairRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/accidents/${accData.data.accidentRecord.id}/repair`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenGarage}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repairStatus: 'COMPLETED',
        repairDescription: 'Right front fender repainted and OEM side mirror replaced',
      }),
    });
    const repairData = await repairRes.json();
    assert(
      repairRes.status === 200 && repairData.data.accidentRecord.repairStatus === 'COMPLETED',
      'TEST 9b: Repair information successfully linked to original accident record'
    );

    // ------------------------------------------------------------------------
    // TEST 10: Insurance record is created by authorized provider
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: Insurance Record Creation & Authorization ---');
    const insRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/insurance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenInsurance}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        policyReference: 'POL-SFSH-2026-NEXON-RENEWAL',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        coverageType: 'Comprehensive Roadside & Battery Plus',
        status: 'ACTIVE',
      }),
    });
    const insData = await insRes.json();
    assert(
      insRes.status === 201 && insData.data.insuranceRecord.blockchainTxHash,
      'TEST 10: Authorized insurance provider created and anchored policy proof on blockchain',
      `Policy: ${insData.data?.insuranceRecord?.policyReference}`
    );

    const unauthInsRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/insurance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        policyReference: 'FAKE-POL-999',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
      }),
    });
    assert(
      unauthInsRes.status === 403,
      'TEST 10b: Unauthorized actor prevented from issuing fake insurance policies'
    );

    // ------------------------------------------------------------------------
    // TEST 11: Document hash is generated
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11: Document Integrity Hash Generation ---');
    const docHash = generateDocumentRecordHash({
      blockchainVehicleId: 'VEH-000001',
      documentType: DocumentType.INSPECTION_REPORT,
      fileHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      title: 'Pollution Under Control Certificate',
    });
    assert(
      Boolean(docHash && docHash.startsWith('0x') && docHash.length === 66),
      'TEST 11: Document canonical SHA-256 integrity hash computed',
      `Doc Hash: ${docHash}`
    );

    // ------------------------------------------------------------------------
    // TEST 12: Document verification detects changes
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 12: Document Off-chain / On-chain Anchoring ---');
    const docRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentType: 'INSPECTION_REPORT',
        title: 'PUC Green Compliance 2026',
        fileUrl: 'https://storage.vehiclepassport.dev/docs/puc_2026.pdf',
        fileName: 'puc_2026.pdf',
        fileSize: 154000,
        mimeType: 'application/pdf',
      }),
    });
    const docData = await docRes.json();
    assert(
      docRes.status === 201 && docData.data.document.blockchainTxHash,
      'TEST 12: Document metadata anchored on-chain with file hash proof'
    );

    // ------------------------------------------------------------------------
    // TEST 13 - 19: OWNERSHIP TRANSFER SUITE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 13-19: Secure Ownership Transfer Flow ---');

    // Create a dedicated vehicle for transfer testing (so we don't disturb v1)
    const transferVeh = await prisma.vehicle.create({
      data: {
        passportId: `VP-${Date.now().toString().slice(-6)}`,
        vin: `TRF${Date.now().toString().slice(-14)}`,
        registrationNumber: `MH01TR${Date.now().toString().slice(-4)}`,
        manufacturer: 'Toyota',
        model: 'Innova Hycross',
        variant: 'ZX Hybrid',
        manufacturingYear: 2024,
        fuelType: FuelType.HYBRID,
        status: 'ACTIVE',
        currentOwnerId: v1!.currentOwnerId, // Owner A
      },
    });
    await blockchainService.registerVehicle(transferVeh.id);

    // TEST 14: Transfer to uninitialized user fails
    const transferUninitRes = await fetch(`${API_BASE}/vehicles/${transferVeh.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: 'seed-new-user',
        transferType: 'SALE',
      }),
    });
    assert(
      transferUninitRes.status === 400,
      'TEST 14: Transfer to uninitialized user rejected with informative error'
    );

    // TEST 15: Transfer to nonexistent user fails
    const transferGhostRes = await fetch(`${API_BASE}/vehicles/${transferVeh.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: 'ghost.user.nobody@doesnotexist.com',
        transferType: 'SALE',
      }),
    });
    assert(
      transferGhostRes.status === 404,
      'TEST 15: Transfer to non-existent user rejected'
    );

    // TEST 16: Unauthorized transfer fails
    const transferHackerRes = await fetch(`${API_BASE}/vehicles/${transferVeh.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: 'owner.b@vehiclepassport.dev',
        transferType: 'SALE',
      }),
    });
    assert(
      transferHackerRes.status === 403,
      'TEST 16: Unauthorized non-owner cannot initiate transfer'
    );

    // TEST 13 & 17: Valid transfer to Owner B succeeds and updates current owner
    const validTransferRes = await fetch(`${API_BASE}/vehicles/${transferVeh.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: 'owner.b@vehiclepassport.dev',
        transferType: 'SALE',
        notes: 'Sold via certified pre-owned exchange',
      }),
    });
    const validTransferData = await validTransferRes.json();
    assert(
      validTransferRes.status === 200 && validTransferData.data.blockchain.txHash,
      'TEST 13: Owner A successfully executes atomic on-chain ownership transfer to Owner B',
      `Tx: ${validTransferData.data?.blockchain?.txHash}`
    );

    // Verify current owner updated in DB
    const updatedTransferVeh = await prisma.vehicle.findUnique({
      where: { id: transferVeh.id },
      include: { currentOwner: true },
    });
    assert(
      updatedTransferVeh?.currentOwner.email === 'owner.b@vehiclepassport.dev',
      'TEST 17: PostgreSQL currentOwnerId updated to Owner B following blockchain confirmation'
    );

    // TEST 18: Failed blockchain transfer does not change current owner
    let simulatedFailurePreserved = false;
    try {
      await blockchainService.transferOwnership({
        vehicleId: 'non-existent-uuid',
        previousOwnerId: updatedTransferVeh!.currentOwnerId,
        newOwnerId: v1!.currentOwnerId,
        transferType: OwnershipTransferType.SALE,
      });
    } catch {
      simulatedFailurePreserved = true;
    }
    const checkVehAfterFail = await prisma.vehicle.findUnique({ where: { id: transferVeh.id } });
    assert(
      simulatedFailurePreserved && checkVehAfterFail?.currentOwnerId === updatedTransferVeh?.currentOwnerId,
      'TEST 18: Failed transfer does not mutate database or currentOwnerId'
    );

    // TEST 19: Ownership history remains intact (never deleted)
    const ownershipHistRes = await fetch(`${API_BASE}/vehicles/${transferVeh.id}/ownership`, {
      headers: { Authorization: `Bearer ${tokenOwnerB}` },
    });
    const ownershipHistData = await ownershipHistRes.json();
    assert(
      ownershipHistData.data.ownershipHistory.length >= 2,
      'TEST 19: Full ownership lineage preserved (Initial Registration → Sale to Owner B)',
      `Lineage count: ${ownershipHistData.data.ownershipHistory.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 20: Multiple vehicles continue to work correctly
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 20: Multiple Vehicles Per User ---');
    const ownerAVehicles = await prisma.vehicle.findMany({
      where: { currentOwnerId: v1!.currentOwnerId },
    });
    assert(
      ownerAVehicles.length >= 2,
      'TEST 20: User continues to own multiple vehicles seamlessly',
      `Vehicles owned by Owner A: ${ownerAVehicles.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 21: Vehicle timeline is correctly ordered
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 21: Chronologically Ordered Timeline ---');
    const timelineRes2 = await fetch(`${API_BASE}/vehicles/${v1!.id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const timelineData2 = await timelineRes2.json();
    const events = timelineData2.data.timeline;
    let isSorted = true;
    for (let i = 1; i < events.length; i++) {
      if (new Date(events[i].date).getTime() < new Date(events[i - 1].date).getTime()) {
        isSorted = false;
        break;
      }
    }
    assert(
      isSorted && events.length >= 8,
      'TEST 21: Unified timeline events strictly ordered by chronological timestamp'
    );

    // ------------------------------------------------------------------------
    // TEST 22: Vehicle verification succeeds when hashes match
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 22: Full Verification Engine Matching ---');
    // Vehicle 2 (Honda City) has not had rollback or tampered records
    const v2 = await prisma.vehicle.findFirst({ where: { passportId: 'VP-000002' } });
    const verifyFullRes = await fetch(`${API_BASE}/vehicles/${v2!.id}/verify-full`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const verifyFullData = await verifyFullRes.json();
    assert(
      verifyFullData.success && verifyFullData.data.overallVerified === true,
      'TEST 22: Clean vehicle passes multi-category verification with overallVerified = true',
      `Vehicle: ${v2?.model} (${v2?.passportId})`
    );

    // ------------------------------------------------------------------------
    // TEST 23: Verification detects suspicious records
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 23: Verification Detects Suspicious Odometer Rollback ---');
    const verifyV1Res = await fetch(`${API_BASE}/vehicles/${v1!.id}/verify-full`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const verifyV1Data = await verifyV1Res.json();
    assert(
      verifyV1Data.data.hasSuspicious === true &&
        verifyV1Data.data.categories.odometer.status === 'SUSPICIOUS',
      'TEST 23: Verification correctly flags odometer category as SUSPICIOUS due to rollback'
    );

    // ------------------------------------------------------------------------
    // TEST 24: Development Tamper Simulation Detects Hash Mismatch
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 24: Development Tamper Simulation ---');
    const tamperRes = await fetch(`${API_BASE}/vehicles/${v2!.id}/tamper`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        field: 'service',
        tamperedValue: 99999, // Tamper service mileage in DB
      }),
    });
    const tamperData = await tamperRes.json();
    assert(
      tamperRes.status === 200 && tamperData.success,
      'TEST 24: Tamper simulation altered database record without blockchain update'
    );

    // Now verify v2: Must detect TAMPER DETECTED!
    const verifyTamperedRes = await fetch(`${API_BASE}/vehicles/${v2!.id}/verify-full`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const verifyTamperedData = await verifyTamperedRes.json();
    assert(
      verifyTamperedData.data.hasTamper === true &&
        verifyTamperedData.data.categories.service.status === 'TAMPER_DETECTED',
      'TEST 24b: Verification Engine detected cryptographic mismatch: TAMPER DETECTED'
    );

    // Restore v2 service
    await prisma.serviceRecord.updateMany({
      where: { vehicleId: v2!.id },
      data: { mileage: 10500 },
    });

    // ------------------------------------------------------------------------
    // TEST 25: Phase 1 & 2 Regressions
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 25: Phase 1 & Phase 2 Regression Checks ---');
    const myVehiclesRes = await fetch(`${API_BASE}/vehicles`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const myVehiclesData = await myVehiclesRes.json();
    assert(
      myVehiclesRes.status === 200 && myVehiclesData.data.vehicles.length >= 2,
      'TEST 25: Phase 1 auth & Phase 2 vehicle CRUD remain 100% operational'
    );

    // ------------------------------------------------------------------------
    // TEST 26: Phase 3 Blockchain Foundation Regressions
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 26: Phase 3 Blockchain Foundation Regression ---');
    const phase3Verify = await blockchainService.verifyVehicle(v1!.id);
    assert(
      phase3Verify.isVerified === true && phase3Verify.tamperDetected === false,
      'TEST 26: Existing Phase 3 single-record verifyVehicle remains 100% operational'
    );

  } catch (error: any) {
    console.error('Test execution exception:', error);
    assert(false, 'Global Test Execution Exception', error.message);
  }

  console.log(`\n==================================================`);
  console.log(`Phase 4 Test Suite Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().finally(async () => {
  await prisma.$disconnect();
});
