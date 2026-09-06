/**
 * SecureChain Pay — Payment Failure Analyzer (Task 11)
 * Analyzes payment logs, route telemetry, blockchain status, and policy decisions
 * to pinpoint root causes and recommend actionable next steps.
 */

import { db } from '@/lib/db';
import { PaymentAuditContext } from './payment-context-engine';

export type FailureCategory =
  | 'USER_INPUT_ERROR'
  | 'INSUFFICIENT_BALANCE'
  | 'NETWORK_FAILURE'
  | 'NODE_FAILURE'
  | 'POLICY_REJECTION'
  | 'INTEGRITY_TAMPER_DETECTED'
  | 'RECOVERY_EXHAUSTED'
  | 'PROVIDER_TIMEOUT'
  | 'CIRCUIT_BREAKER_TRIPPED'
  | 'UNKNOWN';

export interface FailureAnalysisResult {
  paymentId: string;
  category: FailureCategory;
  rootCause: string;
  userExplanation: string;
  technicalDetails: {
    failingStage?: string;
    routeAttempted?: string;
    errorCode?: string;
    lastEvent?: any;
    policyReasons?: string[];
  };
  recommendedAction: {
    actionType: 'RETRY_DIFFERENT_ROUTE' | 'TOP_UP_BALANCE' | 'VERIFY_RECIPIENT' | 'CONTACT_SUPPORT' | 'WAIT_AND_RETRY';
    suggestedRoute?: string;
    title: string;
    description: string;
  };
  confidence: number;
}

