import { ethers } from 'ethers';

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.SYSTEM_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function getSystemWallet(): ethers.Wallet {
  const provider = getProvider();
  return new ethers.Wallet(PRIVATE_KEY, provider);
}

export function getContract(address: string, abi: any, useSigner: boolean = false): ethers.Contract {
  const provider = getProvider();
  if (useSigner) {
    const wallet = getSystemWallet();
    return new ethers.Contract(address, abi, wallet);
  }
  return new ethers.Contract(address, abi, provider);
}

export async function verifyTransaction(txHash: string): Promise<ethers.TransactionReceipt | null> {
  const provider = getProvider();
  return provider.getTransactionReceipt(txHash);
}
