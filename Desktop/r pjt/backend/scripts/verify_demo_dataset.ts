import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🔍 DEMO DATASET VERIFICATION: DATABASE & BLOCKCHAIN CONSISTENCY');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Connect to RPC
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const contractConfigFile = path.join(__dirname, '../src/blockchain/contracts/VehiclePassport.json');
  const deployedData = JSON.parse(fs.readFileSync(contractConfigFile, 'utf8'));
  const contract = new ethers.Contract(deployedData.address, deployedData.abi, provider);

  const blockNumber = await provider.getBlockNumber();
  assert(blockNumber >= 26, `Blockchain height is at least block 26 (Current: ${blockNumber})`);

  // 2. Verify Demo Users in Database
  console.log('\n--- 1. Database User Profile Verification ---');
  const aarav = await prisma.user.findUnique({ where: { email: 'aarav.sharma@vehiclepassport.dev' } });
  assert(aarav !== null && aarav.isInitialized === true, 'Aarav Sharma exists in DB and isInitialized = true');
  assert(aarav?.blockchainUserId === 'USR-DEMO-001', 'Aarav has correct blockchainUserId (USR-DEMO-001)');

  const priya = await prisma.user.findUnique({ where: { email: 'priya.verma@vehiclepassport.dev' } });
  assert(priya !== null && priya.isInitialized === true, 'Priya Verma exists in DB and isInitialized = true');
  assert(priya?.blockchainUserId === 'USR-DEMO-002', 'Priya has correct blockchainUserId (USR-DEMO-002)');

  const rohan = await prisma.user.findUnique({ where: { email: 'rohan.mehta@vehiclepassport.dev' } });
  assert(rohan !== null && rohan.isInitialized === true, 'Rohan Mehta exists in DB and isInitialized = true');

  const neha = await prisma.user.findUnique({ where: { email: 'neha.kapoor@vehiclepassport.dev' } });
  assert(neha !== null && neha.isInitialized === true, 'Neha Kapoor exists in DB and isInitialized = true');

  const kabir = await prisma.user.findUnique({ where: { email: 'kabir.malhotra@vehiclepassport.dev' } });
  assert(kabir !== null && kabir.isInitialized === false, 'State B: Kabir Malhotra exists in DB with isInitialized = false');
  assert(kabir?.blockchainUserId === null, 'State B: Kabir has blockchainUserId = null (uninitialized)');
  assert(kabir?.onboardingStatus === 'NOT_STARTED', 'State B: Kabir onboardingStatus = NOT_STARTED');

  // 3. Verify Vehicles & Ownership Mapping
  console.log('\n--- 2. Database Vehicle & Multi-Vehicle Ownership Verification ---');
  const aaravVehicles = await prisma.vehicle.findMany({ where: { currentOwnerId: aarav?.id } });
  assert(aaravVehicles.length === 4, `Aarav Sharma owns 4 vehicles in DB (Found: ${aaravVehicles.length})`);
  const aaravPassports = aaravVehicles.map(v => v.passportId).sort();
  assert(
    aaravPassports.includes('VP-DEMO-001') &&
    aaravPassports.includes('VP-DEMO-002') &&
    aaravPassports.includes('VP-DEMO-006') &&
    aaravPassports.includes('VP-DEMO-008'),
    'Aarav owns VP-DEMO-001, VP-DEMO-002, VP-DEMO-006, and VP-DEMO-008'
  );

  const priyaVehicles = await prisma.vehicle.findMany({ where: { currentOwnerId: priya?.id } });
  assert(priyaVehicles.length === 2, `Priya Verma owns 2 vehicles in DB (Found: ${priyaVehicles.length})`);

  const rohanVehicles = await prisma.vehicle.findMany({ where: { currentOwnerId: rohan?.id } });
  assert(rohanVehicles.length === 1 && rohanVehicles[0].passportId === 'VP-DEMO-004', 'Rohan Mehta owns VP-DEMO-004 (Metro C3)');

  const nehaVehicles = await prisma.vehicle.findMany({ where: { currentOwnerId: neha?.id } });
  assert(nehaVehicles.length === 1 && nehaVehicles[0].passportId === 'VP-DEMO-005', 'Neha Kapoor owns VP-DEMO-005 (Terra H7)');

  // 4. Verify Historical Ownership Transfers on DEMO-V008
  console.log('\n--- 3. Historical Ownership Provenance Verification ---');
  const v8 = await prisma.vehicle.findUnique({ where: { passportId: 'VP-DEMO-008' } });
  assert(v8 !== null, 'DEMO-V008 found in DB');
  assert(v8?.currentOwnerId === aarav?.id, 'DEMO-V008 current owner in DB is Aarav Sharma');

  const v8Histories = await prisma.ownershipHistory.findMany({
    where: { vehicleId: v8?.id },
    orderBy: { blockNumber: 'asc' },
  });
  assert(v8Histories.length === 2, `DEMO-V008 has exactly 2 historical transfer records (Found: ${v8Histories.length})`);
  if (v8Histories.length === 2) {
    assert(
      v8Histories[0].previousOwnerId === rohan?.id && v8Histories[0].newOwnerId === priya?.id,
      'Transfer 1 provenance: Rohan Mehta -> Priya Verma (Block 15)'
    );
    assert(
      v8Histories[1].previousOwnerId === priya?.id && v8Histories[1].newOwnerId === aarav?.id,
      'Transfer 2 provenance: Priya Verma -> Aarav Sharma (Block 16)'
    );
  }

  // 5. Verify Database vs Blockchain State Alignment
  console.log('\n--- 4. Database vs On-Chain Blockchain Agreement ---');
  for (const v of aaravVehicles) {
    const onChainV = await contract.getVehicleById(v.blockchainVehicleId);
    assert(
      onChainV.ownerAddress.toLowerCase() === aarav?.blockchainAddress?.toLowerCase(),
      `On-chain owner of ${v.passportId} matches database owner address (${aarav?.blockchainAddress})`
    );
  }

  for (const v of priyaVehicles) {
    const onChainV = await contract.getVehicleById(v.blockchainVehicleId);
    assert(
      onChainV.ownerAddress.toLowerCase() === priya?.blockchainAddress?.toLowerCase(),
      `On-chain owner of ${v.passportId} matches database owner address (${priya?.blockchainAddress})`
    );
  }

  // 6. Verify Service Records
  console.log('\n--- 5. Cryptographic Service Records Verification ---');
  const v1Services = await prisma.serviceRecord.findMany({
    where: { vehicle: { passportId: 'VP-DEMO-001' } },
  });
  assert(v1Services.length === 2, `VP-DEMO-001 has 2 service records anchored in DB (Found: ${v1Services.length})`);

  for (const s of v1Services) {
    if (s.blockchainRecordId) {
      const onChainRecord = await contract.getRecord(s.blockchainRecordId);
      assert(
        onChainRecord.recordId === s.blockchainRecordId && onChainRecord.recordType === 'SERVICE',
        `Service record ${s.blockchainRecordId} confirmed on smart contract (Type: ${onChainRecord.recordType}, Hash: ${onChainRecord.recordHash.slice(0, 10)}...)`
      );
    }
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED across all checks.`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
