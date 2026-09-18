import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';

export type ProviderClassification =
  | 'HEALTHY'
  | 'BUSY'
  | 'DEGRADED'
  | 'STALE'
  | 'UNAVAILABLE_FOR_NEW_TX'
  | 'OFFLINE'
  | 'RPC_TIMEOUT'
  | 'UNHEALTHY'
  | 'UNAVAILABLE';

export interface ProviderHealthReport {
  providerUrl: string;
  name: string;
  status: ProviderClassification;
  latencyMs: number;
  latestBlockNumber: number;
  blockAgeSeconds: number;
  chainId: number;
  expectedChainId: number;
  gasPriceGwei: number;
  hasContractCode: boolean;
  consecutiveFailures: number;
  lastCheckedAt: string;
  lastError: string | null;
  currentTransactionId?: string | null;
  acceptsNewTransactions: boolean;
  isProcessingExisting: boolean;
}

export type HealthRecoveryListener = (healthyReport: ProviderHealthReport) => void | Promise<void>;

export class NodeHealthEngine {
  private static instance: NodeHealthEngine;
  private recoveryListeners: HealthRecoveryListener[] = [];
  private providersCache: Map<string, ProviderHealthReport> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private activeTransactions: Map<string, string> = new Map(); // providerUrl -> transactionId
  private manualStatusOverrides: Map<string, ProviderClassification> = new Map();

  // Configured RPC list (Primary, Secondary/Failover, Public)
  private configuredProviders: { name: string; url: string }[] = [];

  private constructor() {
    const primaryRpc = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    const secondaryRpc = process.env.BLOCKCHAIN_RPC_FAILOVER_URL || 'http://127.0.0.1:8546';
    const publicRpc = process.env.PUBLIC_AMOY_RPC || 'https://polygon-amoy-bor-rpc.publicnode.com';

    this.configuredProviders = [
      { name: 'Primary RPC (Node A)', url: primaryRpc },
      { name: 'Failover RPC (Node B)', url: secondaryRpc },
      { name: 'Public Network RPC (Node C)', url: publicRpc },
    ];
  }

  public static getInstance(): NodeHealthEngine {
    if (!NodeHealthEngine.instance) {
      NodeHealthEngine.instance = new NodeHealthEngine();
    }
    return NodeHealthEngine.instance;
  }

  /**
   * Register a listener that fires when an unhealthy/unavailable network becomes HEALTHY.
   */
  public onRecovery(listener: HealthRecoveryListener): void {
    this.recoveryListeners.push(listener);
  }

  /**
   * Manually override a node's operational status (e.g. for testing BUSY or chaos simulation).
   */
  public setStatusOverride(providerUrl: string, status: ProviderClassification | null): void {
    if (!status) {
      this.manualStatusOverrides.delete(providerUrl);
    } else {
      this.manualStatusOverrides.set(providerUrl, status);
    }
  }

  /**
   * Assign an in-flight transaction to a node, marking it BUSY.
   */
  public assignTransaction(providerUrl: string, transactionId: string): void {
    this.activeTransactions.set(providerUrl, transactionId);
    this.setStatusOverride(providerUrl, 'BUSY');
  }

  /**
   * Complete an in-flight transaction on a node, freeing it.
   */
  public completeTransaction(providerUrl: string, transactionId: string): void {
    if (this.activeTransactions.get(providerUrl) === transactionId) {
      this.activeTransactions.delete(providerUrl);
      if (this.manualStatusOverrides.get(providerUrl) === 'BUSY') {
        this.manualStatusOverrides.delete(providerUrl);
      }
    }
  }

  /**
   * Evaluates a single RPC provider endpoint with comprehensive checks.
   */
  public async evaluateProvider(
    providerUrl: string,
    name = 'RPC Provider',
    contractAddress?: string,
    forceRefresh = false
  ): Promise<ProviderHealthReport> {
    const previousReport = this.providersCache.get(providerUrl);
    if (!forceRefresh && previousReport) {
      const ageMs = Date.now() - new Date(previousReport.lastCheckedAt).getTime();
      if (ageMs < 5000) {
        // Return cached report with any dynamic override applied
        const override = this.manualStatusOverrides.get(providerUrl);
        const currentTx = this.activeTransactions.get(providerUrl) || null;
        if (override && previousReport.status !== override) {
          const updated = {
            ...previousReport,
            status: override,
            currentTransactionId: currentTx,
            acceptsNewTransactions: override === 'HEALTHY',
            isProcessingExisting: !!currentTx || override === 'BUSY',
          };
          this.providersCache.set(providerUrl, updated);
          return updated;
        }
        return previousReport;
      }
    }

    const startTime = Date.now();
    const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);
    let failures = this.consecutiveFailures.get(providerUrl) || 0;

