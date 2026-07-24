import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const SecureChainLedger = await ethers.getContractFactory("SecureChainLedger");
  const ledger = await SecureChainLedger.deploy();
  await ledger.waitForDeployment();
  console.log("SecureChainLedger deployed to:", await ledger.getAddress());

  const WalletFactory = await ethers.getContractFactory("WalletFactory");
  const walletFactory = await WalletFactory.deploy();
  await walletFactory.waitForDeployment();
  console.log("WalletFactory deployed to:", await walletFactory.getAddress());

  const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
  const paymentChannel = await PaymentChannel.deploy();
  await paymentChannel.waitForDeployment();
  console.log("PaymentChannel deployed to:", await paymentChannel.getAddress());
  
  console.log("\n--- UPDATE YOUR .env.local WITH THE ABOVE ADDRESSES ---");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
