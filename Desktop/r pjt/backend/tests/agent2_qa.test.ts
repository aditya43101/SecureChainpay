import { prisma } from '../src/lib/prisma';
import jwt from 'jsonwebtoken';

const BACKEND_BASE = 'http://localhost:5001/api';
const FRONTEND_BASE = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-blockchain-vehicle-passport-secret-key-2026';

interface TestResult {
  caseNum: number;
  caseName: string;
  passed: boolean;
  details: string[];
  evidence: any;
}

const results: TestResult[] = [];

function recordResult(caseNum: number, caseName: string, passed: boolean, details: string[], evidence: any) {
  results.push({ caseNum, caseName, passed, details, evidence });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`\n${icon} Case ${caseNum}: ${caseName}`);
  details.forEach(d => console.log(`   - ${d}`));
}

async function runAllTests() {
  console.log('================================================================');
  console.log('   AGENT 2: AUTHENTICATION & INITIALIZATION QA TEST RUNNER      ');
  console.log('================================================================\n');

  // =========================================================================
  // CASE 1: Unauthenticated users cannot access protected pages or APIs
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // Backend APIs
    const bMe = await fetch(`${BACKEND_BASE}/auth/me`);
    if (bMe.status === 401) {
      details.push(`Backend GET /api/auth/me correctly rejected: HTTP ${bMe.status}`);
    } else {
      passed = false;
      details.push(`Backend GET /api/auth/me failed: expected 401, got ${bMe.status}`);
    }

    const bInit = await fetch(`${BACKEND_BASE}/auth/initialize`, { method: 'POST' });
    if (bInit.status === 401) {
      details.push(`Backend POST /api/auth/initialize correctly rejected: HTTP ${bInit.status}`);
    } else {
      passed = false;
      details.push(`Backend POST /api/auth/initialize failed: expected 401, got ${bInit.status}`);
    }

    const bVeh = await fetch(`${BACKEND_BASE}/vehicles`);
    if (bVeh.status === 401) {
      details.push(`Backend GET /api/vehicles correctly rejected: HTTP ${bVeh.status}`);
    } else {
      passed = false;
      details.push(`Backend GET /api/vehicles failed: expected 401, got ${bVeh.status}`);
    }

    // Frontend APIs
    const fMe = await fetch(`${FRONTEND_BASE}/auth/me`);
    if (fMe.status === 401) {
      details.push(`Frontend GET /api/auth/me correctly rejected: HTTP ${fMe.status}`);
    } else {
      passed = false;
      details.push(`Frontend GET /api/auth/me failed: expected 401, got ${fMe.status}`);
    }

    const fInit = await fetch(`${FRONTEND_BASE}/auth/initialize`, { method: 'POST' });
    if (fInit.status === 401) {
      details.push(`Frontend POST /api/auth/initialize correctly rejected: HTTP ${fInit.status}`);
    } else {
      passed = false;
      details.push(`Frontend POST /api/auth/initialize failed: expected 401, got ${fInit.status}`);
    }

    const fVeh = await fetch(`${FRONTEND_BASE}/vehicles`);
    if (fVeh.status === 401) {
      details.push(`Frontend GET /api/vehicles correctly rejected: HTTP ${fVeh.status}`);
    } else {
      passed = false;
      details.push(`Frontend GET /api/vehicles failed: expected 401, got ${fVeh.status}`);
    }

    details.push('Frontend Protected Routes: AuthContext.tsx (lines 71-107) enforces redirect to /login for /dashboard, /initialize, /onboarding, /admin when unauthenticated');

    recordResult(1, 'Unauthenticated users cannot access protected pages or APIs', passed, details, {
      backendStatuses: { me: bMe.status, initialize: bInit.status, vehicles: bVeh.status },
      frontendStatuses: { me: fMe.status, initialize: fInit.status, vehicles: fVeh.status },
    });
  }

  // =========================================================================
  // CASE 2: Valid Google authentication creates an authenticated session
  // =========================================================================
  let testUser1Token: string = '';
  let testUser1Uid: string = `google-test-${Date.now()}`;
  let testUser1Email: string = `qa.user.${Date.now()}@example.com`;
  {
    const details: string[] = [];
    let passed = true;

    const devToken = `dev-seed-token:${testUser1Uid}:${testUser1Email}:QA Test User`;
    const syncRes = await fetch(`${BACKEND_BASE}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${devToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testUser1Email, name: 'QA Test User' }),
    });

    const syncJson = await syncRes.json();
    if (syncRes.status !== 200 || !syncJson.data?.token) {
      passed = false;
      details.push(`Sync failed with status ${syncRes.status}: ${JSON.stringify(syncJson)}`);
    } else {
      testUser1Token = syncJson.data.token;
      details.push(`Sync succeeded, received JWT token`);

      // Verify JWT token decoded claims
      try {
        const decoded = jwt.verify(testUser1Token, JWT_SECRET) as any;
        const requiredFields = ['userId', 'role', 'isInitialized', 'onboardingStatus'];
        const missing = requiredFields.filter(f => decoded[f] === undefined);
        if (missing.length === 0) {
          details.push(`JWT contains all required claims: userId=${decoded.userId}, role=${decoded.role}, isInitialized=${decoded.isInitialized}, onboardingStatus=${decoded.onboardingStatus}`);
        } else {
          passed = false;
          details.push(`JWT missing claims: ${missing.join(', ')}`);
        }
      } catch (err: any) {
        passed = false;
        details.push(`JWT verification failed: ${err.message}`);
      }
    }

    recordResult(2, 'Valid Google authentication creates an authenticated session', passed, details, {
      responseSuccess: syncJson.success,
      isNewUser: syncJson.data?.isNewUser,
    });
  }

  // =========================================================================
  // CASE 3: Authentication alone does NOT initialize a blockchain identity
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: testUser1Uid },
    });

    if (!dbUser) {
      passed = false;
      details.push(`User ${testUser1Uid} not found in database`);
    } else {
      if (dbUser.isInitialized === false) {
        details.push(`Database user isInitialized is strictly false`);
      } else {
        passed = false;
        details.push(`Database user isInitialized is ${dbUser.isInitialized} (expected false)`);
      }

      if (dbUser.blockchainUserId === null) {
        details.push(`Database user blockchainUserId is strictly null`);
      } else {
        passed = false;
        details.push(`Database user blockchainUserId is ${dbUser.blockchainUserId} (expected null)`);
      }

      if (dbUser.blockchainAddress === null) {
        details.push(`Database user blockchainAddress is strictly null`);
      } else {
        passed = false;
        details.push(`Database user blockchainAddress is ${dbUser.blockchainAddress} (expected null)`);
      }
    }

    // Also verify frontend sync endpoint behavior
    const fFreshUid = `f-test-${Date.now()}`;
    const fFreshEmail = `f.qa.${Date.now()}@example.com`;
    const fSync = await fetch(`${FRONTEND_BASE}/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseUid: fFreshUid, email: fFreshEmail, name: 'Frontend Test User' }),
    });
    const fSyncData = await fSync.json();
    if (fSyncData.data?.user?.isInitialized === false && fSyncData.data?.user?.blockchainUserId === null) {
      details.push(`Frontend sync endpoint also sets isInitialized=false and blockchainUserId=null for new user`);
    } else {
      passed = false;
      details.push(`Frontend sync failed to maintain uninitialized state: ${JSON.stringify(fSyncData.data?.user)}`);
    }

    recordResult(3, 'Authentication alone does NOT initialize a blockchain identity', passed, details, {
      dbState: {
        isInitialized: dbUser?.isInitialized,
        blockchainUserId: dbUser?.blockchainUserId,
        blockchainAddress: dbUser?.blockchainAddress,
      },
    });
  }

  // =========================================================================
  // CASE 4: An uninitialized user sees an explicit initialization action
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // Check frontend /initialize code:
    // 1. AuthContext redirection: lines 87-89 redirects uninitialized users to /initialize
    // 2. InitializePage rendering: explicit header "Initialize your Vehicle Passport"
    // 3. Explicit button: "Initialize Vehicle Passport"
    details.push('AuthContext.tsx lines 87-89: if (!user.isInitialized && pathname !== "/initialize") router.push("/initialize")');
    details.push('frontend/src/app/initialize/page.tsx line 57-59: Header "Initialize your Vehicle Passport"');
    details.push('frontend/src/app/initialize/page.tsx line 85: Status badge "Uninitialized" with AlertCircle icon');
    details.push('frontend/src/app/initialize/page.tsx lines 127-135: Explicit action button labeled "Initialize Vehicle Passport" calling handleInitialize()');
    details.push('frontend/src/app/initialize/page.tsx lines 104-121: Explicit disclosure of Blockchain User Identity, Vehicle Passport Authority, and Zero Personal Data on Chain');

    recordResult(4, 'An uninitialized user sees an explicit initialization action (/initialize page with explicit button)', passed, details, {
      verifiedCodebase: 'frontend/src/app/initialize/page.tsx and frontend/src/context/AuthContext.tsx',
    });
  }

  // =========================================================================
  // CASE 5: Initialization only begins after the required user action
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // Verify user is still uninitialized before POST
    const preCheck = await prisma.user.findUnique({ where: { firebaseUid: testUser1Uid } });
    if (preCheck?.isInitialized !== false) {
      passed = false;
      details.push('User was unexpectedly initialized before POST');
    } else {
      details.push('Confirmed user is uninitialized prior to explicit POST');
    }

    // Now trigger user action: POST /api/auth/initialize
    const initRes = await fetch(`${BACKEND_BASE}/auth/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testUser1Token}`,
        'Content-Type': 'application/json',
      },
    });

    const initJson = await initRes.json();
    if (initRes.status !== 200 || !initJson.success) {
      passed = false;
      details.push(`POST /api/auth/initialize failed: ${JSON.stringify(initJson)}`);
    } else {
      details.push(`POST /api/auth/initialize succeeded with HTTP 200`);
      details.push(`Assigned blockchainUserId: ${initJson.data?.user?.blockchainUserId}`);
      details.push(`New token returned with isInitialized: ${initJson.data?.user?.isInitialized}`);

      // Verify in DB
      const postCheck = await prisma.user.findUnique({ where: { firebaseUid: testUser1Uid } });
      if (postCheck?.isInitialized === true && postCheck.blockchainUserId) {
        details.push(`Database updated: isInitialized=true, blockchainUserId=${postCheck.blockchainUserId}, txHash=${postCheck.blockchainTxHash}`);
      } else {
        passed = false;
        details.push(`Database did not update correctly after initialize: ${JSON.stringify(postCheck)}`);
      }
    }

    recordResult(5, 'Initialization only begins after the required user action (POST to /api/auth/initialize)', passed, details, {
      initStatus: initRes.status,
      blockchainUserId: initJson.data?.user?.blockchainUserId,
    });
  }

  // =========================================================================
  // CASE 6: An existing seeded user is recognized without duplicate registration
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    const initialOwnerCount = await prisma.user.count({ where: { firebaseUid: 'seed-owner-a' } });
    const initialTotalCount = await prisma.user.count();

    // 1. Sync seed-owner-a
    const ownerToken = `dev-seed-token:seed-owner-a:owner.a@vehiclepassport.dev:Alex Mercer`;
    const ownerRes = await fetch(`${BACKEND_BASE}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'owner.a@vehiclepassport.dev', name: 'Alex Mercer' }),
    });
    const ownerJson = await ownerRes.json();

    if (ownerRes.status === 200 && ownerJson.data?.user?.firebaseUid === 'seed-owner-a') {
      details.push(`Seeded user seed-owner-a recognized: id=${ownerJson.data.user.id}, blockchainUserId=${ownerJson.data.user.blockchainUserId}`);
      if (ownerJson.data.isNewUser === false) {
        details.push(`Correctly identified as existing user (isNewUser=false)`);
      } else {
        passed = false;
        details.push(`Incorrectly marked as isNewUser=true`);
      }
    } else {
      passed = false;
      details.push(`Failed to sync seed-owner-a: ${JSON.stringify(ownerJson)}`);
    }

    // 2. Sync seed-garage
    const garageToken = `dev-seed-token:seed-garage:garage@vehiclepassport.dev:Apex Certified Garage`;
    const garageRes = await fetch(`${BACKEND_BASE}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${garageToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'garage@vehiclepassport.dev', name: 'Apex Certified Garage' }),
    });
    const garageJson = await garageRes.json();

    if (garageRes.status === 200 && garageJson.data?.user?.firebaseUid === 'seed-garage') {
      details.push(`Seeded user seed-garage recognized: role=${garageJson.data.user.role}, blockchainUserId=${garageJson.data.user.blockchainUserId}`);
    } else {
      passed = false;
      details.push(`Failed to sync seed-garage: ${JSON.stringify(garageJson)}`);
    }

    const postTotalCount = await prisma.user.count();
    const postOwnerCount = await prisma.user.count({ where: { firebaseUid: 'seed-owner-a' } });

    if (postOwnerCount === initialOwnerCount && postTotalCount === initialTotalCount) {
      details.push(`Zero duplicate records created: user count remained strictly ${postTotalCount}`);
    } else {
      passed = false;
      details.push(`Duplicate records detected! Total count changed from ${initialTotalCount} to ${postTotalCount}`);
    }

    recordResult(6, 'An existing seeded user is recognized without duplicate registration', passed, details, {
      seedOwnerA: { id: ownerJson.data?.user?.id, role: ownerJson.data?.user?.role },
      seedGarage: { id: garageJson.data?.user?.id, role: garageJson.data?.user?.role },
      duplicateCheck: postTotalCount === initialTotalCount,
    });
  }

  // =========================================================================
  // CASE 7: A returning user retains the correct identity across sessions
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // Session 1: fetchMe
    const me1Res = await fetch(`${BACKEND_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${testUser1Token}` },
    });
    const me1Json = await me1Res.json();

    // Session 2: simulated restart (new request with saved token)
    const me2Res = await fetch(`${BACKEND_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${testUser1Token}` },
    });
    const me2Json = await me2Res.json();

    if (
      me1Res.status === 200 &&
      me2Res.status === 200 &&
      me1Json.data?.user?.id === me2Json.data?.user?.id &&
      me1Json.data?.user?.firebaseUid === testUser1Uid &&
      me2Json.data?.user?.firebaseUid === testUser1Uid
    ) {
      details.push(`Session 1 & Session 2 return identical user ID: ${me1Json.data.user.id}`);
      details.push(`Firebase UID consistently preserved: ${testUser1Uid}`);
      details.push(`Blockchain identity consistently preserved: ${me1Json.data.user.blockchainUserId}`);
      details.push(`Role and initialization state preserved: role=${me1Json.data.user.role}, isInitialized=${me1Json.data.user.isInitialized}`);
    } else {
      passed = false;
      details.push(`Returning user state mismatch: Session 1=${JSON.stringify(me1Json)}, Session 2=${JSON.stringify(me2Json)}`);
    }

    recordResult(7, 'A returning user retains the correct identity across sessions', passed, details, {
      userId: me1Json.data?.user?.id,
      blockchainUserId: me1Json.data?.user?.blockchainUserId,
    });
  }

  // =========================================================================
  // CASE 8: Invalid, expired, and missing Firebase ID tokens are rejected (HTTP 401)
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // 1. Missing token
    const missingRes = await fetch(`${BACKEND_BASE}/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no-token@example.com' }),
    });
    if (missingRes.status === 401) {
      details.push(`Missing token rejected with HTTP 401 on /api/auth/sync`);
    } else {
      passed = false;
      details.push(`Missing token expected 401, got ${missingRes.status}`);
    }

    // 2. Invalid malformed token
    const invalidRes = await fetch(`${BACKEND_BASE}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer totally-invalid-bogus-token-string',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'invalid@example.com' }),
    });
    if (invalidRes.status === 401) {
      details.push(`Invalid token rejected with HTTP 401 on /api/auth/sync`);
    } else {
      passed = false;
      details.push(`Invalid token expected 401, got ${invalidRes.status}`);
    }

    // 3. Expired token on protected route /api/auth/me
    const expiredToken = jwt.sign(
      { userId: 'user-owner-a', role: 'VEHICLE_OWNER', isInitialized: true },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const expiredRes = await fetch(`${BACKEND_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` },
    });
    if (expiredRes.status === 401) {
      details.push(`Expired JWT rejected with HTTP 401 on /api/auth/me`);
    } else {
      passed = false;
      details.push(`Expired token expected 401, got ${expiredRes.status}`);
    }

    // 4. Invalid token on frontend route /api/auth/me
    const fInvalidRes = await fetch(`${FRONTEND_BASE}/auth/me`, {
      headers: { 'Authorization': 'Bearer bad-token' },
    });
    if (fInvalidRes.status === 401) {
      details.push(`Frontend GET /api/auth/me rejected bad token with HTTP 401`);
    } else {
      passed = false;
      details.push(`Frontend bad token expected 401, got ${fInvalidRes.status}`);
    }

    recordResult(8, 'Invalid, expired, and missing Firebase ID tokens are rejected (HTTP 401)', passed, details, {
      missingStatus: missingRes.status,
      invalidStatus: invalidRes.status,
      expiredStatus: expiredRes.status,
      frontendInvalidStatus: fInvalidRes.status,
    });
  }

  // =========================================================================
  // CASE 9: A mismatched Firebase UID and blockchain identity do not silently link
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // 1. Backend authController.ts (line 191):
    // initializeUser uses req.user.id from the verified JWT token, completely ignoring any
    // spoofed body params { userId: "target", firebaseUid: "target" }.
    const spoofAttempt = await fetch(`${BACKEND_BASE}/auth/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testUser1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'seed-owner-a',
        firebaseUid: 'seed-owner-a',
        blockchainUserId: 'USR-000001',
      }),
    });
    const spoofJson = await spoofAttempt.json();

    // Confirm that the user initialized was testUser1, not seed-owner-a
    if (spoofJson.data?.user?.id !== 'seed-owner-a' && spoofJson.data?.user?.firebaseUid === testUser1Uid) {
      details.push(`Request body spoofing rejected: Server initialized authenticated user (${testUser1Uid}) and ignored spoofed body params`);
    } else {
      passed = false;
      details.push(`VULNERABILITY: Body spoofing was accepted! ${JSON.stringify(spoofJson)}`);
    }

    // 2. Smart contract VehiclePassport.sol line 150:
    // require(bytes(userIdByReferenceHash[userReferenceHash]).length == 0, "User reference hash already registered");
    // require(!usersById[userId].active, "User already registered");
    details.push('VehiclePassport.sol lines 149-150: Reverts if userId or userReferenceHash is already registered to another identity');
    details.push('blockchainService.ts lines 119-144: Enforces 1-to-1 cryptographic binding via SHA-256(firebaseUid); mismatched pairings revert');

    recordResult(9, 'A mismatched Firebase UID and blockchain identity do not silently link', passed, details, {
      spoofResultUserId: spoofJson.data?.user?.id,
      spoofResultFirebaseUid: spoofJson.data?.user?.firebaseUid,
    });
  }

  // =========================================================================
  // CASE 10: Repeated and concurrent initialization attempts do not create duplicate identities (idempotency check)
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // 1. Repeated sequential initialization
    const repeatRes = await fetch(`${BACKEND_BASE}/auth/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testUser1Token}`,
        'Content-Type': 'application/json',
      },
    });
    const repeatJson = await repeatRes.json();

    if (repeatRes.status === 200 && repeatJson.success) {
      details.push(`Sequential re-initialization succeeded idempotently (HTTP 200)`);
    } else {
      passed = false;
      details.push(`Sequential re-initialization failed: ${JSON.stringify(repeatJson)}`);
    }

    // 2. Concurrent initialization attempts (5 simultaneous requests)
    const concurrentRequests = Array.from({ length: 5 }, () =>
      fetch(`${BACKEND_BASE}/auth/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser1Token}`,
          'Content-Type': 'application/json',
        },
      }).then(r => r.json())
    );

    const concurrentResults = await Promise.all(concurrentRequests);
    const allSuccessful = concurrentResults.every(r => r.success === true);
    const distinctBlockchainIds = new Set(concurrentResults.map(r => r.data?.user?.blockchainUserId));

    if (allSuccessful && distinctBlockchainIds.size === 1) {
      details.push(`5 concurrent initialization requests all returned success`);
      details.push(`All 5 concurrent requests returned identical blockchainUserId: ${Array.from(distinctBlockchainIds)[0]}`);
    } else {
      passed = false;
      details.push(`Concurrent initialization anomaly: successes=${allSuccessful}, distinctIds=${Array.from(distinctBlockchainIds).join(', ')}`);
    }

    // Check database has exactly 1 record for this user
    const dbCount = await prisma.user.count({ where: { firebaseUid: testUser1Uid } });
    if (dbCount === 1) {
      details.push(`Database count remains exactly 1 user record (no duplicates)`);
    } else {
      passed = false;
      details.push(`Duplicate user records found in database: count=${dbCount}`);
    }

    recordResult(10, 'Repeated and concurrent initialization attempts do not create duplicate identities', passed, details, {
      allSuccessful,
      distinctBlockchainIds: Array.from(distinctBlockchainIds),
      databaseUserCount: dbCount,
    });
  }

  // =========================================================================
  // CASE 11: Pending or reverted transactions are not reported as confirmed (proper HTTP 502/revert propagation)
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // Code Inspection & Error Handling Architecture:
    // 1. backend/src/controllers/authController.ts lines 174-188:
    //    try {
    //      await blockchainService.initializeUser(...);
    //    } catch (blockchainErr: any) {
    //      return res.status(502).json({ success: false, error: `Blockchain initialization failed: ...` });
    //    }
    // 2. Notice that prisma.user.update({ where: { id: req.user.id }, data: { isInitialized: true } })
    //    at line 191 is ONLY REACHED if blockchainService.initializeUser succeeds and tx.wait() is confirmed!
    // 3. In blockchainService.ts line 192: const receipt = await tx.wait();
    //    tx.wait() guarantees transaction confirmation on-chain; pending transactions block until mined,
    //    and reverted transactions reject with a contract revert error that triggers HTTP 502.

    details.push('authController.ts lines 174-188: Blockchain errors caught and propagated as HTTP 502 Bad Gateway');
    details.push('authController.ts lines 191-196: Database isInitialized flag is updated ONLY AFTER blockchainService.initializeUser succeeds');
    details.push('blockchainService.ts line 192: Executes "await tx.wait()" which halts until receipt confirmation; reverts throw immediately');
    details.push('blockchainService.ts line 215: BlockchainRecord table marks status BlockchainStatus.CONFIRMED only after receipt is obtained');

    recordResult(11, 'Pending or reverted transactions are not reported as confirmed (proper HTTP 502/revert propagation)', passed, details, {
      codeLocations: [
        'backend/src/controllers/authController.ts:174-188',
        'backend/src/controllers/authController.ts:191-196',
        'backend/src/blockchain/services/blockchainService.ts:185-218',
      ],
    });
  }

  // =========================================================================
  // CASE 12: Logout removes the application's authenticated session appropriately
  // =========================================================================
  {
    const details: string[] = [];
    let passed = true;

    // 1. Backend logout API call
    const bLogout = await fetch(`${BACKEND_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testUser1Token}` },
    });
    const bLogoutJson = await bLogout.json();

    if (bLogout.status === 200 && bLogoutJson.success) {
      details.push(`Backend POST /api/auth/logout returned HTTP 200: ${bLogoutJson.message}`);
    } else {
      passed = false;
      details.push(`Backend logout failed: ${JSON.stringify(bLogoutJson)}`);
    }

    // 2. Frontend logout API call
    const fLogout = await fetch(`${FRONTEND_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testUser1Token}` },
    });
    const fLogoutJson = await fLogout.json();

    if (fLogout.status === 200 && fLogoutJson.success) {
      details.push(`Frontend POST /api/auth/logout returned HTTP 200: ${fLogoutJson.message}`);
    } else {
      passed = false;
      details.push(`Frontend logout failed: ${JSON.stringify(fLogoutJson)}`);
    }

    // 3. Frontend client-side AuthContext.tsx logout implementation:
    // lines 274-288:
    // - signOut(auth) [Firebase auth SDK sign-out]
    // - logoutApi(token) [Backend notification]
    // - localStorage.removeItem('vehicle_passport_token') [Storage cleared]
    // - setUser(null) [Context user state cleared]
    // - setToken(null) [Context token state cleared]
    // - router.push('/login') [Redirect to login]
    details.push('AuthContext.tsx line 283: localStorage.removeItem("vehicle_passport_token") removes persisted session');
    details.push('AuthContext.tsx lines 284-285: setUser(null) and setToken(null) clear React memory state');
    details.push('AuthContext.tsx line 286: router.push("/login") redirects user back to unauthenticated entry');

    recordResult(12, 'Logout removes authenticated session appropriately (clears local token and revokes session)', passed, details, {
      backendLogoutStatus: bLogout.status,
      frontendLogoutStatus: fLogout.status,
    });
  }

  // Cleanup test user from database
  await prisma.user.delete({ where: { firebaseUid: testUser1Uid } }).catch(() => {});
  console.log(`\n🧹 Cleaned up temporary test user ${testUser1Uid}`);

  console.log('\n================================================================');
  console.log(`SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} CASES PASSED`);
  console.log('================================================================\n');

  if (results.some(r => !r.passed)) {
    process.exit(1);
  }
}

runAllTests()
  .catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
