import { ethers } from 'ethers';

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-rpc.com';
const PRIVATE_KEY = process.env.SYSTEM_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';

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
