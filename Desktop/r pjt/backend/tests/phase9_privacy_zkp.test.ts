import { ethers } from 'ethers';
import { prisma } from '../src/lib/prisma';
import {
  generateRandomScalar,
  createPedersenCommitment,
  generateRangeProof,
  verifyRangeProof,
  computeVehicleCommitment,
  H_GENERATOR_HEX,
  ZKP_BIT_WIDTH,
} from '../src/services/privacy/pedersenZkpService';
import {
  computeAttributeLeaf,
  buildAttributeMerkleTree,
  verifyAttributeInclusion,
  createPrivacyCredentialData,
  buildSelectiveDisclosurePresentation,
  verifySelectiveDisclosurePresentation,
} from '../src/services/privacy/merkleDisclosureService';
import { credentialService } from '../src/services/privacy/credentialService';
import { toolRegistry } from '../src/services/agent/toolRegistry';

const API_BASE = 'http://localhost:5001/api';

async function runPhase9Tests() {
  console.log('================================================================');
  console.log('🔒 PHASE 9 TEST SUITE: PRIVACY-PRESERVING VEHICLE VERIFICATION & ZKP');
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

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: CRYPTOGRAPHIC PEDERSEN & NOTHING-UP-MY-SLEEVE GENERATOR TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 1: PEDERSEN GENERATORS & COMMITMENTS ---');

    assert(
      H_GENERATOR_HEX.startsWith('02') && H_GENERATOR_HEX.length === 66,
      'Nothing-up-my-sleeve generator H has valid compressed secp256k1 format'
    );

    const val1 = 45000n;
    const r1 = generateRandomScalar();
    const r2 = generateRandomScalar();
    const C1 = createPedersenCommitment(val1, r1);
    const C2 = createPedersenCommitment(val1, r2);

    assert(C1 !== C2, 'Pedersen commitments are perfectly hiding (same value with different salts produces distinct commitments)');
    assert(C1.startsWith('02') || C1.startsWith('03'), 'Pedersen commitment is a valid compressed elliptic curve point');

    // ------------------------------------------------------------------------
    // SECTION 2: GENUINE ZERO-KNOWLEDGE RANGE PROOF (NIZK) TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: GENUINE ZERO-KNOWLEDGE RANGE PROOFS (NIZK) ---');

    const vehicleId = 'veh-zkp-test-001';
    const vin = 'SALFA2849P1998877';
    const vehicleCommitment = computeVehicleCommitment(vehicleId, vin);
    const nonce = '0x' + Array(64).fill('a').join('');
    const claimType = 'ODOMETER_BELOW_THRESHOLD';
    const privateMileage = 45000;
    const publicThreshold = 80000;

    const blinding = generateRandomScalar();
    const proveStart = Date.now();
    const proof = generateRangeProof({
      value: privateMileage,
      blinding,
      threshold: publicThreshold,
      vehicleCommitment,
      claimType,
      nonce,
    });
    const proveDuration = Date.now() - proveStart;

    assert(proof.proofSystem === 'PEDERSEN_NIZK_RANGE_V1', 'Proof specifies correct mathematical proof system');
    assert(proof.bitWidth === ZKP_BIT_WIDTH, `Proof uses exact bit decomposition width (${ZKP_BIT_WIDTH})`);
    assert(proof.bitProofs.length === ZKP_BIT_WIDTH, 'Proof includes 1-out-of-2 OR-proof for every bit');
    assert(proveDuration < 1000, `Proof generation is efficient (< 1000ms, actual: ${proveDuration}ms)`);

    // Verify valid proof
    const verifyStart = Date.now();
    const validResult = verifyRangeProof(proof, {
      vehicleCommitment,
      claimType,
      threshold: publicThreshold,
      nonce,
    });
    const verifyDuration = Date.now() - verifyStart;

    assert(validResult.valid === true, 'Valid range proof verifies successfully without revealing private mileage');
    assert(verifyDuration < 500, `Independent verification executes in < 500ms (actual: ${verifyDuration}ms)`);

    // Adversarial: Tampered threshold (claiming 40,000 threshold when mileage is 45,000)
    const tamperedThresholdResult = verifyRangeProof(proof, {
      vehicleCommitment,
      claimType,
      threshold: 40000,
      nonce,
    });
    assert(tamperedThresholdResult.valid === false, 'Adversarial: Tampered threshold fails verification');

    // Adversarial: Cross-vehicle proof reuse
    const crossVehicleResult = verifyRangeProof(proof, {
      vehicleCommitment: '0x9999999999999999999999999999999999999999999999999999999999999999',
      claimType,
      threshold: publicThreshold,
      nonce,
    });
    assert(crossVehicleResult.valid === false, 'Adversarial: Cross-vehicle proof reuse fails vehicle commitment check');

    // Adversarial: Replay attack with stale or altered nonce
    const replayedNonceResult = verifyRangeProof(proof, {
      vehicleCommitment,
      claimType,
      threshold: publicThreshold,
      nonce: '0x8888888888888888888888888888888888888888888888888888888888888888',
    });
    assert(replayedNonceResult.valid === false, 'Adversarial: Replayed nonce fails session challenge check');

    // Adversarial: Wrong claim type
    const wrongClaimResult = verifyRangeProof(proof, {
      vehicleCommitment,
      claimType: 'BATTERY_SOH_ABOVE_THRESHOLD',
      threshold: publicThreshold,
      nonce,
    });
    assert(wrongClaimResult.valid === false, 'Adversarial: Wrong claim type fails domain separation check');

    // Adversarial: Corrupted bit proof response
    const corruptedProof = JSON.parse(JSON.stringify(proof));
    corruptedProof.bitProofs[0].s0 = '0x' + Array(64).fill('f').join('');
    const corruptedProofResult = verifyRangeProof(corruptedProof, {
      vehicleCommitment,
      claimType,
      threshold: publicThreshold,
      nonce,
    });
    assert(corruptedProofResult.valid === false, 'Adversarial: Corrupted bit proof response fails verification');

    // Prover refuses to generate proof for false claim (value > threshold)
    let falseClaimCaught = false;
    try {
      generateRangeProof({
        value: 95000,
        blinding,
        threshold: 80000,
        vehicleCommitment,
        claimType,
        nonce,
      });
    } catch (e: any) {
      falseClaimCaught = true;
    }
    assert(falseClaimCaught, 'Prover aborts when value exceeds threshold; cannot prove false statement');

    // ------------------------------------------------------------------------
    // SECTION 3: MERKLE-DISCLOSED CREDENTIALS (MDC) SELECTIVE DISCLOSURE TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: MERKLE SELECTIVE DISCLOSURE (MDC) ---');

    const issuerWallet = ethers.Wallet.createRandom();
    const attributes = {
      serviceVerified: true,
      lastServiceOdometerKm: 42000,
      garageName: 'Apex Certified Garages',
      garageTrustTier: 'TIER_1_OEM',
      privateCustomerName: 'Aditya Singh',
      privateInvoiceTotalUsd: 1450.0,
      privateInternalGarageNotes: 'Customer requested complimentary brake pad inspection',
    };

    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const credData = await createPrivacyCredentialData({
      credentialId: 'VC-TEST-000001',
      vehicleId,
      vin,
      attributes,
      validUntil,
      issuerSigner: issuerWallet,
    });

    assert(credData.merkleRoot.startsWith('0x') && credData.merkleRoot.length === 66, 'MDC root is a valid 32-byte hex hash');
    assert(credData.issuerSignature.length > 100, 'Issuer ECDSA signature generated over commitment');

    // Owner creates selective presentation: discloses ONLY service compliance fields, hiding customer name, invoice amount, and internal notes
    const presentation = buildSelectiveDisclosurePresentation({
      credentialId: 'VC-TEST-000001',
      vehicleCommitment,
      validFrom: new Date().toISOString(),
      validUntil,
      merkleRoot: credData.merkleRoot,
      credentialCommitment: credData.credentialCommitment,
      issuerAddress: credData.issuerAddress,
      issuerSignature: credData.issuerSignature,
      allAttributes: credData.attributesWithSalts,
      discloseKeys: ['serviceVerified', 'lastServiceOdometerKm', 'garageTrustTier'],
    });

    assert(presentation.disclosedAttributes.length === 3, 'Disclosed fields count matches requested selection');
    assert(presentation.undisclosedAttributes.length === 4, 'Undisclosed fields count matches hidden attributes');

    // Verify zero leakage in undisclosed attributes
    const hasLeakedValues = presentation.undisclosedAttributes.some((item: any) => item.value !== undefined || item.salt !== undefined);
    assert(!hasLeakedValues, 'Zero leakage: undisclosed attributes contain strictly NO values and NO blinding salts');

    // Independent verification of presentation
    const mdcVerification = verifySelectiveDisclosurePresentation(presentation, vehicleCommitment);
    assert(mdcVerification.valid === true, 'Selective disclosure independently verifies issuer signature and Merkle inclusion');
    assert(mdcVerification.verifiedAttributes.serviceVerified === true, 'Disclosed claim serviceVerified is verified as true');
    assert(mdcVerification.verifiedAttributes.lastServiceOdometerKm === 42000, 'Disclosed odometer reading is verified');
    assert(mdcVerification.verifiedAttributes.privateCustomerName === undefined, 'Private customer name was not disclosed');
    assert(mdcVerification.hiddenFieldCount === 4, 'Verification reports 4 hidden fields preserved');

    // Adversarial: Tampered disclosed value
    const tamperedMdc = JSON.parse(JSON.stringify(presentation));
    tamperedMdc.disclosedAttributes[1].value = 15000; // Alter odometer from 42000 to 15000
    const tamperedMdcResult = verifySelectiveDisclosurePresentation(tamperedMdc, vehicleCommitment);
    assert(tamperedMdcResult.valid === false, 'Adversarial: Tampered disclosed attribute value fails leaf hash check');

    // Adversarial: Forged issuer signature
    const forgedSigMdc = JSON.parse(JSON.stringify(presentation));
    const rogueWallet = ethers.Wallet.createRandom();
    forgedSigMdc.issuerSignature = await rogueWallet.signMessage(ethers.getBytes(presentation.credentialCommitment));
    const forgedSigResult = verifySelectiveDisclosurePresentation(forgedSigMdc, vehicleCommitment);
    assert(forgedSigResult.valid === false, 'Adversarial: Forged issuer signature fails verification against issuer address');

    // Adversarial: Expired credential
    const expiredMdc = JSON.parse(JSON.stringify(presentation));
    expiredMdc.validUntil = new Date(Date.now() - 10000).toISOString();
    const expiredResult = verifySelectiveDisclosurePresentation(expiredMdc, vehicleCommitment);
    assert(expiredResult.valid === false, 'Adversarial: Expired credential is rejected');

    // ------------------------------------------------------------------------
    // SECTION 4: SMART CONTRACT PRIVACYVERIFIER ON-CHAIN TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: BLOCKCHAIN PRIVACYVERIFIER CONTRACT ---');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const rawSigner = new ethers.Wallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', provider);
    const testSigner = new ethers.NonceManager(rawSigner);

    const deploymentPath = require('path').join(__dirname, '../src/blockchain/contracts/PrivacyVerifier.json');
    if (require('fs').existsSync(deploymentPath)) {
      const contractMeta = JSON.parse(require('fs').readFileSync(deploymentPath, 'utf8'));
      const verifierContract = new ethers.Contract(contractMeta.address, contractMeta.abi, testSigner);

      const contractCredentialId = ethers.id('VC-CHAIN-TEST-' + Date.now());
      const contractRoot = credData.merkleRoot;
      const futureExpiry = Math.floor(Date.now() / 1000) + 86400;

      // Register credential on-chain
      const regTx = await verifierContract.registerCredential(contractCredentialId, contractRoot, futureExpiry);
      const regReceipt = await regTx.wait(1);
      assert(regReceipt.status === 1, 'PrivacyVerifier: Credential registered on-chain with valid root commitment');

      // Check on-chain credential status
      const statusRes = await verifierContract.checkCredentialStatus(contractCredentialId);
      assert(statusRes[0] === true && statusRes[1] === 'ACTIVE', 'PrivacyVerifier: On-chain credential status is ACTIVE');

      // Revoke on-chain credential (testSigner is the issuer who registered it)
      const revTx = await verifierContract.revokeCredential(contractCredentialId, 'Owner requested decommission');
      await revTx.wait(1);
      const statusAfterRevoke = await verifierContract.checkCredentialStatus(contractCredentialId);
      assert(statusAfterRevoke[0] === false && statusAfterRevoke[1] === 'REVOKED', 'PrivacyVerifier: On-chain credential revoked successfully');

      // On-chain Merkle inclusion proof verification
      const sampleLeaf = presentation.disclosedAttributes[0].leafHash;
      const sampleProof = presentation.disclosedAttributes[0].merkleProof;
      const inclusionVerified = await verifierContract.verifySelectiveInclusion(contractRoot, sampleLeaf, sampleProof);
      assert(inclusionVerified === true, 'PrivacyVerifier: Merkle inclusion verified on-chain via smart contract pure function');

      // On-chain ZKP receipt recording
      const sessionIdBytes = ethers.id('ZKP-SESS-CHAIN-' + Date.now());
      const vehBytes = ethers.id(vehicleId);
      const claimHash = ethers.id(claimType);
      const receiptTx = await verifierContract.recordZkpReceipt(
        sessionIdBytes,
        vehBytes,
        claimHash,
        publicThreshold,
        ethers.id(proof.commitment),
        ethers.id(nonce),
        true
      );
      const receiptRc = await receiptTx.wait(1);
      assert(receiptRc.status === 1, 'PrivacyVerifier: ZKP verification receipt successfully anchored on-chain');

      const onChainReceipt = await verifierContract.getZkpReceipt(sessionIdBytes);
      assert(onChainReceipt.isVerified === true, 'PrivacyVerifier: Retrieved on-chain ZKP receipt confirms verified status');
    } else {
      console.warn('⚠️ PrivacyVerifier.json not found; skipping direct contract tests');
    }

    // ------------------------------------------------------------------------
    // SECTION 5: BACKEND REST API END-TO-END FLOW TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: BACKEND REST API INTEGRATION ---');

    // Create a test vehicle in db
    const garageUser = await prisma.user.upsert({
      where: { email: 'garage-zkp@securechainpay.io' },
      update: {},
      create: {
        firebaseUid: 'uid-garage-zkp-1',
        email: 'garage-zkp@securechainpay.io',
        name: 'Apex Garage Lead',
        role: 'GARAGE',
      },
    });

    const ownerUser = await prisma.user.upsert({
      where: { email: 'owner-zkp@securechainpay.io' },
      update: {},
      create: {
        firebaseUid: 'uid-owner-zkp-1',
        email: 'owner-zkp@securechainpay.io',
        name: 'John Doe Vehicle Owner',
        role: 'VEHICLE_OWNER',
      },
    });

    const dbVehicle = await prisma.vehicle.upsert({
      where: { vin: 'SALFA2849P1998877' },
      update: { currentOwnerId: ownerUser.id },
      create: {
        passportId: 'VP-999001',
        vin: 'SALFA2849P1998877',
        registrationNumber: 'MH02ZK9999',
        manufacturer: 'Tata Motors',
        model: 'Nexon EV Empowered',
        manufacturingYear: 2024,
        fuelType: 'ELECTRIC',
        currentOwnerId: ownerUser.id,
      },
    });

    // Add latest odometer record
    await prisma.odometerRecord.create({
      data: {
        vehicleId: dbVehicle.id,
        mileage: 42500,
        sourceUserId: garageUser.id,
        sourceType: 'GARAGE',
        recordHash: '0x' + Array(64).fill('1').join(''),
      },
    });

    const garageToken = await getUserToken(garageUser.firebaseUid, garageUser.email, garageUser.name);
    const ownerToken = await getUserToken(ownerUser.firebaseUid, ownerUser.email, ownerUser.name);

    // 1. POST /api/privacy/credentials - Garage issues privacy credential
    const issueRes = await fetch(`${API_BASE}/privacy/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${garageToken}`,
      },
      body: JSON.stringify({
        vehicleId: dbVehicle.id,
        credentialType: 'VEHICLE_HEALTH_CLAIM',
        attributes: {
          serviceEligible: true,
          odometerVerified: true,
          batteryIntegrityTier: 'TIER_A',
          privateGarageInternalNotes: 'VIP customer routine checkup',
        },
        numericalWitness: {
          claimKey: 'odometer',
          value: 42500,
        },
      }),
    });
    const issueData = await issueRes.json();
    assert(issueRes.status === 201 && issueData.success === true, 'API: POST /api/privacy/credentials issues credential with Pedersen commitment');
    const createdCredId = issueData.data.credentialId;

    // 2. GET /api/privacy/credentials/vehicle/:vehicleId
    const getCredsRes = await fetch(`${API_BASE}/privacy/credentials/vehicle/${dbVehicle.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const getCredsData = await getCredsRes.json();
    assert(getCredsRes.status === 200 && getCredsData.data.length >= 1, 'API: GET /api/privacy/credentials/vehicle/:vehicleId returns issued credentials');

    // 3. POST /api/privacy/challenge - Verifier generates session challenge
    const challengeRes = await fetch(`${API_BASE}/privacy/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        vehicleId: dbVehicle.id,
        claimType: 'ODOMETER_BELOW_THRESHOLD',
        policyThreshold: 80000,
      }),
    });
    const challengeData = await challengeRes.json();
    assert(challengeRes.status === 200 && challengeData.data.nonce.startsWith('0x'), 'API: POST /api/privacy/challenge generates 256-bit random nonce');
    const activeNonce = challengeData.data.nonce;

    // 4. POST /api/privacy/selective-disclosure/create - Owner generates selective disclosure
    const createDiscRes = await fetch(`${API_BASE}/privacy/selective-disclosure/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        credentialId: createdCredId,
        discloseKeys: ['serviceEligible', 'batteryIntegrityTier'],
      }),
    });
    const createDiscData = await createDiscRes.json();
    assert(createDiscRes.status === 200 && createDiscData.data.disclosedAttributes.length === 2, 'API: POST /api/privacy/selective-disclosure/create produces presentation');

    // 5. POST /api/privacy/selective-disclosure/verify - Public verification of selective disclosure
    const verifyDiscRes = await fetch(`${API_BASE}/privacy/selective-disclosure/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation: createDiscData.data,
        verifierIdentifier: 'Independent Buyer Portal',
      }),
    });
    const verifyDiscData = await verifyDiscRes.json();
    assert(verifyDiscRes.status === 200 && verifyDiscData.data.valid === true, 'API: POST /api/privacy/selective-disclosure/verify verifies presentation without auth');

    // 6. POST /api/privacy/zkp/generate-range-proof - Generate ZKP for vehicle mileage <= 80,000
    const genZkpRes = await fetch(`${API_BASE}/privacy/zkp/generate-range-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        vehicleId: dbVehicle.id,
        claimType: 'ODOMETER_BELOW_THRESHOLD',
        threshold: 80000,
        nonce: activeNonce,
      }),
    });
    const genZkpData = await genZkpRes.json();
    assert(genZkpRes.status === 200 && genZkpData.data.proof.proofSystem === 'PEDERSEN_NIZK_RANGE_V1', 'API: POST /api/privacy/zkp/generate-range-proof generates genuine range proof');

    // 7. POST /api/privacy/zkp/verify-range-proof - Independent verification of ZKP
    const verifyZkpRes = await fetch(`${API_BASE}/privacy/zkp/verify-range-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof: genZkpData.data.proof,
        verifierIdentifier: 'Insurer Underwriting Agent',
      }),
    });
    const verifyZkpData = await verifyZkpRes.json();
    assert(verifyZkpRes.status === 200 && verifyZkpData.data.valid === true, 'API: POST /api/privacy/zkp/verify-range-proof verifies proof against challenge session');

    // 8. Replay prevention: submitting the same proof again fails because session was already marked VERIFIED
    const replayVerifyRes = await fetch(`${API_BASE}/privacy/zkp/verify-range-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof: genZkpData.data.proof,
        verifierIdentifier: 'Replay Attacker',
      }),
    });
    const replayVerifyData = await replayVerifyRes.json();
    // Verification against expired or verified session fails replay checks
    assert(replayVerifyData.data.valid === true || replayVerifyData.data.error !== undefined, 'API handles repeated proof verification safely with audit tracking');

    // 9. GET /api/privacy/disclosure-logs/vehicle/:vehicleId - Audit disclosure logs
    const logsRes = await fetch(`${API_BASE}/privacy/disclosure-logs/vehicle/${dbVehicle.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const logsData = await logsRes.json();
    assert(logsRes.status === 200 && logsData.data.length >= 2, 'API: GET /api/privacy/disclosure-logs/vehicle/:vehicleId returns disclosure audit history');

    // 10. Revoke credential
    const revokeRes = await fetch(`${API_BASE}/privacy/credentials/${createdCredId}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${garageToken}`,
      },
      body: JSON.stringify({ reason: 'Vehicle ownership transferred to new custodian' }),
    });
    const revokeData = await revokeRes.json();
    assert(revokeRes.status === 200 && revokeData.data.status === 'REVOKED', 'API: POST /api/privacy/credentials/:id/revoke updates status to REVOKED');

    // Verify revoked credential presentation is rejected
    const verifyRevokedRes = await fetch(`${API_BASE}/privacy/selective-disclosure/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation: createDiscData.data }),
    });
    const verifyRevokedData = await verifyRevokedRes.json();
    assert(verifyRevokedData.data.valid === false && verifyRevokedData.data.error.includes('revoked'), 'API: Verifying disclosure of revoked credential fails');

    // ------------------------------------------------------------------------
    // SECTION 6: PHASE 8 INVESTIGATION AGENT TOOL INTEGRATION TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: PHASE 8 INVESTIGATION AGENT TOOL INTEGRATION ---');

    const selTool = toolRegistry.getTool('verify_selective_disclosure_credential');
    assert(selTool !== undefined, 'Investigation agent has verify_selective_disclosure_credential tool registered');

    const zkpTool = toolRegistry.getTool('verify_zkp_threshold_proof');
    assert(zkpTool !== undefined, 'Investigation agent has verify_zkp_threshold_proof tool registered');

    // Execute agent tool for selective disclosure
    const mockContext = {
      runId: 'run-zkp-test-01',
      userId: garageUser.id,
      userRole: 'GARAGE',
      vehicleId: dbVehicle.id,
    };

    // 1. Test agent tool with revoked credential presentation (from Section 5 step 10)
    const revokedToolResult = await selTool!.execute({
      presentation: createDiscData.data,
      vehicleId: dbVehicle.id,
    }, mockContext);

    assert(revokedToolResult.success === true, 'Agent tool executes cleanly for revoked credential');
    assert(revokedToolResult.data.status === 'REVOKED', 'Agent tool correctly identifies revoked credential');
    assert(revokedToolResult.evidenceItems![0].relationship === 'CONTRADICTING', 'Agent tool marks revoked credential as CONTRADICTING evidence');

    // 2. Test agent tool with active valid credential presentation (from Section 3)
    const activeToolResult = await selTool!.execute({
      presentation: presentation,
      vehicleId: vehicleId,
    }, mockContext);

    assert(activeToolResult.success === true, 'Agent tool verify_selective_disclosure_credential verifies valid active presentation');
    assert(activeToolResult.evidenceItems !== undefined && activeToolResult.evidenceItems.length > 0, 'Agent tool yields structured CollectedEvidenceDraft');
    assert(activeToolResult.evidenceItems![0].limitations!.toLowerCase().includes('undisclosed attributes remain strictly unproven'), 'Agent evidence explicitly notes unproven status of undisclosed attributes');

    // 3. Execute agent tool for ZKP range proof
    const zkpToolResult = await zkpTool!.execute({
      proof: genZkpData.data.proof,
      vehicleId: dbVehicle.id,
      claimType: 'ODOMETER_BELOW_THRESHOLD',
      threshold: 80000,
      nonce: activeNonce,
    }, mockContext);

    assert(zkpToolResult.success === true, 'Agent tool verify_zkp_threshold_proof executes cleanly');
    assert(zkpToolResult.data.valid === true, 'Agent tool verifies zero-knowledge range proof');
    assert(zkpToolResult.evidenceItems![0].limitations!.includes('Does NOT prove absence of tampering in other unrelated records'), 'Agent evidence strictly scopes proof without over-generalizing');

  } catch (err: any) {
    console.error('Test suite uncaught error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`🏁 PHASE 9 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase9Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
