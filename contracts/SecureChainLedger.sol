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

    function getTransactionCount() external view returns (uint256) {
        return transactionIds.length;
    }
}
