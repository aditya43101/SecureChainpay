// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PrivacyVerifier
 * @notice Phase 9 companion smart contract for Privacy-Preserving Vehicle Verification.
 *         Maintains on-chain credential commitments, revocation registries, and ZKP verification receipts
 *         while preserving existing VehiclePassport.sol storage layout and backwards compatibility.
 */
contract PrivacyVerifier {
    // --- Data Types ---

    enum CredentialState {
        NON_EXISTENT,
        ACTIVE,
        REVOKED,
        EXPIRED
    }

    struct OnChainCredential {
        bytes32 credentialId;
        bytes32 rootCommitment;
        address issuer;
        uint256 validFrom;
        uint256 validUntil;
        CredentialState state;
        string revocationReason;
    }

    struct ZkpVerificationReceipt {
        bytes32 sessionId;
        bytes32 vehicleCommitment;
        bytes32 claimTypeHash;
        uint256 threshold;
        bytes32 pedersenCommitment;
        bytes32 nonce;
        address verifier;
        uint256 verifiedAt;
        bool isVerified;
    }

    // --- State Variables ---

    address public admin;
    mapping(bytes32 => OnChainCredential) public credentials;
    bytes32[] public allCredentialIds;

    mapping(bytes32 => ZkpVerificationReceipt) public zkpReceipts;
    bytes32[] public allReceiptSessionIds;

    // --- Events ---

    event CredentialRegistered(
        bytes32 indexed credentialId,
        bytes32 indexed rootCommitment,
        address indexed issuer,
        uint256 validUntil
    );

    event CredentialRevoked(
        bytes32 indexed credentialId,
        address indexed revoker,
        string reason,
        uint256 timestamp
    );

    event ZkpReceiptRecorded(
        bytes32 indexed sessionId,
        bytes32 indexed vehicleCommitment,
        bytes32 claimTypeHash,
        uint256 threshold,
        address indexed verifier,
        bool isVerified,
        uint256 timestamp
    );

    // --- Modifiers ---

    modifier onlyAdmin() {
        require(msg.sender == admin, "Caller is not admin");
        _;
    }

    modifier onlyIssuerOrAdmin(bytes32 credentialId) {
        require(
            msg.sender == credentials[credentialId].issuer || msg.sender == admin,
            "Caller is not issuer or admin"
        );
        _;
    }

    // --- Constructor ---

    constructor() {
        admin = msg.sender;
    }

    // --- Credential Registry Methods ---

    /**
     * @notice Registers a privacy credential root commitment on-chain.
     */
    function registerCredential(
        bytes32 credentialId,
        bytes32 rootCommitment,
        uint256 validUntil
    ) external {
        require(credentialId != bytes32(0), "Invalid credential ID");
        require(rootCommitment != bytes32(0), "Invalid root commitment");
        require(validUntil > block.timestamp, "Expiry must be in the future");
        require(
            credentials[credentialId].state == CredentialState.NON_EXISTENT,
            "Credential already registered"
        );

        credentials[credentialId] = OnChainCredential({
            credentialId: credentialId,
            rootCommitment: rootCommitment,
            issuer: msg.sender,
            validFrom: block.timestamp,
            validUntil: validUntil,
            state: CredentialState.ACTIVE,
            revocationReason: ""
        });

        allCredentialIds.push(credentialId);

        emit CredentialRegistered(credentialId, rootCommitment, msg.sender, validUntil);
    }

    /**
     * @notice Revokes a previously registered privacy credential.
     */
    function revokeCredential(
        bytes32 credentialId,
        string calldata reason
    ) external onlyIssuerOrAdmin(credentialId) {
        require(
            credentials[credentialId].state == CredentialState.ACTIVE,
            "Credential is not active"
        );

        credentials[credentialId].state = CredentialState.REVOKED;
        credentials[credentialId].revocationReason = reason;

        emit CredentialRevoked(credentialId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Checks validity of a registered credential.
     */
    function checkCredentialStatus(
        bytes32 credentialId
    ) external view returns (bool isValid, string memory status, bytes32 rootCommitment) {
        OnChainCredential memory cred = credentials[credentialId];
        if (cred.state == CredentialState.NON_EXISTENT) {
            return (false, "NOT_FOUND", bytes32(0));
        }
        if (cred.state == CredentialState.REVOKED) {
            return (false, "REVOKED", cred.rootCommitment);
        }
        if (block.timestamp > cred.validUntil) {
            return (false, "EXPIRED", cred.rootCommitment);
        }
        return (true, "ACTIVE", cred.rootCommitment);
    }

    // --- Merkle Selective Disclosure On-Chain Verification ---

    /**
     * @notice Verifies a Merkle inclusion proof for a selectively disclosed leaf against an on-chain root.
     */
    function verifySelectiveInclusion(
        bytes32 rootCommitment,
        bytes32 leafHash,
        bytes32[] calldata proof
    ) public pure returns (bool) {
        bytes32 computedHash = leafHash;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = sha256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = sha256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == rootCommitment;
    }

    // --- ZKP Receipt Recording Methods ---

    /**
     * @notice Records an independently verified zero-knowledge proof receipt on-chain.
     */
    function recordZkpReceipt(
        bytes32 sessionId,
        bytes32 vehicleCommitment,
        bytes32 claimTypeHash,
        uint256 threshold,
        bytes32 pedersenCommitment,
        bytes32 nonce,
        bool isVerified
    ) external {
        require(sessionId != bytes32(0), "Invalid session ID");
        require(vehicleCommitment != bytes32(0), "Invalid vehicle commitment");
        require(zkpReceipts[sessionId].sessionId == bytes32(0), "Receipt already recorded");

        zkpReceipts[sessionId] = ZkpVerificationReceipt({
            sessionId: sessionId,
            vehicleCommitment: vehicleCommitment,
            claimTypeHash: claimTypeHash,
            threshold: threshold,
            pedersenCommitment: pedersenCommitment,
            nonce: nonce,
            verifier: msg.sender,
            verifiedAt: block.timestamp,
            isVerified: isVerified
        });

        allReceiptSessionIds.push(sessionId);

        emit ZkpReceiptRecorded(
            sessionId,
            vehicleCommitment,
            claimTypeHash,
            threshold,
            msg.sender,
            isVerified,
            block.timestamp
        );
    }

    /**
     * @notice Retrieves an anchored ZKP verification receipt.
     */
    function getZkpReceipt(
        bytes32 sessionId
    ) external view returns (ZkpVerificationReceipt memory) {
        require(zkpReceipts[sessionId].sessionId != bytes32(0), "Receipt not found");
        return zkpReceipts[sessionId];
    }

    /**
     * @notice Total number of registered credentials.
     */
    function getCredentialCount() external view returns (uint256) {
        return allCredentialIds.length;
    }

    /**
     * @notice Total number of anchored ZKP receipts.
     */
    function getReceiptCount() external view returns (uint256) {
        return allReceiptSessionIds.length;
    }
}
