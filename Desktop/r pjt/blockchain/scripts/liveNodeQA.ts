import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('================================================================');
  console.log('🔍 BLOCKCHAIN & SMART CONTRACT LIVE NODE QA VERIFICATION');
  console.log('================================================================');

  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();
  console.log(`📡 Connected to RPC: http://127.0.0.1:8545`);
  console.log(`🔗 Network Chain ID: ${network.chainId.toString()} (Expected: 31337)`);
  console.log(`📦 Current Block Number: ${blockNumber}`);

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log(`👤 Deployer Account #0: ${deployer.address}`);
  const deployerBalance = await provider.getBalance(deployer.address);
  console.log(`💰 Deployer Balance: ${ethers.formatEther(deployerBalance)} ETH`);

  // 1. VehiclePassport contract verification
  const vpArtifactPath = path.join(__dirname, '../../backend/src/blockchain/contracts/VehiclePassport.json');
  const vpArtifact = JSON.parse(fs.readFileSync(vpArtifactPath, 'utf8'));
  const vpAddress = vpArtifact.address;
  const vpCode = await provider.getCode(vpAddress);
  console.log(`\n📋 VehiclePassport Contract at: ${vpAddress}`);
  console.log(`   Bytecode length: ${vpCode.length} bytes (Deployed: ${vpCode !== '0x'})`);

  const vpFactory = await ethers.getContractFactory('VehiclePassport');
  const vpContract = vpFactory.attach(vpAddress) as any;

  const vpOwner = await vpContract.owner();
  console.log(`   Contract Owner: ${vpOwner} (Matches deployer: ${vpOwner.toLowerCase() === deployer.address.toLowerCase()})`);

  // 2. PrivacyVerifier contract verification
  const pvArtifactPath = path.join(__dirname, '../../backend/src/blockchain/contracts/PrivacyVerifier.json');
  const pvArtifact = JSON.parse(fs.readFileSync(pvArtifactPath, 'utf8'));
  const pvAddress = pvArtifact.address;
  const pvCode = await provider.getCode(pvAddress);
  console.log(`\n📋 PrivacyVerifier Contract at: ${pvAddress}`);
  console.log(`   Bytecode length: ${pvCode.length} bytes (Deployed: ${pvCode !== '0x'})`);

  const pvFactory = await ethers.getContractFactory('PrivacyVerifier');
  const pvContract = pvFactory.attach(pvAddress) as any;
  const pvAdmin = await pvContract.admin();
  console.log(`   PrivacyVerifier Admin: ${pvAdmin} (Matches deployer: ${pvAdmin.toLowerCase() === deployer.address.toLowerCase()})`);

  // 3. User Registry on Live Node
  console.log('\n----------------------------------------------------------------');
  console.log('👥 ON-CHAIN USER REGISTRY STATE');
  console.log('----------------------------------------------------------------');
  const userCount = await vpContract.getUserCount();
  console.log(`Total Initialized Users: ${userCount.toString()}`);

  const userIds: string[] = [];
  for (let i = 0; i < Number(userCount); i++) {
    const uid = await vpContract.allUserIds(i);
    userIds.push(uid);
    const u = await vpContract.getUserById(uid);
    console.log(`  [${i}] ${uid}:`);
    console.log(`      Wallet: ${u.walletAddress}`);
    console.log(`      Role: ${u.role}`);
    console.log(`      Reference Hash: ${u.userReferenceHash}`);
    console.log(`      Created At: ${new Date(Number(u.createdAt) * 1000).toISOString()} (Block timestamp: ${u.createdAt})`);
    console.log(`      Active: ${u.active}`);

    // Verify reverse lookup by reference hash
    const lookedUp = await vpContract.getUserByReferenceHash(u.userReferenceHash);
    if (lookedUp.blockchainUserId !== uid) {
      console.error(`      ❌ Reverse lookup mismatch for ${uid}`);
    }
  }

  // 4. Vehicle Registry on Live Node
  console.log('\n----------------------------------------------------------------');
  console.log('🚗 ON-CHAIN VEHICLE REGISTRY STATE');
  console.log('----------------------------------------------------------------');
  const vehicleCount = await vpContract.getVehicleCount();
  console.log(`Total Registered Vehicles: ${vehicleCount.toString()}`);

  const vehicleIds: string[] = [];
  for (let i = 0; i < Number(vehicleCount); i++) {
    const vid = await vpContract.allVehicleIds(i);
    vehicleIds.push(vid);
    const v = await vpContract.getVehicleById(vid);
    console.log(`  [${i}] ${vid}:`);
    console.log(`      Passport ID: ${v.passportId}`);
    console.log(`      Owner Address: ${v.ownerAddress}`);
    console.log(`      Record Hash: ${v.vehicleRecordHash}`);
    console.log(`      Created At: ${new Date(Number(v.createdAt) * 1000).toISOString()} (Block timestamp: ${v.createdAt})`);
    console.log(`      Active: ${v.active}`);

    // Lookup by passport ID
    const byPassport = await vpContract.getVehicleByPassportId(v.passportId);
    if (byPassport.blockchainVehicleId !== vid) {
      console.error(`      ❌ Passport lookup mismatch for ${vid}`);
    }

    // Owner vehicles
    const ownerVehs = await vpContract.getVehiclesByOwner(v.ownerAddress);
    console.log(`      Owner's vehicles list count: ${ownerVehs.length} (Contains ${vid}: ${ownerVehs.includes(vid)})`);

    // Records for this vehicle
    const vehicleRecords = await vpContract.getVehicleRecords(vid);
    console.log(`      Anchored records count for ${vid}: ${vehicleRecords.length}`);
    for (const recId of vehicleRecords) {
      const rec = await vpContract.getRecord(recId);
      console.log(`         • ${recId} [${rec.recordType}]: hash=${rec.recordHash} actor=${rec.actorAddress} timestamp=${new Date(Number(rec.timestamp) * 1000).toISOString()}`);
    }
  }

  // 5. Lifecycle Records
  console.log('\n----------------------------------------------------------------');
  console.log('📜 ALL ON-CHAIN LIFECYCLE RECORDS');
  console.log('----------------------------------------------------------------');
  let recordIndex = 0;
  while (true) {
    try {
      const rId = await vpContract.allRecordIds(recordIndex);
      const r = await vpContract.getRecord(rId);
      console.log(`  [${recordIndex}] ${rId} -> Vehicle: ${r.blockchainVehicleId}, Type: ${r.recordType}, Hash: ${r.recordHash}`);
      recordIndex++;
    } catch {
      break;
    }
  }
  console.log(`Total Anchored Records on-chain: ${recordIndex}`);

  // 6. Merkle Batches (Phase 6)
  console.log('\n----------------------------------------------------------------');
  console.log('🌲 ON-CHAIN MERKLE BATCH REGISTRY (PHASE 6)');
  console.log('----------------------------------------------------------------');
  const batchCount = await vpContract.getBatchCount();
  console.log(`Total Anchored Batches: ${batchCount.toString()}`);
  const allBatchIds = await vpContract.getAllBatchIds();
  for (let i = 0; i < allBatchIds.length; i++) {
    const bId = allBatchIds[i];
    const b = await vpContract.getBatch(bId);
    console.log(`  [${i}] Batch ID: ${bId}`);
    console.log(`      Merkle Root: ${b.merkleRoot}`);
    console.log(`      Leaf Count: ${b.leafCount.toString()}`);
    console.log(`      Metadata Hash: ${b.metadataHash}`);
    console.log(`      Actor Address: ${b.actorAddress}`);
    console.log(`      Block Number: ${b.blockNumber.toString()}`);
    console.log(`      Timestamp: ${new Date(Number(b.timestamp) * 1000).toISOString()}`);
    console.log(`      Active: ${b.active}`);
  }

  // 7. PrivacyVerifier State
  console.log('\n----------------------------------------------------------------');
  console.log('🔐 PRIVACY VERIFIER (PHASE 9) STATE');
  console.log('----------------------------------------------------------------');
  const credCount = await pvContract.getCredentialCount();
  console.log(`Total Privacy Credentials: ${credCount.toString()}`);
  for (let i = 0; i < Number(credCount); i++) {
    const cId = await pvContract.allCredentialIds(i);
    const status = await pvContract.checkCredentialStatus(cId);
    console.log(`  [${i}] Credential ${cId}: status=${status.status}, root=${status.rootCommitment}`);
  }
  const receiptCount = await pvContract.allReceiptSessionIds.length ? await pvContract.allReceiptSessionIds.length : 0;
  console.log(`Querying receipt session IDs...`);

  // 8. Event Log inspection from block 0 to current
  console.log('\n----------------------------------------------------------------');
  console.log('📢 HISTORICAL EVENT EMISSIONS (BLOCK 0 TO CURRENT)');
  console.log('----------------------------------------------------------------');
  const userInitFilter = vpContract.filters.UserInitialized();
  const userInitEvents = await vpContract.queryFilter(userInitFilter, 0, blockNumber);
  console.log(`UserInitialized events emitted: ${userInitEvents.length}`);
  for (const ev of userInitEvents) {
    const parsed = ev as any;
    console.log(`  • Block ${ev.blockNumber} (tx: ${ev.transactionHash}): userId=${parsed.args[0]}, userRefHash=${parsed.args[1]}, wallet=${parsed.args[2]}, role=${parsed.args[3]}`);
  }

  const vehRegFilter = vpContract.filters.VehicleRegistered();
  const vehRegEvents = await vpContract.queryFilter(vehRegFilter, 0, blockNumber);
  console.log(`VehicleRegistered events emitted: ${vehRegEvents.length}`);
  for (const ev of vehRegEvents) {
    const parsed = ev as any;
    console.log(`  • Block ${ev.blockNumber} (tx: ${ev.transactionHash}): vehicleId=${parsed.args[0]}, recordHash=${parsed.args[1]}, owner=${parsed.args[2]}, passportId=${parsed.args[3]}`);
  }

  const transFilter = vpContract.filters.VehicleOwnershipTransferred();
  const transEvents = await vpContract.queryFilter(transFilter, 0, blockNumber);
  console.log(`VehicleOwnershipTransferred events emitted: ${transEvents.length}`);
  for (const ev of transEvents) {
    const parsed = ev as any;
    console.log(`  • Block ${ev.blockNumber} (tx: ${ev.transactionHash}): vehicleId=${parsed.args[0]}, prev=${parsed.args[1]}, new=${parsed.args[2]}, hash=${parsed.args[3]}`);
  }

  const recFilter = vpContract.filters.RecordAnchored();
  const recEvents = await vpContract.queryFilter(recFilter, 0, blockNumber);
  console.log(`RecordAnchored events emitted: ${recEvents.length}`);
  for (const ev of recEvents) {
    const parsed = ev as any;
    console.log(`  • Block ${ev.blockNumber} (tx: ${ev.transactionHash}): recordId=${parsed.args[0]}, vehicleId=${parsed.args[1]}, type=${parsed.args[2]}, hash=${parsed.args[3]}`);
  }

  const batchFilter = vpContract.filters.BatchAnchored();
  const batchEvents = await vpContract.queryFilter(batchFilter, 0, blockNumber);
  console.log(`BatchAnchored events emitted: ${batchEvents.length}`);
  for (const ev of batchEvents) {
    const parsed = ev as any;
    console.log(`  • Block ${ev.blockNumber} (tx: ${ev.transactionHash}): batchId=${parsed.args[0]}, root=${parsed.args[1]}, leafCount=${parsed.args[2]}`);
  }
}

main().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
