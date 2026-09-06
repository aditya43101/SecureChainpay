import { NextResponse } from 'next/server';
import { PaymentContinuityService } from '@/lib/payments/continuity-service';

export async function POST(request: Request) {
  try {
    const { action, intentId } = await request.json();

    if (!intentId) {
       return NextResponse.json({ error: 'Missing intentId' }, { status: 400 });
    }

    if (action === 'RPC_TIMEOUT') {
       // Simulate that a transaction was submitted but timed out
       const execution = await PaymentContinuityService.createExecutionAttempt(intentId, 'SIMULATED_RPC');
       await PaymentContinuityService.updateExecution(execution.id, {
         status: 'UNKNOWN',
         error: 'Simulated RPC Timeout'
       });
       await PaymentContinuityService.transitionState(intentId, 'BROADCAST_UNKNOWN', 'Simulated RPC Timeout');
       return NextResponse.json({ success: true, message: 'Simulated RPC Timeout. Intent moved to BROADCAST_UNKNOWN.' });
    }

    if (action === 'DATABASE_FAILURE') {
       await PaymentContinuityService.transitionState(intentId, 'FAILED', 'Simulated Database Failure');
       return NextResponse.json({ success: true, message: 'Simulated DB Failure' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
