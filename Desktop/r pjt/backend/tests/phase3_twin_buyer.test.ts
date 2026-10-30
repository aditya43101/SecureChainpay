import { prisma } from '../src/lib/prisma';

const API_BASE = 'http://localhost:5001/api';

async function runPhase3TwinBuyerTests() {
  console.log('================================================================');
  console.log('🚗 PHASE 3 TEST SUITE: DIGITAL VEHICLE TWIN & BUYER INTELLIGENCE');
  console.log('================================================================\n');

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
    // ------------------------------------------------------------------------
    // PRE-FLIGHT CHECKS
    // ------------------------------------------------------------------------
    console.log('--- PRE-FLIGHT CHECKS ---');
    const healthRes = await fetch(`${API_BASE}/health`).catch(() => null);
    assert(Boolean(healthRes && healthRes.ok), 'Backend server is running on http://localhost:5001');

    const v1 = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000001' },
      include: { currentOwner: true },
    });
    assert(Boolean(v1 && v1.blockchainVehicleId), 'Pre-requisite: Vehicle 1 (VP-000001) seeded and anchored');

    const v2 = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000002' },
      include: { currentOwner: true },
    });
    assert(Boolean(v2), 'Pre-requisite: Vehicle 2 (VP-000002) available for multi-vehicle / cross-user checks');

    // Helper: Obtain JWT token for seeded users
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
    const tokenAdmin = await getUserToken('seed-admin', 'admin@vehiclepassport.dev', 'Test Admin');

    // ------------------------------------------------------------------------
    // TEST 1: Digital Vehicle Twin Endpoint & Structure
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Digital Vehicle Twin Endpoint ---');
    const twinRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/digital-twin`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(twinRes.status === 200, 'Digital Twin endpoint returns HTTP 200');

    const twinData = await twinRes.json();
    assert(twinData.success === true, 'Response success is true');
    assert(twinData.data?.passportId === 'VP-000001', 'Passport ID matches VP-000001');
    assert(twinData.data?.identity?.manufacturer === 'Tata', 'Identity manufacturer matches Tata');
    assert(twinData.data?.identity?.level === 'VERIFIED', 'Identity evidence level is strictly labeled VERIFIED');
    assert(twinData.data?.ownership?.totalOwnersCount === 1, 'Total owners count is 1');
    assert(twinData.data?.odometer?.currentMileage >= 32000, 'Current verified mileage is >= 32,000 km');
    assert(twinData.data?.odometer?.isMonotonic === true, 'Odometer readings progression is monotonic on clean vehicle');
    assert(twinData.data?.maintenance?.serviceCoverageScore > 0, 'Service coverage score calculated');
    assert(Boolean(twinData.data?.maintenance?.coverageFormulaExplanation), 'Service coverage formula transparently documented');
    assert(twinData.data?.accidents?.totalAccidentsCount === 1, 'Accident count correctly reports 1 incident');
    assert(twinData.data?.accidents?.openRepairsCount === 0, 'Open repairs count is 0 (repair completed)');
    assert(twinData.data?.blockchain?.integrityStatus === 'VERIFIED', 'Blockchain integrity status is VERIFIED');
    assert(Array.isArray(twinData.data?.evidenceRegistry), 'Evidence registry is provided as an array');
    assert(twinData.data?.evidenceRegistry.length >= 5, 'Evidence registry contains 5+ concrete evidence items');

    // ------------------------------------------------------------------------
    // TEST 2: Digital Twin State Evolution Progression
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: State Evolution Progression ---');
    const evoRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/digital-twin/evolution`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(evoRes.status === 200, 'Digital Twin Evolution endpoint returns HTTP 200');

    const evoData = await evoRes.json();
    assert(evoData.success === true, 'Evolution response success is true');
    assert(Array.isArray(evoData.data?.evolution), 'Evolution data is an array');

    const states = evoData.data?.evolution.map((e: any) => e.state);
    assert(states.includes('FACTORY_DELIVERY'), 'Evolution progression contains FACTORY_DELIVERY');
    assert(states.includes('INITIAL_REGISTRATION'), 'Evolution progression contains INITIAL_REGISTRATION');
    assert(states.includes('MAINTENANCE_PERFORMED'), 'Evolution progression contains MAINTENANCE_PERFORMED');
    assert(states.includes('COLLISION_RECORDED'), 'Evolution progression contains COLLISION_RECORDED');
    assert(states.includes('REPAIRED_AND_CERTIFIED'), 'Evolution progression contains REPAIRED_AND_CERTIFIED');
    assert(states.includes('VERIFIED_OPERATIONAL'), 'Evolution progression culminates in VERIFIED_OPERATIONAL');

    // ------------------------------------------------------------------------
    // TEST 3: Digital Twin Unified Timeline
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Digital Twin Timeline ---');
    const timelineRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/digital-twin/timeline`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(timelineRes.status === 200, 'Digital Twin Timeline endpoint returns HTTP 200');

    const timelineData = await timelineRes.json();
    assert(timelineData.success === true, 'Timeline response success is true');
    assert(timelineData.data?.count >= 5, `Timeline contains all lifecycle events (count: ${timelineData.data?.count})`);
    assert(
      timelineData.data?.timeline.every((e: any) => e.level === 'VERIFIED'),
      'Every timeline event specifies an explicit EvidenceLevel (VERIFIED)'
    );

    // ------------------------------------------------------------------------
    // TEST 4: Authenticated Used-Car Buyer Report
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Authenticated Used-Car Buyer Report ---');
    const buyerRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/buyer-report`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(buyerRes.status === 200, 'Buyer Report endpoint returns HTTP 200');

    const buyerData = await buyerRes.json();
    assert(buyerData.success === true, 'Buyer Report success is true');
    assert(buyerData.data?.trustSummary?.overallTrustBadge === 'VERIFIED', 'Trust badge is VERIFIED for clean vehicle');
    assert(buyerData.data?.trustSummary?.blockchainVerified === true, 'Blockchain verification confirms true');
    assert(buyerData.data?.trustSummary?.healthScore >= 90, `Health score is high (got: ${buyerData.data?.trustSummary?.healthScore})`);
    assert(buyerData.data?.odometerTransparency?.rollbackDetected === false, 'Odometer rollback is false');
    assert(buyerData.data?.odometerTransparency?.progression.length >= 3, 'Odometer progression array contains historical readings');
    assert(buyerData.data?.serviceIntelligence?.serviceCoveragePercentage === 100, 'Service coverage percentage is 100%');
    assert(buyerData.data?.accidentIntelligence?.allRepairsCertified === true, 'Accident repairs are certified');
    assert(Array.isArray(buyerData.data?.questionsToAskSeller), 'Questions to ask the seller array is present');
    assert(buyerData.data?.questionsToAskSeller.length > 0, `Evidence-driven questions generated: ${buyerData.data?.questionsToAskSeller.length}`);
    assert(Array.isArray(buyerData.data?.whatIsVerified), 'What is Verified array is present');
    assert(buyerData.data?.whatIsVerified.length >= 4, 'What is Verified list contains 4+ verified facts');
    assert(Array.isArray(buyerData.data?.whatIsUnknown), 'What is Unknown array is present (explicit transparent gaps)');
    assert(Boolean(buyerData.data?.aiAnalysis?.summary), 'Structured AI analysis summary is generated');
    assert(Array.isArray(buyerData.data?.aiAnalysis?.facts), 'Structured AI analysis facts array present');

    // ------------------------------------------------------------------------
    // TEST 5: Public Sanitized Buyer Summary (Zero PII Leaks)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Public Sanitized Buyer Summary ---');
    const publicBuyerRes = await fetch(`${API_BASE}/public/passport/VP-000001/buyer-summary`);
    assert(publicBuyerRes.status === 200, 'Public Buyer Summary endpoint returns HTTP 200 (Unauthenticated)');

    const publicBuyerData = await publicBuyerRes.json();
    assert(publicBuyerData.success === true, 'Public buyer response success is true');
    assert(publicBuyerData.data?.passportId === 'VP-000001', 'Passport ID matches VP-000001');

    // Privacy & Sanitization checks
    const publicJsonStr = JSON.stringify(publicBuyerData.data);
    assert(!publicJsonStr.includes('seed-owner-a'), 'Does NOT leak Firebase UID');
    assert(!publicJsonStr.includes('owner.a@vehiclepassport.dev'), 'Does NOT leak owner email address');
    assert(!publicJsonStr.includes(v1!.id), 'Does NOT leak internal database UUID');
    assert(!publicJsonStr.includes('privateKey') && !publicJsonStr.includes('secret'), 'Does NOT leak private keys');
    assert(publicBuyerData.data?.registrationNumberMasked.includes('****'), `Registration number is masked (got: ${publicBuyerData.data?.registrationNumberMasked})`);
    assert(publicBuyerData.data?.vinMasked.includes('****'), `VIN is masked (got: ${publicBuyerData.data?.vinMasked})`);
    assert(publicBuyerData.data?.overallTrustBadge === 'VERIFIED', 'Public summary reports VERIFIED trust badge');
    assert(Array.isArray(publicBuyerData.data?.questionsToAskSeller), 'Public summary includes questions to ask seller');
    assert(Array.isArray(publicBuyerData.data?.whatIsVerified), 'Public summary includes What is Verified list');
    assert(Array.isArray(publicBuyerData.data?.whatIsUnknown), 'Public summary includes What is Unknown list');

    // ------------------------------------------------------------------------
    // TEST 6: Non-Existent Passport Error Handling
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Error Handling ---');
    const notFoundRes = await fetch(`${API_BASE}/public/passport/VP-999999/buyer-summary`);
    assert(notFoundRes.status === 404, 'Non-existent passport returns HTTP 404');

    // ------------------------------------------------------------------------
    // TEST 7: Database Persistence & Audit Logging
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Database Persistence & Audit Logs ---');
    const persistedTwin = await prisma.vehicleDigitalTwin.findFirst({
      where: { vehicleId: v1!.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(Boolean(persistedTwin), 'Digital Twin snapshot persisted to PostgreSQL database');
    assert(persistedTwin?.healthScore === buyerData.data?.trustSummary?.healthScore, 'Persisted twin healthScore matches');
    assert(persistedTwin?.currentState === 'VERIFIED_OPERATIONAL', `Persisted currentState is VERIFIED_OPERATIONAL (got: ${persistedTwin?.currentState})`);

    const auditTwin = await prisma.auditLog.findFirst({
      where: { vehicleId: v1!.id, action: 'DIGITAL_TWIN_RECONSTRUCTED' },
      orderBy: { createdAt: 'desc' },
    });
    assert(Boolean(auditTwin), 'Audit log records DIGITAL_TWIN_RECONSTRUCTED action');

    const auditBuyer = await prisma.auditLog.findFirst({
      where: { vehicleId: v1!.id, action: 'BUYER_REPORT_GENERATED' },
      orderBy: { createdAt: 'desc' },
    });
    assert(Boolean(auditBuyer), 'Audit log records BUYER_REPORT_GENERATED action');

    // ------------------------------------------------------------------------
    // TEST 8: RBAC & Security Boundaries
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Security & RBAC Enforcement ---');
    const unauthRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/digital-twin`);
    assert(unauthRes.status === 401, 'Unauthenticated request to /digital-twin blocked with HTTP 401');

    const crossUserRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/digital-twin`, {
      headers: { Authorization: `Bearer ${tokenOwnerB}` },
    });
    assert(crossUserRes.status === 403, 'Cross-user access (Owner B accessing Owner A vehicle) blocked with HTTP 403');

    const adminRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/digital-twin`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(adminRes.status === 200, 'Admin authorized to inspect vehicle digital twin with HTTP 200');

    // ------------------------------------------------------------------------
    // FINAL SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 PHASE 3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('💥 Test suite runner crashed:', err);
    process.exit(1);
  }
}

runPhase3TwinBuyerTests();
