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
  const estimatedFee = details?.estimatedFee ?? (asset === 'HSCT' ? 0.01 : asset === 'USD' ? 0.25 : 0.0002);
  const totalAmount = Number((amount + estimatedFee).toFixed(6));
  const network = details?.network || (asset === 'HSCT' ? 'SecureChain Hybrid Ledger' : 'Ethereum Mainnet');

  // Compute available balance
  const availableBalance = useMemo(() => {
    if (!balances) return 0;
    const bal = (balances as any)[asset];
    if (bal !== undefined) return Number(bal);
    return asset === 'HSCT' ? balances.HSCT : balances.USD || 0;
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
      <div className="w-full max-w-md bg-neutral-900 border border-emerald-500/30 rounded-3xl overflow-hidden shadow-2xl space-y-0 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Final Payment Verification</h3>
              <p className="text-[11px] text-neutral-400">Review & Authorized Private Key Signer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSigning}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Warning Banner */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-amber-200">Mandatory Security Verification</p>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Verify the recipient address, amount, and network before signing. This operation will produce an immutable blockchain transaction.
              </p>
            </div>
          </div>

          {/* Transaction Summary Card */}
          <div className="bg-neutral-950 border border-white/10 rounded-2xl p-4 space-y-3 font-sans">
            {/* Recipient */}
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Recipient</span>
              <div className="text-right">
                <span className="text-xs font-bold text-white block">{details.recipientName}</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {details.recipientType === 'INTERNAL_USER' ? 'Verified User' : 'External Wallet'}
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
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Payment Amount</span>
              <span className="text-sm font-extrabold text-white">
                {amount.toLocaleString()} <span className="text-emerald-400 font-mono text-xs">{asset}</span>
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
            <div className="flex items-center justify-between py-1.5 border-b border-white/5 bg-white/[0.02] px-2 rounded-lg">
              <span className="text-xs font-bold text-neutral-200">Total Required</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">
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
                <span className="text-xs font-mono text-emerald-400 font-bold">{details.requestId}</span>
              </div>
            )}
          </div>

          {/* Balance Status */}
          <div className="flex items-center justify-between px-3 py-2 bg-black/40 rounded-xl text-xs">
            <span className="text-neutral-400 font-medium">Your Available Balance:</span>
            <span className={`font-mono font-bold ${isInsufficientBalance ? 'text-rose-400' : 'text-emerald-400'}`}>
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
        <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10 bg-neutral-950/80">
          <button
            onClick={onClose}
            disabled={isSigning}
            className="flex-1 py-3 text-xs font-bold bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl transition-colors border border-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAndSign}
            disabled={isSigning || isInsufficientBalance}
            className="flex-1 py-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:text-neutral-500 text-black rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
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
