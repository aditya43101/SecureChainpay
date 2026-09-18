import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { NodeHealthEngine } from '@/lib/blockchain/node-health-engine';
import { getContract } from '@/lib/blockchain/client';
import SecureChainPaymentArtifact from '../../../../../../artifacts/contracts/SecureChainPayment.sol/SecureChainPayment.json';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;

    const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
    const healthEngine = NodeHealthEngine.getInstance();
    const { provider, report } = await healthEngine.getHealthyProvider(contractAddress);

    if (!provider || !contractAddress) {
      return NextResponse.json({
        success: false,
        onChainReachable: false,
        error: 'No healthy blockchain node available to query contract state.',
      }, { status: 503 });
    }

    const txIdBytes32 = ethers.id(transactionId);
    const contract = getContract(contractAddress, SecureChainPaymentArtifact.abi, false);

    const payment = await contract.getPayment(txIdBytes32).catch(() => null);

    if (!payment || Number(payment.state) === 0) {
      return NextResponse.json({
        success: true,
        onChainReachable: true,
        existsOnChain: false,
        provider: report?.name,
        transactionId,
        message: 'Transaction not found on-chain (may be off-chain temporary or uncommitted).',
      });
    }

    const stateLabels = ['NONEXISTENT', 'RESERVED', 'FINALIZED', 'CANCELLED'];
    const stateIndex = Number(payment.state);

    return NextResponse.json({
      success: true,
      onChainReachable: true,
      existsOnChain: true,
      provider: report?.name,
      contractAddress,
      transactionId,
      state: stateLabels[stateIndex] || 'UNKNOWN',
      stateCode: stateIndex,
      sender: payment.sender,
      recipient: payment.recipient,
      amount: ethers.formatEther(payment.amount),
      lockedAmount: ethers.formatEther(payment.lockedAmount),
      currency: payment.currency,
      createdAt: new Date(Number(payment.createdAt) * 1000).toISOString(),
      expiry: new Date(Number(payment.expiry) * 1000).toISOString(),
      isExpired: Date.now() > Number(payment.expiry) * 1000,
    });
  } catch (error: any) {
    console.error('[API /payments/[id]/blockchain-state] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to query blockchain state' },
      { status: 500 }
    );
  }
}
