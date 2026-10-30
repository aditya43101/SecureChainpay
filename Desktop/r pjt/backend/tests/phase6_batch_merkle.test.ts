import { prisma } from '../src/lib/prisma';
import { ethers } from 'ethers';
import { BatchOrchestrationService } from '../src/blockchain/services/batchOrchestrationService';
import { BlockchainService } from '../src/blockchain/services/blockchainService';
import { MerkleBatchStatus } from '@prisma/client';

const API_BASE = 'http://localhost:5001/api';

async function runPhase6Tests() {
  console.log('================================================================');
  console.log('⚡ PHASE 6 TEST SUITE: MERKLE TREE, BATCH ANCHORING & VERIFICATION');
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
    console.log('--- 1. Authentication & Token Setup ---');
    const tokenOwner = await getUserToken('seed-owner-a', 'owner.a@vehiclepassport.dev', 'Alex Mercer');
    const tokenGarage = await getUserToken('seed-garage', 'garage@vehiclepassport.dev', 'Apex Certified');
    const tokenAdmin = await getUserToken('seed-admin', 'admin@vehiclepassport.dev', 'Platform Administrator');
    assert(Boolean(tokenOwner && tokenGarage && tokenAdmin), 'Tokens obtained for Owner, Garage, and Admin');

    const vehicle = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000001' },
    });
    assert(Boolean(vehicle), 'Vehicle VP-000001 found in database');

    // 2. Query Eligible Records
    console.log('\n--- 2. Eligible Record Discovery ---');
    const eligibleRes = await fetch(`${API_BASE}/blockchain/batches/eligible?limit=20`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const eligibleData = await eligibleRes.json();
    assert(eligibleRes.ok && eligibleData.success, 'GET /blockchain/batches/eligible succeeds');
    assert(Array.isArray(eligibleData.data.records), 'Eligible records returned as array');
    console.log(`ℹ️ Eligible unbatched records found: ${eligibleData.data.count}`);

    // If fewer than 2 unbatched service records exist, create fresh ones for the test
    const unbatchedServices = eligibleData.data.records.filter((r: any) => r.recordType === 'SERVICE');
    if (unbatchedServices.length < 2) {
      const latestService = await prisma.serviceRecord.findFirst({
        where: { vehicleId: vehicle!.id },
        orderBy: { mileage: 'desc' },
      });
      const baseMileage = latestService ? latestService.mileage + 1000 : 40000;
      for (let i = 1; i <= 3; i++) {
        const date = new Date(Date.now() - (4 - i) * 86400000);
        const sRes = await fetch(`${API_BASE}/vehicles/${vehicle!.id}/services`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenGarage}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serviceDate: date.toISOString(),
            mileage: baseMileage + i * 1000,
            serviceType: `Periodic Service Tier ${Date.now()}-${i}`,
            description: `Scheduled maintenance check ${Date.now()}-${i}`,
            partsReplaced: 'Oil, Air Filter',
            cost: 250 + i * 20,
            technician: 'Master Tech Roy',
          }),
        });
        await sRes.json();
      }
    }

    // Refresh eligible list
    const freshEligibleRes = await fetch(`${API_BASE}/blockchain/batches/eligible?limit=20`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const freshEligible = await freshEligibleRes.json();
    assert(freshEligible.data.count >= 2, 'At least 2 eligible records available for batching');
    const serviceRecs = freshEligible.data.records.filter((r: any) => r.recordType === 'SERVICE');
    const otherRecs = freshEligible.data.records.filter((r: any) => r.recordType !== 'SERVICE');
    const selectedRecords = [...serviceRecs.slice(0, 2), ...otherRecs.slice(0, 1)];
    const targetRecordIds = selectedRecords.map((r: any) => r.recordId);
    const testServiceId = serviceRecs[0] ? serviceRecs[0].recordId : targetRecordIds[0];

    // 3. RBAC Checks for Batch Creation
    console.log('\n--- 3. RBAC Enforcement for Batch Creation ---');
    // Unauthorized (no token)
    const noAuthRes = await fetch(`${API_BASE}/blockchain/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordIds: targetRecordIds }),
    });
    assert(noAuthRes.status === 401, 'Rejects unauthenticated batch creation (HTTP 401)');

    // Forbidden (Vehicle Owner role)
    const ownerRes = await fetch(`${API_BASE}/blockchain/batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwner}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recordIds: targetRecordIds }),
    });
    assert(ownerRes.status === 403, 'Rejects VEHICLE_OWNER from creating batches (HTTP 403 Forbidden)');

    // 4. Batch Creation by Authorized Admin
    console.log('\n--- 4. Authorized Merkle Batch Creation & Anchoring ---');
    const createRes = await fetch(`${API_BASE}/blockchain/batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recordIds: targetRecordIds,
        autoSubmit: true,
      }),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.success, 'Admin creates batch successfully (HTTP 201)');
    const createdBatch = createData.data.batch;
    assert(Boolean(createdBatch.batchIdentifier), `Batch identifier assigned: ${createdBatch.batchIdentifier}`);
    assert(createdBatch.leafCount === targetRecordIds.length, `Leaf count matches inputs: ${createdBatch.leafCount}`);
    assert(ethers.isHexString(createdBatch.merkleRoot, 32), 'Merkle root is valid 32-byte hex string');
    assert(createdBatch.status === 'CONFIRMED', 'Batch status is CONFIRMED on-chain');
    assert(Boolean(createdBatch.transactionHash), `Transaction hash recorded: ${createdBatch.transactionHash}`);
    assert(Number(createdBatch.blockNumber) > 0, `Block number recorded: ${createdBatch.blockNumber}`);

    // Verify on-chain state directly from smart contract
    const bcService = BlockchainService.getInstance();
    const onChainBatch = await bcService.getOnChainBatch(createdBatch.batchIdHex);
    assert(onChainBatch.active, 'Batch is active on smart contract');
    assert(
      onChainBatch.merkleRoot.toLowerCase() === createdBatch.merkleRoot.toLowerCase(),
      'On-chain Merkle root exactly matches database committed root'
    );
    assert(Number(onChainBatch.leafCount) === createdBatch.leafCount, 'On-chain leaf count matches batch');

    // 5. Concurrency & Duplicate Batch Prevention
    console.log('\n--- 5. Concurrency & Duplicate Record Prevention ---');
    const dupRes = await fetch(`${API_BASE}/blockchain/batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recordIds: [targetRecordIds[0]] }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 500 && dupData.error.includes('already assigned to active batch'), 'Rejects re-batching already batched active record');

    // 6. Batch Listing & Explorer API
    console.log('\n--- 6. Batch Listing & Details API ---');
    const listRes = await fetch(`${API_BASE}/blockchain/batches?limit=10`);
    const listData = await listRes.json();
    assert(listRes.ok && listData.success, 'Public GET /blockchain/batches succeeds');
    assert(listData.data.batches.length >= 1, 'Batches list contains at least 1 batch');
    assert(listData.data.stats.totalBatches >= 1, 'Aggregated total batches counter is accurate');
    assert(listData.data.stats.confirmedBatches >= 1, 'Aggregated confirmed batches counter is accurate');
    assert(listData.data.stats.totalCommittedRecords >= targetRecordIds.length, 'Committed records counter is accurate');

    const detailRes = await fetch(`${API_BASE}/blockchain/batches/${createdBatch.batchIdentifier}`);
    const detailData = await detailRes.json();
    assert(detailRes.ok && detailData.success, 'GET /blockchain/batches/:batchId succeeds');
    assert(detailData.data.onChain.isAnchored === true, 'Batch details report isAnchored: true');
    assert(detailData.data.batch.records.length === targetRecordIds.length, 'Batch details include all record commitments');

    // 7. Individual Inclusion Proof API
    console.log('\n--- 7. Individual Inclusion Proof API ---');
    const proofRes = await fetch(
      `${API_BASE}/blockchain/batches/${createdBatch.batchIdentifier}/proof/${targetRecordIds[0]}`
    );
    const proofData = await proofRes.json();
    assert(proofRes.ok && proofData.success, 'GET /blockchain/batches/:batchId/proof/:recordId succeeds');
    assert(proofData.data.recordId === targetRecordIds[0], 'Proof returned for requested record ID');
    assert(ethers.isHexString(proofData.data.leafHash, 32), 'Leaf hash is valid 32-byte hex string');
    assert(Array.isArray(proofData.data.proof), 'Proof is returned as array of 32-byte siblings');
    assert(proofData.data.proofVerification.valid === true, 'Inclusion proof verifies against batch root');
    assert(proofData.data.onChain.isAnchored === true, 'Proof on-chain verification confirms batch anchor');

    // 8. Direct Proof Verification API
    console.log('\n--- 8. Direct Proof Verification API ---');
    const directRes = await fetch(`${API_BASE}/blockchain/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaf: proofData.data.leafHash,
        proof: proofData.data.proof,
        root: createdBatch.merkleRoot,
        batchIdHex: createdBatch.batchIdHex,
      }),
    });
    const directData = await directRes.json();
    assert(directRes.ok && directData.data.isValid === true, 'Direct verification confirms valid proof');
    assert(directData.data.onChainVerified === true, 'On-chain verification confirms inclusion');

    // 9. Adversarial Verification Tests
    console.log('\n--- 9. Adversarial Proof Verification Tests ---');
    // Tampered leaf
    const badLeafRes = await fetch(`${API_BASE}/blockchain/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaf: ethers.keccak256(ethers.toUtf8Bytes('corrupted-record')),
        proof: proofData.data.proof,
        root: createdBatch.merkleRoot,
        batchIdHex: createdBatch.batchIdHex,
      }),
    });
    const badLeafData = await badLeafRes.json();
    assert(badLeafData.data.isValid === false, 'Rejects corrupted leaf');
    assert(badLeafData.data.onChainVerified === false, 'On-chain check rejects corrupted leaf');

    // Tampered sibling
    const corruptedProof = [...proofData.data.proof];
    if (corruptedProof.length > 0) {
      corruptedProof[0] = ethers.keccak256(ethers.toUtf8Bytes('tampered-sibling'));
    } else {
      corruptedProof.push(ethers.keccak256(ethers.toUtf8Bytes('extra-sibling')));
    }
    const badProofRes = await fetch(`${API_BASE}/blockchain/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaf: proofData.data.leafHash,
        proof: corruptedProof,
        root: createdBatch.merkleRoot,
        batchIdHex: createdBatch.batchIdHex,
      }),
    });
    const badProofData = await badProofRes.json();
    assert(badProofData.data.isValid === false, 'Rejects tampered proof sibling');

    // Wrong root
    const badRootRes = await fetch(`${API_BASE}/blockchain/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaf: proofData.data.leafHash,
        proof: proofData.data.proof,
        root: ethers.keccak256(ethers.toUtf8Bytes('unanchored-fake-root')),
      }),
    });
    const badRootData = await badRootRes.json();
    assert(badRootData.data.isValid === false, 'Rejects fake/wrong root');

    // 10. End-to-End Individual Record Verification & Tamper Detection
    console.log('\n--- 10. End-to-End Individual Record Verification & Tamper Detection ---');
    const orchService = BatchOrchestrationService.getInstance();

    // Initial check: record is verified
    const vReport1 = await orchService.verifyRecord(testServiceId, 'SERVICE');
    assert(vReport1.overallStatus === 'VERIFIED', 'Record verification initially returns VERIFIED');
    assert(vReport1.anchoringMode === 'BATCH_MERKLE', 'Anchoring mode is BATCH_MERKLE');
    assert(vReport1.recordHashStatus === 'MATCH', 'Record hash status is MATCH');
    assert(vReport1.proofStatus === 'VALID', 'Proof status is VALID');
    assert(vReport1.blockchainRootStatus === 'MATCH', 'Blockchain root status is MATCH');

    // Simulate tampering: modify service record description in database
    const originalService = await prisma.serviceRecord.findUnique({ where: { id: testServiceId } });
    assert(Boolean(originalService), 'Original service record found for tamper test');
    await prisma.serviceRecord.update({
      where: { id: testServiceId },
      data: { description: 'TAMPERED ENGINE WORK UNAUTHORIZED' },
    });

    const vReport2 = await orchService.verifyRecord(testServiceId, 'SERVICE');
    assert(
      vReport2.overallStatus === 'RECORD_HASH_MISMATCH',
      'Tampered record detected as RECORD_HASH_MISMATCH'
    );
    assert(vReport2.recordHashStatus === 'MISMATCH', 'Record hash status reports MISMATCH');

    // Restore original record
    await prisma.serviceRecord.update({
      where: { id: testServiceId },
      data: { description: originalService!.description },
    });

    const vReport3 = await orchService.verifyRecord(testServiceId, 'SERVICE');
    assert(vReport3.overallStatus === 'VERIFIED', 'Restored record returns to VERIFIED');

    // 11. Idempotent Reconciliation Test
    console.log('\n--- 11. Idempotent Batch Reconciliation ---');
    const recRes = await fetch(`${API_BASE}/blockchain/batches/${createdBatch.id}/reconcile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const recData = await recRes.json();
    assert(recRes.ok && recData.success, 'Reconciliation endpoint succeeds');
    assert(recData.data.status === 'CONFIRMED', 'Reconciliation confirms batch remains CONFIRMED');

    // 12. Vehicle Blockchain Verification Endpoint
    console.log('\n--- 12. Vehicle Blockchain Verification Aggregator ---');
    const vehVerifRes = await fetch(`${API_BASE}/vehicles/${vehicle!.id}/blockchain-verification`, {
      headers: { Authorization: `Bearer ${tokenOwner}` },
    });
    const vehVerifData = await vehVerifRes.json();
    assert(vehVerifRes.ok && vehVerifData.success, 'GET /vehicles/:vehicleId/blockchain-verification succeeds');
    assert(vehVerifData.data.summary.totalRecords >= 1, 'Verification summary reports total records');
    assert(vehVerifData.data.summary.batchAnchoredRecords >= 1, 'Verification summary reports batch-anchored records');
    assert(Array.isArray(vehVerifData.data.records), 'Verification report includes detailed records breakdown');

    console.log('\n================================================================');
    console.log(`🏁 PHASE 6 TEST SUITE RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution encountered unhandled error:', err);
    process.exit(1);
  }
}

runPhase6Tests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
