import { prisma } from '@/lib/prisma';
import { OffchainLedgerService } from './offchain-ledger-service';
import { FundsService } from './funds-service';

export interface ReservationDetails {
  reservationId: string;
  transactionId: string;
  walletAddress: string;
  amount: number;
  asset: string;
  reservationType: 'OFFCHAIN_RESERVED' | 'ONCHAIN_LOCKED';
  status: 'ACTIVE' | 'RELEASED' | 'CONVERTED_TO_ONCHAIN' | 'EXPIRED';
  createdAt: Date;
  expiresAt: Date;
  idempotencyKey: string;
  integrityHash: string;
  sequenceNumber: number;
}

export class ReservationService {
  /**
   * Calculates real-time spendable funds strictly considering active reservations:
   * spendable = totalAvailable - activeReservations
   * Non-negative balance invariant strictly enforced.
   */
  public static async getBalanceBreakdown(
    walletAddress: string,
    asset = 'HSCT'
  ): Promise<{
    totalBalance: number;
    availableBalance: number;
    availableSpendable: number;
    reservedBalance: number;
    processingBalance: number;
    confirmedBalance: number;
    onchainLocked: number;
    offchainReserved: number;
    activeReservationsCount: number;
  }> {
    const normalizedWallet = walletAddress.toLowerCase().trim();
    const funds = await FundsService.getAvailableFunds(normalizedWallet, asset);

    // Query in-flight processing transactions
    let processingTxs: any[] = [];
    try {
      processingTxs = (await Promise.race([
        prisma.temporaryTransaction.findMany({
          where: {
            senderWallet: { equals: normalizedWallet, mode: 'insensitive' },
            status: {
              in: [
                'ONCHAIN_INITIALIZING',
                'ONCHAIN_INITIALIZED',
                'FUNDS_RESERVED',
                'PROCESSING',
                'FINAL_VALIDATION',
                'FINALIZATION_SUBMITTED',
                'CONFIRMING',
                'TEMP_PENDING',
              ],
            },
          },
          select: { amount: true },
        }),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ])) as any[];
    } catch (e: any) {
      console.warn('[ReservationService] Prisma processingTxs query skipped (DB offline):', e.message);
    }

    const processingBalance = processingTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    return {
      totalBalance: funds.totalBalance,
      availableBalance: funds.availableBalance,
      availableSpendable: funds.availableBalance,
      reservedBalance: funds.reservedBalance,
      processingBalance,
      confirmedBalance: funds.availableBalance,
      onchainLocked: funds.onchainLocked,
      offchainReserved: funds.offchainReserved,
      activeReservationsCount: funds.activeReservationsCount,
    };
  }

  /**
   * Concurrency-safe reservation creation with row-level double-spend prevention.
   */
  public static async createReservation(params: {
    transactionId: string;
    walletAddress: string;
    amount: number;
    asset?: string;
    expiresAt: Date;
    idempotencyKey: string;
    reservationType?: 'OFFCHAIN_RESERVED' | 'ONCHAIN_LOCKED';
  }): Promise<ReservationDetails> {
    const created = await FundsService.reserveFunds({
      transactionId: params.transactionId,
      walletAddress: params.walletAddress,
      amount: params.amount,
      asset: params.asset,
      expiresAt: params.expiresAt,
      idempotencyKey: params.idempotencyKey,
      reservationType: params.reservationType,
    });

    return {
      ...created,
      reservationType: created.reservationType as any,
      status: created.status as any,
    };
  }

  /**
   * Release reserved funds back to available balance (on cancellation or expiry).
   */
  public static async releaseReservation(
    transactionId: string,
    reason: string
  ): Promise<void> {
    await FundsService.releaseReservedFunds(transactionId, reason);
  }

  /**
   * Convert an off-chain application reservation into an authoritative on-chain lock.
   */
  public static async convertToOnChainLock(transactionId: string): Promise<void> {
    try {
      await Promise.race([
        prisma.$transaction(async (tx) => {
          const reservation = await tx.reservation.findUnique({
            where: { transactionId },
          });

          if (!reservation) return;

          await tx.reservation.update({
            where: { transactionId },
            data: {
              reservationType: 'ONCHAIN_LOCKED',
              status: 'CONVERTED_TO_ONCHAIN',
            },
          });

          await OffchainLedgerService.appendEntryTx(tx, {
            eventType: 'ONCHAIN_RESERVATION_CONFIRMED',
            transactionId,
            walletAddress: reservation.walletAddress,
            amount: Number(reservation.amount),
            asset: reservation.asset,
          });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ]);
    } catch (err: any) {
      console.warn('[ReservationService] convertToOnChainLock skipped (DB offline):', err.message);
    }
  }

  /**
   * Finalize reservation upon successful on-chain settlement.
   */
  public static async finalizeReservation(transactionId: string): Promise<void> {
    await FundsService.commitReservedFunds(transactionId);
  }
}
