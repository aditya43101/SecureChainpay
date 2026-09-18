import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { TransactionStateMachine } from '@/lib/payments/transaction-state-machine';
import { FundsService } from '@/lib/payments/funds-service';
import { NodeHealthEngine } from '@/lib/blockchain/node-health-engine';
import { getContract } from '@/lib/blockchain/client';
import SecureChainPaymentArtifact from '../../../../../../artifacts/contracts/SecureChainPayment.sol/SecureChainPayment.json';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;

    // 1. Fetch Reservation & Temporary Transaction
    const reservation = await prisma.reservation.findUnique({
      where: { transactionId },
    });

    const tempTx = await prisma.temporaryTransaction.findUnique({
      where: { transactionId },
    });

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: `Cannot finalize: No active reservation found for ${transactionId}.` },
        { status: 400 }
      );
    }

    if (reservation.status === 'RELEASED') {
      return NextResponse.json(
        { success: false, error: `Cannot finalize: Reservation for ${transactionId} has already been released or cancelled.` },
        { status: 400 }
      );
    }

    // 2. Check Expiry (Rule #13)
    if (reservation.expiresAt <= new Date()) {
      await TransactionStateMachine.transition({
        transactionId,
        newState: 'EXPIRED',
        reason: 'Payment expired prior to finalization.',
        actor: 'PaymentOrchestrator',
        systemComponent: 'PaymentFinalizer',
      });
      await FundsService.releaseReservedFunds(transactionId, 'Expired prior to finalization');

      return NextResponse.json(
        { success: false, error: 'Cannot finalize: Reservation has expired.' },
        { status: 400 }
      );
    }

    // 3. Begin Final Validation
    await TransactionStateMachine.transition({
      transactionId,
      newState: 'FINAL_VALIDATION',
      reason: 'Executing final validation checks before on-chain commitment.',
      actor: 'System',
      systemComponent: 'PaymentFinalizer',
    });

    // 4. Blockchain Verification (Rule #5, #22)
    // Recipient spendable balance increases ONLY after final blockchain verification!
    const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
    const healthEngine = NodeHealthEngine.getInstance();
    const { provider, report } = await healthEngine.getHealthyProvider(contractAddress);

    let onChainTxHash: string | null = null;
    let blockNumber: number | null = null;
    let isBlockchainVerified = false;

    if (provider && contractAddress) {
      await TransactionStateMachine.transition({
        transactionId,
        newState: 'FINALIZATION_SUBMITTED',
        reason: 'Submitting finalizePayment to blockchain.',
        actor: 'System',
        systemComponent: 'PaymentFinalizer',
      });

      try {
        const contract = getContract(contractAddress, SecureChainPaymentArtifact.abi, true);
        const txIdBytes32 = ethers.id(transactionId);

        // Check if already finalized on-chain
        const alreadyDone = await contract.isPaymentFinalized(txIdBytes32).catch(() => false);
        if (alreadyDone) {
          isBlockchainVerified = true;
          onChainTxHash = tempTx?.blockchainTxHash || `0x${ethers.keccak256(ethers.toUtf8Bytes(transactionId))}`;
        } else {
          const tx = await contract.finalizePayment(txIdBytes32);
          const receipt = await tx.wait(1);

          if (receipt && receipt.status === 1) {
            onChainTxHash = receipt.hash;
            blockNumber = receipt.blockNumber;
            isBlockchainVerified = true;

            await TransactionStateMachine.transition({
              transactionId,
              newState: 'CONFIRMING',
              reason: `Finalization confirmed in block #${receipt.blockNumber}. Confirming finality.`,
              actor: 'Blockchain',
              systemComponent: 'PaymentFinalizer',
              blockchainTxHash: receipt.hash,
              blockNumber: receipt.blockNumber,
            });
          } else {
            throw new Error(`On-chain finalization transaction reverted: status ${receipt?.status}`);
          }
        }
      } catch (chainErr: any) {
        console.warn(`[API /payments/[id]/finalize] On-chain finalization error: ${chainErr.message}`);
        // Check read-only state fallback
        try {
          const readContract = getContract(contractAddress, SecureChainPaymentArtifact.abi, false);
          const isDone = await readContract.isPaymentFinalized(ethers.id(transactionId)).catch(() => false);
          if (isDone) {
            isBlockchainVerified = true;
          }
        } catch (_) {}
      }
    }

    // STRICT RECIPIENT CREDIT RULE:
    // If blockchain confirmation is NOT verified, reject finalization!
    if (!isBlockchainVerified) {
      console.error(`[API /payments/[id]/finalize] Finalization blocked: Blockchain verification required before crediting recipient.`);
      return NextResponse.json(
        {
          success: false,
          error: 'FINALIZATION_REJECTED: Recipient funds cannot be credited without verified blockchain finality.',
          status: 'VERIFYING',
        },
        { status: 400 }
      );
    }

    // 5. Commit Reserved Funds & Credit Recipient via authoritative FundsService
    const committed = await FundsService.commitReservedFunds(transactionId);

    const recipientWallet = tempTx?.recipientWallet;
    if (recipientWallet) {
      await FundsService.creditRecipient({
        transactionId,
        recipientAddress: recipientWallet,
        amount: Number(reservation.amount),
        asset: reservation.asset,
      });
    }

    // 6. Final State Transition: FINALIZED
    await TransactionStateMachine.transition({
      transactionId,
      newState: 'FINALIZED',
      reason: 'Payment finalized successfully with verified blockchain confirmation. Recipient credited.',
      actor: 'PaymentOrchestrator',
      systemComponent: 'PaymentFinalizer',
      blockchainTxHash: onChainTxHash,
      blockNumber,
    });

    return NextResponse.json({
      success: true,
      status: 'FINALIZED',
      transactionId,
      amount: Number(reservation.amount),
      asset: reservation.asset,
      blockchainTxHash: onChainTxHash,
      blockNumber,
      message: 'Payment finalized successfully with verified on-chain finality. Recipient credited.',
    });
  } catch (error: any) {
    console.error('[API /payments/[id]/finalize] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment finalization failed' },
      { status: 500 }
    );
  }
}
