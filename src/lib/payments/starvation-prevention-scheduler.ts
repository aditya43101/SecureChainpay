import { prisma } from '@/lib/prisma';

export interface ScheduledTransactionItem {
  transactionId: string;
  senderWallet: string;
  recipientWallet: string;
  amount: number;
  asset: string;
  idempotencyKey: string;
  reservationId: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  ageSeconds: number;
  timeToExpirySeconds: number;
  retryCount: number;
  priorityScore: number;
  isEligible: boolean;
  nextProcessingOpportunity: string;
}

export class StarvationPreventionScheduler {
  private static readonly MAX_RETRY_LIMIT = 5;
  private static readonly BASE_BACKOFF_SECONDS = 15;

  /**
   * Computes fair priority score for a queued transaction:
   * - Older transactions gain priority (ageSeconds * 1.5)
   * - Transactions approaching expiry receive a high boost (+ 500)
   * - Transactions with higher retry counts receive penalty to allow others a turn (- retryCount * 25)
   */
  public static calculatePriorityScore(tx: {
    createdAt: Date;
    expiresAt: Date;
    retryCount: number;
  }): {
    priorityScore: number;
    ageSeconds: number;
    timeToExpirySeconds: number;
    isEligible: boolean;
  } {
    const now = Date.now();
    const ageSeconds = Math.max(0, Math.floor((now - tx.createdAt.getTime()) / 1000));
    const timeToExpirySeconds = Math.floor((tx.expiresAt.getTime() - now) / 1000);

    // If expired or exceeded max retries, not eligible
    if (timeToExpirySeconds <= 0 || tx.retryCount >= this.MAX_RETRY_LIMIT) {
      return {
        priorityScore: -1,
        ageSeconds,
        timeToExpirySeconds,
        isEligible: false,
      };
    }

    // Near expiry bonus if less than 10 minutes remaining
    const nearExpiryBonus = timeToExpirySeconds < 600 ? 500 : 0;
    const retryPenalty = tx.retryCount * 25;

    const priorityScore = ageSeconds * 1.5 + nearExpiryBonus - retryPenalty;

    return {
      priorityScore: Math.round(priorityScore),
      ageSeconds,
      timeToExpirySeconds,
      isEligible: true,
    };
  }

  /**
   * Loads all pending temporary transactions from PostgreSQL and returns them
   * ordered by fair priority (highest priority first).
   */
  public static async getPrioritizedPendingTransactions(): Promise<ScheduledTransactionItem[]> {
    const pendingTxs = await prisma.temporaryTransaction.findMany({
      where: {
        status: { in: ['TEMP_PENDING', 'ONCHAIN_INITIALIZING'] },
        expiresAt: { gt: new Date() },
      },
    });

    const now = Date.now();

    const scheduledItems: ScheduledTransactionItem[] = pendingTxs.map((tx) => {
      const { priorityScore, ageSeconds, timeToExpirySeconds, isEligible } = this.calculatePriorityScore({
        createdAt: tx.createdAt,
        expiresAt: tx.expiresAt,
        retryCount: tx.retryCount,
      });

      const backoffMs = tx.retryCount * this.BASE_BACKOFF_SECONDS * 1000;
      const lastAttemptMs = tx.lastAttemptAt ? tx.lastAttemptAt.getTime() : tx.createdAt.getTime();
      const readyTime = new Date(lastAttemptMs + backoffMs);

      return {
        transactionId: tx.transactionId,
        senderWallet: tx.senderWallet,
        recipientWallet: tx.recipientWallet,
        amount: Number(tx.amount),
        asset: tx.asset,
        idempotencyKey: tx.idempotencyKey,
        reservationId: tx.reservationId,
        status: tx.status,
        createdAt: tx.createdAt,
        expiresAt: tx.expiresAt,
        ageSeconds,
        timeToExpirySeconds,
        retryCount: tx.retryCount,
        priorityScore,
        isEligible: isEligible && now >= readyTime.getTime(),
        nextProcessingOpportunity: readyTime > new Date() ? readyTime.toISOString() : 'IMMEDIATE',
      };
    });

    // Sort descending by priorityScore (highest priority first)
    return scheduledItems.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Returns true if there are eligible pending transactions in the database
   * that must be served before new non-prioritized requests.
   */
  public static async hasPendingDatabaseTransactions(): Promise<boolean> {
    const count = await prisma.temporaryTransaction.count({
      where: {
        status: { in: ['TEMP_PENDING', 'ONCHAIN_INITIALIZING'] },
        expiresAt: { gt: new Date() },
      },
    });
    return count > 0;
  }
}
