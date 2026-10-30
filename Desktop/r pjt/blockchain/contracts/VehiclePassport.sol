// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VehiclePassport
 * @notice Core smart contract for Blockchain Vehicle Passport managing on-chain
 * identities, vehicle record proofs, and tamper-evident lifecycle anchors.
 */
contract VehiclePassport is Ownable {
    // ------------------------------------------------------------------------
    // DATA STRUCTURES
    // ------------------------------------------------------------------------

    struct BlockchainUser {
        string blockchainUserId;   // e.g. USR-000001
        bytes32 userReferenceHash; // SHA-256 of application Firebase UID (zero personal data)
        address walletAddress;     // Associated blockchain address
        string role;               // VEHICLE_OWNER, GARAGE, etc.
        uint256 createdAt;         // Block timestamp
        bool active;               // Active status
    }

    struct BlockchainVehicle {
        string blockchainVehicleId;   // e.g. VEH-000001
        bytes32 vehicleRecordHash;    // SHA-256 canonical hash of vehicle specifications
        string passportId;            // e.g. VP-000001
        address ownerAddress;         // Owner's blockchain address
        uint256 createdAt;            // Block timestamp
        bool active;                  // Active status
    }

    struct BlockchainRecord {
        string recordId;              // e.g. REC-000001
        string blockchainVehicleId;   // Target vehicle
        string recordType;            // VEHICLE_CREATED, SERVICE, ACCIDENT, etc.
        bytes32 recordHash;           // Cryptographic proof hash
        address actorAddress;         // Originating entity
        uint256 timestamp;            // Block timestamp
    }

    struct BlockchainBatch {
        bytes32 batchId;              // Unique 32-byte batch identifier
        bytes32 merkleRoot;           // Root of the Merkle Tree
        uint256 leafCount;            // Number of records committed in batch
        bytes32 metadataHash;         // Hash of batch metadata
        address actorAddress;         // Originating signer
        uint256 timestamp;            // Block timestamp
        uint256 blockNumber;          // Block number of anchor
        bool active;                  // Confirmation status
    }

    // ------------------------------------------------------------------------
    // STORAGE STATE
    // ------------------------------------------------------------------------

    // User Mappings
    mapping(string => BlockchainUser) private usersById;
    mapping(bytes32 => string) private userIdByReferenceHash;
    mapping(address => string) private userIdByAddress;
    string[] public allUserIds;

    // Vehicle Mappings
    mapping(string => BlockchainVehicle) private vehiclesById;
    mapping(string => string) private vehicleIdByPassportId;
    mapping(address => string[]) private vehicleIdsByOwner;
    string[] public allVehicleIds;

    // Record Mappings
    mapping(string => BlockchainRecord) private recordsById;
    mapping(string => string[]) private recordIdsByVehicle;
    string[] public allRecordIds;

    // Batch Mappings (Phase 6)
    mapping(bytes32 => BlockchainBatch) private batchesById;
    bytes32[] public allBatchIds;

    // ------------------------------------------------------------------------
    // EVENTS
    // ------------------------------------------------------------------------

    event UserInitialized(
        string indexed blockchainUserId,
        bytes32 indexed userReferenceHash,
        address indexed userAddress,
        string role,
        uint256 timestamp
    );

    event VehicleRegistered(
        string indexed blockchainVehicleId,
        bytes32 indexed vehicleRecordHash,
        address indexed ownerAddress,
        string passportId,
        uint256 timestamp
    );

    event VehicleOwnershipTransferred(
        string indexed blockchainVehicleId,
        address indexed previousOwner,
        address indexed newOwner,
        bytes32 recordHash,
        uint256 timestamp
    );


    event RecordAnchored(
        string indexed recordId,
        string indexed blockchainVehicleId,
        string recordType,
        bytes32 recordHash,
        address actor,
        uint256 timestamp
    );

    event BatchAnchored(
        bytes32 indexed batchId,
        bytes32 indexed merkleRoot,
        uint256 leafCount,
        bytes32 metadataHash,
        address indexed actor,
        uint256 timestamp
    );


    // ------------------------------------------------------------------------
    // CONSTRUCTOR
    // ------------------------------------------------------------------------

    constructor() Ownable(msg.sender) {}

    // ------------------------------------------------------------------------
    // USER REGISTRY FUNCTIONS
    // ------------------------------------------------------------------------

    /**
     * @notice Initializes a user identity on the blockchain.
     * @dev Only callable by authorized backend authority.
     */
    function initializeUser(
        string memory userId,
        bytes32 userReferenceHash,
        address userWallet,
        string memory role
    ) external onlyOwner {
        require(bytes(userId).length > 0, "User ID cannot be empty");
        require(userReferenceHash != bytes32(0), "User reference hash cannot be zero");
        require(!usersById[userId].active, "User already registered");
        require(bytes(userIdByReferenceHash[userReferenceHash]).length == 0, "User reference hash already registered");

        usersById[userId] = BlockchainUser({
            blockchainUserId: userId,
            userReferenceHash: userReferenceHash,
            walletAddress: userWallet,
            role: role,
            createdAt: block.timestamp,
            active: true
        });

        userIdByReferenceHash[userReferenceHash] = userId;
        if (userWallet != address(0)) {
          userIdByAddress[userWallet] = userId;
        }
        allUserIds.push(userId);

        emit UserInitialized(userId, userReferenceHash, userWallet, role, block.timestamp);
    }

    function getUserById(string memory userId) external view returns (BlockchainUser memory) {
        require(usersById[userId].active, "User does not exist");
        return usersById[userId];
    }

    function getUserByReferenceHash(bytes32 userHash) external view returns (BlockchainUser memory) {
        string memory userId = userIdByReferenceHash[userHash];
        require(bytes(userId).length > 0, "User reference hash not found");
        return usersById[userId];
    }

    function isUserRegistered(string memory userId) external view returns (bool) {
        return usersById[userId].active;
    }

    function getUserCount() external view returns (uint256) {
        return allUserIds.length;
    }

    // ------------------------------------------------------------------------
    // VEHICLE REGISTRY FUNCTIONS
    // ------------------------------------------------------------------------

    /**
     * @notice Registers a vehicle's immutable cryptographic proof on the blockchain.
     * @dev Supports 1 Owner -> Multiple Vehicles.
     */
    function registerVehicle(
        string memory vehicleId,
        bytes32 recordHash,
        string memory passportId,
        address ownerWallet
    ) external onlyOwner {
        require(bytes(vehicleId).length > 0, "Vehicle ID cannot be empty");
        require(recordHash != bytes32(0), "Vehicle record hash cannot be zero");
        require(bytes(passportId).length > 0, "Passport ID cannot be empty");
        require(!vehiclesById[vehicleId].active, "Vehicle already registered");
        require(bytes(vehicleIdByPassportId[passportId]).length == 0, "Passport ID already registered");

        vehiclesById[vehicleId] = BlockchainVehicle({
            blockchainVehicleId: vehicleId,
            vehicleRecordHash: recordHash,
            passportId: passportId,
            ownerAddress: ownerWallet,
            createdAt: block.timestamp,
            active: true
        });

        vehicleIdByPassportId[passportId] = vehicleId;
        vehicleIdsByOwner[ownerWallet].push(vehicleId);
        allVehicleIds.push(vehicleId);

        emit VehicleRegistered(vehicleId, recordHash, ownerWallet, passportId, block.timestamp);
    }

    function getVehicleById(string memory vehicleId) external view returns (BlockchainVehicle memory) {
        require(vehiclesById[vehicleId].active, "Vehicle does not exist");
        return vehiclesById[vehicleId];
    }

    function getVehicleByPassportId(string memory passportId) external view returns (BlockchainVehicle memory) {
        string memory vehicleId = vehicleIdByPassportId[passportId];
        require(bytes(vehicleId).length > 0, "Passport ID not found");
        return vehiclesById[vehicleId];
    }

    function getVehiclesByOwner(address owner) external view returns (string[] memory) {
        return vehicleIdsByOwner[owner];
    }

    function isVehicleRegistered(string memory vehicleId) external view returns (bool) {
        return vehiclesById[vehicleId].active;
    }

    function getVehicleCount() external view returns (uint256) {
        return allVehicleIds.length;
    }

    /**
     * @notice Transfers ownership of a vehicle on-chain and anchors the transfer proof.
     */
    function transferVehicleOwnership(
        string memory vehicleId,
        address newOwnerAddress,
        bytes32 transferRecordHash,
        string memory recordId
    ) external onlyOwner {
        require(vehiclesById[vehicleId].active, "Vehicle must be registered first");
        require(newOwnerAddress != address(0), "New owner address cannot be zero");
        require(transferRecordHash != bytes32(0), "Transfer hash cannot be zero");
        require(bytes(recordId).length > 0, "Record ID cannot be empty");
        require(recordsById[recordId].timestamp == 0, "Record ID already anchored");

        address previousOwner = vehiclesById[vehicleId].ownerAddress;
        require(newOwnerAddress != previousOwner, "Cannot transfer vehicle to current owner");
        vehiclesById[vehicleId].ownerAddress = newOwnerAddress;
        vehicleIdsByOwner[newOwnerAddress].push(vehicleId);

        recordsById[recordId] = BlockchainRecord({
            recordId: recordId,
            blockchainVehicleId: vehicleId,
            recordType: "OWNERSHIP_TRANSFERRED",
            recordHash: transferRecordHash,
            actorAddress: msg.sender,
            timestamp: block.timestamp
        });

        recordIdsByVehicle[vehicleId].push(recordId);
        allRecordIds.push(recordId);

        emit VehicleOwnershipTransferred(vehicleId, previousOwner, newOwnerAddress, transferRecordHash, block.timestamp);
        emit RecordAnchored(recordId, vehicleId, "OWNERSHIP_TRANSFERRED", transferRecordHash, msg.sender, block.timestamp);
    }

    // ------------------------------------------------------------------------
    // RECORD REGISTRY FUNCTIONS (LIFECYCLE PROOF ANCHORING)
    // ------------------------------------------------------------------------


    /**
     * @notice Anchors an immutable event record for a vehicle (e.g. creation, service, transfer).
     */
    function anchorRecord(
        string memory recordId,
        string memory vehicleId,
        string memory recordType,
        bytes32 recordHash
    ) external onlyOwner {
        require(bytes(recordId).length > 0, "Record ID cannot be empty");
        require(vehiclesById[vehicleId].active, "Vehicle must be registered first");
        require(recordHash != bytes32(0), "Record hash cannot be zero");
        require(recordsById[recordId].timestamp == 0, "Record ID already anchored");

        recordsById[recordId] = BlockchainRecord({
            recordId: recordId,
            blockchainVehicleId: vehicleId,
            recordType: recordType,
            recordHash: recordHash,
            actorAddress: msg.sender,
            timestamp: block.timestamp
        });

        recordIdsByVehicle[vehicleId].push(recordId);
        allRecordIds.push(recordId);

        emit RecordAnchored(recordId, vehicleId, recordType, recordHash, msg.sender, block.timestamp);
    }

    function getRecord(string memory recordId) external view returns (BlockchainRecord memory) {
        require(recordsById[recordId].timestamp > 0, "Record not found");
        return recordsById[recordId];
    }

    function getVehicleRecords(string memory vehicleId) external view returns (string[] memory) {
        return recordIdsByVehicle[vehicleId];
    }

    // ------------------------------------------------------------------------
    // MERKLE BATCH REGISTRY FUNCTIONS (PHASE 6)
    // ------------------------------------------------------------------------

    /**
     * @notice Anchors a Merkle tree root representing a batch of lifecycle records.
     * @param batchId Unique 32-byte identifier for the batch
     * @param merkleRoot Cryptographic root of the batch Merkle Tree
     * @param leafCount Total count of records committed in the batch
     * @param metadataHash Hash of batch generation parameters and metadata
     */
    function anchorBatch(
        bytes32 batchId,
        bytes32 merkleRoot,
        uint256 leafCount,
        bytes32 metadataHash
    ) external onlyOwner {
        require(batchId != bytes32(0), "Batch ID cannot be zero");
        require(merkleRoot != bytes32(0), "Merkle root cannot be zero");
        require(leafCount > 0, "Leaf count must be positive");
        require(!batchesById[batchId].active, "Batch ID already anchored");

        batchesById[batchId] = BlockchainBatch({
            batchId: batchId,
            merkleRoot: merkleRoot,
            leafCount: leafCount,
            metadataHash: metadataHash,
            actorAddress: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number,
            active: true
        });

        allBatchIds.push(batchId);

        emit BatchAnchored(
            batchId,
            merkleRoot,
            leafCount,
            metadataHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Retrieves committed batch metadata by its 32-byte batch ID.
     */
    function getBatch(bytes32 batchId) external view returns (BlockchainBatch memory) {
        require(batchesById[batchId].active, "Batch not found");
        return batchesById[batchId];
    }

    /**
     * @notice Checks if a batch has been anchored on-chain.
     */
    function isBatchAnchored(bytes32 batchId) external view returns (bool) {
        return batchesById[batchId].active;
    }

    /**
     * @notice Returns total number of anchored batches.
     */
    function getBatchCount() external view returns (uint256) {
        return allBatchIds.length;
    }

    /**
     * @notice Returns array of all anchored batch IDs.
     */
    function getAllBatchIds() external view returns (bytes32[] memory) {
        return allBatchIds;
    }

    /**
     * @notice Verifies a Merkle inclusion proof using sorted-pair Keccak-256.
     * @param leaf Domain-separated leaf hash
     * @param proof Array of sibling 32-byte hashes
     * @param root Expected Merkle root
     */
    function verifyInclusionProof(
        bytes32 leaf,
        bytes32[] calldata proof,
        bytes32 root
    ) public pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }

    /**
     * @notice Verifies whether a record leaf is included in an on-chain anchored batch.
     * @param batchId Unique 32-byte batch identifier
     * @param leaf Domain-separated leaf hash
     * @param proof Array of sibling hashes
     */
    function verifyBatchInclusion(
        bytes32 batchId,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool) {
        require(batchesById[batchId].active, "Batch not found");
        return verifyInclusionProof(leaf, proof, batchesById[batchId].merkleRoot);
    }
}
