import { User, UserRole, OnboardingStatus } from '../types/auth';
import { Vehicle, TimelineEvent, OwnershipHistoryRecord } from '../types/vehicle';
import fs from 'fs';

// Initial pre-seeded stakeholder users
export const initialUsers: User[] = [
  // --- DEMO USERS (Academic Evaluation Dataset) ---
  {
    id: 'demo-user-aarav-001',
    firebaseUid: 'seed-demo-aarav-001',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITH_VEHICLE',
    blockchainUserId: 'USR-DEMO-001',
    blockchainAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    blockchainTxHash: '0x7a35596aa439d77ad6d9a62e8246fa3743d401e60dd13567cc5771e5acf7ca26',
    blockchainInitializedAt: '2026-10-28T22:00:04.522Z',
    createdAt: '2026-10-28T22:00:04.522Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-user-priya-002',
    firebaseUid: 'seed-demo-priya-002',
    name: 'Priya Verma',
    email: 'priya.verma@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITH_VEHICLE',
    blockchainUserId: 'USR-DEMO-002',
    blockchainAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    blockchainTxHash: '0xe3fba6168a165596c893a46e53ce84a059b6c6c318ade0e8aa37817512a30668',
    blockchainInitializedAt: '2026-10-28T22:00:05.522Z',
    createdAt: '2026-10-28T22:00:05.522Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-user-rohan-003',
    firebaseUid: 'seed-demo-rohan-003',
    name: 'Rohan Mehta',
    email: 'rohan.mehta@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITH_VEHICLE',
    blockchainUserId: 'USR-DEMO-003',
    blockchainAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    blockchainTxHash: '0x5982bc869797cab20a31cc05034c2bfdd7e19b3d798ec19a27f22b01fae0e42f',
    blockchainInitializedAt: '2026-10-28T22:00:06.522Z',
    createdAt: '2026-10-28T22:00:06.522Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-user-neha-004',
    firebaseUid: 'seed-demo-neha-004',
    name: 'Neha Kapoor',
    email: 'neha.kapoor@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITH_VEHICLE',
    blockchainUserId: 'USR-DEMO-004',
    blockchainAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    blockchainTxHash: '0x3c52d9be34ffb4b62f556d3ca56cb66a6a8c1efcc0f6649eab3c668fbe171e9b',
    blockchainInitializedAt: '2026-10-28T22:00:07.522Z',
    createdAt: '2026-10-28T22:00:07.522Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-user-garage-001',
    firebaseUid: 'seed-demo-garage-001',
    name: 'Apex Certified Garage',
    email: 'garage@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150&auto=format&fit=crop&q=80',
    role: 'GARAGE',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITHOUT_VEHICLE',
    blockchainUserId: 'USR-DEMO-GARAGE',
    blockchainAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    blockchainTxHash: '0x8cc25c5f23631ee44b2ab56099ba1703d318a92b5f0c4a745041098d881b1a3e',
    blockchainInitializedAt: '2026-10-28T22:00:08.000Z',
    createdAt: '2026-10-28T22:00:08.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    // State B: Explicitly Uninitialized New User
    id: 'demo-user-kabir-005',
    firebaseUid: 'seed-demo-kabir-005',
    name: 'Kabir Malhotra',
    email: 'kabir.malhotra@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: false,
    onboardingStatus: 'NOT_STARTED',
    blockchainUserId: null,
    blockchainAddress: null,
    blockchainTxHash: null,
    blockchainInitializedAt: null,
    createdAt: '2026-10-28T22:00:08.522Z',
    updatedAt: new Date().toISOString(),
  },

  // --- INSTITUTIONAL / LEGACY USERS ---
  {
    id: 'user-owner-a',
    firebaseUid: 'seed-owner-a',
    name: 'Alex Mercer (Vehicle Owner)',
    email: 'owner.a@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITH_VEHICLE',
    blockchainUserId: 'USR-000001',
    blockchainAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    blockchainTxHash: '0x3a4b9c1d2e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef',
    blockchainInitializedAt: new Date('2025-01-10').toISOString(),
    createdAt: new Date('2025-01-10').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-owner-b',
    firebaseUid: 'seed-owner-b',
    name: 'Elena Rostova (Second Owner)',
    email: 'owner.b@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITH_VEHICLE',
    blockchainUserId: 'USR-000002',
    blockchainAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    blockchainTxHash: '0x4b5c6d7e8f90123456789abcdef0123456789abcdef3a4b9c1d2e5f60718293',
    blockchainInitializedAt: new Date('2025-01-15').toISOString(),
    createdAt: new Date('2025-01-15').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-manufacturer',
    firebaseUid: 'seed-manufacturer',
    name: 'Nordic Motors OEM',
    email: 'manufacturer@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&auto=format&fit=crop&q=80',
    role: 'MANUFACTURER',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITHOUT_VEHICLE',
    blockchainUserId: 'USR-000004',
    blockchainAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    blockchainTxHash: '0x6d7e8f90123456789abcdef0123456789abcdef3a4b9c1d2e5f607182934a5b',
    blockchainInitializedAt: new Date('2025-01-25').toISOString(),
    createdAt: new Date('2025-01-25').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-insurance',
    firebaseUid: 'seed-insurance',
    name: 'SafeShield Underwriters',
    email: 'insurance@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=150&auto=format&fit=crop&q=80',
    role: 'INSURANCE_PROVIDER',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITHOUT_VEHICLE',
    blockchainUserId: 'USR-000005',
    blockchainAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    blockchainTxHash: '0x7e8f90123456789abcdef0123456789abcdef3a4b9c1d2e5f607182934a5b6c',
    blockchainInitializedAt: new Date('2025-02-01').toISOString(),
    createdAt: new Date('2025-02-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-admin',
    firebaseUid: 'seed-admin',
    name: 'System Regulator & Auditor',
    email: 'admin@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    role: 'ADMIN',
    isInitialized: true,
    onboardingStatus: 'COMPLETED_WITHOUT_VEHICLE',
    blockchainUserId: 'USR-000006',
    blockchainAddress: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    blockchainTxHash: '0x8f90123456789abcdef0123456789abcdef3a4b9c1d2e5f607182934a5b6c7d',
    blockchainInitializedAt: new Date('2025-02-05').toISOString(),
    createdAt: new Date('2025-02-05').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-new-user',
    firebaseUid: 'seed-new-user',
    name: 'Test New User (Uninitialized)',
    email: 'newuser@vehiclepassport.dev',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: false,
    onboardingStatus: 'NOT_STARTED',
    blockchainUserId: null,
    blockchainAddress: null,
    createdAt: new Date('2025-02-10').toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Initial Vehicles with Ownership
export const initialVehicles: Vehicle[] = [
  // --- 8 REAL DEMO VEHICLES (MINED ON-CHAIN) ---
  {
    id: 'demo-veh-001-aurora',
    passportId: 'VP-DEMO-001',
    vin: 'DEMOV001X1SEDAN01',
    registrationNumber: 'MH02DM1001',
    manufacturer: 'Aurora Motors',
    model: 'Aurora X1 Sedan',
    variant: 'Executive Line',
    manufacturingYear: 2024,
    fuelType: 'PETROL',
    color: 'Monaco Blue',
    engineNumber: 'ENG-AU-001',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'demo-user-aarav-001',
    blockchainVehicleId: 'VEH-DEMO-001',
    blockchainTxHash: '0x5cfc39e120daf8ddfcf7847dafb035e5a157a74058ac2823735dc58f0f06a486',
    blockchainRegisteredAt: '2026-10-28T22:00:09.522Z',
    createdAt: '2026-10-28T22:00:09.522Z',
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[0],
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
    fuelType: 'ELECTRIC',
    color: 'Glacier Silver',
    engineNumber: 'EM-FC-002',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'demo-user-aarav-001',
    blockchainVehicleId: 'VEH-DEMO-002',
    blockchainTxHash: '0x64791cc68015662cd403e5ac8b968c9c26d118476aa500dde35ba4c4a3105ddc',
    blockchainRegisteredAt: '2026-10-28T22:00:10.522Z',
    createdAt: '2026-10-28T22:00:10.522Z',
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[0],
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
    fuelType: 'DIESEL',
    color: 'Graphite Grey',
    engineNumber: 'ENG-SM-003',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'demo-user-priya-002',
    blockchainVehicleId: 'VEH-DEMO-003',
    blockchainTxHash: '0xc41ab2d65ccee3e2b54b89ad4388dbe2de7d2ff853ee6259c00e429d29e5be66',
    blockchainRegisteredAt: '2026-10-28T22:00:11.522Z',
    createdAt: '2026-10-28T22:00:11.522Z',
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[1],
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
    fuelType: 'HYBRID',
    color: 'Tuscany Red',
    engineNumber: 'ENG-MC-004',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'demo-user-rohan-003',
    blockchainVehicleId: 'VEH-DEMO-004',
    blockchainTxHash: '0x720dcb454e956c2d58e2c3a75dbe42f235df65c84151ac16f7ee32be50e80fd2',
    blockchainRegisteredAt: '2026-10-28T22:00:12.522Z',
    createdAt: '2026-10-28T22:00:12.522Z',
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[2],
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
    fuelType: 'HYBRID',
    color: 'Emerald Green',
    engineNumber: 'ENG-TA-005',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'demo-user-neha-004',
    blockchainVehicleId: 'VEH-DEMO-005',
    blockchainTxHash: '0x854b2884350959ccbd780326f6ca8e49d0ebaaf37be1c5d37d6f0d8520c16e1a',
    blockchainRegisteredAt: '2026-10-28T22:00:13.522Z',
    createdAt: '2026-10-28T22:00:13.522Z',
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[3],
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
    fuelType: 'PETROL',
    color: 'Pearl White',
    engineNumber: 'ENG-NV-006',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'demo-user-aarav-001',
    blockchainVehicleId: 'VEH-DEMO-006',
    blockchainTxHash: '0x9fad5ae7b7bdf8232ccf2af1016491fa45eb6f507a8899300fa1e946b33b0546',
    blockchainRegisteredAt: '2026-10-28T22:00:14.522Z',
    createdAt: '2026-10-28T22:00:14.522Z',
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[0],
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
    fuelType: 'ELECTRIC',
    color: 'Cosmic Black',
    engineNumber: 'EM-VM-007',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'demo-user-priya-002',
    blockchainVehicleId: 'VEH-DEMO-007',
    blockchainTxHash: '0xbed6d5d2784c216830dbab5170dba47b6cfb881875816b738acbe25430cfd669',
    blockchainRegisteredAt: '2026-10-28T22:00:15.522Z',
    createdAt: '2026-10-28T22:00:15.522Z',
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[1],
  },
  {
    id: 'demo-veh-008-orbit',
    passportId: 'VP-DEMO-008',
    vin: 'DEMOV008M2COMP008',
    registrationNumber: 'MH02DM1008',
    manufacturer: 'Orbit Motors',
    model: 'Orbit M2 Compact Car',
    variant: 'Active Turbo',
    manufacturingYear: 2023,
    fuelType: 'PETROL',
    color: 'Sunset Orange',
    engineNumber: 'ENG-OM-008',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'demo-user-aarav-001',
    blockchainVehicleId: 'VEH-DEMO-008',
    blockchainTxHash: '0x4821d9ac84572f296432a3dd3c6b425b58d7dd043c300ad58469ecdca4c457c8',
    blockchainRegisteredAt: '2026-10-28T22:00:16.522Z',
    createdAt: '2026-10-28T22:00:16.522Z',
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[0],
  },

  // Legacy seeded vehicles
  {
    id: 'veh-nexon-001',
    passportId: 'VP-000001',
    vin: 'MAT612345NEXON001',
    registrationNumber: 'MH02EV1001',
    manufacturer: 'Tata Motors',
    model: 'Nexon EV',
    variant: 'Empowered Plus LR',
    manufacturingYear: 2024,
    fuelType: 'ELECTRIC',
    color: 'Daytona Grey',
    engineNumber: 'EM564321A',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'user-owner-a',
    blockchainVehicleId: 'VEH-000001',
    blockchainTxHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    blockchainRegisteredAt: new Date('2025-01-10').toISOString(),
    createdAt: new Date('2025-01-10').toISOString(),
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[6],
  },
  {
    id: 'veh-xuv-002',
    passportId: 'VP-000002',
    vin: 'MA1789456XUV0002',
    registrationNumber: 'DL01AX2020',
    manufacturer: 'Mahindra',
    model: 'XUV700',
    variant: 'AX7 Luxury AWD',
    manufacturingYear: 2023,
    fuelType: 'DIESEL',
    color: 'Midnight Black',
    engineNumber: 'MH789012B',
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: 'user-owner-b',
    blockchainVehicleId: 'VEH-000002',
    blockchainTxHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    blockchainRegisteredAt: new Date('2025-01-15').toISOString(),
    createdAt: new Date('2025-01-15').toISOString(),
    updatedAt: new Date().toISOString(),
    currentOwner: initialUsers[7],
  },
];

// Runtime state for serverless functions with /tmp disk caching
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalState = global as any;
const TMP_STORE_PATH = '/tmp/vehicle_passport_cache.json';

export function saveToDisk() {
  try {
    const timelines = globalState.__VEHICLE_PASSPORT_TIMELINES__ instanceof Map
      ? Array.from(globalState.__VEHICLE_PASSPORT_TIMELINES__.entries())
      : [];
    const ownershipHistories = globalState.__VEHICLE_PASSPORT_OWNERSHIP_HISTORIES__ instanceof Map
      ? Array.from(globalState.__VEHICLE_PASSPORT_OWNERSHIP_HISTORIES__.entries())
      : [];
    const data = {
      users: globalState.__VEHICLE_PASSPORT_USERS__ || [],
      vehicles: globalState.__VEHICLE_PASSPORT_VEHICLES__ || [],
      timelines,
      ownershipHistories,
    };
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(data), 'utf-8');
  } catch (err) {
    console.warn('[serverStore] saveToDisk error:', err);
  }
}

export function loadFromDisk() {
  try {
    if (fs.existsSync(TMP_STORE_PATH)) {
      const raw = fs.readFileSync(TMP_STORE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.users) && data.users.length > 0) {
        globalState.__VEHICLE_PASSPORT_USERS__ = data.users;
      }
      if (Array.isArray(data.vehicles) && data.vehicles.length > 0) {
        globalState.__VEHICLE_PASSPORT_VEHICLES__ = data.vehicles;
      }
      if (Array.isArray(data.timelines) && data.timelines.length > 0) {
        globalState.__VEHICLE_PASSPORT_TIMELINES__ = new Map(data.timelines);
      }
      if (Array.isArray(data.ownershipHistories) && data.ownershipHistories.length > 0) {
        globalState.__VEHICLE_PASSPORT_OWNERSHIP_HISTORIES__ = new Map(data.ownershipHistories);
      }
    }
  } catch (err) {
    // Non-fatal
  }
}

if (!globalState.__VEHICLE_PASSPORT_USERS__) {
  globalState.__VEHICLE_PASSPORT_USERS__ = [...initialUsers];
}
if (!globalState.__VEHICLE_PASSPORT_VEHICLES__) {
  globalState.__VEHICLE_PASSPORT_VEHICLES__ = [...initialVehicles];
}
if (!globalState.__VEHICLE_PASSPORT_TIMELINES__) {
  globalState.__VEHICLE_PASSPORT_TIMELINES__ = new Map<string, TimelineEvent[]>();
}
if (!globalState.__VEHICLE_PASSPORT_OWNERSHIP_HISTORIES__) {
  globalState.__VEHICLE_PASSPORT_OWNERSHIP_HISTORIES__ = new Map<string, OwnershipHistoryRecord[]>();

  // Pre-seed sequential ownership transfer records for DEMO-V008 (Orbit M2)
  globalState.__VEHICLE_PASSPORT_OWNERSHIP_HISTORIES__.set('demo-veh-008-orbit', [
    {
      id: 'own-hist-orbit-001',
      vehicleId: 'demo-veh-008-orbit',
      previousOwnerId: null,
      previousOwner: null,
      newOwnerId: 'demo-user-rohan-003',
      newOwner: {
        id: initialUsers[2].id,
        name: initialUsers[2].name,
        email: initialUsers[2].email,
        role: initialUsers[2].role,
      },
      transferType: 'INITIAL_REGISTRATION',
      transferDate: '2025-01-15T00:00:00.000Z',
      notes: 'Initial registration by Orbit Motors OEM',
      recordHash: '0x008initial000000000000000000000000000000000000000000000000000000',
      blockchainRecordId: 'REC-DEMO-GEN-008',
      blockchainTxHash: '0x4821d9ac84572f296432a3dd3c6b425b58d7dd043c300ad58469ecdca4c457c8',
      blockNumber: 14,
      status: 'CONFIRMED',
    },
    {
      id: 'own-hist-orbit-002',
      vehicleId: 'demo-veh-008-orbit',
      previousOwnerId: 'demo-user-rohan-003',
      previousOwner: {
        id: initialUsers[2].id,
        name: initialUsers[2].name,
        email: initialUsers[2].email,
        role: initialUsers[2].role,
      },
      newOwnerId: 'demo-user-priya-002',
      newOwner: {
        id: initialUsers[1].id,
        name: initialUsers[1].name,
        email: initialUsers[1].email,
        role: initialUsers[1].role,
      },
      transferType: 'SALE',
      transferDate: '2025-06-15T10:30:00.000Z',
      notes: 'Verified transfer from Rohan Mehta to Priya Verma',
      recordHash: '0xdeed111111111111111111111111111111111111111111111111111111111111',
      blockchainRecordId: 'REC-DEMO-TRF-001',
      blockchainTxHash: '0x7b7c658bff6bb2ac6169374f5afab73144332bac0875ce6d93c1ec33d4f3414e',
      blockNumber: 15,
      status: 'CONFIRMED',
    },
    {
      id: 'own-hist-orbit-003',
      vehicleId: 'demo-veh-008-orbit',
      previousOwnerId: 'demo-user-priya-002',
      previousOwner: {
        id: initialUsers[1].id,
        name: initialUsers[1].name,
        email: initialUsers[1].email,
        role: initialUsers[1].role,
      },
      newOwnerId: 'demo-user-aarav-001',
      newOwner: {
        id: initialUsers[0].id,
        name: initialUsers[0].name,
        email: initialUsers[0].email,
        role: initialUsers[0].role,
      },
      transferType: 'SALE',
      transferDate: '2026-02-20T14:45:00.000Z',
      notes: 'Verified transfer from Priya Verma to Aarav Sharma',
      recordHash: '0xdeed222222222222222222222222222222222222222222222222222222222222',
      blockchainRecordId: 'REC-DEMO-TRF-002',
      blockchainTxHash: '0x4821d9ac84572f296432a3dd3c6b425b58d7dd043c300ad58469ecdca4c457c8',
      blockNumber: 16,
      status: 'CONFIRMED',
    },
  ]);
}

loadFromDisk();

export function getUsers(): User[] {
  loadFromDisk();
  return globalState.__VEHICLE_PASSPORT_USERS__;
}

export function getVehicles(): Vehicle[] {
  loadFromDisk();
  return globalState.__VEHICLE_PASSPORT_VEHICLES__;
}

export interface UserTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  blockchainUserId?: string | null;
  isInitialized: boolean;
  onboardingStatus?: OnboardingStatus;
  iat: number;
}

