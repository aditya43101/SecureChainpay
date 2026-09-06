/**
 * SecureChain Pay — Admin Policy Simulation API (Task 10)
 * Allows testing policy rules against mock payments without affecting real traffic.
 */
import { NextResponse } from 'next/server';
import { PaymentCompliancePolicyEngine } from '@/lib/privacy/policy-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount = 1000, riskScore = 30, velocity10m = 1, isNewRecipient = false } = body;

    const result = await PaymentCompliancePolicyEngine.simulate(amount, riskScore, velocity10m, isNewRecipient);

    return NextResponse.json({
      simulation: true,
      input: { amount, riskScore, velocity10m, isNewRecipient },
      result: {
        decision: result.decision,
        risks: result.risks,
        reasons: result.reasons,
        policyId: result.policyId,
        policyVersion: result.policyVersion,
        isDeterministicOverride: result.isDeterministicOverride,
      },
    });
  } catch (err) {
    console.error('[Privacy API] Simulation error:', err);
    return NextResponse.json({ error: 'Policy simulation failed.' }, { status: 500 });
  }
}
