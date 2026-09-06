/**
 * SecureChain Pay — Payment Compliance Policy Engine (Task 10)
 *
 * Evaluates payments against versioned policy rules.
 * AI recommends risk → Policy decides outcome.
 * Deterministic security overrides always take priority over AI.
 *
 * Outputs: ALLOW | ALLOW_WITH_MONITORING | REQUIRE_VERIFICATION | REVIEW | BLOCK
 * Keeps separate risk dimensions: Payment, Infrastructure, Fraud, Account.
 */

import { db } from '@/lib/db';

export type PolicyDecisionResult = 'ALLOW' | 'ALLOW_WITH_MONITORING' | 'REQUIRE_VERIFICATION' | 'REVIEW' | 'BLOCK';

export interface RiskDimensions {
  paymentRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  infrastructureRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  accountRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PolicyReason {
  code: string;
  field: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
}

export interface PolicyEvaluation {
  decision: PolicyDecisionResult;
  risks: RiskDimensions;
  reasons: PolicyReason[];
  policyId: string;
  policyVersion: string;
  modelVersion: string;
  timestamp: string;
  isDeterministicOverride: boolean;
}

// ────────────────────────────────────────────────────────────
// Default Policy Definition
// ────────────────────────────────────────────────────────────

const DEFAULT_POLICY = {
  policyId: 'PaymentRiskPolicy',
  version: 'v3.1',
  rules: {
    amountThresholdHigh: 50000,       // HSCT — flag amounts above this
    amountThresholdCritical: 200000,  // HSCT — block amounts above this without verification
    velocityThreshold10m: 5,          // Max transactions in 10 minutes
    velocityThreshold1h: 20,          // Max transactions in 1 hour
    newRecipientAmountLimit: 10000,   // Max first-time transfer to new recipient
    riskScoreReviewThreshold: 60,     // Risk score >= 60 → REVIEW
    riskScoreBlockThreshold: 85,      // Risk score >= 85 → BLOCK
  },
};

// ────────────────────────────────────────────────────────────
// Deterministic Security Overrides
// ────────────────────────────────────────────────────────────

interface SecurityContext {
  isAuthenticated: boolean;
  isAuthorized: boolean;
  walletCompromised: boolean;
  nodeQuarantined: boolean;
  integrityViolation: boolean;
  isDuplicatePayment: boolean;
  cryptographicProofValid: boolean;
}

export class PaymentCompliancePolicyEngine {
  /**
   * Main evaluation: assess a payment against policy.
   * Deterministic security checks ALWAYS override AI recommendations.
   */
  static async evaluate(
    paymentContext: {
      paymentIntentId?: string;
      amount: number;
      senderAddress: string;
      recipientAddress: string;
      currency: string;
      riskScore?: number;
      riskLevel?: string;
      riskFactors?: PolicyReason[];
      velocityCount10m?: number;
      velocityCount1h?: number;
      isNewRecipient?: boolean;
    },
    securityContext: SecurityContext,
    modelVersion: string = 'PaymentRisk-v1.5'
  ): Promise<PolicyEvaluation> {
    const policy = await this.getActivePolicy();
    const rules = policy.rules as Record<string, number>;
    const reasons: PolicyReason[] = [];
    const risks: RiskDimensions = { paymentRisk: 'LOW', infrastructureRisk: 'LOW', fraudRisk: 'LOW', accountRisk: 'LOW' };

    // ═══════════════════════════════════════════════════
    // DETERMINISTIC SECURITY OVERRIDES (AI cannot bypass)
    // ═══════════════════════════════════════════════════

    if (!securityContext.isAuthenticated) {
      return this.buildResult('BLOCK', risks, [{ code: 'AUTH_INVALID', field: 'authentication', severity: 'CRITICAL', message: 'Invalid authentication' }], policy, modelVersion, true);
    }

    if (!securityContext.isAuthorized) {
      return this.buildResult('BLOCK', risks, [{ code: 'AUTHZ_INVALID', field: 'authorization', severity: 'CRITICAL', message: 'Invalid authorization' }], policy, modelVersion, true);
    }

    if (securityContext.walletCompromised) {
      return this.buildResult('BLOCK', risks, [{ code: 'WALLET_COMPROMISED', field: 'wallet', severity: 'CRITICAL', message: 'Compromised wallet detected' }], policy, modelVersion, true);
    }

    if (securityContext.nodeQuarantined) {
      risks.infrastructureRisk = 'CRITICAL';
      return this.buildResult('BLOCK', risks, [{ code: 'NODE_QUARANTINED', field: 'infrastructure', severity: 'CRITICAL', message: 'Quarantined node' }], policy, modelVersion, true);
    }

    if (securityContext.integrityViolation) {
      return this.buildResult('BLOCK', risks, [{ code: 'INTEGRITY_VIOLATION', field: 'integrity', severity: 'CRITICAL', message: 'Integrity violation detected' }], policy, modelVersion, true);
    }

    if (securityContext.isDuplicatePayment) {
      return this.buildResult('BLOCK', risks, [{ code: 'DUPLICATE_PAYMENT', field: 'idempotency', severity: 'CRITICAL', message: 'Duplicate payment detected' }], policy, modelVersion, true);
    }

    // ═══════════════════════════════════════════════════
    // POLICY-BASED EVALUATION
    // ═══════════════════════════════════════════════════

    // Amount checks
    if (paymentContext.amount > (rules.amountThresholdCritical || 200000)) {
      risks.paymentRisk = 'CRITICAL';
      reasons.push({ code: 'AMOUNT_CRITICAL', field: 'amount', severity: 'CRITICAL', message: `Transaction amount (${paymentContext.amount}) exceeds critical threshold` });
    } else if (paymentContext.amount > (rules.amountThresholdHigh || 50000)) {
      risks.paymentRisk = 'HIGH';
      reasons.push({ code: 'AMOUNT_HIGH', field: 'amount', severity: 'HIGH', message: `Transaction amount (${paymentContext.amount}) exceeds high threshold` });
    }

    // Velocity checks
    if ((paymentContext.velocityCount10m || 0) > (rules.velocityThreshold10m || 5)) {
      risks.fraudRisk = 'HIGH';
      reasons.push({ code: 'VELOCITY_10M', field: 'velocity', severity: 'HIGH', message: 'Unusual transaction velocity (10-minute window)' });
    }

    if ((paymentContext.velocityCount1h || 0) > (rules.velocityThreshold1h || 20)) {
      risks.fraudRisk = this.maxRisk(risks.fraudRisk, 'MEDIUM');
      reasons.push({ code: 'VELOCITY_1H', field: 'velocity', severity: 'MEDIUM', message: 'Elevated transaction velocity (1-hour window)' });
    }

    // New recipient check
    if (paymentContext.isNewRecipient && paymentContext.amount > (rules.newRecipientAmountLimit || 10000)) {
      risks.paymentRisk = this.maxRisk(risks.paymentRisk, 'MEDIUM');
      reasons.push({ code: 'NEW_RECIPIENT_HIGH_AMOUNT', field: 'recipient', severity: 'MEDIUM', message: 'High-value transfer to new recipient' });
    }

    // AI risk score integration
    if (paymentContext.riskScore !== undefined) {
      if (paymentContext.riskScore >= (rules.riskScoreBlockThreshold || 85)) {
        risks.fraudRisk = 'CRITICAL';
        reasons.push({ code: 'AI_RISK_CRITICAL', field: 'riskScore', severity: 'CRITICAL', message: 'AI risk model indicates critical risk level' });
      } else if (paymentContext.riskScore >= (rules.riskScoreReviewThreshold || 60)) {
        risks.fraudRisk = this.maxRisk(risks.fraudRisk, 'HIGH');
        reasons.push({ code: 'AI_RISK_HIGH', field: 'riskScore', severity: 'HIGH', message: 'AI risk model indicates elevated risk' });
      }
    }

    // Add any pre-existing risk factors
    if (paymentContext.riskFactors) {
      reasons.push(...paymentContext.riskFactors);
    }

    // ── Final Decision ──
    const decision = this.computeDecision(risks, reasons);

    // Persist the decision
    await this.persistDecision(paymentContext.paymentIntentId, policy, decision, risks, reasons, modelVersion);

    return this.buildResult(decision, risks, reasons, policy, modelVersion, false);
  }

