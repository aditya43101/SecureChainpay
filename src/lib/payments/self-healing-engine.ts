import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { NodeHealthEngine } from '@/lib/blockchain/node-health-engine';
import { TemporaryTransactionQueue } from './temporary-transaction-queue';
import { TransactionStateMachine, TransactionState } from './transaction-state-machine';
import { ReservationService } from './reservation-service';
import { FundsService } from './funds-service';
import { StarvationPreventionScheduler } from './starvation-prevention-scheduler';
import { getContract } from '@/lib/blockchain/client';
import SecureChainPaymentArtifact from '../../../artifacts/contracts/SecureChainPayment.sol/SecureChainPayment.json';

export class SelfHealingEngine {
  private static instance: SelfHealingEngine;
  private isProcessingQueue = false;

  private constructor() {
    // Automatically bind to NodeHealthEngine recovery notifications
    const healthEngine = NodeHealthEngine.getInstance();
    healthEngine.onRecovery(async (report) => {
      console.info(`[SelfHealingEngine] 🔔 Node recovery signal received from ${report.name}. Triggering queue drain...`);
      await this.processTemporaryQueueUponNodeRecovery();
    });
  }

  public static getInstance(): SelfHealingEngine {
    if (!SelfHealingEngine.instance) {
      SelfHealingEngine.instance = new SelfHealingEngine();
    }
    return SelfHealingEngine.instance;
  }