export function createSessionToken(user: User): string {
  const payload: UserTokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    blockchainUserId: user.blockchainUserId || null,
    isInitialized: user.isInitialized,
    onboardingStatus: user.onboardingStatus || (user.isInitialized ? 'COMPLETED_WITH_VEHICLE' : 'NOT_STARTED'),
    iat: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `vpt_${encoded}`;
}

export function parseSessionToken(token: string | null | undefined): User | null {
  if (!token) return null;
  loadFromDisk();

  // If token is self-contained vpt_<base64url>
  if (token.startsWith('vpt_')) {
    try {
      const rawPayload = Buffer.from(token.slice(4), 'base64url').toString('utf-8');
      const payload: UserTokenPayload = JSON.parse(rawPayload);
      const users = getUsers();
      let user = users.find((u) => u.id === payload.userId || u.email.toLowerCase() === payload.email.toLowerCase());
      if (user) {
        if (payload.isInitialized && !user.isInitialized) {
          user.isInitialized = true;
          if (payload.blockchainUserId && !user.blockchainUserId) {
            user.blockchainUserId = payload.blockchainUserId;
          }
          if (payload.onboardingStatus && user.onboardingStatus === 'NOT_STARTED') {
            user.onboardingStatus = payload.onboardingStatus;
          }
          saveToDisk();
        }
      } else {
        // Restore user into store
        user = {
          id: payload.userId,
          firebaseUid: `fb-${payload.userId}`,
          name: payload.name,
          email: payload.email,
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          role: (payload.role as UserRole) || 'VEHICLE_OWNER',
          isInitialized: payload.isInitialized !== undefined ? payload.isInitialized : false,
          onboardingStatus: payload.onboardingStatus || 'NOT_STARTED',
          blockchainUserId: payload.blockchainUserId || null,
          blockchainAddress: payload.blockchainUserId ? '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('') : null,
          blockchainTxHash: payload.blockchainUserId ? generateRandomHash() : null,
          blockchainInitializedAt: payload.blockchainUserId ? new Date().toISOString() : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        users.push(user);
        saveToDisk();
      }
      return user;
    } catch (err) {
      console.warn('Failed to parse vpt token:', err);
    }
  }

  // Fallback for legacy token_ format
  if (token.startsWith('token_')) {
    const lastUnderscore = token.lastIndexOf('_');
    const userId = lastUnderscore > 6 ? token.substring(6, lastUnderscore) : token.substring(6);
    const users = getUsers();
    const user = users.find((u) => u.id === userId || u.firebaseUid === userId);
    return user || null;
  }

  const users = getUsers();
  return users.find((u) => u.id === token || u.email.toLowerCase() === token.toLowerCase()) || null;
}

export function generateBlockchainUserId(): string {
  const users = getUsers();
  const nextNum = users.length + 1;
  const candidate = `USR-${String(nextNum).padStart(6, '0')}`;
  // Ensure uniqueness
  if (users.some((u) => u.blockchainUserId === candidate)) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `USR-${randomSuffix}`;
  }
  return candidate;
}