export class PaymentFailureAnalyzer {
  /**
   * Analyzes a failed or stalled payment intent.
   */
  public static async analyzeFailure(paymentIntentId: string): Promise<FailureAnalysisResult> {
    const intent = await db.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      include: {
        events: { orderBy: { createdAt: 'desc' } },
        auditRecord: true,
        executions: { orderBy: { attemptNumber: 'desc' } },
      },
    });

    if (!intent) {
      return {
        paymentId: paymentIntentId,
        category: 'UNKNOWN',
        rootCause: 'PaymentIntent not found in records',
        userExplanation: 'We could not locate this payment record in the system.',
        technicalDetails: {},
        recommendedAction: {
          actionType: 'CONTACT_SUPPORT',
          title: 'Contact Support',
          description: 'Provide the payment reference ID to customer operations.',
        },
        confidence: 1.0,
      };
    }

    const latestEvent = intent.events[0];
    const details = (latestEvent?.metadata as any) || (latestEvent?.reason as any) || {};
    const failureReason = typeof details === 'string' ? details : (details.reason || details.error || latestEvent?.reason || '');
    const route = (details.route as string) || 'ADAPTIVE';

    // 1. Check for Tamper / Integrity failure
    if (intent.auditRecord?.verificationStatus === 'SUSPECTED_TAMPERING') {
      return {
        paymentId: intent.id,
        category: 'INTEGRITY_TAMPER_DETECTED',
        rootCause: 'Cryptographic hash chain or anchor verification failed for this transaction.',
        userExplanation:
          'Security anomaly detected: The cryptographic history proof for this transaction did not match our tamper-evident blockchain anchors.',
        technicalDetails: {
          failingStage: 'AUDIT_INTEGRITY_VERIFICATION',
          routeAttempted: route,
          errorCode: 'ERR_INTEGRITY_MISMATCH',
          lastEvent: latestEvent,
        },
        recommendedAction: {
          actionType: 'CONTACT_SUPPORT',
          title: 'Flagged for Security Review',
          description: 'Our compliance & security team is investigating this cryptographic mismatch.',
        },
        confidence: 0.98,
      };
    }

    // 2. Check for Insufficient Balance
    if (
      failureReason.toLowerCase().includes('insufficient') ||
      failureReason.toLowerCase().includes('balance') ||
      latestEvent?.newState === 'BALANCE_INSUFFICIENT'
    ) {
      return {
        paymentId: intent.id,
        category: 'INSUFFICIENT_BALANCE',
        rootCause: 'Sender wallet had insufficient available funds at execution time.',
        userExplanation: `Your wallet had insufficient balance to cover ${intent.amount} ${intent.currency} plus network fees.`,
        technicalDetails: {
          failingStage: 'BALANCE_RESERVATION',
          routeAttempted: route,
          errorCode: 'ERR_INSUFFICIENT_FUNDS',
          lastEvent: latestEvent,
        },
        recommendedAction: {
          actionType: 'TOP_UP_BALANCE',
          title: 'Top Up Wallet Balance',
          description: `Add funds in ${intent.currency} to your wallet before re-initiating the payment.`,
        },
        confidence: 0.99,
      };
    }

    // 3. Check for Policy Rejection / Compliance Block
    const policyDecision = await db.policyDecision.findFirst({
      where: { paymentIntentId: intent.id },
      orderBy: { createdAt: 'desc' },
    });

    if (policyDecision && (policyDecision.decision === 'BLOCK' || policyDecision.decision === 'REVIEW')) {
      const reasons = Array.isArray(policyDecision.reasons) ? policyDecision.reasons : [];
      const reasonMessages = reasons.map((r: any) => r.message || r.code || 'Compliance threshold');
      return {
        paymentId: intent.id,
        category: 'POLICY_REJECTION',
        rootCause: `Compliance policy rule triggered: ${reasonMessages.join(', ')}`,
        userExplanation:
          'This transaction was halted by automated compliance and safety rules to prevent unauthorized or risky activity.',
        technicalDetails: {
          failingStage: 'POLICY_EVALUATION',
          routeAttempted: route,
          errorCode: 'ERR_POLICY_BLOCKED',
          policyReasons: reasonMessages,
          lastEvent: latestEvent,
        },
        recommendedAction: {
          actionType: 'VERIFY_RECIPIENT',
          title: 'Review Payment Details',
          description: 'Ensure recipient address is verified and within normal transaction velocity limits.',
        },
        confidence: 0.95,
      };
    }

    // 4. Check for Circuit Breaker / Node Failure
    if (
      failureReason.toLowerCase().includes('circuit breaker') ||
      failureReason.toLowerCase().includes('node offline') ||
      failureReason.toLowerCase().includes('peer dropped')
    ) {
      return {
        paymentId: intent.id,
        category: 'NODE_FAILURE',
        rootCause: `Primary node on ${route} network experienced failure or trip.`,
        userExplanation: `The network provider (${route}) suffered a temporary node drop.`,
        technicalDetails: {
          failingStage: 'NETWORK_SETTLEMENT',
          routeAttempted: route,
          errorCode: 'ERR_NODE_CIRCUIT_BREAKER',
          lastEvent: latestEvent,
        },
        recommendedAction: {
          actionType: 'RETRY_DIFFERENT_ROUTE',
          suggestedRoute: route === 'LIGHTNING' ? 'INTERNAL' : 'LIGHTNING',
          title: 'Switch Route & Retry',
          description: `Reroute via ${route === 'LIGHTNING' ? 'Internal Ledger' : 'Lightning Network'} for instant clearance.`,
        },
        confidence: 0.92,
      };
    }

    // 5. Check for Provider Timeout / Network
    if (
      failureReason.toLowerCase().includes('timeout') ||
      failureReason.toLowerCase().includes('network') ||
      failureReason.toLowerCase().includes('econnrefused')
    ) {
      return {
        paymentId: intent.id,
        category: 'PROVIDER_TIMEOUT',
        rootCause: `Network connection to route gateway timed out after max retries.`,
        userExplanation: `The payment gateway encountered network congestion and did not confirm in time.`,
        technicalDetails: {
          failingStage: 'GATEWAY_BROADCAST',
          routeAttempted: route,
          errorCode: 'ERR_GATEWAY_TIMEOUT',
          lastEvent: latestEvent,
        },
        recommendedAction: {
          actionType: 'WAIT_AND_RETRY',
          suggestedRoute: 'ADAPTIVE',
          title: 'Retry with Adaptive Routing',
          description: 'Adaptive routing will automatically elect the lowest-latency healthy provider.',
        },
        confidence: 0.90,
      };
    }

    // Default Fallback
    return {
      paymentId: intent.id,
      category: 'NETWORK_FAILURE',
      rootCause: failureReason || 'Execution was interrupted during processing pipeline.',
      userExplanation:
        'The payment could not complete due to an unexpected gateway interruption. No funds were lost.',
      technicalDetails: {
        failingStage: latestEvent?.newState || 'EXECUTION_PIPELINE',
        routeAttempted: route,
        errorCode: 'ERR_GENERIC_EXECUTION',
        lastEvent: latestEvent,
      },
      recommendedAction: {
        actionType: 'WAIT_AND_RETRY',
        suggestedRoute: 'INTERNAL',
        title: 'Retry Payment',
        description: 'Try again with the internal instant route or contact support if the problem persists.',
      },
      confidence: 0.80,
    };
  }
}
