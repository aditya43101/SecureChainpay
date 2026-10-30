import { prisma } from '../src/lib/prisma';
import { BlockchainService } from '../src/blockchain/services/blockchainService';
import { generateVehicleRecordHash } from '../src/blockchain/utils/canonicalHash';
import { ethers } from 'ethers';


const API_BASE = 'http://localhost:5001/api';

async function runPhase3Tests() {
  console.log('🧪 Starting Phase 3 Blockchain Integration Verification Suite...\n');
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

    // ----------------------------------------------------
    // TEST 1: Deploy Contract & Connectivity
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Smart Contract Deployment & RPC Connectivity ---');
    const contractAddress = blockchainService.getContractAddress();
    assert(
      Boolean(contractAddress && contractAddress.startsWith('0x') && contractAddress.length === 42),
      'TEST 1: Contract deployed and loaded with valid EVM address',
      `Address: ${contractAddress}`
    );

    // ----------------------------------------------------
    // TEST 2: Seed Test Users on Blockchain
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Seed Test Users on Blockchain ---');
    const ownerA = await prisma.user.findFirst({ where: { firebaseUid: 'seed-owner-a' } });
    assert(
      Boolean(ownerA && ownerA.blockchainUserId && ownerA.blockchainTxHash),
      'TEST 2: Seeded user Owner A has blockchain user ID and confirmed transaction',
      `ID: ${ownerA?.blockchainUserId}, Tx: ${ownerA?.blockchainTxHash}`
    );

    const onChainOwnerA = await blockchainService.getUser(ownerA!.blockchainUserId!);
    assert(
      Boolean(onChainOwnerA && onChainOwnerA.active),
      'TEST 2b: On-chain lookup confirms Owner A identity is active'
    );

    // ----------------------------------------------------
    // TEST 3: Initialize Blockchain User via Explicit Passport Initialization
    // ----------------------------------------------------
    console.log('\n--- TEST 3: User Passport Initialization Creates On-Chain Identity ---');
    // Create a fresh test user
    const testUserUid = `test-user-${Date.now()}`;
    const testUserEmail = `user-${Date.now()}@example.com`;
    const syncRes = await fetch(`${API_BASE}/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: `dev-seed-token:${testUserUid}:${testUserEmail}:Autonomous Tester`,
        email: testUserEmail,
        name: 'Autonomous Tester',
      }),
    });

    const syncData = await syncRes.json();
    const testUserToken = syncData.data.token;
    const initialUser = syncData.data.user;

    assert(
      initialUser.isInitialized === false && initialUser.blockchainUserId === null,
      'TEST 3a: New Google user starts strictly uninitialized with no blockchain identity'
    );

    // Now explicitly initialize
    const initRes = await fetch(`${API_BASE}/auth/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testUserToken}`,
        'Content-Type': 'application/json',
      },
    });
    const initData = await initRes.json();
    assert(
      initData.success === true &&
      initData.data.user.isInitialized === true &&
      Boolean(initData.data.user.blockchainUserId) &&
      Boolean(initData.data.user.blockchainTxHash),
      'TEST 3b: Explicit initialization confirms on-chain user identity and records txHash',
      `Blockchain UID: ${initData.data?.user?.blockchainUserId}`
    );

    // ----------------------------------------------------
    // TEST 4: Prevent Duplicate Blockchain User Registration
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Prevent Duplicate Blockchain User Registration ---');
    let duplicateCaught = false;
    try {
      await blockchainService.initializeUser({
        userId: initData.data.user.id,
        firebaseUid: testUserUid,
        role: initData.data.user.role,
      });
      // Should be idempotent and return existing identity without re-creating
      duplicateCaught = true;
    } catch (e) {
      duplicateCaught = false;
    }
    assert(duplicateCaught, 'TEST 4: Idempotent user registration handles repeat call cleanly');

    // ----------------------------------------------------
    // TEST 5: Register Vehicle on Blockchain
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Register Vehicle on Blockchain ---');
    const testSuffix = Math.floor(100000 + Math.random() * 900000).toString();
    const vin1 = `WAUZZZ4K1AA${testSuffix}`;
    const reg1 = `DL01AU${testSuffix.slice(-4)}`;

    const createVehRes = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${initData.data.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Audi',
        model: 'e-tron GT',
        manufacturingYear: 2024,
        fuelType: 'ELECTRIC',
        vin: vin1,
        registrationNumber: reg1,
      }),
    });
    const createVehData = await createVehRes.json();
    const createdVeh = createVehData.data.vehicle;

    assert(
      createVehData.success === true &&
      Boolean(createdVeh.blockchainVehicleId) &&
      Boolean(createdVeh.recordHash) &&
      Boolean(createdVeh.blockchainTxHash) &&
      createdVeh.blockchainStatus === 'CONFIRMED',
      'TEST 5: Vehicle created and automatically registered on blockchain with CONFIRMED status',
      `Blockchain Vehicle ID: ${createdVeh.blockchainVehicleId}, Hash: ${createdVeh.recordHash}`
    );

    // ----------------------------------------------------
    // TEST 6: Prevent Duplicate Vehicle Registration
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Prevent Duplicate Vehicle Registration ---');
    // Attempt to register again via explicit register endpoint
    const dupVehRes = await fetch(`${API_BASE}/blockchain/vehicle/${createdVeh.id}/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${initData.data.token}`,
        'Content-Type': 'application/json',
      },
    });
    const dupVehData = await dupVehRes.json();
    assert(
      dupVehData.success === true &&
      dupVehData.data.blockchain.blockchainVehicleId === createdVeh.blockchainVehicleId,
      'TEST 6: Duplicate vehicle registration handled idempotently without spawning new ID'
    );

    // ----------------------------------------------------
    // TEST 7: Register Multiple Vehicles for One User (1 to N)
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Multiple Vehicles for Single User ---');
    const vin2 = `WP0ZZZY1ZSA${testSuffix}`;
    const reg2 = `DL01PO${testSuffix.slice(-4)}`;

    const createVeh2Res = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${initData.data.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Porsche',
        model: 'Taycan',
        manufacturingYear: 2024,
        fuelType: 'ELECTRIC',
        vin: vin2,
        registrationNumber: reg2,
      }),
    });
    const createVeh2Data = await createVeh2Res.json();
    const createdVeh2 = createVeh2Data.data.vehicle;


    const userVehicles = await prisma.vehicle.findMany({
      where: { currentOwnerId: initData.data.user.id },
    });

    assert(
      userVehicles.length === 2 &&
      userVehicles[0].blockchainVehicleId !== userVehicles[1].blockchainVehicleId,
      'TEST 7: User successfully owns multiple distinct blockchain-registered vehicles',
      `Vehicles: ${userVehicles.map((v) => v.blockchainVehicleId).join(', ')}`
    );

    // ----------------------------------------------------
    // TEST 8: Register Vehicles for Different Users
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Register Vehicles for Different Users ---');
    const ownerBVehicle = await prisma.vehicle.findFirst({
      where: { vin: '5YJ312345TESL0004' },
    });
    assert(
      Boolean(ownerBVehicle && ownerBVehicle.blockchainVehicleId && ownerBVehicle.blockchainVehicleId !== createdVeh.blockchainVehicleId),
      'TEST 8: Owner B owns distinct vehicle registered to Owner B on blockchain',
      `Owner B Vehicle: ${ownerBVehicle?.blockchainVehicleId}`
    );

    // ----------------------------------------------------
    // TEST 9: Anchor a Generic Lifecycle Record
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Anchor Generic Vehicle Record on-chain ---');
    const sampleRecordHash = ethers.keccak256(ethers.toUtf8Bytes(`RECORD_PROOF_${Date.now()}`));
    const recordResult = await blockchainService.anchorRecord({
      vehicleId: createdVeh.id,
      recordType: 'VEHICLE_CREATED',
      recordHash: sampleRecordHash,
    });
    assert(
      Boolean(recordResult.recordId && recordResult.txHash),
      'TEST 9: Generic lifecycle record anchored on blockchain with confirmed receipt',
      `Record ID: ${recordResult.recordId}, Tx: ${recordResult.txHash}`
    );


    // ----------------------------------------------------
    // TEST 10: Verify Matching Hash (Cryptographic Integrity)
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Verify Matching Hash (MATCH → VERIFIED) ---');
    const verifyRes = await fetch(`${API_BASE}/blockchain/vehicle/${createdVeh.id}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${initData.data.token}`,
      },
    });
    const verifyData = await verifyRes.json();
    assert(
      verifyData.success === true &&
      verifyData.data.isVerified === true &&
      verifyData.data.tamperDetected === false &&
      verifyData.data.calculatedHash.toLowerCase() === verifyData.data.onChainHash.toLowerCase(),
      'TEST 10: Canonical hash matches on-chain hash → VERIFIED status confirmed'
    );

    // ----------------------------------------------------
    // TEST 11: Detect Mismatching Hash (TAMPER DETECTED)
    // ----------------------------------------------------
    console.log('\n--- TEST 11: Detect Mismatching Hash (MISMATCH → TAMPER DETECTED) ---');
    // Tamper with the vehicle model directly in the database to simulate DB tampering
    await prisma.vehicle.update({
      where: { id: createdVeh.id },
      data: { model: 'Tampered e-tron FakeEdition' },
    });

    const tamperRes = await fetch(`${API_BASE}/blockchain/vehicle/${createdVeh.id}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${initData.data.token}`,
      },
    });
    const tamperData = await tamperRes.json();
    assert(
      tamperData.success === true &&
      tamperData.data.isVerified === false &&
      tamperData.data.tamperDetected === true &&
      tamperData.data.calculatedHash.toLowerCase() !== tamperData.data.onChainHash.toLowerCase(),
      'TEST 11: Tampering in PostgreSQL detected immediately against on-chain immutable hash'
    );


    // Revert the tamper so test data remains clean
    await prisma.vehicle.update({
      where: { id: createdVeh.id },
      data: { model: 'e-tron GT' },
    });

    // ----------------------------------------------------
    // TEST 12: Reject Unauthorized Blockchain Operations
    // ----------------------------------------------------
    console.log('\n--- TEST 12: Reject Unauthorized Operations ---');
    // User B attempting to register User A's vehicle
    const loginResB = await fetch(`${API_BASE}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner.b@vehiclepassport.dev' }),
    });
    const tokenB = (await loginResB.json()).data.token;

    const unauthRes = await fetch(`${API_BASE}/blockchain/vehicle/${createdVeh.id}/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenB}`,
        'Content-Type': 'application/json',
      },
    });
    assert(
      unauthRes.status === 403,
      'TEST 12: Unauthorized user cannot trigger blockchain operations on another owner vehicle'
    );

    // ----------------------------------------------------
    // TEST 13: Handle Failed Transaction Gracefully
    // ----------------------------------------------------
    console.log('\n--- TEST 13: Handle Failed Transaction Gracefully ---');
    // Attempting to anchor record for non-existent vehicle ID on-chain
    let failHandled = false;
    try {
      await blockchainService.anchorRecord({
        vehicleId: 'non-existent-veh-uuid',
        recordType: 'SERVICE',
        recordHash: sampleRecordHash,
      });
    } catch (err: any) {
      failHandled = true;
    }
    assert(failHandled, 'TEST 13: Invalid operation throws informative error and preserves DB integrity');


    // ----------------------------------------------------
    // TEST 14: Verify Database / Blockchain Mapping
    // ----------------------------------------------------
    console.log('\n--- TEST 14: Verify Database to Blockchain Mapping Consistency ---');
    const mappedVeh = await prisma.vehicle.findUnique({
      where: { id: createdVeh.id },
      include: {
        currentOwner: true,
        blockchainRecords: true,
      },
    });

    assert(
      Boolean(
        mappedVeh &&
        mappedVeh.blockchainVehicleId &&
        mappedVeh.recordHash &&
        mappedVeh.blockchainTxHash &&
        mappedVeh.blockNumber &&
        mappedVeh.blockchainStatus === 'CONFIRMED' &&
        mappedVeh.currentOwner.blockchainUserId &&
        mappedVeh.blockchainRecords.length >= 1
      ),
      'TEST 14: Full database-to-blockchain mapping verified with block numbers, hashes, and records'
    );

  } catch (error: any) {
    console.error('Test execution exception:', error);
    assert(false, 'Global Test Execution', error.message);
  }

  console.log(`\n==================================================`);
  console.log(`Phase 3 Test Suite Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().finally(async () => {
  await prisma.$disconnect();
});
