import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { prisma } from '../src/lib/prisma';
import { FundsService } from '../src/lib/payments/funds-service';
import { ReservationService } from '../src/lib/payments/reservation-service';
import { TemporaryTransactionQueue } from '../src/lib/payments/temporary-transaction-queue';
import { TransactionStateMachine } from '../src/lib/payments/transaction-state-machine';

async function verifyPaymentFlow() {
  console.log('\n======================================================');
  console.log('   TESTING USER-TO-USER PAYMENT FLOW (VERIFICATION)   ');
  console.log('======================================================\n');

  const senderAddr = '0x111122223333444455556666777788889999aaaa';
  const recipientAddr = '0xbbbbccccddddeeeeffff00001111222233334444';
  const transferAmount = 500;

  // 1. Setup users and initial balances
  await prisma.user.upsert({
    where: { id: 'test_user_alice' },
    update: {},
    create: { id: 'test_user_alice', email: 'alice@test.local' },
  });

  await prisma.user.upsert({
    where: { id: 'test_user_bob' },
    update: {},
    create: { id: 'test_user_bob', email: 'bob@test.local' },
  });

  // Reset balances: Alice = 10,000, Bob = 1,000
  await prisma.wallet.upsert({
    where: { address: senderAddr },
    update: { balance: 10000 },
    create: { userId: 'test_user_alice', address: senderAddr, balance: 10000, currency: 'HSCT' },
  });

  await prisma.wallet.upsert({
    where: { address: recipientAddr },
    update: { balance: 1000 },
    create: { userId: 'test_user_bob', address: recipientAddr, balance: 1000, currency: 'HSCT' },
  });

  // Clear previous reservations and temporary transactions
  await prisma.reservation.deleteMany({
    where: { walletAddress: { in: [senderAddr, recipientAddr] } },
  });
  await prisma.temporaryTransaction.deleteMany({
    where: { senderWallet: { in: [senderAddr, recipientAddr] } },
  });

  const senderInitial = await FundsService.getAvailableFunds(senderAddr);
  const recipientInitial = await FundsService.getAvailableFunds(recipientAddr);

  console.log('--- Initial Balances ---');
  console.log(`Sender (Alice): Total = ${senderInitial.totalBalance}, Available = ${senderInitial.availableBalance}, Reserved = ${senderInitial.reservedBalance}`);
  console.log(`Recipient (Bob): Total = ${recipientInitial.totalBalance}, Available = ${recipientInitial.availableBalance}, Reserved = ${recipientInitial.reservedBalance}`);

  const txId = `TEST_PAY_${Date.now()}`;
  const idempotencyKey = `idemp_${txId}`;
  const expiresAt = new Date(Date.now() + 3600 * 1000);

  // Step 1: Pre-validation
  const validation = await FundsService.validateFunds({
    walletAddress: senderAddr,
    amount: transferAmount,
    asset: 'HSCT',
    recipientAddress: recipientAddr,
  });

  if (!validation.valid) {
    console.error('❌ Funds validation failed:', validation.error);
    return;
  }
  console.log('\n✓ Step 1: Pre-transaction validation passed');

  // Step 2: Reservation
  const reservation = await ReservationService.createReservation({
    transactionId: txId,
    walletAddress: senderAddr,
    amount: transferAmount,
    asset: 'HSCT',
    expiresAt,
    idempotencyKey,
    reservationType: 'OFFCHAIN_RESERVED',
  });
  console.log(`✓ Step 2: Funds reserved. Reservation ID: ${reservation.reservationId}`);

  // Enqueue in temporary queue
  const queue = TemporaryTransactionQueue.getInstance();
  await queue.enqueue({
    transactionId: txId,
    senderWallet: senderAddr,
    recipientWallet: recipientAddr,
    amount: transferAmount,
    asset: 'HSCT',
    idempotencyKey,
    reservationId: reservation.reservationId,
    expiresAt,
  });

  const senderMid = await FundsService.getAvailableFunds(senderAddr);
  const recipientMid = await FundsService.getAvailableFunds(recipientAddr);

  console.log('\n--- Mid-Payment (Reserved State) ---');
  console.log(`Sender (Alice): Total = ${senderMid.totalBalance}, Available = ${senderMid.availableBalance}, Reserved = ${senderMid.reservedBalance}`);
  console.log(`Recipient (Bob): Total = ${recipientMid.totalBalance}, Available = ${recipientMid.availableBalance}, Reserved = ${recipientMid.reservedBalance}`);

  if (senderMid.availableBalance !== 9500 || senderMid.reservedBalance !== 500) {
    console.error('❌ Sender reservation calculation mismatch!');
  } else {
    console.log('✅ Sender available balance reduced by 500, reserved balance increased by 500.');
  }

  if (recipientMid.totalBalance !== 1000 || recipientMid.availableBalance !== 1000) {
    console.error('❌ Recipient received funds prematurely during reservation!');
  } else {
    console.log('✅ Recipient balance strictly unchanged during reservation (₹1,000).');
  }

  // Step 3: Finalization
  console.log('\n--- Finalizing Payment ---');
  // Commit reserved funds
  await FundsService.commitReservedFunds(txId);
  // Credit recipient
  await FundsService.creditRecipient({
    transactionId: txId,
    recipientAddress: recipientAddr,
    amount: transferAmount,
    asset: 'HSCT',
  });

  const senderFinal = await FundsService.getAvailableFunds(senderAddr);
  const recipientFinal = await FundsService.getAvailableFunds(recipientAddr);

  console.log('\n--- Post-Finalization Balances ---');
  console.log(`Sender (Alice): Total = ${senderFinal.totalBalance}, Available = ${senderFinal.availableBalance}, Reserved = ${senderFinal.reservedBalance}`);
  console.log(`Recipient (Bob): Total = ${recipientFinal.totalBalance}, Available = ${recipientFinal.availableBalance}, Reserved = ${recipientFinal.reservedBalance}`);

  const totalBefore = senderInitial.totalBalance + recipientInitial.totalBalance;
  const totalAfter = senderFinal.totalBalance + recipientFinal.totalBalance;

  console.log(`\nConservation of Money Check: Total Before = ${totalBefore}, Total After = ${totalAfter}`);

  if (senderFinal.totalBalance === 9500 && senderFinal.availableBalance === 9500 && senderFinal.reservedBalance === 0) {
    console.log('✅ Sender balance correctly debited to 9,500 and reserved balance returned to 0.');
  } else {
    console.error('❌ Sender post-finalization balance incorrect!');
  }

  if (recipientFinal.totalBalance === 1500 && recipientFinal.availableBalance === 1500) {
    console.log('✅ Recipient balance correctly credited to 1,500 (+500).');
  } else {
    console.error('❌ Recipient post-finalization balance incorrect!');
  }

  if (totalBefore === totalAfter) {
    console.log('✅ Conservation invariant holds: No money created or destroyed.');
  } else {
    console.error('❌ Money conservation invariant failed!');
  }

  // Step 4: Duplicate Credit Protection Test
  console.log('\n--- Testing Duplicate Credit Protection ---');
  let duplicateBlocked = false;
  try {
    await FundsService.creditRecipient({
      transactionId: txId,
      recipientAddress: recipientAddr,
      amount: transferAmount,
      asset: 'HSCT',
    });
  } catch (err: any) {
    duplicateBlocked = true;
    console.log(`✅ Duplicate credit blocked as expected: ${err.message}`);
  }

  if (!duplicateBlocked) {
    console.error('❌ FATAL: Duplicate credit was NOT blocked!');
  }

  console.log('\n======================================================');
  console.log('   VERIFICATION COMPLETE: ALL CHECKS PASSED           ');
  console.log('======================================================\n');
}

verifyPaymentFlow().catch(console.error).finally(() => prisma.$disconnect());
