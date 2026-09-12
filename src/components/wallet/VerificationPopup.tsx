'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, X, Lock, CheckCircle2, Copy, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { generateHash, useWalletStore } from '@/stores/wallet-store';

export interface PaymentVerificationDetails {
  recipientName: string;
  recipientAddress: string;
  recipientType: 'INTERNAL_USER' | 'EXTERNAL_WALLET';
  amount: number;
  asset: string;
  network?: string;
  memo?: string;
  requestId?: string;
  estimatedFee?: number;
}

interface VerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  details: PaymentVerificationDetails | null;
  onConfirmSign: (details: PaymentVerificationDetails) => Promise<void>;
}

export function VerificationPopup({ isOpen, onClose, details, onConfirmSign }: VerificationPopupProps) {
  const { balances } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initialFingerprint, setInitialFingerprint] = useState<string | null>(null);

  const asset = details?.asset || 'HSCT';
  const amount = details?.amount || 0;
  const estimatedFee = details?.estimatedFee ?? (asset === 'HSCT' ? 0.01 : 0.0002);
  const totalAmount = Number((amount + estimatedFee).toFixed(6));
  const network = details?.network || (asset === 'HSCT' ? 'SecureChain Hybrid Ledger' : 'Ethereum Mainnet');

  // Compute available balance
  const availableBalance = useMemo(() => {
    if (!balances) return 0;
    const bal = (balances as any)[asset];
    if (bal !== undefined) return Number(bal);
    return balances.HSCT || 0;
  }, [balances, asset]);

  const isInsufficientBalance = availableBalance < totalAmount;

  // Compute snapshot fingerprint when details change
  useEffect(() => {
    if (isOpen && details) {
      const payloadString = `${details.recipientAddress.toLowerCase()}:${details.amount}:${details.asset}:${network}:${details.requestId || ''}`;
      generateHash(payloadString).then((hash) => {
        setInitialFingerprint(hash);
      });
      setErrorMessage(null);
      setIsSigning(false);
    } else {
      setInitialFingerprint(null);
    }
  }, [isOpen, details, network]);

  if (!isOpen || !details) return null;

  const handleCopyAddress = () => {
    if (details.recipientAddress) {
      navigator.clipboard.writeText(details.recipientAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmAndSign = async () => {
    if (isSigning || isInsufficientBalance) return;

    setIsSigning(true);
    setErrorMessage(null);

    try {
      // Re-validate fingerprint snapshot against current transaction details
      const currentPayloadString = `${details.recipientAddress.toLowerCase()}:${details.amount}:${details.asset}:${network}:${details.requestId || ''}`;
      const currentFingerprint = await generateHash(currentPayloadString);

      if (initialFingerprint && currentFingerprint !== initialFingerprint) {
        setIsSigning(false);
        setErrorMessage('Transaction parameters changed during review. Please review again.');
        // Refresh snapshot
        setInitialFingerprint(currentFingerprint);
        return;
      }

      // Re-check balance
      if (availableBalance < totalAmount) {
        setIsSigning(false);
        setErrorMessage(`Insufficient balance for this payment. Available: ${availableBalance} ${asset}, Required: ${totalAmount} ${asset}`);
        return;
      }

      // Proceed to secure signing & broadcast
      await onConfirmSign(details);
      onClose();
    } catch (err: any) {
      console.error('[VerificationPopup] Signing error:', err);
      setErrorMessage(err.message || 'Failed to sign transaction.');
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-[#FEEF8B]/30 rounded-3xl overflow-hidden shadow-[0_12px_48px_rgba(0,0,0,0.6)] space-y-0 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121212] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#FEEF8B]/15 text-[#FEEF8B] border border-[#FEEF8B]/30">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Final Payment Verification</h3>
              <p className="text-[11px] text-neutral-400">Review & Authorized Non-Custodial Signer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSigning}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scrollable if needed on smaller screens) */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Warning Banner */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-amber-200">Verify Details Before Signing</p>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Verify the recipient and amount before signing. Cryptographic signatures are irreversible on the ledger.
              </p>
            </div>
          </div>

          {/* Transaction Summary Card */}
          <div className="bg-black/90 border border-white/10 rounded-2xl p-4 space-y-2.5 font-sans">
            {/* Recipient */}
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Recipient</span>
              <div className="text-right">
                <span className="text-xs font-bold text-white block">{details.recipientName}</span>
                <span className="text-[10px] text-[#FEEF8B] font-mono">
                  {details.recipientType === 'INTERNAL_USER' ? 'Verified Contact' : 'External Wallet'}
                </span>
              </div>
            </div>

            {/* Wallet Address */}
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Wallet Address</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-300">
                <span>{`${details.recipientAddress.substring(0, 6)}...${details.recipientAddress.substring(details.recipientAddress.length - 4)}`}</span>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Copy Wallet Address"
                >
                  {copied ? <Check size={12} className="text-[#FEEF8B]" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Payment Amount</span>
              <span className="text-sm font-extrabold text-white">
                {amount.toLocaleString()} <span className="text-[#FEEF8B] font-mono text-xs">{asset}</span>
              </span>
            </div>

            {/* Estimated Fee */}
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Est. Network Fee</span>
              <span className="text-xs font-mono text-neutral-300">
                {estimatedFee} {asset}
              </span>
            </div>

            {/* Total Required */}
            <div className="flex items-center justify-between py-2 border-b border-white/5 bg-white/[0.03] px-2.5 rounded-xl">
              <span className="text-xs font-bold text-white">Total Required</span>
              <span className="text-sm font-black text-[#FEEF8B] font-mono">
                {totalAmount.toLocaleString()} {asset}
              </span>
            </div>

            {/* Network */}
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Network</span>
              <span className="text-xs font-medium text-neutral-300">{network}</span>
            </div>

            {/* Request ID if present */}
            {details.requestId && (
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-neutral-400 font-medium">Request ID</span>
                <span className="text-xs font-mono text-[#FEEF8B] font-bold">{details.requestId}</span>
              </div>
            )}
          </div>

          {/* Balance Status */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-black/70 rounded-xl text-xs border border-white/5">
            <span className="text-neutral-400 font-medium">Your Available Balance:</span>
            <span className={`font-mono font-bold ${isInsufficientBalance ? 'text-rose-400' : 'text-[#FEEF8B]'}`}>
              {availableBalance.toLocaleString()} {asset}
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isInsufficientBalance && !errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium text-center">
              Insufficient balance for this payment. Please top up your wallet.
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10 bg-[#121212] flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSigning}
            className="flex-1 py-3 text-xs font-bold bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl transition-colors border border-white/10 disabled:opacity-50 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAndSign}
            disabled={isSigning || isInsufficientBalance}
            className="flex-1 py-3 text-xs font-bold bg-[#FEEF8B] hover:bg-[#FDE047] disabled:bg-[#FEEF8B]/30 disabled:text-neutral-600 text-black rounded-xl transition-all shadow-[0_0_20px_rgba(254,239,139,0.3)] flex items-center justify-center gap-2 min-h-[44px]"
          >
            {isSigning ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Signing & Broadcasting...
              </>
            ) : (
              <>
                <Lock size={14} /> Confirm & Sign →
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
