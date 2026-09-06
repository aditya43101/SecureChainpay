import { ethers } from 'ethers';

const PUBLIC_AMOY_RPC = 'https://rpc-amoy.polygon.technology';

const getRpcUrl = () => {
  if (process.env.BLOCKCHAIN_RPC_URL && !process.env.BLOCKCHAIN_RPC_URL.includes('127.0.0.1')) {
    return process.env.BLOCKCHAIN_RPC_URL;
  }
  if (typeof window !== 'undefined' || process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return PUBLIC_AMOY_RPC;
  }
  return process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
};

export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(getRpcUrl());
}

export function getSystemWallet(): ethers.Wallet {
  const provider = getProvider();
  const privateKey = process.env.SYSTEM_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  return new ethers.Wallet(privateKey, provider);
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
  try {
    const provider = getProvider();
    return await provider.getTransactionReceipt(txHash);
  } catch (err) {
    console.warn('[BlockchainClient] verifyTransaction RPC warning:', err);
    return null;
  }
}
