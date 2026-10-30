import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Deploying PrivacyVerifier contract to local network...');

  const [deployer] = await ethers.getSigners();
  console.log(`📡 Deployer address: ${deployer.address}`);

  const PrivacyVerifierFactory = await ethers.getContractFactory('PrivacyVerifier');
  const privacyVerifier = await PrivacyVerifierFactory.deploy();
  await privacyVerifier.waitForDeployment();

  const contractAddress = await privacyVerifier.getAddress();
  console.log(`✅ PrivacyVerifier deployed successfully at: ${contractAddress}`);

  // Export contract deployment address and ABI to backend
  const targetDir = path.join(__dirname, '../../backend/src/blockchain/contracts');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const artifactPath = path.join(__dirname, '../artifacts/contracts/PrivacyVerifier.sol/PrivacyVerifier.json');
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const exportData = {
      address: contractAddress,
      network: 'localhost',
      chainId: 31337,
      abi: artifact.abi,
      deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(targetDir, 'PrivacyVerifier.json'), JSON.stringify(exportData, null, 2));
    console.log(`📦 Exported contract address and ABI to: ${path.join(targetDir, 'PrivacyVerifier.json')}`);
  }

  return { address: contractAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
