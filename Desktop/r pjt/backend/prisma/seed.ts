import {
  PrismaClient,
  UserRole,
  OnboardingStatus,
  FuelType,
  VehicleStatus,
  AccidentSeverity,
  RepairStatus,
  InsurancePolicyStatus,
  DocumentType,
  OdometerSourceType,
} from '@prisma/client';
import { BlockchainService } from '../src/blockchain/services/blockchainService';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with users, vehicles, and Phase 4 lifecycle records...');

  const preSeededUsers = [
    {
      firebaseUid: 'seed-owner-a',
      name: 'Test Owner A (Alex Mercer)',
      email: 'owner.a@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: UserRole.VEHICLE_OWNER,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITH_VEHICLE,
      blockchainAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Hardhat account #1
    },
    {
      firebaseUid: 'seed-owner-b',
      name: 'Test Owner B (Elena Rostova)',
      email: 'owner.b@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: UserRole.VEHICLE_OWNER,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITH_VEHICLE,
      blockchainAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Hardhat account #2
    },
    {
      firebaseUid: 'seed-garage',
      name: 'Test Garage (Apex Certified)',
      email: 'garage@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150&auto=format&fit=crop&q=80',
      role: UserRole.GARAGE,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITHOUT_VEHICLE,
      blockchainAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Hardhat account #3
    },
    {
      firebaseUid: 'seed-manufacturer',
      name: 'Test Manufacturer (Nordic Motors)',
      email: 'manufacturer@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&auto=format&fit=crop&q=80',
      role: UserRole.MANUFACTURER,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITHOUT_VEHICLE,
      blockchainAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Hardhat account #4
    },
    {
      firebaseUid: 'seed-insurance',
      name: 'Test Insurance Provider (SafeShield)',
      email: 'insurance@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=150&auto=format&fit=crop&q=80',
      role: UserRole.INSURANCE_PROVIDER,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITHOUT_VEHICLE,
      blockchainAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', // Hardhat account #5
    },
    {
      firebaseUid: 'seed-admin',
      name: 'Test Admin (System Regulator)',
      email: 'admin@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      role: UserRole.ADMIN,
      isInitialized: true,
      onboardingStatus: OnboardingStatus.COMPLETED_WITHOUT_VEHICLE,
      blockchainAddress: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', // Hardhat account #6
    },
    {
      firebaseUid: 'seed-new-user',
      name: 'Test New User (Uninitialized)',
      email: 'newuser@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: UserRole.VEHICLE_OWNER,
      isInitialized: false,
      onboardingStatus: OnboardingStatus.NOT_STARTED,
      blockchainAddress: null,
    },
  ];

  const userMap = new Map<string, string>();
  const blockchainService = BlockchainService.getInstance();

  // Clean lifecycle tables to ensure fresh synchronization with contract state
  await prisma.merkleBatchRecord.deleteMany();
  await prisma.merkleBatch.deleteMany();
  await prisma.serviceRecord.deleteMany();
  await prisma.odometerRecord.deleteMany();
  await prisma.accidentRecord.deleteMany();
  await prisma.insuranceRecord.deleteMany();
  await prisma.vehicleDocument.deleteMany();
  await prisma.ownershipHistory.deleteMany();
  await prisma.batteryLifecycleEvent.deleteMany();
  await prisma.insuranceClaimRecord.deleteMany();
  await prisma.blockchainRecord.deleteMany();

  for (const user of preSeededUsers) {
    const upserted = await prisma.user.upsert({
      where: { firebaseUid: user.firebaseUid },
      update: {
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        role: user.role,
        isInitialized: user.isInitialized,
        onboardingStatus: user.onboardingStatus,
        blockchainAddress: user.blockchainAddress,
      },
      create: user,
    });
    userMap.set(user.firebaseUid, upserted.id);

    if (user.isInitialized) {
      try {
        await blockchainService.initializeUser({
          userId: upserted.id,
          firebaseUid: upserted.firebaseUid,
          role: upserted.role,
          address: user.blockchainAddress,
        });
        console.log(`🔗 Blockchain User Registered: ${upserted.name} (${upserted.role})`);
      } catch (err: any) {
        console.log(`ℹ️ User registration status for ${upserted.name}: ${err.message}`);
      }
    }
  }

  const ownerAId = userMap.get('seed-owner-a')!;
  const ownerBId = userMap.get('seed-owner-b')!;
  const garageId = userMap.get('seed-garage')!;
  const insuranceId = userMap.get('seed-insurance')!;

  // 1. Vehicle 1: Tata Nexon EV (Owner A)
  const v1 = await prisma.vehicle.upsert({
    where: { vin: 'MAT612345NEXON001' },
    update: {
      passportId: 'VP-000001',
      registrationNumber: 'MH02EV1001',
      manufacturer: 'Tata',
      model: 'Nexon EV',
      variant: 'Empowered Plus LR',
      manufacturingYear: 2024,
      fuelType: FuelType.ELECTRIC,
      color: 'Daytona Grey',
      engineNumber: 'EM564321A',
      status: VehicleStatus.ACTIVE,
      currentOwnerId: ownerAId,
    },
    create: {
      passportId: 'VP-000001',
      vin: 'MAT612345NEXON001',
      registrationNumber: 'MH02EV1001',
      manufacturer: 'Tata',
      model: 'Nexon EV',
      variant: 'Empowered Plus LR',
      manufacturingYear: 2024,
      fuelType: FuelType.ELECTRIC,
      color: 'Daytona Grey',
      engineNumber: 'EM564321A',
      status: VehicleStatus.ACTIVE,
      currentOwnerId: ownerAId,
    },
  });

  await blockchainService.registerVehicle(v1.id);
  console.log(`🚗 Vehicle 1 Registered & Anchored: ${v1.manufacturer} ${v1.model}`);

  // Vehicle 1 Lifecycle Records
  const existingV1Services = await prisma.serviceRecord.count({ where: { vehicleId: v1.id } });
  if (existingV1Services === 0) {
    console.log('⚙️ Anchoring Service & Odometer records for Vehicle 1...');
    // Service 1
    await blockchainService.anchorServiceRecord({
      vehicleId: v1.id,
      garageId,
      serviceDate: new Date('2025-05-15'),
      mileage: 15000,
      serviceType: 'First Scheduled Periodic Service',
      description: 'Comprehensive EV 15,000 km check, high-voltage battery diagnostic, suspension torque verification',
      partsReplaced: 'Cabin HEPA Filter, Windshield Wiper Blades',
      laborDescription: '4 hours certified EV technician inspection',
      cost: 220,
      technician: 'Marcus Vance',
      notes: 'Vehicle in optimal condition. Battery state of health 100%.',
    });

    // Service 2
    await blockchainService.anchorServiceRecord({
      vehicleId: v1.id,
      garageId,
      serviceDate: new Date('2026-01-20'),
      mileage: 32000,
      serviceType: 'Major 30,000 km Maintenance',
      description: 'Battery thermal management coolant flush, brake rotor cleaning and pad replacement, software ECU update',
      partsReplaced: 'Front Ceramic Brake Pads, Thermal Coolant Type EV-3',
      laborDescription: '5.5 hours master technician labor',
      cost: 490,
      technician: 'Marcus Vance',
      notes: 'All diagnostic tests passed. Battery health 99.2%.',
    });

    // Multiple Odometer Records
    await blockchainService.anchorOdometerRecord({
      vehicleId: v1.id,
      sourceUserId: ownerAId,
      mileage: 7500,
      recordedAt: new Date('2025-02-10'),
      sourceType: OdometerSourceType.OWNER,
      notes: 'Logged before interstate road trip',
    });

    await blockchainService.anchorOdometerRecord({
      vehicleId: v1.id,
      sourceUserId: ownerAId,
      mileage: 23500,
      recordedAt: new Date('2025-10-05'),
      sourceType: OdometerSourceType.OWNER,
      notes: 'Routine quarterly odometer check',
    });

    await blockchainService.anchorOdometerRecord({
      vehicleId: v1.id,
      sourceUserId: garageId,
      mileage: 32000,
      recordedAt: new Date('2026-01-20'),
      sourceType: OdometerSourceType.SERVICE,
      notes: 'Verified during 30,000 km service',
    });

    // Insurance Record
    await blockchainService.anchorInsuranceRecord({
      vehicleId: v1.id,
      providerId: insuranceId,
      policyReference: 'POL-SFSH-2025-NEXON',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-01-01'),
      coverageType: 'Comprehensive Zero-Depreciation EV Shield',
      status: InsurancePolicyStatus.ACTIVE,
      notes: 'Active policy with 24x7 roadside battery assistance.',
    });

    // Accident & Repair Record
    await blockchainService.anchorAccidentRecord({
      vehicleId: v1.id,
      reportedById: ownerAId,
      accidentDate: new Date('2025-08-14'),
      severity: AccidentSeverity.MINOR,
      description: 'Low-speed rear parking collision with bollard in underground parking',
      damagedParts: 'Rear bumper cover, left parking sensor',
      locationDescription: 'Metropolitan Mall Parking P2',
      insuranceClaimId: 'CLM-SFSH-2025-8812',
      repairStatus: RepairStatus.COMPLETED,
      repairDescription: 'Replaced rear bumper cover with factory OEM paint match and recalibrated ultrasonic sensors.',
    });

    // Document Record
    await blockchainService.anchorDocumentRecord({
      vehicleId: v1.id,
      uploadedById: ownerAId,
      documentType: DocumentType.REGISTRATION_CERTIFICATE,
      title: 'Vehicle Registration Certificate (RC)',
      fileUrl: 'https://storage.vehiclepassport.dev/documents/vp000001_rc.pdf',
      fileName: 'vp000001_rc.pdf',
      fileSize: 245000,
      mimeType: 'application/pdf',
      fileHash: '0x3b89e81792f44a8dc1bc19e534f378a83416a2ef69d4e56715f2125f4621c43a',
    });

    console.log('✅ Vehicle 1 complete lifecycle seeded.');
  }

  // 2. Vehicle 2: Honda City (Owner A)
  const v2 = await prisma.vehicle.upsert({
    where: { vin: 'MAK712345CITY0002' },
    update: {
      passportId: 'VP-000002',
      registrationNumber: 'MH02HC2002',
      manufacturer: 'Honda',
      model: 'City',
      variant: 'ZX VTEC',
      manufacturingYear: 2023,
      fuelType: FuelType.PETROL,
      color: 'Platinum White Pearl',
      engineNumber: 'L15Z198765',
      status: VehicleStatus.ACTIVE,
      currentOwnerId: ownerAId,
    },
    create: {
      passportId: 'VP-000002',
      vin: 'MAK712345CITY0002',
      registrationNumber: 'MH02HC2002',
      manufacturer: 'Honda',
      model: 'City',
      variant: 'ZX VTEC',
      manufacturingYear: 2023,
      fuelType: FuelType.PETROL,
      color: 'Platinum White Pearl',
      engineNumber: 'L15Z198765',
      status: VehicleStatus.ACTIVE,
      currentOwnerId: ownerAId,
    },
  });

  await blockchainService.registerVehicle(v2.id);
  console.log(`🚗 Vehicle 2 Registered & Anchored: ${v2.manufacturer} ${v2.model}`);

  const existingV2Services = await prisma.serviceRecord.count({ where: { vehicleId: v2.id } });
  if (existingV2Services === 0) {
    await blockchainService.anchorServiceRecord({
      vehicleId: v2.id,
      garageId,
      serviceDate: new Date('2024-11-10'),
      mileage: 10500,
      serviceType: '10,000 km Oil & Filter Service',
      description: 'Synthetic 0W-20 engine oil renewal, OEM oil filter, air filter replacement, 40-point safety check',
      partsReplaced: 'Honda Synthetic Oil 3.6L, Honda OEM Filter',
      cost: 140,
      technician: 'Sam Rivera',
      notes: 'Brakes and tires in excellent condition.',
    });

    await blockchainService.anchorOdometerRecord({
      vehicleId: v2.id,
      sourceUserId: garageId,
      mileage: 10500,
      recordedAt: new Date('2024-11-10'),
      sourceType: OdometerSourceType.SERVICE,
      notes: 'Recorded during periodic service',
    });
    console.log('✅ Vehicle 2 service and odometer history seeded.');
  }

  // 3. Vehicle 3: BMW X1 (Owner A)
  const vX1 = await prisma.vehicle.upsert({
    where: { vin: 'WBA312345BMWX0003' },
    update: {
      passportId: 'VP-000003',
      registrationNumber: 'MH02BX3003',
      manufacturer: 'BMW',
      model: 'X1',
      variant: 'sDrive20d xLine',
      manufacturingYear: 2022,
      fuelType: FuelType.DIESEL,
      color: 'Phytonic Blue',
      engineNumber: 'B47C20A123',
      status: VehicleStatus.ACTIVE,
      currentOwnerId: ownerAId,
    },
    create: {
      passportId: 'VP-000003',
      vin: 'WBA312345BMWX0003',
      registrationNumber: 'MH02BX3003',
      manufacturer: 'BMW',
      model: 'X1',
      variant: 'sDrive20d xLine',
      manufacturingYear: 2022,
      fuelType: FuelType.DIESEL,
      color: 'Phytonic Blue',
      engineNumber: 'B47C20A123',
      status: VehicleStatus.ACTIVE,
      currentOwnerId: ownerAId,
    },
  });

  await blockchainService.registerVehicle(vX1.id);
  console.log(`🚗 Vehicle 3 Registered & Anchored: ${vX1.manufacturer} ${vX1.model}`);

  // 4. Vehicle 4: Tesla Model 3 (Owner B)
  const v3 = await prisma.vehicle.upsert({
    where: { vin: '5YJ312345TESL0004' },
    update: {
      passportId: 'VP-000004',
      registrationNumber: 'KA01TS4004',
      manufacturer: 'Tesla',
      model: 'Model 3',
      variant: 'Long Range Dual Motor',
      manufacturingYear: 2023,
      fuelType: FuelType.ELECTRIC,
      color: 'Pearl White Multi-Coat',
      engineNumber: '3D3B123456',
      status: VehicleStatus.ACTIVE,
      currentOwnerId: ownerBId,
    },
    create: {
      passportId: 'VP-000004',
      vin: '5YJ312345TESL0004',
      registrationNumber: 'KA01TS4004',
      manufacturer: 'Tesla',
      model: 'Model 3',
      variant: 'Long Range Dual Motor',
      manufacturingYear: 2023,
      fuelType: FuelType.ELECTRIC,
      color: 'Pearl White Multi-Coat',
      engineNumber: '3D3B123456',
      status: VehicleStatus.ACTIVE,
      currentOwnerId: ownerBId,
    },
  });

  await blockchainService.registerVehicle(v3.id);
  console.log(`🚗 Vehicle 3 Registered & Anchored: ${v3.manufacturer} ${v3.model}`);

  const existingV3Insurance = await prisma.insuranceRecord.count({ where: { vehicleId: v3.id } });
  if (existingV3Insurance === 0) {
    await blockchainService.anchorInsuranceRecord({
      vehicleId: v3.id,
      providerId: insuranceId,
      policyReference: 'POL-SFSH-2026-TESLA3',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      coverageType: 'Full Comprehensive Electric Vehicle Policy',
      status: InsurancePolicyStatus.ACTIVE,
      notes: 'Includes glass coverage, loaner vehicle benefit, and full battery warranty extension.',
    });
    console.log('✅ Vehicle 3 insurance record seeded.');
  }

  console.log('🎉 Phase 4 Database & Blockchain Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
