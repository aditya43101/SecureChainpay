'use client';

import React, { useEffect, useState } from 'react';
import type { Transaction } from '@/stores/wallet-store';
import { useWalletStore } from '@/stores/wallet-store';
import { getStructuredAmount, sanitizeTxDescription } from '@/lib/currency/currency-service';
import { ComprehensiveVerificationResult, VerificationLayerResult } from '@/types/verification';
import { formatDateTime } from '@/lib/timezone-service';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Lock,
  Layers,
  FileCheck,
  RefreshCw,
  Hash,
  Clock,
  User,
  Coins,
} from 'lucide-react';

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function TransactionDetail({ transaction: initialTx, onClose }: TransactionDetailProps) {
  const [transaction, setTransaction] = useState<Transaction>(initialTx);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<ComprehensiveVerificationResult | null>(null);

  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{
    reconciliationStatus: string;
    verified: boolean;
    severity: string;
    actionPerformed: string;
    mismatches: string[];
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const reconcileStoreTx = useWalletStore((state) => state.reconcileTransaction);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const truncateString = (str: string | null | undefined, head = 8, tail = 8) => {
    if (!str) return 'N/A';
    if (str.length <= head + tail) return str;
    return `${str.substring(0, head)}...${str.substring(str.length - tail)}`;
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/transactions/verify-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionRecord: {
            ...transaction,
            applicationTransactionId: transaction.applicationTransactionId || transaction.id,
            userId: transaction.userId || '',
            sender: transaction.sender || transaction.walletAddress || '',
            receiver: transaction.receiver || transaction.payload?.receiverWallet || 'System',
            asset: transaction.asset === 'USD' ? 'HSCT' : (transaction.asset || transaction.currency || 'HSCT'),
            currency: transaction.currency === 'USD' ? 'HSCT' : (transaction.currency || 'HSCT'),
            type: transaction.type,
            status: transaction.status,
            description: transaction.description,
            idempotencyKey: transaction.idempotencyKey || transaction.id,
            canonicalPayload: transaction.canonicalPayload || '',
            transactionHash: transaction.transactionHash || transaction.hash,
            signature: transaction.signature || transaction.digitalSignature || '',
            senderPublicKey: transaction.senderPublicKey || '',
            blockchainTransactionHash: transaction.blockchainTransactionHash || null,
            blockNumber: transaction.blockNumber,
            blockHash: transaction.blockHash || null,
            chainId: transaction.chainId || null,
            contractAddress: transaction.contractAddress || null,
            createdAt: transaction.createdAt || transaction.date,
            merkleBatchId: transaction.merkleBatchId || null,
            merkleLeaf: transaction.merkleLeaf || null,
            merkleRoot: transaction.merkleRoot || null,
            anchorStatus: transaction.anchorStatus || null,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setVerificationResult(data.result);
        if (data.result.proofDetails?.blockchainTransactionHash || data.result.fullyVerified) {
          setTransaction((prev) => ({
            ...prev,
            status: 'CONFIRMED',
            reconciliationStatus: 'MATCHED',
            blockchainTransactionHash:
              data.result.proofDetails?.blockchainTransactionHash ?? prev.blockchainTransactionHash,
            blockNumber: data.result.proofDetails?.blockNumber ?? prev.blockNumber,
            blockHash: data.result.proofDetails?.blockHash ?? prev.blockHash,
            chainId: data.result.proofDetails?.chainId ?? prev.chainId,
            contractAddress: data.result.proofDetails?.contractAddress ?? prev.contractAddress,
          }));
          fetch(`/api/transactions/${transaction.applicationTransactionId || transaction.id}/reconcile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'MATCHED', source: 'verify-integrity' }),
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[VerifyIntegrity] Error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleExportProof = async () => {
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/export-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionRecord: {
            ...transaction,
            applicationTransactionId: transaction.applicationTransactionId || transaction.id,
            sender: transaction.sender || transaction.walletAddress || '',
            receiver: transaction.receiver || transaction.payload?.receiverWallet || 'System',
            asset: transaction.currency,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        const jsonStr = JSON.stringify(data.report, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proof_${transaction.applicationTransactionId || transaction.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[ExportProof] Error:', err);
    }
  };

  const handleRunReconciliation = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const result = await reconcileStoreTx(transaction.id, true);
      if (result) {
        setReconcileResult({
          reconciliationStatus: result.reconciliationStatus,
          verified: result.verified,
          severity: result.severity,
          actionPerformed: result.actionPerformed,
          mismatches: result.mismatches
            ? result.mismatches.map((m: any) => (typeof m === 'string' ? m : m.message))
            : [],
        });
        if (result.recoveredFields) {
          setTransaction((prev) => ({ ...prev, ...result.recoveredFields }));
        }
      }
    } catch (err: any) {
      setReconcileResult({
        reconciliationStatus: 'MANUAL_REVIEW_REQUIRED',
        verified: false,
        severity: 'CRITICAL',
        actionPerformed: 'QUERY_ERROR',
        mismatches: [err?.message || 'Reconciliation failed'],
      });
    } finally {
      setReconciling(false);
    }
  };

  const isConfirmed = transaction.status === 'CONFIRMED' || transaction.status === 'completed';
  const txHash = transaction.blockchainTransactionHash || transaction.hash || transaction.transactionHash;

  const renderLayerBadge = (layer: VerificationLayerResult) => {
    if (layer.status === 'VALID') {
      return <span className="text-emerald-400 font-bold font-mono text-[11px]">✓ VALID</span>;
    }
    if (layer.status === 'PENDING') {
      return <span className="text-amber-400 font-bold font-mono text-[11px]">⏳ PENDING</span>;
    }
    if (layer.status === 'SKIPPED') {
      return <span className="text-neutral-500 font-mono text-[11px]">SKIPPED</span>;
    }
    return <span className="text-rose-400 font-bold font-mono text-[11px]">✗ INVALID</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/15 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors z-20 min-h-[40px] min-w-[40px] flex items-center justify-center"
          aria-label="Close details"
        >
          <X size={18} />
        </button>

        <div className="p-5 sm:p-7 space-y-5">
          {/* SECTION 20: TRANSACTION HERO HEADER */}
          <div className="flex flex-col items-center text-center pt-2">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-inner ${
                transaction.type === 'credit'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
              }`}
            >
              {transaction.type === 'credit' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {transaction.type === 'credit' ? '+' : '-'}
              {getStructuredAmount(transaction.amount).formattedHsct}
            </h3>

            <p className="text-xs text-brand-primary font-bold mt-0.5">
              (₹
              {getStructuredAmount(transaction.amount).inrEquivalent.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              INR • 1 HSCT = ₹1)
            </p>

            <p className="text-neutral-400 text-xs mt-1 max-w-xs">{sanitizeTxDescription(transaction.description)}</p>

            {/* Status Badges */}
            <div className="flex items-center gap-2 mt-3">
              <span
                className={`text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border ${
                  isConfirmed
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {transaction.status}
              </span>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                PoA Consensus
              </span>
            </div>
          </div>

          {/* SECTION 20: CORE TRANSACTION DETAILS (Status, From, To, Amount, Asset, Network, Hash, Block, Timestamp) */}
          <div className="bg-black rounded-2xl border border-white/10 p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-neutral-400 font-semibold">From (Sender)</span>
              <div className="flex items-center gap-1.5 font-mono text-neutral-200">
                <span>{truncateString(transaction.sender || transaction.walletAddress)}</span>
                {(transaction.sender || transaction.walletAddress) && (
                  <button
                    onClick={() => handleCopy('from', transaction.sender || transaction.walletAddress || '')}
                    className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white"
                  >
                    {copiedKey === 'from' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-white/5">
              <span className="text-neutral-400 font-semibold">To (Recipient)</span>
              <div className="flex items-center gap-1.5 font-mono text-neutral-200">
                <span>{truncateString(transaction.receiver || transaction.payload?.receiverWallet || 'System')}</span>
                {(transaction.receiver || transaction.payload?.receiverWallet) && (
                  <button
                    onClick={() =>
                      handleCopy('to', transaction.receiver || transaction.payload?.receiverWallet || '')
                    }
                    className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white"
                  >
                    {copiedKey === 'to' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-white/5">
              <span className="text-neutral-400 font-semibold">Asset / Currency</span>
              <span className="font-bold text-white">
                {transaction.currency === 'USD' || transaction.asset === 'USD' ? 'HSCT' : (transaction.currency || transaction.asset || 'HSCT')}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-white/5">
              <span className="text-neutral-400 font-semibold">Settlement Network</span>
              <span className="font-medium text-brand-primary">SecureChain Hybrid Ledger (0% Gas)</span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-white/5">
              <span className="text-neutral-400 font-semibold">Transaction Hash</span>
              <div className="flex items-center gap-1.5 font-mono text-brand-primary">
                <span>{truncateString(txHash, 6, 6)}</span>
                {txHash && (
                  <button
                    onClick={() => handleCopy('hash', txHash)}
                    className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white"
                  >
                    {copiedKey === 'hash' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-white/5">
              <span className="text-neutral-400 font-semibold">Block Number</span>
              <span className="font-mono text-white font-bold">
                {transaction.blockNumber !== undefined ? `#${transaction.blockNumber}` : 'Pending'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-white/5">
              <span className="text-neutral-400 font-semibold">Timestamp</span>
              <span className="text-neutral-300">{formatDateTime(transaction.date)}</span>
            </div>
          </div>

          {/* 6-Layer Advanced Verification Results (Preserved logic) */}
          {verificationResult && (
            <div className="p-4 rounded-2xl bg-black border border-brand-primary/30 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <ShieldCheck className="text-brand-primary" size={16} /> Cryptographic Proof Status
                </span>
                <span className="text-brand-primary font-mono font-bold text-[11px]">
                  {verificationResult.fullyVerified ? '✓ FULLY VERIFIED' : verificationResult.overallState}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">1. Transaction Hash</span>
                  {renderLayerBadge(verificationResult.layers.transactionHash)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">2. Merkle Membership</span>
                  {renderLayerBadge(verificationResult.layers.merkleMembership)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">3. Merkle Audit Proof</span>
                  {renderLayerBadge(verificationResult.layers.merkleProof)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">4. Merkle Root Integrity</span>
                  {renderLayerBadge(verificationResult.layers.merkleRoot)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">5. Smart Contract Anchor</span>
                  {renderLayerBadge(verificationResult.layers.blockchainAnchor)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">6. Block Confirmation</span>
                  {renderLayerBadge(verificationResult.layers.blockConfirmation)}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <div className="flex gap-2">
              <button
                onClick={handleVerifyIntegrity}
                disabled={verifying}
                className="flex-1 py-3 px-4 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 min-h-[44px]"
              >
                <ShieldCheck size={16} />
                {verifying ? 'Verifying Integrity...' : 'Verify Cryptographic Proof'}
              </button>
              <button
                onClick={handleExportProof}
                className="py-3 px-4 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 min-h-[44px]"
              >
                <FileCheck size={16} /> Proof JSON
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRunReconciliation}
                disabled={reconciling}
                className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
              >
                <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} />
                {reconciling ? 'Reconciling...' : 'Run Ledger Reconciliation'}
              </button>
              <button
                onClick={onClose}
                className="py-2.5 px-5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs transition-colors min-h-[40px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
