import { prisma } from '../src/lib/prisma';
import { VehicleIntelligenceService } from '../src/services/intelligence/VehicleIntelligenceService';

const API_BASE = 'http://localhost:5001/api';

async function runPhase2IntelligenceTests() {
  console.log('================================================================');
  console.log('🧠 PHASE 2 TEST SUITE: VEHICLE INTELLIGENCE, FRAUD & MAINTENANCE');
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
    // TEST 1: Full Consolidated Intelligence Report Endpoint
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Consolidated Intelligence Report Endpoint ---');
    const intelRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/intelligence`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(intelRes.status === 200, 'Intelligence endpoint returns HTTP 200');

    const intelJson = await intelRes.json();
    assert(intelJson.success === true, 'Response success is true');
    assert(intelJson.data.passportId === 'VP-000001', 'Passport ID matches VP-000001');
    assert(intelJson.data.vin === v1!.vin, 'VIN matches database record');
    assert(Boolean(intelJson.data.executiveSummary), 'Executive summary is present');
    assert(Boolean(intelJson.data.engineVersions), 'Engine versions metadata present');
    assert(intelJson.data.engineVersions.healthEngine === 'v1.0.0', 'Health engine version is v1.0.0');

    // ------------------------------------------------------------------------
    // TEST 2: Explainable Health Score Engine
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Explainable Health Score Engine ---');
    const health = intelJson.data.health;
    assert(typeof health.overallScore === 'number' && health.overallScore >= 0 && health.overallScore <= 100, `Health score is in valid range (got: ${health.overallScore})`);
    assert(['EXCELLENT', 'GOOD', 'FAIR', 'POOR'].includes(health.status), `Health status is valid (got: ${health.status})`);
    assert(Boolean(health.components), 'Health components object present');

    // Check individual explainable components
    const comps = health.components;
    assert(comps.blockchainIntegrity && comps.blockchainIntegrity.score === 100, 'Blockchain integrity score is 100');
    assert(comps.odometerIntegrity && comps.odometerIntegrity.score >= 80, 'Odometer integrity score is high for pristine vehicle');
    assert(comps.serviceCompliance && comps.serviceCompliance.score >= 80, 'Service compliance score is high');
    assert(Array.isArray(comps.serviceCompliance.positiveFactors) && comps.serviceCompliance.positiveFactors.length > 0, 'Service compliance includes positive factors');
    assert(Array.isArray(comps.serviceCompliance.evidence), 'Service compliance includes evidence trail');
    assert(health.scoringMethodology && health.scoringMethodology.weights !== undefined, 'Scoring methodology weights documented in response');

    // ------------------------------------------------------------------------
    // TEST 3: Health Breakdown Endpoint (/health)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Dedicated /health Endpoint ---');
    const healthResOnly = await fetch(`${API_BASE}/vehicles/${v1!.id}/health`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(healthResOnly.status === 200, 'Dedicated /health endpoint returns HTTP 200');
    const healthJson = await healthResOnly.json();
    assert(healthJson.data.overallScore === health.overallScore, 'Dedicated /health matches consolidated report score');

    // ------------------------------------------------------------------------
    // TEST 4: Fraud & Anomaly Detection Engine (Pristine Baseline)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Anomaly Detection Engine (Baseline) ---');
    const anomRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/anomalies`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(anomRes.status === 200, 'Anomalies endpoint returns HTTP 200');
    const anomJson = await anomRes.json();
    assert(Array.isArray(anomJson.data.items), 'Anomalies items array present');
    assert(anomJson.data.criticalCount === 0, 'Zero critical anomalies on pristine vehicle');

    // ------------------------------------------------------------------------
    // TEST 5: Odometer Fraud Simulation & Anomaly Detection
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Odometer Fraud Simulation & Detection ---');
    const tamperRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/simulate-tamper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        field: 'odometer',
        tamperedValue: 4999, // Roll back from 32,000 km to 4,999 km
      }),
    });
    assert(tamperRes.status === 200, 'Odometer rollback simulated via API');

    // Re-query anomalies and verify detection
    const anomAfterTamperRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/anomalies`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const anomAfterTamperJson = await anomAfterTamperRes.json();
    const rollbackAnomaly = anomAfterTamperJson.data.items.find(
      (a: any) => a.category === 'ODOMETER' && (a.title.includes('Rollback') || a.severity === 'HIGH')
    );
    assert(Boolean(rollbackAnomaly), 'Anomaly detection engine identifies odometer rollback');
    assert(rollbackAnomaly.evidence.expected !== undefined, 'Anomaly specifies expected value in evidence');
    assert(rollbackAnomaly.evidence.actual.includes('4,999'), 'Anomaly evidence flags tampered 4,999 km reading');

    // Verify Risk Level Escalation
    const riskAfterTamperRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/risk`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const riskAfterTamperJson = await riskAfterTamperRes.json();
    assert(
      riskAfterTamperJson.data.overallRiskLevel === 'HIGH' || riskAfterTamperJson.data.overallRiskLevel === 'CRITICAL',
      `Vehicle risk escalated to ${riskAfterTamperJson.data.overallRiskLevel} after odometer rollback`
    );
    assert(
      riskAfterTamperJson.data.categories.odometerRisk.riskLevel === 'HIGH',
      'Odometer risk category specifically evaluated as HIGH'
    );

    // ------------------------------------------------------------------------
    // TEST 6: Tamper Remediation & Anomaly Clearance
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Tamper Remediation & Clean State Recovery ---');
    const restoreRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/restore-tamper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({ field: 'odometer' }),
    });
    assert(restoreRes.status === 200, 'Restore tamper endpoint returns HTTP 200');

    // Re-verify anomalies are cleared
    const anomRestoredRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/anomalies`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const anomRestoredJson = await anomRestoredRes.json();
    const rollbackRemaining = anomRestoredJson.data.items.find(
      (a: any) => a.category === 'ODOMETER' && a.title.includes('Rollback')
    );
    assert(!rollbackRemaining, 'Rollback anomaly cleared after tamper remediation');

    // ------------------------------------------------------------------------
    // TEST 7: Predictive Maintenance Engine (/maintenance)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Predictive Maintenance Engine ---');
    const maintRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/maintenance`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(maintRes.status === 200, 'Predictive maintenance endpoint returns HTTP 200');

    const maintJson = await maintRes.json();
    assert(Array.isArray(maintJson.data.predictions), 'Predictions array present');
    assert(maintJson.data.predictions.length > 0, `Predictions generated: ${maintJson.data.predictions.length}`);

    // Verify EV specific powertrain predictions for Tata Nexon EV
    const evBatteryPred = maintJson.data.predictions.find(
      (p: any) => p.system.toLowerCase().includes('battery') || p.title.toLowerCase().includes('coolant')
    );
    assert(Boolean(evBatteryPred), 'EV powertrain prediction generated (Battery & Thermal Coolant)');
    assert(['PREDICTED', 'ESTIMATED', 'POSSIBLE'].includes(evBatteryPred.status), `Prediction status is strictly labeled (got: ${evBatteryPred.status})`);
    assert(['HIGH', 'MEDIUM', 'LOW'].includes(evBatteryPred.confidence), `Prediction confidence is labeled (got: ${evBatteryPred.confidence})`);
    assert(Boolean(evBatteryPred.reason), 'Prediction includes clear engineering reason');
    assert(Boolean(evBatteryPred.supportingHistory), 'Prediction references supporting history');

    // ------------------------------------------------------------------------
    // TEST 8: Evidence Graph Structure
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Evidence Graph Structure ---');
    assert(Boolean(intelJson.data.evidenceGraph), 'Evidence graph object present');
    assert(Array.isArray(intelJson.data.evidenceGraph.nodes), 'Graph contains nodes');
    assert(Array.isArray(intelJson.data.evidenceGraph.links), 'Graph contains links');
    assert(intelJson.data.evidenceGraph.nodes.some((n: any) => n.category === 'BLOCKCHAIN'), 'Graph contains BLOCKCHAIN anchor node');
    assert(intelJson.data.evidenceGraph.nodes.some((n: any) => n.category === 'VEHICLE'), 'Graph contains VEHICLE root node');

    // ------------------------------------------------------------------------
    // TEST 9: AI Evidence-Bounded Q&A (/intelligence/ask)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Evidence-Bounded AI Q&A Engine ---');

    // Case A: Valid Question grounded in verified evidence
    const askRiskRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/intelligence/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({ question: 'Why is this vehicle risk low?' }),
    });
    assert(askRiskRes.status === 200, 'AI Q&A endpoint returns HTTP 200 for valid question');
    const askRiskJson = await askRiskRes.json();
    assert(askRiskJson.data.answer.toLowerCase().includes('risk'), 'AI answer references vehicle risk');
    assert(askRiskJson.data.confidenceScore > 0.8, 'AI answer provides high confidence score');

    // Case B: Question about maintenance
    const askMaintRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/intelligence/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({ question: 'What maintenance is due soon?' }),
    });
    const askMaintJson = await askMaintRes.json();
    assert(askMaintJson.data.answer.toLowerCase().includes('maintenance') || askMaintJson.data.answer.toLowerCase().includes('service'), 'AI answer explains maintenance items');

    // Case C: STRICT HALLUCINATION GUARD — Question about unrecorded/unknown facts
    const askFakeRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/intelligence/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({ question: 'What color were the floor mats and who was driving on May 4th?' }),
    });
    const askFakeJson = await askFakeRes.json();
    assert(
      askFakeJson.data.answer.includes('Insufficient verified data to determine this'),
      'AI hallucination control strictly triggers: "Insufficient verified data to determine this."'
    );

    // ------------------------------------------------------------------------
    // TEST 10: RBAC & Security Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: Security & RBAC Enforcement ---');

    // Case A: Unauthenticated request rejected
    const noAuthRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/intelligence`);
    assert(noAuthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

    // Case B: Owner B cannot inspect Owner A's vehicle detailed intelligence
    const ownerBRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/intelligence`, {
      headers: { Authorization: `Bearer ${tokenOwnerB}` },
    });
    assert(ownerBRes.status === 403, 'Owner B accessing Owner A vehicle blocked with HTTP 403');

    // Case C: Admin can inspect any vehicle intelligence
    const adminRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/intelligence`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(adminRes.status === 200, 'Admin successfully granted access with HTTP 200');

    // ------------------------------------------------------------------------
    // TEST 11: Persistent Snapshot & Audit Logging
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11: Intelligence Snapshot & Audit Logging ---');
    const snapshots = await prisma.vehicleIntelligenceSnapshot.findMany({
      where: { vehicleId: v1!.id },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    assert(snapshots.length > 0, 'Intelligence snapshot persisted to PostgreSQL database');
    assert(snapshots[0].healthScore === health.overallScore, 'Snapshot healthScore matches calculated score');
    assert(snapshots[0].engineVersion === 'v1.0.0', 'Snapshot records engineVersion v1.0.0');

    const auditLog = await prisma.auditLog.findFirst({
      where: { vehicleId: v1!.id, action: 'INTELLIGENCE_EVALUATED' },
      orderBy: { createdAt: 'desc' },
    });
    assert(Boolean(auditLog), 'AuditLog records INTELLIGENCE_EVALUATED action');

    // ------------------------------------------------------------------------
    // FINAL RESULTS SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 PHASE 2 INTELLIGENCE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('💥 Unhandled exception during Phase 2 intelligence testing:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase2IntelligenceTests();
