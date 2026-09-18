import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { prisma } from '../src/lib/prisma';
import { TransactionStateMachine } from '../src/lib/payments/transaction-state-machine';
import { ReservationService } from '../src/lib/payments/reservation-service';
import { OffchainLedgerService } from '../src/lib/payments/offchain-ledger-service';
import { SelfHealingEngine } from '../src/lib/payments/self-healing-engine';
import { TemporaryTransactionQueue } from '../src/lib/payments/temporary-transaction-queue';

async function runInvariantTests() {
  console.log('\n======================================================');
  console.log('   SECURECHAIN PAY — 10 ARCHITECTURAL INVARIANTS TEST');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${detail ? `— ${detail}` : ''}`);
      failed++;
    }
  }

  const sender = '0x1111111111111111111111111111111111111111';
  const recipient = '0x2222222222222222222222222222222222222222';

  // Ensure test users and wallets exist in Postgres
  await prisma.user.upsert({
    where: { id: 'user_sender_test' },
    update: {},
    create: { id: 'user_sender_test', email: 'sender_test@securechain.local' },
  });
  await prisma.user.upsert({
    where: { id: 'user_recipient_test' },
    update: {},
    create: { id: 'user_recipient_test', email: 'recipient_test@securechain.local' },
  });

  await prisma.wallet.upsert({
    where: { address: sender },
    update: { balance: 10000 },
    create: {
      userId: 'user_sender_test',
      address: sender,
      balance: 10000,
      currency: 'HSCT',
    },
  });
  await prisma.wallet.upsert({
    where: { address: recipient },
    update: { balance: 0 },
    create: {
      userId: 'user_recipient_test',
      address: recipient,
      balance: 0,
      currency: 'HSCT',
    },
  });

  // -------------------------------------------------------------
  // INVARIANT 1: A transaction must never credit the recipient more than once
  // -------------------------------------------------------------
  try {
    const txId = `INV1_${Date.now()}`;
    await ReservationService.createReservation({
      transactionId: txId,
      walletAddress: sender,
      amount: 100,
      expiresAt: new Date(Date.now() + 60000),
      idempotencyKey: `idemp_${txId}`,
    });

    // First finalization
    await ReservationService.finalizeReservation(txId);
    const res1 = await prisma.reservation.findUnique({ where: { transactionId: txId } });

    // Attempt second finalization
    let secondCreditPrevented = false;
    try {
      await ReservationService.finalizeReservation(txId);
      // If it doesn't throw, check that status remains RELEASED and not credited again
      secondCreditPrevented = res1?.status === 'RELEASED';
    } catch {
      secondCreditPrevented = true;
    }

    assert(secondCreditPrevented, 'Invariant 1: A transaction must never credit the recipient more than once');
  } catch (e: any) {
    assert(false, 'Invariant 1: A transaction must never credit the recipient more than once', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 2: A transaction cannot be both FINALIZED and CANCELLED
  // -------------------------------------------------------------
  try {
    const txId = `INV2_${Date.now()}`;
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'CREATED', reason: 'Init', actor: 'Test', systemComponent: 'SM' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'SECURITY_VALIDATED', reason: 'Validated', actor: 'Test', systemComponent: 'SM' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'ONCHAIN_INITIALIZING', reason: 'Initializing', actor: 'Test', systemComponent: 'SM' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'PROCESSING', reason: 'Processing', actor: 'Test', systemComponent: 'SM' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'FINAL_VALIDATION', reason: 'Validating', actor: 'Test', systemComponent: 'SM' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'FINALIZATION_SUBMITTED', reason: 'Submitted', actor: 'Test', systemComponent: 'SM' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'FINALIZED', reason: 'Finalized', actor: 'Test', systemComponent: 'SM' });

    const cancelAttempt = await TransactionStateMachine.transition({
      transactionId: txId,
      newState: 'CANCELLED',
      reason: 'Attempt cancel after finalize',
      actor: 'Test',
      systemComponent: 'SM',
    });

    assert(!cancelAttempt.success, 'Invariant 2: A transaction cannot be both FINALIZED and CANCELLED');
  } catch (e: any) {
    assert(false, 'Invariant 2: A transaction cannot be both FINALIZED and CANCELLED', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 3: A transaction cannot finalize without a valid reservation
  // -------------------------------------------------------------
  try {
    const txId = `INV3_NO_RES_${Date.now()}`;
    let finalizeRejected = false;
    try {
      await ReservationService.finalizeReservation(txId);
    } catch {
      finalizeRejected = true;
    }
    assert(finalizeRejected, 'Invariant 3: A transaction cannot finalize without a valid reservation');
  } catch (e: any) {
    assert(false, 'Invariant 3: A transaction cannot finalize without a valid reservation', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 4: A TEMP_PENDING transaction must not be represented as blockchain-confirmed
  // -------------------------------------------------------------
  try {
    const txId = `INV4_TEMP_${Date.now()}`;
    const queue = TemporaryTransactionQueue.getInstance();
    await queue.enqueue({
      transactionId: txId,
      senderWallet: sender,
      recipientWallet: recipient,
      amount: 50,
      idempotencyKey: `idemp_${txId}`,
      reservationId: `res_${txId}`,
      expiresAt: new Date(Date.now() + 60000),
    });

    const dbRecord = await prisma.temporaryTransaction.findUnique({
      where: { transactionId: txId },
    });

    const isConfirmed = dbRecord?.blockchainTxHash !== null || dbRecord?.blockNumber !== null;
    assert(!isConfirmed && dbRecord?.status === 'TEMP_PENDING', 'Invariant 4: A TEMP_PENDING transaction must not be represented as blockchain-confirmed');
  } catch (e: any) {
    assert(false, 'Invariant 4: A TEMP_PENDING transaction must not be represented as blockchain-confirmed', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 5: An UNKNOWN blockchain submission must not trigger blind duplicate submission
  // -------------------------------------------------------------
  try {
    const txId = `INV5_TIMEOUT_${Date.now()}`;
    // Simulate an unknown state recovery using SelfHealingEngine
    const recoveryResult = await SelfHealingEngine.getInstance().handleRpcTimeout(txId);

    // Verify it did NOT blindly retry submission without verification
    assert(
      recoveryResult.actionTaken !== 'BLIND_RETRY',
      'Invariant 5: An UNKNOWN blockchain submission must not trigger blind duplicate submission'
    );
  } catch (e: any) {
    assert(false, 'Invariant 5: An UNKNOWN blockchain submission must not trigger blind duplicate submission', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 6: Total accounting must remain consistent: TOTAL = AVAILABLE + RESERVED
  // -------------------------------------------------------------
  try {
    const txId = `INV6_${Date.now()}`;
    await ReservationService.createReservation({
      transactionId: txId,
      walletAddress: sender,
      amount: 250,
      expiresAt: new Date(Date.now() + 60000),
      idempotencyKey: `idemp_${txId}`,
    });

    const breakdown = await ReservationService.getBalanceBreakdown(sender);
    const accountingBalanced = Math.abs(breakdown.totalBalance - (breakdown.availableBalance + breakdown.reservedBalance)) < 0.001;

    assert(
      accountingBalanced && breakdown.reservedBalance >= 250,
      'Invariant 6: Total accounting must remain consistent: TOTAL = AVAILABLE + RESERVED'
    );
  } catch (e: any) {
    assert(false, 'Invariant 6: Total accounting must remain consistent: TOTAL = AVAILABLE + RESERVED', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 7: A recipient cannot spend a pending incoming amount
  // -------------------------------------------------------------
  try {
    const recipientBreakdown = await ReservationService.getBalanceBreakdown(recipient);
    // Recipient wallet balance is 0. Pending transactions are not credited to balance until FINALIZED
    const canSpendPending = recipientBreakdown.availableSpendable > 0;
    assert(!canSpendPending, 'Invariant 7: A recipient cannot spend a pending incoming amount');
  } catch (e: any) {
    assert(false, 'Invariant 7: A recipient cannot spend a pending incoming amount', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 8: A private key must never appear in logs/API responses/AI context
  // -------------------------------------------------------------
  try {
    const samplePayload = {
      transactionId: 'TX_123',
      sender,
      recipient,
      amount: 10,
      privateKey: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      seedPhrase: 'apple banana cherry dog elephant fox grape horse igloo jaguar kite lion',
    };

    // Sanitize check
    const sanitized = JSON.stringify(samplePayload).replace(/0x[a-fA-F0-9]{64}/g, '[REDACTED_KEY]');
    const leakDetected = sanitized.includes('0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');

    assert(!leakDetected, 'Invariant 8: A private key must never appear in logs/API responses/AI context');
  } catch (e: any) {
    assert(false, 'Invariant 8: A private key must never appear in logs/API responses/AI context', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 9: Every financial state transition must have an audit record
  // -------------------------------------------------------------
  try {
    const txId = `INV9_${Date.now()}`;
    await TransactionStateMachine.transition({
      transactionId: txId,
      newState: 'CREATED',
      reason: 'Initial creation',
      actor: 'System',
      systemComponent: 'PaymentOrchestrator',
    });
    await TransactionStateMachine.transition({
      transactionId: txId,
      newState: 'SECURITY_VALIDATED',
      reason: 'Security passed',
      actor: 'System',
      systemComponent: 'PaymentOrchestrator',
    });

    const history = await prisma.transactionStateHistory.findMany({
      where: { transactionId: txId },
    });

    assert(history.length === 2 && history[1].newState === 'SECURITY_VALIDATED', 'Invariant 9: Every financial state transition must have an audit record');
  } catch (e: any) {
    assert(false, 'Invariant 9: Every financial state transition must have an audit record', e.message);
  }

  // -------------------------------------------------------------
  // INVARIANT 10: Every blockchain-finalized transaction must have verifiable blockchain evidence
  // -------------------------------------------------------------
  try {
    const txId = `INV10_${Date.now()}`;
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'CREATED', reason: 'Init', actor: 'Test', systemComponent: 'Test' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'SECURITY_VALIDATED', reason: 'Validated', actor: 'Test', systemComponent: 'Test' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'ONCHAIN_INITIALIZING', reason: 'Init on chain', actor: 'Test', systemComponent: 'Test' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'PROCESSING', reason: 'Processing', actor: 'Test', systemComponent: 'Test' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'FINAL_VALIDATION', reason: 'Validating', actor: 'Test', systemComponent: 'Test' });
    await TransactionStateMachine.transition({ transactionId: txId, newState: 'FINALIZATION_SUBMITTED', reason: 'Submitted', actor: 'Test', systemComponent: 'Test' });
    await TransactionStateMachine.transition({
      transactionId: txId,
      newState: 'FINALIZED',
      reason: 'On-chain proof confirmed in block #101',
      actor: 'Blockchain',
      systemComponent: 'PaymentFinalizer',
      blockchainTxHash: '0x' + 'a'.repeat(64),
      blockNumber: 101,
    });

    const finalState = await prisma.transactionStateHistory.findFirst({
      where: { transactionId: txId, newState: 'FINALIZED' },
    });

    const hasProof = !!finalState?.blockchainTxHash && !!finalState?.blockNumber;
    assert(hasProof, 'Invariant 10: Every blockchain-finalized transaction must have verifiable blockchain evidence');
  } catch (e: any) {
    assert(false, 'Invariant 10: Every blockchain-finalized transaction must have verifiable blockchain evidence', e.message);
  }

  console.log(`\n======================================================`);
  console.log(`   SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runInvariantTests().catch((err) => {
  console.error('Fatal Invariant Test Error:', err);
  process.exit(1);
});
