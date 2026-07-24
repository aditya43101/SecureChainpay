import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPaymentGateway } from '@/lib/payments/gateway';
import { getContract, getSystemWallet } from '@/lib/blockchain/client';
import { ethers } from 'ethers';
import { dispatchNotification } from '@/lib/notifications';

// Important: Read ABI using require so it can be packaged by Next.js or use fs
import SecureChainLedgerArtifact from '../../../../../artifacts/contracts/SecureChainLedger.sol/SecureChainLedger.json';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, currency = 'USD', userId, action, paymentId, orderId, signature } = body;
    const gateway = getPaymentGateway();

    // Create a new Order
    if (action === 'CREATE_ORDER') {
      if (!amount) return NextResponse.json({ error: 'Amount required' }, { status: 400 });

      const order = await gateway.createOrder(Number(amount), currency);
      return NextResponse.json({ success: true, order });
    } 
    
    // Verify Payment Signature
    else if (action === 'VERIFY_PAYMENT') {
      if (!paymentId || !orderId || !signature || !userId) {
        return NextResponse.json({ error: 'Missing verification parameters' }, { status: 400 });
      }

      const isValid = gateway.verifySignature(orderId, paymentId, signature);

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
      }

      // Valid Signature -> Topup Wallet securely in PostgreSQL
      const wallet = await db.wallet.findFirst({ 
        where: { userId },
        include: { user: true } 
      });
      if (!wallet || !wallet.user) return NextResponse.json({ error: 'Wallet or User not found' }, { status: 404 });

      await db.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: Number(amount) } } // increment balance
      });

      // Record transaction in PostgreSQL
      let txRecord = await db.transaction.create({
        data: {
          receiverId: userId,
          amount: Number(amount),
          currency,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          txHash: `mock_${paymentId}`, // Temporary hash until blockchain confirms
          description: `Wallet Top-up via ${process.env.PAYMENT_GATEWAY_PROVIDER || 'mock'} (ID: ${paymentId})`
        }
      });

      // -------------------------------------------------------------
      // BLOCKCHAIN INTEGRATION
      // Write the transaction hash to the SecureChainLedger
      // -------------------------------------------------------------
      try {
        const contractAddress = process.env.LEDGER_CONTRACT_ADDRESS;
        if (contractAddress) {
          const contract = getContract(contractAddress, SecureChainLedgerArtifact.abi, true);
          const systemWallet = getSystemWallet();
          
          // Generate a bytes32 ID for the transaction record
          const txIdBytes32 = ethers.id(txRecord.id);
          
          // Record on blockchain
          // Parameters: bytes32 _txId, address _sender, address _receiver, uint256 _amount, string memory _currency
          const tx = await contract.recordTransaction(
            txIdBytes32,
            systemWallet.address, // Sender is the system
            wallet.address,       // Receiver is the user's wallet
            ethers.parseUnits(amount.toString(), 18), 
            currency
          );
          
          // Wait for confirmation
          const receipt = await tx.wait();
          
          if (receipt) {
            // Update PostgreSQL record with the real blockchain transaction hash
            txRecord = await db.transaction.update({
              where: { id: txRecord.id },
              data: { txHash: receipt.hash }
            });
            console.log(`Transaction recorded on blockchain successfully. Hash: ${receipt.hash}`);
          }
        } else {
          console.warn("LEDGER_CONTRACT_ADDRESS not found in .env, skipping blockchain recording.");
        }
      } catch (blockchainErr) {
        console.error("Failed to record transaction on blockchain:", blockchainErr);
        // We do not fail the request if blockchain logging fails, to keep the user experience smooth, 
        // but in a real-world scenario, you might want to queue it for retry.
      }

      // -------------------------------------------------------------
      // NOTIFICATIONS
      // -------------------------------------------------------------
      await dispatchNotification({
        toEmail: wallet.user.email ?? undefined,
        toPhone: undefined, // SMS disabled by feature flag anyway
        subject: 'Wallet Funded Successfully - SecureChain Pay',
        message: `Your wallet has been credited with $${amount} ${currency}. Transaction ID: ${txRecord.id}`,
        event: 'MoneyAdded'
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Wallet successfully funded',
        transaction: txRecord
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Payment gateway error:', error);
    return NextResponse.json({ 
      error: 'Gateway interaction failed. Check gateway configuration.' 
    }, { status: 500 });
  }
}
