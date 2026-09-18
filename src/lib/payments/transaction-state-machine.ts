import { prisma } from '@/lib/prisma';

export type TransactionState =
  | 'CREATED'
  | 'SECURITY_VALIDATED'
  | 'TEMP_PENDING'
  | 'ONCHAIN_INITIALIZING'
  | 'ONCHAIN_INITIALIZED'
  | 'FUNDS_RESERVED'
  | 'PROCESSING'
  | 'FINAL_VALIDATION'
  | 'FINALIZATION_SUBMITTED'
  | 'CONFIRMING'
  | 'FINALIZED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'
  | 'QUARANTINED';

export interface TransitionParams {
  transactionId: string;
  newState: TransactionState;
  reason: string;
  actor: string;
  systemComponent: string;
  blockchainTxHash?: string | null;
  blockNumber?: number | null;
  confirmationInfo?: any;
  errorCode?: string | null;
}

export class TransactionStateMachine {
  /**
   * Complete allowed transition graph.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
    CREATED: ['SECURITY_VALIDATED', 'FAILED', 'QUARANTINED'],
    SECURITY_VALIDATED: ['ONCHAIN_INITIALIZING', 'TEMP_PENDING', 'FAILED', 'QUARANTINED'],
    TEMP_PENDING: ['ONCHAIN_INITIALIZING', 'EXPIRED', 'CANCEL_REQUESTED', 'CANCELLED', 'FAILED', 'QUARANTINED'],
    ONCHAIN_INITIALIZING: ['ONCHAIN_INITIALIZED', 'FUNDS_RESERVED', 'PROCESSING', 'TEMP_PENDING', 'FAILED', 'QUARANTINED'],
    ONCHAIN_INITIALIZED: ['FUNDS_RESERVED', 'PROCESSING', 'FAILED', 'QUARANTINED'],
    FUNDS_RESERVED: ['PROCESSING', 'CANCEL_REQUESTED', 'EXPIRED', 'FAILED', 'QUARANTINED'],
    PROCESSING: ['FINAL_VALIDATION', 'CANCEL_REQUESTED', 'EXPIRED', 'FAILED', 'QUARANTINED'],
    FINAL_VALIDATION: ['FINALIZATION_SUBMITTED', 'CANCEL_REQUESTED', 'FAILED', 'QUARANTINED'],
    FINALIZATION_SUBMITTED: ['CONFIRMING', 'FINALIZED', 'FAILED', 'QUARANTINED'],
    CONFIRMING: ['FINALIZED', 'FAILED', 'QUARANTINED'],
    CANCEL_REQUESTED: ['CANCELLED', 'FAILED', 'QUARANTINED'],
    EXPIRED: ['CANCEL_REQUESTED', 'CANCELLED', 'FAILED', 'QUARANTINED'],
    FAILED: ['QUARANTINED'],
    QUARANTINED: ['SECURITY_VALIDATED', 'CANCEL_REQUESTED', 'CANCELLED', 'FAILED'],
    FINALIZED: [], // Terminal
    CANCELLED: [], // Terminal
  };

  /**
   * Validate whether transition is mathematically allowed.
   */
  public static isValidTransition(fromState: TransactionState, toState: TransactionState): boolean {
    if (fromState === toState) return true; // Idempotent no-op
    const allowed = this.ALLOWED_TRANSITIONS[fromState];
    return Array.isArray(allowed) && allowed.includes(toState);
  }

  /**
   * Execute an auditable state transition in database with history logging.
   */
  public static async transition(params: TransitionParams): Promise<{
    success: boolean;
    previousState: TransactionState | null;
    newState: TransactionState;
    error?: string;
  }> {
    const {
      transactionId,
      newState,
      reason,
      actor,
      systemComponent,
      blockchainTxHash,
      blockNumber,
      confirmationInfo,
      errorCode,
    } = params;

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Locate existing record across models (TemporaryTransaction or PaymentIntent or TransactionStateHistory)
        const tempTx = await tx.temporaryTransaction.findUnique({
          where: { transactionId },
        });

        const paymentIntent = !tempTx
          ? await tx.paymentIntent.findUnique({ where: { idempotencyKey: transactionId } }).catch(() => null)
          : null;

        const latestHistory = !tempTx && !paymentIntent
          ? await tx.transactionStateHistory.findFirst({
              where: { transactionId },
              orderBy: { timestamp: 'desc' },
            })
          : null;

        const rawPrevState = (tempTx?.status || paymentIntent?.status || latestHistory?.newState || 'CREATED') as TransactionState;
        const previousState = rawPrevState;

        // 2. Enforce transition rule
        if (previousState !== newState && !this.isValidTransition(previousState, newState)) {
          const errMsg = `Illegal state transition from ${previousState} to ${newState} for transaction ${transactionId}`;
          console.error(`[TransactionStateMachine] ${errMsg}`);
          return {
            success: false,
            previousState,
            newState,
            error: errMsg,
          };
        }

        const now = new Date();

        // 3. Update TemporaryTransaction if exists
        if (tempTx) {
          await tx.temporaryTransaction.update({
            where: { transactionId },
            data: {
              status: newState,
              blockchainTxHash: blockchainTxHash || tempTx.blockchainTxHash,
              blockNumber: blockNumber !== undefined ? blockNumber : tempTx.blockNumber,
              failureReason: errorCode || (newState === 'FAILED' ? reason : tempTx.failureReason),
              lastAttemptAt: now,
            },
          });
        }

        // 4. Update PaymentIntent if exists
        if (paymentIntent) {
          await tx.paymentIntent.update({
            where: { id: paymentIntent.id },
            data: { status: newState },
          }).catch(() => null);
        }

        // 5. Append immutable audit history record
        await tx.transactionStateHistory.create({
          data: {
            transactionId,
            previousState,
            newState,
            timestamp: now,
            actor,
            systemComponent,
            reason,
            blockchainTxHash: blockchainTxHash || null,
            blockNumber: blockNumber || null,
            confirmationInfo: confirmationInfo ? confirmationInfo : null,
            errorCode: errorCode || null,
          },
        });

        // 6. If quarantined, automatically create QuarantineRecord
        if (newState === 'QUARANTINED') {
          await tx.quarantineRecord.upsert({
            where: { transactionId },
            update: {
              reason,
              expectedState: previousState,
              actualState: newState,
              evidence: {
                transitionAttempt: { from: previousState, to: newState },
                reason,
                actor,
                component: systemComponent,
                errorCode,
              },
            },
            create: {
              transactionId,
              reason,
              expectedState: previousState,
              actualState: newState,
              evidence: {
                transitionAttempt: { from: previousState, to: newState },
                reason,
                actor,
                component: systemComponent,
                errorCode,
              },
            },
          });
        }

        return {
          success: true,
          previousState,
          newState,
        };
      });
    } catch (err: any) {
      console.error(`[TransactionStateMachine] Exception transitioning ${transactionId} to ${newState}:`, err);
      return {
        success: false,
        previousState: null,
        newState,
        error: err.message || 'Database error during state transition',
      };
    }
  }

  /**
   * Retrieve complete chronological state audit trail.
   */
  public static async getHistory(transactionId: string) {
    return await prisma.transactionStateHistory.findMany({
      where: { transactionId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
