// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SecureChainLedger {
    address public owner;

    struct TransactionRecord {
        bytes32 txId;
        address sender;
        address receiver;
        uint256 amount;
        uint256 timestamp;
        string currency;
    }

    mapping(bytes32 => TransactionRecord) public transactions;
    bytes32[] public transactionIds;

    event TransactionRecorded(
        bytes32 indexed txId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        string currency
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordTransaction(
        bytes32 _txId,
        address _sender,
        address _receiver,
        uint256 _amount,
        string memory _currency
    ) external onlyOwner {
        require(transactions[_txId].timestamp == 0, "Transaction already exists");

        transactions[_txId] = TransactionRecord({
            txId: _txId,
            sender: _sender,
            receiver: _receiver,
            amount: _amount,
            timestamp: block.timestamp,
            currency: _currency
        });

        transactionIds.push(_txId);

        emit TransactionRecorded(_txId, _sender, _receiver, _amount, _currency);
    }

    function getTransaction(bytes32 _txId) external view returns (TransactionRecord memory) {
        require(transactions[_txId].timestamp != 0, "Transaction not found");
        return transactions[_txId];
    }

    function getBlockTransactions(uint256 _offset, uint256 _limit) external view returns (TransactionRecord[] memory) {
        uint256 total = transactionIds.length;
        if (_offset >= total) {
            return new TransactionRecord[](0);
        }

        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }

        uint256 count = end - _offset;
        TransactionRecord[] memory result = new TransactionRecord[](count);

        for (uint256 i = 0; i < count; i++) {
            result[i] = transactions[transactionIds[_offset + i]];
        }

        return result;
    }

    function verifyTransaction(bytes32 _txId) external view returns (bool) {
        return transactions[_txId].timestamp != 0;
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 4: MERKLE BATCH ANCHORING
    // ═══════════════════════════════════════════════════════
    struct MerkleBatchRecord {
        bytes32 batchId;
        bytes32 merkleRoot;
        uint256 transactionCount;
        uint256 timestamp;
        uint256 blockNumber;
    }

    mapping(bytes32 => MerkleBatchRecord) public merkleBatches;
    bytes32[] public batchIds;

    event MerkleBatchAnchored(
        bytes32 indexed batchId,
        bytes32 indexed merkleRoot,
        uint256 transactionCount,
        uint256 timestamp
    );

    function recordMerkleBatch(
        bytes32 _batchId,
        bytes32 _merkleRoot,
        uint256 _transactionCount
    ) external onlyOwner {
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

    function verifyMerkleBatch(bytes32 _batchId) external view returns (bool) {
        return merkleBatches[_batchId].timestamp != 0;
    }

    function getMerkleBatchCount() external view returns (uint256) {
        return batchIds.length;
    }
}

