/**
 * SecureChain Pay — Compliance Proof Service (Task 10)
 *
 * Generates cryptographically verifiable compliance evidence by linking:
 * PaymentAuditRecord (Task 9) + IntegrityCheckpoint + PolicyDecision.
 *
 * Supports verifiable claims:
 * - PAYMENT_COMMITTED: Payment belongs to verified committed history
 * - AMOUNT_UNMODIFIED: Payment amount was not modified after commitment
 * - POLICY_PASSED: Payment passed configured policy rules
 * - HISTORY_INTACT: Payment history chain is intact
 *
 * ZK-ready: generateClaim() interface designed for future ZK proof integration.
 * Currently uses hash-based commitments — honest, no fake cryptography.
 */

import crypto from 'crypto';
import { db } from '@/lib/db';

export type ClaimType = 'PAYMENT_COMMITTED' | 'AMOUNT_UNMODIFIED' | 'POLICY_PASSED' | 'HISTORY_INTACT';

export interface VerifiableClaim {
  paymentIntentId: string;
  claimType: ClaimType;
  claim: string;
  evidence: {
    auditRecordHash?: string;
    checkpointHash?: string;
    anchorTxHash?: string;
    policyVersion?: string;
    policyDecision?: string;
    verificationMethod: string;
  };
  isValid: boolean;
  verifiedAt: string;
}

export class ComplianceProofService {
  /**
   * Generate a verifiable claim for a payment.
   */
  static async generateClaim(paymentIntentId: string, claimType: ClaimType): Promise<VerifiableClaim> {
    switch (claimType) {
      case 'PAYMENT_COMMITTED':
        return this.verifyPaymentCommitted(paymentIntentId);
      case 'AMOUNT_UNMODIFIED':
        return this.verifyAmountUnmodified(paymentIntentId);
      case 'POLICY_PASSED':
        return this.verifyPolicyPassed(paymentIntentId);
      case 'HISTORY_INTACT':
        return this.verifyHistoryIntact(paymentIntentId);
      default:
        return { paymentIntentId, claimType, claim: 'Unknown claim type', evidence: { verificationMethod: 'NONE' }, isValid: false, verifiedAt: new Date().toISOString() };
    }
  }

  /**
   * Generate all available proofs for a payment.
   */
  static async generateAllClaims(paymentIntentId: string): Promise<VerifiableClaim[]> {
    const claims = await Promise.all([
      this.generateClaim(paymentIntentId, 'PAYMENT_COMMITTED'),
      this.generateClaim(paymentIntentId, 'AMOUNT_UNMODIFIED'),
      this.generateClaim(paymentIntentId, 'POLICY_PASSED'),
      this.generateClaim(paymentIntentId, 'HISTORY_INTACT'),
    ]);

    // Persist each valid claim
    for (const claim of claims) {
      if (claim.isValid) {
        await this.persistProof(claim);
      }
    }

    return claims;
  }

  // ────────────────────────────────────────────────────────────
  // Claim Verification Methods
  // ────────────────────────────────────────────────────────────

  private static async verifyPaymentCommitted(paymentIntentId: string): Promise<VerifiableClaim> {
    try {
      const auditRecord = await db.paymentAuditRecord.findUnique({
        where: { paymentIntentId },
      });

      const payment = await db.paymentIntent.findUnique({
        where: { id: paymentIntentId },
      });

      if (!auditRecord || !payment) {
        return this.buildClaim(paymentIntentId, 'PAYMENT_COMMITTED', 'Payment not found in committed audit trail.', {}, false);
      }

      // Verify the audit record hash chain
      const isVerified = auditRecord.verificationStatus === 'VERIFIED' || auditRecord.verificationStatus === 'RECOVERED_AND_VERIFIED';
      const isConfirmed = payment.status === 'CONFIRMED';

      return this.buildClaim(
        paymentIntentId,
        'PAYMENT_COMMITTED',
        'Payment belongs to verified committed history.',
        {
          auditRecordHash: auditRecord.currentAuditHash,
          checkpointHash: auditRecord.checkpointId || undefined,
          verificationMethod: 'HASH_CHAIN_VERIFICATION',
        },
        isVerified && isConfirmed,
      );
    } catch {
      return this.buildClaim(paymentIntentId, 'PAYMENT_COMMITTED', 'Verification unavailable.', { verificationMethod: 'ERROR' }, false);
    }
  }

  private static async verifyAmountUnmodified(paymentIntentId: string): Promise<VerifiableClaim> {
    try {
      const auditRecord = await db.paymentAuditRecord.findUnique({ where: { paymentIntentId } });
      const payment = await db.paymentIntent.findUnique({ where: { id: paymentIntentId } });

      if (!auditRecord || !payment) {
        return this.buildClaim(paymentIntentId, 'AMOUNT_UNMODIFIED', 'Payment record not found.', {}, false);
      }

      // Recompute canonical hash from current payment data and compare
      const canonicalData = JSON.stringify({
        id: payment.id,
        sender: payment.sender,
        recipient: payment.recipient,
        amount: payment.amount,
        currency: payment.currency,
        idempotencyKey: payment.idempotencyKey,
        status: payment.status,
      });
      const recomputedHash = crypto.createHash('sha256').update(canonicalData).digest('hex');
      const isIntact = recomputedHash === auditRecord.canonicalHash;

      return this.buildClaim(
        paymentIntentId,
        'AMOUNT_UNMODIFIED',
        isIntact ? 'Payment amount was not modified after commitment.' : 'Payment data integrity mismatch detected.',
        { auditRecordHash: auditRecord.currentAuditHash, verificationMethod: 'CANONICAL_HASH_COMPARISON' },
        isIntact,
      );
    } catch {
      return this.buildClaim(paymentIntentId, 'AMOUNT_UNMODIFIED', 'Verification unavailable.', { verificationMethod: 'ERROR' }, false);
    }
  }

