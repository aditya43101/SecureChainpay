import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('================================================================');
  console.log('🔍 DEEP VERIFICATION SCRIPT FOR BLOCKCHAIN QA');
  console.log('================================================================');

  const provider = ethers.provider;
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const ownerA = signers[1]; // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Alex Mercer)
  const ownerB = signers[2]; // 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (Elena Rostova)
  const garage = signers[3]; // 0x90F79bf6EB2c4f870365E785982E1f101E93b906

  const vpArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../../backend/src/blockchain/contracts/VehiclePassport.json'), 'utf8'));
  const vpContract = (await ethers.getContractFactory('VehiclePassport')).attach(vpArtifact.address) as any;

  const pvArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../../backend/src/blockchain/contracts/PrivacyVerifier.json'), 'utf8'));
  const pvContract = (await ethers.getContractFactory('PrivacyVerifier')).attach(pvArtifact.address) as any;

  console.log('\n--- 1. ALEX MERCER ON-CHAIN USER STATE ---');
  // Alex Mercer seed UID: 'seed-owner-a'
  // Let's verify Alex Mercer by ID USR-000023 and wallet address
  const alexUser = await vpContract.getUserById('USR-000023');
  console.log('Alex Mercer User Record:');
  console.log(`  blockchainUserId: ${alexUser.blockchainUserId}`);
  console.log(`  userReferenceHash: ${alexUser.userReferenceHash}`);
  console.log(`  walletAddress: ${alexUser.walletAddress}`);
  console.log(`  role: ${alexUser.role}`);
  console.log(`  createdAt: ${alexUser.createdAt} (${new Date(Number(alexUser.createdAt) * 1000).toISOString()})`);
  console.log(`  active: ${alexUser.active}`);

  // Fetch Alex Mercer initialization tx receipt
  const alexTxHash = '0xc76080811bc7440d8da24c412d0aedf4c58eb439bbe4d8446932e3d6e24cbafc';
  const alexReceipt = await provider.getTransactionReceipt(alexTxHash);
  if (alexReceipt) {
    console.log(`  Transaction Hash: ${alexReceipt.hash}`);
    console.log(`  Block Number: ${alexReceipt.blockNumber}`);
    console.log(`  Gas Used: ${alexReceipt.gasUsed.toString()}`);
    console.log(`  Status: ${alexReceipt.status === 1 ? 'SUCCESS (1)' : 'FAILED (0)'}`);
  } else {
    console.log(`  Transaction receipt not found for ${alexTxHash}`);
  }

  console.log('\n--- 2. TATA NEXON EV ON-CHAIN VEHICLE STATE ---');
  const nexonVehicle = await vpContract.getVehicleById('VEH-000030');
  console.log('Tata Nexon EV Record:');
  console.log(`  blockchainVehicleId: ${nexonVehicle.blockchainVehicleId}`);
  console.log(`  passportId: ${nexonVehicle.passportId}`);
  console.log(`  ownerAddress: ${nexonVehicle.ownerAddress}`);
  console.log(`  vehicleRecordHash: ${nexonVehicle.vehicleRecordHash}`);
  console.log(`  createdAt: ${nexonVehicle.createdAt} (${new Date(Number(nexonVehicle.createdAt) * 1000).toISOString()})`);
  console.log(`  active: ${nexonVehicle.active}`);

  // Also query by Passport ID
  const nexonByPassport = await vpContract.getVehicleByPassportId('VP-000001');
  console.log(`  getVehicleByPassportId('VP-000001') -> matches VEH-000030: ${nexonByPassport.blockchainVehicleId === 'VEH-000030'}`);

  const nexonTxHash = '0x65e5e98bf4758b133b5ed697628df61767775f3476a4e285c708a58a072b19f6';
  const nexonReceipt = await provider.getTransactionReceipt(nexonTxHash);
  if (nexonReceipt) {
    console.log(`  Transaction Hash: ${nexonReceipt.hash}`);
    console.log(`  Block Number: ${nexonReceipt.blockNumber}`);
    console.log(`  Gas Used: ${nexonReceipt.gasUsed.toString()}`);
    console.log(`  Status: ${nexonReceipt.status === 1 ? 'SUCCESS (1)' : 'FAILED (0)'}`);
  }

  // Vehicles owned by Alex Mercer (0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
  const alexVehicles = await vpContract.getVehiclesByOwner(ownerA.address);
  console.log(`  Alex Mercer Owned Vehicles (${alexVehicles.length}): ${alexVehicles.join(', ')}`);

  // Records for Tata Nexon EV
  const nexonRecords = await vpContract.getVehicleRecords('VEH-000030');
  console.log(`  Tata Nexon EV Anchored Records (${nexonRecords.length}):`);
  for (const rId of nexonRecords) {
    const r = await vpContract.getRecord(rId);
    console.log(`    - ${rId} [${r.recordType}]: hash=${r.recordHash} actor=${r.actorAddress} blockTimestamp=${r.timestamp}`);
  }

  console.log('\n--- 3. NEGATIVE TESTING / AUTHORIZATION & CONSTRAINT VERIFICATION ---');

  // Test 3.1: Duplicate user registration by ID
  try {
    const dummyRef = ethers.keccak256(ethers.toUtf8Bytes('dummy-user-ref-unique'));
    await vpContract.initializeUser('USR-000023', dummyRef, ethers.ZeroAddress, 'TEST');
    console.log('  ❌ FAILED: Duplicate user ID should have reverted!');
  } catch (err: any) {
    console.log(`  ✅ Duplicate userId correctly reverted: "${err.reason || err.message}"`);
  }

  // Test 3.2: Duplicate user registration by userReferenceHash
  try {
    await vpContract.initializeUser('USR-NEW-TEST', alexUser.userReferenceHash, ethers.ZeroAddress, 'TEST');
    console.log('  ❌ FAILED: Duplicate userReferenceHash should have reverted!');
  } catch (err: any) {
    console.log(`  ✅ Duplicate userReferenceHash correctly reverted: "${err.reason || err.message}"`);
  }

  // Test 3.3: Duplicate vehicle registration by vehicleId
  try {
    const dummyHash = ethers.keccak256(ethers.toUtf8Bytes('dummy-veh-hash'));
    await vpContract.registerVehicle('VEH-000030', dummyHash, 'VP-UNIQUE-999', ownerA.address);
    console.log('  ❌ FAILED: Duplicate vehicleId should have reverted!');
  } catch (err: any) {
    console.log(`  ✅ Duplicate vehicleId correctly reverted: "${err.reason || err.message}"`);
  }

  // Test 3.4: Duplicate vehicle registration by passportId
  try {
    const dummyHash = ethers.keccak256(ethers.toUtf8Bytes('dummy-veh-hash-2'));
    await vpContract.registerVehicle('VEH-NEW-TEST', dummyHash, 'VP-000001', ownerA.address);
    console.log('  ❌ FAILED: Duplicate passportId should have reverted!');
  } catch (err: any) {
    console.log(`  ✅ Duplicate passportId correctly reverted: "${err.reason || err.message}"`);
  }

  // Test 3.5: Ownership transfer self-transfer rejection
  try {
    const transferHash = ethers.keccak256(ethers.toUtf8Bytes('TRANSFER_SELF_TEST'));
    await vpContract.transferVehicleOwnership('VEH-000030', ownerA.address, transferHash, 'REC-TEST-SELF');
    console.log('  ❌ FAILED: Self-transfer should have reverted!');
  } catch (err: any) {
    console.log(`  ✅ Self-transfer to current owner correctly reverted: "${err.reason || err.message}"`);
  }

  // Test 3.6: Unauthorized ownership transfer (non-owner calling onlyOwner method)
  try {
    const transferHash = ethers.keccak256(ethers.toUtf8Bytes('TRANSFER_UNAUTH_TEST'));
    await vpContract.connect(ownerA).transferVehicleOwnership('VEH-000030', ownerB.address, transferHash, 'REC-TEST-UNAUTH');
    console.log('  ❌ FAILED: Non-contract-owner transfer call should have reverted!');
  } catch (err: any) {
    console.log(`  ✅ Non-contract-owner call correctly reverted with error: "${err.message.includes('OwnableUnauthorizedAccount') ? 'OwnableUnauthorizedAccount' : err.message}"`);
  }

  // Test 3.7: Unauthorized user initialization
  try {
    const dummyRef = ethers.keccak256(ethers.toUtf8Bytes('dummy-ref-unauth'));
    await vpContract.connect(ownerB).initializeUser('USR-UNAUTH', dummyRef, ethers.ZeroAddress, 'TEST');
    console.log('  ❌ FAILED: Non-owner initializeUser should have reverted!');
  } catch (err: any) {
    console.log(`  ✅ Non-contract-owner initializeUser correctly reverted with: "${err.message.includes('OwnableUnauthorizedAccount') ? 'OwnableUnauthorizedAccount' : err.message}"`);
  }

  console.log('\n--- 4. MERKLE BATCH ANCHORING & PROOF VERIFICATION (PHASE 6) ---');
  // Helper for sorted pair hash
  function hashPair(a: string, b: string): string {
    const [left, right] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
    return ethers.keccak256(ethers.concat([left, right]));
  }

  const testBatchId = ethers.keccak256(ethers.toUtf8Bytes('BATCH-LIVE-QA-2026-01'));
  const leafA = ethers.keccak256(ethers.toUtf8Bytes('QA-LEAF-RECORD-A'));
  const leafB = ethers.keccak256(ethers.toUtf8Bytes('QA-LEAF-RECORD-B'));
  const leafC = ethers.keccak256(ethers.toUtf8Bytes('QA-LEAF-RECORD-C'));
  const leafD = ethers.keccak256(ethers.toUtf8Bytes('QA-LEAF-RECORD-D'));

  const parentAB = hashPair(leafA, leafB);
  const parentCD = hashPair(leafC, leafD);
  const merkleRoot = hashPair(parentAB, parentCD);
  const metaHash = ethers.keccak256(ethers.toUtf8Bytes('QA-METADATA-JSON'));

  console.log(`  Submitting live on-chain batch anchor for batchId: ${testBatchId}...`);
  const batchTx = await vpContract.anchorBatch(testBatchId, merkleRoot, 4, metaHash);
  const batchReceipt = await batchTx.wait();
  console.log(`  ✅ Batch anchored! Tx Hash: ${batchReceipt.hash}, Block Number: ${batchReceipt.blockNumber}, Gas: ${batchReceipt.gasUsed.toString()}`);

  const onChainBatch = await vpContract.getBatch(testBatchId);
  console.log(`  On-chain Merkle Root: ${onChainBatch.merkleRoot} (Matches: ${onChainBatch.merkleRoot === merkleRoot})`);
  console.log(`  On-chain Leaf Count: ${onChainBatch.leafCount.toString()}`);

  // Inclusion proof for Leaf A: sibling leafB, then sibling parentCD
  const proofA = [leafB, parentCD];
  const isPureVerified = await vpContract.verifyInclusionProof(leafA, proofA, merkleRoot);
  console.log(`  verifyInclusionProof(leafA, proofA, root) -> ${isPureVerified} (Expected: true)`);

  const isOnChainVerified = await vpContract.verifyBatchInclusion(testBatchId, leafA, proofA);
  console.log(`  verifyBatchInclusion(testBatchId, leafA, proofA) -> ${isOnChainVerified} (Expected: true)`);

  // Sibling proof for Leaf C: sibling leafD, then sibling parentAB
  const proofC = [leafD, parentAB];
  const isOnChainVerifiedC = await vpContract.verifyBatchInclusion(testBatchId, leafC, proofC);
  console.log(`  verifyBatchInclusion(testBatchId, leafC, proofC) -> ${isOnChainVerifiedC} (Expected: true)`);

  // Invalid proof check
  const fakeProof = [leafC, parentAB];
  const isFakeVerified = await vpContract.verifyBatchInclusion(testBatchId, leafA, fakeProof);
  console.log(`  verifyBatchInclusion with invalid proof -> ${isFakeVerified} (Expected: false)`);

  // Duplicate batch anchoring rejection
  try {
    await vpContract.anchorBatch(testBatchId, merkleRoot, 4, metaHash);
    console.log('  ❌ FAILED: Duplicate batch anchoring should have reverted!');
  } catch (err: any) {
    console.log(`  ✅ Duplicate batch anchor correctly reverted: "${err.reason || err.message}"`);
  }

  console.log('\n--- 5. PRIVACY VERIFIER (PHASE 9) LIVE VERIFICATION ---');
  const credId = ethers.keccak256(ethers.toUtf8Bytes('CREDENTIAL-LIVE-QA-001'));
  const credRoot = ethers.keccak256(ethers.toUtf8Bytes('CRED-ROOT-COMMITMENT-999'));
  const validUntil = Math.floor(Date.now() / 1000) + 86400 * 365; // +1 year

  console.log(`  Registering privacy credential commitment...`);
  const credTx = await pvContract.registerCredential(credId, credRoot, validUntil);
  const credReceipt = await credTx.wait();
  console.log(`  ✅ Credential Registered! Tx Hash: ${credReceipt.hash}, Block Number: ${credReceipt.blockNumber}`);

  const credStatus = await pvContract.checkCredentialStatus(credId);
  console.log(`  Credential Status: isValid=${credStatus.isValid}, status=${credStatus.status}, root=${credStatus.rootCommitment}`);

  // Test ZKP Receipt Recording
  const sessionId = ethers.keccak256(ethers.toUtf8Bytes('SESSION-ZKP-QA-001'));
  const vehCommitment = ethers.keccak256(ethers.toUtf8Bytes('VEH-COMMITMENT-NEXON'));
  const claimTypeHash = ethers.keccak256(ethers.toUtf8Bytes('CLAIM_BATTERY_SOH_GT_80'));
  const pedersen = ethers.keccak256(ethers.toUtf8Bytes('PEDERSEN-COMMIT'));
  const nonce = ethers.keccak256(ethers.toUtf8Bytes('NONCE-12345'));

  const receiptTx = await pvContract.recordZkpReceipt(
    sessionId,
    vehCommitment,
    claimTypeHash,
    80,
    pedersen,
    nonce,
    true
  );
  const zkpReceiptRec = await receiptTx.wait();
  console.log(`  ✅ ZKP Receipt Recorded! Tx Hash: ${zkpReceiptRec.hash}, Block Number: ${zkpReceiptRec.blockNumber}`);

  const zkpOnChain = await pvContract.getZkpReceipt(sessionId);
  console.log(`  ZKP Receipt on-chain: isVerified=${zkpOnChain.isVerified}, verifier=${zkpOnChain.verifier}, threshold=${zkpOnChain.threshold.toString()}`);
}

main().catch((err) => {
  console.error('Deep verification failed:', err);
  process.exit(1);
});
