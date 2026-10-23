import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { NodeHealthEngine } from '@/lib/blockchain/node-health-engine';
import { TemporaryTransactionQueue } from '@/lib/payments/temporary-transaction-queue';
import { TransactionStateMachine } from '@/lib/payments/transaction-state-machine';
import { ReservationService } from '@/lib/payments/reservation-service';
import { FundsService } from '@/lib/payments/funds-service';
import { getContract, getSystemWallet } from '@/lib/blockchain/client';
import SecureChainPaymentArtifact from '../../../../../artifacts/contracts/SecureChainPayment.sol/SecureChainPayment.json';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      transactionId: customTxId,
      senderWallet,
      recipientWallet,
      amount,
      asset = 'HSCT',
      idempotencyKey,
      expirySeconds = 3600,
      canonicalPayload,
      signature,
    } = body;

    // 1. Mandatory Validations
    if (!senderWallet || !recipientWallet || !amount || !idempotencyKey) {
      return NextResponse.json(
        { success: false, error: 'Missing required payment parameters (senderWallet, recipientWallet, amount, idempotencyKey).' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Payment amount must be a positive number.' },
        { status: 400 }
      );
    }

    const cleanSender = senderWallet.toLowerCase().trim();
    const cleanRecipient = recipientWallet.toLowerCase().trim();

    if (cleanSender === cleanRecipient) {
      return NextResponse.json(
        { success: false, error: 'Sender and recipient cannot be the same address.' },
        { status: 400 }
      );
    }

    const resolvedTxId = customTxId || `SC_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    let existingTemp: any = null;
    try {
      existingTemp = await Promise.race([
        prisma.temporaryTransaction.findFirst({
          where: {
            OR: [{ idempotencyKey }, { transactionId: resolvedTxId }],
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 2000)),
      ]);
    } catch (e: any) {
      console.warn('[API /payments/initialize] Prisma idempotency check warning (DB offline):', e.message);
    }

    if (existingTemp) {
      console.info(`[API /payments/initialize] Idempotent request hit for ${existingTemp.transactionId}. Returning current state.`);
      return NextResponse.json({
        success: true,
        idempotentReplay: true,
        transactionId: existingTemp.transactionId,
        status: existingTemp.status,
        amount: Number(existingTemp.amount),
        asset: existingTemp.asset,
        senderWallet: existingTemp.senderWallet,
        recipientWallet: existingTemp.recipientWallet,
        blockchainTxHash: existingTemp.blockchainTxHash,
        blockNumber: existingTemp.blockNumber,
      });
    }

    // 3. Cryptographic Signature Check if supplied
    if (canonicalPayload && signature) {
      try {
        const recovered = ethers.verifyMessage(canonicalPayload, signature);
        if (recovered.toLowerCase() !== cleanSender) {
          return NextResponse.json(
            { success: false, error: `Cryptographic signature mismatch: recovered ${recovered} vs sender ${cleanSender}` },
            { status: 401 }
          );
        }
      } catch (sigErr: any) {
        return NextResponse.json(
          { success: false, error: `Invalid cryptographic signature: ${sigErr.message}` },
          { status: 400 }
        );
      }
    }

    // 4. Pre-Transaction Funds Validation (Rule #3)
    const validation = await FundsService.validateFunds({
      walletAddress: cleanSender,
      amount: numAmount,
      asset,
      recipientAddress: cleanRecipient,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          code: validation.code || 'INSUFFICIENT_FUNDS',
          error: validation.error || 'Pre-transaction funds validation failed.',
          totalBalance: validation.totalBalance,
          availableBalance: validation.availableBalance,
          reservedBalance: validation.reservedBalance,
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    // 5. Node Health Evaluation (§8, §9)
    const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
    const healthEngine = NodeHealthEngine.getInstance();
    const { provider, report: healthReport } = await healthEngine.getHealthyProvider(contractAddress);

    // ─── PATH A: HEALTHY NODE AVAILABLE (ON-CHAIN INITIALIZATION) ───
    if (provider && contractAddress && (healthReport?.status === 'HEALTHY' || healthReport?.status === 'DEGRADED')) {
      console.info(`[API /payments/initialize] ⚡ Path A: Healthy node available (${healthReport?.name}). Initializing on-chain...`);

      // 1. Create On-Chain Lock Reservation
      const reservation = await ReservationService.createReservation({
        transactionId: resolvedTxId,
        walletAddress: cleanSender,
        amount: numAmount,
        asset,
        expiresAt,
        idempotencyKey,
        reservationType: 'ONCHAIN_LOCKED',
      });

      // 2. Initial state transitions
      await TransactionStateMachine.transition({
        transactionId: resolvedTxId,
        newState: 'SECURITY_VALIDATED',
        reason: 'Payment validated against security gate and spendable balance.',
        actor: 'User',
        systemComponent: 'PaymentOrchestrator',
      });

      await TransactionStateMachine.transition({
        transactionId: resolvedTxId,
        newState: 'ONCHAIN_INITIALIZING',
        reason: `Submitting initializePayment to smart contract via ${healthReport.name}.`,
        actor: 'System',
        systemComponent: 'PaymentOrchestrator',
      });

      try {
        const contract = getContract(contractAddress, SecureChainPaymentArtifact.abi, true);
        const txIdBytes32 = ethers.id(resolvedTxId);
        const scaledAmount = ethers.parseEther(String(numAmount));

        // Credit accounting balance on-chain if needed and wait for confirmation
        const currentAvail = await contract.availableBalance(cleanSender).catch(() => BigInt(0));
        if (currentAvail < scaledAmount) {
          const needed = (scaledAmount - currentAvail) + ethers.parseEther('1000');
          const creditTx = await contract.creditAccountingBalance(cleanSender, needed).catch(() => null);
          if (creditTx && typeof creditTx.wait === 'function') {
            await creditTx.wait(1).catch(() => null);
          }
        }

        const onChainTx = await contract.initializePaymentFor(
          txIdBytes32,
          cleanSender,
          cleanRecipient,
          scaledAmount,
          asset,
          Math.floor(expiresAt.getTime() / 1000)
        );

        const receipt = await onChainTx.wait(1);

        if (receipt && receipt.status === 1) {
          await TransactionStateMachine.transition({
            transactionId: resolvedTxId,
            newState: 'FUNDS_RESERVED',
            reason: `On-chain fund reservation confirmed in block #${receipt.blockNumber}. Recipient balance remains unchanged.`,
            actor: 'Blockchain',
            systemComponent: 'PaymentOrchestrator',
            blockchainTxHash: receipt.hash,
            blockNumber: receipt.blockNumber,
          });

          await TransactionStateMachine.transition({
            transactionId: resolvedTxId,
            newState: 'PROCESSING',
            reason: 'Payment entered processing; awaiting final validation.',
            actor: 'System',
            systemComponent: 'PaymentOrchestrator',
            blockchainTxHash: receipt.hash,
            blockNumber: receipt.blockNumber,
          });

          // Durably record transaction so finalize route and ledger track recipient accurately
          try {
            const prevTx = await Promise.race([
              prisma.temporaryTransaction.findFirst({
                orderBy: { createdAt: 'desc' },
              }),
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
            ]);
            const previousHash = prevTx?.integrityHash || '0'.repeat(64);
            const hashPayload = `${resolvedTxId}|${cleanSender}|${cleanRecipient}|${numAmount}|${asset}|${idempotencyKey}|${previousHash}`;
            const integrityHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

            await Promise.race([
              prisma.temporaryTransaction.create({
                data: {
                  transactionId: resolvedTxId,
                  senderWallet: cleanSender,
                  recipientWallet: cleanRecipient,
                  amount: numAmount,
                  asset,
                  chainId: 31337,
                  idempotencyKey,
                  status: 'PROCESSING',
                  expiresAt,
                  reservationId: reservation.reservationId,
                  integrityHash,
                  previousHash,
                  blockchainTxHash: receipt.hash,
                  blockNumber: receipt.blockNumber,
                  canonicalPayload,
                  signature,
                },
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
            ]);
          } catch (persistErr: any) {
            console.warn('[API /payments/initialize] Warning persisting Path A temporary transaction record:', persistErr.message);
          }

          return NextResponse.json({
            success: true,
            status: 'PROCESSING',
            route: 'ON_CHAIN',
            transactionId: resolvedTxId,
            reservationId: reservation.reservationId,
            blockchainTxHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            senderWallet: cleanSender,
            recipientWallet: cleanRecipient,
            amount: numAmount,
            asset,
            message: 'Funds reserved on-chain. Transaction is in PROCESSING.',
          });
        } else {
          throw new Error(`On-chain transaction reverted with status: ${receipt?.status}`);
        }
      } catch (onChainErr: any) {
        console.warn(`[API /payments/initialize] On-chain submission failed: ${onChainErr.message}. Falling back to durable temporary transaction.`);
        // Fallback to Path B
      }
    }

    // ─── PATH B: NO HEALTHY NODE AVAILABLE (DURABLE TEMPORARY TRANSACTION) ───
    console.info('[API /payments/initialize] ⏳ Path B: No healthy node available. Creating durable temporary transaction and application reservation...');

    // 1. Create Off-Chain Application Reservation
    const reservation = await ReservationService.createReservation({
      transactionId: resolvedTxId,
      walletAddress: cleanSender,
      amount: numAmount,
      asset,
      expiresAt,
      idempotencyKey,
      reservationType: 'OFFCHAIN_RESERVED',
    });

    // 2. Enqueue in Array Index + Doubly Linked List Queue (Durably backed by PostgreSQL)
    const queue = TemporaryTransactionQueue.getInstance();
    const queuedNode = await queue.enqueue({
      transactionId: resolvedTxId,
      senderWallet: cleanSender,
      recipientWallet: cleanRecipient,
      amount: numAmount,
      asset,
      idempotencyKey,
      reservationId: reservation.reservationId,
      expiresAt,
      canonicalPayload,
      signature,
    });

    // 3. State transitions
    await TransactionStateMachine.transition({
      transactionId: resolvedTxId,
      newState: 'SECURITY_VALIDATED',
      reason: 'Validation passed. No healthy node available.',
      actor: 'User',
      systemComponent: 'PaymentOrchestrator',
    });

    await TransactionStateMachine.transition({
      transactionId: resolvedTxId,
      newState: 'TEMP_PENDING',
      reason: 'Node unavailable. Created durable temporary transaction. Placed in execution queue.',
      actor: 'System',
      systemComponent: 'PaymentOrchestrator',
    });

    return NextResponse.json({
      success: true,
      status: 'TEMP_PENDING',
      route: 'OFFCHAIN_TEMPORARY',
      transactionId: resolvedTxId,
      reservationId: reservation.reservationId,
      senderWallet: cleanSender,
      recipientWallet: cleanRecipient,
      amount: numAmount,
      asset,
      message: 'Blockchain node unavailable. Payment placed in processing queue. Sender amount reserved in application; recipient balance remains unchanged.',
    });
  } catch (error: any) {
    console.error('[API /payments/initialize] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment initialization failed' },
      { status: 500 }
    );
  }
}