    try {
      // 1. Connectivity & Latency check
      const networkObj = ethers.Network.from(expectedChainId);
      const provider = new ethers.JsonRpcProvider(providerUrl, networkObj, { staticNetwork: networkObj });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RPC_TIMEOUT: Request exceeded 4000ms')), 4000)
      );

      const probePromise = Promise.all([
        provider.getBlockNumber(),
        provider.getNetwork(),
        provider.getFeeData(),
      ]);

      const [blockNumber, network, feeData] = (await Promise.race([
        probePromise,
        timeoutPromise,
      ])) as [number, ethers.Network, ethers.FeeData];

      const latencyMs = Date.now() - startTime;
      const actualChainId = Number(network.chainId);

      // 2. Block Age Check
      let blockAgeSeconds = 0;
      try {
        const latestBlock = await provider.getBlock(blockNumber);
        if (latestBlock && latestBlock.timestamp) {
          const nowSeconds = Math.floor(Date.now() / 1000);
          blockAgeSeconds = Math.max(0, nowSeconds - latestBlock.timestamp);
        }
      } catch (_) {
        blockAgeSeconds = 10;
      }

      // 3. Contract Bytecode verification if address provided
      let hasContractCode = true;
      if (contractAddress && ethers.isAddress(contractAddress)) {
        try {
          const code = await provider.getCode(contractAddress);
          hasContractCode = code !== '0x' && code !== '0x0' && code.length > 2;
        } catch (_) {
          hasContractCode = false;
        }
      }

      // 4. Gas / Fee condition
      const gasPriceGwei = feeData?.gasPrice
        ? Number(ethers.formatUnits(feeData.gasPrice, 'gwei'))
        : 20;

      // 5. Base Classification
      let status: ProviderClassification = 'HEALTHY';

      if (blockAgeSeconds > 300) {
        status = 'STALE';
      } else if (actualChainId !== expectedChainId && actualChainId !== 80002 && actualChainId !== 31337) {
        status = 'UNHEALTHY';
      } else if (latencyMs > 2500 || blockAgeSeconds > 60 || !hasContractCode) {
        status = 'DEGRADED';
      } else {
        status = 'HEALTHY';
      }

      // 6. Check manual override or in-flight transaction
      const currentTx = this.activeTransactions.get(providerUrl) || null;
      const override = this.manualStatusOverrides.get(providerUrl);
      if (override) {
        status = override;
      } else if (currentTx) {
        status = 'BUSY';
      }

      // Reset failure counter on success
      this.consecutiveFailures.set(providerUrl, 0);

      const acceptsNewTransactions = status === 'HEALTHY';
      const isProcessingExisting = !!currentTx || status === 'BUSY' || status === 'UNAVAILABLE_FOR_NEW_TX';

      const report: ProviderHealthReport = {
        providerUrl,
        name,
        status,
        latencyMs,
        latestBlockNumber: blockNumber,
        blockAgeSeconds,
        chainId: actualChainId,
        expectedChainId,
        gasPriceGwei: Number(gasPriceGwei.toFixed(2)),
        hasContractCode,
        consecutiveFailures: 0,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        currentTransactionId: currentTx,
        acceptsNewTransactions,
        isProcessingExisting,
      };

      // Check recovery notification
      const wasUnhealthy = previousReport && (previousReport.status === 'OFFLINE' || previousReport.status === 'UNAVAILABLE' || previousReport.status === 'UNHEALTHY');
      this.providersCache.set(providerUrl, report);

      if (wasUnhealthy && status === 'HEALTHY') {
        console.info(`[NodeHealthEngine] 🟢 PROVIDER RECOVERED TO HEALTHY: ${name} (${providerUrl})`);
        this.notifyRecovery(report);
      }

