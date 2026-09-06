import { NextResponse } from 'next/server';
import {
  simulateNodeHashMismatch,
  simulatePaymentErasureAttack,
  simulatePaymentFieldTampering,
  triggerAutomatedRecovery,
  verifyMultiNodeConsistency,
} from '@/lib/blockchain/integrity-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing simulation action parameter.' },
        { status: 400 }
      );
    }

    let result: any = null;

    switch (action) {
      case 'node_corruption':
        result = await simulateNodeHashMismatch();
        break;
      case 'payment_erasure':
        result = await simulatePaymentErasureAttack();
        break;
      case 'payment_tamper':
        result = await simulatePaymentFieldTampering();
        break;
      case 'automated_recovery':
        result = await triggerAutomatedRecovery();
        break;
      case 'verify_nodes':
        result = await verifyMultiNodeConsistency();
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported simulation action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
    });
  } catch (error: any) {
    console.error('[API /api/integrity/simulate] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Simulation execution failed.' },
      { status: 500 }
    );
  }
}
