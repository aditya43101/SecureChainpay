import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('================================================================');
  console.log('🔍 INDEPENDENT BLOCKCHAIN VERIFICATION: VEHICLE PASSPORT LEDGER');
  console.log('================================================================');

  const network = await ethers.provider.getNetwork();
  console.log(`🌐 Verified Chain ID: ${network.chainId} (Expected: 31337)`);

  const contractConfigFile = path.join(__dirname, '../../backend/src/blockchain/contracts/VehiclePassport.json');
  const deployedData = JSON.parse(fs.readFileSync(contractConfigFile, 'utf8'));
  const contractAddress = deployedData.address;
  console.log(`📍 Verified Contract Address: ${contractAddress}`);

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const aaravWallet = signers[1];
  const priyaWallet = signers[2];
  const rohanWallet = signers[4];
  const nehaWallet = signers[5];

  const VehiclePassportFactory = await ethers.getContractFactory('VehiclePassport', deployer);
  const contract = VehiclePassportFactory.attach(contractAddress) as any;

  let allPassed = true;
  function verify(assertion: boolean, description: string) {
    if (assertion) {
      console.log(`✅ [PASS] ${description}`);
    } else {
      console.error(`❌ [FAIL] ${description}`);
      allPassed = false;
    }
  }

  // 1. Verify Users On-Chain
  console.log('\n--- 1. Verified User Registry ---');
  const aaravOnChain = await contract.getUserById('USR-DEMO-001');
  verify(aaravOnChain.active && aaravOnChain.walletAddress.toLowerCase() === aaravWallet.address.toLowerCase(), 'Aarav Sharma (USR-DEMO-001) registered and active on-chain');

  const priyaOnChain = await contract.getUserById('USR-DEMO-002');
  verify(priyaOnChain.active && priyaOnChain.walletAddress.toLowerCase() === priyaWallet.address.toLowerCase(), 'Priya Verma (USR-DEMO-002) registered and active on-chain');

  const rohanOnChain = await contract.getUserById('USR-DEMO-003');
  verify(rohanOnChain.active && rohanOnChain.walletAddress.toLowerCase() === rohanWallet.address.toLowerCase(), 'Rohan Mehta (USR-DEMO-003) registered and active on-chain');

  const nehaOnChain = await contract.getUserById('USR-DEMO-004');
  verify(nehaOnChain.active && nehaOnChain.walletAddress.toLowerCase() === nehaWallet.address.toLowerCase(), 'Neha Kapoor (USR-DEMO-004) registered and active on-chain');

  // Verify Kabir Malhotra (State B) is NOT on-chain yet
  let kabirIsUnregistered = false;
  try {
    const kabirOnChain = await contract.getUserById('USR-DEMO-005');
    kabirIsUnregistered = !kabirOnChain.active;
  } catch {
    kabirIsUnregistered = true;
  }
  verify(kabirIsUnregistered, 'State B: Kabir Malhotra (DEMO-U005) is uninitialized on-chain (as required)');

  // 2. Verify 8 Vehicles On-Chain
  console.log('\n--- 2. Verified Vehicle Registry ---');
  const vehicles = [
    { id: 'VEH-DEMO-001', pass: 'VP-DEMO-001', expectedOwner: aaravWallet.address, name: 'Aurora X1' },
    { id: 'VEH-DEMO-002', pass: 'VP-DEMO-002', expectedOwner: aaravWallet.address, name: 'Falcon E2' },
    { id: 'VEH-DEMO-003', pass: 'VP-DEMO-003', expectedOwner: priyaWallet.address, name: 'Summit R5' },
    { id: 'VEH-DEMO-004', pass: 'VP-DEMO-004', expectedOwner: rohanWallet.address, name: 'Metro C3' },
    { id: 'VEH-DEMO-005', pass: 'VP-DEMO-005', expectedOwner: nehaWallet.address, name: 'Terra H7' },
    { id: 'VEH-DEMO-006', pass: 'VP-DEMO-006', expectedOwner: aaravWallet.address, name: 'Nova S4' },
    { id: 'VEH-DEMO-007', pass: 'VP-DEMO-007', expectedOwner: priyaWallet.address, name: 'Volt E5' },
    { id: 'VEH-DEMO-008', pass: 'VP-DEMO-008', expectedOwner: aaravWallet.address, name: 'Orbit M2 (Transferred)' },
  ];

  for (const v of vehicles) {
    const onChainV = await contract.getVehicleById(v.id);
    const ownerMatches = onChainV.ownerAddress.toLowerCase() === v.expectedOwner.toLowerCase();
    verify(onChainV.active && ownerMatches, `${v.name} (${v.id} / ${v.pass}) active with verified owner ${v.expectedOwner}`);
  }

  // 3. Verify Multiple Vehicles Per Owner
  console.log('\n--- 3. Multiple Vehicles Per Owner Verification ---');
  const aaravVehicles = await contract.getVehiclesByOwner(aaravWallet.address);
  verify(aaravVehicles.length >= 3, `Aarav Sharma owns multiple vehicles on-chain (Current: ${aaravVehicles.length} vehicles)`);

  const priyaVehicles = await contract.getVehiclesByOwner(priyaWallet.address);
  verify(priyaVehicles.length >= 2, `Priya Verma owns multiple vehicles on-chain (Current: ${priyaVehicles.length} vehicles)`);

  // 4. Verify Ownership Transfer & Event Logs
  console.log('\n--- 4. Ownership Transfer Events & Provenance Audit ---');
  const transferFilter = contract.filters.VehicleOwnershipTransferred('VEH-DEMO-008');
  const transferEvents = await contract.queryFilter(transferFilter);
  verify(transferEvents.length === 2, `DEMO-V008 has exactly 2 confirmed on-chain ownership transfer events`);

  if (transferEvents.length === 2) {
    const [ev1, ev2] = transferEvents;
    const args1: any = ev1.args;
    const args2: any = ev2.args;

    verify(
      args1[1].toLowerCase() === rohanWallet.address.toLowerCase() &&
      args1[2].toLowerCase() === priyaWallet.address.toLowerCase(),
      `Transfer 1 verified: Rohan (${args1[1]}) -> Priya (${args1[2]}) at Block ${ev1.blockNumber}`
    );

    verify(
      args2[1].toLowerCase() === priyaWallet.address.toLowerCase() &&
      args2[2].toLowerCase() === aaravWallet.address.toLowerCase(),
      `Transfer 2 verified: Priya (${args2[1]}) -> Aarav (${args2[2]}) at Block ${ev2.blockNumber}`
    );
  }

  // 5. Adversarial Testing: Duplicate Registration & Unauthorized Transfer Rejection
  console.log('\n--- 5. Adversarial Security Verification ---');
  try {
    const dummyHash = ethers.keccak256(ethers.toUtf8Bytes('duplicate'));
    await contract.registerVehicle('VEH-DEMO-001', dummyHash, 'VP-DEMO-DUP', aaravWallet.address);
    verify(false, 'Duplicate vehicle registration should have reverted');
  } catch (err: any) {
    verify(err.message.includes('Vehicle already registered'), 'Duplicate vehicle ID safely rejected by smart contract');
  }

  try {
    const dummyHash = ethers.keccak256(ethers.toUtf8Bytes('duplicate-passport'));
    await contract.registerVehicle('VEH-DEMO-NEW', dummyHash, 'VP-DEMO-001', aaravWallet.address);
    verify(false, 'Duplicate passport ID should have reverted');
  } catch (err: any) {
    verify(err.message.includes('Passport ID already registered'), 'Duplicate passport ID safely rejected by smart contract');
  }

  try {
    const unauthContract = contract.connect(aaravWallet);
    const deedHash = ethers.keccak256(ethers.toUtf8Bytes('unauth-transfer'));
    await unauthContract.transferVehicleOwnership('VEH-DEMO-001', priyaWallet.address, deedHash, 'REC-UNAUTH-001');
    verify(false, 'Unauthorized non-owner relayer call should have reverted');
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.log(`   (Revert detected: ${msg.slice(0, 100)}...)`);
    const isAccessDenied = msg.includes('OwnableUnauthorizedAccount') || msg.includes('caller is not the owner') || msg.includes('reverted');
    verify(isAccessDenied, 'Unauthorized ownership transfer safely rejected by AccessControl');
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('🎉 ALL ON-CHAIN VERIFICATIONS PASSED (100% LEDGER INTEGRITY)');
  } else {
    console.error('⚠️ SOME ON-CHAIN VERIFICATIONS FAILED');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification error:', err);
    process.exit(1);
  });
