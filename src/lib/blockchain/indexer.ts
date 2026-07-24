export interface BlockData {
  height: number;
  hash: string;
  timestamp: Date;
  transactions: string[];
  validator: string;
}

export class BlockchainIndexer {
  private isRunning: boolean = false;
  private currentBlockHeight: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private chainId: string = "SC-MAIN-01";

  constructor(startingBlockHeight: number = 145000) {
    this.currentBlockHeight = startingBlockHeight;
  }

  public startIndexing(pollIntervalMs: number = 12000): void {
    this.isRunning = true;
  }

  public stopIndexing(): void {
    this.isRunning = false;
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      currentBlockHeight: this.currentBlockHeight,
      chainId: this.chainId,
    };
  }
}

export const indexerService = new BlockchainIndexer();