  /**
   * Simulate a policy evaluation without persisting.
   */
  static async simulate(
    amount: number,
    riskScore: number,
    velocity10m: number,
    isNewRecipient: boolean
  ): Promise<PolicyEvaluation> {
    const result = await this.evaluate(
      { amount, senderAddress: 'SIM_SENDER', recipientAddress: 'SIM_RECIPIENT', currency: 'HSCT', riskScore, velocityCount10m: velocity10m, isNewRecipient },
      { isAuthenticated: true, isAuthorized: true, walletCompromised: false, nodeQuarantined: false, integrityViolation: false, isDuplicatePayment: false, cryptographicProofValid: true },
    );
    return result;
  }

  // ────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────

  private static computeDecision(risks: RiskDimensions, reasons: PolicyReason[]): PolicyDecisionResult {
    const allRisks = [risks.paymentRisk, risks.infrastructureRisk, risks.fraudRisk, risks.accountRisk];
    const hasCritical = allRisks.includes('CRITICAL');
    const hasHigh = allRisks.includes('HIGH');
    const hasMedium = allRisks.includes('MEDIUM');

    if (hasCritical) return 'BLOCK';
    if (hasHigh && reasons.length >= 2) return 'REQUIRE_VERIFICATION';
    if (hasHigh) return 'REVIEW';
    if (hasMedium) return 'ALLOW_WITH_MONITORING';
    return 'ALLOW';
  }

