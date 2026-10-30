import { prisma } from '../src/lib/prisma';
import { OnboardingStatus } from '@prisma/client';

const BACKEND_API = 'http://localhost:5001/api';

async function runOnboardingE2ETests() {
  console.log('🚗==============================================================🚗');
  console.log('   NEW USER ONBOARDING & VEHICLE INITIALIZATION VERIFICATION SUITE');
  console.log('🚗==============================================================🚗\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 9: DEMO ISOLATION AUDIT
    // Verify that normal / new users do not automatically receive demo vehicles
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 9: Demo Isolation & Zero Auto-Provisioning ---');
    const demoAuditUid = `test-demo-audit-${Date.now()}`;
    const demoAuditEmail = `demo.audit.${Date.now()}@example.com`;

    // 1. Sync new user
    const syncRes9 = await fetch(`${BACKEND_API}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer dev-seed-token:${demoAuditUid}:${demoAuditEmail}:Audit User`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: demoAuditEmail, name: 'Audit User' }),
    });
    const syncData9 = await syncRes9.json();
    assert(syncRes9.status === 200, 'Test 9: New user synchronizes successfully');
    assert(syncData9.data?.user?.isInitialized === false, 'Test 9: New user starts with isInitialized = false');
    assert(
      syncData9.data?.user?.onboardingStatus === 'NOT_STARTED',
      'Test 9: New user starts with onboardingStatus = NOT_STARTED'
    );

    // 2. Query vehicles for this uninitialized user
    const vehRes9 = await fetch(`${BACKEND_API}/vehicles`, {
      headers: { 'Authorization': `Bearer ${syncData9.data.token}` },
    });
    const vehData9 = await vehRes9.json();
    assert(vehRes9.status === 200, 'Test 9: GET /vehicles returns 200');
    assert(
      Array.isArray(vehData9.data?.vehicles) && vehData9.data.vehicles.length === 0,
      'Test 9: Normal user has exactly 0 vehicles (no demo vehicle assigned automatically)'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 2: NEW USER CONTINUES WITHOUT A VEHICLE
    // User registers -> initializes blockchain identity -> chooses Option 2
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 2: New User Continues Without a Vehicle ---');
    const user2Uid = `test-user-skip-${Date.now()}`;
    const user2Email = `skip.user.${Date.now()}@example.com`;

    // 1. Sync
    const syncRes2 = await fetch(`${BACKEND_API}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer dev-seed-token:${user2Uid}:${user2Email}:Skip User`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user2Email, name: 'Skip User' }),
    });
    const syncData2 = await syncRes2.json();
    const token2_uninit = syncData2.data.token;

    // 2. Initialize Blockchain Identity
    const initRes2 = await fetch(`${BACKEND_API}/auth/initialize`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token2_uninit}` },
    });
    const initData2 = await initRes2.json();
    assert(initRes2.status === 200, 'Test 2: Blockchain user identity initialized successfully');
    assert(initData2.data?.user?.isInitialized === true, 'Test 2: user.isInitialized becomes true');
    assert(
      initData2.data?.user?.onboardingStatus === 'NOT_STARTED',
      'Test 2: onboardingStatus remains NOT_STARTED prior to choice'
    );
    const token2_init = initData2.data.token;

    // 3. Select Option 2: "Continue Without a Vehicle"
    const onboardRes2 = await fetch(`${BACKEND_API}/auth/onboarding`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token2_init}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'COMPLETED_WITHOUT_VEHICLE' }),
    });
    const onboardData2 = await onboardRes2.json();
    assert(onboardRes2.status === 200, 'Test 2: POST /auth/onboarding succeeds with 200');
    assert(
      onboardData2.data?.user?.onboardingStatus === 'COMPLETED_WITHOUT_VEHICLE',
      'Test 2: User profile recorded as COMPLETED_WITHOUT_VEHICLE'
    );
    const token2_onboarded = onboardData2.data.token;

    // 4. Verify no vehicle created & empty state in DB
    const vehRes2 = await fetch(`${BACKEND_API}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token2_onboarded}` },
    });
    const vehData2 = await vehRes2.json();
    assert(
      vehData2.data?.vehicles?.length === 0,
      'Test 2: User has exactly 0 vehicles in database (clean empty dashboard)'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 3: USER ADDS A VEHICLE LATER
    // The user who skipped vehicle onboarding now adds their first vehicle
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 3: User Adds a Vehicle Later ---');
    // Compliant VIN without letters I, O, Q
    const vin3 = `MAT${Date.now()}LTR`.slice(0, 17);
    const reg3 = `DL03AX${Date.now()}`.slice(0, 10);

    const createRes3 = await fetch(`${BACKEND_API}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token2_onboarded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Hyundai',
        model: 'Ioniq 5',
        variant: 'Long Range RWD',
        manufacturingYear: 2024,
        fuelType: 'ELECTRIC',
        color: 'Cyber Gray',
        vin: vin3,
        registrationNumber: reg3,
      }),
    });
    const createData3 = await createRes3.json();
    assert(createRes3.status === 201, 'Test 3: POST /vehicles returns 201 Created');
    assert(createData3.data?.vehicle?.vin === vin3, 'Test 3: Vehicle created with correct VIN');
    assert(
      createData3.data?.vehicle?.currentOwnerId === initData2.data.user.id,
      'Test 3: Vehicle currentOwnerId matches authenticated user'
    );

    // Verify DB user onboardingStatus updated to COMPLETED_WITH_VEHICLE
    const refreshedUser2 = await prisma.user.findUnique({
      where: { id: initData2.data.user.id },
    });
    assert(
      refreshedUser2?.onboardingStatus === 'COMPLETED_WITH_VEHICLE',
      'Test 3: User onboardingStatus automatically transitioned to COMPLETED_WITH_VEHICLE'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 1: NEW USER ADDS A VEHICLE DIRECTLY DURING ONBOARDING
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 1: New User Adds Vehicle During Onboarding ---');
    const user1Uid = `test-user-direct-${Date.now()}`;
    const user1Email = `direct.user.${Date.now()}@example.com`;

    // 1. Sync
    const syncRes1 = await fetch(`${BACKEND_API}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer dev-seed-token:${user1Uid}:${user1Email}:Direct Owner`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user1Email, name: 'Direct Owner' }),
    });
    const syncData1 = await syncRes1.json();

    // 2. Initialize
    const initRes1 = await fetch(`${BACKEND_API}/auth/initialize`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${syncData1.data.token}` },
    });
    const initData1 = await initRes1.json();
    const token1 = initData1.data.token;

    // 3. Register Vehicle via Form
    const vin1 = `MAT${Date.now()}DIR`.slice(0, 17);
    const reg1 = `MH04EV${Date.now()}`.slice(0, 10);
    const createRes1 = await fetch(`${BACKEND_API}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Tata Motors',
        model: 'Harrier',
        variant: 'Fearless Plus',
        manufacturingYear: 2024,
        fuelType: 'DIESEL',
        color: 'Ash Grey',
        vin: vin1,
        registrationNumber: reg1,
      }),
    });
    const createData1 = await createRes1.json();
    assert(createRes1.status === 201, 'Test 1: Vehicle created successfully in Option 1 (201 Created)');
    assert(
      createData1.data?.vehicle?.blockchainStatus === 'CONFIRMED',
      'Test 1: Genesis vehicle state confirmed on EVM blockchain'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 5: MULTIPLE VEHICLES FOR SINGLE USER
    // User adds a second vehicle to their account
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 5: Multiple Vehicles for Single User ---');
    const vin5 = `MAT${Date.now()}MUL`.slice(0, 17);
    const reg5 = `MH05AX${Date.now()}`.slice(0, 10);
    const createRes5 = await fetch(`${BACKEND_API}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Maruti Suzuki',
        model: 'Jimny',
        variant: 'Alpha 4WD',
        manufacturingYear: 2023,
        fuelType: 'PETROL',
        color: 'Kinetic Yellow',
        vin: vin5,
        registrationNumber: reg5,
      }),
    });
    const createData5 = await createRes5.json();
    assert(createRes5.status === 201, 'Test 5: Second vehicle created for same user (201 Created)');

    const listRes5 = await fetch(`${BACKEND_API}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token1}` },
    });
    const listData5 = await listRes5.json();
    assert(
      listData5.data?.vehicles?.length === 2,
      'Test 5: User query reflects both vehicles without overwriting'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 6: DUPLICATE AND INVALID INPUT REJECTION
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 6: Duplicate and Invalid Input Handling ---');
    // Duplicate VIN
    const dupVinRes = await fetch(`${BACKEND_API}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Any',
        model: 'Any',
        manufacturingYear: 2024,
        fuelType: 'PETROL',
        vin: vin1, // duplicate of vin1
        registrationNumber: `REG${Date.now()}`.slice(0, 10),
      }),
    });
    assert(dupVinRes.status === 409, 'Test 6: Duplicate VIN is rejected with HTTP 409 Conflict');

    // Invalid short VIN (<17 characters)
    const shortVinRes = await fetch(`${BACKEND_API}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Any',
        model: 'Any',
        manufacturingYear: 2024,
        fuelType: 'PETROL',
        vin: 'SHORTVIN123',
        registrationNumber: `REG${Date.now()}`.slice(0, 10),
      }),
    });
    assert(shortVinRes.status === 400, 'Test 6: Short VIN (<17 characters) is rejected with HTTP 400 Bad Request');

    // ------------------------------------------------------------------------
    // SCENARIO 7: INITIALIZATION RULE ENFORCEMENT
    // Uninitialized user cannot register vehicle
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 7: Initialization Rule Enforcement ---');
    const userUninitUid = `test-uninit-${Date.now()}`;
    const userUninitEmail = `uninit.${Date.now()}@example.com`;
    const syncUninit = await fetch(`${BACKEND_API}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer dev-seed-token:${userUninitUid}:${userUninitEmail}:Uninit`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: userUninitEmail, name: 'Uninit' }),
    });
    const uninitToken = (await syncUninit.json()).data.token;

    const uninitVehRes = await fetch(`${BACKEND_API}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${uninitToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Toyota',
        model: 'Innova',
        manufacturingYear: 2024,
        fuelType: 'HYBRID',
        vin: `MAT${Date.now()}UN7`.slice(0, 17),
        registrationNumber: `REG7${Date.now()}`.slice(0, 10),
      }),
    });
    assert(
      uninitVehRes.status === 403,
      'Test 7: Uninitialized user cannot create vehicle (HTTP 403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 8: AUTHORIZATION ISOLATION
    // User cannot access another user's vehicles via /api/vehicles
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 8: Authorization & Data Isolation ---');
    const vehUser1 = await fetch(`${BACKEND_API}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token1}` },
    });
    const vehUser2 = await fetch(`${BACKEND_API}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token2_onboarded}` },
    });
    const user1List = await vehUser1.json();
    const user2List = await vehUser2.json();

    const user1VehicleIds = new Set(user1List.data.vehicles.map((v: any) => v.id));
    const overlap = user2List.data.vehicles.filter((v: any) => user1VehicleIds.has(v.id));
    assert(overlap.length === 0, 'Test 8: Strict data isolation; zero unauthorized vehicle overlap between owners');

    // ------------------------------------------------------------------------
    // SCENARIO 4: EXISTING USER LOGIN & IDEMPOTENCY
    // Existing user logs in again; profile, vehicles, and status preserved
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 4: Existing User Session Restoration ---');
    const reSyncRes = await fetch(`${BACKEND_API}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer dev-seed-token:${user1Uid}:${user1Email}:Direct Owner`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user1Email, name: 'Direct Owner' }),
    });
    const reSyncData = await reSyncRes.json();
    assert(reSyncRes.status === 200, 'Test 4: Existing user logs in with 200 OK');
    assert(reSyncData.data?.isNewUser === false, 'Test 4: Correctly recognized as existing user');
    assert(reSyncData.data?.user?.isInitialized === true, 'Test 4: isInitialized remains true');
    assert(
      reSyncData.data?.user?.onboardingStatus === 'COMPLETED_WITH_VEHICLE',
      'Test 4: onboardingStatus preserved across sessions'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 10: REGRESSION AUDIT (OWNERSHIP TRANSFER & TEST PERSONAS)
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 10: Regression Audit Across Core Workflows ---');
    const devLoginOwnerA = await fetch(`${BACKEND_API}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner.a@vehiclepassport.dev' }),
    });
    const ownerAData = await devLoginOwnerA.json();
    assert(devLoginOwnerA.status === 200, 'Test 10: Test Persona Owner A dev-login operational');
    assert(
      ownerAData.data?.user?.onboardingStatus === 'COMPLETED_WITH_VEHICLE',
      'Test 10: Seed Owner A has COMPLETED_WITH_VEHICLE'
    );

    const ownerAVehicles = await fetch(`${BACKEND_API}/vehicles`, {
      headers: { 'Authorization': `Bearer ${ownerAData.data.token}` },
    });
    const ownerAVehiclesData = await ownerAVehicles.json();
    assert(
      ownerAVehiclesData.data?.vehicles?.length > 0,
      'Test 10: Owner A vehicles preserved intact'
    );

    // Clean up temporary test records
    await prisma.vehicle.deleteMany({
      where: {
        vin: { in: [vin3, vin1, vin5] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        firebaseUid: { in: [demoAuditUid, user2Uid, user1Uid, userUninitUid] },
      },
    });

    console.log('\n==============================================================');
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED across Tests 1 through 10`);
    console.log('==============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runOnboardingE2ETests();
