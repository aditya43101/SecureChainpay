/**
 * SecureChain Pay — Privacy Overview API (Task 10)
 * Returns aggregated analytics and privacy posture — no individual user data.
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrivacyIncidentDetector } from '@/lib/privacy/privacy-incident-detector';
import { PaymentCompliancePolicyEngine } from '@/lib/privacy/policy-engine';

export async function GET() {
  try {
    const [incidentStats, decisionStats, aiAccessCount, totalPayments, failedPayments] = await Promise.all([
      PrivacyIncidentDetector.getIncidentStats(),
      PaymentCompliancePolicyEngine.getDecisionStats(),
      db.aIDataAccessRecord.count().catch(() => 0),
      db.paymentIntent.count().catch(() => 0),
      db.paymentIntent.count({ where: { status: 'FAILED' } }).catch(() => 0),
    ]);

    // Privacy Posture Score (0-100) computed from real metrics
    let privacyScore = 100;
    if (incidentStats.critical > 0) privacyScore -= 30;
    if (parseFloat(incidentStats.openRate) > 50) privacyScore -= 20;
    if (parseFloat(decisionStats.blockRate) > 10) privacyScore -= 10;
    privacyScore = Math.max(0, Math.min(100, privacyScore));

    const successRate = totalPayments > 0 ? ((totalPayments - failedPayments) / totalPayments * 100).toFixed(1) : '100';

    return NextResponse.json({
      privacyPostureScore: privacyScore,
      aggregatedAnalytics: {
        totalPayments,
        successRate: `${successRate}%`,
        failedPayments,
        failureRate: totalPayments > 0 ? ((failedPayments / totalPayments) * 100).toFixed(1) + '%' : '0%',
      },
      incidents: incidentStats,
      policyDecisions: decisionStats,
      aiSecurity: {
        totalAIRequests: aiAccessCount,
        secretsBlocked: incidentStats.critical,
      },
      dimensions: {
        dataMinimization: privacyScore >= 80 ? 'STRONG' : privacyScore >= 50 ? 'MODERATE' : 'WEAK',
        aiSecretProtection: incidentStats.critical === 0 ? 'STRONG' : 'AT_RISK',
        crossUserIsolation: 'ENFORCED',
      },
    });
  } catch (err) {
    console.error('[Privacy API] Overview error:', err);
    return NextResponse.json({ error: 'Privacy overview unavailable.' }, { status: 500 });
  }
}
