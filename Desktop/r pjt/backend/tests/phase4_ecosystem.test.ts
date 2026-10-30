import { prisma } from '../src/lib/prisma';

const API_BASE = 'http://localhost:5001/api';

async function runPhase4EcosystemTests() {
  console.log('================================================================');
  console.log('⚡ PHASE 4 TEST SUITE: INDUSTRY & EV ECOSYSTEM INTELLIGENCE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // PRE-FLIGHT CHECKS & TOKEN HELPERS
    // ------------------------------------------------------------------------
    console.log('--- PRE-FLIGHT CHECKS ---');
    const healthRes = await fetch(`${API_BASE}/health`).catch(() => null);
    assert(Boolean(healthRes && healthRes.ok), 'Backend server is running on http://localhost:5001');

    const v1 = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000001' },
      include: { currentOwner: true },
    });
    assert(Boolean(v1 && v1.fuelType === 'ELECTRIC'), 'Pre-requisite: Vehicle 1 (VP-000001) is seeded ELECTRIC vehicle');

    const v2 = await prisma.vehicle.findFirst({
      where: { passportId: 'VP-000002' },
      include: { currentOwner: true },
    });
    assert(Boolean(v2 && v2.fuelType === 'PETROL'), 'Pre-requisite: Vehicle 2 (VP-000002) is seeded ICE/PETROL vehicle');

    async function getUserToken(firebaseUid: string, email: string, name: string): Promise<string> {
      const res = await fetch(`${API_BASE}/auth/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: `dev-seed-token:${firebaseUid}:${email}:${name}`,
          email,
          name,
        }),
      });
      const data = await res.json();
      return data.data.token;
    }

    const tokenOwnerA = await getUserToken('seed-owner-a', 'owner.a@vehiclepassport.dev', 'Test Owner A (Alex Mercer)');
    const tokenOwnerB = await getUserToken('seed-owner-b', 'owner.b@vehiclepassport.dev', 'Test Owner B');
    const tokenManufacturer = await getUserToken('seed-manufacturer', 'manufacturer@vehiclepassport.dev', 'Test Manufacturer');
    const tokenGarage = await getUserToken('seed-garage', 'garage@vehiclepassport.dev', 'Test Garage');
    const tokenInsurance = await getUserToken('seed-insurance', 'insurance@vehiclepassport.dev', 'Test Insurance');
    const tokenAdmin = await getUserToken('seed-admin', 'admin@vehiclepassport.dev', 'Test Admin');

    // ------------------------------------------------------------------------
    // TEST 1: MANUFACTURER DIGITAL BIRTH CERTIFICATE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Manufacturer Digital Birth Certificate ---');

    // Clean up existing certificate if any to allow fresh creation test
    await prisma.manufacturerCertificate.deleteMany({
      where: { vehicleId: v1!.id },
    });

    // 1A. RBAC: Non-manufacturer cannot issue birth certificate
    const unauthCertRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/birth-certificate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        manufacturingPlant: 'Pune Assembly Plant 1',
        specifications: { driveTrain: 'AWD', motorPowerKw: 105 },
      }),
    });
    assert(unauthCertRes.status === 403, 'RBAC: Vehicle Owner cannot issue manufacturer birth certificate (403)');

    // 1B. Authorized manufacturer issues birth certificate
    const issueCertRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/birth-certificate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenManufacturer}`,
      },
      body: JSON.stringify({
        manufacturingPlant: 'Tata Motors Pune Car Plant, Assembly Line 4',
        specifications: {
          platform: 'Gen2 EV Architecture',
          permanentMagnetMotor: '105 kW Peak',
          transmission: 'Single Speed Reduction Gear',
          paintCode: 'DYG-2024',
        },
      }),
    });
    assert(issueCertRes.status === 201, 'Manufacturer successfully issues Birth Certificate (HTTP 201)');
    const issueCertData = await issueCertRes.json();
    assert(issueCertData.success === true, 'Birth certificate issuance returned success: true');
    assert(Boolean(issueCertData.data?.certificateNumber), `Issued certificate number: ${issueCertData.data?.certificateNumber}`);
    assert(Boolean(issueCertData.data?.recordHash), `Generated canonical certificate hash: ${issueCertData.data?.recordHash?.slice(0, 16)}...`);
    assert(issueCertData.data?.initialOdometer === 0, 'Initial manufacturing odometer is 0 km');

    // 1C. Prevent duplicate certificate issuance
    const dupCertRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/birth-certificate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenManufacturer}`,
      },
      body: JSON.stringify({
        manufacturingPlant: 'Another Plant',
      }),
    });
    assert(dupCertRes.status === 409, 'Duplicate certificate issuance rejected with 409 Conflict');

    // 1D. Retrieve Birth Certificate with verification status
    const getCertRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/birth-certificate`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(getCertRes.status === 200, 'Owner can retrieve vehicle birth certificate');
    const getCertData = await getCertRes.json();
    assert(getCertData.data?.certificateNumber === issueCertData.data.certificateNumber, 'Retrieved certificate matches issued record');
    assert(getCertData.data?.verificationStatus === 'VERIFIED', 'Birth certificate canonical hash verified on-chain');

    // ------------------------------------------------------------------------
    // TEST 2: EV BATTERY PASSPORT & LIFECYCLE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: EV Battery Passport & Lifecycle ---');

    // 2A. Rejection on Non-EV Vehicle (v2: Honda City PETROL)
    const iceBatteryRes = await fetch(`${API_BASE}/vehicles/${v2!.id}/battery-passport`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(iceBatteryRes.status === 200, 'Battery passport request on ICE vehicle returns HTTP 200');
    const iceBatteryData = await iceBatteryRes.json();
    assert(iceBatteryData.data?.isApplicable === false, 'Battery passport correctly marked NOT applicable for ICE vehicle');

    const iceCreateRes = await fetch(`${API_BASE}/vehicles/${v2!.id}/battery-passport`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenManufacturer}`,
      },
      body: JSON.stringify({
        batterySerial: 'BAT-ICE-INVALID',
        chemistry: 'LFP',
        nominalCapacityKwh: 40,
      }),
    });
    assert(iceCreateRes.status === 400, 'Battery passport creation on ICE vehicle rejected with 400 Bad Request');

    // Clean up existing battery passport for v1 if needed
    await prisma.batteryLifecycleEvent.deleteMany({
      where: { batteryPassport: { vehicleId: v1!.id } },
    });
    await prisma.batteryPassport.deleteMany({
      where: { vehicleId: v1!.id },
    });

    // 2B. Create Battery Passport on EV (v1)
    const createBatteryRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/battery-passport`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenManufacturer}`,
      },
      body: JSON.stringify({
        batterySerial: 'TATA-LFP-40.5-2024-00918',
        chemistry: 'LFP (Lithium Iron Phosphate)',
        nominalCapacityKwh: 40.5,
        currentCapacityKwh: 40.5,
        sohPercentage: 100.0,
        cycleCount: 0,
        manufactureDate: '2024-01-10T00:00:00Z',
        installationDate: '2024-01-20T00:00:00Z',
        warrantyExpiryDate: '2032-01-20T00:00:00Z',
      }),
    });
    assert(createBatteryRes.status === 201, 'EV Battery Passport created successfully (HTTP 201)');
    const createBatteryData = await createBatteryRes.json();
    assert(createBatteryData.data?.batterySerial === 'TATA-LFP-40.5-2024-00918', 'Battery serial recorded accurately');
    assert(createBatteryData.data?.nominalCapacityKwh === 40.5, 'Nominal capacity is 40.5 kWh');

    // 2C. Log Battery Lifecycle Events (Inspected by Garage)
    const logEventRes1 = await fetch(`${API_BASE}/vehicles/${v1!.id}/battery/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenGarage}`,
      },
      body: JSON.stringify({
        eventType: 'BATTERY_INSPECTED',
        capacityKwh: 40.1,
        sohPercentage: 99.0,
        cycleCount: 65,
        description: 'Annual EV high-voltage insulation and capacity diagnostic check passed',
      }),
    });
    assert(logEventRes1.status === 201, 'Garage logged BATTERY_INSPECTED event (HTTP 201)');
    const logEventData1 = await logEventRes1.json();
    assert(logEventData1.data?.eventType === 'BATTERY_INSPECTED', 'Lifecycle event type recorded');
    assert(Boolean(logEventData1.data?.recordHash), 'Canonical hash generated for battery event');

    // Log second event with minor service
    const logEventRes2 = await fetch(`${API_BASE}/vehicles/${v1!.id}/battery/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenGarage}`,
      },
      body: JSON.stringify({
        eventType: 'BATTERY_SERVICED',
        capacityKwh: 39.5,
        sohPercentage: 97.5,
        cycleCount: 180,
        description: 'Battery coolant flushed and BMS calibration performed',
      }),
    });
    assert(logEventRes2.status === 201, 'Garage logged BATTERY_SERVICED event (HTTP 201)');

    // 2D. Fetch Complete Battery Passport with Intelligence
    const getBatteryRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/battery-passport`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(getBatteryRes.status === 200, 'Owner can fetch EV Battery Passport (HTTP 200)');
    const getBatteryData = await getBatteryRes.json();
    assert(getBatteryData.data?.isApplicable === true, 'Passport is applicable for EV');
    assert(getBatteryData.data?.nominalCapacityKwh === 40.5, 'Nominal capacity returned');
    assert(getBatteryData.data?.capacityRetainedPercentage > 95, 'Capacity retained is > 95%');
    assert(getBatteryData.data?.events.length >= 3, 'Includes initial installation + 2 logged events');
    assert(getBatteryData.data?.evidenceClassification === 'VERIFIED', 'State of health labeled VERIFIED');

    // ------------------------------------------------------------------------
    // TEST 3: INSURANCE INTELLIGENCE & ACCIDENT LINKAGE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Insurance Intelligence & Accident Linkage ---');

    // 3A. Fetch Insurance Intelligence
    const insIntelRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/insurance-intelligence`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(insIntelRes.status === 200, 'Owner can fetch Insurance Intelligence (HTTP 200)');
    const insIntelData = await insIntelRes.json();
    assert(insIntelData.success === true, 'Insurance intelligence returned success: true');
    assert(insIntelData.data?.activePolicy !== null, 'Active insurance policy detected for v1');
    assert(Array.isArray(insIntelData.data?.riskObservations), 'Risk observations array provided');

    // 3B. File Insurance Claim with Accident Linkage by Insurance Provider
    // Find existing accident on v1
    const v1Accident = await prisma.accidentRecord.findFirst({
      where: { vehicleId: v1!.id },
    });
    assert(Boolean(v1Accident), 'Pre-requisite: v1 has an existing accident record');

    // Non-insurance provider cannot file claim
    const unauthClaimRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/insurance/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        claimNumber: 'CLM-TEST-UNAUTH',
        claimType: 'COLLISION',
        amountClaimed: 25000,
      }),
    });
    assert(unauthClaimRes.status === 403, 'RBAC: Vehicle Owner cannot file insurance claim (403)');

    // Authorized Insurance Provider files claim linked to accident
    const fileClaimRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/insurance/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenInsurance}`,
      },
      body: JSON.stringify({
        claimNumber: `CLM-PH4-${Date.now()}`,
        accidentRecordId: v1Accident!.id,
        description: 'Rear bumper cover replacement and sensor recalibration under zero-dep policy',
        claimAmount: 24500,
        approvedAmount: 23200,
        claimStatus: 'SETTLED',
        claimDate: v1Accident!.accidentDate.toISOString(),
        payoutDate: new Date().toISOString(),
      }),
    });
    assert(fileClaimRes.status === 201, 'Insurance Provider filed and linked claim (HTTP 201)');
    const fileClaimData = await fileClaimRes.json();
    assert(fileClaimData.data?.accidentRecordId === v1Accident!.id, 'Claim successfully linked to accident ID');
    assert(Boolean(fileClaimData.data?.recordHash), 'Canonical claim hash generated');

    // 3C. Re-fetch Insurance Intelligence and verify correlation
    const reInsRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/insurance-intelligence`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    const reInsData = await reInsRes.json();
    assert(reInsData.data?.totalClaimsCount >= 1, 'Claim count updated in intelligence report');
    assert(reInsData.data?.accidentCorrelation?.linkedToClaimsCount >= 1, 'Accident linked to claim confirmed');

    // ------------------------------------------------------------------------
    // TEST 4: GARAGE VERIFICATION INTELLIGENCE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Garage Verification Intelligence ---');

    // 4A. Garage Profile Retrieval (Lazy initialization)
    const garageUser = await prisma.user.findFirst({
      where: { firebaseUid: 'seed-garage' },
    });
    assert(Boolean(garageUser), 'Pre-requisite: seed-garage user exists');

    const getGarageRes = await fetch(`${API_BASE}/garages/${garageUser!.id}/profile`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(getGarageRes.status === 200, 'Public/Owner can view garage profile');
    const getGarageData = await getGarageRes.json();
    assert(getGarageData.data?.garageName.includes('Apex Certified'), `Garage business name loaded: ${getGarageData.data?.garageName}`);
    assert(getGarageData.data?.verifiedServicesCount >= 2, 'Factual services count reflected');
    assert(typeof getGarageData.data?.trustIndex === 'number', 'Deterministic Trust Index computed');

    // 4B. Garage updates own profile (certifications & equipment)
    const updateGarageRes = await fetch(`${API_BASE}/garages/${garageUser!.id}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenGarage}`,
      },
      body: JSON.stringify({
        businessName: 'Apex Certified High-Voltage & Precision Works',
        contactPhone: '+91 98200 12345',
        address: '42 Industrial Tech Park, Pune',
        licenseNumber: 'MH-PUN-GAR-2024-889',
        accreditations: 'ASE Master Certified, TÜV Rheinland High Voltage L3, Bosch EV Specialist',
        specialties: 'EV Powertrain Diagnostics, Scheduled Maintenance, Brake Services',
      }),
    });
    assert(updateGarageRes.status === 200, 'Garage successfully updated own verified profile');

    // 4C. Vehicle Servicing Garages Intelligence
    const vehicleGarageRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/garage-intelligence`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(vehicleGarageRes.status === 200, 'Vehicle garage intelligence returns HTTP 200');
    const vehicleGarageData = await vehicleGarageRes.json();
    assert(vehicleGarageData.data?.servicingGaragesCount >= 1, 'Vehicle servicing garages found');
    assert(vehicleGarageData.data?.networkSummary[0]?.servicesOnThisVehicle >= 1, 'Servicing garage has verified records');

    // ------------------------------------------------------------------------
    // TEST 5: CONSOLIDATED VEHICLE ECOSYSTEM OVERVIEW & TIMELINE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Consolidated Vehicle Ecosystem Overview & Timeline ---');

    // 5A. Full Ecosystem Overview
    const ecoRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/ecosystem`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(ecoRes.status === 200, 'Ecosystem overview returns HTTP 200');
    const ecoData = await ecoRes.json();
    assert(ecoData.data?.passportId === 'VP-000001', 'Passport ID matches');
    assert(ecoData.data?.manufacturerCertificate !== null, 'Manufacturer certificate is present');
    assert(ecoData.data?.batteryPassport !== null, 'Battery passport is present');
    assert(ecoData.data?.insuranceIntelligence?.activePolicy !== null, 'Has active insurance policy');
    assert(ecoData.data?.garageIntelligence?.servicingGaragesCount >= 1, 'Garage network verified');

    // 5B. Chronological Ecosystem Timeline
    const ecoTimelineRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/ecosystem/timeline`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert(ecoTimelineRes.status === 200, 'Ecosystem timeline returns HTTP 200');
    const ecoTimelineData = await ecoTimelineRes.json();
    assert(Array.isArray(ecoTimelineData.data?.timeline), 'Timeline is an array');
    assert(ecoTimelineData.data?.count >= 6, `Timeline contains all cross-ecosystem events (count: ${ecoTimelineData.data?.count})`);

    const categories = ecoTimelineData.data?.timeline.map((item: any) => item.category);
    assert(categories.includes('MANUFACTURING'), 'Ecosystem timeline contains MANUFACTURING');
    assert(categories.includes('BATTERY'), 'Ecosystem timeline contains BATTERY');
    assert(categories.includes('INSURANCE'), 'Ecosystem timeline contains INSURANCE');
    assert(categories.includes('GARAGE_SERVICE'), 'Ecosystem timeline contains GARAGE_SERVICE');

    // Verify chronological sorting (ascending)
    let isChronological = true;
    for (let i = 1; i < ecoTimelineData.data?.timeline.length; i++) {
      const prev = new Date(ecoTimelineData.data.timeline[i - 1].date).getTime();
      const curr = new Date(ecoTimelineData.data.timeline[i].date).getTime();
      if (prev > curr) {
        isChronological = false;
        break;
      }
    }
    assert(isChronological, 'Ecosystem timeline events are strictly chronological (oldest to newest)');

    // ------------------------------------------------------------------------
    // TEST 6: PUBLIC SANITIZED ECOSYSTEM SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Public Sanitized Ecosystem Summary ---');

    const pubRes = await fetch(`${API_BASE}/public/passport/VP-000001/ecosystem-summary`);
    assert(pubRes.status === 200, 'Public ecosystem summary endpoint returns HTTP 200 without authentication');
    const pubData = await pubRes.json();

    assert(pubData.data?.passportId === 'VP-000001', 'Public passport ID matches');
    assert(pubData.data?.vinMasked?.startsWith('MAT***'), `VIN is properly masked: ${pubData.data?.vinMasked}`);
    assert(pubData.data?.manufacturerCertificate?.isIssued === true, 'Public sees verified birth certificate status');
    assert(pubData.data?.batteryPassport?.batterySerialMasked?.startsWith('TATA***'), `Battery serial is properly masked: ${pubData.data?.batteryPassport?.batterySerialMasked}`);
    assert(pubData.data?.batteryPassport?.chemistry === 'LFP (Lithium Iron Phosphate)', 'Public sees chemistry');
    assert(pubData.data?.batteryPassport?.currentHealthPct > 0, 'Public sees health %');
    assert(pubData.data?.insurance?.activePolicyPresent === true, 'Public sees sanitized insurance presence');
    assert(pubData.data?.insurance?.settledClaimsCount >= 1, 'Public sees aggregate claim count');
    assert(pubData.data?.ownerName === undefined, 'Security: Owner name is strictly omitted from public response');
    assert(pubData.data?.insurance?.policyNumber === undefined, 'Security: Policy number is strictly omitted');
    assert(pubData.data?.insurance?.claimAmount === undefined, 'Security: Claim monetary amount is strictly omitted');

    // ------------------------------------------------------------------------
    // TEST 7: RBAC & CROSS-USER ACCESS CONTROL
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: RBAC & Cross-User Security ---');

    // Owner B should NOT be able to view private ecosystem data for Owner A's vehicle
    const forbiddenRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/ecosystem`, {
      headers: { Authorization: `Bearer ${tokenOwnerB}` },
    });
    assert(forbiddenRes.status === 403, 'Cross-user check: Owner B forbidden from accessing Owner A vehicle ecosystem (403)');

    // Admin CAN access Owner A's vehicle ecosystem
    const adminRes = await fetch(`${API_BASE}/vehicles/${v1!.id}/ecosystem`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(adminRes.status === 200, 'Admin can access vehicle ecosystem (200)');

  } catch (error: any) {
    console.error('❌ Unexpected test suite failure:', error);
    failed++;
  } finally {
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhase4EcosystemTests();
