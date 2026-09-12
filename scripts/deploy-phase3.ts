import pkg from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('[Phase 3 Deploy] Deploying SecureChainAnchor with account:', deployer.address);

  const SecureChainAnchor = await ethers.getContractFactory('SecureChainAnchor');
  const anchor = await SecureChainAnchor.deploy();
  await anchor.waitForDeployment();
  const anchorAddress = await anchor.getAddress();
  console.log('[Phase 3 Deploy] SecureChainAnchor deployed to:', anchorAddress);

  // Initialize parameters
  const chainId = 31337; // Local Hardhat chainId
  const chainVersion = 1;
  const genesisHash = ethers.keccak256(ethers.toUtf8Bytes('genesis:securechainpay:global:v1'));
  const genesisBlockNumber = 0;
  const genesisChainRoot = ethers.keccak256(ethers.toUtf8Bytes('genesis:securechainpay:global:v1:root'));
  const blockWriter = deployer.address;
  const securityAdmin = deployer.address;
  const contractAdmin = deployer.address;

  console.log('[Phase 3 Deploy] Initializing contract...');
  const tx = await anchor.initialize(
    chainId,
    chainVersion,
    genesisHash,
    genesisBlockNumber,
    genesisChainRoot,
    blockWriter,
    securityAdmin,
    contractAdmin
  );
  await tx.wait();
  console.log('[Phase 3 Deploy] Contract initialized successfully.');

  // Write deployment info to JSON
  const deploymentDir = path.join(process.cwd(), 'deployments');
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentData = {
    address: anchorAddress,
    chainId,
    chainVersion,
    genesisHash,
    genesisBlockNumber,
    genesisChainRoot,
    blockWriter,
    securityAdmin,
    contractAdmin,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(deploymentDir, 'phase3-anchor.json'),
    JSON.stringify(deploymentData, null, 2)
  );

  console.log('[Phase 3 Deploy] Saved deployment metadata to deployments/phase3-anchor.json');
  console.log(`\n>>> SECURECHAIN_ANCHOR_ADDRESS="${anchorAddress}" <<<\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Phase 3 Deploy Error]', error);
    process.exit(1);
  });
