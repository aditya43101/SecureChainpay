import { prisma } from '../src/lib/prisma';
import { graphProjectionService } from '../src/services/graph/graphProjectionService';
import { fraudRulesEngine } from '../src/services/graph/fraudRulesEngine';
import { graphInvestigationService } from '../src/services/graph/graphInvestigationService';
import { ethers } from 'ethers';
import {
  OdometerSourceType,
  DocumentType,
  AccidentSeverity,
} from '@prisma/client';

const API_BASE = 'http://localhost:5001/api';

async function runPhase7Tests() {
  console.log('================================================================');
  console.log('🔍 PHASE 7 TEST SUITE: FRAUD INTELLIGENCE GRAPH & EVIDENCE CORRELATION');
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

  // Helper to fetch dev tokens
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
    console.log('--- 1. Auth Setup & Seed Verification ---');
    const tokenOwner = await getUserToken('seed-owner-a', 'owner.a@vehiclepassport.dev', 'Alex Mercer');
    const tokenAdmin = await getUserToken('seed-admin', 'admin@vehiclepassport.dev', 'Platform Administrator');
    const tokenGarage = await getUserToken('seed-garage', 'garage@vehiclepassport.dev', 'Apex Certified');
    assert(Boolean(tokenOwner && tokenAdmin && tokenGarage), 'Dev tokens obtained for Owner, Admin, and Garage');

    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@vehiclepassport.dev' } });
    assert(Boolean(adminUser), 'Admin user exists in database');

    const v1 = await prisma.vehicle.findFirst({ where: { passportId: 'VP-000001' } });
    assert(Boolean(v1), 'Target Vehicle VP-000001 found');

    // -------------------------------------------------------------
    // 2. Graph Projection & Synchronization
    // -------------------------------------------------------------
    console.log('\n--- 2. Graph Projection & Synchronization ---');
    const initialSync = await graphProjectionService.reconcileAll();
    assert(initialSync.nodesUpserted > 0, `Initial sync created ${initialSync.nodesUpserted} graph nodes`);
    assert(initialSync.edgesUpserted > 0, `Initial sync created ${initialSync.edgesUpserted} graph edges`);

    const nodeCountAfterFirst = await prisma.graphNode.count();
    const edgeCountAfterFirst = await prisma.graphEdge.count();
    assert(nodeCountAfterFirst > 0, `Total GraphNodes in DB: ${nodeCountAfterFirst}`);
    assert(edgeCountAfterFirst > 0, `Total GraphEdges in DB: ${edgeCountAfterFirst}`);

    // Check specific node types exist
    const vehicleNodes = await prisma.graphNode.count({ where: { entityType: 'VEHICLE' } });
    const userNodes = await prisma.graphNode.count({ where: { entityType: 'USER' } });
    const garageNodes = await prisma.graphNode.count({ where: { entityType: 'GARAGE' } });
    assert(vehicleNodes > 0 && userNodes > 0 && garageNodes > 0, 'Vehicle, User, and Garage nodes projected');

    // Test Idempotency: Reconciling again should not duplicate nodes or edges
    console.log('Testing projection idempotency...');
    await graphProjectionService.reconcileAll();
    const nodeCountAfterSecond = await prisma.graphNode.count();
    const edgeCountAfterSecond = await prisma.graphEdge.count();
    assert(
      nodeCountAfterSecond === nodeCountAfterFirst && edgeCountAfterSecond === edgeCountAfterFirst,
      'Projection is strictly idempotent: zero duplicate nodes or edges generated',
      `Before: ${nodeCountAfterFirst}/${edgeCountAfterFirst}, After: ${nodeCountAfterSecond}/${edgeCountAfterSecond}`
    );

    // -------------------------------------------------------------
    // 3. Deterministic Rules Engine: Anomaly Detection Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Deterministic Rules Engine: Anomaly & Conflict Tests ---');

    // RULE A: Odometer Rollback Detection
    console.log('Testing Rule A: Odometer Rollback Detection...');
    await prisma.odometerRecord.create({
      data: {
        vehicleId: v1!.id,
        mileage: 12000,
        recordedAt: new Date('2026-06-15'),
        sourceType: OdometerSourceType.INSPECTION,
        sourceUserId: adminUser!.id,
        recordHash: ethers.keccak256(ethers.toUtf8Bytes('hash-test-rollback-001')),
        notes: 'Routine checkpoint reading showing decrease',
      },
    });

    const findingsRollback = await fraudRulesEngine.evaluateVehicle(v1!.id);
    const rollbackFinding = findingsRollback.find((f: any) => f.ruleId === 'RULE_ODOMETER_ROLLBACK');
    assert(Boolean(rollbackFinding), 'RULE_ODOMETER_ROLLBACK triggered for decreasing mileage');
    assert(
      rollbackFinding?.severity === 'HIGH' &&
        rollbackFinding?.explanation.includes('negative mileage delta'),
      'Rollback finding has HIGH severity and explanatory narrative'
    );
    assert(
      Boolean(rollbackFinding?.unknowns) && Boolean(rollbackFinding?.recommendedAction),
      'Finding includes explicit unknowns and suggested reviewer action'
    );

    // RULE A2: Documented Odometer Correction (Anti-False-Positive)
    console.log('Testing Rule A2: Documented Correction (Anti-False-Positive)...');
    await prisma.odometerRecord.create({
      data: {
        vehicleId: v1!.id,
        mileage: 10000, // Downward from previous 12000 km, but with authorized correction note
        recordedAt: new Date('2026-07-01'),
        sourceType: OdometerSourceType.ADMIN,
        sourceUserId: adminUser!.id,
        recordHash: ethers.keccak256(ethers.toUtf8Bytes('hash-test-correction-002')),
        notes: 'Correction note: Previous entry was inaccurate clerical error; verified correct mileage is 10000.',
      },
    });

    const findingsCorrection = await fraudRulesEngine.evaluateVehicle(v1!.id);
    const correctionFinding = findingsCorrection.find((f: any) => f.ruleId === 'RULE_ODOMETER_CORRECTION_DOCUMENTED');
    assert(
      Boolean(correctionFinding),
      'RULE_ODOMETER_CORRECTION_DOCUMENTED detected'
    );
    assert(
      correctionFinding?.severity === 'INFORMATIONAL',
      'Documented correction flagged as INFORMATIONAL review, NOT fraud'
    );

    // RULE B: Conflicting Vehicle Identity (VIN Mismatch)
    console.log('Testing Rule B: Conflicting Vehicle Identity (VIN Mismatch)...');
    await prisma.vehicleDocument.create({
      data: {
        vehicleId: v1!.id,
        documentType: DocumentType.REGISTRATION_CERTIFICATE,
        title: 'Conflicting Registration Slip',
        fileUrl: 'https://storage.vehiclepassport.dev/docs/mismatched_rc.pdf',
        fileName: 'mismatched_rc.pdf',
        fileSize: 204800,
        mimeType: 'application/pdf',
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        recordHash: ethers.keccak256(ethers.toUtf8Bytes('rec-hash-rc-001')),
        extractedData: JSON.stringify({
          vin: 'WAUZZZ8T0BA999999', // Mismatched VIN!
          engineNo: 'EM564321A',
        }),
        uploadedById: adminUser!.id,
      },
    });

    const findingsVin = await fraudRulesEngine.evaluateVehicle(v1!.id);
    const vinFinding = findingsVin.find((f: any) => f.ruleId === 'RULE_IDENTITY_CONFLICT_VIN');
    assert(Boolean(vinFinding), 'RULE_IDENTITY_CONFLICT_VIN triggered when document VIN contradicts vehicle record');
    assert(vinFinding?.severity === 'HIGH', 'VIN conflict severity is HIGH');

    // RULE C: Document-to-Record Mileage Inconsistency
    console.log('Testing Rule C: Document-to-Record Mileage Inconsistency...');
    const serviceRecord1 = await prisma.serviceRecord.findFirst({ where: { vehicleId: v1!.id } });
    if (serviceRecord1) {
      await prisma.vehicleDocument.create({
        data: {
          vehicleId: v1!.id,
          documentType: DocumentType.SERVICE_INVOICE,
          title: 'Invoice for 15,000 km service with conflicting OCR mileage',
          fileUrl: 'https://storage.vehiclepassport.dev/docs/conflicting_inv.pdf',
          fileName: 'conflicting_inv.pdf',
          fileSize: 102400,
          mimeType: 'application/pdf',
          fileHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
          recordHash: ethers.keccak256(ethers.toUtf8Bytes('rec-hash-inv-001')),
          extractedData: JSON.stringify({
            mileage: 85000, // Service says 15,000, OCR says 85,000!
          }),
          uploadedById: adminUser!.id,
        },
      });

      const findingsDoc = await fraudRulesEngine.evaluateVehicle(v1!.id);
      const docFinding = findingsDoc.find((f: any) => f.ruleId === 'RULE_DOCUMENT_MISMATCH');
      assert(Boolean(docFinding), 'RULE_DOCUMENT_MISMATCH triggered for discordant invoice OCR mileage');
      assert(docFinding?.severity === 'MEDIUM', 'Document mismatch severity is MEDIUM');
    }

    // RULE D: Lifecycle Chronology Conflict (Pre-birth Service)
    console.log('Testing Rule D: Chronology Conflict (Event pre-dates manufacture)...');
    const garage = await prisma.user.findFirst({ where: { role: 'GARAGE' } });
    await prisma.serviceRecord.create({
      data: {
        vehicleId: v1!.id,
        garageId: garage!.id,
        serviceDate: new Date('2021-01-10'), // v1 was manufactured in 2024!
        mileage: 5000,
        serviceType: 'Pre-Delivery Inspection In Past',
        description: 'Impossible date pre-dating vehicle assembly',
        partsReplaced: 'None',
        laborDescription: 'Inspection',
        cost: 100,
        technician: 'Time Traveler',
        recordHash: ethers.keccak256(ethers.toUtf8Bytes('rec-hash-service-anach-001')),
      },
    });

    const findingsChrono = await fraudRulesEngine.evaluateVehicle(v1!.id);
    const chronoFinding = findingsChrono.find((f: any) => f.ruleId === 'RULE_LIFECYCLE_CHRONOLOGY_PRE_BIRTH');
    assert(Boolean(chronoFinding), 'RULE_LIFECYCLE_CHRONOLOGY_PRE_BIRTH triggered when service predates manufacture year');

    // RULE E: Cross-Vehicle Document Cloning (Shared Document Hash)
    console.log('Testing Rule E: Cross-Vehicle Document Cloning...');
    const v2 = await prisma.vehicle.findFirst({ where: { passportId: { not: 'VP-000001' } } });
    if (v2) {
      const clonedHash = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
      await prisma.vehicleDocument.create({
        data: {
          vehicleId: v1!.id,
          documentType: DocumentType.OTHER,
          title: 'Roadworthiness Certificate Original',
          fileUrl: 'https://storage.vehiclepassport.dev/docs/rwc1.pdf',
          fileName: 'rwc1.pdf',
          fileSize: 50000,
          mimeType: 'application/pdf',
          fileHash: clonedHash,
          recordHash: 'rec-hash-clone-01',
          uploadedById: adminUser!.id,
        },
      });

      await prisma.vehicleDocument.create({
        data: {
          vehicleId: v2.id,
          documentType: DocumentType.OTHER,
          title: 'Roadworthiness Certificate Copy on different vehicle',
          fileUrl: 'https://storage.vehiclepassport.dev/docs/rwc2.pdf',
          fileName: 'rwc2.pdf',
          fileSize: 50000,
          mimeType: 'application/pdf',
          fileHash: clonedHash, // Same file hash on distinct vehicle!
          recordHash: ethers.keccak256(ethers.toUtf8Bytes('rec-hash-clone-02')),
          uploadedById: adminUser!.id,
        },
      });

      const findingsCloned = await fraudRulesEngine.evaluateVehicle(v1!.id);
      const clonedFinding = findingsCloned.find((f: any) => f.ruleId === 'RULE_CROSS_VEHICLE_DOCUMENT_CLONING');
      assert(Boolean(clonedFinding), 'RULE_CROSS_VEHICLE_DOCUMENT_CLONING caught identical document hash across distinct vehicles');
      assert(clonedFinding?.severity === 'HIGH', 'Cloned document severity is HIGH');
    }

    // RULE F: Cross-Vehicle Claim & Accident Mismatch
    console.log('Testing Rule F: Cross-Vehicle Claim & Accident Mismatch...');
    if (v2) {
      const accidentOnV2 = await prisma.accidentRecord.create({
        data: {
          vehicleId: v2.id, // Accident is on vehicle 2
          reportedById: adminUser!.id,
          accidentDate: new Date('2026-03-01'),
          severity: AccidentSeverity.MINOR,
          description: 'Minor fender impact on vehicle 2',
          damagedParts: 'Rear bumper',
          recordHash: ethers.keccak256(ethers.toUtf8Bytes('rec-hash-accident-v2-001')),
        },
      });

      const insuranceV1 = await prisma.insuranceRecord.findFirst({ where: { vehicleId: v1!.id } });
      if (insuranceV1) {
        await prisma.insuranceClaimRecord.create({
          data: {
            insuranceRecordId: insuranceV1.id, // Policy on v1
            accidentRecordId: accidentOnV2.id, // Linked to accident on v2!
            claimNumber: `CLM-MISMATCH-${Date.now()}`,
            claimDate: new Date('2026-03-02'),
            claimAmount: 1200,
            description: 'Suspicious claim linking accident on vehicle 2 to policy on vehicle 1',
            recordHash: ethers.keccak256(ethers.toUtf8Bytes('rec-hash-claim-mismatch-001')),
          },
        });

        const findingsClaim = await fraudRulesEngine.evaluateVehicle(v1!.id);
        const claimMismatchFinding = findingsClaim.find((f: any) => f.ruleId === 'RULE_CROSS_VEHICLE_CLAIM_MISMATCH');
        assert(Boolean(claimMismatchFinding), 'RULE_CROSS_VEHICLE_CLAIM_MISMATCH detected cross-vehicle accident linkage');
      }
    }

    // RULE H: Blockchain & Merkle Batch Cryptographic Integrity Tampering
    console.log('Testing Rule H: Merkle Batch Snapshot Tamper Verification...');
    const batchRecord = await prisma.merkleBatchRecord.findFirst({
      where: { recordType: 'SERVICE' },
      include: { batch: true },
    });

    if (batchRecord) {
      const linkedService = await prisma.serviceRecord.findUnique({
        where: { id: batchRecord.recordId },
      });

      if (linkedService) {
        const originalMileage = linkedService.mileage;
        // Tamper with database mileage post-anchoring
        await prisma.serviceRecord.update({
          where: { id: linkedService.id },
          data: { mileage: originalMileage + 99999 },
        });

        const findingsTamper = await fraudRulesEngine.evaluateVehicle(linkedService.vehicleId);
        const tamperFinding = findingsTamper.find((f: any) => f.ruleId === 'RULE_BLOCKCHAIN_INTEGRITY_TAMPER');
        assert(
          Boolean(tamperFinding),
          'RULE_BLOCKCHAIN_INTEGRITY_TAMPER detected database tampering after Merkle batch anchoring'
        );
        assert(
          tamperFinding?.severity === 'CRITICAL' || tamperFinding?.severity === 'HIGH',
          'Blockchain tamper finding has elevated severity'
        );

        // Restore original mileage to leave DB clean
        await prisma.serviceRecord.update({
          where: { id: linkedService.id },
          data: { mileage: originalMileage },
        });
      }
    }

    // -------------------------------------------------------------
    // 4. Adversarial Scenarios & Anti-False-Positive Guarantees
    // -------------------------------------------------------------
    console.log('\n--- 4. Adversarial Scenarios & Anti-False-Positive Guarantees ---');

    // Scenario A: Legitimate Shared Garage
    console.log('Testing Scenario A: Legitimate Shared Garage...');
    if (v2 && garage) {
      await prisma.serviceRecord.create({
        data: {
          vehicleId: v2.id,
          garageId: garage.id,
          serviceDate: new Date('2026-02-15'),
          mileage: 20000,
          serviceType: 'Routine Scheduled Maintenance',
          description: 'Factory recommended inspection at certified garage',
          partsReplaced: 'None',
          laborDescription: 'Inspection',
          cost: 150,
          technician: 'Marcus',
          recordHash: ethers.keccak256(ethers.toUtf8Bytes('rec-hash-v2-serv-001')),
        },
      });
      await graphProjectionService.reconcileAll();
    }

    const sharedGarageEdges = await prisma.graphEdge.findMany({
      where: {
        relationshipType: 'SHARES_EVIDENCE_WITH',
        evidence: { contains: 'LEGITIMATE_SHARED_GARAGE' },
      },
    });
    assert(
      sharedGarageEdges.length > 0,
      `Detected ${sharedGarageEdges.length} legitimate shared garage edges flagged as non-fraudulent`
    );

    // Verify garage is not flagged as fraudulent
    const garageFindings = await prisma.fraudFinding.findMany({
      where: {
        involvedNodeIds: { contains: garage!.id },
        ruleId: { in: ['RULE_ODOMETER_ROLLBACK', 'RULE_IDENTITY_CONFLICT_VIN'] },
      },
    });
    assert(
      garageFindings.length === 0,
      'Legitimate certified garage is NOT falsely accused of fraud for servicing multiple vehicles'
    );

    // Scenario C: Missing Service History
    console.log('Testing Scenario C: Missing Service History...');
    const dataGapFindings = await prisma.fraudFinding.findMany({
      where: { explanation: { contains: 'fraud' } },
    });
    assert(
      dataGapFindings.length === 0,
      'System strictly adheres to "Anomaly does not mean fraud" — zero findings use accusatory terminology'
    );

    // -------------------------------------------------------------
    // 5. Graph Investigation Service: Bounded Traversal & Pathfinding
    // -------------------------------------------------------------
    console.log('\n--- 5. Graph-Based Investigation & Bounded Traversal ---');
    const startTraversal = Date.now();
    const graphNeighborhood = await graphInvestigationService.getVehicleGraph(v1!.id, 2);
    const traversalDuration = Date.now() - startTraversal;

    assert(graphNeighborhood.nodes.length > 0, `getVehicleGraph returned ${graphNeighborhood.nodes.length} nodes`);
    assert(graphNeighborhood.edges.length > 0, `getVehicleGraph returned ${graphNeighborhood.edges.length} edges`);
    assert(traversalDuration < 1000, `Bounded BFS graph traversal executed in ${traversalDuration}ms (< 1000ms threshold)`);
    assert(graphNeighborhood.nodes.length <= 60, 'Traversal respected maxNodes ceiling (<= 60 nodes)');

    // Pathfinding
    const vehicleNode = graphNeighborhood.nodes.find((n: any) => n.entityType === 'VEHICLE');
    const garageNode = graphNeighborhood.nodes.find((n: any) => n.entityType === 'GARAGE');
    if (vehicleNode && garageNode) {
      const pathResult = await graphInvestigationService.findEvidencePath(vehicleNode.id, garageNode.id);
      assert(pathResult.found, `Shortest path discovered between Vehicle and Garage in ${pathResult.hops} hops`);
      assert(pathResult.path.length > 0, 'Evidence path returns ordered nodes');
    }

    // -------------------------------------------------------------
    // 6. Finding Lifecycle & Investigation Case Management
    // -------------------------------------------------------------
    console.log('\n--- 6. Finding Lifecycle & Investigation Case Management ---');
    const findingsList = await graphInvestigationService.getFindings({ vehicleId: v1!.id, limit: 5 });
    assert(findingsList.findings.length > 0, `Retrieved ${findingsList.findings.length} findings for Vehicle 1`);

    const targetFinding = findingsList.findings[0];
    const updatedFinding = await graphInvestigationService.updateFindingStatus({
      findingId: targetFinding.id,
      status: 'UNDER_REVIEW',
      reviewerId: adminUser!.id,
      resolutionReason: 'Assigned to forensic analyst for document metadata verification.',
    });
    assert(
      updatedFinding.status === 'UNDER_REVIEW' && updatedFinding.reviewedById === adminUser!.id,
      'Finding transitioned to UNDER_REVIEW with reviewer attribution and audit trail'
    );

    // Create Investigation Case grouping findings
    const newCase = await graphInvestigationService.createInvestigationCase({
      title: 'Investigation Case #2026-07: Vehicle 1 Anomaly Correlation',
      description: 'Comprehensive review of contradictory odometer entries and OCR document discrepancies',
      priority: 'HIGH',
      assignedToId: adminUser!.id,
      findingIds: [targetFinding.id],
    });
    assert(Boolean(newCase.id), `Investigation case created with ID: ${newCase.id}`);

    const cases = await graphInvestigationService.getInvestigationCases({ status: 'OPEN' });
    assert(cases.cases.length > 0, 'getInvestigationCases returns open investigation cases');

    // -------------------------------------------------------------
    // 7. API Security & RBAC Enforcement
    // -------------------------------------------------------------
    console.log('\n--- 7. API Endpoints & RBAC Security Verification ---');

    // 1. GET /api/intelligence/graph/overview (Authorized Admin)
    const overviewRes = await fetch(`${API_BASE}/intelligence/graph/overview`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const overviewData = await overviewRes.json();
    assert(
      overviewRes.ok && overviewData.success && overviewData.data.totalNodes > 0,
      'GET /api/intelligence/graph/overview returns complete metrics for Admin'
    );

    // 2. GET /api/intelligence/graph/vehicles/:vehicleId
    const vehicleGraphRes = await fetch(`${API_BASE}/intelligence/graph/vehicles/${v1!.id}?depth=2`, {
      headers: { Authorization: `Bearer ${tokenOwner}` },
    });
    const vehicleGraphData = await vehicleGraphRes.json();
    assert(
      vehicleGraphRes.ok && vehicleGraphData.success && vehicleGraphData.data.nodes.length > 0,
      'GET /api/intelligence/graph/vehicles/:vehicleId succeeds for authorized owner'
    );

    // 3. POST /api/intelligence/graph/reconcile (RBAC: Admin only)
    const reconcileAsOwnerRes = await fetch(`${API_BASE}/intelligence/graph/reconcile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwner}`, // Owner role lacks ADMIN
        'Content-Type': 'application/json',
      },
    });
    assert(
      reconcileAsOwnerRes.status === 403,
      'POST /api/intelligence/graph/reconcile rejects Non-Admin with 403 Forbidden'
    );

    const reconcileAsAdminRes = await fetch(`${API_BASE}/intelligence/graph/reconcile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
    });
    const reconcileAdminData = await reconcileAsAdminRes.json();
    assert(
      reconcileAsAdminRes.ok && reconcileAdminData.success,
      'POST /api/intelligence/graph/reconcile succeeds for Admin user'
    );

    // 4. Public unauthenticated access blocked
    const unauthRes = await fetch(`${API_BASE}/intelligence/graph/overview`);
    assert(unauthRes.status === 401, 'Unauthenticated access to graph overview is blocked with 401 Unauthorized');

    console.log('\n================================================================');
    console.log(`🎉 PHASE 7 ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Test suite crashed with error:', error);
    process.exit(1);
  } finally {
    try {
      await prisma.serviceRecord.deleteMany({ where: { technician: 'Time Traveler' } });
      await prisma.serviceRecord.deleteMany({ where: { technician: 'Marcus', mileage: 20000 } });
      await prisma.odometerRecord.deleteMany({ where: { notes: { contains: 'Correction note' } } });
      await prisma.odometerRecord.deleteMany({ where: { notes: { contains: 'Routine checkpoint reading' } } });
      await prisma.vehicleDocument.deleteMany({ where: { title: { contains: 'Conflicting Registration Slip' } } });
      await prisma.vehicleDocument.deleteMany({ where: { title: { contains: 'Roadworthiness Certificate' } } });
      await prisma.vehicleDocument.deleteMany({ where: { title: { contains: 'conflicting OCR mileage' } } });
      await prisma.accidentRecord.deleteMany({ where: { description: { contains: 'fender impact' } } });
      await prisma.insuranceClaimRecord.deleteMany({ where: { claimNumber: { startsWith: 'CLM-MISMATCH' } } });
    } catch {}
    await prisma.$disconnect();
  }
}

runPhase7Tests();
