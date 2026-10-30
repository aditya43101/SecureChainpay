import { PrismaClient, UserRole, OnboardingStatus, FuelType, VehicleStatus, BlockchainStatus, OwnershipTransferType, OdometerSourceType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateServiceRecordHash,
  generateOdometerRecordHash,
  generateOwnershipRecordHash,
} from '../src/blockchain/utils/canonicalHash';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🌱 SYNCHRONIZING REAL BLOCKCHAIN SEED DATA WITH POSTGRESQL');
  console.log('================================================================');

  // Load verified manifest from blockchain seed run
  const manifestPath = path.join(__dirname, '../../docs/demo_blockchain_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}. Run npx hardhat run scripts/seedDemoBlockchain.ts --network localhost first.`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`📡 Loaded manifest from Chain ID: ${manifest.chainId} | Contract: ${manifest.contractAddress}`);

  // 1. Synchronize Users
  console.log('\n--- 1. Synchronizing Demo Users ---');
  const userMap = new Map<string, string>(); // userId -> DB UUID

  const usersToSync = [
    {
      id: 'demo-user-aarav-001',
      firebaseUid: 'seed-demo-aarav-001',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: UserRole.VEHICLE_OWNER,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITH_VEHICLE,
      blockchainUserId: 'USR-DEMO-001',
      blockchainAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      blockchainTxHash: '0x7a35596aa439d77ad6d9a62e8246fa3743d401e60dd13567cc5771e5acf7ca26',
    },
    {
      id: 'demo-user-priya-002',
      firebaseUid: 'seed-demo-priya-002',
      name: 'Priya Verma',
      email: 'priya.verma@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: UserRole.VEHICLE_OWNER,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITH_VEHICLE,
      blockchainUserId: 'USR-DEMO-002',
      blockchainAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      blockchainTxHash: '0xe3fba6168a165596c893a46e53ce84a059b6c6c318ade0e8aa37817512a30668',
    },
    {
      id: 'demo-user-rohan-003',
      firebaseUid: 'seed-demo-rohan-003',
      name: 'Rohan Mehta',
      email: 'rohan.mehta@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      role: UserRole.VEHICLE_OWNER,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITH_VEHICLE,
      blockchainUserId: 'USR-DEMO-003',
      blockchainAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      blockchainTxHash: '0x5982bc869797cab20a31cc05034c2bfdd7e19b3d798ec19a27f22b01fae0e42f',
    },
    {
      id: 'demo-user-neha-004',
      firebaseUid: 'seed-demo-neha-004',
      name: 'Neha Kapoor',
      email: 'neha.kapoor@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: UserRole.VEHICLE_OWNER,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITH_VEHICLE,
      blockchainUserId: 'USR-DEMO-004',
      blockchainAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
      blockchainTxHash: '0x3c52d9be34ffb4b62f556d3ca56cb66a6a8c1efcc0f6649eab3c668fbe171e9b',
    },
    {
      id: 'demo-user-garage-001',
      firebaseUid: 'seed-demo-garage-001',
      name: 'Apex Certified Garage',
      email: 'garage@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150&auto=format&fit=crop&q=80',
      role: UserRole.GARAGE,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITHOUT_VEHICLE,
      blockchainUserId: 'USR-DEMO-GARAGE',
      blockchainAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      blockchainTxHash: '0x8cc25c5f23631ee44b2ab56099ba1703d318a92b5f0c4a745041098d881b1a3e',
    },
    // State B: New / Uninitialized User (No on-chain identity yet!)
    {
      id: 'demo-user-kabir-005',
      firebaseUid: 'seed-demo-kabir-005',
      name: 'Kabir Malhotra',
      email: 'kabir.malhotra@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      role: UserRole.VEHICLE_OWNER,
      isInitialized: false, // State B: Explicitly uninitialized
      onboardingStatus: OnboardingStatus.NOT_STARTED,
      blockchainUserId: null,
      blockchainAddress: null,
      blockchainTxHash: null,
    },
  ];

  for (const u of usersToSync) {
    const upserted = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        photoUrl: u.photoUrl,
        role: u.role,
        isInitialized: u.isInitialized,
        onboardingStatus: u.onboardingStatus,
        blockchainUserId: u.blockchainUserId,
        blockchainAddress: u.blockchainAddress,
        blockchainTxHash: u.blockchainTxHash,
      },
      create: u,
    });
    userMap.set(u.email, upserted.id);
    console.log(`👤 Synchronized User: ${upserted.name} (${upserted.email}) -> DB UUID: ${upserted.id}`);
  }

  // 2. Synchronize 8 Fictional Vehicles
  console.log('\n--- 2. Synchronizing 8 Fictional Vehicles ---');
  const aaravDbId = userMap.get('aarav.sharma@vehiclepassport.dev')!;
  const priyaDbId = userMap.get('priya.verma@vehiclepassport.dev')!;
  const rohanDbId = userMap.get('rohan.mehta@vehiclepassport.dev')!;
  const nehaDbId = userMap.get('neha.kapoor@vehiclepassport.dev')!;
  const garageDbId = userMap.get('garage@vehiclepassport.dev')!;

  const vehiclesToSync = [
    {
      id: 'demo-veh-001-aurora',
      passportId: 'VP-DEMO-001',
      vin: 'DEMOV001X1SEDAN01',
      registrationNumber: 'MH02DM1001',
      manufacturer: 'Aurora Motors',
      model: 'Aurora X1 Sedan',
      variant: 'Executive Line',
      manufacturingYear: 2024,
      fuelType: FuelType.PETROL,
      color: 'Monaco Blue',
      status: VehicleStatus.ACTIVE,
      blockchainStatus: BlockchainStatus.CONFIRMED,
      currentOwnerId: aaravDbId, // Aarav owns V001
      blockchainVehicleId: 'VEH-DEMO-001',
      blockchainTxHash: '0x5cfc39e120daf8ddfcf7847dafb035e5a157a74058ac2823735dc58f0f06a486',
    },
    {
      id: 'demo-veh-002-falcon',
      passportId: 'VP-DEMO-002',
      vin: 'DEMOV002E2ELEC002',
      registrationNumber: 'MH02DM1002',
      manufacturer: 'Falcon Dynamics',
      model: 'Falcon E2 Electric Car',
      variant: 'Long Range Dual Motor',
      manufacturingYear: 2024,
      fuelType: FuelType.ELECTRIC,
      color: 'Glacier Silver',
      status: VehicleStatus.ACTIVE,
      blockchainStatus: BlockchainStatus.CONFIRMED,
      currentOwnerId: aaravDbId, // Aarav owns V002 (Multiple vehicles for Aarav!)
      blockchainVehicleId: 'VEH-DEMO-002',
      blockchainTxHash: '0x64791cc68015662cd403e5ac8b968c9c26d118476aa500dde35ba4c4a3105ddc',
    },
    {
      id: 'demo-veh-003-summit',
      passportId: 'VP-DEMO-003',
      vin: 'DEMOV003R5SUVD003',
      registrationNumber: 'MH02DM1003',
      manufacturer: 'Summit Auto',
      model: 'Summit R5 SUV',
      variant: 'Adventure 4x4',
      manufacturingYear: 2023,
      fuelType: FuelType.DIESEL,
      color: 'Graphite Grey',
      status: VehicleStatus.ACTIVE,
      blockchainStatus: BlockchainStatus.CONFIRMED,
      currentOwnerId: priyaDbId, // Priya owns V003
      blockchainVehicleId: 'VEH-DEMO-003',
      blockchainTxHash: '0xc41ab2d65ccee3e2b54b89ad4388dbe2de7d2ff853ee6259c00e429d29e5be66',
    },
    {
      id: 'demo-veh-004-metro',
      passportId: 'VP-DEMO-004',
      vin: 'DEMOV004C3HATCH04',
      registrationNumber: 'MH02DM1004',
      manufacturer: 'Metro City Car',
      model: 'Metro C3 Hatchback',
      variant: 'Urban Hybrid',
      manufacturingYear: 2022,
      fuelType: FuelType.HYBRID,
      color: 'Tuscany Red',
      status: VehicleStatus.ACTIVE,
      blockchainStatus: BlockchainStatus.CONFIRMED,
      currentOwnerId: rohanDbId, // Rohan owns V004
      blockchainVehicleId: 'VEH-DEMO-004',
      blockchainTxHash: '0x720dcb454e956c2d58e2c3a75dbe42f235df65c84151ac16f7ee32be50e80fd2',
    },
    {
      id: 'demo-veh-005-terra',
      passportId: 'VP-DEMO-005',
      vin: 'DEMOV005H7HYBRD05',
      registrationNumber: 'MH02DM1005',
      manufacturer: 'Terra Automotive',
      model: 'Terra H7 Hybrid SUV',
      variant: 'Prestige AWD',
      manufacturingYear: 2024,
      fuelType: FuelType.HYBRID,
      color: 'Emerald Green',
      status: VehicleStatus.ACTIVE,
      blockchainStatus: BlockchainStatus.CONFIRMED,
      currentOwnerId: nehaDbId, // Neha owns V005
      blockchainVehicleId: 'VEH-DEMO-005',
      blockchainTxHash: '0x854b2884350959ccbd780326f6ca8e49d0ebaaf37be1c5d37d6f0d8520c16e1a',
    },
    {
      id: 'demo-veh-006-nova',
      passportId: 'VP-DEMO-006',
      vin: 'DEMOV006S4SEDAN06',
      registrationNumber: 'MH02DM1006',
      manufacturer: 'Nova Engineering',
      model: 'Nova S4 Sedan',
      variant: 'Comfort Plus',
      manufacturingYear: 2023,
      fuelType: FuelType.PETROL,
      color: 'Pearl White',
      status: VehicleStatus.ACTIVE,
      blockchainStatus: BlockchainStatus.CONFIRMED,
      currentOwnerId: aaravDbId, // Aarav owns V006
      blockchainVehicleId: 'VEH-DEMO-006',
      blockchainTxHash: '0x9fad5ae7b7bdf8232ccf2af1016491fa45eb6f507a8899300fa1e946b33b0546',
    },
    {
      id: 'demo-veh-007-volt',
      passportId: 'VP-DEMO-007',
      vin: 'DEMOV007E5ELEC007',
      registrationNumber: 'MH02DM1007',
      manufacturer: 'Volt Mobility',
      model: 'Volt E5 Electric Car',
      variant: 'Performance AWD',
      manufacturingYear: 2024,
      fuelType: FuelType.ELECTRIC,
      color: 'Cosmic Black',
      status: VehicleStatus.ACTIVE,
      blockchainStatus: BlockchainStatus.CONFIRMED,
      currentOwnerId: priyaDbId, // Priya owns V007 (Multiple vehicles for Priya!)
      blockchainVehicleId: 'VEH-DEMO-007',
      blockchainTxHash: '0xbed6d5d2784c216830dbab5170dba47b6cfb881875816b738acbe25430cfd669',
    },
    {
      id: 'demo-veh-008-orbit',
      passportId: 'VP-DEMO-008',
      vin: 'DEMOV008M2COMP008',
      registrationNumber: 'MH02DM1008',
      manufacturer: 'Orbit Motors',
      model: 'Orbit M2 Compact Car',
      variant: 'Active Turbo',
      manufacturingYear: 2022,
      fuelType: FuelType.PETROL,
      color: 'Sunset Orange',
      status: VehicleStatus.ACTIVE,
      blockchainStatus: BlockchainStatus.CONFIRMED,
      currentOwnerId: aaravDbId, // FINAL ON-CHAIN OWNER AFTER SEQUENTIAL TRANSFERS!
      blockchainVehicleId: 'VEH-DEMO-008',
      blockchainTxHash: '0x4821d9ac84572f296432a3dd3c6b425b58d7dd043c300ad58469ecdca4c457c8', // Final transfer tx hash
    },
  ];

  const vehMap = new Map<string, string>();
  for (const v of vehiclesToSync) {
    const upserted = await prisma.vehicle.upsert({
      where: { vin: v.vin },
      update: {
        passportId: v.passportId,
        registrationNumber: v.registrationNumber,
        manufacturer: v.manufacturer,
        model: v.model,
        variant: v.variant,
        manufacturingYear: v.manufacturingYear,
        fuelType: v.fuelType,
        color: v.color,
        status: v.status,
        blockchainStatus: v.blockchainStatus,
        currentOwnerId: v.currentOwnerId,
        blockchainVehicleId: v.blockchainVehicleId,
        blockchainTxHash: v.blockchainTxHash,
      },
      create: v,
    });
    vehMap.set(v.blockchainVehicleId, upserted.id);
    console.log(`🚗 Synchronized Vehicle: ${upserted.model} (${upserted.passportId}) -> Owner UUID: ${upserted.currentOwnerId}`);
  }

  // 3. Synchronize Ownership History for DEMO-V008 (Sequential Transfers)
  console.log('\n--- 3. Synchronizing Historical Ownership Timeline for DEMO-V008 ---');
  const v8DbId = vehMap.get('VEH-DEMO-008')!;

  // Clean old demo ownership histories
  await prisma.ownershipHistory.deleteMany({
    where: { vehicleId: v8DbId },
  });

  const trf1Hash = generateOwnershipRecordHash({
    blockchainVehicleId: 'VEH-DEMO-008',
    previousOwnerBlockchainId: 'USR-DEMO-003',
    newOwnerBlockchainId: 'USR-DEMO-002',
    transferType: 'SALE',
    transferDate: new Date('2025-06-15T10:30:00Z'),
  });

  // Transfer 1: Rohan -> Priya
  await prisma.ownershipHistory.create({
    data: {
      vehicleId: v8DbId,
      previousOwnerId: rohanDbId,
      newOwnerId: priyaDbId,
      transferType: OwnershipTransferType.SALE,
      transferDate: new Date('2025-06-15T10:30:00Z'),
      recordHash: trf1Hash,
      blockchainRecordId: 'REC-DEMO-TRF-001',
      blockchainTxHash: '0x7b7c658bff6bb2ac6169374f5afab73144332bac0875ce6d93c1ec33d4f3414e',
      blockNumber: 15,
      status: BlockchainStatus.CONFIRMED,
    },
  });
  console.log('📜 Recorded Transfer 1: Rohan Mehta -> Priya Verma (Block 15, Tx: 0x7b7c658...)');

  const trf2Hash = generateOwnershipRecordHash({
    blockchainVehicleId: 'VEH-DEMO-008',
    previousOwnerBlockchainId: 'USR-DEMO-002',
    newOwnerBlockchainId: 'USR-DEMO-001',
    transferType: 'SALE',
    transferDate: new Date('2026-02-20T14:45:00Z'),
  });

  // Transfer 2: Priya -> Aarav
  await prisma.ownershipHistory.create({
    data: {
      vehicleId: v8DbId,
      previousOwnerId: priyaDbId,
      newOwnerId: aaravDbId,
      transferType: OwnershipTransferType.SALE,
      transferDate: new Date('2026-02-20T14:45:00Z'),
      recordHash: trf2Hash,
      blockchainRecordId: 'REC-DEMO-TRF-002',
      blockchainTxHash: '0x4821d9ac84572f296432a3dd3c6b425b58d7dd043c300ad58469ecdca4c457c8',
      blockNumber: 16,
      status: BlockchainStatus.CONFIRMED,
    },
  });
  console.log('📜 Recorded Transfer 2: Priya Verma -> Aarav Sharma (Block 16, Tx: 0x4821d9a...)');

  // 4. Synchronize Service & Odometer Records
  console.log('\n--- 4. Synchronizing Service & Odometer Records ---');
  const v1DbId = vehMap.get('VEH-DEMO-001')!;
  const v2DbId = vehMap.get('VEH-DEMO-002')!;
  const v6DbId = vehMap.get('VEH-DEMO-006')!;
  const v7DbId = vehMap.get('VEH-DEMO-007')!;

  // Clean old demo services
  await prisma.serviceRecord.deleteMany({
    where: { vehicleId: { in: [v1DbId, v2DbId, v6DbId, v7DbId] } },
  });
  await prisma.odometerRecord.deleteMany({
    where: { vehicleId: { in: [v1DbId, v2DbId, v6DbId, v7DbId] } },
  });

  const srv1Hash = generateServiceRecordHash({
    blockchainVehicleId: 'VEH-DEMO-001',
    garageBlockchainId: 'USR-DEMO-GARAGE',
    serviceDate: new Date('2025-04-10'),
    mileage: 10000,
    serviceType: 'Routine Scheduled Maintenance',
    description: 'Scheduled 10,000 km Service: Engine oil, air filter, and multipoint safety inspection',
    partsReplaced: 'Synthetic 5W-30 Oil, Oil Filter, Air Filter Element',
    cost: 160,
  });

  // DEMO-V001 Service 1
  await prisma.serviceRecord.create({
    data: {
      vehicleId: v1DbId,
      garageId: garageDbId,
      serviceDate: new Date('2025-04-10'),
      mileage: 10000,
      serviceType: 'Routine Scheduled Maintenance',
      description: 'Scheduled 10,000 km Service: Engine oil, air filter, and multipoint safety inspection',
      partsReplaced: 'Synthetic 5W-30 Oil, Oil Filter, Air Filter Element',
      cost: 160,
      technician: 'Marcus Vance',
      recordHash: srv1Hash,
      blockchainRecordId: 'REC-DEMO-SRV-001',
      blockchainTxHash: '0xf69622519008972129eb8779f1923d9c98e2495863395c701ba535223c66c214',
      blockNumber: 17,
      status: BlockchainStatus.CONFIRMED,
    },
  });

  const srv2Hash = generateServiceRecordHash({
    blockchainVehicleId: 'VEH-DEMO-001',
    garageBlockchainId: 'USR-DEMO-GARAGE',
    serviceDate: new Date('2025-11-20'),
    mileage: 22500,
    serviceType: 'Brake Safety System Service',
    description: 'Front brake disc pads inspection and brake fluid hydraulic flush',
    partsReplaced: 'Ceramic Front Brake Pads, DOT-4 Brake Fluid',
    cost: 240,
  });

  // DEMO-V001 Service 2 & Odometer
  await prisma.serviceRecord.create({
    data: {
      vehicleId: v1DbId,
      garageId: garageDbId,
      serviceDate: new Date('2025-11-20'),
      mileage: 22500,
      serviceType: 'Brake Safety System Service',
      description: 'Front brake disc pads inspection and brake fluid hydraulic flush',
      partsReplaced: 'Ceramic Front Brake Pads, DOT-4 Brake Fluid',
      cost: 240,
      technician: 'Marcus Vance',
      recordHash: srv2Hash,
      blockchainRecordId: 'REC-DEMO-SRV-002',
      blockchainTxHash: '0xecc3964dd504a7ce603e39d92158cb0a2f007115f4ec4a6ba2feb07457379007',
      blockNumber: 18,
      status: BlockchainStatus.CONFIRMED,
    },
  });

  const odo1Hash = generateOdometerRecordHash({
    blockchainVehicleId: 'VEH-DEMO-001',
    mileage: 22500,
    recordedAt: new Date('2025-11-20'),
    sourceType: 'GARAGE',
  });

  await prisma.odometerRecord.create({
    data: {
      vehicleId: v1DbId,
      sourceUserId: garageDbId,
      recordedAt: new Date('2025-11-20'),
      mileage: 22500,
      sourceType: OdometerSourceType.GARAGE,
      rollbackDetected: false,
      verificationStatus: 'VERIFIED',
      recordHash: odo1Hash,
      blockchainRecordId: 'REC-DEMO-ODO-001',
      blockchainTxHash: '0xdb71b34dba372212e9a1a8523536b0672e73000a4e404a92cd7895c5a5cc288f',
      blockNumber: 19,
      status: BlockchainStatus.CONFIRMED,
    },
  });

  const srv3Hash = generateServiceRecordHash({
    blockchainVehicleId: 'VEH-DEMO-002',
    garageBlockchainId: 'USR-DEMO-GARAGE',
    serviceDate: new Date('2025-05-18'),
    mileage: 15000,
    serviceType: 'EV High-Voltage Battery Diagnostic',
    description: 'High-voltage battery diagnostic (State of Health: 99.2%), cell voltage balancing',
    partsReplaced: 'HEPA Cabin Filter',
    cost: 180,
  });

  // DEMO-V002 EV Services & Odometer
  await prisma.serviceRecord.create({
    data: {
      vehicleId: v2DbId,
      garageId: garageDbId,
      serviceDate: new Date('2025-05-18'),
      mileage: 15000,
      serviceType: 'EV High-Voltage Battery Diagnostic',
      description: 'High-voltage battery diagnostic (State of Health: 99.2%), cell voltage balancing',
      partsReplaced: 'HEPA Cabin Filter',
      cost: 180,
      technician: 'Marcus Vance',
      recordHash: srv3Hash,
      blockchainRecordId: 'REC-DEMO-SRV-003',
      blockchainTxHash: '0x1c97a748ce7a852469c1c90073f4f7a03fb58daf2cff7346f5d0d9383de5af6e',
      blockNumber: 20,
      status: BlockchainStatus.CONFIRMED,
    },
  });

  const odo2Hash = generateOdometerRecordHash({
    blockchainVehicleId: 'VEH-DEMO-002',
    mileage: 30000,
    recordedAt: new Date('2025-12-10'),
    sourceType: 'GARAGE',
  });

  await prisma.odometerRecord.create({
    data: {
      vehicleId: v2DbId,
      sourceUserId: garageDbId,
      recordedAt: new Date('2025-12-10'),
      mileage: 30000,
      sourceType: OdometerSourceType.GARAGE,
      rollbackDetected: false,
      verificationStatus: 'VERIFIED',
      recordHash: odo2Hash,
      blockchainRecordId: 'REC-DEMO-ODO-002',
      blockchainTxHash: '0x88574a8f903ff43b4f6e8c332fff3842ff88cc007336dd47a1c701a8acc4b107',
      blockNumber: 22,
      status: BlockchainStatus.CONFIRMED,
    },
  });

  console.log('⚙️ Synchronized 6 lifecycle service & odometer events.');
  console.log('🎉 DATABASE SYNCHRONIZATION COMPLETE WITH VERIFIED ON-CHAIN TRANSACTIONS!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Database sync failed:', err);
    process.exit(1);
  });
