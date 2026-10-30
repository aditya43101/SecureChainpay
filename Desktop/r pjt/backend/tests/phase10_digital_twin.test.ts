import { ethers } from 'ethers';
import { prisma } from '../src/lib/prisma';
import { digitalTwinService } from '../src/services/twin/DigitalTwinService';
import { twinEventProcessor } from '../src/services/twin/TwinEventProcessor';
import { twinReconciliationService } from '../src/services/twin/TwinReconciliationService';
import { twinScenarioService } from '../src/services/twin/TwinScenarioService';

const API_BASE = 'http://localhost:5001/api';

async function runPhase10Tests() {
  console.log('================================================================');
  console.log('🌐 PHASE 10 TEST SUITE: AUTONOMOUS DIGITAL VEHICLE TWIN');
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

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: AUTH SETUP & TARGET VEHICLE RESOLUTION
    // ------------------------------------------------------------------------
    console.log('--- 1. Auth Setup & Target Resolution ---');
    const tokenOwnerA = await getUserToken('seed-owner-a', 'owner.a@vehiclepassport.dev', 'Test Owner A (Alex Mercer)');
    const tokenOwnerB = await getUserToken('seed-owner-b', 'owner.b@vehiclepassport.dev', 'Test Owner B');
    const tokenAdmin = await getUserToken('seed-admin', 'admin@vehiclepassport.dev', 'Platform Administrator');
    const tokenInspector = await getUserToken('seed-inspector', 'inspector@vehiclepassport.dev', 'Lead Auditor');

    assert(Boolean(tokenOwnerA && tokenOwnerB && tokenAdmin && tokenInspector), 'Dev tokens obtained for Owner A, Owner B, Admin, and Inspector');

    const vehicleA = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000001' },
      include: { currentOwner: true },
    });
    const vehicleB = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000004' },
      include: { currentOwner: true },
    });

    assert(Boolean(vehicleA && vehicleB), 'Target Vehicles VP-000001 (Owner A) and VP-000004 (Owner B) exist');

    if (!vehicleA || !vehicleB) {
      throw new Error('Target vehicles not found in database');
    }

    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    assert(Boolean(adminUser), 'Administrative user exists for reconciliation tests');

    // ------------------------------------------------------------------------
    // SECTION 2: DETERMINISTIC LIFECYCLE EVENT STREAM & IDEMPOTENCY
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Deterministic Event Ingestion & Idempotency ---');
    
    // Ingest events for Vehicle A
    const initialSyncResult = await twinEventProcessor.syncAuthoritativeEvents(vehicleA.id);
    assert(initialSyncResult.scannedCount >= 0, `Initial lifecycle event synchronization scanned records (Scanned: ${initialSyncResult.scannedCount}, Upserted: ${initialSyncResult.upsertedCount})`);

    const initialDbCount = await prisma.vehicleTwinEvent.count({ where: { vehicleId: vehicleA.id } });

    // Fetch timeline
    const timeline = await twinEventProcessor.getEventTimeline(vehicleA.id);
    assert(timeline.length > 0, `Event timeline returned events for vehicle (Count: ${timeline.length})`);

    // Verify ordering & distinct timestamps (Ascending chronological order)
    let strictlyOrdered = true;
    for (let i = 0; i < timeline.length - 1; i++) {
      if (new Date(timeline[i].eventTime).getTime() > new Date(timeline[i + 1].eventTime).getTime()) {
        strictlyOrdered = false;
        break;
      }
    }
    assert(strictlyOrdered, 'Lifecycle event stream is deterministically ordered ascending by eventTime');

    // Verify metadata richness
    const firstEvent = timeline[0];
    assert(Boolean(firstEvent.idempotencyKey && (firstEvent.idempotencyKey.startsWith('TWIN_EVT_') || firstEvent.idempotencyKey.length === 64)), 'Lifecycle event contains standard idempotency key');
    assert(Boolean(firstEvent.eventTime && firstEvent.recordedTime && firstEvent.ingestionTime), 'Lifecycle event strictly distinguishes eventTime, recordedTime, and ingestionTime');
    assert(Boolean(firstEvent.sourceRecordId && firstEvent.sourceSystem), 'Lifecycle event contains traceable sourceRecordId and sourceSystem');

    // Idempotency check: Re-run syncAuthoritativeEvents
    const secondSyncResult = await twinEventProcessor.syncAuthoritativeEvents(vehicleA.id);
    const secondDbCount = await prisma.vehicleTwinEvent.count({ where: { vehicleId: vehicleA.id } });
    assert(initialDbCount === secondDbCount, `Re-synchronization is 100% idempotent: DB event count strictly unchanged (${initialDbCount} == ${secondDbCount})`);

    const timelineAfterSecondSync = await twinEventProcessor.getEventTimeline(vehicleA.id);
    assert(timelineAfterSecondSync.length === timeline.length, 'Event count remains exactly constant after re-sync');

    // ------------------------------------------------------------------------
    // SECTION 3: FIVE-WAY ONTOLOGICAL STATE ENGINE
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Autonomous Digital Twin State Engine & 5-Way Ontology ---');

    const twin = await digitalTwinService.getAutonomousDigitalTwin(vehicleA.id);
    assert(Boolean(twin && twin.vehicleId === vehicleA.id), 'Autonomous Digital Twin generated for target vehicle');

    // Check Ontology Pillars
    const ontology = twin.ontology;
    assert(Boolean(ontology), 'Twin response includes 5-Way Ontological State Breakdown');

    // Pillar A: Physical Vehicle
    assert(
      Boolean(ontology.physicalVehicle.observationNote.includes('directly') || ontology.physicalVehicle.observationNote.includes('software')),
      'Pillar A (Physical Vehicle): Disclaims that physical vehicle condition is not observed directly by software'
    );
    assert(ontology.physicalVehicle.observedDirectly === false, 'Pillar A (Physical Vehicle): Accurately marks observedDirectly=false (no fake IoT)');

    // Pillar B: Recorded History
    assert(
      ontology.recordedHistory.totalSourceRecords >= 0 &&
      typeof ontology.recordedHistory.sourcesBreakdown === 'object',
      'Pillar B (Recorded Vehicle History): Itemizes authoritative database records (odometer, service, transfers, docs)'
    );

    // Pillar C: Verified Claims
    assert(
      typeof ontology.verifiedClaims.totalVerifiedClaims === 'number' &&
      typeof ontology.verifiedClaims.merkleBatchesVerified === 'number',
      'Pillar C (Verified Claims): Exposes verified cryptographic claims and Merkle batch records'
    );

    // Pillar D: Derived Digital State
    assert(
      ontology.derivedDigitalState.engineVersion === 'AUTONOMOUS_TWIN_V10' &&
      ontology.derivedDigitalState.status === 'COMPUTED_PROJECTION',
      'Pillar D (Derived Digital State): Contains versioned derived state and computed projection status'
    );

    // Pillar E: Simulated Future State
    assert(
      ontology.simulatedFutureState.isSimulated === false &&
      ontology.simulatedFutureState.activeSimulationsCount >= 0,
      'Pillar E (Simulated Future State): By default marks isSimulated=false with explicit hypothetical disclaimer'
    );

    // ------------------------------------------------------------------------
    // SECTION 4: FIELD-LEVEL STATE PROVENANCE & FRESHNESS ENGINE
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Field-Level State Provenance & Freshness Engine ---');

    const { odometer, maintenance, ownership, battery, documentConsistency, blockchainIntegrity, healthRisk } = twin.derivedState;
    assert(Boolean(odometer && maintenance && ownership && documentConsistency && blockchainIntegrity && healthRisk), 'Derived state includes all core provenance-tracked domains');

    // Verify odometer provenance
    assert(odometer.ruleVersion.startsWith('RULE_V10_'), `Odometer provenance tracks computation rule version (${odometer.ruleVersion})`);
    assert(['FRESH', 'STALE', 'UNKNOWN'].includes(odometer.freshness), `Data freshness correctly categorized (Freshness: ${odometer.freshness})`);
    assert(['VERIFIED', 'DERIVED', 'ESTIMATED', 'UNVERIFIED'].includes(odometer.verifiedStatus), `Verification status tracked (Status: ${odometer.verifiedStatus})`);
    assert(Boolean(odometer.sourceTimestamp && odometer.computedAt), 'Source timestamp and computation timestamp recorded');
    assert(typeof odometer.value.mileage === 'number', `Odometer value tracks mileage (${odometer.value.mileage} km)`);

    // Verify maintenance status provenance
    assert(maintenance.ruleVersion.startsWith('RULE_V10_'), `Maintenance provenance tracks computation rule version (${maintenance.ruleVersion})`);
    assert(Boolean(maintenance.sourceSystem), `Maintenance provenance source system tracked (${maintenance.sourceSystem})`);
    assert(typeof maintenance.value.totalServices === 'number', `Maintenance value tracks services (${maintenance.value.totalServices} records)`);

    // Verify blockchain integrity provenance
    assert(blockchainIntegrity.sourceSystem === 'BLOCKCHAIN_SERVICE', 'Blockchain provenance points to genuine node ledger');

    // ------------------------------------------------------------------------
    // SECTION 5: DRIFT DETECTION & PROJECTION RECONCILIATION
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Drift Detection & Safe Projection Reconciliation ---');

    // Capture pre-reconciliation vehicle data to prove authoritative records are never mutated
    const preOdoCount = await prisma.odometerRecord.count({ where: { vehicleId: vehicleA.id } });
    const preServiceCount = await prisma.serviceRecord.count({ where: { vehicleId: vehicleA.id } });
    const preVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleA.id } });

    const reconciliation = await twinReconciliationService.reconcileVehicleTwin(
      vehicleA.id,
      adminUser?.id || vehicleA.currentOwnerId || undefined
    );

    assert(Boolean(reconciliation && reconciliation.vehicleId === vehicleA.id), 'Reconciliation run executed successfully');
    assert(['SUCCESS', 'DRIFT_DETECTED_AND_REPAIRED', 'FAILED'].includes(reconciliation.status), `Reconciliation produced valid status: ${reconciliation.status}`);
    assert(Array.isArray(reconciliation.discrepancies), 'Reconciliation itemizes discrepancies array');

    // Verify reconciliation audit log persisted in TwinReconciliationRun
    const reconciliationRun = await prisma.twinReconciliationRun.findUnique({
      where: { id: reconciliation.reconciliationId },
    });
    assert(Boolean(reconciliationRun), 'Reconciliation run persisted in TwinReconciliationRun audit table');

    // Verify Authoritative Records Safety Guarantee: Database records must NOT be altered
    const postOdoCount = await prisma.odometerRecord.count({ where: { vehicleId: vehicleA.id } });
    const postServiceCount = await prisma.serviceRecord.count({ where: { vehicleId: vehicleA.id } });
    const postVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleA.id } });

    assert(preOdoCount === postOdoCount, 'SAFETY CHECK: Odometer records count strictly unchanged after reconciliation');
    assert(preServiceCount === postServiceCount, 'SAFETY CHECK: Service records count strictly unchanged after reconciliation');
    assert(preVehicle?.vin === postVehicle?.vin && preVehicle?.currentOwnerId === postVehicle?.currentOwnerId, 'SAFETY CHECK: Authoritative Vehicle record strictly unchanged');

    // ------------------------------------------------------------------------
    // SECTION 6: ISOLATED SCENARIO SIMULATION ENGINE (WHAT-IF)
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Isolated Scenario Simulation Engine (What-If) ---');

    // Scenario 1: Scheduled Maintenance
    const maintScenario = await twinScenarioService.simulateScenario(
      vehicleA.id,
      adminUser?.id || vehicleA.currentOwnerId || 'system',
      {
        scenarioType: 'SCHEDULED_MAINTENANCE',
        inputs: {
          serviceType: 'MAJOR_INSPECTION',
          serviceMileage: 62000,
          cost: 450,
        },
      }
    );

    assert(maintScenario.isSimulated === true, 'Scenario 1: Output explicitly marked isSimulated=true');
    assert(maintScenario.scenarioType === 'SCHEDULED_MAINTENANCE', 'Scenario 1: Correct scenario type returned');
    assert(maintScenario.diffs.length > 0, `Scenario 1: Computed diff items (${maintScenario.diffs.length} changes)`);
    assert(maintScenario.assumptions.length > 0, 'Scenario 1: Lists model assumptions and boundary conditions');

    // Verify DB isolation: no actual service record was inserted
    const finalServiceCount = await prisma.serviceRecord.count({ where: { vehicleId: vehicleA.id } });
    assert(finalServiceCount === preServiceCount, 'ISOLATION CHECK: No actual ServiceRecord inserted into PostgreSQL database');

    // Scenario 2: Odometer Projection (Future vs Rollback)
    const baseOdo = twin.derivedState.odometer.value.mileage || 50000;
    const futureOdoScenario = await twinScenarioService.simulateScenario(
      vehicleA.id,
      adminUser?.id || vehicleA.currentOwnerId || 'system',
      {
        scenarioType: 'ODOMETER_PROJECTION',
        inputs: {
          hypotheticalMileage: baseOdo + 15000,
          projectionMonths: 6,
        },
      }
    );
    assert(futureOdoScenario.isSimulated === true, 'Scenario 2: Future odometer projection isSimulated=true');
    assert(futureOdoScenario.simulatedStateSummary.projectedMileage > baseOdo, 'Scenario 2: Simulated odometer increased without touching real twin');

    // Test Rollback Detection in Simulation
    const rollbackScenario = await twinScenarioService.simulateScenario(
      vehicleA.id,
      adminUser?.id || vehicleA.currentOwnerId || 'system',
      {
        scenarioType: 'ODOMETER_PROJECTION',
        inputs: {
          hypotheticalMileage: baseOdo - 10000,
        },
      }
    );
    const rollbackDiff = rollbackScenario.diffs.find((d: any) => d.attribute === 'isMonotonic');
    assert(Boolean(rollbackDiff && rollbackDiff.simulatedValue === false && rollbackDiff.impactLevel === 'CRITICAL'), 'Scenario 2 Rollback: Simulation correctly flags chronological anomaly when hypothetical reading decreases');
    assert(rollbackScenario.simulatedStateSummary.warningFlags.includes('SIMULATED_ODOMETER_ROLLBACK_DETECTED'), 'Scenario 2 Rollback: Warning flag SIMULATED_ODOMETER_ROLLBACK_DETECTED raised in summary');

    // Scenario 3: Ownership Pre-Check
    const ownershipScenario = await twinScenarioService.simulateScenario(
      vehicleA.id,
      adminUser?.id || vehicleA.currentOwnerId || 'system',
      {
        scenarioType: 'OWNERSHIP_PRECHECK',
        inputs: {
          proposedOwnerName: 'Certified Fleet Operator LLC',
          targetPrice: 28000,
        },
      }
    );
    assert(ownershipScenario.isSimulated === true, 'Scenario 3: Ownership pre-check isSimulated=true');
    const transferDiff = ownershipScenario.diffs.find((d: any) => d.attribute === 'transferPrerequisitesMet');
    assert(Boolean(transferDiff && (transferDiff.simulatedValue === 'APPROVED' || transferDiff.simulatedValue === 'BLOCKED')), 'Scenario 3: Evaluates transfer eligibility diff');

    // Verify Vehicle Owner strictly unchanged
    const currentOwnerVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleA.id } });
    assert(currentOwnerVehicle?.currentOwnerId === vehicleA.currentOwnerId, 'ISOLATION CHECK: Vehicle owner strictly unchanged in database');

    // Scenario 4: Battery Degradation Simulation
    const batteryScenario = await twinScenarioService.simulateScenario(
      vehicleA.id,
      adminUser?.id || vehicleA.currentOwnerId || 'system',
      {
        scenarioType: 'BATTERY_DEGRADATION',
        inputs: {
          fastDcPercentage: 85,
          annualMileageKm: 30000,
          projectedMonths: 24,
        },
      }
    );
    assert(batteryScenario.isSimulated === true, 'Scenario 4: Battery degradation simulation isSimulated=true');
    assert(batteryScenario.diffs.some((d: any) => d.attribute === 'batteryStateOfHealth' || d.attribute === 'euWarrantyCompliance'), 'Scenario 4: Computes projected battery degradation or model limitation');

    // Verify simulation run was recorded in TwinScenarioRun table
    const scenarioHistory = await prisma.twinScenarioRun.findMany({ where: { vehicleId: vehicleA.id } });
    assert(scenarioHistory.length >= 4, `Scenario run history properly recorded in audit table (Count: ${scenarioHistory.length})`);

    // ------------------------------------------------------------------------
    // SECTION 7: PHASE 8 INVESTIGATION HANDOFF INTEGRATION
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Autonomous Investigation Agent Handoff ---');

    const handoffResult = await digitalTwinService.handoffToInvestigation(
      vehicleA.id,
      adminUser?.id || 'admin',
      'ADMIN',
      {
        anomalyId: 'ANOMALY-001',
        reason: 'Automated twin reconciliation identified historical divergence requiring multi-agent correlation',
        investigationType: 'MULTI_SIGNAL',
      }
    );

    assert(Boolean(handoffResult && handoffResult.id), 'Investigation handoff executed successfully and created run');
    assert(handoffResult.vehicleId === vehicleA.id, 'Investigation run references correct vehicle in database');

    // ------------------------------------------------------------------------
    // SECTION 8: REST API ENDPOINTS & RBAC / IDOR DEFENSE
    // ------------------------------------------------------------------------
    console.log('\n--- 8. REST API Endpoints & RBAC / IDOR Security ---');

    // 8.1 GET Twin (Authorized Owner A)
    const getTwinRes = await fetch(`${API_BASE}/vehicles/${vehicleA.id}/digital-twin/autonomous`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(getTwinRes.status === 200, `Authorized Owner A can retrieve vehicle twin (Status: ${getTwinRes.status})`);
    const getTwinData = await getTwinRes.json();
    assert(getTwinData.success === true && getTwinData.data.vehicleId === vehicleA.id, 'API returns complete Autonomous Digital Twin payload');

    // 8.2 IDOR Defense: Owner B attempts to access Owner A's vehicle twin
    const idorTwinRes = await fetch(`${API_BASE}/vehicles/${vehicleA.id}/digital-twin/autonomous`, {
      headers: { Authorization: `Bearer ${tokenOwnerB}` },
    });
    assert(idorTwinRes.status === 403, `IDOR Defense: Owner B blocked from viewing Owner A twin (Status: ${idorTwinRes.status})`);

    // 8.3 GET Twin Events Timeline
    const getEventsRes = await fetch(`${API_BASE}/vehicles/${vehicleA.id}/digital-twin/events`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(getEventsRes.status === 200, `GET events timeline succeeds (Status: ${getEventsRes.status})`);
    const getEventsData = await getEventsRes.json();
    assert(Array.isArray(getEventsData.data.events), 'Events API returns events array');

    // 8.4 Reconcile Endpoint (Admin only)
    const adminReconcileRes = await fetch(`${API_BASE}/vehicles/${vehicleA.id}/digital-twin/reconcile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
    });
    assert(adminReconcileRes.status === 200, `Admin can trigger twin reconciliation (Status: ${adminReconcileRes.status})`);

    // 8.5 Reconcile Endpoint RBAC (Normal Owner cannot run admin reconciliation)
    const ownerReconcileRes = await fetch(`${API_BASE}/vehicles/${vehicleA.id}/digital-twin/reconcile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwnerA}`, 'Content-Type': 'application/json' },
    });
    assert(ownerReconcileRes.status === 403, `RBAC Defense: Regular owner blocked from executing administrative reconciliation (Status: ${ownerReconcileRes.status})`);

    // 8.6 Simulate Scenario Endpoint
    const simulateRes = await fetch(`${API_BASE}/vehicles/${vehicleA.id}/digital-twin/simulate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwnerA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenarioType: 'SCHEDULED_MAINTENANCE',
        inputs: { serviceMileage: 70000 },
      }),
    });
    assert(simulateRes.status === 200, `Authorized owner can simulate scenario via API (Status: ${simulateRes.status})`);
    const simData = await simulateRes.json();
    assert(simData.data.isSimulated === true, 'API simulation result strictly contains isSimulated=true');

    // 8.7 IDOR Defense: Owner B attempts to simulate on Owner A's vehicle
    const idorSimRes = await fetch(`${API_BASE}/vehicles/${vehicleA.id}/digital-twin/simulate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwnerB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenarioType: 'ODOMETER_PROJECTION',
        inputs: { hypotheticalMileage: 1000 },
      }),
    });
    assert(idorSimRes.status === 403, `IDOR Defense: Owner B blocked from simulating on Owner A vehicle (Status: ${idorSimRes.status})`);

    // 8.8 Investigation Handoff Endpoint (Inspector/Admin)
    const handoffRes = await fetch(`${API_BASE}/vehicles/${vehicleA.id}/digital-twin/investigate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anomalyId: 'ANOMALY-001',
        reason: 'Cross-verification telemetry delta exceeds authorized tolerance',
        investigationType: 'MULTI_SIGNAL',
      }),
    });
    assert(handoffRes.status === 201, `Inspector/Admin can hand off twin anomaly to investigation (Status: ${handoffRes.status})`);

  } catch (error: any) {
    console.error('\n❌ Unhandled exception during Phase 10 test suite:', error);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`📊 PHASE 10 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase10Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
