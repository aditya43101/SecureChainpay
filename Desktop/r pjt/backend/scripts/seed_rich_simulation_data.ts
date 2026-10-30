import { prisma } from '../src/lib/prisma';
import { ethers } from 'ethers';
import { BatchOrchestrationService } from '../src/blockchain/services/batchOrchestrationService';
import { BlockchainService } from '../src/blockchain/services/blockchainService';
import { TwinScenarioService } from '../src/services/twin/TwinScenarioService';
import { BlockchainStatus } from '@prisma/client';

async function seedRichSimulationData() {
  console.log('================================================================');
  console.log('🚀 SEEDING RICH SIMULATION DATA & ON-CHAIN MERKLE BATCHES');
  console.log('================================================================\n');

  const bcService = BlockchainService.getInstance();
  const batchService = BatchOrchestrationService.getInstance();
  const twinScenarioService = TwinScenarioService.getInstance();

  // Find admin user to attribute batch creation
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });
  const adminId = adminUser?.id || (await prisma.user.findFirst())!.id;

  console.log(`👤 Using Administrator ID: ${adminId} (${adminUser?.name || 'System Admin'})`);

  // 1. Create Extra Unbatched Service & Odometer records to feed multiple Merkle Batches
  console.log('\n--- 1. Generating Authentic Lifecycle Records for Merkle Batching ---');
  const allVehicles = await prisma.vehicle.findMany({
    take: 6,
    orderBy: { createdAt: 'asc' },
  });

  const garage = await prisma.user.findFirst({ where: { role: 'GARAGE' } }) || adminUser!;

  for (const v of allVehicles) {
    const existingCount = await prisma.serviceRecord.count({ where: { vehicleId: v.id } });
    if (existingCount < 4) {
      const ts = Date.now();
      const s1Hash = ethers.keccak256(ethers.toUtf8Bytes(`SIM_SERVICE_${v.id}_1_${ts}`));
      const s2Hash = ethers.keccak256(ethers.toUtf8Bytes(`SIM_SERVICE_${v.id}_2_${ts}`));
      const o1Hash = ethers.keccak256(ethers.toUtf8Bytes(`SIM_ODOMETER_${v.id}_1_${ts}`));

      await prisma.serviceRecord.create({
        data: {
          vehicleId: v.id,
          garageId: garage.id,
          serviceDate: new Date(Date.now() - 60 * 86400000),
          mileage: 18500,
          serviceType: 'Certified Multi-Point Safety Inspection',
          description: 'Comprehensive powertrain, braking, suspension, and high-voltage diagnostic inspection',
          partsReplaced: 'Air Filter, Cabin Filter, Brake Pads',
          cost: 280,
          technician: 'Marcus Vance',
          recordHash: s1Hash,
          status: BlockchainStatus.PENDING,
        },
      });

      await prisma.serviceRecord.create({
        data: {
          vehicleId: v.id,
          garageId: garage.id,
          serviceDate: new Date(Date.now() - 20 * 86400000),
          mileage: 26000,
          serviceType: 'Powertrain ECU Firmware Flash',
          description: 'Factory ECU recalibration, energy management optimization, telemetry sync',
          cost: 150,
          technician: 'Marcus Vance',
          recordHash: s2Hash,
          status: BlockchainStatus.PENDING,
        },
      });

      await prisma.odometerRecord.create({
        data: {
          vehicleId: v.id,
          sourceUserId: garage.id,
          recordedAt: new Date(Date.now() - 20 * 86400000),
          mileage: 26000,
          sourceType: 'GARAGE',
          rollbackDetected: false,
          verificationStatus: 'VERIFIED',
          recordHash: o1Hash,
          status: BlockchainStatus.PENDING,
        },
      });
      console.log(`   + Added 3 lifecycle records for vehicle ${v.passportId} (${v.manufacturer} ${v.model})`);
    }
  }

  // 2. Discover eligible records and assemble Merkle Batches
  console.log('\n--- 2. Assembling & Anchoring Real Merkle Batches on Smart Contract ---');
  const eligibleRecords = await batchService.getEligibleRecords({ limit: 50 });
  console.log(`ℹ️ Total eligible unbatched records found: ${eligibleRecords.length}`);

  if (eligibleRecords.length >= 2) {
    // Chunk into batches of 3 or 4 records
    const chunkSize = 3;
    for (let i = 0; i < eligibleRecords.length; i += chunkSize) {
      const chunk = eligibleRecords.slice(i, i + chunkSize);
      if (chunk.length < 2) continue; // Merkle tree needs at least 2 records

      try {
        const recordIds = chunk.map((r) => r.recordId);
        console.log(`📦 Creating Merkle Batch with ${recordIds.length} records...`);
        const batch = await batchService.createBatch({
          createdByUserId: adminId,
          recordIds,
          autoSubmit: true,
        });
        if (batch) {
          console.log(`   ✅ Confirmed Batch: ${batch.batchIdentifier}`);
          console.log(`      Merkle Root: ${batch.merkleRoot}`);
          console.log(`      Tx Hash: ${batch.transactionHash}`);
          console.log(`      Block #: ${batch.blockNumber} (Status: ${batch.status})`);
        }
      } catch (err: any) {
        console.log(`   ℹ️ Batch creation note: ${err.message}`);
      }
    }
  }

  // 3. Seed What-If Scenario Simulations for Vehicles
  console.log('\n--- 3. Seeding Digital Vehicle Twin What-If Scenario Simulations ---');
  const simVehicles = await prisma.vehicle.findMany({ take: 3 });

  for (const v of simVehicles) {
    try {
      console.log(`🔮 Simulating What-If Scenarios for ${v.passportId} (${v.manufacturer} ${v.model})...`);

      // 3.1 Maintenance Simulation
      await twinScenarioService.simulateScenario(v.id, adminId, {
        scenarioType: 'SCHEDULED_MAINTENANCE',
        inputs: {
          plannedMileage: 35000,
          serviceType: 'Major 30,000 km Scheduled Service & Fluid Flush',
          plannedDate: new Date(Date.now() + 15 * 86400000).toISOString(),
        },
      });
      console.log('   + SCHEDULED_MAINTENANCE simulation recorded');

      // 3.2 Battery Degradation Simulation
      await twinScenarioService.simulateScenario(v.id, adminId, {
        scenarioType: 'BATTERY_DEGRADATION',
        inputs: {
          fastDcPercentage: 80,
          annualMileageKm: 25000,
          projectedMonths: 24,
        },
      });
      console.log('   + BATTERY_DEGRADATION simulation recorded');

      // 3.3 Ownership Pre-check Simulation
      await twinScenarioService.simulateScenario(v.id, adminId, {
        scenarioType: 'OWNERSHIP_PRECHECK',
        inputs: {
          proposedOwnerName: 'Certified Pre-Owned Mobility Hub',
          targetPrice: 24500,
        },
      });
      console.log('   + OWNERSHIP_PRECHECK simulation recorded');
    } catch (err: any) {
      console.log(`   ℹ️ Simulation note for ${v.passportId}: ${err.message}`);
    }
  }

  // 4. Verify Final State
  console.log('\n--- 4. Verification Summary ---');
  const batchCount = await prisma.merkleBatch.count();
  const batchRecordsCount = await prisma.merkleBatchRecord.count();
  const scenarioCount = await prisma.twinScenarioRun.count();
  const totalAnchors = await prisma.blockchainRecord.count();
  const totalVehicles = await prisma.vehicle.count();

  console.log(`📊 Total Registered Vehicles: ${totalVehicles}`);
  console.log(`📊 Total Blockchain Anchors: ${totalAnchors}`);
  console.log(`📊 Total Confirmed Merkle Batches: ${batchCount}`);
  console.log(`📊 Total Merkle Batch Records: ${batchRecordsCount}`);
  console.log(`📊 Total Digital Twin Simulations: ${scenarioCount}`);
  console.log('\n✨ Simulation and blockchain data seeding complete!');
}

seedRichSimulationData()
  .catch((err) => {
    console.error('❌ Failed seeding simulation data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
