import { expect } from 'chai';
import { ethers } from 'hardhat';
import { VehiclePassport } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('VehiclePassport Smart Contract', function () {
  let vehiclePassport: VehiclePassport;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const VehiclePassportFactory = await ethers.getContractFactory('VehiclePassport');
    vehiclePassport = (await VehiclePassportFactory.deploy()) as VehiclePassport;
    await vehiclePassport.waitForDeployment();
  });

  describe('User Registry', function () {
    it('should initialize a new user identity', async function () {
      const userRefHash = ethers.keccak256(ethers.toUtf8Bytes('seed-owner-a'));
      await expect(
        vehiclePassport.initializeUser('USR-000001', userRefHash, user1.address, 'VEHICLE_OWNER')
      )
        .to.emit(vehiclePassport, 'UserInitialized')
        .withArgs('USR-000001', userRefHash, user1.address, 'VEHICLE_OWNER', (val: any) => val > 0);

      const userRecord = await vehiclePassport.getUserById('USR-000001');
      expect(userRecord.blockchainUserId).to.equal('USR-000001');
      expect(userRecord.userReferenceHash).to.equal(userRefHash);
      expect(userRecord.walletAddress).to.equal(user1.address);
      expect(userRecord.role).to.equal('VEHICLE_OWNER');
      expect(userRecord.active).to.be.true;
    });

    it('should prevent duplicate user registration with same ID', async function () {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes('user1'));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes('user2'));
      await vehiclePassport.initializeUser('USR-000001', hash1, user1.address, 'VEHICLE_OWNER');

      await expect(
        vehiclePassport.initializeUser('USR-000001', hash2, user2.address, 'VEHICLE_OWNER')
      ).to.be.revertedWith('User already registered');
    });

    it('should prevent duplicate user registration with same reference hash', async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes('duplicate-uid'));
      await vehiclePassport.initializeUser('USR-000001', hash, user1.address, 'VEHICLE_OWNER');

      await expect(
        vehiclePassport.initializeUser('USR-000002', hash, user2.address, 'VEHICLE_OWNER')
      ).to.be.revertedWith('User reference hash already registered');
    });
  });

  describe('Vehicle Registry', function () {
    it('should register a vehicle record proof', async function () {
      const recordHash = ethers.keccak256(ethers.toUtf8Bytes('VP-000001|MAT612345NEXON001|MH02EV1001|Tata|Nexon EV|2024|ELECTRIC'));
      await expect(
        vehiclePassport.registerVehicle('VEH-000001', recordHash, 'VP-000001', user1.address)
      )
        .to.emit(vehiclePassport, 'VehicleRegistered')
        .withArgs('VEH-000001', recordHash, user1.address, 'VP-000001', (val: any) => val > 0);

      const vehicle = await vehiclePassport.getVehicleById('VEH-000001');
      expect(vehicle.blockchainVehicleId).to.equal('VEH-000001');
      expect(vehicle.vehicleRecordHash).to.equal(recordHash);
      expect(vehicle.passportId).to.equal('VP-000001');
      expect(vehicle.ownerAddress).to.equal(user1.address);
      expect(vehicle.active).to.be.true;
    });

    it('should support multiple vehicles for a single user', async function () {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes('veh1'));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes('veh2'));

      await vehiclePassport.registerVehicle('VEH-000001', hash1, 'VP-000001', user1.address);
      await vehiclePassport.registerVehicle('VEH-000002', hash2, 'VP-000002', user1.address);

      const ownerVehicles = await vehiclePassport.getVehiclesByOwner(user1.address);
      expect(ownerVehicles.length).to.equal(2);
      expect(ownerVehicles[0]).to.equal('VEH-000001');
      expect(ownerVehicles[1]).to.equal('VEH-000002');
    });

    it('should prevent duplicate vehicle registration with same ID or Passport ID', async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes('veh1'));
      await vehiclePassport.registerVehicle('VEH-000001', hash, 'VP-000001', user1.address);

      await expect(
        vehiclePassport.registerVehicle('VEH-000001', hash, 'VP-000002', user1.address)
      ).to.be.revertedWith('Vehicle already registered');

      await expect(
        vehiclePassport.registerVehicle('VEH-000002', hash, 'VP-000001', user1.address)
      ).to.be.revertedWith('Passport ID already registered');
    });
  });

  describe('Record Registry (Lifecycle Anchoring)', function () {
    it('should anchor a lifecycle record for an existing vehicle', async function () {
      const vHash = ethers.keccak256(ethers.toUtf8Bytes('veh1'));
      await vehiclePassport.registerVehicle('VEH-000001', vHash, 'VP-000001', user1.address);

      const recordHash = ethers.keccak256(ethers.toUtf8Bytes('SERVICE_LOG_10000KM'));
      await expect(
        vehiclePassport.anchorRecord('REC-000001', 'VEH-000001', 'SERVICE', recordHash)
      )
        .to.emit(vehiclePassport, 'RecordAnchored')
        .withArgs('REC-000001', 'VEH-000001', 'SERVICE', recordHash, owner.address, (val: any) => val > 0);

      const rec = await vehiclePassport.getRecord('REC-000001');
      expect(rec.recordId).to.equal('REC-000001');
      expect(rec.blockchainVehicleId).to.equal('VEH-000001');
      expect(rec.recordType).to.equal('SERVICE');
      expect(rec.recordHash).to.equal(recordHash);
    });

    it('should transfer vehicle ownership and emit OwnershipTransferred', async function () {
      const vHash = ethers.keccak256(ethers.toUtf8Bytes('veh_transfer'));
      await vehiclePassport.registerVehicle('VEH-000002', vHash, 'VP-000002', user1.address);

      const transferHash = ethers.keccak256(ethers.toUtf8Bytes('TRANSFER_SALE'));
      await expect(
        vehiclePassport.transferVehicleOwnership('VEH-000002', user2.address, transferHash, 'REC-000002')
      )
        .to.emit(vehiclePassport, 'VehicleOwnershipTransferred')
        .withArgs('VEH-000002', user1.address, user2.address, transferHash, (val: any) => val > 0)
        .and.to.emit(vehiclePassport, 'RecordAnchored')
        .withArgs('REC-000002', 'VEH-000002', 'OWNERSHIP_TRANSFERRED', transferHash, owner.address, (val: any) => val > 0);

      const veh = await vehiclePassport.getVehicleById('VEH-000002');
      expect(veh.ownerAddress).to.equal(user2.address);
    });

    it('should reject self-transfer when transferring to the current owner', async function () {
      const vHash = ethers.keccak256(ethers.toUtf8Bytes('veh_self_transfer'));
      await vehiclePassport.registerVehicle('VEH-000003', vHash, 'VP-000003', user1.address);

      const transferHash = ethers.keccak256(ethers.toUtf8Bytes('TRANSFER_SELF'));
      await expect(
        vehiclePassport.transferVehicleOwnership('VEH-000003', user1.address, transferHash, 'REC-000003')
      ).to.be.revertedWith('Cannot transfer vehicle to current owner');
    });

    it('should reject repeated transfer with duplicate record ID', async function () {
      const vHash = ethers.keccak256(ethers.toUtf8Bytes('veh_dup_rec'));
      await vehiclePassport.registerVehicle('VEH-000004', vHash, 'VP-000004', user1.address);

      const transferHash = ethers.keccak256(ethers.toUtf8Bytes('TRANSFER_1'));
      await vehiclePassport.transferVehicleOwnership('VEH-000004', user2.address, transferHash, 'REC-DUP-01');

      // Attempt another transfer reusing REC-DUP-01
      const transferHash2 = ethers.keccak256(ethers.toUtf8Bytes('TRANSFER_2'));
      await expect(
        vehiclePassport.transferVehicleOwnership('VEH-000004', owner.address, transferHash2, 'REC-DUP-01')
      ).to.be.revertedWith('Record ID already anchored');
    });

    it('should support sequential ownership transfers (A -> B -> C)', async function () {
      const vHash = ethers.keccak256(ethers.toUtf8Bytes('veh_seq'));
      await vehiclePassport.registerVehicle('VEH-000005', vHash, 'VP-000005', user1.address);

      // 1. Transfer user1 -> user2
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes('TRANSFER_A_TO_B'));
      await vehiclePassport.transferVehicleOwnership('VEH-000005', user2.address, hash1, 'REC-SEQ-01');
      let veh = await vehiclePassport.getVehicleById('VEH-000005');
      expect(veh.ownerAddress).to.equal(user2.address);

      // 2. Transfer user2 -> owner
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes('TRANSFER_B_TO_C'));
      await vehiclePassport.transferVehicleOwnership('VEH-000005', owner.address, hash2, 'REC-SEQ-02');
      veh = await vehiclePassport.getVehicleById('VEH-000005');
      expect(veh.ownerAddress).to.equal(owner.address);
    });

    it('should reject anchoring a record for a non-existent vehicle', async function () {
      const recordHash = ethers.keccak256(ethers.toUtf8Bytes('INVALID'));
      await expect(
        vehiclePassport.anchorRecord('REC-000001', 'VEH-NONEXISTENT', 'SERVICE', recordHash)
      ).to.be.revertedWith('Vehicle must be registered first');
    });
  });


  describe('Access Control', function () {
    it('should reject non-owner from registering users or vehicles', async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes('h'));
      await expect(
        vehiclePassport.connect(user1).initializeUser('USR-000001', hash, user1.address, 'VEHICLE_OWNER')
      ).to.be.revertedWithCustomError(vehiclePassport, 'OwnableUnauthorizedAccount');

      await expect(
        vehiclePassport.connect(user1).registerVehicle('VEH-000001', hash, 'VP-000001', user1.address)
      ).to.be.revertedWithCustomError(vehiclePassport, 'OwnableUnauthorizedAccount');
    });

    it('should reject non-owner from anchoring batches', async function () {
      const batchId = ethers.keccak256(ethers.toUtf8Bytes('BATCH-001'));
      const root = ethers.keccak256(ethers.toUtf8Bytes('ROOT-001'));
      const meta = ethers.keccak256(ethers.toUtf8Bytes('META-001'));

      await expect(
        vehiclePassport.connect(user1).anchorBatch(batchId, root, 5, meta)
      ).to.be.revertedWithCustomError(vehiclePassport, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Merkle Batch Anchoring & Verification (Phase 6)', function () {
    const batchId = ethers.keccak256(ethers.toUtf8Bytes('BATCH-2026-000001'));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes('meta-json-data'));

    // Helper: compute sorted pair hash
    function hashPair(a: string, b: string): string {
      const [left, right] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
      return ethers.keccak256(ethers.concat([left, right]));
    }

    it('should anchor a Merkle batch root successfully and emit BatchAnchored event', async function () {
      const leaf0 = ethers.keccak256(ethers.toUtf8Bytes('leaf0'));
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes('leaf1'));
      const root = hashPair(leaf0, leaf1);

      await expect(vehiclePassport.anchorBatch(batchId, root, 2, metadataHash))
        .to.emit(vehiclePassport, 'BatchAnchored')
        .withArgs(batchId, root, 2, metadataHash, owner.address, (val: any) => val > 0);

      const batch = await vehiclePassport.getBatch(batchId);
      expect(batch.batchId).to.equal(batchId);
      expect(batch.merkleRoot).to.equal(root);
      expect(batch.leafCount).to.equal(2n);
      expect(batch.metadataHash).to.equal(metadataHash);
      expect(batch.actorAddress).to.equal(owner.address);
      expect(batch.active).to.be.true;

      expect(await vehiclePassport.isBatchAnchored(batchId)).to.be.true;
      expect(await vehiclePassport.getBatchCount()).to.equal(1n);

      const allIds = await vehiclePassport.getAllBatchIds();
      expect(allIds.length).to.equal(1);
      expect(allIds[0]).to.equal(batchId);
    });

    it('should reject anchoring a batch with zero batchId, zero root, or zero leaf count', async function () {
      const validRoot = ethers.keccak256(ethers.toUtf8Bytes('root'));
      const validId = ethers.keccak256(ethers.toUtf8Bytes('batch2'));

      await expect(
        vehiclePassport.anchorBatch(ethers.ZeroHash, validRoot, 10, metadataHash)
      ).to.be.revertedWith('Batch ID cannot be zero');

      await expect(
        vehiclePassport.anchorBatch(validId, ethers.ZeroHash, 10, metadataHash)
      ).to.be.revertedWith('Merkle root cannot be zero');

      await expect(
        vehiclePassport.anchorBatch(validId, validRoot, 0, metadataHash)
      ).to.be.revertedWith('Leaf count must be positive');
    });

    it('should reject duplicate batch registration with same batchId', async function () {
      const root1 = ethers.keccak256(ethers.toUtf8Bytes('root1'));
      const root2 = ethers.keccak256(ethers.toUtf8Bytes('root2'));
      const testBatchId = ethers.keccak256(ethers.toUtf8Bytes('BATCH-DUP-TEST'));

      await vehiclePassport.anchorBatch(testBatchId, root1, 5, metadataHash);

      await expect(
        vehiclePassport.anchorBatch(testBatchId, root2, 10, metadataHash)
      ).to.be.revertedWith('Batch ID already anchored');
    });

    it('should verify valid inclusion proof via pure function verifyInclusionProof', async function () {
      const leaf0 = ethers.keccak256(ethers.toUtf8Bytes('rec0'));
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes('rec1'));
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes('rec2'));

      // 3-leaf tree with promote-unchanged:
      // level 0: [leaf0, leaf1, leaf2]
      // level 1: [parent(leaf0, leaf1), leaf2]
      // level 2: [parent(parent(leaf0, leaf1), leaf2)] -> root
      const parent01 = hashPair(leaf0, leaf1);
      const root = hashPair(parent01, leaf2);

      // Proof for leaf0 is [leaf1, leaf2]
      const proof0 = [leaf1, leaf2];
      const isValid0 = await vehiclePassport.verifyInclusionProof(leaf0, proof0, root);
      expect(isValid0).to.be.true;

      // Proof for leaf1 is [leaf0, leaf2]
      const proof1 = [leaf0, leaf2];
      const isValid1 = await vehiclePassport.verifyInclusionProof(leaf1, proof1, root);
      expect(isValid1).to.be.true;

      // Proof for leaf2 is [parent01] (promoted unchanged at level 0)
      const proof2 = [parent01];
      const isValid2 = await vehiclePassport.verifyInclusionProof(leaf2, proof2, root);
      expect(isValid2).to.be.true;

      // Adversarial: wrong leaf
      const badLeaf = ethers.keccak256(ethers.toUtf8Bytes('bad'));
      expect(await vehiclePassport.verifyInclusionProof(badLeaf, proof0, root)).to.be.false;

      // Adversarial: wrong proof element
      const badProof = [leaf2, leaf1];
      expect(await vehiclePassport.verifyInclusionProof(leaf0, badProof, root)).to.be.false;

      // Adversarial: wrong root
      expect(await vehiclePassport.verifyInclusionProof(leaf0, proof0, ethers.keccak256(ethers.toUtf8Bytes('other')))).to.be.false;
    });

    it('should verify inclusion against on-chain anchored batch via verifyBatchInclusion', async function () {
      const leafA = ethers.keccak256(ethers.toUtf8Bytes('leafA'));
      const leafB = ethers.keccak256(ethers.toUtf8Bytes('leafB'));
      const root = hashPair(leafA, leafB);
      const testBatchId = ethers.keccak256(ethers.toUtf8Bytes('BATCH-ONCHAIN-VERIFY'));

      await vehiclePassport.anchorBatch(testBatchId, root, 2, metadataHash);

      // Sibling for leafA is leafB
      expect(await vehiclePassport.verifyBatchInclusion(testBatchId, leafA, [leafB])).to.be.true;
      expect(await vehiclePassport.verifyBatchInclusion(testBatchId, leafB, [leafA])).to.be.true;

      // Non-member leaf
      const fakeLeaf = ethers.keccak256(ethers.toUtf8Bytes('fake'));
      expect(await vehiclePassport.verifyBatchInclusion(testBatchId, fakeLeaf, [leafB])).to.be.false;

      // Non-existent batch
      const fakeBatch = ethers.keccak256(ethers.toUtf8Bytes('NONEXISTENT'));
      await expect(
        vehiclePassport.verifyBatchInclusion(fakeBatch, leafA, [leafB])
      ).to.be.revertedWith('Batch not found');
    });
  });
});

