import { prisma } from '../src/lib/prisma';

const API_BASE = 'http://localhost:5001/api';

async function runPhase2Tests() {
  console.log('🧪 Starting Phase 2 Vehicle Passport Management Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // SETUP: Get sessions for Test Owner A, Test Owner B, and Uninitialized User
    // ----------------------------------------------------
    const loginResA = await fetch(`${API_BASE}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner.a@vehiclepassport.dev' }),
    });
    const tokenOwnerA = (await loginResA.json()).data.token;

    const loginResB = await fetch(`${API_BASE}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner.b@vehiclepassport.dev' }),
    });
    const tokenOwnerB = (await loginResB.json()).data.token;

    const loginResNew = await fetch(`${API_BASE}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@vehiclepassport.dev' }),
    });
    const tokenUninit = (await loginResNew.json()).data.token;

    // ----------------------------------------------------
    // TEST 1: User Initialization Rule Enforcement
    // ----------------------------------------------------
    console.log('--- TEST 1: User Initialization Rule for Vehicle Creation ---');
    const blockedRes = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenUninit}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Hyundai',
        model: 'Creta',
        manufacturingYear: 2024,
        fuelType: 'PETROL',
        vin: 'MAL712345CRET0099',
        registrationNumber: 'DL01CR0099',
      }),
    });
    const blockedData = await blockedRes.json();
    assert(blockedRes.status === 403, 'Uninitialized user blocked with 403 Forbidden');
    assert(
      blockedData.error === 'Initialize your Vehicle Passport before adding a vehicle.',
      'Clear error message returned for uninitialized user'
    );

    // ----------------------------------------------------
    // TEST 2: Multiple Vehicles per User (1 User -> N Vehicles)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Multi-Vehicle Query for Single User ---');
    const myVehiclesRes = await fetch(`${API_BASE}/vehicles`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerA}` },
    });
    const myVehiclesData = await myVehiclesRes.json();
    assert(myVehiclesRes.status === 200, 'GET /api/vehicles returns 200');
    assert(
      Array.isArray(myVehiclesData.data?.vehicles) && myVehiclesData.data.vehicles.length >= 3,
      'Test Owner A owns at least 3 vehicles (Tata Nexon, Honda City, BMW X1)'
    );

    const models = myVehiclesData.data.vehicles.map((v: any) => v.model);
    assert(models.includes('Nexon EV'), 'Vehicles includes Tata Nexon EV');
    assert(models.includes('City'), 'Vehicles includes Honda City');
    assert(models.includes('X1'), 'Vehicles includes BMW X1');

    // ----------------------------------------------------
    // TEST 3: Vehicle Creation & Auto Owner Assignment
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Vehicle Creation & Ownership Assignment ---');
    const uniqueTestVin = `TEST${Date.now()}XYZ`.slice(0, 17);
    const uniqueTestReg = `DL${Date.now()}`.slice(0, 10);

    const createRes = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Mahindra',
        model: 'XUV700',
        variant: 'AX7 Luxury',
        manufacturingYear: 2024,
        fuelType: 'DIESEL',
        color: 'Midnight Black',
        engineNumber: 'MH223344X',
        vin: uniqueTestVin,
        registrationNumber: uniqueTestReg,
      }),
    });
    const createData = await createRes.json();

    assert(createRes.status === 201, 'POST /api/vehicles returns 201 Created');
    assert(createData.data?.vehicle?.passportId?.startsWith('VP-'), 'Generated valid Passport ID (e.g. VP-XXXXXX)');
    assert(createData.data?.vehicle?.vin === uniqueTestVin, 'VIN normalized and stored correctly');
    assert(createData.data?.vehicle?.registrationNumber === uniqueTestReg, 'Registration number normalized');

    const createdVehicleId = createData.data?.vehicle?.id;

    // Verify in DB that currentOwnerId matches Owner A
    const dbVehicle = await prisma.vehicle.findUnique({
      where: { id: createdVehicleId },
      include: { currentOwner: true },
    });
    assert(
      dbVehicle?.currentOwner?.email === 'owner.a@vehiclepassport.dev',
      'currentOwnerId was automatically assigned from authenticated user session'
    );

    // ----------------------------------------------------
    // TEST 4: Get Vehicle Passport By ID
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Get Vehicle Passport by ID ---');
    const getRes = await fetch(`${API_BASE}/vehicles/${createdVehicleId}`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerA}` },
    });
    const getData = await getRes.json();
    assert(getRes.status === 200, 'GET /api/vehicles/:id returns 200');
    assert(getData.data?.vehicle?.model === 'XUV700', 'Vehicle specifications match');
    assert(getData.data?.vehicle?.currentOwner?.name?.includes('Alex Mercer'), 'Current owner details included');

    // ----------------------------------------------------
    // TEST 5: Duplicate VIN Validation
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Duplicate VIN Validation ---');
    const dupVinRes = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Mahindra',
        model: 'XUV700 Duplicate',
        manufacturingYear: 2024,
        fuelType: 'DIESEL',
        vin: uniqueTestVin, // Reusing existing VIN
        registrationNumber: `REG${Date.now()}`.slice(0, 10),
      }),
    });
    const dupVinData = await dupVinRes.json();
    assert(dupVinRes.status === 409, 'Duplicate VIN returns 409 Conflict');
    assert(dupVinData.error === 'Vehicle with this VIN already exists.', 'Correct duplicate VIN error message');

    // ----------------------------------------------------
    // TEST 6: Duplicate Registration Number Validation
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Duplicate Registration Number Validation ---');
    const validTestVin2 = `MAT${Date.now()}XYZ`.slice(0, 17);
    const dupRegRes = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Tata',
        model: 'Harrier',
        manufacturingYear: 2024,
        fuelType: 'DIESEL',
        vin: validTestVin2,
        registrationNumber: uniqueTestReg, // Reusing existing Reg
      }),
    });
    const dupRegData = await dupRegRes.json();
    assert(dupRegRes.status === 409, 'Duplicate Registration Number returns 409 Conflict');
    assert(
      dupRegData.error === 'Vehicle with this Registration Number already exists.',
      'Correct duplicate registration error message'
    );

    // ----------------------------------------------------
    // TEST 7: VIN Format Validation (Length & Disallowed characters)
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Invalid VIN Format Validation ---');
    const shortVinRes = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        manufacturer: 'Tata',
        model: 'Punch',
        manufacturingYear: 2024,
        fuelType: 'PETROL',
        vin: 'SHORTVIN123', // Only 11 chars
        registrationNumber: `REG${Date.now()}`.slice(0, 10),
      }),
    });
    assert(shortVinRes.status === 400, 'Short VIN (<17 chars) rejected with 400 Bad Request');

    // ----------------------------------------------------
    // TEST 8: Vehicle Metadata Editing & Ownership Guard
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Vehicle Metadata Update & Authorization ---');
    // Owner A updates color
    const updateRes = await fetch(`${API_BASE}/vehicles/${createdVehicleId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokenOwnerA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ color: 'Everest White', variant: 'AX7 L AWD' }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'Owner A updates vehicle metadata successfully');
    assert(updateData.data?.vehicle?.color === 'Everest White', 'Color updated');

    // Owner B tries to update Owner A's vehicle
    const unauthorizedUpdateRes = await fetch(`${API_BASE}/vehicles/${createdVehicleId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokenOwnerB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ color: 'Unauthorized Red' }),
    });
    assert(unauthorizedUpdateRes.status === 403, 'Unauthorized user blocked from updating with 403 Forbidden');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    await prisma.vehicle.delete({ where: { id: createdVehicleId } });
    console.log(`\n🧹 Cleaned up temporary test vehicle: ${createdVehicleId}`);

    console.log(`\n========================================`);
    console.log(`PHASE 2 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test run failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase2Tests();