export function generateRandomHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function findOrCreateUser(userData: {
  firebaseUid?: string;
  email?: string;
  name?: string;
  photoUrl?: string | null;
}): User {
  const users = getUsers();
  const email = (userData.email || 'user@example.com').toLowerCase().trim();
  const firebaseUid = userData.firebaseUid || `fb-${Date.now()}`;

  const existing = users.find(
    (u) =>
      (u.firebaseUid && u.firebaseUid === firebaseUid) ||
      (u.email && u.email.toLowerCase() === email)
  );

  if (existing) {
    if (userData.name && userData.name !== existing.name) {
      existing.name = userData.name;
    }
    if (userData.photoUrl) {
      existing.photoUrl = userData.photoUrl;
    }
    existing.updatedAt = new Date().toISOString();
    saveToDisk();
    return existing;
  }

  // Create brand new user (uninitialized, onboarding not started, no vehicle)
  const newId = `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newUser: User = {
    id: newId,
    firebaseUid,
    name: userData.name || 'Vehicle Owner',
    email,
    photoUrl:
      userData.photoUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'VEHICLE_OWNER',
    isInitialized: false, // Brand new users start uninitialized!
    onboardingStatus: 'NOT_STARTED',
    blockchainUserId: null,
    blockchainAddress: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveToDisk();

  return newUser;
}

export function updateUserOnboardingStatus(userId: string, status: OnboardingStatus): User | null {
  loadFromDisk();
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  user.onboardingStatus = status;
  user.updatedAt = new Date().toISOString();
  saveToDisk();
  return user;
}

export function initializeUserPassport(userId: string): User | null {
  loadFromDisk();
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  if (!user.blockchainUserId) {
    user.blockchainUserId = generateBlockchainUserId();
  }
  user.isInitialized = true;
  user.onboardingStatus = user.onboardingStatus || 'NOT_STARTED';
  user.blockchainAddress = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  user.blockchainTxHash = generateRandomHash();
  user.blockchainInitializedAt = new Date().toISOString();
  user.updatedAt = new Date().toISOString();
  saveToDisk();
  return user;
}

export function provisionVehicleForNewOwner(owner: User): Vehicle {
  const vehicles = getVehicles();
  const existingOwned = vehicles.filter((v) => v.currentOwnerId === owner.id);
  if (existingOwned.length > 0) {
    return existingOwned[0];
  }

  const index = vehicles.length + 1;
  const passportId = `VP-${String(index).padStart(6, '0')}`;
  const vin = `VPP${String(index).padStart(4, '0')}${owner.blockchainUserId?.replace('-', '') || 'PASS'}99`;
  const regNumber = `IND${String(index).padStart(2, '0')}VP${Math.floor(1000 + Math.random() * 9000)}`;

  const newVehicle: Vehicle = {
    id: `veh-${Date.now()}`,
    passportId,
    vin,
    registrationNumber: regNumber,
    manufacturer: 'Tesla',
    model: 'Model Y',
    variant: 'Long Range Dual Motor',
    manufacturingYear: 2024,
    fuelType: 'ELECTRIC',
    color: 'Pearl White Multi-Coat',
    engineNumber: `TSL${Math.floor(100000 + Math.random() * 900000)}`,
    status: 'ACTIVE',
    blockchainStatus: 'CONFIRMED',
    currentOwnerId: owner.id,
    blockchainVehicleId: `VEH-${String(index).padStart(6, '0')}`,
    blockchainTxHash: generateRandomHash(),
    blockchainRegisteredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentOwner: owner,
  };

  vehicles.push(newVehicle);

  // Initialize vehicle timeline with Genesis ownership
  const nowYear = new Date().getFullYear();
  const timeline: TimelineEvent[] = [
    {
      id: `event-genesis-${newVehicle.id}`,
      category: 'OWNERSHIP',
      date: newVehicle.createdAt,
      year: nowYear,
      title: 'Initial Vehicle Registration & Ownership Anchor',
      description: `Vehicle Passport ${passportId} issued to ${owner.name} (${owner.blockchainUserId}). Cryptographically anchored on EVM L2 Subnet.`,
      actor: owner.name,
      status: 'CONFIRMED',
      blockchainTxHash: newVehicle.blockchainTxHash,
      details: {
        evidenceRef: `GenesisCertificate#${passportId}`,
        level: 'VERIFIED',
      },
    },
  ];

  globalState.__VEHICLE_PASSPORT_TIMELINES__.set(newVehicle.id, timeline);
  saveToDisk();

  return newVehicle;
}

