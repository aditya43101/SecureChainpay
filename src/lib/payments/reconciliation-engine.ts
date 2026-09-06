import { prisma } from '@/lib/prisma';
import { PaymentContinuityService, PaymentState } from './continuity-service';
import { getProvider } from '../blockchain/client';

export class PaymentReconciliationEngine {
  /**
   * Scans the database for payments stuck in unknown states and attempts to reconcile them.
   */
  static async runRecoveryScanner() {
    const stuckPayments = await prisma.paymentIntent.findMany({
      where: {
        status: { in: ['BROADCAST_UNKNOWN', 'PROCESSING', 'BROADCASTING', 'PENDING_CONFIRMATION'] },
        updatedAt: { lt: new Date(Date.now() - 30000) } // older than 30s
      },
      include: { executions: true }
    });

    let recoveredCount = 0;
    for (const payment of stuckPayments) {
      const result = await this.reconcilePayment(payment.id);
      if (result && result !== 'RECONCILING') {
        recoveredCount++;
      }
    }
    
    return { scanned: stuckPayments.length, recovered: recoveredCount };
  }

  static async reconcilePayment(intentId: string) {
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { executions: true }
    });

    if (!intent) return null;

    // Transition to RECONCILING to prevent other workers from picking it up
    if (intent.status !== 'RECONCILING' && intent.status !== 'CONFIRMED' && intent.status !== 'FAILED') {
      await PaymentContinuityService.transitionState(intent.id, 'RECONCILING', 'Starting reconciliation process');
    }

    const provider = getProvider();
    let foundHash = null;
    let foundReceipt = null;

    // 1. Check all execution attempts for a transaction hash
    for (const execution of intent.executions) {
      if (execution.transactionHash) {
        try {
          const receipt = await provider.getTransactionReceipt(execution.transactionHash);
          if (receipt) {
            foundHash = execution.transactionHash;
            foundReceipt = receipt;
            break;
          }
        } catch (err) {
           console.warn(`[Reconciliation] Error checking receipt for ${execution.transactionHash}`);
        }
      }
    }

    // 2. Resolve outcome based on blockchain evidence
    if (foundReceipt) {
      // Transaction actually confirmed!
      if (foundReceipt.status === 1) {
         await prisma.paymentReconciliation.upsert({
            where: { paymentIntentId: intent.id },
            update: { status: 'MATCHED', matchConfidence: 1.0, resolution: 'CONFIRMED' },
            create: { paymentIntentId: intent.id, status: 'MATCHED', matchConfidence: 1.0, resolution: 'CONFIRMED' }
         });
         await PaymentContinuityService.transitionState(intent.id, 'CONFIRMED', `Reconciled: Found successful transaction ${foundHash}`);
         return 'CONFIRMED';
      } else {
         await PaymentContinuityService.transitionState(intent.id, 'FAILED', `Reconciled: Found reverted transaction ${foundHash}`);
         return 'FAILED';
      }
    } else {
      // No transaction found on chain.
      const timeSinceCreation = Date.now() - new Date(intent.createdAt).getTime();
      
      // If older than 2 minutes and no receipt, assume safe to retry.
      if (timeSinceCreation > 2 * 60 * 1000) { 
         await prisma.paymentReconciliation.upsert({
            where: { paymentIntentId: intent.id },
            update: { status: 'NO_MATCH', matchConfidence: 0.9, resolution: 'RETRY_SAFE' },
            create: { paymentIntentId: intent.id, status: 'NO_MATCH', matchConfidence: 0.9, resolution: 'RETRY_SAFE' }
         });
         await PaymentContinuityService.transitionState(intent.id, 'RETRY_PENDING', 'No transaction found after 2 minutes. Safe to retry.');
         return 'RETRY_PENDING';
      } else {
         // Still too early to tell
         return 'RECONCILING';
      }
    }
  }
}
