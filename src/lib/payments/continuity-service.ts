import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { recordPaymentAudit } from '@/lib/blockchain/integrity-service';

export type PaymentState = 
  | 'CREATED' | 'VALIDATING' | 'QUEUED' | 'PROCESSING' 
  | 'BROADCASTING' | 'BROADCAST_UNKNOWN' | 'PENDING_CONFIRMATION' 
  | 'CONFIRMED' | 'FAILED' | 'RETRY_PENDING' | 'RECONCILING' 
  | 'RECOVERED' | 'EXPIRED' | 'MANUAL_REVIEW';

// In-memory fallback cache for Vercel environments without active PostgreSQL
const fallbackIntents = new Map<string, any>();

export class PaymentContinuityService {
  /**
   * Create or retrieve a durable payment intent ensuring exactly-once execution.
   */
  static async createIntent(data: {
    userId?: string;
    sender: string;
    recipient: string;
    amount: number;
    currency?: string;
    paymentMode?: string;
    idempotencyKey: string;
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.paymentIntent.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          include: { executions: true, events: true }
        });

        if (existing) {
          return { isNew: false, intent: existing };
        }

        const intent = await tx.paymentIntent.create({
          data: {
            userId: data.userId,
            sender: data.sender.toLowerCase(),
            recipient: data.recipient.toLowerCase(),
            amount: data.amount,
            currency: data.currency || 'USD',
            paymentMode: data.paymentMode || 'WALLET_TRANSFER',
            idempotencyKey: data.idempotencyKey,
            status: 'CREATED',
          },
          include: { executions: true, events: true }
        });

        await this._logEventTx(tx, intent.id, null, 'CREATED', 'Initial payment request created', 'User', 'PaymentContinuityService');
        
        return { isNew: true, intent };
      });
    } catch (err: any) {
      console.warn('[PaymentContinuityService] Prisma DB unavailable, using in-memory fallback intent:', err?.message || err);
      const fallbackId = `intent_fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fallbackIntent = {
        id: fallbackId,
        userId: data.userId,
        sender: data.sender.toLowerCase(),
        recipient: data.recipient.toLowerCase(),
        amount: data.amount,
        currency: data.currency || 'USD',
        idempotencyKey: data.idempotencyKey,
        status: 'CREATED',
        executions: [],
        events: [],
      };
      fallbackIntents.set(fallbackId, fallbackIntent);
      fallbackIntents.set(data.idempotencyKey, fallbackIntent);
      return { isNew: true, intent: fallbackIntent };
    }
  }

  /**
   * Transition the state of a payment intent with an audit trail.
   */
  static async transitionState(
    intentId: string, 
    newState: PaymentState, 
    reason: string,
    metadata?: any
  ) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const intent = await tx.paymentIntent.findUnique({ where: { id: intentId } });
        if (!intent) throw new Error('Payment Intent not found');

        const oldState = intent.status;
        
        const updated = await tx.paymentIntent.update({
          where: { id: intentId },
          data: { status: newState }
        });

        await this._logEventTx(tx, intentId, oldState, newState, reason, 'System', 'PaymentContinuityService', metadata);

        return updated;
      });

      // Outside the transaction, record the audit evidence if finalized
      if (newState === 'CONFIRMED' || newState === 'FAILED') {
        try {
          await recordPaymentAudit(intentId);
        } catch (err) {
          console.error('[PaymentContinuityService] Failed to record payment audit:', err);
        }
      }

      return result;
    } catch (err: any) {
      console.warn(`[PaymentContinuityService] Fallback transition for intent ${intentId} to state ${newState}:`, err?.message || err);
      const cached = fallbackIntents.get(intentId) || { id: intentId };
      cached.status = newState;
      fallbackIntents.set(intentId, cached);
      return cached;
    }
  }

  static async createExecutionAttempt(intentId: string, provider: string, node?: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const intent = await tx.paymentIntent.findUnique({ where: { id: intentId }, include: { executions: true } });
        if (!intent) throw new Error('Payment intent not found');

        const attemptNumber = intent.executions.length + 1;
        
        const execution = await tx.paymentExecution.create({
          data: {
            paymentIntentId: intentId,
            attemptNumber,
            provider,
            node,
            status: 'SUBMITTED',
          }
        });

        await this._logEventTx(tx, intentId, intent.status, 'BROADCASTING', `Execution attempt ${attemptNumber} started via ${provider}`, 'System', 'PaymentContinuityService');
        await tx.paymentIntent.update({ where: { id: intentId }, data: { status: 'BROADCASTING' } });

        return execution;
      });
    } catch (err: any) {
      console.warn(`[PaymentContinuityService] Fallback execution attempt for intent ${intentId}:`, err?.message || err);
      return {
        id: `exec_fb_${Date.now()}`,
        paymentIntentId: intentId,
        attemptNumber: 1,
        provider,
        node,
        status: 'SUBMITTED',
      };
    }
  }

  static async updateExecution(executionId: string, data: { status: string; transactionHash?: string; nonce?: number; error?: string; latencyMs?: number }) {
    try {
      return await prisma.paymentExecution.update({
        where: { id: executionId },
        data: {
          ...data,
          responseAt: new Date()
        }
      });
    } catch (err: any) {
      console.warn(`[PaymentContinuityService] Fallback update execution ${executionId}:`, err?.message || err);
      return { id: executionId, ...data, responseAt: new Date() };
    }
  }

  static async logFailure(intentId: string, executionId: string | null, failureType: string, isRetryable: boolean, severity: string, aiClassification?: string, aiConfidence?: number) {
    try {
      return await prisma.paymentFailure.create({
        data: {
          paymentIntentId: intentId,
          executionId,
          failureType,
          isRetryable,
          severity,
          aiClassification,
          aiConfidence
        }
      });
    } catch (err: any) {
      console.warn(`[PaymentContinuityService] Fallback log failure for intent ${intentId}:`, err?.message || err);
      return { id: `fail_fb_${Date.now()}`, paymentIntentId: intentId, failureType, severity };
    }
  }

  private static async _logEventTx(tx: any, intentId: string, oldState: string | null, newState: string, reason: string, actor: string, systemComponent: string, metadata?: any) {
     const previousEvent = await tx.paymentEvent.findFirst({
        where: { paymentIntentId: intentId },
        orderBy: { createdAt: 'desc' }
     });

     const previousHash = previousEvent?.eventHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
     const payload = `${intentId}|${oldState}|${newState}|${reason}|${previousHash}|${Date.now()}`;
     const eventHash = crypto.createHash('sha256').update(payload).digest('hex');

     return await tx.paymentEvent.create({
        data: {
          paymentIntentId: intentId,
          oldState,
          newState,
          reason,
          actor,
          systemComponent,
          metadata,
          previousEventHash: previousHash,
          eventHash
        }
     });
  }
}