      this.persistReport(report).catch(() => null);
      return report;
    } catch (err: any) {
      failures += 1;
      this.consecutiveFailures.set(providerUrl, failures);

      const latencyMs = Date.now() - startTime;
      const isTimeout = err.message?.includes('RPC_TIMEOUT');
      const isUnavailable =
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND') ||
        err.message?.includes('fetch failed') ||
        err.message?.includes('could not detect network');

      let status: ProviderClassification = 'UNAVAILABLE';
      if (isTimeout) {
        status = 'RPC_TIMEOUT';
      } else if (isUnavailable) {
        status = 'UNAVAILABLE';
      } else {
        status = 'UNHEALTHY';
      }

      // Check override
      const override = this.manualStatusOverrides.get(providerUrl);
      if (override) {
        status = override;
      }

      const currentTx = this.activeTransactions.get(providerUrl) || null;
      // Even if node has error or is busy, in-flight transaction is preserved!
      const isProcessingExisting = !!currentTx;

      const report: ProviderHealthReport = {
        providerUrl,
        name,
        status,
        latencyMs,
        latestBlockNumber: previousReport?.latestBlockNumber || 0,
        blockAgeSeconds: 9999,
        chainId: 0,
        expectedChainId,
        gasPriceGwei: 0,
        hasContractCode: false,
        consecutiveFailures: failures,
        lastCheckedAt: new Date().toISOString(),
        lastError: err.message || 'RPC communication error',
        currentTransactionId: currentTx,
        acceptsNewTransactions: false,
        isProcessingExisting,
      };

      this.providersCache.set(providerUrl, report);
      this.persistReport(report).catch(() => null);
      return report;
    }
  }

  /**
   * Evaluate all configured providers and return their status.
   * Note: Nodes NEVER disappear from this list, even when BUSY or OFFLINE.
   */
  public async checkAllProviders(contractAddress?: string): Promise<ProviderHealthReport[]> {
    const reports = await Promise.all(
      this.configuredProviders.map((p) => this.evaluateProvider(p.url, p.name, contractAddress))
    );
    return reports;
  }

  /**
   * Selects the single best healthy provider for NEW transactions.
   * Skips nodes that are BUSY or UNAVAILABLE_FOR_NEW_TX.
   */
  public async getHealthyProvider(contractAddress?: string): Promise<{
    provider: ethers.JsonRpcProvider | null;
    report: ProviderHealthReport | null;
    allReports: ProviderHealthReport[];
  }> {
    const reports = await this.checkAllProviders(contractAddress);

    // Filter for nodes that are HEALTHY and accept new transactions
    const availableHealthy = reports
      .filter((r) => r.status === 'HEALTHY' && r.acceptsNewTransactions)
      .sort((a, b) => a.latencyMs - b.latencyMs);

    if (availableHealthy.length > 0) {
      const best = availableHealthy[0];
      const network = ethers.Network.from(best.chainId);
      const provider = new ethers.JsonRpcProvider(best.providerUrl, network, { staticNetwork: network });
      return { provider, report: best, allReports: reports };
    }

    // Fallback: DEGRADED if acceptable latency (< 2500ms) and accepting new transactions
    const availableDegraded = reports
      .filter((r) => r.status === 'DEGRADED' && r.latencyMs < 2500 && r.acceptsNewTransactions)
      .sort((a, b) => a.latencyMs - b.latencyMs);

    if (availableDegraded.length > 0) {
      const best = availableDegraded[0];
      const network = ethers.Network.from(best.chainId || 31337);
      const provider = new ethers.JsonRpcProvider(best.providerUrl, network, { staticNetwork: network });
      return { provider, report: best, allReports: reports };
    }

    // No node is currently available for NEW transactions
    return { provider: null, report: null, allReports: reports };
  }

  /**
   * Returns true if any node is currently ready to accept new transactions.
   */
  public async isAnyNodeHealthy(): Promise<boolean> {
    const { provider } = await this.getHealthyProvider();
    return provider !== null;
  }

  private notifyRecovery(report: ProviderHealthReport) {
    for (const listener of this.recoveryListeners) {
      try {
        Promise.resolve(listener(report)).catch((err) => {
          console.warn('[NodeHealthEngine] Error in recovery listener:', err);
        });
      } catch (err) {
        console.warn('[NodeHealthEngine] Synchronous error in recovery listener:', err);
      }
    }
  }

  private async persistReport(report: ProviderHealthReport) {
    try {
      await prisma.nodeHealthRecord.create({
        data: {
          providerUrl: report.providerUrl,
          providerName: report.name,
          status: report.status,
          latencyMs: report.latencyMs,
          latestBlockNumber: report.latestBlockNumber,
          blockAgeSeconds: report.blockAgeSeconds,
          consecutiveFailures: report.consecutiveFailures,
          lastError: report.lastError,
          lastCheckedAt: new Date(report.lastCheckedAt),
        },
      });
    } catch (_) {
      // Non-fatal
    }
  }
}
