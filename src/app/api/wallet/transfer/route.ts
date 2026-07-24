import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getContract } from '@/lib/blockchain/client';
import SecureChainLedgerABI from '../../../../../artifacts/contracts/SecureChainLedger.sol/SecureChainLedger.json';
import { dispatchNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromUserId, toUserId, amount, currency } = body;

    if (!fromUserId || !toUserId || !amount || !currency) {
      return NextResponse.json({ error: 'fromUserId, toUserId, amount, and currency are required' }, { status: 400 });
    }

    // 1. Verify balances via Prisma
    const senderWallet = await db.wallet.findFirst({ 
      where: { userId: fromUserId },
      include: { user: true }
    });
    const receiverWallet = await db.wallet.findFirst({ 
      where: { userId: toUserId },
      include: { user: true }
    });

    if (!senderWallet || !receiverWallet || !senderWallet.user || !receiverWallet.user) {
      return NextResponse.json({ error: 'Wallets or Users not found' }, { status: 404 });
    }

    if (Number(senderWallet.balance) < Number(amount)) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // 2. Perform DB transfer transaction (ACID compliant)
    const transactionRecord = await db.$transaction(async (tx) => {
      // Deduct from sender
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: { decrement: amount } }
      });

      // Add to receiver
      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: { increment: amount } }
      });

      // Create transaction log
      return tx.transaction.create({
        data: {
          senderId: fromUserId,
          receiverId: toUserId,
          amount,
          currency,
          type: 'TRANSFER',
          status: 'PENDING'
        }
      });
    });

    // 3. Anchor to Real Blockchain via Ethers
    // Fails if RPC or SYSTEM_PRIVATE_KEY is missing/invalid
    try {
      const ledgerAddress = process.env.LEDGER_CONTRACT_ADDRESS;
      if (!ledgerAddress) throw new Error("LEDGER_CONTRACT_ADDRESS not set in .env");

      const ledgerContract = getContract(ledgerAddress, SecureChainLedgerABI.abi, true);
      
      const tx = await ledgerContract.recordTransaction(
        transactionRecord.id,
        senderWallet.address,
        receiverWallet.address,
        amount.toString()
      );

      // Wait for confirmation
      const receipt = await tx.wait();

      // Update DB with real transaction hash
      const confirmedTx = await db.transaction.update({
        where: { id: transactionRecord.id },
        data: { 
          txHash: receipt.hash,
          status: 'COMPLETED'
        }
      });

      // -------------------------------------------------------------
      // NOTIFICATIONS
      // -------------------------------------------------------------
      await dispatchNotification({
        toEmail: senderWallet.user.email,
        subject: 'Transfer Successful - SecureChain Pay',
        message: `You successfully sent $${amount} ${currency} to ${receiverWallet.user.email}. Transaction ID: ${confirmedTx.id}`,
        event: 'WalletTransfer'
      });

      await dispatchNotification({
        toEmail: receiverWallet.user.email,
        subject: 'Funds Received - SecureChain Pay',
        message: `You received $${amount} ${currency} from ${senderWallet.user.email}. Transaction ID: ${confirmedTx.id}`,
        event: 'WalletTransfer'
      });

      return NextResponse.json({
        success: true,
        transaction: confirmedTx
      });

    } catch (chainError: any) {
      console.error("Blockchain anchoring failed:", chainError);
      
      // Rollback logic could be implemented here, but for now we mark it FAILED
      await db.transaction.update({
        where: { id: transactionRecord.id },
        data: { status: 'FAILED' }
      });

      return NextResponse.json({ 
        error: 'Blockchain confirmation failed. Is the RPC online and Contract deployed?', 
        details: chainError.message 
      }, { status: 502 });
    }

  } catch (error: any) {
    console.error('Real Transfer error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
