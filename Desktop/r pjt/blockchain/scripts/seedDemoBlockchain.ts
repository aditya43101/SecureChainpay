import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

function generateVehicleRecordHash(v: {
  passportId: string;
  vin: string;
  registrationNumber: string;
  manufacturer: string;
  model: string;
  manufacturingYear: number | string;
  fuelType: string;
}): string {
  const passportId = v.passportId.trim().toUpperCase();
  const vin = v.vin.trim().toUpperCase();
  const registrationNumber = v.registrationNumber.trim().toUpperCase().replace(/[\s-]/g, '');
  const manufacturer = v.manufacturer.trim();
  const model = v.model.trim();
  const manufacturingYear = String(v.manufacturingYear);
  const fuelType = v.fuelType.trim().toUpperCase();
  const canonical = `${passportId}|${vin}|${registrationNumber}|${manufacturer}|${model}|${manufacturingYear}|${fuelType}`;
  return '0x' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function generateServiceRecordHash(input: {
  blockchainVehicleId: string;
  garageBlockchainId: string;
  serviceDate: string;
  mileage: number;
  serviceType: string;
  description: string;
  partsReplaced?: string | null;
  cost?: number | null;
}): string {
  const dateStr = input.serviceDate;
  const parts = (input.partsReplaced || 'NONE').trim();
  const cost = input.cost !== null && input.cost !== undefined ? input.cost.toFixed(2) : '0.00';
  const canonical = `${input.blockchainVehicleId.trim()}|${input.garageBlockchainId.trim()}|${dateStr}|${input.mileage}|${input.serviceType.trim().toUpperCase()}|${input.description.trim()}|${parts}|${cost}`;
  return '0x' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function generateOdometerRecordHash(input: {
  blockchainVehicleId: string;
  mileage: number;
  recordedAt: string;
  sourceType: string;
}): string {
  const dateStr = input.recordedAt;
  const canonical = `${input.blockchainVehicleId.trim()}|${input.mileage}|${dateStr}|${input.sourceType.trim().toUpperCase()}`;
  return '0x' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function generateOwnershipRecordHash(input: {
  blockchainVehicleId: string;
  previousOwnerBlockchainId: string;
  newOwnerBlockchainId: string;
  transferType: string;
  transferDate: string;
}): string {
  const dateStr = input.transferDate;
  const canonical = `${input.blockchainVehicleId.trim()}|${input.previousOwnerBlockchainId.trim()}|${input.newOwnerBlockchainId.trim()}|${input.transferType.trim().toUpperCase()}|${dateStr}`;
  return '0x' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

async function main() {
  console.log('================================================================');
  console.log('🚗 BLOCKCHAIN VEHICLE PASSPORT — SEED DEMO BLOCKCHAIN DATA 🚗');
  console.log('================================================================');

  // 1. Verify Network Safety
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Connected Network Chain ID: ${network.chainId}`);
  if (network.chainId !== 31337n && network.chainId !== 1337n) {
    throw new Error(`SAFETY ERROR: Expected local test network (31337), got chain ID ${network.chainId}. Aborting to protect external network.`);
  }

  // 2. Identify Accounts
  const signers = await ethers.getSigners();
  const deployer = signers[0]; // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Contract Owner & Relayer)
  const aaravWallet = signers[1]; // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (DEMO-U001)
  const priyaWallet = signers[2]; // 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (DEMO-U002)
  const garageWallet = signers[3]; // 0x90F79bf6EB2c4f870365E785982E1f101E93b906 (Certified Garage)
  const rohanWallet = signers[4]; // 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 (DEMO-U003)
  const nehaWallet = signers[5];  // 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc (DEMO-U004)

  console.log(`👤 Deployer (Contract Owner): ${deployer.address}`);
  console.log(`👤 Aarav Sharma Wallet:       ${aaravWallet.address}`);
  console.log(`👤 Priya Verma Wallet:        ${priyaWallet.address}`);
  console.log(`👤 Rohan Mehta Wallet:        ${rohanWallet.address}`);
  console.log(`👤 Neha Kapoor Wallet:        ${nehaWallet.address}`);

  // 3. Load Deployed Contract
  const artifactPath = path.join(__dirname, '../artifacts/contracts/VehiclePassport.sol/VehiclePassport.json');
  const contractConfigFile = path.join(__dirname, '../../backend/src/blockchain/contracts/VehiclePassport.json');
  
  let contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  if (fs.existsSync(contractConfigFile)) {
    const deployedData = JSON.parse(fs.readFileSync(contractConfigFile, 'utf8'));
    contractAddress = deployedData.address || contractAddress;
  }

  const code = await ethers.provider.getCode(contractAddress);
  if (!code || code === '0x' || code === '0x0') {
    throw new Error(`Contract not found at ${contractAddress}. Please deploy the contract first via scripts/deploy.ts.`);
  }

  const VehiclePassportFactory = await ethers.getContractFactory('VehiclePassport', deployer);
  const contract = VehiclePassportFactory.attach(contractAddress) as any;
  console.log(`📄 VehiclePassport attached at: ${contractAddress}`);

  const manifest = {
    network: 'localhost',
    chainId: Number(network.chainId),
    contractAddress,
    deployer: deployer.address,
    seededAt: new Date().toISOString(),
    users: [] as any[],
    vehicles: [] as any[],
    transfers: [] as any[],
    lifecycleRecords: [] as any[],
  };

  // ------------------------------------------------------------------
  // 4. Register Test Users On-Chain
  // ------------------------------------------------------------------
  console.log('\n--- 1. Registering Test Personas On-Chain ---');
  const demoUsers = [
    {
      userId: 'USR-DEMO-001',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@vehiclepassport.dev',
      firebaseUid: 'seed-demo-aarav-001',
      wallet: aaravWallet.address,
      role: 'VEHICLE_OWNER',
    },
    {
      userId: 'USR-DEMO-002',
      name: 'Priya Verma',
      email: 'priya.verma@vehiclepassport.dev',
      firebaseUid: 'seed-demo-priya-002',
      wallet: priyaWallet.address,
      role: 'VEHICLE_OWNER',
    },
    {
      userId: 'USR-DEMO-003',
      name: 'Rohan Mehta',
      email: 'rohan.mehta@vehiclepassport.dev',
      firebaseUid: 'seed-demo-rohan-003',
      wallet: rohanWallet.address,
      role: 'VEHICLE_OWNER',
    },
    {
      userId: 'USR-DEMO-004',
      name: 'Neha Kapoor',
      email: 'neha.kapoor@vehiclepassport.dev',
      firebaseUid: 'seed-demo-neha-004',
      wallet: nehaWallet.address,
      role: 'VEHICLE_OWNER',
    },
    {
      userId: 'USR-DEMO-GARAGE',
      name: 'Apex Certified Garage',
      email: 'garage@vehiclepassport.dev',
      firebaseUid: 'seed-demo-garage-001',
      wallet: garageWallet.address,
      role: 'GARAGE',
    },
  ];

  for (const u of demoUsers) {
    const userRefHash = ethers.keccak256(ethers.toUtf8Bytes(u.firebaseUid));
    
    // Check existence
    try {
      const existing = await contract.getUserById(u.userId);
      if (existing.active) {
        console.log(`ℹ️ User ${u.userId} (${u.name}) already registered on-chain.`);
        manifest.users.push({
          userId: u.userId,
          name: u.name,
          email: u.email,
          wallet: u.wallet,
          userRefHash,
          status: 'ALREADY_EXISTS',
        });
        continue;
      }
    } catch {
      // Not registered, proceed
    }

    const tx = await contract.initializeUser(u.userId, userRefHash, u.wallet, u.role);
    const receipt = await tx.wait();
    console.log(`✅ [Tx Confirmed] Registered User: ${u.name} (${u.userId})`);
    console.log(`   Tx Hash: ${receipt.hash} | Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed}`);
    
    manifest.users.push({
      userId: u.userId,
      name: u.name,
      email: u.email,
      wallet: u.wallet,
      userRefHash,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: 'CONFIRMED',
    });
  }

  // ------------------------------------------------------------------
  // 5. Register 8 Fictional Vehicles On-Chain
  // ------------------------------------------------------------------
  console.log('\n--- 2. Registering 8 Fictional Vehicles On-Chain ---');
  const demoVehicles = [
    {
      vehicleId: 'VEH-DEMO-001',
      passportId: 'VP-DEMO-001',
      vin: 'DEMOV001X1SEDAN01',
      reg: 'MH02DM1001',
      registrationNumber: 'MH02DM1001',
      manufacturer: 'Aurora Motors',
      model: 'Aurora X1 Sedan',
      manufacturingYear: 2024,
      fuelType: 'PETROL',
      ownerWallet: aaravWallet.address,
      ownerName: 'Aarav Sharma',
    },
    {
      vehicleId: 'VEH-DEMO-002',
      passportId: 'VP-DEMO-002',
      vin: 'DEMOV002E2ELEC002',
      reg: 'MH02DM1002',
      registrationNumber: 'MH02DM1002',
      manufacturer: 'Falcon Dynamics',
      model: 'Falcon E2 Electric Car',
      manufacturingYear: 2024,
      fuelType: 'ELECTRIC',
      ownerWallet: aaravWallet.address,
      ownerName: 'Aarav Sharma',
    },
    {
      vehicleId: 'VEH-DEMO-003',
      passportId: 'VP-DEMO-003',
      vin: 'DEMOV003R5SUVD003',
      reg: 'MH02DM1003',
      registrationNumber: 'MH02DM1003',
      manufacturer: 'Summit Auto',
      model: 'Summit R5 SUV',
      manufacturingYear: 2023,
      fuelType: 'DIESEL',
      ownerWallet: priyaWallet.address,
      ownerName: 'Priya Verma',
    },
    {
      vehicleId: 'VEH-DEMO-004',
      passportId: 'VP-DEMO-004',
      vin: 'DEMOV004C3HATCH04',
      reg: 'MH02DM1004',
      registrationNumber: 'MH02DM1004',
      manufacturer: 'Metro City Car',
      model: 'Metro C3 Hatchback',
      manufacturingYear: 2022,
      fuelType: 'HYBRID',
      ownerWallet: rohanWallet.address,
      ownerName: 'Rohan Mehta',
    },
    {
      vehicleId: 'VEH-DEMO-005',
      passportId: 'VP-DEMO-005',
      vin: 'DEMOV005H7HYBRD05',
      reg: 'MH02DM1005',
      registrationNumber: 'MH02DM1005',
      manufacturer: 'Terra Automotive',
      model: 'Terra H7 Hybrid SUV',
      manufacturingYear: 2024,
      fuelType: 'HYBRID',
      ownerWallet: nehaWallet.address,
      ownerName: 'Neha Kapoor',
    },
    {
      vehicleId: 'VEH-DEMO-006',
      passportId: 'VP-DEMO-006',
      vin: 'DEMOV006S4SEDAN06',
      reg: 'MH02DM1006',
      registrationNumber: 'MH02DM1006',
      manufacturer: 'Nova Engineering',
      model: 'Nova S4 Sedan',
      manufacturingYear: 2023,
      fuelType: 'PETROL',
      ownerWallet: aaravWallet.address, // Aarav owns multiple vehicles!
      ownerName: 'Aarav Sharma',
    },
    {
      vehicleId: 'VEH-DEMO-007',
      passportId: 'VP-DEMO-007',
      vin: 'DEMOV007E5ELEC007',
      reg: 'MH02DM1007',
      registrationNumber: 'MH02DM1007',
      manufacturer: 'Volt Mobility',
      model: 'Volt E5 Electric Car',
      manufacturingYear: 2024,
      fuelType: 'ELECTRIC',
      ownerWallet: priyaWallet.address, // Priya owns multiple vehicles!
      ownerName: 'Priya Verma',
    },
    {
      vehicleId: 'VEH-DEMO-008',
      passportId: 'VP-DEMO-008',
      vin: 'DEMOV008M2COMP008',
      reg: 'MH02DM1008',
      registrationNumber: 'MH02DM1008',
      manufacturer: 'Orbit Motors',
      model: 'Orbit M2 Compact Car',
      manufacturingYear: 2022,
      fuelType: 'PETROL',
      ownerWallet: rohanWallet.address, // Initial owner: Rohan (will be transferred!)
      ownerName: 'Rohan Mehta (Initial)',
    },
  ];

  for (const v of demoVehicles) {
    const recordHash = generateVehicleRecordHash(v);

    try {
      const existing = await contract.getVehicleById(v.vehicleId);
      if (existing.active) {
        console.log(`ℹ️ Vehicle ${v.vehicleId} (${v.model}) already registered.`);
        manifest.vehicles.push({
          vehicleId: v.vehicleId,
          passportId: v.passportId,
          vin: v.vin,
          reg: v.reg,
          model: v.model,
          ownerWallet: existing.ownerAddress,
          status: 'ALREADY_EXISTS',
        });
        continue;
      }
    } catch {
      // Not registered, proceed
    }

    const tx = await contract.registerVehicle(v.vehicleId, recordHash, v.passportId, v.ownerWallet);
    const receipt = await tx.wait();
    console.log(`✅ [Tx Confirmed] Registered Vehicle: ${v.model} (${v.passportId}) -> Owner: ${v.ownerName}`);
    console.log(`   Tx Hash: ${receipt.hash} | Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed}`);

    manifest.vehicles.push({
      vehicleId: v.vehicleId,
      passportId: v.passportId,
      vin: v.vin,
      reg: v.reg,
      model: v.model,
      initialOwnerWallet: v.ownerWallet,
      recordHash,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: 'CONFIRMED',
    });
  }

  // ------------------------------------------------------------------
  // 6. Demonstrate Real Ownership Transfers (DEMO-V008)
  // ------------------------------------------------------------------
  console.log('\n--- 3. Executing Real On-Chain Sequential Transfers (DEMO-V008) ---');
  // Target: VEH-DEMO-008 (Orbit M2 Compact Car)
  // Transfer 1: Rohan Mehta -> Priya Verma
  // Transfer 2: Priya Verma -> Aarav Sharma

  const currentV8 = await contract.getVehicleById('VEH-DEMO-008');
  console.log(`📍 Current On-Chain Owner of DEMO-V008 before transfer: ${currentV8.ownerAddress}`);

  if (currentV8.ownerAddress.toLowerCase() === rohanWallet.address.toLowerCase()) {
    console.log(`🔄 Transfer 1: Rohan Mehta (${rohanWallet.address}) -> Priya Verma (${priyaWallet.address})`);
    const deedHash1 = generateOwnershipRecordHash({
      blockchainVehicleId: 'VEH-DEMO-008',
      previousOwnerBlockchainId: 'USR-DEMO-003',
      newOwnerBlockchainId: 'USR-DEMO-002',
      transferType: 'SALE',
      transferDate: '2025-06-15',
    });
    const tx1 = await contract.transferVehicleOwnership('VEH-DEMO-008', priyaWallet.address, deedHash1, 'REC-DEMO-TRF-001');
    const rcpt1 = await tx1.wait();
    console.log(`   ✅ Transfer 1 Confirmed! Tx: ${rcpt1.hash} | Block: ${rcpt1.blockNumber}`);

    manifest.transfers.push({
      step: 1,
      vehicleId: 'VEH-DEMO-008',
      from: rohanWallet.address,
      to: priyaWallet.address,
      recordId: 'REC-DEMO-TRF-001',
      deedHash: deedHash1,
      txHash: rcpt1.hash,
      blockNumber: rcpt1.blockNumber,
      gasUsed: rcpt1.gasUsed.toString(),
    });

    console.log(`🔄 Transfer 2: Priya Verma (${priyaWallet.address}) -> Aarav Sharma (${aaravWallet.address})`);
    const deedHash2 = generateOwnershipRecordHash({
      blockchainVehicleId: 'VEH-DEMO-008',
      previousOwnerBlockchainId: 'USR-DEMO-002',
      newOwnerBlockchainId: 'USR-DEMO-001',
      transferType: 'SALE',
      transferDate: '2026-02-20',
    });
    const tx2 = await contract.transferVehicleOwnership('VEH-DEMO-008', aaravWallet.address, deedHash2, 'REC-DEMO-TRF-002');
    const rcpt2 = await tx2.wait();
    console.log(`   ✅ Transfer 2 Confirmed! Tx: ${rcpt2.hash} | Block: ${rcpt2.blockNumber}`);

    manifest.transfers.push({
      step: 2,
      vehicleId: 'VEH-DEMO-008',
      from: priyaWallet.address,
      to: aaravWallet.address,
      recordId: 'REC-DEMO-TRF-002',
      deedHash: deedHash2,
      txHash: rcpt2.hash,
      blockNumber: rcpt2.blockNumber,
      gasUsed: rcpt2.gasUsed.toString(),
    });
  } else if (currentV8.ownerAddress.toLowerCase() === aaravWallet.address.toLowerCase()) {
    console.log(`ℹ️ DEMO-V008 has already completed sequential transfers to Aarav Sharma (${aaravWallet.address}).`);
  }

  // ------------------------------------------------------------------
  // 7. Anchor Lifecycle Service & Odometer Records
  // ------------------------------------------------------------------
  console.log('\n--- 4. Anchoring Cryptographic Lifecycle Records ---');
  const lifecycleEvents = [
    // DEMO-V001: Aurora X1
    {
      recordId: 'REC-DEMO-SRV-001',
      vehicleId: 'VEH-DEMO-001',
      garageBlockchainId: 'USR-DEMO-GARAGE',
      type: 'SERVICE',
      date: '2025-04-10',
      desc: 'Scheduled 10,000 km Service: Engine oil, air filter, and multipoint safety inspection',
      serviceType: 'Routine Scheduled Maintenance',
      parts: 'Synthetic 5W-30 Oil, Oil Filter, Air Filter Element',
      cost: 160,
      mileage: 10000,
    },
    {
      recordId: 'REC-DEMO-SRV-002',
      vehicleId: 'VEH-DEMO-001',
      garageBlockchainId: 'USR-DEMO-GARAGE',
      type: 'SERVICE',
      date: '2025-11-20',
      desc: 'Front brake disc pads inspection and brake fluid hydraulic flush',
      serviceType: 'Brake Safety System Service',
      parts: 'Ceramic Front Brake Pads, DOT-4 Brake Fluid',
      cost: 240,
      mileage: 22500,
    },
    {
      recordId: 'REC-DEMO-ODO-001',
      vehicleId: 'VEH-DEMO-001',
      type: 'ODOMETER',
      date: '2025-11-20',
      sourceType: 'GARAGE',
      desc: 'Odometer Certification at 22,500 km',
      mileage: 22500,
    },
    // DEMO-V002: Falcon E2 Electric
    {
      recordId: 'REC-DEMO-SRV-003',
      vehicleId: 'VEH-DEMO-002',
      garageBlockchainId: 'USR-DEMO-GARAGE',
      type: 'SERVICE',
      date: '2025-05-18',
      desc: 'High-voltage battery diagnostic (State of Health: 99.2%), cell voltage balancing',
      serviceType: 'EV High-Voltage Battery Diagnostic',
      parts: 'HEPA Cabin Filter',
      cost: 180,
      mileage: 15000,
    },
    {
      recordId: 'REC-DEMO-ODO-002',
      vehicleId: 'VEH-DEMO-002',
      type: 'ODOMETER',
      date: '2025-12-10',
      sourceType: 'GARAGE',
      desc: 'Odometer Certification at 30,000 km',
      mileage: 30000,
    },
  ];

  for (const ev of lifecycleEvents) {
    try {
      const existing = await contract.getRecord(ev.recordId);
      if (existing.recordId && existing.recordId.length > 0) {
        console.log(`ℹ️ Record ${ev.recordId} (${ev.type}) already anchored.`);
        continue;
      }
    } catch {
      // Proceed
    }

    let proofHash = '';
    if (ev.type === 'SERVICE') {
      proofHash = generateServiceRecordHash({
        blockchainVehicleId: ev.vehicleId,
        garageBlockchainId: ev.garageBlockchainId || 'USR-DEMO-GARAGE',
        serviceDate: ev.date,
        mileage: ev.mileage,
        serviceType: ev.serviceType || 'Routine Maintenance',
        description: ev.desc,
        partsReplaced: ev.parts || 'NONE',
        cost: ev.cost || 0,
      });
    } else if (ev.type === 'ODOMETER') {
      proofHash = generateOdometerRecordHash({
        blockchainVehicleId: ev.vehicleId,
        mileage: ev.mileage,
        recordedAt: ev.date,
        sourceType: ev.sourceType || 'GARAGE',
      });
    } else {
      proofHash = ethers.keccak256(ethers.toUtf8Bytes(`${ev.recordId}|${ev.vehicleId}|${ev.type}|${ev.mileage}|${ev.desc}`));
    }

    const tx = await contract.anchorRecord(ev.recordId, ev.vehicleId, ev.type, proofHash);
    const receipt = await tx.wait();
    console.log(`✅ [Tx Confirmed] Anchored ${ev.type} Record: ${ev.recordId} for ${ev.vehicleId}`);
    console.log(`   Tx Hash: ${receipt.hash} | Block: ${receipt.blockNumber}`);

    manifest.lifecycleRecords.push({
      recordId: ev.recordId,
      vehicleId: ev.vehicleId,
      type: ev.type,
      mileage: ev.mileage,
      description: ev.desc,
      proofHash,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });
  }

  // ------------------------------------------------------------------
  // 8. Query and Independently Verify Final State
  // ------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('🔍 INDEPENDENT SMART CONTRACT STATE VERIFICATION');
  console.log('================================================================');

  const finalAaravVehicles = await contract.getVehiclesByOwner(aaravWallet.address);
  const finalPriyaVehicles = await contract.getVehiclesByOwner(priyaWallet.address);
  const finalRohanVehicles = await contract.getVehiclesByOwner(rohanWallet.address);
  const finalNehaVehicles = await contract.getVehiclesByOwner(nehaWallet.address);

  console.log(`\n👑 Aarav Sharma (${aaravWallet.address}):`);
  console.log(`   Total Vehicles Owned: ${finalAaravVehicles.length}`);
  finalAaravVehicles.forEach((vId: string) => console.log(`   • ${vId}`));

  console.log(`\n👑 Priya Verma (${priyaWallet.address}):`);
  console.log(`   Total Vehicles Owned: ${finalPriyaVehicles.length}`);
  finalPriyaVehicles.forEach((vId: string) => console.log(`   • ${vId}`));

  console.log(`\n👑 Rohan Mehta (${rohanWallet.address}):`);
  console.log(`   Total Vehicles Owned: ${finalRohanVehicles.length}`);
  finalRohanVehicles.forEach((vId: string) => console.log(`   • ${vId}`));

  console.log(`\n👑 Neha Kapoor (${nehaWallet.address}):`);
  console.log(`   Total Vehicles Owned: ${finalNehaVehicles.length}`);
  finalNehaVehicles.forEach((vId: string) => console.log(`   • ${vId}`));

  const v8 = await contract.getVehicleById('VEH-DEMO-008');
  console.log(`\n🚗 DEMO-V008 Final Owner Check:`);
  console.log(`   Vehicle ID:     ${v8.blockchainVehicleId}`);
  console.log(`   Passport ID:    ${v8.passportId}`);
  console.log(`   Current Owner:  ${v8.ownerAddress}`);
  console.log(`   Matches Aarav:  ${v8.ownerAddress.toLowerCase() === aaravWallet.address.toLowerCase()}`);

  const v8Records = await contract.getVehicleRecords('VEH-DEMO-008');
  console.log(`   Anchored Historical Records on DEMO-V008: ${v8Records.length}`);
  v8Records.forEach((r: any) => console.log(`   • [${r.recordType}] Record: ${r.recordId} (Hash: ${r.recordHash})`));

  // Save manifest to disk
  const manifestPath = path.join(__dirname, '../../docs/demo_blockchain_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n📦 Seed Manifest exported to: ${manifestPath}`);
  console.log('🎉 REAL BLOCKCHAIN SEEDING COMPLETE WITH LIVE ON-CHAIN TRANSACTIONS!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ SEEDING FAILED:', err);
    process.exit(1);
  });

