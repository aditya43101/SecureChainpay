import { ethers } from 'ethers';
import { getContract, getSystemWallet, getProvider } from './client';
import SecureChainAnchorArtifact from '../../../artifacts/contracts/SecureChainAnchor.sol/SecureChainAnchor.json';
import * as fs from 'fs';
import * as path from 'path';

const ANCHOR_ABI = SecureChainAnchorArtifact.abi;

export interface OnChainAnchorState {
  chainId: number;
  chainVersion: number;
  genesisHash: string;
  latestBlockNumber: number;
  latestBlockHash: string;
  chainRoot: string;
  paused: boolean;
  initialized: boolean;
  blockWriter: string;
  securityAdmin: string;
  contractAdmin: string;
  lastCommitTimestamp: number;
  recoveryVersion: number;
  contractAddress: string;
}

export interface CommitBlockParams {
  blockNumber: number;
  blockHash: string;
  previousHash: string;
  newChainRoot: string;
}

export interface CommitBlockResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  blockHash?: string;
  chainRoot?: string;
  error?: string;
}

function resolveAnchorAddress(): string {
  if (process.env.SECURECHAIN_ANCHOR_ADDRESS) {
    return process.env.SECURECHAIN_ANCHOR_ADDRESS;
  }
  // Try reading from deployments/phase3-anchor.json
  try {
    const deploymentPath = path.join(process.cwd(), 'deployments', 'phase3-anchor.json');
    if (fs.existsSync(deploymentPath)) {
      const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      if (data && data.address) {
        return data.address;
      }
    }
  } catch (_) {}
  // Default Hardhat deployed fallback address
  return '0x5FbDB2315678afecb367f032d93F642f64180aa3';
}

export class SmartContractService {
  private static getAddress(): string {
    return resolveAnchorAddress();
  }

  /**
   * Reads current canonical state struct from the on-chain SecureChainAnchor contract
   */
  public static async readOnChainState(): Promise<OnChainAnchorState> {
    const address = this.getAddress();
    const contract = getContract(address, ANCHOR_ABI, false);
    const state = await contract.getChainState();

    return {
      chainId: Number(state.chainId),
      chainVersion: Number(state.chainVersion),
      genesisHash: state.genesisHash,
      latestBlockNumber: Number(state.latestBlockNumber),
      latestBlockHash: state.latestBlockHash,
      chainRoot: state.chainRoot,
      paused: Boolean(state.paused),
      initialized: Boolean(state._initialized),
      blockWriter: state.blockWriter,
      securityAdmin: state.securityAdmin,
      contractAdmin: state.contractAdmin,
      lastCommitTimestamp: Number(state.lastCommitTimestamp),
      recoveryVersion: Number(state.recoveryVersion),
      contractAddress: address,
    };
  }

  /**
   * Commits a candidate block to the SecureChainAnchor smart contract ON-CHAIN.
   * THIS MUST EXECUTE BEFORE FIRESTORE WRITE IN PHASE 3 CONTRACT-FIRST FLOW.
   */
  public static async commitBlock(params: CommitBlockParams): Promise<CommitBlockResult> {
    try {
      const address = this.getAddress();
      const wallet = getSystemWallet();
      const contract = new ethers.Contract(address, ANCHOR_ABI, wallet);

      console.info(`[SmartContractService] Committing Block #${params.blockNumber} to on-chain contract at ${address}...`);
      
      const tx = await contract.commitBlock(
        BigInt(params.blockNumber),
        params.blockHash,
        params.previousHash,
        params.newChainRoot
      );

      console.info(`[SmartContractService] Submitted commitBlock tx: ${tx.hash}. Waiting confirmation...`);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: `Smart contract commit reverted (status: ${receipt?.status})`,
        };
      }

      console.info(`[SmartContractService] ✓ Confirmed block #${params.blockNumber} on-chain! Tx: ${receipt.hash}`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: params.blockNumber,
        blockHash: params.blockHash,
        chainRoot: params.newChainRoot,
      };
    } catch (error: any) {
      console.error('[SmartContractService] Failed to commit block on-chain:', error);
      return {
        success: false,
        error: error?.reason || error?.message || 'Smart contract execution failed',
      };
    }
  }

  /**
   * Initializing chain on smart contract (if not initialized at deployment)
   */
  public static async initializeChain(params: {
    chainId: number;
    chainVersion: number;
    genesisHash: string;
    genesisBlockNumber: number;
    genesisChainRoot: string;
    blockWriter: string;
    securityAdmin: string;
    contractAdmin: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const address = this.getAddress();
      const wallet = getSystemWallet();
      const contract = new ethers.Contract(address, ANCHOR_ABI, wallet);

      const tx = await contract.initialize(
        params.chainId,
        params.chainVersion,
        params.genesisHash,
        params.genesisBlockNumber,
        params.genesisChainRoot,
        params.blockWriter,
        params.securityAdmin,
        params.contractAdmin
      );
      const receipt = await tx.wait(1);
      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      return { success: false, error: error?.reason || error?.message };
    }
  }

  /**
   * Pause contract (emergency security control)
   */
  public static async pause(): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const address = this.getAddress();
      const wallet = getSystemWallet();
      const contract = new ethers.Contract(address, ANCHOR_ABI, wallet);
      const tx = await contract.pause();
      const receipt = await tx.wait(1);
      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      return { success: false, error: error?.reason || error?.message };
    }
  }

  /**
   * Unpause contract
   */
  public static async unpause(): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const address = this.getAddress();
      const wallet = getSystemWallet();
      const contract = new ethers.Contract(address, ANCHOR_ABI, wallet);
      const tx = await contract.unpause();
      const receipt = await tx.wait(1);
      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      return { success: false, error: error?.reason || error?.message };
    }
  }

  /**
   * Verifies if on-chain genesis hash matches expected database genesis hash
   */
  public static async verifyGenesisConsistency(dbGenesisHash: string): Promise<boolean> {
    try {
      const address = this.getAddress();
      const contract = getContract(address, ANCHOR_ABI, false);
      return await contract.verifyGenesisHash(dbGenesisHash);
    } catch (_) {
      return false;
    }
  }

  /**
   * Increments on-chain recoveryVersion during verified recovery operations
   */
  public static async bumpRecoveryVersion(): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const address = this.getAddress();
      const wallet = getSystemWallet();
      const contract = new ethers.Contract(address, ANCHOR_ABI, wallet);
      const tx = await contract.bumpRecoveryVersion();
      const receipt = await tx.wait(1);
      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      return { success: false, error: error?.reason || error?.message };
    }
  }
}