export function getVehicleTimelineData(vehicleId: string): TimelineEvent[] {
  loadFromDisk();
  const timelines = globalState.__VEHICLE_PASSPORT_TIMELINES__;
  if (!timelines.has(vehicleId)) {
    const vehicle = getVehicles().find((v) => v.id === vehicleId || v.passportId === vehicleId);
    const ownerName = vehicle?.currentOwner?.name || 'Authorized Owner';
    const nowYear = new Date().getFullYear();
    timelines.set(vehicleId, [
      {
        id: `event-genesis-${vehicleId}`,
        category: 'OWNERSHIP',
        date: vehicle?.createdAt || new Date().toISOString(),
        year: nowYear,
        title: 'Initial Vehicle Registration & Ownership Anchor',
        description: `Genesis registration anchored on-chain for ${vehicle?.manufacturer || 'Vehicle'} ${vehicle?.model || ''}.`,
        actor: ownerName,
        status: 'CONFIRMED',
        blockchainTxHash: vehicle?.blockchainTxHash || generateRandomHash(),
        details: {
          evidenceRef: `GenesisCertificate#${vehicle?.passportId || 'VP-000001'}`,
          level: 'VERIFIED',
        },
      },
    ]);
  }
  return timelines.get(vehicleId) || [];
}

export function getOwnershipHistoryData(vehicleId: string): OwnershipHistoryRecord[] {
  loadFromDisk();
  const histories = globalState.__VEHICLE_PASSPORT_OWNERSHIP_HISTORIES__;
  if (!histories.has(vehicleId)) {
    const vehicle = getVehicles().find((v) => v.id === vehicleId || v.passportId === vehicleId);
    if (vehicle && vehicle.currentOwner) {
      const initialRecord: OwnershipHistoryRecord = {
        id: `own-hist-${vehicle.id}-initial`,
        vehicleId: vehicle.id,
        previousOwnerId: null,
        previousOwner: null,
        newOwnerId: vehicle.currentOwner.id,
        newOwner: {
          id: vehicle.currentOwner.id,
          name: vehicle.currentOwner.name,
          email: vehicle.currentOwner.email,
          role: vehicle.currentOwner.role,
        },
        transferType: 'INITIAL_REGISTRATION',
        transferDate: vehicle.createdAt || new Date().toISOString(),
        notes: 'Initial registration by vehicle manufacturer',
        recordHash: vehicle.blockchainTxHash || generateRandomHash(),
        blockchainRecordId: 'REC-000001',
        blockchainTxHash: vehicle.blockchainTxHash || generateRandomHash(),
        blockNumber: 12500001,
        status: 'CONFIRMED',
      };
      histories.set(vehicle.id, [initialRecord]);
      saveToDisk();
    }
  }
  return histories.get(vehicleId) || [];
}

export function addOwnershipHistoryRecord(vehicleId: string, record: OwnershipHistoryRecord): void {
  loadFromDisk();
  const histories = globalState.__VEHICLE_PASSPORT_OWNERSHIP_HISTORIES__;
  const list = histories.get(vehicleId) || [];
  list.push(record);
  histories.set(vehicleId, list);
  saveToDisk();
}
