import { prisma } from '../src/lib/prisma';

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('🧪 Starting Phase 1 Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 7: Seed users exist in development database
    // ----------------------------------------------------
    console.log('--- TEST 7: Seed Users in Database ---');
    const seedUsers = await prisma.user.findMany();
    assert(seedUsers.length >= 7, 'Database has at least 7 seeded test users');
    const seedOwnerA = seedUsers.find((u) => u.firebaseUid === 'seed-owner-a');
    assert(seedOwnerA !== undefined && seedOwnerA.role === 'VEHICLE_OWNER', 'seed-owner-a exists with VEHICLE_OWNER role');
    const seedGarage = seedUsers.find((u) => u.firebaseUid === 'seed-garage');
    assert(seedGarage !== undefined && seedGarage.role === 'GARAGE', 'seed-garage exists with GARAGE role');
    const seedAdmin = seedUsers.find((u) => u.firebaseUid === 'seed-admin');
    assert(seedAdmin !== undefined && seedAdmin.role === 'ADMIN', 'seed-admin exists with ADMIN role');
    const seedNew = seedUsers.find((u) => u.firebaseUid === 'seed-new-user');
    assert(seedNew !== undefined && seedNew.isInitialized === false, 'seed-new-user starts with isInitialized = false');

    // ----------------------------------------------------
    // TEST 1: New Google user -> Login -> User created -> isInitialized = false
    // ----------------------------------------------------
    console.log('\n--- TEST 1: New User Creation & Initialization Gate ---');
    const testNewUid = `google-test-uid-${Date.now()}`;
    const testNewEmail = `test.user.${Date.now()}@gmail.com`;
    const devToken1 = `dev-seed-token:${testNewUid}:${testNewEmail}:Jane Doe`;

    const syncRes1 = await fetch(`${API_BASE}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${devToken1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testNewEmail, name: 'Jane Doe' }),
    });
    const syncData1 = await syncRes1.json();

    assert(syncRes1.status === 200, 'POST /api/auth/sync returns 200');
    assert(syncData1.data?.user?.firebaseUid === testNewUid, 'User created with verified Firebase UID');
    assert(syncData1.data?.user?.isInitialized === false, 'New user starts with isInitialized = false');
    assert(syncData1.data?.user?.role === 'VEHICLE_OWNER', 'New user role defaults to VEHICLE_OWNER');
    assert(syncData1.data?.isNewUser === true, 'Response correctly identifies isNewUser = true');

    const sessionToken1 = syncData1.data?.token;

    // ----------------------------------------------------
    // TEST 4: Uninitialized user attempts protected actions
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Uninitialized User Check ---');
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${sessionToken1}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /api/auth/me succeeds for uninitialized user');
    assert(meData.data?.user?.isInitialized === false, 'GET /api/auth/me reports isInitialized = false');

    // ----------------------------------------------------
    // TEST 2: Click Initialize -> isInitialized = true -> Dashboard opens
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Explicit Passport Initialization ---');
    const initRes = await fetch(`${API_BASE}/auth/initialize`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken1}` },
    });
    const initData = await initRes.json();

    assert(initRes.status === 200, 'POST /api/auth/initialize returns 200');
    assert(initData.data?.user?.isInitialized === true, 'Passport isInitialized becomes true');

    // Verify in database
    const dbUserAfterInit = await prisma.user.findUnique({ where: { firebaseUid: testNewUid } });
    assert(dbUserAfterInit?.isInitialized === true, 'Database record updated to isInitialized = true');

    // ----------------------------------------------------
    // TEST 3: Logout -> Login again -> Existing user detected -> No duplicate
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Existing User Login & Duplicate Prevention ---');
    // Logout
    const logoutRes = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${initData.data?.token}` },
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout succeeds');

    // Login again with same Firebase token
    const syncRes2 = await fetch(`${API_BASE}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${devToken1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testNewEmail, name: 'Jane Doe Updated' }),
    });
    const syncData2 = await syncRes2.json();

    assert(syncRes2.status === 200, 'Second login returns 200');
    assert(syncData2.data?.isNewUser === false, 'Existing user detected (isNewUser = false)');
    assert(syncData2.data?.user?.isInitialized === true, 'Existing user retains isInitialized = true');

    const totalUsersWithEmail = await prisma.user.count({ where: { email: testNewEmail } });
    assert(totalUsersWithEmail === 1, 'No duplicate user record created in database');

    // ----------------------------------------------------
    // TEST 5: Unauthenticated access blocked
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Unauthenticated Access ---');
    const unauthRes = await fetch(`${API_BASE}/auth/me`);
    assert(unauthRes.status === 401, 'Unauthenticated GET /api/auth/me returns 401 Unauthorized');

    const unauthInit = await fetch(`${API_BASE}/auth/initialize`, { method: 'POST' });
    assert(unauthInit.status === 401, 'Unauthenticated POST /api/auth/initialize returns 401 Unauthorized');

    // ----------------------------------------------------
    // TEST 6: Multiple login sessions & Token verification
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Multiple Personas & Sessions ---');
    const ownerBLogin = await fetch(`${API_BASE}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner.b@vehiclepassport.dev' }),
    });
    const ownerBData = await ownerBLogin.json();
    assert(ownerBLogin.status === 200, 'Owner B dev login succeeds');
    assert(ownerBData.data?.user?.role === 'VEHICLE_OWNER', 'Owner B has VEHICLE_OWNER role');

    const garageLogin = await fetch(`${API_BASE}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'garage@vehiclepassport.dev' }),
    });
    const garageData = await garageLogin.json();
    assert(garageLogin.status === 200, 'Garage dev login succeeds');
    assert(garageData.data?.user?.role === 'GARAGE', 'Garage has GARAGE role');

    // Clean up created test user
    await prisma.user.delete({ where: { firebaseUid: testNewUid } });
    console.log(`\n🧹 Cleaned up temporary test user: ${testNewUid}`);

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