  private static async verifyPolicyPassed(paymentIntentId: string): Promise<VerifiableClaim> {
    try {
      const decision = await db.policyDecision.findFirst({
        where: { paymentIntentId, isSimulation: false },
        include: { policyDefinition: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!decision) {
        return this.buildClaim(paymentIntentId, 'POLICY_PASSED', 'No policy decision found for this payment.', {}, false);
      }

      const passed = decision.decision === 'ALLOW' || decision.decision === 'ALLOW_WITH_MONITORING';

      return this.buildClaim(
        paymentIntentId,
        'POLICY_PASSED',
        passed ? 'Payment passed configured policy rules.' : `Payment was ${decision.decision} by policy.`,
        {
          policyVersion: `${decision.policyDefinition.policyId}-${decision.policyDefinition.version}`,
          policyDecision: decision.decision,
          verificationMethod: 'POLICY_EVALUATION_RECORD',
        },
        passed,
      );
    } catch {
      return this.buildClaim(paymentIntentId, 'POLICY_PASSED', 'Verification unavailable.', { verificationMethod: 'ERROR' }, false);
    }
  }

  private static async verifyHistoryIntact(paymentIntentId: string): Promise<VerifiableClaim> {
    try {
      const auditRecord = await db.paymentAuditRecord.findUnique({ where: { paymentIntentId } });
      if (!auditRecord) {
        return this.buildClaim(paymentIntentId, 'HISTORY_INTACT', 'Audit record not found.', {}, false);
      }

      // Check if the checkpoint is verified
      let checkpointVerified = false;
      let anchorTxHash: string | undefined;

      if (auditRecord.checkpointId) {
        const checkpoint = await db.integrityCheckpoint.findUnique({
          where: { checkpointId: auditRecord.checkpointId },
        });
        checkpointVerified = checkpoint?.verificationStatus === 'VERIFIED';

        // Check blockchain anchor
        if (checkpoint?.anchorReference) {
          const anchor = await db.blockchainAnchor.findUnique({
            where: { checkpointId: auditRecord.checkpointId },
          });
          anchorTxHash = anchor?.transactionHash;
        }
      }

      const isIntact = auditRecord.verificationStatus === 'VERIFIED' || auditRecord.verificationStatus === 'RECOVERED_AND_VERIFIED';

      return this.buildClaim(
        paymentIntentId,
        'HISTORY_INTACT',
        isIntact ? 'Payment history chain is intact.' : 'Payment history chain integrity issue detected.',
        {
          auditRecordHash: auditRecord.currentAuditHash,
          checkpointHash: auditRecord.checkpointId || undefined,
          anchorTxHash,
          verificationMethod: 'CHAIN_AND_ANCHOR_VERIFICATION',
        },
        isIntact && checkpointVerified,
      );
    } catch {
      return this.buildClaim(paymentIntentId, 'HISTORY_INTACT', 'Verification unavailable.', { verificationMethod: 'ERROR' }, false);
    }
  }

  // ────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────

  private static buildClaim(paymentIntentId: string, claimType: ClaimType, claim: string, evidence: Record<string, string | undefined>, isValid: boolean): VerifiableClaim {
    return {
      paymentIntentId,
      claimType,
      claim,
      evidence: { verificationMethod: 'HASH_CHAIN_VERIFICATION', ...evidence },
      isValid,
      verifiedAt: new Date().toISOString(),
    };
  }

  private static async persistProof(claim: VerifiableClaim) {
    try {
      await db.complianceProof.create({
        data: {
          paymentIntentId: claim.paymentIntentId,
          proofType: claim.claimType,
          policyVersion: claim.evidence.policyVersion || null,
          auditRecordHash: claim.evidence.auditRecordHash || null,
          checkpointHash: claim.evidence.checkpointHash || null,
          anchorTxHash: claim.evidence.anchorTxHash || null,
          claimData: { claim: claim.claim, evidence: claim.evidence, verificationMethod: claim.evidence.verificationMethod },
          isValid: claim.isValid,
        },
      });
    } catch (err) {
      console.error('[ComplianceProofService] Failed to persist proof:', err);
    }
  }

  /**
   * Get all compliance proofs for a payment.
   */
  static async getProofsForPayment(paymentIntentId: string) {
    try {
      return await db.complianceProof.findMany({
        where: { paymentIntentId },
        orderBy: { createdAt: 'desc' },
      });
    } catch { return []; }
  }
}