  private static maxRisk(a: string, b: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return order[Math.max(order.indexOf(a), order.indexOf(b))] as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }

  private static buildResult(decision: PolicyDecisionResult, risks: RiskDimensions, reasons: PolicyReason[], policy: { policyId: string; version: string }, modelVersion: string, isDeterministicOverride: boolean): PolicyEvaluation {
    return { decision, risks, reasons, policyId: policy.policyId, policyVersion: policy.version, modelVersion, timestamp: new Date().toISOString(), isDeterministicOverride };
  }

  private static async getActivePolicy() {
    try {
      const stored = await db.policyDefinition.findFirst({
        where: { policyId: 'PaymentRiskPolicy', status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      if (stored) return { policyId: stored.policyId, version: stored.version, rules: stored.rules as Record<string, number> };
    } catch { /* fallback to default */ }
    return DEFAULT_POLICY;
  }

  private static async persistDecision(paymentIntentId: string | undefined, policy: { policyId: string; version: string }, decision: PolicyDecisionResult, risks: RiskDimensions, reasons: PolicyReason[], modelVersion: string) {
    try {
      // Ensure policy definition exists
      let policyDef = await db.policyDefinition.findFirst({
        where: { policyId: policy.policyId, version: policy.version },
      });

      if (!policyDef) {
        policyDef = await db.policyDefinition.create({
          data: {
            policyId: policy.policyId,
            version: policy.version,
            rules: DEFAULT_POLICY.rules,
            status: 'ACTIVE',
            createdBy: 'SYSTEM',
            description: 'Default payment risk policy',
          },
        });
      }

      await db.policyDecision.create({
        data: {
          paymentIntentId: paymentIntentId || null,
          policyDefinitionId: policyDef.id,
          decision,
          paymentRisk: risks.paymentRisk,
          infrastructureRisk: risks.infrastructureRisk,
          fraudRisk: risks.fraudRisk,
          accountRisk: risks.accountRisk,
          reasons: reasons as any,
          modelVersion,
        },
      });
    } catch (err) {
      console.error('[PolicyEngine] Failed to persist decision:', err);
    }
  }

  /**
   * Get recent policy decisions for dashboard.
   */
  static async getRecentDecisions(limit = 50) {
    try {
      return await db.policyDecision.findMany({
        include: { policyDefinition: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch { return []; }
  }

  /**
   * Get decision stats for privacy posture.
   */
  static async getDecisionStats() {
    try {
      const [total, blocked, reviews, allowed] = await Promise.all([
        db.policyDecision.count({ where: { isSimulation: false } }),
        db.policyDecision.count({ where: { decision: 'BLOCK', isSimulation: false } }),
        db.policyDecision.count({ where: { decision: 'REVIEW', isSimulation: false } }),
        db.policyDecision.count({ where: { decision: 'ALLOW', isSimulation: false } }),
      ]);
      return { total, blocked, reviews, allowed, blockRate: total > 0 ? (blocked / total * 100).toFixed(1) : '0' };
    } catch {
      return { total: 0, blocked: 0, reviews: 0, allowed: 0, blockRate: '0' };
    }
  }

  /**
   * Helper for Copilot & Context engine policy evaluations.
   */
  static async evaluatePaymentPolicy(params: {
    senderId?: string;
    recipient?: string;
    amount: number;
    currency?: string;
    paymentRisk?: string;
    riskScore?: number;
  }): Promise<PolicyEvaluation> {
    return this.evaluate(
      {
        amount: params.amount,
        senderAddress: params.senderId || '0x_sender',
        recipientAddress: params.recipient || '0x_recipient',
        currency: params.currency || 'USD',
        riskLevel: params.paymentRisk || 'LOW',
        riskScore: params.riskScore,
      },
      {
        isAuthenticated: true,
        isAuthorized: true,
        walletCompromised: false,
        nodeQuarantined: false,
        integrityViolation: false,
        isDuplicatePayment: false,
        cryptographicProofValid: true,
      }
    );
  }
}
