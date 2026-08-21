import { NextResponse } from 'next/server';
import { submitTransactionToLedger } from '@/lib/blockchain/hybrid-ledger';
import { ethers } from 'ethers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      applicationTransactionId,
      sender,
      receiver,
      amount,
      currency,
      canonicalPayload,
      signature,
      idempotencyKey
    } = body;

    // Strict validation
    if (!applicationTransactionId || !sender || !receiver || amount === undefined || !currency) {
      return NextResponse.json(
        { error: 'Missing required transaction fields for on-chain submission' },
        { status: 400 }
      );
    }

    // Cryptographic signature verification on server
    if (canonicalPayload && signature) {
      try {
        const recovered = ethers.verifyMessage(canonicalPayload, signature);
        if (recovered.toLowerCase() !== sender.toLowerCase()) {
          return NextResponse.json(
            { error: `Cryptographic signature mismatch: sender ${sender} does not match recovered address ${recovered}` },
            { status: 401 }
          );
        }
      } catch (sigErr: any) {
        return NextResponse.json(
          { error: `Invalid cryptographic signature: ${sigErr.message}` },
          { status: 400 }
        );
      }
    }

    // Submit to Smart Contract
    const submissionResult = await submitTransactionToLedger({
      applicationTransactionId,
      sender,
      receiver,
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
    });

    if (!submissionResult.success) {
      return NextResponse.json(
        {
          success: false,
          status: 'SUBMISSION_FAILED',
          error: submissionResult.error || 'Blockchain submission failed'
        },
        { status: 502 }
      );
    }

    // Automatically update global_blocks document with confirmed EVM proof
    try {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const adminDb = getAdminDb();
      await adminDb.collection('global_blocks').doc(applicationTransactionId).set(
        {
          status: 'CONFIRMED',
          blockchainTransactionHash: submissionResult.blockchainTransactionHash,
          blockHash: submissionResult.blockHash,
          chainId: submissionResult.chainId,
          contractAddress: submissionResult.contractAddress,
          confirmedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (dbUpdateErr) {
      console.warn('[API /api/transactions/submit] Non-fatal admin block update warning:', dbUpdateErr);
    }

    return NextResponse.json({
      success: true,
      status: 'CONFIRMED',
      blockchainTransactionHash: submissionResult.blockchainTransactionHash,
      blockNumber: submissionResult.blockNumber,
      blockHash: submissionResult.blockHash,
      chainId: submissionResult.chainId,
      contractAddress: submissionResult.contractAddress,
      confirmedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[API /api/transactions/submit] Unexpected error:', err);
    return NextResponse.json(
      { success: false, status: 'SUBMISSION_FAILED', error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