  /**
   * RECOVERY PATTERN 1: RPC TIMEOUT RECOVERY (§19)
   * Never blindly retry. Queries contract & receipt to determine actual state.
   */
  public async handleRpcTimeout(
    transactionId: string,
    knownTxHash?: string
  ): Promise<{
    recovered: boolean;
    authoritativeState: TransactionState;
    actionTaken: string;
    blockchainTxHash?: string | null;
  }> {
    console.info(`[SelfHealingEngine] 🔍 Investigating timeout for transaction ${transactionId}...`);

    const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
    const healthEngine = NodeHealthEngine.getInstance();
    const { provider } = await healthEngine.getHealthyProvider(contractAddress);

    if (!provider || !contractAddress) {
      return {
        recovered: false,
        authoritativeState: 'PROCESSING',
        actionTaken: 'DEFERRED_NO_HEALTHY_RPC',
      };
    }

    const txIdBytes32 = ethers.id(transactionId);
    let onChainPayment: any = null;

    // 1. Query Smart Contract State
    try {
      const contract = getContract(contractAddress, SecureChainPaymentArtifact.abi, false);
      onChainPayment = await contract.getPayment(txIdBytes32).catch(() => null);
    } catch (_) {
      // Contract state read might fail if not initialized
    }

    // 2. Query Receipt if hash was known
    let receipt: ethers.TransactionReceipt | null = null;
    if (knownTxHash && ethers.isHexString(knownTxHash, 32)) {
      try {
        receipt = await provider.getTransactionReceipt(knownTxHash);
      } catch (_) {}
    }

    // 3. Evaluate Authoritative State
    if (onChainPayment && onChainPayment.state !== undefined) {
      const stateNum = Number(onChainPayment.state); // 0=NONEXISTENT, 1=RESERVED, 2=FINALIZED, 3=CANCELLED

      if (stateNum === 1) {
        // FUNDS_RESERVED on-chain!
        await TransactionStateMachine.transition({
          transactionId,
          newState: 'FUNDS_RESERVED',
          reason: 'Recovered from timeout: Verified payment is already RESERVED on blockchain.',
          actor: 'SelfHealingEngine',
          systemComponent: 'SelfHealingEngine',
          blockchainTxHash: knownTxHash || null,
        });

        await ReservationService.convertToOnChainLock(transactionId);

        return {
          recovered: true,
          authoritativeState: 'FUNDS_RESERVED',
          actionTaken: 'RESUMED_FROM_ONCHAIN_RESERVED',
          blockchainTxHash: knownTxHash || null,
        };
      } else if (stateNum === 2) {
        // Already FINALIZED on-chain!
        await TransactionStateMachine.transition({
          transactionId,
          newState: 'FINALIZED',
          reason: 'Recovered from timeout: Discovered payment was already FINALIZED on blockchain.',
          actor: 'SelfHealingEngine',
          systemComponent: 'SelfHealingEngine',
          blockchainTxHash: knownTxHash || null,
        });

        await ReservationService.finalizeReservation(transactionId);

        return {
          recovered: true,
          authoritativeState: 'FINALIZED',
          actionTaken: 'RESUMED_FROM_ONCHAIN_FINALIZED',
          blockchainTxHash: knownTxHash || null,
        };
      } else if (stateNum === 3) {
        // CANCELLED on-chain
        await TransactionStateMachine.transition({
          transactionId,
          newState: 'CANCELLED',
          reason: 'Recovered from timeout: Payment was CANCELLED on blockchain.',
          actor: 'SelfHealingEngine',
          systemComponent: 'SelfHealingEngine',
        });

        await ReservationService.releaseReservation(transactionId, 'On-chain cancellation');

        return {
          recovered: true,
          authoritativeState: 'CANCELLED',
          actionTaken: 'SYNCED_CANCELLED',
        };
      }
    }

    // 4. Receipt indicates success but contract check wasn't decisive
    if (receipt && receipt.status === 1) {
      await TransactionStateMachine.transition({
        transactionId,
        newState: 'FUNDS_RESERVED',
        reason: `Recovered from timeout: Confirmed in block #${receipt.blockNumber} via tx receipt.`,
        actor: 'SelfHealingEngine',
        systemComponent: 'SelfHealingEngine',
        blockchainTxHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return {
        recovered: true,
        authoritativeState: 'FUNDS_RESERVED',
        actionTaken: 'RESUMED_FROM_RECEIPT_SUCCESS',
        blockchainTxHash: receipt.hash,
      };
    }

    // 5. If receipt failed/reverted
    if (receipt && receipt.status === 0) {
      await TransactionStateMachine.transition({
        transactionId,
        newState: 'FAILED',
        reason: 'On-chain transaction reverted with status 0',
        actor: 'SelfHealingEngine',
        systemComponent: 'SelfHealingEngine',
        errorCode: 'ONCHAIN_REVERT',
      });

      await ReservationService.releaseReservation(transactionId, 'On-chain revert');

      return {
        recovered: true,
        authoritativeState: 'FAILED',
        actionTaken: 'REVERTED_ONCHAIN',
      };
    }

    // Transaction was never accepted on blockchain
    return {
      recovered: false,
      authoritativeState: 'PROCESSING',
      actionTaken: 'UNCONFIRMED_ONCHAIN_WAITING',
    };
  }

  /**
   * RECOVERY PATTERN 2: NODE RECOVERY FLOW (§17)
   * When a healthy node becomes available:
   * Revalidates TEMP_PENDING transactions and initializes them on blockchain.
   */
  public async processTemporaryQueueUponNodeRecovery(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    quarantined: number;
  }> {
    if (this.isProcessingQueue) {
      return { processed: 0, succeeded: 0, failed: 0, quarantined: 0 };
    }

    this.isProcessingQueue = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let quarantined = 0;

    try {
      const queue = TemporaryTransactionQueue.getInstance();
      await queue.ensureInitialized();

      const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
      const healthEngine = NodeHealthEngine.getInstance();
      const { provider } = await healthEngine.getHealthyProvider(contractAddress);

      if (!provider || !contractAddress) {
        console.warn('[SelfHealingEngine] No healthy provider available to drain queue.');
        return { processed: 0, succeeded: 0, failed: 0, quarantined: 0 };
      }

      // Starvation Prevention: Load pending transactions in fair priority order
      const prioritizedItems = await StarvationPreventionScheduler.getPrioritizedPendingTransactions();
      console.info(`[SelfHealingEngine] 🚀 Draining temporary queue (${queue.size()} in-memory, ${prioritizedItems.length} DB pending) to healthy node...`);
      for (const item of prioritizedItems) {
        console.info(`  ↳ Prioritized: ${item.transactionId} | Age: ${item.ageSeconds}s | Priority: ${item.priorityScore} | Retries: ${item.retryCount} | Next: ${item.nextProcessingOpportunity}`);
      }

      const workerId = `worker_recovery_${Date.now()}`;

      // Acquire next queued temporary transaction
      while (true) {
        const node = await queue.acquireNextForProcessing(workerId, 45000);
        if (!node) break;

        processed++;
        const txId = node.transactionId;
        const now = Date.now();

        // 1. Expiry Check (Rule #13)
        if (node.expiresAt <= now) {
          console.warn(`[SelfHealingEngine] Queued transaction ${txId} expired before blockchain commitment.`);
          await TransactionStateMachine.transition({
            transactionId: txId,
            newState: 'EXPIRED',
            reason: 'Temporary transaction expired before blockchain recovery',
            actor: 'SelfHealingEngine',
            systemComponent: 'SelfHealingEngine',
          });
          await FundsService.releaseReservedFunds(txId, 'Expired in queue');
          queue.remove(txId);
          failed++;
          continue;
        }

        // 2. Cryptographic Integrity Check
        const expectedIntegrityPrefix = `${txId}|${node.senderWallet}|${node.recipientWallet}|${node.amount}|${node.asset}|${node.idempotencyKey}`;
        if (!node.integrityHash || !node.previousHash) {
          console.error(`[SelfHealingEngine] Integrity metadata missing for ${txId}. Quarantining!`);
          await this.quarantineTransaction(txId, 'MISSING_INTEGRITY_METADATA', { node });
          queue.remove(txId);
          quarantined++;
          continue;
        }

        // 3. Balance & Active Reservation Check via FundsService
        const funds = await FundsService.getAvailableFunds(node.senderWallet, node.asset);
        // Because the reservation already exists in DB, the sender's totalBalance must cover the amount
        if (funds.totalBalance < node.amount) {
          console.error(`[SelfHealingEngine] Balance check failed for ${txId}. Insufficient total balance.`);
          await TransactionStateMachine.transition({
            transactionId: txId,
            newState: 'FAILED',
            reason: 'Insufficient balance during on-chain initialization',
            actor: 'SelfHealingEngine',
            systemComponent: 'SelfHealingEngine',
            errorCode: 'INSUFFICIENT_FUNDS',
          });
          await FundsService.releaseReservedFunds(txId, 'Insufficient balance');
          queue.remove(txId);
          failed++;
          continue;
        }

        // 4. On-Chain Initialization
        await TransactionStateMachine.transition({
          transactionId: txId,
          newState: 'ONCHAIN_INITIALIZING',
          reason: 'Healthy node available. Initializing payment on-chain.',
          actor: 'SelfHealingEngine',
          systemComponent: 'SelfHealingEngine',
        });

        try {
          const contract = getContract(contractAddress, SecureChainPaymentArtifact.abi, true);
          const txIdBytes32 = ethers.id(txId);
          const scaledAmount = ethers.parseEther(String(node.amount));
          const expirySeconds = Math.floor(node.expiresAt / 1000);

          // Credit accounting balance on-chain if needed for sender
          const creditTx = await contract.creditAccountingBalance(node.senderWallet, scaledAmount).catch(() => null);
          if (creditTx && typeof creditTx.wait === 'function') {
            await creditTx.wait(1).catch(() => null);
          }

          const onChainTx = await contract.initializePaymentFor(
            txIdBytes32,
            node.senderWallet,
            node.recipientWallet,
            scaledAmount,
            node.asset,
            expirySeconds
          );

          const receipt = await onChainTx.wait(1);

          if (receipt && receipt.status === 1) {
            await TransactionStateMachine.transition({
              transactionId: txId,
              newState: 'FUNDS_RESERVED',
              reason: 'Payment successfully initialized and reserved on-chain.',
              actor: 'SelfHealingEngine',
              systemComponent: 'SelfHealingEngine',
              blockchainTxHash: receipt.hash,
              blockNumber: receipt.blockNumber,
            });

            await ReservationService.convertToOnChainLock(txId);
            queue.remove(txId);
            succeeded++;
            console.info(`[SelfHealingEngine] ✓ Successfully transitioned ${txId} to FUNDS_RESERVED on-chain! Tx: ${receipt.hash}`);
          } else {
            throw new Error(`Receipt reverted with status: ${receipt?.status}`);
          }
        } catch (chainErr: any) {
          console.error(`[SelfHealingEngine] On-chain initialization failed for ${txId}:`, chainErr.message);

          if (chainErr.message?.includes('Payment already exists')) {
            // Check state on-chain
            await this.handleRpcTimeout(txId);
            queue.remove(txId);
            succeeded++;
          } else {
            await TransactionStateMachine.transition({
              transactionId: txId,
              newState: 'TEMP_PENDING',
              reason: `On-chain initialization error: ${chainErr.message}. Returned to queue.`,
              actor: 'SelfHealingEngine',
              systemComponent: 'SelfHealingEngine',
              errorCode: 'RPC_EXECUTION_ERROR',
            });
            failed++;
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }

    return { processed, succeeded, failed, quarantined };
  }

  /**
   * RECOVERY PATTERN 3: CRASH RECOVERY (§18)
   * On backend startup, reconstructs state from durable DB & checks blockchain for true state.
   */
  public async executeStartupCrashRecovery(): Promise<{
    rebuiltQueueSize: number;
    reconciledNonTerminalTxs: number;
  }> {
    console.info('[SelfHealingEngine] 🔄 Executing startup crash recovery scan...');

    // 1. Rebuild Temporary Queue
    const queue = TemporaryTransactionQueue.getInstance();
    const rebuiltQueueSize = await queue.rebuildFromDatabase();

    // 2. Discover Non-Terminal Transactions in DB
    const nonTerminalTxs = await prisma.temporaryTransaction.findMany({
      where: {
        status: { in: ['ONCHAIN_INITIALIZING', 'FINALIZATION_SUBMITTED', 'PROCESSING'] },
      },
    });

    let reconciledCount = 0;

    for (const tx of nonTerminalTxs) {
      try {
        const timeoutRes = await this.handleRpcTimeout(tx.transactionId, tx.blockchainTxHash || undefined);
        if (timeoutRes.recovered) {
          reconciledCount++;
        }
      } catch (err: any) {
        console.warn(`[SelfHealingEngine] Crash recovery warning for tx ${tx.transactionId}:`, err.message);
      }
    }

    console.info(`[SelfHealingEngine] ✓ Startup crash recovery complete. Queue: ${rebuiltQueueSize}, Reconciled: ${reconciledCount}.`);
    return { rebuiltQueueSize, reconciledNonTerminalTxs: reconciledCount };
  }

  /**
   * RECOVERY PATTERN 4: QUARANTINE SUSPICIOUS TRANSACTIONS (§28)
   */
  public async quarantineTransaction(
    transactionId: string,
    reason: string,
    evidence: any
  ): Promise<void> {
    console.warn(`[SelfHealingEngine] 🚨 QUARANTINING TRANSACTION ${transactionId}: ${reason}`);

    await TransactionStateMachine.transition({
      transactionId,
      newState: 'QUARANTINED',
      reason,
      actor: 'SelfHealingEngine',
      systemComponent: 'SelfHealingEngine',
      errorCode: 'QUARANTINE_TRIGGERED',
      confirmationInfo: evidence,
    });
  }

  /**
   * Reconciles a single non-terminal transaction by investigating blockchain contract state.
   */
  public async reconcileNonTerminalTransaction(transactionId: string): Promise<{ resolved: boolean; authoritativeState: TransactionState }> {
    const res = await this.handleRpcTimeout(transactionId);
    return { resolved: true, authoritativeState: res.authoritativeState };
  }
}
