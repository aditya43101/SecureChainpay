import { ethers } from 'ethers';
import {
  buildMerkleTree,
  computeLeafHash,
  verifyInclusionProof,
  hashPair,
  validateBatchRecords,
  sortBatchRecords,
  MerkleRecordInput,
  LEAF_DOMAIN_TAG,
  MERKLE_ALGORITHM_VERSION,
} from '../src/blockchain/services/merkleService';

async function runMerkleUnitTests() {
  console.log('================================================================');
  console.log('⚡ MERKLE SERVICE CRYPTOGRAPHIC UNIT TEST SUITE (PHASE 6)');
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

  // 1. Empty Batch Rejection
  console.log('--- 1. Input Validation & Edge Cases ---');
  try {
    buildMerkleTree([]);
    assert(false, 'Should reject empty batch');
  } catch (err: any) {
    assert(err.message.includes('Batch cannot be empty'), 'Rejects empty batch inputs');
  }

  // 2. Duplicate Record ID Rejection
  try {
    const dups: MerkleRecordInput[] = [
      { recordId: 'REC-001', recordType: 'SERVICE', recordHash: ethers.keccak256(ethers.toUtf8Bytes('hash1')) },
      { recordId: 'REC-001', recordType: 'SERVICE', recordHash: ethers.keccak256(ethers.toUtf8Bytes('hash2')) },
    ];
    buildMerkleTree(dups);
    assert(false, 'Should reject duplicate record IDs');
  } catch (err: any) {
    assert(err.message.includes('Duplicate record ID'), 'Rejects duplicate record IDs in batch');
  }

  // 3. Single Leaf Batch
  console.log('\n--- 2. Single Leaf Tree ---');
  const singleRec: MerkleRecordInput[] = [
    { recordId: 'REC-001', recordType: 'SERVICE', recordHash: ethers.keccak256(ethers.toUtf8Bytes('hash1')) },
  ];
  const singleTree = buildMerkleTree(singleRec);
  const expectedSingleLeaf = computeLeafHash(singleRec[0]);
  assert(singleTree.root === expectedSingleLeaf, 'Single leaf tree root equals the leaf itself');
  assert(singleTree.leafCount === 1, 'Single leaf tree leaf count is 1');
  assert(singleTree.proofs['REC-001'].length === 0, 'Single leaf proof is empty array []');
  const singleVerify = verifyInclusionProof(expectedSingleLeaf, singleTree.proofs['REC-001'], singleTree.root);
  assert(singleVerify.valid, 'Single leaf inclusion proof verifies against root');

  // 4. Two Leaf Batch
  console.log('\n--- 3. Two Leaf Tree ---');
  const twoRecs: MerkleRecordInput[] = [
    { recordId: 'REC-001', recordType: 'SERVICE', recordHash: ethers.keccak256(ethers.toUtf8Bytes('hash1')) },
    { recordId: 'REC-002', recordType: 'ODOMETER', recordHash: ethers.keccak256(ethers.toUtf8Bytes('hash2')) },
  ];
  const twoTree = buildMerkleTree(twoRecs);
  const leaf0 = computeLeafHash(twoRecs[0]);
  const leaf1 = computeLeafHash(twoRecs[1]);
  const expectedTwoRoot = hashPair(leaf0, leaf1);
  assert(twoTree.root === expectedTwoRoot, 'Two leaf tree root is hashPair(leaf0, leaf1)');
  assert(twoTree.proofs['REC-001'].length === 1, 'Two leaf proof has 1 element');
  assert(twoTree.proofs['REC-001'][0] === leaf1, 'Proof for leaf0 is leaf1');
  assert(twoTree.proofs['REC-002'][0] === leaf0, 'Proof for leaf1 is leaf0');
  assert(verifyInclusionProof(leaf0, twoTree.proofs['REC-001'], twoTree.root).valid, 'Leaf 0 proof verifies');
  assert(verifyInclusionProof(leaf1, twoTree.proofs['REC-002'], twoTree.root).valid, 'Leaf 1 proof verifies');

  // 5. Odd Leaf Counts (3, 5, 7, 13)
  console.log('\n--- 4. Odd Leaf Trees (Promote Unchanged Convention) ---');
  for (const count of [3, 5, 7, 13]) {
    const oddRecs: MerkleRecordInput[] = Array.from({ length: count }, (_, i) => ({
      recordId: `REC-${String(i + 1).padStart(3, '0')}`,
      recordType: i % 2 === 0 ? 'SERVICE' : 'ODOMETER',
      recordHash: ethers.keccak256(ethers.toUtf8Bytes(`seed-record-${i + 1}`)),
    }));

    const oddTree = buildMerkleTree(oddRecs);
    assert(oddTree.leafCount === count, `Odd tree (${count} leaves) has leafCount ${count}`);
    assert(Boolean(oddTree.root && oddTree.root.startsWith('0x')), `Odd tree (${count} leaves) has valid root`);

    // Verify all proofs
    let allValid = true;
    for (const rec of oddRecs) {
      const leaf = computeLeafHash(rec);
      const proof = oddTree.proofs[rec.recordId];
      const res = verifyInclusionProof(leaf, proof, oddTree.root);
      if (!res.valid) {
        allValid = false;
        console.error(`Verification failed for ${rec.recordId} in count=${count}`);
      }
    }
    assert(allValid, `All ${count} inclusion proofs verify against root`);
  }

  // 6. Non-power-of-two Larger Batch (10, 50 leaves)
  console.log('\n--- 5. Non-Power-of-Two Larger Trees ---');
  for (const count of [10, 50]) {
    const recs: MerkleRecordInput[] = Array.from({ length: count }, (_, i) => ({
      recordId: `REC-${String(i + 1).padStart(4, '0')}`,
      recordType: 'SERVICE',
      recordHash: ethers.keccak256(ethers.toUtf8Bytes(`large-batch-${i + 1}`)),
    }));
    const tree = buildMerkleTree(recs);
    let allPass = true;
    for (const rec of recs) {
      const leaf = computeLeafHash(rec);
      const proof = tree.proofs[rec.recordId];
      const res = verifyInclusionProof(leaf, proof, tree.root);
      if (!res.valid) allPass = false;
    }
    assert(allPass, `All ${count} leaves in non-power-of-two batch verified`);
  }

  // 7. Deterministic Input Ordering
  console.log('\n--- 6. Deterministic Input Ordering ---');
  const baseRecs: MerkleRecordInput[] = [
    { recordId: 'REC-003', recordType: 'SERVICE', recordHash: ethers.keccak256(ethers.toUtf8Bytes('c')) },
    { recordId: 'REC-001', recordType: 'SERVICE', recordHash: ethers.keccak256(ethers.toUtf8Bytes('a')) },
    { recordId: 'REC-004', recordType: 'SERVICE', recordHash: ethers.keccak256(ethers.toUtf8Bytes('d')) },
    { recordId: 'REC-002', recordType: 'SERVICE', recordHash: ethers.keccak256(ethers.toUtf8Bytes('b')) },
  ];
  const shuffledRecs = [baseRecs[3], baseRecs[0], baseRecs[1], baseRecs[2]];

  const treeA = buildMerkleTree(baseRecs);
  const treeB = buildMerkleTree(shuffledRecs);

  assert(treeA.root === treeB.root, 'Roots are identical regardless of input array ordering');
  assert(
    JSON.stringify(treeA.proofs['REC-001']) === JSON.stringify(treeB.proofs['REC-001']),
    'Proofs for REC-001 are identical between shuffled input orders'
  );

  // 8. Adversarial Tests: Tampered Leaf, Sibling, Root, Missing/Extra Elements
  console.log('\n--- 7. Cryptographic Adversarial Tests ---');
  const advRecs: MerkleRecordInput[] = Array.from({ length: 6 }, (_, i) => ({
    recordId: `ADV-${i + 1}`,
    recordType: 'SERVICE',
    recordHash: ethers.keccak256(ethers.toUtf8Bytes(`adv-${i + 1}`)),
  }));
  const advTree = buildMerkleTree(advRecs);
  const validLeaf = computeLeafHash(advRecs[0]);
  const validProof = [...advTree.proofs['ADV-1']];

  // A. Tampered leaf
  const tamperedLeaf = ethers.keccak256(ethers.toUtf8Bytes('tampered-leaf'));
  const tamperLeafRes = verifyInclusionProof(tamperedLeaf, validProof, advTree.root);
  assert(!tamperLeafRes.valid, 'Rejects tampered leaf');

  // B. Tampered proof element
  const tamperedProof = [...validProof];
  tamperedProof[0] = ethers.keccak256(ethers.toUtf8Bytes('corrupted-sibling'));
  const tamperProofRes = verifyInclusionProof(validLeaf, tamperedProof, advTree.root);
  assert(!tamperProofRes.valid, 'Rejects tampered proof sibling');

  // C. Removed proof element
  const missingProof = validProof.slice(1);
  const missingProofRes = verifyInclusionProof(validLeaf, missingProof, advTree.root);
  assert(!missingProofRes.valid, 'Rejects proof with missing sibling');

  // D. Extra proof element
  const extraProof = [...validProof, ethers.keccak256(ethers.toUtf8Bytes('extra-sibling'))];
  const extraProofRes = verifyInclusionProof(validLeaf, extraProof, advTree.root);
  assert(!extraProofRes.valid, 'Rejects proof with extra sibling');

  // E. Wrong root
  const wrongRoot = ethers.keccak256(ethers.toUtf8Bytes('wrong-root'));
  const wrongRootRes = verifyInclusionProof(validLeaf, validProof, wrongRoot);
  assert(!wrongRootRes.valid, 'Rejects wrong root');

  // F. Cross-record proof swap (Proof of Record 2 used for Record 1)
  const proofRec2 = advTree.proofs['ADV-2'];
  const crossProofRes = verifyInclusionProof(validLeaf, proofRec2, advTree.root);
  assert(!crossProofRes.valid, 'Rejects proof generated for a different record');

  // G. Domain tag verification
  assert(
    LEAF_DOMAIN_TAG === ethers.keccak256(ethers.toUtf8Bytes('VEHICLE_PASSPORT_MERKLE_LEAF_V1')),
    'Leaf domain tag matches agreed specification'
  );

  console.log('\n================================================================');
  console.log(`🏁 MERKLE TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMerkleUnitTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
