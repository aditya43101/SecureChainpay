/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 3 — SecureChainAnchor Smart Contract Tests
 * 16 tests covering all Phase 3 acceptance criteria (§30)
 * ═══════════════════════════════════════════════════════════════════════════
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper: create a non-zero bytes32 from a string
const toBytes32 = (str) => ethers.keccak256(ethers.toUtf8Bytes(str));
const GENESIS_HASH     = toBytes32("genesis:securechainpay:global:v1");
const GENESIS_ROOT     = toBytes32("chainroot:genesis:securechainpay");
const CHAIN_ID         = "securechainpay-global-v1";
const CHAIN_VERSION    = 1n;
const ZERO_BYTES32     = ethers.ZeroHash;

describe("SecureChainAnchor — Phase 3 Full Test Suite", function () {
  let anchor;
  let contractAdmin, blockWriter, securityAdmin, attacker, newWriter;

  // Helper: deploy + initialize fresh contract
  async function deployAndInit() {
    const Anchor = await ethers.getContractFactory("SecureChainAnchor");
    const contract = await Anchor.deploy(contractAdmin.address);
    await contract.waitForDeployment();
    await contract.connect(contractAdmin).initialize(
      CHAIN_ID,
      CHAIN_VERSION,
      GENESIS_HASH,
      GENESIS_ROOT,
      blockWriter.address,
      securityAdmin.address
    );
    return contract;
  }

  // Helper: build sequential block params
  let _blockNum = 0n;
  let _prevHash = GENESIS_HASH;
  function nextBlock() {
    _blockNum += 1n;
    const blockHash = toBytes32(`block:${_blockNum}`);
    const newRoot   = toBytes32(`root:${_blockNum}`);
    const params = { blockNum: _blockNum, blockHash, prevHash: _prevHash, newRoot };
    _prevHash = blockHash;
    return params;
  }
  function resetChain() { _blockNum = 0n; _prevHash = GENESIS_HASH; }

  before(async function () {
    [contractAdmin, blockWriter, securityAdmin, attacker, newWriter] = await ethers.getSigners();
  });

  // ─── TEST 1: Initialize contract ─────────────────────────────────────────
  describe("TEST 1: Initialize contract", function () {
    it("should initialize successfully with correct parameters", async function () {
      const Anchor = await ethers.getContractFactory("SecureChainAnchor");
      anchor = await Anchor.deploy(contractAdmin.address);
      await anchor.waitForDeployment();

      const tx = await anchor.connect(contractAdmin).initialize(
        CHAIN_ID,
        CHAIN_VERSION,
        GENESIS_HASH,
        GENESIS_ROOT,
        blockWriter.address,
        securityAdmin.address
      );
      const receipt = await tx.wait();

      // Verify state
      expect(await anchor.chainId()).to.equal(CHAIN_ID);
      expect(await anchor.chainVersion()).to.equal(CHAIN_VERSION);
      expect(await anchor.genesisHash()).to.equal(GENESIS_HASH);
      expect(await anchor.latestBlockNumber()).to.equal(0n);
      expect(await anchor.latestBlockHash()).to.equal(GENESIS_HASH);
      expect(await anchor.chainRoot()).to.equal(GENESIS_ROOT);
      expect(await anchor.blockWriter()).to.equal(blockWriter.address);
      expect(await anchor.securityAdmin()).to.equal(securityAdmin.address);
      expect(await anchor.paused()).to.equal(false);

      // Verify event
      const log = receipt.logs.find(l => anchor.interface.parseLog(l)?.name === "ChainInitialized");
      expect(log).to.not.be.undefined;
    });
  });

  // ─── TEST 2: Initialize twice → revert ───────────────────────────────────
  describe("TEST 2: Initialize twice", function () {
    it("should revert on second initialization attempt", async function () {
      await expect(
        anchor.connect(contractAdmin).initialize(
          CHAIN_ID,
          CHAIN_VERSION,
          GENESIS_HASH,
          GENESIS_ROOT,
          blockWriter.address,
          securityAdmin.address
        )
      ).to.be.revertedWith("SecureChainAnchor: already initialized");
    });
  });

  // ─── TEST 3: Wrong genesis hash ──────────────────────────────────────────
  describe("TEST 3: Wrong genesis hash", function () {
    it("should reject initialization with zero genesis hash", async function () {
      const Anchor = await ethers.getContractFactory("SecureChainAnchor");
      const fresh = await Anchor.deploy(contractAdmin.address);
      await fresh.waitForDeployment();

      await expect(
        fresh.connect(contractAdmin).initialize(
          CHAIN_ID,
          CHAIN_VERSION,
          ZERO_BYTES32,          // ← INVALID zero genesisHash
          GENESIS_ROOT,
          blockWriter.address,
          securityAdmin.address
        )
      ).to.be.revertedWith("SecureChainAnchor: zero genesisHash");
    });
  });

  // ─── TEST 4: Unauthorized writer calls commitBlock → revert ──────────────
  describe("TEST 4: Unauthorized writer calls commitBlock", function () {
    it("should revert when attacker calls commitBlock", async function () {
      resetChain();
      const { blockNum, blockHash, prevHash, newRoot } = nextBlock();
      await expect(
        anchor.connect(attacker).commitBlock(blockNum, blockHash, prevHash, newRoot)
      ).to.be.revertedWith("SecureChainAnchor: caller is not authorized blockWriter");
    });
  });

  // ─── TEST 5: Authorized writer commits Block #1 ──────────────────────────
  describe("TEST 5: Authorized writer commits Block #1", function () {
    it("should successfully commit Block #1 and emit BlockCommitted", async function () {
      resetChain();
      const { blockNum, blockHash, prevHash, newRoot } = nextBlock(); // Block #1

      const tx = await anchor.connect(blockWriter).commitBlock(blockNum, blockHash, prevHash, newRoot);
      const receipt = await tx.wait();

      expect(await anchor.latestBlockNumber()).to.equal(1n);
      expect(await anchor.latestBlockHash()).to.equal(blockHash);
      expect(await anchor.chainRoot()).to.equal(newRoot);

      const log = receipt.logs.find(l => anchor.interface.parseLog(l)?.name === "BlockCommitted");
      expect(log).to.not.be.undefined;
      const parsed = anchor.interface.parseLog(log);
      expect(parsed.args.blockNumber).to.equal(1n);
      expect(parsed.args.blockHash).to.equal(blockHash);
    });
  });

  // ─── TEST 6: Block #2 uses wrong previousHash → revert ───────────────────
  describe("TEST 6: Block #2 with wrong previousHash", function () {
    it("should revert when previousHash does not match latestBlockHash", async function () {
      // Block #1 already committed — now attempt #2 with wrong prev
      const wrongPrevHash = toBytes32("completely-wrong-previous-hash");
      const blockHash2 = toBytes32("block:2");
      const newRoot2 = toBytes32("root:2");

      await expect(
        anchor.connect(blockWriter).commitBlock(2n, blockHash2, wrongPrevHash, newRoot2)
      ).to.be.revertedWith("SecureChainAnchor: previousHash does not match latestBlockHash");
    });
  });

  // ─── TEST 7: Block #2 with wrong block number → revert ───────────────────
  describe("TEST 7: Block #2 with wrong block number", function () {
    it("should revert when block number is not sequential", async function () {
      // latestBlockNumber is 1; attempt to commit #3 (skipping #2)
      const currentHash = await anchor.latestBlockHash();
      const blockHash3 = toBytes32("block:3");
      const newRoot3 = toBytes32("root:3");

      await expect(
        anchor.connect(blockWriter).commitBlock(3n, blockHash3, currentHash, newRoot3)
      ).to.be.revertedWith("SecureChainAnchor: invalid block number (must be sequential)");
    });
  });

  // ─── TEST 8: Block hash = zero → revert ──────────────────────────────────
  describe("TEST 8: Zero blockHash", function () {
    it("should revert when blockHash is zero", async function () {
      const currentHash = await anchor.latestBlockHash();
      const newRoot = toBytes32("root:2");

      await expect(
        anchor.connect(blockWriter).commitBlock(2n, ZERO_BYTES32, currentHash, newRoot)
      ).to.be.revertedWith("SecureChainAnchor: zero blockHash");
    });
  });

  // ─── TEST 9: Chain root = zero → revert ──────────────────────────────────
  describe("TEST 9: Zero chainRoot", function () {
    it("should revert when newChainRoot is zero", async function () {
      const currentHash = await anchor.latestBlockHash();
      const blockHash2 = toBytes32("block:2");

      await expect(
        anchor.connect(blockWriter).commitBlock(2n, blockHash2, currentHash, ZERO_BYTES32)
      ).to.be.revertedWith("SecureChainAnchor: zero chainRoot");
    });
  });

  // ─── TEST 10: Commit while paused → revert ───────────────────────────────
  describe("TEST 10: Commit while paused", function () {
    it("should revert commitBlock when chain is paused", async function () {
      await anchor.connect(securityAdmin).pause();
      expect(await anchor.paused()).to.equal(true);

      const currentHash = await anchor.latestBlockHash();
      const blockHash2 = toBytes32("block:2");
      const newRoot2 = toBytes32("root:2");

      await expect(
        anchor.connect(blockWriter).commitBlock(2n, blockHash2, currentHash, newRoot2)
      ).to.be.revertedWith("SecureChainAnchor: chain is paused");

      // Unpause for subsequent tests
      await anchor.connect(securityAdmin).unpause();
    });
  });

  // ─── TEST 11: Unauthorized user calls pause → revert ────────────────────
  describe("TEST 11: Unauthorized pause attempt", function () {
    it("should revert when attacker calls pause()", async function () {
      await expect(
        anchor.connect(attacker).pause()
      ).to.be.revertedWith("SecureChainAnchor: caller is not securityAdmin");
    });
  });

  // ─── TEST 12: Authorized security role pauses → success ─────────────────
  describe("TEST 12: Security admin pauses", function () {
    it("should allow securityAdmin to pause and emit ChainPaused", async function () {
      const tx = await anchor.connect(securityAdmin).pause();
      const receipt = await tx.wait();
      expect(await anchor.paused()).to.equal(true);

      const log = receipt.logs.find(l => anchor.interface.parseLog(l)?.name === "ChainPaused");
      expect(log).to.not.be.undefined;

      // Restore
      await anchor.connect(securityAdmin).unpause();
    });
  });

  // ─── TEST 13: Authorized role unpauses → success ─────────────────────────
  describe("TEST 13: Authorized role unpauses", function () {
    it("should allow securityAdmin to unpause and emit ChainUnpaused", async function () {
      await anchor.connect(securityAdmin).pause();
      const tx = await anchor.connect(securityAdmin).unpause();
      const receipt = await tx.wait();
      expect(await anchor.paused()).to.equal(false);

      const log = receipt.logs.find(l => anchor.interface.parseLog(l)?.name === "ChainUnpaused");
      expect(log).to.not.be.undefined;
    });
  });

  // ─── TEST 14: Duplicate block commit → revert ────────────────────────────
  describe("TEST 14: Duplicate block commit", function () {
    it("should reject a duplicate block number", async function () {
      // Commit Block #2
      const currentHash = await anchor.latestBlockHash();
      const blockHash2 = toBytes32("block:2");
      const newRoot2 = toBytes32("root:2");
      await anchor.connect(blockWriter).commitBlock(2n, blockHash2, currentHash, newRoot2);

      // Now try to commit Block #2 again
      const currentHash2 = await anchor.latestBlockHash();
      await expect(
        anchor.connect(blockWriter).commitBlock(2n, toBytes32("block:2-dup"), currentHash2, newRoot2)
      ).to.be.revertedWith("SecureChainAnchor: invalid block number (must be sequential)");
    });
  });

  // ─── TEST 15: Concurrent / stale block state ─────────────────────────────
  describe("TEST 15: Concurrent stale block state", function () {
    it("one valid commit succeeds, stale commit with same number is rejected", async function () {
      // latestBlockNumber is now 2
      const currentHash = await anchor.latestBlockHash();
      const blockHash3a = toBytes32("block:3a");
      const blockHash3b = toBytes32("block:3b");
      const newRoot3 = toBytes32("root:3");

      // First commit #3 succeeds
      await anchor.connect(blockWriter).commitBlock(3n, blockHash3a, currentHash, newRoot3);
      expect(await anchor.latestBlockNumber()).to.equal(3n);

      // Stale commit: same blockNumber #3, but already advanced to #3
      await expect(
        anchor.connect(blockWriter).commitBlock(3n, blockHash3b, currentHash, newRoot3)
      ).to.be.revertedWith("SecureChainAnchor: invalid block number (must be sequential)");
    });
  });

  // ─── TEST 16: Writer role changed ────────────────────────────────────────
  describe("TEST 16: Writer role changed", function () {
    it("old writer is rejected after role change, new writer is accepted", async function () {
      // Change writer to newWriter
      const tx = await anchor.connect(contractAdmin).setBlockWriter(newWriter.address);
      const receipt = await tx.wait();

      const log = receipt.logs.find(l => anchor.interface.parseLog(l)?.name === "WriterChanged");
      expect(log).to.not.be.undefined;
      const parsed = anchor.interface.parseLog(log);
      expect(parsed.args.newWriter).to.equal(newWriter.address);

      // Old writer should now be rejected
      const currentHash = await anchor.latestBlockHash();
      const blockHash4 = toBytes32("block:4-old-writer");
      const newRoot4 = toBytes32("root:4");

      await expect(
        anchor.connect(blockWriter).commitBlock(4n, blockHash4, currentHash, newRoot4)
      ).to.be.revertedWith("SecureChainAnchor: caller is not authorized blockWriter");

      // New writer succeeds
      const validHash4 = toBytes32("block:4-new-writer");
      const validRoot4 = toBytes32("root:4-new-writer");
      await anchor.connect(newWriter).commitBlock(4n, validHash4, currentHash, validRoot4);
      expect(await anchor.latestBlockNumber()).to.equal(4n);
    });
  });

  // ─── BONUS: genesisHash verification helper ───────────────────────────────
  describe("BONUS: Genesis hash verification", function () {
    it("verifyGenesisHash returns true for correct hash", async function () {
      expect(await anchor.verifyGenesisHash(GENESIS_HASH)).to.equal(true);
    });

    it("verifyGenesisHash returns false for wrong hash", async function () {
      expect(await anchor.verifyGenesisHash(toBytes32("wrong"))).to.equal(false);
    });
  });

  // ─── BONUS: getChainState view ────────────────────────────────────────────
  describe("BONUS: getChainState view", function () {
    it("returns complete chain state struct", async function () {
      const state = await anchor.getChainState();
      expect(state._chainId).to.equal(CHAIN_ID);
      expect(state._genesisHash).to.equal(GENESIS_HASH);
      expect(state._initialized_state).to.equal(true);
      expect(state._paused).to.equal(false);
    });
  });
});
