import * as path from 'path';
import * as fs from 'fs';

export interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  chainId: number;
  abi: any[];
}

// Default Hardhat Account #0 private key (standard well-known local testing key)
export const DEFAULT_HARDHAT_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export function getBlockchainConfig(): BlockchainConfig {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || DEFAULT_HARDHAT_PRIVATE_KEY;
  const chainId = parseInt(process.env.CHAIN_ID || '31337', 10);

  let contractAddress = process.env.VEHICLE_PASSPORT_CONTRACT_ADDRESS || '';
  let abi: any[] = [];

  // Attempt to read deployed contract artifact from VehiclePassport.json
  const candidatePaths = [
    path.join(__dirname, '../contracts/VehiclePassport.json'),
    path.join(process.cwd(), 'src/blockchain/contracts/VehiclePassport.json'),
    path.join(process.cwd(), 'backend/src/blockchain/contracts/VehiclePassport.json'),
    path.join(__dirname, '../../../../src/blockchain/contracts/VehiclePassport.json'),
  ];

  for (const artifactPath of candidatePaths) {
    if (fs.existsSync(artifactPath)) {
      try {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        if (!contractAddress && artifact.address) {
          contractAddress = artifact.address;
        }
        if (artifact.abi && Array.isArray(artifact.abi) && artifact.abi.length > 0) {
          abi = artifact.abi;
          break;
        }
      } catch (e) {
        console.warn('Could not parse VehiclePassport.json artifact from:', artifactPath, e);
      }
    }
  }

  return {
    rpcUrl,
    privateKey,
    contractAddress,
    chainId,
    abi,
  };
}
