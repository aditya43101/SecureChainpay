// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURECHAIN PAY — PHASE 3
 * SecureChainAnchor — Compact Immutable Chain-State Anchor Contract
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Design Principles:
 *   1. Compact: stores ONLY cryptographic hashes + chain metadata. No user data.
 *   2. Immutable genesis: once initialized, genesisHash can NEVER change.
 *   3. Sequential: blockNumber must be exactly latestBlockNumber + 1.
 *   4. Continuous: previousHash must equal latestBlockHash.
 *   5. Role-based: three roles — contractAdmin, blockWriter, securityAdmin.
 *   6. Pausable: securityAdmin can freeze commitBlock() for Phase 4 emergency response.
 *   7. Single-init: initialize() reverts if called twice.
 *
 * TRUST HIERARCHY:
 *   Smart Contract (authoritative)
 *     → latestBlockNumber, latestBlockHash, chainRoot, genesisHash
 *   Firestore (mirror/derived)
 *     → block metadata, explorer data, UI state
 *
 * Security Review Coverage:
 *   ✓ Access control: all privileged functions gated by role checks
 *   ✓ No reentrancy surface: state changes before any external calls
 *   ✓ Integer safety: Solidity 0.8.x built-in overflow protection
 *   ✓ Init guard: _initialized flag prevents double initialization
 *   ✓ Zero-value guards: blockHash and newChainRoot must be non-zero
 *   ✓ Pause guard: commitBlock reverts when paused
 *   ✓ Sequence guard: strict blockNumber + previousHash continuity
 *   ✓ No upgradeability: simpler, fully auditable immutable contract
 *   ✓ No user private data on-chain
 *   ✓ No private keys on-chain
 * ═══════════════════════════════════════════════════════════════════════════
 */
