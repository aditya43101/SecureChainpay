import { SmartContractService, OnChainAnchorState } from './smart-contract-service';

export class OnChainStateReader {
  /**
   * Fetches full read-only snapshot of the canonical on-chain state from SecureChainAnchor.
   */
  public static async getChainState(): Promise<OnChainAnchorState | null> {
    try {
      return await SmartContractService.readOnChainState();
    } catch (error) {
      console.warn('[OnChainStateReader] Unable to query smart contract state:', error);
      return null;
    }
  }

  /**
   * Quick boolean check if contract is initialized and active
   */
  public static async isContractActive(): Promise<{ active: boolean; paused: boolean; contractAddress: string | null }> {
    try {
      const state = await SmartContractService.readOnChainState();
      return {
        active: state.initialized,
        paused: state.paused,
        contractAddress: state.contractAddress,
      };
    } catch (_) {
      return { active: false, paused: false, contractAddress: null };
    }
  }
}
