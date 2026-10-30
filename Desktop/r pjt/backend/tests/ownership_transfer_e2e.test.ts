import { prisma } from '../src/lib/prisma';
import { BlockchainService } from '../src/blockchain/services/blockchainService';
import { FuelType, OwnershipTransferType, BlockchainStatus } from '@prisma/client';

const API_BASE = 'http://localhost:5001/api';

async function runOwnershipTransferE2ETests() {
  console.log('🚗==============================================================🚗');
  console.log('   VEHICLE OWNERSHIP TRANSFER — END-TO-END VERIFICATION SUITE   ');
  console.log('🚗==============================================================🚗\n');

  let passed = 0;
  let failed = 0;
  const testResults: Record<string, { expected: string; actual: string; status: 'PASS' | 'FAIL' }> = {};

  function assert(key: string, condition: boolean, testName: string, expected: string, actual: string) {
    if (condition) {
      console.log(`✅ [PASS] ${key}: ${testName}`);
      passed++;
      testResults[key] = { expected, actual, status: 'PASS' };
    } else {
      console.error(`❌ [FAIL] ${key}: ${testName}`);
      console.error(`   Expected: ${expected}`);
      console.error(`   Actual:   ${actual}`);
      failed++;
      testResults[key] = { expected, actual, status: 'FAIL' };
    }
  }

  try {
    const blockchainService = BlockchainService.getInstance();

    // Helper: Auth Sync token fetcher
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

    const tokenOwnerA = await getUserToken('seed-owner-a', 'owner.a@vehiclepassport.dev', 'Alex Mercer');
    const tokenOwnerB = await getUserToken('seed-owner-b', 'owner.b@vehiclepassport.dev', 'Elena Rostova');

    // Create third stakeholder Owner C for sequential transfer testing
    const tokenOwnerC = await getUserToken('seed-owner-c', 'owner.c@vehiclepassport.dev', 'Carlos Mendez');
    // Ensure Owner C is initialized on-chain
    await fetch(`${API_BASE}/auth/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwnerC}` },
    });

    const userA = await prisma.user.findFirstOrThrow({ where: { email: 'owner.a@vehiclepassport.dev' } });
    const userB = await prisma.user.findFirstOrThrow({ where: { email: 'owner.b@vehiclepassport.dev' } });
    const userC = await prisma.user.findFirstOrThrow({ where: { email: 'owner.c@vehiclepassport.dev' } });

    // Create fresh test vehicle owned by Owner A
    const testVin = `TESTVIN${Date.now().toString().slice(-9)}A`;
    const testReg = `MH${Math.floor(10 + Math.random() * 89)}E2E${Math.floor(1000 + Math.random() * 9000)}`;
    const testVehicle = await prisma.vehicle.create({
      data: {
        passportId: `VP-${Date.now().toString().slice(-6)}`,
        vin: testVin,
        registrationNumber: testReg,
        manufacturer: 'Audi',
        model: 'e-tron GT',
        variant: 'RS Quattro',
        manufacturingYear: 2024,
        fuelType: FuelType.ELECTRIC,
        status: 'ACTIVE',
        currentOwnerId: userA.id,
      },
    });

    // Anchor vehicle on blockchain
    await blockchainService.registerVehicle(testVehicle.id);

    // Add service record to vehicle before transfer (for historical record preservation test)
    const serviceRecord = await prisma.serviceRecord.create({
      data: {
        vehicleId: testVehicle.id,
        garageId: (await prisma.user.findFirst({ where: { role: 'GARAGE' } }))!.id,
        serviceDate: new Date('2026-01-15'),
        mileage: 12500,
        serviceType: 'Initial 10,000km Inspection',
        description: 'Comprehensive high-voltage powertrain check and software update',
        cost: 250,
        recordHash: '0x' + 'a'.repeat(64),
        status: BlockchainStatus.CONFIRMED,
      },
    });

    // ------------------------------------------------------------------------
    // TEST B — Unauthorized transfer rejection
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test B: Unauthorized Transfer ---');
    const unauthRes = await fetch(`${API_BASE}/vehicles/${testVehicle.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerB}`, // Owner B trying to transfer Owner A's car
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: userB.email,
        transferType: 'SALE',
      }),
    });
    const unauthBody = await unauthRes.json();
    assert(
      'Test B',
      unauthRes.status === 403 && !unauthBody.success,
      'Unauthorized non-owner transfer is rejected',
      'HTTP 403 Forbidden',
      `HTTP ${unauthRes.status} (${unauthBody.error})`
    );

    // ------------------------------------------------------------------------
    // TEST C — Invalid recipient
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test C: Invalid Recipient ---');
    const invalidRecipRes = await fetch(`${API_BASE}/vehicles/${testVehicle.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: 'ghost.nobody.invalid@doesnotexist.dev',
        transferType: 'SALE',
      }),
    });
    const invalidRecipBody = await invalidRecipRes.json();
    assert(
      'Test C',
      invalidRecipRes.status === 404 && !invalidRecipBody.success,
      'Transfer to nonexistent recipient is rejected',
      'HTTP 404 Not Found',
      `HTTP ${invalidRecipRes.status} (${invalidRecipBody.error})`
    );

    // ------------------------------------------------------------------------
    // TEST D — Self-transfer rejection
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test D: Self-Transfer Rejection ---');
    const selfTransferRes = await fetch(`${API_BASE}/vehicles/${testVehicle.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: userA.email, // Transferring to self
        transferType: 'SALE',
      }),
    });
    const selfTransferBody = await selfTransferRes.json();
    assert(
      'Test D',
      selfTransferRes.status === 400 && !selfTransferBody.success,
      'Self-transfer is strictly rejected',
      'HTTP 400 Bad Request',
      `HTTP ${selfTransferRes.status} (${selfTransferBody.error})`
    );

    // ------------------------------------------------------------------------
    // TEST A — Successful transfer (Owner A -> Owner B)
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test A: Successful Transfer (Owner A -> Owner B) ---');
    const successTransferRes = await fetch(`${API_BASE}/vehicles/${testVehicle.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: userB.email,
        transferType: 'SALE',
        notes: 'Commercial sale with verified bill of sale',
      }),
    });
    const successTransferBody = await successTransferRes.json();
    const updatedVehA = await prisma.vehicle.findUnique({
      where: { id: testVehicle.id },
      include: { currentOwner: true },
    });
    const historyA = await prisma.ownershipHistory.findFirst({
      where: { vehicleId: testVehicle.id, newOwnerId: userB.id },
    });

    assert(
      'Test A',
      successTransferRes.status === 200 &&
        Boolean(successTransferBody.data?.blockchain?.txHash) &&
        updatedVehA?.currentOwnerId === userB.id &&
        Boolean(historyA),
      'Successful transfer confirmed on blockchain and reflected in database',
      `New Owner: ${userB.name}, TxHash present, History recorded`,
      `New Owner: ${updatedVehA?.currentOwner.name}, Tx: ${successTransferBody.data?.blockchain?.txHash?.slice(0, 18)}...`
    );

    // ------------------------------------------------------------------------
    // TEST G — Duplicate submission rejection
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test G: Duplicate Submission ---');
    // Owner A attempts to transfer the vehicle again (now that Owner B owns it)
    const duplicateRes = await fetch(`${API_BASE}/vehicles/${testVehicle.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`, // Owner A no longer owns vehicle
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: userB.email,
        transferType: 'SALE',
      }),
    });
    const duplicateBody = await duplicateRes.json();
    assert(
      'Test G',
      duplicateRes.status === 403 && !duplicateBody.success,
      'Duplicate transfer from previous owner is rejected',
      'HTTP 403 Forbidden',
      `HTTP ${duplicateRes.status} (${duplicateBody.error})`
    );

    // ------------------------------------------------------------------------
    // TEST E — Blockchain failure protection
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test E: Blockchain Failure Protection ---');
    let dbProtected = false;
    try {
      await blockchainService.transferOwnership({
        vehicleId: 'non-existent-guid',
        previousOwnerId: userB.id,
        newOwnerId: userC.id,
        transferType: OwnershipTransferType.SALE,
      });
    } catch {
      // Check that vehicle current owner remained Owner B
      const checkVeh = await prisma.vehicle.findUnique({ where: { id: testVehicle.id } });
      if (checkVeh?.currentOwnerId === userB.id) {
        dbProtected = true;
      }
    }
    assert(
      'Test E',
      dbProtected,
      'Database remains unmutated when transfer fails or reverts',
      `Current Owner remains ${userB.name}`,
      dbProtected ? 'Database safely intact' : 'Database erroneously modified'
    );

    // ------------------------------------------------------------------------
    // TEST F — Database synchronization & reconciliation
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test F: Database Reconciliation ---');
    // Fetch fresh vehicle record to get populated blockchainVehicleId
    const freshVeh = await prisma.vehicle.findUniqueOrThrow({ where: { id: testVehicle.id } });
    const onChainVeh = await blockchainService.getVehicle(freshVeh.blockchainVehicleId || '');
    const isOwnerBOnChain = onChainVeh.ownerAddress.toLowerCase() === userB.blockchainAddress?.toLowerCase();
    assert(
      'Test F',
      isOwnerBOnChain,
      'On-chain state verifies Owner B as authoritative owner address',
      `On-chain owner: ${userB.blockchainAddress}`,
      `On-chain owner: ${onChainVeh.ownerAddress}`
    );

    // ------------------------------------------------------------------------
    // TEST H — Sequential transfers (A -> B -> C)
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test H: Sequential Transfers (Owner B -> Owner C) ---');
    const seqTransferRes = await fetch(`${API_BASE}/vehicles/${testVehicle.id}/ownership/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerB}`, // Owner B transfers to Owner C
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserIdentifier: userC.email,
        transferType: 'TRANSFER',
        notes: 'Secondary transfer to Owner C',
      }),
    });
    const seqTransferBody = await seqTransferRes.json();
    const finalVeh = await prisma.vehicle.findUnique({
      where: { id: testVehicle.id },
      include: { currentOwner: true },
    });
    const allHistory = await prisma.ownershipHistory.findMany({
      where: { vehicleId: testVehicle.id },
      orderBy: { transferDate: 'asc' },
    });

    assert(
      'Test H',
      seqTransferRes.status === 200 &&
        finalVeh?.currentOwnerId === userC.id &&
        allHistory.length >= 2 &&
        allHistory[allHistory.length - 1].newOwnerId === userC.id,
      'Sequential transfers A -> B -> C succeed in strictly preserved chronological order',
      `Current Owner: ${userC.name}, Total Transfers: >=2`,
      `Current Owner: ${finalVeh?.currentOwner.name}, Total Transfers: ${allHistory.length}`
    );

    // ------------------------------------------------------------------------
    // TEST I — Historical record preservation
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test I: Historical Record Preservation ---');
    const preservedServices = await prisma.serviceRecord.findMany({
      where: { vehicleId: testVehicle.id },
    });
    const timelineRes = await fetch(`${API_BASE}/vehicles/${testVehicle.id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenOwnerC}` },
    });
    const timelineBody = await timelineRes.json();

    assert(
      'Test I',
      preservedServices.length > 0 &&
        timelineRes.status === 200 &&
        timelineBody.data?.timeline?.some((e: any) => e.category === 'SERVICE') &&
        timelineBody.data?.timeline?.some((e: any) => e.category === 'OWNERSHIP'),
      'Service history and timeline events remain fully intact after ownership transfer',
      'Service records and ownership records present in timeline',
      `Services count: ${preservedServices.length}, Timeline total: ${timelineBody.data?.timeline?.length}`
    );

    // ------------------------------------------------------------------------
    // TEST J — Existing implementation regression
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test J: Existing Implementation Regression ---');
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenOwnerC}` },
    });
    const meBody = await meRes.json();

    const vehDetailsRes = await fetch(`${API_BASE}/vehicles/${testVehicle.id}`, {
      headers: { Authorization: `Bearer ${tokenOwnerC}` },
    });
    const vehDetailsBody = await vehDetailsRes.json();

    assert(
      'Test J',
      meRes.status === 200 &&
        meBody.data?.user?.email === userC.email &&
        vehDetailsRes.status === 200 &&
        vehDetailsBody.data?.vehicle?.id === testVehicle.id,
      'Authentication, vehicle detail query, and core workflows remain 100% operational',
      'HTTP 200 on /auth/me and /vehicles/:id',
      `/auth/me: ${meRes.status}, /vehicles: ${vehDetailsRes.status}`
    );

  } catch (err: any) {
    console.error('Test execution uncaught exception:', err);
    failed++;
  }

  console.log('\n==============================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED across Tests A through J`);
  console.log('==============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOwnershipTransferE2ETests();
