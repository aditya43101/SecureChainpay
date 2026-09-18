const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SecureChainPayment — Two-Phase Fault-Tolerant Lifecycle & Anchoring", function () {
  let paymentContract;
  let owner, securityAdmin, relayer, sender, recipient, stranger;

  const toBytes32 = (str) => ethers.keccak256(ethers.toUtf8Bytes(str));
  const TX_ID_1 = toBytes32("SC_PAY_1001");
  const TX_ID_2 = toBytes32("SC_PAY_1002");
  const TX_ID_3 = toBytes32("SC_PAY_1003");
  const BATCH_ID_1 = toBytes32("BATCH_1");
  const MERKLE_ROOT_1 = toBytes32("MERKLE_ROOT_1");

  beforeEach(async function () {
    [owner, securityAdmin, relayer, sender, recipient, stranger] = await ethers.getSigners();

    const SecureChainPayment = await ethers.getContractFactory("SecureChainPayment");
    paymentContract = await SecureChainPayment.deploy(securityAdmin.address, relayer.address);
    await paymentContract.waitForDeployment();

    // Fund sender account with 10 ETH inside the contract balance
    await paymentContract.connect(sender).deposit({ value: ethers.parseEther("10.0") });
  });

  describe("Deposit & Initial State", function () {
    it("should correctly record deposit in available balance", async function () {
      const available = await paymentContract.availableBalance(sender.address);
      const reserved = await paymentContract.reservedBalance(sender.address);
      expect(available).to.equal(ethers.parseEther("10.0"));
      expect(reserved).to.equal(0n);
    });

    it("should allow withdrawal of available funds", async function () {
      await paymentContract.connect(sender).withdraw(ethers.parseEther("2.0"));
      const available = await paymentContract.availableBalance(sender.address);
      expect(available).to.equal(ethers.parseEther("8.0"));
    });
  });

  describe("Phase 1: initializePayment (Fund Reservation)", function () {
    it("should reserve funds on-chain without crediting recipient", async function () {
      const amount = ethers.parseEther("3.0");
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + 3600; // 1 hour

      const tx = await paymentContract.connect(sender).initializePayment(
        TX_ID_1,
        recipient.address,
        amount,
        "HSCT",
        expiry
      );

      await expect(tx)
        .to.emit(paymentContract, "PaymentInitialized")
        .withArgs(TX_ID_1, sender.address, recipient.address, amount, "HSCT", expiry, (await ethers.provider.getBlock("latest")).timestamp);

      // Verify sender balances
      const senderAvailable = await paymentContract.availableBalance(sender.address);
      const senderReserved = await paymentContract.reservedBalance(sender.address);
      expect(senderAvailable).to.equal(ethers.parseEther("7.0"));
      expect(senderReserved).to.equal(ethers.parseEther("3.0"));

      // CRITICAL: Recipient must NOT receive funds yet!
      const recipientAvailable = await paymentContract.availableBalance(recipient.address);
      expect(recipientAvailable).to.equal(0n);

      // Verify payment struct
      const payment = await paymentContract.getPayment(TX_ID_1);
      expect(payment.state).to.equal(1n); // RESERVED
      expect(payment.amount).to.equal(amount);
      expect(payment.lockedAmount).to.equal(amount);
      expect(payment.recipient).to.equal(recipient.address);
    });

    it("should prevent duplicate initialization with same transactionId", async function () {
      const amount = ethers.parseEther("2.0");
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + 3600;

      await paymentContract.connect(sender).initializePayment(
        TX_ID_1,
        recipient.address,
        amount,
        "HSCT",
        expiry
      );

      await expect(
        paymentContract.connect(sender).initializePayment(
          TX_ID_1,
          recipient.address,
          amount,
          "HSCT",
          expiry
        )
      ).to.be.revertedWith("Payment already exists");
    });

    it("should revert if sender does not have sufficient available balance", async function () {
      const excessAmount = ethers.parseEther("15.0");
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + 3600;

      await expect(
        paymentContract.connect(sender).initializePayment(
          TX_ID_1,
          recipient.address,
          excessAmount,
          "HSCT",
          expiry
        )
      ).to.be.revertedWith("Insufficient available balance to reserve");
    });
  });

  describe("Phase 2: finalizePayment", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("4.0");
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + 3600;

      await paymentContract.connect(sender).initializePayment(
        TX_ID_1,
        recipient.address,
        amount,
        "HSCT",
        expiry
      );
    });

    it("should successfully finalize payment and credit recipient", async function () {
      const amount = ethers.parseEther("4.0");

      const tx = await paymentContract.connect(sender).finalizePayment(TX_ID_1);

      await expect(tx)
        .to.emit(paymentContract, "PaymentFinalized")
        .withArgs(TX_ID_1, sender.address, recipient.address, amount, (await ethers.provider.getBlock("latest")).timestamp);

      // Sender reserved balance decreased, available unchanged from 6 ETH
      const senderAvailable = await paymentContract.availableBalance(sender.address);
      const senderReserved = await paymentContract.reservedBalance(sender.address);
      expect(senderAvailable).to.equal(ethers.parseEther("6.0"));
      expect(senderReserved).to.equal(0n);

      // Recipient is now credited!
      const recipientAvailable = await paymentContract.availableBalance(recipient.address);
      expect(recipientAvailable).to.equal(amount);

      // State is FINALIZED
      const payment = await paymentContract.getPayment(TX_ID_1);
      expect(payment.state).to.equal(2n); // FINALIZED
      expect(payment.lockedAmount).to.equal(0n);
    });

    it("should reject double finalization", async function () {
      await paymentContract.connect(sender).finalizePayment(TX_ID_1);

      await expect(
        paymentContract.connect(sender).finalizePayment(TX_ID_1)
      ).to.be.revertedWith("Payment is not in RESERVED state");
    });

    it("should allow relayer to finalize payment on behalf of participants", async function () {
      await paymentContract.connect(relayer).finalizePayment(TX_ID_1);
      const isFinalized = await paymentContract.isPaymentFinalized(TX_ID_1);
      expect(isFinalized).to.be.true;
    });

    it("should reject unauthorized caller trying to finalize", async function () {
      await expect(
        paymentContract.connect(stranger).finalizePayment(TX_ID_1)
      ).to.be.revertedWith("Caller not authorized to finalize");
    });
  });

  describe("Cancellation & Expiry", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("3.0");
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + 3600;

      await paymentContract.connect(sender).initializePayment(
        TX_ID_1,
        recipient.address,
        amount,
        "HSCT",
        expiry
      );
    });

    it("should allow sender to cancel unexpired payment and recover funds", async function () {
      const tx = await paymentContract.connect(sender).cancelPayment(TX_ID_1, "User cancelled");

      await expect(tx)
        .to.emit(paymentContract, "PaymentCancelled")
        .withArgs(TX_ID_1, sender.address, recipient.address, ethers.parseEther("3.0"), "User cancelled", (await ethers.provider.getBlock("latest")).timestamp);

      // Funds returned from reserved to available
      const senderAvailable = await paymentContract.availableBalance(sender.address);
      const senderReserved = await paymentContract.reservedBalance(sender.address);
      expect(senderAvailable).to.equal(ethers.parseEther("10.0"));
      expect(senderReserved).to.equal(0n);

      // Recipient receives 0
      const recipientAvailable = await paymentContract.availableBalance(recipient.address);
      expect(recipientAvailable).to.equal(0n);

      const isCancelled = await paymentContract.isPaymentCancelled(TX_ID_1);
      expect(isCancelled).to.be.true;
    });

    it("should prevent finalization after cancellation", async function () {
      await paymentContract.connect(sender).cancelPayment(TX_ID_1, "Cancelled");

      await expect(
        paymentContract.connect(sender).finalizePayment(TX_ID_1)
      ).to.be.revertedWith("Payment is not in RESERVED state");
    });

    it("should prevent cancellation after finalization", async function () {
      await paymentContract.connect(sender).finalizePayment(TX_ID_1);

      await expect(
        paymentContract.connect(sender).cancelPayment(TX_ID_1, "Cancel after finalize")
      ).to.be.revertedWith("Payment is not in RESERVED state");
    });

    it("should allow anyone to cancel an expired payment", async function () {
      // Fast-forward time past expiry
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // Stranger can cancel expired payment to release sender funds
      await paymentContract.connect(stranger).cancelPayment(TX_ID_1, "Expired release");

      const senderAvailable = await paymentContract.availableBalance(sender.address);
      expect(senderAvailable).to.equal(ethers.parseEther("10.0"));
    });
  });

  describe("Merkle Batch Anchoring", function () {
    it("should allow authorized relayer to anchor off-chain Merkle batch", async function () {
      const tx = await paymentContract.connect(relayer).recordMerkleBatch(BATCH_ID_1, MERKLE_ROOT_1, 100);

      await expect(tx)
        .to.emit(paymentContract, "MerkleBatchAnchored")
        .withArgs(BATCH_ID_1, MERKLE_ROOT_1, 100n, (await ethers.provider.getBlock("latest")).timestamp);

      const batch = await paymentContract.getMerkleBatch(BATCH_ID_1);
      expect(batch.merkleRoot).to.equal(MERKLE_ROOT_1);
      expect(batch.transactionCount).to.equal(100n);
    });

    it("should reject duplicate batch ID anchoring", async function () {
      await paymentContract.connect(relayer).recordMerkleBatch(BATCH_ID_1, MERKLE_ROOT_1, 100);

      await expect(
        paymentContract.connect(relayer).recordMerkleBatch(BATCH_ID_1, MERKLE_ROOT_1, 100)
      ).to.be.revertedWith("Batch already anchored");
    });
  });

  describe("Emergency Controls", function () {
    it("should allow security admin to pause and block operations", async function () {
      await paymentContract.connect(securityAdmin).pause();

      await expect(
        paymentContract.connect(sender).deposit({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("SecureChainPayment: contract is paused");

      await paymentContract.connect(securityAdmin).unpause();
      await expect(
        paymentContract.connect(sender).deposit({ value: ethers.parseEther("1.0") })
      ).to.not.be.reverted;
    });
  });
});
