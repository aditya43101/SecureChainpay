// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract WalletFactory {
    address public owner;

    struct WalletInfo {
        address walletAddress;
        bool isFrozen;
        uint256 createdAt;
    }

    mapping(address => WalletInfo) public userWallets;
    
    event WalletCreated(address indexed user, address walletAddress);
    event WalletFrozen(address indexed user, address walletAddress);
    event WalletUnfrozen(address indexed user, address walletAddress);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createWallet(address _user, address _walletAddress) external onlyOwner {
        require(userWallets[_user].createdAt == 0, "Wallet already exists for this user");
        
        userWallets[_user] = WalletInfo({
            walletAddress: _walletAddress,
            isFrozen: false,
            createdAt: block.timestamp
        });

        emit WalletCreated(_user, _walletAddress);
    }

    function freezeWallet(address _user) external onlyOwner {
        require(userWallets[_user].createdAt != 0, "Wallet does not exist");
        require(!userWallets[_user].isFrozen, "Wallet is already frozen");
        
        userWallets[_user].isFrozen = true;
        
        emit WalletFrozen(_user, userWallets[_user].walletAddress);
    }

    function unfreezeWallet(address _user) external onlyOwner {
        require(userWallets[_user].createdAt != 0, "Wallet does not exist");
        require(userWallets[_user].isFrozen, "Wallet is not frozen");
        
        userWallets[_user].isFrozen = false;
        
        emit WalletUnfrozen(_user, userWallets[_user].walletAddress);
    }

    function getWallet(address _user) external view returns (WalletInfo memory) {
        require(userWallets[_user].createdAt != 0, "Wallet does not exist");
        return userWallets[_user];
    }
}
