// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PaymentChannel {
    address public owner;

    struct Channel {
        address sender;
        address receiver;
        uint256 deposit;
        uint256 openedAt;
        bool isClosed;
    }

    mapping(bytes32 => Channel) public channels;

    event ChannelOpened(bytes32 indexed channelId, address indexed sender, address indexed receiver, uint256 deposit);
    event ChannelClosed(bytes32 indexed channelId, address indexed sender, address indexed receiver, uint256 finalAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function openChannel(bytes32 _channelId, address _sender, address _receiver, uint256 _deposit) external onlyOwner {
        require(channels[_channelId].openedAt == 0, "Channel already exists");

        channels[_channelId] = Channel({
            sender: _sender,
            receiver: _receiver,
            deposit: _deposit,
            openedAt: block.timestamp,
            isClosed: false
        });

        emit ChannelOpened(_channelId, _sender, _receiver, _deposit);
    }

    function closeChannel(bytes32 _channelId, uint256 _finalAmount) external onlyOwner {
        require(channels[_channelId].openedAt != 0, "Channel does not exist");
        require(!channels[_channelId].isClosed, "Channel is already closed");
        require(_finalAmount <= channels[_channelId].deposit, "Final amount exceeds deposit");

        channels[_channelId].isClosed = true;

        emit ChannelClosed(_channelId, channels[_channelId].sender, channels[_channelId].receiver, _finalAmount);
    }
}
