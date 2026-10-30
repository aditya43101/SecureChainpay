import { prisma } from '../src/lib/prisma';

const API_BASE = 'http://localhost:5001/api';

async function runPhase5PrivacyAdminTests() {
  console.log('================================================================');
  console.log('⚡ PHASE 5 TEST SUITE: PRIVACY, ADMIN INTELLIGENCE & HARDENING');
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
    // PRE-FLIGHT CHECKS & TOKEN HELPERS
    // ------------------------------------------------------------------------
    console.log('--- PRE-FLIGHT CHECKS ---');
    const healthRes = await fetch(`${API_BASE}/health`).catch(() => null);
    assert(Boolean(healthRes && healthRes.ok), 'Backend server is running on http://localhost:5001');

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
    const tokenAdmin = await getUserToken('seed-admin', 'admin@vehiclepassport.dev', 'Platform Administrator');

    const v1 = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000001' },
      include: { currentOwner: true },
    });
    assert(Boolean(v1), 'Pre-requisite: Vehicle 1 (VP-000001) found in database');

    // ------------------------------------------------------------------------
    // TEST 1: SELECTIVE DISCLOSURE PROFILE CREATION & RBAC
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Selective Disclosure Creation & RBAC ---');

    // Cross-user test: Owner B cannot create disclosure for Owner A's vehicle
    const forbiddenRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/disclosures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Share Attempt',
        categories: ['vehicleIdentity', 'odometer'],
      }),
    });
    assert(forbiddenRes.status === 403, 'RBAC: Cross-user disclosure creation forbidden (HTTP 403)');

    // Invalid input: empty categories
    const emptyCatRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/disclosures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        title: 'No Categories Selected',
        categories: [],
      }),
    });
    assert(emptyCatRes.status === 400, 'Input validation: Empty categories list rejected (HTTP 400)');

    // Authorized Owner A creates selective disclosure
    const createRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/disclosures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        title: 'Prospective Buyer Inspection Report',
        categories: [
          'vehicleIdentity',
          'odometer',
          'service',
          'accident',
          'blockchainProof',
          'batteryPassport',
          'vehicleHealth',
        ],
        expiresInDays: 14,
      }),
    });
    assert(createRes.status === 201, 'Owner A successfully created Selective Disclosure (HTTP 201)');
    const createData = await createRes.json();
    assert(createData.success === true, 'Response success is true');
    assert(Boolean(createData.data.shareId?.startsWith('sh_')), 'Share ID has secure unguessable format (sh_...)');
    assert(createData.data.categories.length === 7, 'Configured 7 disclosed categories accurately');
    assert(Boolean(createData.data.expiresAt), 'Expiration timestamp generated');

    const createdShareId = createData.data.shareId;

    // List vehicle disclosures
    const listRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/disclosures`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(listRes.status === 200, 'Owner can list all vehicle disclosures (HTTP 200)');
    const listData = await listRes.json();
    assert(Array.isArray(listData.data), 'Returns disclosure profiles list');
    const matchedProfile = listData.data.find((p: any) => p.shareId === createdShareId);
    assert(Boolean(matchedProfile && matchedProfile.status === 'ACTIVE'), 'Created disclosure listed with ACTIVE status');

    // ------------------------------------------------------------------------
    // TEST 2: PUBLIC RETRIEVAL OF SELECTIVELY DISCLOSED REPORT
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Public Retrieval & Privacy Enforcement ---');

    const pubShareRes = await fetch(`${API_BASE}/public/share/${createdShareId}`);
    assert(pubShareRes.status === 200, 'Public shared report loads without authentication (HTTP 200)');
    const pubShareJson = await pubShareRes.json();
    assert(pubShareJson.success === true, 'Shared report response success is true');
    assert(pubShareJson.data.shareId === createdShareId, 'Share ID matches requested parameter');
    assert(pubShareJson.data.verificationSummary?.passportId === 'VP-000001', 'Passport ID matches vehicle');

    // Verify scope limitation: Disclosed categories ARE present
    assert(Boolean(pubShareJson.data.disclosedData.vehicleIdentity), 'Disclosed category vehicleIdentity is present');
    assert(Boolean(pubShareJson.data.disclosedData.odometer), 'Disclosed category odometer is present');
    assert(Boolean(pubShareJson.data.disclosedData.service), 'Disclosed category service is present');
    assert(Boolean(pubShareJson.data.disclosedData.accident), 'Disclosed category accident is present');
    assert(Boolean(pubShareJson.data.disclosedData.batteryPassport), 'Disclosed category batteryPassport is present');
    assert(Boolean(pubShareJson.data.disclosedData.vehicleHealth), 'Disclosed category vehicleHealth is present');

    // Verify scope limitation: Non-disclosed categories are NOT present
    assert(pubShareJson.data.disclosedData.ownership === undefined, 'Non-disclosed category ownership is omitted');
    assert(pubShareJson.data.disclosedData.insurance === undefined, 'Non-disclosed category insurance is omitted');
    assert(pubShareJson.data.disclosedData.documents === undefined, 'Non-disclosed category documents is omitted');

    // Verify strict privacy boundary & PII sanitization
    const rawPubShare = JSON.stringify(pubShareJson);
    assert(!rawPubShare.includes('seed-owner-a'), 'Zero leakage of Firebase UID');
    assert(!rawPubShare.includes('owner.a@vehiclepassport.dev'), 'Zero leakage of owner email');
    assert(!rawPubShare.includes(v1!.currentOwnerId), 'Zero leakage of internal database owner UUID');
    assert(!rawPubShare.includes('privateKey'), 'Zero leakage of cryptographic secrets/keys');
    assert(pubShareJson.data.disclosedData.vehicleIdentity.registrationNumberMasked.includes('•'), 'Registration plate is masked (MH02••••1001)');
    assert(pubShareJson.data.disclosedData.vehicleIdentity.vinMasked.includes('***'), 'VIN is partially masked (MAT***001)');
    assert(pubShareJson.data.disclosedData.batteryPassport.batterySerialMasked.includes('***'), 'Battery serial is masked (BAT-***001)');

    // ------------------------------------------------------------------------
    // TEST 3: DISCLOSURE REVOCATION & EXPIRATION ENFORCEMENT
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Disclosure Revocation & Expiration ---');

    // Owner B cannot revoke Owner A's disclosure
    const revokeForbiddenRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/disclosures/${createdShareId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwnerB}` },
    });
    assert(revokeForbiddenRes.status === 403, 'RBAC: Unauthorized user cannot revoke disclosure (HTTP 403)');

    // Owner A revokes disclosure
    const revokeRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/disclosures/${createdShareId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(revokeRes.status === 200, 'Owner A revoked disclosure profile (HTTP 200)');
    const revokeData = await revokeRes.json();
    assert(revokeData.data.status === 'REVOKED', 'Status updated to REVOKED');

    // Revocation Idempotency: Calling revoke again must be rejected with HTTP 400 ALREADY_REVOKED
    const doubleRevokeRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/disclosures/${createdShareId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(doubleRevokeRes.status === 400, 'Revoke idempotency: double revocation rejected with HTTP 400');
    const doubleRevokeJson = await doubleRevokeRes.json();
    assert(doubleRevokeJson.error?.code === 'ALREADY_REVOKED', 'Error code is ALREADY_REVOKED');

    // Subsequent public access to revoked share returns HTTP 410 Gone
    const revokedAccessRes = await fetch(`${API_BASE}/public/share/${createdShareId}`);
    assert(revokedAccessRes.status === 410, 'Public access to revoked share returns HTTP 410 Gone');
    const revokedAccessJson = await revokedAccessRes.json();
    assert(revokedAccessJson.error?.code === 'DISCLOSURE_REVOKED', 'Error code is DISCLOSURE_REVOKED');

    // Create an expired disclosure directly in DB to test expiry enforcement
    const expiredShare = await prisma.disclosureProfile.create({
      data: {
        vehicleId: v1!.id,
        createdById: v1!.currentOwnerId,
        shareId: 'sh_test_expired_12345',
        title: 'Expired Share Test',
        categories: JSON.stringify(['vehicleIdentity']),
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour in the past
        status: 'ACTIVE',
      },
    });

    const expiredAccessRes = await fetch(`${API_BASE}/public/share/${expiredShare.shareId}`);
    assert(expiredAccessRes.status === 410, 'Access to expired share returns HTTP 410 Gone');
    const expiredAccessJson = await expiredAccessRes.json();
    assert(expiredAccessJson.error?.code === 'DISCLOSURE_EXPIRED', 'Error code is DISCLOSURE_EXPIRED');

    // Clean up test expired share
    await prisma.disclosureProfile.delete({ where: { id: expiredShare.id } });

    // ------------------------------------------------------------------------
    // TEST 4: ADMIN INTELLIGENCE ACCESS & RBAC
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Admin Intelligence Access & RBAC ---');

    // Owner A (non-admin) forbidden from admin routes
    const adminForbiddenRes = await fetch(`${API_BASE}/admin/intelligence/overview`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(adminForbiddenRes.status === 403, 'RBAC: Non-admin user forbidden from admin intelligence (HTTP 403)');

    // Admin access to System Overview KPIs
    const overviewRes = await fetch(`${API_BASE}/admin/intelligence/overview`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(overviewRes.status === 200, 'Admin can access system overview KPIs (HTTP 200)');
    const overviewData = await overviewRes.json();
    assert(overviewData.success === true, 'System overview success is true');
    assert(overviewData.data.users?.total > 0, 'Overview contains users count');
    assert(overviewData.data.vehicles?.total > 0, 'Overview contains vehicles count');
    assert(overviewData.data.blockchain?.confirmed > 0, 'Overview contains confirmed blockchain anchors');
    assert(overviewData.data.lifecycleCounts?.services >= 0, 'Overview contains lifecycle services counter');

    // Admin access to Blockchain Telemetry
    const bcRes = await fetch(`${API_BASE}/admin/intelligence/blockchain`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(bcRes.status === 200, 'Admin can access blockchain telemetry (HTTP 200)');
    const bcData = await bcRes.json();
    assert(bcData.data.network?.isNodeOnline === true, 'Blockchain node online check succeeds');
    assert(Boolean(bcData.data.network?.contractAddress), 'Smart contract address is loaded');
    assert(bcData.data.metrics?.confirmed > 0, 'Confirmed anchors metric is tracked');
    assert(Array.isArray(bcData.data.recentAnchors), 'Recent on-chain anchor transactions returned');

    // Admin access to Blockchain Explorer
    const explorerRes = await fetch(`${API_BASE}/admin/intelligence/explorer?limit=10`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(explorerRes.status === 200, 'Admin can query blockchain explorer records (HTTP 200)');
    const explorerData = await explorerRes.json();
    assert(explorerData.data.total > 0, 'Total blockchain records > 0');
    assert(Array.isArray(explorerData.data.records), 'Records array returned');

    // ------------------------------------------------------------------------
    // TEST 5: TAMPER / ANOMALY INCIDENTS & ADMIN CASE MANAGEMENT
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Tamper Incidents & Case Management ---');

    const incidentsRes = await fetch(`${API_BASE}/admin/intelligence/tamper-monitoring`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(incidentsRes.status === 200, 'Admin can view tamper and anomaly incidents (HTTP 200)');
    const incidentsData = await incidentsRes.json();
    assert(Array.isArray(incidentsData.data.cases), 'Cases list returned');
    assert(Array.isArray(incidentsData.data.recentAuditAlerts), 'Recent audit alerts list returned');

    // Create an Administrative Case
    const caseCreateRes = await fetch(`${API_BASE}/admin/intelligence/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({
        vehicleId: v1!.id,
        category: 'ODOMETER_ANOMALY',
        title: 'Odometer Variance Discrepancy Investigation',
        description: 'Investigation initiated for simulated rollback variance verification during audit.',
        severity: 'HIGH',
        evidence: { simulated: true, checkedOdometer: 34200 },
      }),
    });
    assert(caseCreateRes.status === 201, 'Admin created administrative case (HTTP 201)');
    const caseCreateData = await caseCreateRes.json();
    assert(caseCreateData.success === true, 'Case creation success is true');
    assert(Boolean(caseCreateData.data.caseNumber?.startsWith('CASE-')), 'Generated case number format (CASE-YYYY-XXXX)');
    const createdCaseId = caseCreateData.data.id;

    // Update Case Status to RESOLVED
    const caseUpdateRes = await fetch(`${API_BASE}/admin/intelligence/cases/${createdCaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({
        status: 'RESOLVED',
        resolutionNotes: 'Audited and verified: Variance was benign and resolved after garage service confirmation.',
      }),
    });
    assert(caseUpdateRes.status === 200, 'Admin updated case to RESOLVED (HTTP 200)');
    const caseUpdateData = await caseUpdateRes.json();
    assert(caseUpdateData.data.status === 'RESOLVED', 'Case status is now RESOLVED');
    assert(Boolean(caseUpdateData.data.resolvedAt), 'ResolvedAt timestamp recorded');

    // ------------------------------------------------------------------------
    // TEST 6: VEHICLE DATA QUALITY AUDITS & AUDIT LOG VIEWER
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Data Quality Audits & Global Search ---');

    const dqRes = await fetch(`${API_BASE}/admin/intelligence/data-quality`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(dqRes.status === 200, 'Admin can view vehicle data quality audits (HTTP 200)');
    const dqData = await dqRes.json();
    assert(dqData.data.summary !== undefined, 'Data quality summary returned');

    // Audit Log Viewer
    const auditRes = await fetch(`${API_BASE}/admin/intelligence/audit-logs?limit=15`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(auditRes.status === 200, 'Admin can view system audit logs (HTTP 200)');
    const auditData = await auditRes.json();
    assert(auditData.data.total > 0, 'Audit logs total > 0');
    assert(Array.isArray(auditData.data.logs), 'Audit logs list returned');
    const hasDisclosureAction = auditData.data.logs.some((l: any) =>
      ['DISCLOSURE_CREATED', 'DISCLOSURE_VIEWED', 'DISCLOSURE_REVOKED', 'ADMIN_CASE_CREATED'].includes(l.action)
    );
    assert(hasDisclosureAction, 'Phase 5 audit actions logged and indexed in audit trail');

    // Global Admin Search
    const searchRes = await fetch(`${API_BASE}/admin/intelligence/search?q=Nexon`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(searchRes.status === 200, 'Global admin search returns HTTP 200');
    const searchData = await searchRes.json();
    assert(Array.isArray(searchData.data.vehicles), 'Search returned vehicle matches');
    assert(searchData.data.vehicles.length > 0, 'Found Tata Nexon matching search query');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runPhase5PrivacyAdminTests();