contract SecureChainAnchor {

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice Canonical chain identifier (e.g., "securechainpay-global-v1")
    string public chainId;

    /// @notice Chain protocol version (starts at 1)
    uint256 public chainVersion;

    /// @notice SHA-256 hash of the genesis block — anchored ONCE at initialization
    bytes32 public genesisHash;

    /// @notice The block number of the most recently committed block
    uint256 public latestBlockNumber;

    /// @notice The canonical hash of the most recently committed block
    bytes32 public latestBlockHash;

    /// @notice Rolling chain root (cumulative cryptographic commitment of all blocks)
    bytes32 public chainRoot;

    /// @notice Unix timestamp of the last successful block commit
    uint256 public lastCommitTimestamp;

    /// @notice Incremented on each emergency recovery operation (Phase 4 readiness)
    uint256 public recoveryVersion;

    /// @notice When true, commitBlock() reverts — used by Phase 4 emergency response
    bool public paused;

    /// @notice Whether the contract has been initialized
    bool private _initialized;

    // ─── Roles ───────────────────────────────────────────────────────────────

    /// @notice Can set new blockWriter or securityAdmin
    address public contractAdmin;

    /// @notice The only address authorized to call commitBlock()
    address public blockWriter;

    /// @notice Can call pause() and unpause()
    address public securityAdmin;

    // ─── Events ──────────────────────────────────────────────────────────────

    event ChainInitialized(
        string chainId,
        uint256 chainVersion,
        bytes32 indexed genesisHash,
        bytes32 chainRoot,
        address indexed blockWriter,
        uint256 timestamp
    );

    event BlockCommitted(
        uint256 indexed blockNumber,
        bytes32 indexed blockHash,
        bytes32 previousHash,
        bytes32 chainRoot,
        uint256 timestamp
    );

    event WriterChanged(
        address indexed oldWriter,
        address indexed newWriter,
        uint256 timestamp
    );

    event SecurityAdminChanged(
        address indexed oldAdmin,
        address indexed newAdmin,
        uint256 timestamp
    );

    event ContractAdminChanged(
        address indexed oldAdmin,
        address indexed newAdmin,
        uint256 timestamp
    );

    event ChainPaused(address indexed by, uint256 timestamp);
    event ChainUnpaused(address indexed by, uint256 timestamp);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyContractAdmin() {
        require(msg.sender == contractAdmin, "SecureChainAnchor: caller is not contractAdmin");
        _;
    }

    modifier onlyBlockWriter() {
        require(msg.sender == blockWriter, "SecureChainAnchor: caller is not authorized blockWriter");
        _;
    }

    modifier onlySecurityAdmin() {
        require(
            msg.sender == securityAdmin || msg.sender == contractAdmin,
            "SecureChainAnchor: caller is not securityAdmin"
        );
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "SecureChainAnchor: chain is paused");
        _;
    }

    modifier whenInitialized() {
        require(_initialized, "SecureChainAnchor: chain not initialized");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _contractAdmin) {
        require(_contractAdmin != address(0), "SecureChainAnchor: zero contractAdmin");
        contractAdmin = _contractAdmin;
        // All other roles and state set in initialize()
    }

    // ─── Initialization (ONE-TIME) ────────────────────────────────────────────

    /**
     * @notice One-time initialization anchoring the genesis block.
     * @dev    Permanently sets genesisHash and initial chain state.
     *         Cannot be called twice.
     *
     * @param _chainId       Canonical chain identifier string
     * @param _chainVersion  Protocol version (must be > 0)
     * @param _genesisHash   SHA-256 hash of the Phase 2 genesis block (bytes32)
     * @param _genesisChainRoot Initial chain root (equals genesisHash at genesis)
     * @param _blockWriter   Address authorized to commit blocks
     * @param _securityAdmin Address authorized to pause/unpause
     */
    function initialize(
        string calldata _chainId,
        uint256 _chainVersion,
        bytes32 _genesisHash,
        bytes32 _genesisChainRoot,
        address _blockWriter,
        address _securityAdmin
    ) external onlyContractAdmin {
        require(!_initialized, "SecureChainAnchor: already initialized");
        require(bytes(_chainId).length > 0, "SecureChainAnchor: empty chainId");
        require(_chainVersion > 0, "SecureChainAnchor: invalid chainVersion");
        require(_genesisHash != bytes32(0), "SecureChainAnchor: zero genesisHash");
        require(_genesisChainRoot != bytes32(0), "SecureChainAnchor: zero genesisChainRoot");
        require(_blockWriter != address(0), "SecureChainAnchor: zero blockWriter");
        require(_securityAdmin != address(0), "SecureChainAnchor: zero securityAdmin");

        chainId = _chainId;
        chainVersion = _chainVersion;
        genesisHash = _genesisHash;
        latestBlockNumber = 0;
        latestBlockHash = _genesisHash;  // Genesis IS block #0
        chainRoot = _genesisChainRoot;
        blockWriter = _blockWriter;
        securityAdmin = _securityAdmin;
        paused = false;
        _initialized = true;
        lastCommitTimestamp = block.timestamp;
        recoveryVersion = 0;

        emit ChainInitialized(
            _chainId,
            _chainVersion,
            _genesisHash,
            _genesisChainRoot,
            _blockWriter,
            block.timestamp
        );
    }

    // ─── Block Commit ─────────────────────────────────────────────────────────

    /**
     * @notice Commits a new canonical block anchor to the chain.
     * @dev    Enforces full chain continuity:
     *           - caller must be blockWriter
     *           - chain must not be paused
     *           - blockNumber must be exactly latestBlockNumber + 1
     *           - previousHash must equal latestBlockHash
     *           - blockHash must be non-zero
     *           - newChainRoot must be non-zero
     *
     * @param blockNumber   The sequential block number (must == latestBlockNumber + 1)
     * @param blockHash     SHA-256 canonical hash of the new block
     * @param previousHash  Must equal the current latestBlockHash
     * @param newChainRoot  New rolling chain root after including this block
     */
    function commitBlock(
        uint256 blockNumber,
        bytes32 blockHash,
        bytes32 previousHash,
        bytes32 newChainRoot
    )
        external
        onlyBlockWriter
        whenNotPaused
        whenInitialized
    {
        // Sequence enforcement
        require(
            blockNumber == latestBlockNumber + 1,
            "SecureChainAnchor: invalid block number (must be sequential)"
        );

        // Hash chain continuity
        require(
            previousHash == latestBlockHash,
            "SecureChainAnchor: previousHash does not match latestBlockHash"
        );

        // Non-zero guards
        require(blockHash != bytes32(0), "SecureChainAnchor: zero blockHash");
        require(newChainRoot != bytes32(0), "SecureChainAnchor: zero chainRoot");

        // Update canonical chain state
        latestBlockNumber = blockNumber;
        latestBlockHash = blockHash;
        chainRoot = newChainRoot;
        lastCommitTimestamp = block.timestamp;

        emit BlockCommitted(
            blockNumber,
            blockHash,
            previousHash,
            newChainRoot,
            block.timestamp
        );
    }

    // ─── View: Full Chain State ───────────────────────────────────────────────

    /**
     * @notice Returns the full canonical chain state in one call.
     */
    function getChainState() external view returns (
        string memory _chainId,
        uint256 _chainVersion,
        bytes32 _genesisHash,
        uint256 _latestBlockNumber,
        bytes32 _latestBlockHash,
        bytes32 _chainRoot,
        bool _paused,
        uint256 _lastCommitTimestamp,
        uint256 _recoveryVersion,
        bool _initialized_state
    ) {
        return (
            chainId,
            chainVersion,
            genesisHash,
            latestBlockNumber,
            latestBlockHash,
            chainRoot,
            paused,
            lastCommitTimestamp,
            recoveryVersion,
            _initialized
        );
    }

    // ─── Genesis Verification ─────────────────────────────────────────────────

    /**
     * @notice Verifies that a given hash matches the anchored genesis hash.
     * @dev    Used by backend to ensure DB genesis == on-chain genesis.
     */
    function verifyGenesisHash(bytes32 _hash) external view returns (bool) {
        return _initialized && _hash == genesisHash;
    }

    // ─── Pause Mechanism (Phase 4 Readiness) ─────────────────────────────────

    /**
     * @notice Pauses the chain. commitBlock() will revert while paused.
     * @dev    Only securityAdmin or contractAdmin may call.
     */
    function pause() external onlySecurityAdmin whenInitialized {
        require(!paused, "SecureChainAnchor: already paused");
        paused = true;
        emit ChainPaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Unpauses the chain. commitBlock() will work again.
     * @dev    Only securityAdmin or contractAdmin may call.
     */
    function unpause() external onlySecurityAdmin whenInitialized {
        require(paused, "SecureChainAnchor: not paused");
        paused = false;
        emit ChainUnpaused(msg.sender, block.timestamp);
    }

    // ─── Role Management ─────────────────────────────────────────────────────

    /**
     * @notice Transfers the blockWriter role to a new address.
     * @dev    Only contractAdmin may change the writer.
     *         The new writer takes effect immediately.
     */
    function setBlockWriter(address newWriter) external onlyContractAdmin {
        require(newWriter != address(0), "SecureChainAnchor: zero address");
        address old = blockWriter;
        blockWriter = newWriter;
        emit WriterChanged(old, newWriter, block.timestamp);
    }

    /**
     * @notice Transfers the securityAdmin role to a new address.
     */
    function setSecurityAdmin(address newAdmin) external onlyContractAdmin {
        require(newAdmin != address(0), "SecureChainAnchor: zero address");
        address old = securityAdmin;
        securityAdmin = newAdmin;
        emit SecurityAdminChanged(old, newAdmin, block.timestamp);
    }

    /**
     * @notice Transfers the contractAdmin role to a new address.
     * @dev    Two-step transfer is NOT implemented for simplicity; the admin
     *         should verify the new address before calling this.
     */
    function setContractAdmin(address newAdmin) external onlyContractAdmin {
        require(newAdmin != address(0), "SecureChainAnchor: zero address");
        address old = contractAdmin;
        contractAdmin = newAdmin;
        emit ContractAdminChanged(old, newAdmin, block.timestamp);
    }

    // ─── Phase 4 Readiness: Recovery Version Bump ────────────────────────────

    /**
     * @notice Increments recoveryVersion — signals a recovery event has occurred.
     * @dev    Phase 4 self-healing will call this during recovery operations.
     *         contractAdmin only.
     */
    function bumpRecoveryVersion() external onlyContractAdmin whenInitialized {
        recoveryVersion += 1;
    }
}
