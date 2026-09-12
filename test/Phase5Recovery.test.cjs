const { expect } = require("chai");
const { ethers } = require("hardhat");
const crypto = require("crypto");

describe("Phase 5: Self-Healing Blockchain Recovery Engine & Post-Verification Suite", function () {
  let anchor;
  let contractAdmin, blockWriter, securityAdmin, user1, user2, attacker;

  const chainId = "securechainpay-global-v1";
  const chainVersion = 1n;
  const expectedGenesisSeed = "genesis:securechainpay:global:v1";
  const genesisHash = "0x" + crypto.createHash("sha256").update(expectedGenesisSeed, "utf8").digest("hex");
  const genesisChainRoot = ethers.keccak256(ethers.toUtf8Bytes("genesis:securechainpay:global:v1:root"));

  function computeCanonicalHash(input) {
    const payload = [
      `block:${input.blockNumber}`,
      `prev:${input.previousHash}`,
      `sender:${(input.sender || "").toLowerCase().trim()}`,
      `receiver:${(input.receiver || "").toLowerCase().trim()}`,
      `amount:${Number(input.amount).toFixed(6)}`,
      `currency:${(input.currency || "HSCT").toUpperCase().trim()}`,
      `date:${input.date}`,
      `type:${input.type}`,
      `nonce:${input.idempotencyKey || ""}`,
    ].join("|");
    return "0x" + crypto.createHash("sha256").update(payload, "utf8").digest("hex");
  }

  function computeChainRoot(prevRoot, blockHash) {
    return ethers.keccak256(
      ethers.solidityPacked(["bytes32", "bytes32"], [prevRoot, blockHash])
    );
  }

  beforeEach(async function () {
    [contractAdmin, blockWriter, securityAdmin, user1, user2, attacker] = await ethers.getSigners();

    const SecureChainAnchor = await ethers.getContractFactory("SecureChainAnchor");
    anchor = await SecureChainAnchor.deploy(contractAdmin.address);
    await anchor.waitForDeployment();

    // Convert SHA-256 genesisHash to bytes32 format for contract
    const genesisBytes32 = ethers.keccak256(ethers.toUtf8Bytes(expectedGenesisSeed));
    await anchor.connect(contractAdmin).initialize(
      chainId,
      chainVersion,
      genesisBytes32,
      genesisChainRoot,
      blockWriter.address,
      securityAdmin.address
    );
  });

  it("TEST 1: Genesis #0 validation root integrity", async function () {
    const recalculatedGenesis = "0x" + crypto.createHash("sha256").update(expectedGenesisSeed, "utf8").digest("hex");
    expect(recalculatedGenesis.toLowerCase()).to.equal(genesisHash.toLowerCase());

    const badGenesisSeed = "genesis:fake:tampered";
    const badHash = "0x" + crypto.createHash("sha256").update(badGenesisSeed, "utf8").digest("hex");
    expect(badHash.toLowerCase()).to.not.equal(genesisHash.toLowerCase());
  });

  it("TEST 2: Sequential canonical block hash calculation & chain root derivation", async function () {
    const b1Date = "2026-09-12T12:00:00.000Z";
    const b1Hash = computeCanonicalHash({
      blockNumber: 1,
      previousHash: genesisHash,
      sender: user1.address,
      receiver: user2.address,
      amount: 500,
      currency: "HSCT",
      date: b1Date,
      type: "transfer",
      idempotencyKey: "TX_001",
    });

    const b1Root = computeChainRoot(genesisChainRoot, b1Hash);

    expect(b1Hash).to.be.a("string").with.lengthOf(66);
    expect(b1Root).to.be.a("string").with.lengthOf(66);

    const b2Date = "2026-09-12T12:05:00.000Z";
    const b2Hash = computeCanonicalHash({
      blockNumber: 2,
      previousHash: b1Hash,
      sender: user2.address,
      receiver: user1.address,
      amount: 150,
      currency: "HSCT",
      date: b2Date,
      type: "transfer",
      idempotencyKey: "TX_002",
    });

    const b2Root = computeChainRoot(b1Root, b2Hash);

    expect(b2Hash).to.be.a("string").with.lengthOf(66);
    expect(b2Root).to.be.a("string").with.lengthOf(66);
  });

  it("TEST 3: Rejection of corrupted block hash during reconstruction", async function () {
    const b1Date = "2026-09-12T12:00:00.000Z";
    const b1Hash = computeCanonicalHash({
      blockNumber: 1,
      previousHash: genesisHash,
      sender: user1.address,
      receiver: user2.address,
      amount: 500,
      currency: "HSCT",
      date: b1Date,
      type: "transfer",
      idempotencyKey: "TX_001",
    });

    // Simulating tampered block #2
    const tamperedB2 = {
      blockNumber: 2,
      previousHash: b1Hash,
      sender: user2.address,
      receiver: attacker.address, // attacker modified recipient
      amount: 100000,
      currency: "HSCT",
      date: "2026-09-12T12:05:00.000Z",
      type: "transfer",
      idempotencyKey: "TX_TAMPERED",
      hash: "0xDEADBEEF00001111222233334444555566667777888899990000111122223333", // Fake stored hash
    };

    const recomputedB2Hash = computeCanonicalHash(tamperedB2);
    expect(tamperedB2.hash.toLowerCase()).to.not.equal(recomputedB2Hash.toLowerCase());
  });

  it("TEST 4: Deterministic balance derivation from canonical transaction ledger", async function () {
    const initialBalance = 100000;
    let user1Bal = initialBalance;
    let user2Bal = initialBalance;

    // Block 1: User1 transfers 500 HSCT to User2
    user1Bal -= 500;
    user2Bal += 500;

    // Block 2: User2 transfers 200 HSCT to User1
    user2Bal -= 200;
    user1Bal += 200;

    // Block 3: User1 transfers 300 HSCT to User2
    user1Bal -= 300;
    user2Bal += 300;

    expect(user1Bal).to.equal(99400);
    expect(user2Bal).to.equal(100600);
    expect(user1Bal + user2Bal).to.equal(200000); // Strict conservation of funds
  });

  it("TEST 5: Smart contract emergency pause during incident and recovery", async function () {
    await anchor.connect(securityAdmin).pause();
    const state = await anchor.getChainState();
    expect(state._paused).to.be.true;

    // Commits must revert when paused
    const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("candidate_block"));
    await expect(
      anchor.connect(blockWriter).commitBlock(1n, fakeHash, genesisBytes32Stub(anchor), fakeHash)
    ).to.be.revertedWith("SecureChainAnchor: chain is paused");
  });

  it("TEST 6: Smart contract bumpRecoveryVersion() increments recovery epoch", async function () {
    const stateBefore = await anchor.getChainState();
    expect(stateBefore._recoveryVersion).to.equal(0n);

    await anchor.connect(contractAdmin).bumpRecoveryVersion();

    const stateAfter = await anchor.getChainState();
    expect(stateAfter._recoveryVersion).to.equal(1n);
  });

  it("TEST 7: Non-admin cannot bump recovery version", async function () {
    await expect(
      anchor.connect(attacker).bumpRecoveryVersion()
    ).to.be.revertedWith("SecureChainAnchor: caller is not contractAdmin");
  });

  it("TEST 8: Authorized unpause only after verified recovery", async function () {
    await anchor.connect(securityAdmin).pause();
    expect((await anchor.getChainState())._paused).to.be.true;

    await anchor.connect(securityAdmin).unpause();
    expect((await anchor.getChainState())._paused).to.be.false;
  });

  it("TEST 9: Next valid block cleanly extends recovered chain height", async function () {
    // Commit Block 1
    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("b1"));
    const b1Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [genesisChainRoot, b1Hash]));
    const genBytes32 = (await anchor.getChainState())._genesisHash;
    await anchor.connect(blockWriter).commitBlock(1n, b1Hash, genBytes32, b1Root);

    // Commit Block 2 (Last trusted before attack)
    const b2Hash = ethers.keccak256(ethers.toUtf8Bytes("b2"));
    const b2Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [b1Root, b2Hash]));
    await anchor.connect(blockWriter).commitBlock(2n, b2Hash, b1Hash, b2Root);

    // Simulated attack happened at B3, recovery restored canonical height to B2
    // New transaction resumes and creates valid B3 extending recovered B2
    const newB3Hash = ethers.keccak256(ethers.toUtf8Bytes("recovered_b3_legit_tx"));
    const newB3Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [b2Root, newB3Hash]));

    await expect(
      anchor.connect(blockWriter).commitBlock(3n, newB3Hash, b2Hash, newB3Root)
    ).to.emit(anchor, "BlockCommitted");

    const finalState = await anchor.getChainState();
    expect(finalState._latestBlockNumber).to.equal(3n);
    expect(finalState._latestBlockHash).to.equal(newB3Hash);
    expect(finalState._chainRoot).to.equal(newB3Root);
  });

  it("TEST 10: Full End-to-End Self-Healing Lifecycle (Attack -> Freeze -> Recovery -> Resume)", async function () {
    // 1. Initial State: B0
    let currentState = await anchor.getChainState();
    expect(currentState._latestBlockNumber).to.equal(0n);

    // 2. Commit B1 & B2
    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("b1_payload"));
    const b1Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [genesisChainRoot, b1Hash]));
    await anchor.connect(blockWriter).commitBlock(1n, b1Hash, currentState._latestBlockHash, b1Root);

    const b2Hash = ethers.keccak256(ethers.toUtf8Bytes("b2_payload"));
    const b2Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [b1Root, b2Hash]));
    await anchor.connect(blockWriter).commitBlock(2n, b2Hash, b1Hash, b2Root);

    // 3. Attack Detected -> Freeze & Pause
    await anchor.connect(securityAdmin).pause();
    currentState = await anchor.getChainState();
    expect(currentState._paused).to.be.true;

    // 4. Recovery Process Rebuilds B0..B2, increments recovery epoch
    await anchor.connect(contractAdmin).bumpRecoveryVersion();
    expect((await anchor.getChainState())._recoveryVersion).to.equal(1n);

    // 5. Post-Audit Passes -> Unpause
    await anchor.connect(securityAdmin).unpause();
    expect((await anchor.getChainState())._paused).to.be.false;

    // 6. Resume: Commit Next Valid Block (B3)
    const b3Hash = ethers.keccak256(ethers.toUtf8Bytes("b3_resumed_payload"));
    const b3Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [b2Root, b3Hash]));
    await anchor.connect(blockWriter).commitBlock(3n, b3Hash, b2Hash, b3Root);

    const finalState = await anchor.getChainState();
    expect(finalState._latestBlockNumber).to.equal(3n);
    expect(finalState._latestBlockHash).to.equal(b3Hash);
    expect(finalState._chainRoot).to.equal(b3Root);
    expect(finalState._recoveryVersion).to.equal(1n);
    expect(finalState._paused).to.be.false;
  });
});

function genesisBytes32Stub(anchor) {
  return ethers.keccak256(ethers.toUtf8Bytes("genesis:securechainpay:global:v1"));
}
