import { prisma } from '@/lib/prisma';
import { PaymentContinuityService } from './continuity-service';

export class PaymentRetryEngine {
  /**
   * Evaluates a failed or timed-out payment attempt and determines if it is safe to retry.
   */
  static async handleExecutionOutcome(intentId: string, outcome: { type: 'SUCCESS' | 'ERROR' | 'UNKNOWN', code?: string, executionId: string }) {
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { executions: true }
    });

    if (!intent) throw new Error('Intent not found');

    if (outcome.type === 'SUCCESS') {
       return await PaymentContinuityService.transitionState(intentId, 'CONFIRMED', 'Transaction confirmed on blockchain');
    }

    if (outcome.type === 'UNKNOWN' || outcome.code === 'RPC_TIMEOUT') {
       // We DO NOT fail or retry immediately. We must reconcile.
       await PaymentContinuityService.logFailure(intentId, outcome.executionId, outcome.code || 'UNKNOWN', true, 'MEDIUM');
       return await PaymentContinuityService.transitionState(intentId, 'BROADCAST_UNKNOWN', `Outcome unknown due to ${outcome.code}. Scheduling reconciliation.`);
    }

    // Handle definitive errors
    const maxAttempts = 3;
    const currentAttempts = intent.executions.length;

    if (currentAttempts >= maxAttempts) {
      await PaymentContinuityService.logFailure(intentId, outcome.executionId, outcome.code || 'MAX_RETRIES', false, 'HIGH');
      return await PaymentContinuityService.transitionState(intentId, 'MANUAL_REVIEW', 'Max retry attempts exhausted.');
    }

    // Deterministic policy
    const retryableErrors = ['NETWORK_TIMEOUT', 'NODE_UNHEALTHY', 'TEMPORARY_FAILURE'];
    const nonRetryableErrors = ['INSUFFICIENT_BALANCE', 'USER_REJECTED', 'INVALID_TRANSACTION', 'CONTRACT_REVERT'];

    const errorCode = outcome.code || 'UNKNOWN_ERROR';
    let isRetryable = false;

    if (retryableErrors.includes(errorCode)) {
       isRetryable = true;
    } else if (nonRetryableErrors.includes(errorCode)) {
       isRetryable = false;
    }

    await PaymentContinuityService.logFailure(
      intentId, 
      outcome.executionId, 
      errorCode, 
      isRetryable, 
      isRetryable ? 'MEDIUM' : 'HIGH'
    );

    if (isRetryable) {
       return await PaymentContinuityService.transitionState(intentId, 'RETRY_PENDING', `Scheduled for retry due to ${errorCode}`);
    } else {
       return await PaymentContinuityService.transitionState(intentId, 'FAILED', `Fatal error: ${errorCode}`);
    }
  }
}
