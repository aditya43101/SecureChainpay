const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 4: Blockchain Integrity Monitoring & Incident Response Test Suite", function () {
  let anchor;
  let contractAdmin, blockWriter, securityAdmin, user1, user2, attacker;

  const chainId = "securechainpay-global-v1";
  const chainVersion = 1n;
  const genesisHash = ethers.keccak256(ethers.toUtf8Bytes("genesis:securechainpay:global:v1"));
  const genesisChainRoot = ethers.keccak256(ethers.toUtf8Bytes("genesis:securechainpay:global:v1:root"));

  beforeEach(async function () {
    [contractAdmin, blockWriter, securityAdmin, user1, user2, attacker] = await ethers.getSigners();

    const SecureChainAnchor = await ethers.getContractFactory("SecureChainAnchor");
    anchor = await SecureChainAnchor.deploy(contractAdmin.address);
    await anchor.waitForDeployment();

    await anchor.connect(contractAdmin).initialize(
      chainId,
      chainVersion,
      genesisHash,
      genesisChainRoot,
      blockWriter.address,
      securityAdmin.address
    );
  });

  it("TEST 1: Healthy chain initialized properly", async function () {
    const state = await anchor.getChainState();
    expect(state._initialized_state).to.be.true;
    expect(state._paused).to.be.false;
    expect(state._latestBlockNumber).to.equal(0n);
    expect(state._genesisHash).to.equal(genesisHash);
    expect(state._chainRoot).to.equal(genesisChainRoot);
  });

  it("TEST 2: Valid block commit #1 updates latest hash and chain root", async function () {
    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("block_1_canonical_payload"));
    const b1Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [genesisChainRoot, b1Hash]));

    await expect(
      anchor.connect(blockWriter).commitBlock(1n, b1Hash, genesisHash, b1Root)
    ).to.emit(anchor, "BlockCommitted");

    const state = await anchor.getChainState();
    expect(state._latestBlockNumber).to.equal(1n);
    expect(state._latestBlockHash).to.equal(b1Hash);
    expect(state._chainRoot).to.equal(b1Root);
  });

  it("TEST 3: PreviousHash tampering rejected by smart contract", async function () {
    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("block_1_payload"));
    const b1Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [genesisChainRoot, b1Hash]));
    await anchor.connect(blockWriter).commitBlock(1n, b1Hash, genesisHash, b1Root);

    const b2Hash = ethers.keccak256(ethers.toUtf8Bytes("block_2_payload"));
    const b2Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [b1Root, b2Hash]));
    const badPrevHash = ethers.keccak256(ethers.toUtf8Bytes("bad_hash"));

    await expect(
      anchor.connect(blockWriter).commitBlock(2n, b2Hash, badPrevHash, b2Root)
    ).to.be.revertedWith("SecureChainAnchor: previousHash does not match latestBlockHash");
  });

  it("TEST 4: Block number gap / manipulation rejected", async function () {
    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("block_1_payload"));
    const b1Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [genesisChainRoot, b1Hash]));
    await anchor.connect(blockWriter).commitBlock(1n, b1Hash, genesisHash, b1Root);

    const b5Hash = ethers.keccak256(ethers.toUtf8Bytes("block_5_payload"));
    const b5Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [b1Root, b5Hash]));

    await expect(
      anchor.connect(blockWriter).commitBlock(5n, b5Hash, b1Hash, b5Root)
    ).to.be.revertedWith("SecureChainAnchor: invalid block number (must be sequential)");
  });

  it("TEST 5: ChainRoot cannot be zero bytes", async function () {
    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("block_1_payload"));
    await expect(
      anchor.connect(blockWriter).commitBlock(1n, b1Hash, genesisHash, ethers.ZeroHash)
    ).to.be.revertedWith("SecureChainAnchor: zero chainRoot");
  });

  it("TEST 6: Unauthorized writer commit rejected", async function () {
    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("block_1_payload"));
    const b1Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [genesisChainRoot, b1Hash]));

    await expect(
      anchor.connect(attacker).commitBlock(1n, b1Hash, genesisHash, b1Root)
    ).to.be.revertedWith("SecureChainAnchor: caller is not authorized blockWriter");
  });

  it("TEST 7: Smart contract emergency pause blocks all block commits", async function () {
    await expect(anchor.connect(securityAdmin).pause())
      .to.emit(anchor, "ChainPaused");

    const state = await anchor.getChainState();
    expect(state._paused).to.be.true;

    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("block_1_payload"));
    const b1Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [genesisChainRoot, b1Hash]));

    await expect(
      anchor.connect(blockWriter).commitBlock(1n, b1Hash, genesisHash, b1Root)
    ).to.be.revertedWith("SecureChainAnchor: chain is paused");
  });

  it("TEST 8: Unauthorized caller cannot pause contract", async function () {
    await expect(
      anchor.connect(attacker).pause()
    ).to.be.revertedWith("SecureChainAnchor: caller is not securityAdmin");
  });

  it("TEST 9: Authorized unpause restores block commit ability", async function () {
    await anchor.connect(securityAdmin).pause();

    await expect(anchor.connect(securityAdmin).unpause())
      .to.emit(anchor, "ChainUnpaused");

    const b1Hash = ethers.keccak256(ethers.toUtf8Bytes("block_1_payload"));
    const b1Root = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [genesisChainRoot, b1Hash]));

    await expect(
      anchor.connect(blockWriter).commitBlock(1n, b1Hash, genesisHash, b1Root)
    ).to.emit(anchor, "BlockCommitted");
  });

  it("TEST 10: Genesis hash verification helper", async function () {
    expect(await anchor.verifyGenesisHash(genesisHash)).to.be.true;
    const fakeGen = ethers.keccak256(ethers.toUtf8Bytes("fake_genesis"));
    expect(await anchor.verifyGenesisHash(fakeGen)).to.be.false;
  });

  it("TEST 11: Sequential hash-chain multi-block commits", async function () {
    let prevHash = genesisHash;
    let prevRoot = genesisChainRoot;

    for (let i = 1; i <= 5; i++) {
      const bHash = ethers.keccak256(ethers.toUtf8Bytes(`block_${i}_data`));
      const bRoot = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [prevRoot, bHash]));

      await anchor.connect(blockWriter).commitBlock(BigInt(i), bHash, prevHash, bRoot);
      prevHash = bHash;
      prevRoot = bRoot;
    }

    const finalState = await anchor.getChainState();
    expect(finalState._latestBlockNumber).to.equal(5n);
    expect(finalState._latestBlockHash).to.equal(prevHash);
    expect(finalState._chainRoot).to.equal(prevRoot);
  });
});
