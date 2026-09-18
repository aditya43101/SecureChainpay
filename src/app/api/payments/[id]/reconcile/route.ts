import { NextResponse } from 'next/server';
import { SelfHealingEngine } from '@/lib/payments/self-healing-engine';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json().catch(() => ({}));
    const knownTxHash = body.blockchainTxHash;

    const selfHealing = SelfHealingEngine.getInstance();
    const result = await selfHealing.handleRpcTimeout(transactionId, knownTxHash);

    return NextResponse.json({
      success: true,
      transactionId,
      reconciled: result.recovered,
      authoritativeState: result.authoritativeState,
      actionTaken: result.actionTaken,
      blockchainTxHash: result.blockchainTxHash,
    });
  } catch (error: any) {
    console.error('[API /payments/[id]/reconcile] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Reconciliation failed' },
      { status: 500 }
    );
  }
}
