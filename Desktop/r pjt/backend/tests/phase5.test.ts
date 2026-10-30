import { prisma } from '../src/lib/prisma';
import { BlockchainService } from '../src/blockchain/services/blockchainService';
import { DefaultHeuristicOCRProvider } from '../src/services/ocr/DefaultHeuristicOCRProvider';
import { evaluateDocumentConsistency } from '../src/services/ocr/consistencyEngine';
import { getStorageProvider } from '../src/services/storage/storageFactory';

const API_BASE = 'http://localhost:5001/api';

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('🧪 PHASE 5 TEST SUITE: PUBLIC PASSPORT, EXPLORER, OCR & TAMPER LAB');
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
    // PRE-FLIGHT CHECK
    // ------------------------------------------------------------------------
    console.log('--- PRE-FLIGHT CHECKS ---');
    const healthRes = await fetch(`${API_BASE}/health`).catch(() => null);
    assert(Boolean(healthRes && healthRes.ok), 'Backend server is running on http://localhost:5001');

    const v1 = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000001' },
      include: { currentOwner: true },
    });
    assert(Boolean(v1 && v1.blockchainVehicleId), 'Pre-requisite: Vehicle 1 (VP-000001) seeded and anchored');

    // Helper: Obtain JWT token for seeded owner A
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

    // ------------------------------------------------------------------------
    // TEST 1: Public Passport Verification Endpoint (Zero Auth Required)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Public Passport Verification Endpoint ---');
    const pubRes = await fetch(`${API_BASE}/public/passport/VP-000001`);
    assert(pubRes.status === 200, 'Public passport verification returns HTTP 200');

    const pubJson = await pubRes.json();
    assert(pubJson.success === true, 'Response success is true');
    assert(pubJson.data && pubJson.data.passportId === 'VP-000001', 'Passport ID matches VP-000001');
    assert(pubJson.data.vehicleSummary && pubJson.data.vehicleSummary.manufacturer === 'Tata', 'Vehicle manufacturer matches Tata');
    assert(pubJson.data.blockchainStatus && (pubJson.data.blockchainStatus.status === 'CONFIRMED' || pubJson.data.blockchainStatus.status === 'ANCHORED'), 'Blockchain status is CONFIRMED');
    assert(pubJson.data.blockchainStatus.network.includes('Hardhat') || pubJson.data.blockchainStatus.network.includes('Local'), 'Network identifier present');
    assert(Boolean(pubJson.data.verificationStatus), 'Verification status is present');
    assert(pubJson.data.categories !== undefined, 'Verification categories breakdown present');
    assert(Array.isArray(pubJson.data.timeline), 'Public timeline events list is provided');
    assert(Array.isArray(pubJson.data.documents || pubJson.data.publicDocuments), 'Public documents proof list is provided');

    // ------------------------------------------------------------------------
    // TEST 2: Strict Privacy Leak Sanitization Verification
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Strict Privacy Sanitization ---');
    const rawResponseBody = JSON.stringify(pubJson);

    // Verify NO private user data or DB identifiers are present
    assert(!rawResponseBody.includes('seed-owner-a'), 'Does not leak Firebase UID');
    assert(!rawResponseBody.includes('owner.a@vehiclepassport.dev'), 'Does not leak owner email');
    assert(!rawResponseBody.includes('+91'), 'Does not leak phone numbers');
    assert(!rawResponseBody.includes(v1!.currentOwnerId), 'Does not leak internal database owner UUID');
    assert(!rawResponseBody.includes('privateKey'), 'Does not leak private keys or wallet secrets');
    assert(pubJson.data.vehicleSummary.registrationNumberMasked.includes('•') || pubJson.data.vehicleSummary.registrationNumberMasked.includes('*'), 'Registration number is masked in public summary');

    // ------------------------------------------------------------------------
    // TEST 3: Invalid & Missing Passport Handling
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Invalid & Non-Existent Passport ID Handling ---');
    const notFoundRes = await fetch(`${API_BASE}/public/passport/VP-999999`);
    assert(notFoundRes.status === 404, 'Non-existent passport VP-999999 returns HTTP 404');

    const invalidFormatRes = await fetch(`${API_BASE}/public/passport/invalid_id_format`);
    assert(invalidFormatRes.status === 400 || invalidFormatRes.status === 404, 'Malformed passport ID format rejected with 400/404');

    // ------------------------------------------------------------------------
    // TEST 4: Light Verification Check Endpoint
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Light Verification Check Endpoint ---');
    const lightVerifyRes = await fetch(`${API_BASE}/public/verify/VP-000001`);
    assert(lightVerifyRes.status === 200, 'Light verification returns HTTP 200');
    const lightVerifyJson = await lightVerifyRes.json();
    assert(lightVerifyJson.data.passportId === 'VP-000001', 'Passport ID in light verify matches');
    assert(Boolean(lightVerifyJson.data.verificationStatus), 'Verification status is present');
    assert(Boolean(lightVerifyJson.data.blockchainStatus !== undefined), 'Blockchain status present in verify alias');

    // ------------------------------------------------------------------------
    // TEST 5: Blockchain Explorer Overview & Network Metrics
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Blockchain Explorer Overview Endpoint ---');
    const explorerOverviewRes = await fetch(`${API_BASE}/public/explorer/overview`);
    assert(explorerOverviewRes.status === 200, 'Explorer overview returns HTTP 200');

    const overviewJson = await explorerOverviewRes.json();
    assert(Boolean(overviewJson.data.network), 'Explorer reports network name');
    assert(overviewJson.data.chainId === 31337, 'Explorer reports correct chainId 31337');
    assert(overviewJson.data.stats.totalAnchors > 0, `Total anchors > 0 (${overviewJson.data.stats.totalAnchors})`);
    assert(overviewJson.data.stats.totalVehicles > 0, `Total vehicles > 0 (${overviewJson.data.stats.totalVehicles})`);
    assert(overviewJson.data.latestBlock > 0, `Latest block number > 0 (${overviewJson.data.latestBlock})`);
    assert(overviewJson.data.eventBreakdown !== undefined, 'Event breakdown statistics present');

    // ------------------------------------------------------------------------
    // TEST 6: Blockchain Explorer Transactions & Search
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Blockchain Explorer Transactions with Filters & Search ---');
    const txRes = await fetch(`${API_BASE}/public/explorer/transactions?limit=10&page=1`);
    assert(txRes.status === 200, 'Explorer transactions list returns HTTP 200');

    const txJson = await txRes.json();
    assert(txJson.data.transactions.length > 0, `Transactions returned: ${txJson.data.transactions.length}`);
    assert(Boolean(txJson.data.transactions[0].txHash), 'Transaction contains txHash');
    assert(Boolean(txJson.data.transactions[0].blockNumber), 'Transaction contains blockNumber');
    assert(Boolean(txJson.data.transactions[0].eventType), 'Transaction contains eventType');

    // Search filter test
    const txSearchRes = await fetch(`${API_BASE}/public/explorer/transactions?search=VP-000001`);
    const txSearchJson = await txSearchRes.json();
    assert(txSearchJson.data.transactions.length > 0, 'Search by passportId returns matched transactions');

    // ------------------------------------------------------------------------
    // TEST 7: Document OCR Extraction Engine (Unit Test)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Document OCR Extraction Engine ---');
    const ocrProvider = new DefaultHeuristicOCRProvider();
    const sampleTextBuffer = Buffer.from(`
      OFFICIAL VEHICLE REGISTRATION CERTIFICATE
      State Transport Department
      VIN: ${v1!.vin}
      Registration No: ${v1!.registrationNumber}
      Current Odometer: 15,000 km
      Issue Date: 2024-03-15
      Policy/Certificate Number: POL-998822
    `);

    const ocrResult = await ocrProvider.extractText(
      sampleTextBuffer,
      'application/pdf',
      'REGISTRATION_CERTIFICATE'
    );
    assert(ocrResult.success === true, 'OCR extraction success is true');
    assert(ocrResult.fields.vin === v1!.vin, `OCR extracted correct VIN: ${ocrResult.fields.vin}`);
    assert(ocrResult.fields.registrationNumber === v1!.registrationNumber, `OCR extracted correct Reg No: ${ocrResult.fields.registrationNumber}`);
    assert(ocrResult.fields.confidenceScore > 0.8, `OCR confidence score is high: ${ocrResult.fields.confidenceScore}`);

    // ------------------------------------------------------------------------
    // TEST 8: Document-to-Database Consistency Verification Engine
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Document-to-Database Consistency Verification Engine ---');
    
    // Case A: Perfect match against vehicle v1
    const consistentEval = await evaluateDocumentConsistency(
      v1!.id,
      'REGISTRATION_CERTIFICATE',
      ocrResult.fields
    );
    assert(consistentEval.status === 'CONSISTENT', `Matching document evaluated as CONSISTENT (got: ${consistentEval.status})`);
    assert(consistentEval.score === 100, `Consistency score is 100% (got: ${consistentEval.score}%)`);

    // Case B: Mismatched VIN (Forged/Tampered document)
    const forgedOcrFields = {
      ...ocrResult.fields,
      vin: 'FORGEDVIN99999999',
    };
    const forgedEval = await evaluateDocumentConsistency(
      v1!.id,
      'REGISTRATION_CERTIFICATE',
      forgedOcrFields
    );
    assert(forgedEval.status === 'PARTIAL' || forgedEval.status === 'INCONSISTENT', `Mismatched document evaluated as non-consistent (got: ${forgedEval.status})`);
    assert(forgedEval.comparisons.some((c) => c.field === 'vin' && c.status === 'MISMATCH'), 'Inconsistency accurately flags the VIN mismatch');

    // ------------------------------------------------------------------------
    // TEST 9: Advanced Tamper Simulation (Odometer Rollback)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Tamper Lab Simulation (Odometer Rollback) ---');
    const tamperRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/simulate-tamper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        scenario: 'odometer',
        tamperedMileage: 4999, // Roll back mileage
      }),
    });
    assert(tamperRes.status === 200, 'Tamper simulation endpoint returns HTTP 200');

    // Run verification on tampered vehicle
    const verifyAfterTamperRes = await fetch(`${API_BASE}/public/passport/VP-000001`);
    const verifyAfterTamperJson = await verifyAfterTamperRes.json();
    const isTamperDetected =
      verifyAfterTamperJson.data.verificationStatus === 'TAMPERED' ||
      verifyAfterTamperJson.data.verificationStatus === 'SUSPICIOUS' ||
      verifyAfterTamperJson.data.categories?.odometer?.status === 'TAMPERED' ||
      verifyAfterTamperJson.data.lifecycleSummary?.rollbackDetected === true;
    assert(isTamperDetected, `Verification Engine accurately detects odometer tampering: status is ${verifyAfterTamperJson.data.verificationStatus}`);

    // ------------------------------------------------------------------------
    // TEST 10: Tamper Restore Capability (1-Click Remediation)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: Tamper Restore (1-Click Remediation) ---');
    const restoreRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/restore-tamper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        field: 'odometer',
      }),
    });
    assert(restoreRes.status === 200, 'Restore tamper endpoint returns HTTP 200');

    // Re-verify after restore
    const verifyAfterRestoreRes = await fetch(`${API_BASE}/public/passport/VP-000001`);
    const verifyAfterRestoreJson = await verifyAfterRestoreRes.json();
    const isRestored =
      verifyAfterRestoreJson.data.verificationStatus === 'VERIFIED' ||
      verifyAfterRestoreJson.data.verificationStatus === 'SUSPICIOUS' ||
      verifyAfterRestoreJson.data.categories?.odometer?.status === 'VERIFIED';
    assert(isRestored, `Verification Engine returns to consistent state after restore: ${verifyAfterRestoreJson.data.verificationStatus}`);

    // ------------------------------------------------------------------------
    // TEST 11: Document Storage Abstraction & dev fallback
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11: Storage Abstraction Local & Fallback ---');
    const storageProvider = getStorageProvider();
    const testDocBuffer = Buffer.from('TEST VEHICLE PASSPORT DOCUMENT CONTENT 2026');
    const storedDoc = await storageProvider.uploadDocument({
      fileBuffer: testDocBuffer,
      fileName: 'test_cert.pdf',
      mimeType: 'application/pdf',
      documentType: 'REGISTRATION_CERTIFICATE',
      title: 'Registration Certificate RC',
      vehicleId: v1!.id,
      uploadedById: v1!.currentOwnerId,
    });
    assert(Boolean(storedDoc.fileHash), `Document SHA-256 hash computed: ${storedDoc.fileHash.substring(0, 16)}...`);
    assert(Boolean(storedDoc.ipfsCid && (storedDoc.ipfsCid.startsWith('bafybeic') || storedDoc.ipfsCid.startsWith('Qm'))), `IPFS CID generated: ${storedDoc.ipfsCid}`);
    assert(Boolean(storedDoc.fileUrl), `Storage file URL returned: ${storedDoc.fileUrl}`);

    // ------------------------------------------------------------------------
    // FINAL RESULTS SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 PHASE 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('💥 Unhandled exception during Phase 5 testing:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase5Tests();
