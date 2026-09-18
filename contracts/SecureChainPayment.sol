// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURECHAIN PAY — FAULT-TOLERANT HYBRID PAYMENT ORCHESTRATION CONTRACT
 * SecureChainPayment — Authoritative On-Chain Payment Lifecycle & Anchor
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Core Guarantees:
 *   1. Exactly-Once: Globally unique bytes32 transactionId cannot be reused.
 *   2. Two-Phase Reservation:
 *        Phase A: initializePayment reserves/locks funds; recipient receives NOTHING.
 *        Phase B: finalizePayment validates and credits recipient.
 *   3. Expiry & Cancellation:
 *        If expired or cancelled, locked funds return to sender; recipient remains uncredited.
 *   4. Merkle Anchoring:
 *        Batches of off-chain ledger records are cryptographically anchored.
 *   5. Safety:
 *        Reentrancy-guarded, pausable by security admin, checks-effects-interactions pattern.
 * ═══════════════════════════════════════════════════════════════════════════
 */
contract SecureChainPayment {

    // ─── Enums & Structs ──────────────────────────────────────────────────────

    enum PaymentState {
        NONEXISTENT,
        RESERVED,
        FINALIZED,
        CANCELLED
    }

    struct Payment {
        bytes32 transactionId;
        address sender;
        address recipient;
        uint256 amount;
        PaymentState state;
        uint256 createdAt;
        uint256 expiry;
        uint256 lockedAmount;
        string currency;
    }

    struct MerkleBatchRecord {
        bytes32 batchId;
        bytes32 merkleRoot;
        uint256 transactionCount;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // ─── State Variables ─────────────────────────────────────────────────────

    address public owner;
    address public securityAdmin;
    address public relayerGateway;
    bool public paused;
    uint256 private _reentrancyStatus;

    // payment mappings
    mapping(bytes32 => Payment) public payments;
    bytes32[] public allPaymentIds;

    // accounting: deposit balance per address (for native or internal ledger tokens)
    mapping(address => uint256) public availableBalance;
    mapping(address => uint256) public reservedBalance;

    // merkle batch mappings
    mapping(bytes32 => MerkleBatchRecord) public merkleBatches;
    bytes32[] public batchIds;

    // ─── Events ──────────────────────────────────────────────────────────────

    event PaymentInitialized(
        bytes32 indexed transactionId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string currency,
        uint256 expiry,
        uint256 timestamp
    );

    event PaymentFinalized(
        bytes32 indexed transactionId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    event PaymentCancelled(
        bytes32 indexed transactionId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string reason,
        uint256 timestamp
    );

    event FundsDeposited(address indexed account, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(address indexed account, uint256 amount, uint256 timestamp);

    event MerkleBatchAnchored(
        bytes32 indexed batchId,
        bytes32 indexed merkleRoot,
        uint256 transactionCount,
        uint256 timestamp
    );

    event SecurityAdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event RelayerGatewayChanged(address indexed oldGateway, address indexed newGateway);
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "SecureChainPayment: caller is not owner");
        _;
    }

    modifier onlySecurityAdmin() {
        require(
            msg.sender == securityAdmin || msg.sender == owner,
            "SecureChainPayment: caller is not securityAdmin"
        );
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || msg.sender == relayerGateway || msg.sender == securityAdmin,
            "SecureChainPayment: caller is not authorized"
        );
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "SecureChainPayment: contract is paused");
        _;
    }

    modifier nonReentrant() {
        require(_reentrancyStatus != 2, "SecureChainPayment: reentrant call");
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _securityAdmin, address _relayerGateway) {
        require(_securityAdmin != address(0), "Zero securityAdmin");
        owner = msg.sender;
        securityAdmin = _securityAdmin;
        relayerGateway = _relayerGateway != address(0) ? _relayerGateway : msg.sender;
        _reentrancyStatus = 1;
        paused = false;
    }

    // ─── Deposit / Balance Management ─────────────────────────────────────────

    /**
     * @notice Deposit funds into the contract for on-chain payment reservations.
     */
    function deposit() external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Deposit must be positive");
        availableBalance[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Deposit funds on behalf of a specific user address (e.g., via relayer/fiat gateway).
     */
    function depositFor(address beneficiary) external payable onlyAuthorized whenNotPaused nonReentrant {
        require(beneficiary != address(0), "Zero beneficiary");
        require(msg.value > 0, "Deposit must be positive");
        availableBalance[beneficiary] += msg.value;
        emit FundsDeposited(beneficiary, msg.value, block.timestamp);
    }

    /**
     * @notice Credit accounting balance directly for testing/relayed ledger integration.
     */
    function creditAccountingBalance(address account, uint256 amount) external onlyAuthorized whenNotPaused {
        require(account != address(0), "Zero account");
        availableBalance[account] += amount;
        emit FundsDeposited(account, amount, block.timestamp);
    }

    /**
     * @notice Withdraw available (unreserved) funds.
     */
    function withdraw(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(availableBalance[msg.sender] >= amount, "Insufficient available balance");

        availableBalance[msg.sender] -= amount;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdrawal transfer failed");

        emit FundsWithdrawn(msg.sender, amount, block.timestamp);
    }

    // ─── Two-Phase Payment Orchestration ──────────────────────────────────────

    /**
     * @notice Phase 1: Initialize Payment and Lock Funds.
     * @dev    Sender funds are moved from Available to Reserved.
     *         Recipient does NOT receive funds yet.
     */
    function initializePayment(
        bytes32 transactionId,
        address recipient,
        uint256 amount,
        string calldata currency,
        uint256 expiry
    ) external whenNotPaused nonReentrant {
        _initializePaymentInternal(transactionId, msg.sender, recipient, amount, currency, expiry);
    }

    /**
     * @notice Phase 1 (Relayed): Authorized gateway initializes on behalf of sender.
     */
    function initializePaymentFor(
        bytes32 transactionId,
        address sender,
        address recipient,
        uint256 amount,
        string calldata currency,
        uint256 expiry
    ) external onlyAuthorized whenNotPaused nonReentrant {
        _initializePaymentInternal(transactionId, sender, recipient, amount, currency, expiry);
    }

    function _initializePaymentInternal(
        bytes32 transactionId,
        address sender,
        address recipient,
        uint256 amount,
        string calldata currency,
        uint256 expiry
    ) internal {
        require(transactionId != bytes32(0), "Zero transactionId");
        require(sender != address(0), "Zero sender");
        require(recipient != address(0), "Zero recipient");
        require(recipient != sender, "Recipient cannot be sender");
        require(amount > 0, "Amount must be positive");
        require(expiry > block.timestamp, "Expiry must be in the future");
        require(payments[transactionId].state == PaymentState.NONEXISTENT, "Payment already exists");
        require(availableBalance[sender] >= amount, "Insufficient available balance to reserve");

        // Checks-Effects: Move sender funds to RESERVED
        availableBalance[sender] -= amount;
        reservedBalance[sender] += amount;

        payments[transactionId] = Payment({
            transactionId: transactionId,
            sender: sender,
            recipient: recipient,
            amount: amount,
            state: PaymentState.RESERVED,
            createdAt: block.timestamp,
            expiry: expiry,
            lockedAmount: amount,
            currency: currency
        });

        allPaymentIds.push(transactionId);

        // NOTE: Recipient balance is NOT credited here.
        emit PaymentInitialized(
            transactionId,
            sender,
            recipient,
            amount,
            currency,
            expiry,
            block.timestamp
        );
    }

    /**
     * @notice Phase 2: Finalize Payment.
     * @dev    Validates reservation, ensures transaction is still valid/unexpired,
     *         deducts reserved funds from sender, and credits recipient.
     */
    function finalizePayment(bytes32 transactionId) external whenNotPaused nonReentrant {
        Payment storage payment = payments[transactionId];
        require(payment.state == PaymentState.RESERVED, "Payment is not in RESERVED state");
        require(block.timestamp <= payment.expiry, "Payment reservation has expired");

        // Authorization: Sender, Relayer, Owner, or Recipient can trigger finalization
        require(
            msg.sender == payment.sender ||
            msg.sender == payment.recipient ||
            msg.sender == owner ||
            msg.sender == relayerGateway,
            "Caller not authorized to finalize"
        );

        address sender = payment.sender;
        address recipient = payment.recipient;
        uint256 amount = payment.amount;

        // Transition state to FINALIZED before transferring
        payment.state = PaymentState.FINALIZED;
        payment.lockedAmount = 0;

        // Deduct from sender's reserved balance
        reservedBalance[sender] -= amount;
        // Credit recipient's available balance
        availableBalance[recipient] += amount;

        emit PaymentFinalized(transactionId, sender, recipient, amount, block.timestamp);
    }

    /**
     * @notice Cancel Payment and Release Reserved Funds.
     * @dev    Can be triggered by sender/admin, or by anyone if reservation expired.
     *         Releases funds back from Reserved to Available. Recipient receives nothing.
     */
    function cancelPayment(bytes32 transactionId, string calldata reason) external whenNotPaused nonReentrant {
        Payment storage payment = payments[transactionId];
        require(payment.state == PaymentState.RESERVED, "Payment is not in RESERVED state");

        bool isExpired = block.timestamp > payment.expiry;
        bool isAuthorizedCaller = (
            msg.sender == payment.sender ||
            msg.sender == owner ||
            msg.sender == securityAdmin ||
            msg.sender == relayerGateway
        );

        require(isExpired || isAuthorizedCaller, "Not authorized to cancel active unexpired payment");

        address sender = payment.sender;
        address recipient = payment.recipient;
        uint256 amount = payment.amount;

        // Transition state to CANCELLED
        payment.state = PaymentState.CANCELLED;
        payment.lockedAmount = 0;

        // Return funds from reserved back to sender's available balance
        reservedBalance[sender] -= amount;
        availableBalance[sender] += amount;

        emit PaymentCancelled(transactionId, sender, recipient, amount, reason, block.timestamp);
    }

    // ─── Query Views ─────────────────────────────────────────────────────────

    function getPayment(bytes32 transactionId) external view returns (Payment memory) {
        require(payments[transactionId].state != PaymentState.NONEXISTENT, "Payment not found");
        return payments[transactionId];
    }

    function isPaymentFinalized(bytes32 transactionId) external view returns (bool) {
        return payments[transactionId].state == PaymentState.FINALIZED;
    }

    function isPaymentReserved(bytes32 transactionId) external view returns (bool) {
        return payments[transactionId].state == PaymentState.RESERVED;
    }

    function isPaymentCancelled(bytes32 transactionId) external view returns (bool) {
        return payments[transactionId].state == PaymentState.CANCELLED;
    }

    function getTotalPayments() external view returns (uint256) {
        return allPaymentIds.length;
    }

    // ─── Merkle Checkpoint Anchoring ─────────────────────────────────────────

    /**
     * @notice Anchor an off-chain Merkle batch root to provide cryptographic commitment.
     */
    function recordMerkleBatch(
        bytes32 _batchId,
        bytes32 _merkleRoot,
        uint256 _transactionCount
    ) external onlyAuthorized whenNotPaused {
        require(merkleBatches[_batchId].timestamp == 0, "Batch already anchored");
        require(_merkleRoot != bytes32(0), "Invalid Merkle root");

        merkleBatches[_batchId] = MerkleBatchRecord({
            batchId: _batchId,
            merkleRoot: _merkleRoot,
            transactionCount: _transactionCount,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        batchIds.push(_batchId);

        emit MerkleBatchAnchored(_batchId, _merkleRoot, _transactionCount, block.timestamp);
    }

    function getMerkleBatch(bytes32 _batchId) external view returns (MerkleBatchRecord memory) {
        require(merkleBatches[_batchId].timestamp != 0, "Batch not found");
        return merkleBatches[_batchId];
    }

    function getMerkleBatchCount() external view returns (uint256) {
        return batchIds.length;
    }

    // ─── Emergency Pause & Admin Controls ───────────────────────────────────

    function pause() external onlySecurityAdmin {
        require(!paused, "Already paused");
        paused = true;
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlySecurityAdmin {
        require(paused, "Not paused");
        paused = false;
        emit ContractUnpaused(msg.sender);
    }

    function setSecurityAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Zero address");
        address old = securityAdmin;
        securityAdmin = newAdmin;
        emit SecurityAdminChanged(old, newAdmin);
    }

    function setRelayerGateway(address newGateway) external onlyOwner {
        require(newGateway != address(0), "Zero address");
        address old = relayerGateway;
        relayerGateway = newGateway;
        emit RelayerGatewayChanged(old, newGateway);
    }
}
