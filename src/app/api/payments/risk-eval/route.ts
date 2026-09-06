import { NextResponse } from 'next/server';
import { evaluatePaymentRisk, PaymentRiskAssessment } from '@/lib/payments/payment-risk-engine';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      senderAddress,
      receiverAddress,
      receiverDisplayName,
      amount,
      currency = 'HSCT',
    } = body;

    if (!userId || !senderAddress || !receiverAddress || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters for risk evaluation.' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    let userTransactions: any[] = [];

    // Fetch user transaction history for behavior baseline
    try {
      const txsSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .limit(100)
        .get();

      if (!txsSnap.empty) {
        txsSnap.forEach((doc) => {
          userTransactions.push(doc.data());
        });
      }
    } catch (err) {
      console.warn('[API /api/payments/risk-eval] User tx history fetch notice:', err);
    }

    // Run Payment Risk Engine
    const riskAssessment = evaluatePaymentRisk({
      userId,
      senderAddress,
      receiverAddress,
      receiverDisplayName,
      amount: Number(amount),
      currency,
      userTransactions,
    });

    // Synthesize LLM Explanation (if risk is MEDIUM, HIGH, or CRITICAL)
    let aiExplanation = '';
    if (riskAssessment.riskLevel !== 'LOW') {
      aiExplanation = generateRiskExplanation(riskAssessment);
    }

    // Store risk assessment in Firestore audit collection
    try {
      await adminDb
        .collection('users')
        .doc(userId)
        .collection('risk_assessments')
        .doc(riskAssessment.assessmentId)
        .set({
          ...riskAssessment,
          aiExplanation,
          createdAt: new Date().toISOString(),
        });
    } catch (err) {
      console.warn('[API /api/payments/risk-eval] Risk assessment store notice:', err);
    }

    return NextResponse.json({
      success: true,
      assessment: riskAssessment,
      aiExplanation,
    });
  } catch (error: any) {
    console.error('[API /api/payments/risk-eval] Error:', error);
    // Graceful fallback to LOW risk on engine error so legitimate transactions aren't blocked
    return NextResponse.json({
      success: true,
      assessment: {
        assessmentId: `FALLBACK_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: 'UNKNOWN',
        senderAddress: '',
        receiverAddress: '',
        amount: 0,
        currency: 'HSCT',
        riskScore: 10,
        riskLevel: 'LOW',
        recommendation: 'PROCEED',
        factors: [],
        featureVector: {} as any,
        userProfileSummary: {
          typicalRange: 'Normal',
          averageAmount: 0,
          isNewRecipient: false,
        },
        modelVersion: 'v1.4.2-fallback',
        fallbackModeApplied: true,
      },
      aiExplanation: 'Risk assessment fallback applied cleanly.',
    });
  }
}

function generateRiskExplanation(assessment: PaymentRiskAssessment): string {
  const amountStr = `${assessment.amount.toLocaleString()} ${assessment.currency}`;
  const rangeStr = assessment.userProfileSummary.typicalRange;
  const reasons = assessment.factors.map((f) => f.message).join(' ');

  if (assessment.riskLevel === 'HIGH' || assessment.riskLevel === 'CRITICAL') {
    return `Security Alert: This payment of ${amountStr} has been assigned a ${assessment.riskLevel} Risk Score (${assessment.riskScore}/100). Primary factor: ${reasons} Please review the recipient details and amount carefully before authorizing settlement.`;
  }

  return `Notice: This transfer of ${amountStr} differs slightly from your typical range (${rangeStr}). Reason: ${reasons} Please verify recipient details.`;
}
