"use client";

import React, { useEffect, useState } from 'react';
import type { Transaction } from '@/stores/wallet-store';
import { useWalletStore } from '@/stores/wallet-store';
import { ComprehensiveVerificationResult, VerificationLayerResult } from '@/types/verification';

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

  const reconcileStoreTx = useWalletStore((state) => state.reconcileTransaction);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

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
            asset: transaction.asset || transaction.currency || 'USD',
            currency: transaction.currency || 'USD',
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
          mismatches: result.mismatches ? result.mismatches.map((m: any) => typeof m === 'string' ? m : m.message) : [],
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
  const hasOnChainProof = Boolean(transaction.blockchainTransactionHash);
  const currentRecStatus = transaction.reconciliationStatus || reconcileResult?.reconciliationStatus || 'NOT_CHECKED';

  const renderLayerBadge = (layer: VerificationLayerResult) => {
    if (layer.status === 'VALID') {
      return <span className="text-emerald-400 font-semibold font-mono text-[11px]">✓ VALID</span>;
    }
    if (layer.status === 'PENDING') {
      return <span className="text-amber-400 font-semibold font-mono text-[11px]">⏳ PENDING</span>;
    }
    if (layer.status === 'SKIPPED') {
      return <span className="text-neutral-500 font-mono text-[11px]">SKIPPED</span>;
    }
    return <span className="text-rose-400 font-semibold font-mono text-[11px]">✗ INVALID</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center justify-center w-14 h-14 rounded-full shadow-inner mb-3 ${
                transaction.type === 'credit'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {transaction.type === 'credit' ? (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              ) : (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {transaction.type === 'credit' ? '+' : '-'}
              {transaction.currency} {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-gray-400 text-sm mt-1 text-center">{transaction.description}</p>
          </div>

          {/* Off-Chain Details */}
          <div className="space-y-3 bg-gray-950/60 p-4 rounded-xl border border-gray-800/80 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400">Lifecycle Status</span>
              <span
                className={`font-semibold px-2.5 py-0.5 rounded-full ${
                  isConfirmed
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : transaction.status === 'SUBMITTED' || transaction.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {transaction.status.toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-gray-800/40">
              <span className="text-gray-400">Reconciliation Status</span>
              <span
                className={`font-mono font-semibold px-2 py-0.5 rounded ${
                  currentRecStatus === 'MATCHED' || currentRecStatus === 'RECOVERY_COMPLETED'
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                    : currentRecStatus === 'BLOCKCHAIN_PENDING' || currentRecStatus === 'DATABASE_UPDATE_PENDING'
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                    : currentRecStatus === 'NOT_CHECKED'
                    ? 'bg-gray-800 text-gray-300'
                    : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                }`}
              >
                {currentRecStatus}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-gray-800/40">
              <span className="text-gray-400">Application ID</span>
              <span className="text-gray-200 font-mono">
                {transaction.applicationTransactionId || transaction.id}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-gray-800/40">
              <span className="text-gray-400">Date / Timestamp</span>
              <span className="text-gray-200">
                {new Date(transaction.date).toLocaleString()}
              </span>
            </div>

            {transaction.walletAddress && (
              <div className="flex justify-between items-center py-1 border-t border-gray-800/40">
                <span className="text-gray-400">Sender</span>
                <span className="text-gray-200 font-mono truncate max-w-[200px]" title={transaction.walletAddress}>
                  {transaction.walletAddress}
                </span>
              </div>
            )}

            {transaction.payload?.receiverWallet && (
              <div className="flex justify-between items-center py-1 border-t border-gray-800/40">
                <span className="text-gray-400">Receiver</span>
                <span className="text-gray-200 font-mono truncate max-w-[200px]" title={transaction.payload.receiverWallet}>
                  {transaction.payload.receiverWallet}
                </span>
              </div>
            )}
          </div>

          {/* Real On-Chain Blockchain Proof */}
          <div className="space-y-3 bg-indigo-950/20 p-4 rounded-xl border border-indigo-500/20 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                EVM Smart Contract Proof
              </span>
              {hasOnChainProof ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">On-Chain Anchored</span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">Off-Chain Micro-Block</span>
              )}
            </div>

            {hasOnChainProof ? (
              <>
                <div className="py-1 border-t border-indigo-900/30">
                  <span className="text-gray-400 block mb-0.5">Blockchain Transaction Hash</span>
                  <span className="text-indigo-200 font-mono break-all block">
                    {transaction.blockchainTransactionHash}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 py-1 border-t border-indigo-900/30">
                  <div>
                    <span className="text-gray-400 block mb-0.5">Block Number</span>
                    <span className="text-white font-mono font-semibold">#{transaction.blockNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Network Chain ID</span>
                    <span className="text-white font-mono">{transaction.chainId || 31337} (Hardhat / Polygon)</span>
                  </div>
                </div>

                {transaction.blockHash && (
                  <div className="py-1 border-t border-indigo-900/30">
                    <span className="text-gray-400 block mb-0.5">Block Hash</span>
                    <span className="text-gray-300 font-mono break-all text-[11px]">
                      {transaction.blockHash}
                    </span>
                  </div>
                )}

                {transaction.contractAddress && (
                  <div className="py-1 border-t border-indigo-900/30">
                    <span className="text-gray-400 block mb-0.5">Contract Address</span>
                    <span className="text-gray-300 font-mono break-all text-[11px]">
                      {transaction.contractAddress}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-400 text-[11px] py-1 border-t border-indigo-900/30">
                This transaction record is cryptographically signed and hash-linked in the local ledger.
              </div>
            )}
          </div>

          {/* Phase 4 Merkle Tree Proof */}
          {(transaction.merkleBatchId || transaction.merkleRoot) && (
            <div className="space-y-3 bg-purple-950/20 p-4 rounded-xl border border-purple-500/20 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Merkle Tree Anchor Proof
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                  {transaction.anchorStatus || 'ANCHOR_CONFIRMED'}
                </span>
              </div>

              <div className="py-1 border-t border-purple-900/30">
                <span className="text-gray-400 block mb-0.5">Merkle Batch ID</span>
                <span className="text-purple-200 font-mono break-all block">
                  {transaction.merkleBatchId || 'BATCH_INDIVIDUAL'}
                </span>
              </div>

              {transaction.merkleRoot && (
                <div className="py-1 border-t border-purple-900/30">
                  <span className="text-gray-400 block mb-0.5">Merkle Root</span>
                  <span className="text-purple-200 font-mono break-all block">
                    {transaction.merkleRoot}
                  </span>
                </div>
              )}

              {transaction.merkleLeaf && (
                <div className="py-1 border-t border-purple-900/30">
                  <span className="text-gray-400 block mb-0.5">Merkle Leaf (SHA-256)</span>
                  <span className="text-gray-300 font-mono break-all text-[11px]">
                    {transaction.merkleLeaf}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Phase 5: 6-Layer Advanced Proof Verification */}
          {verificationResult && (
            <div className="space-y-3 bg-neutral-950 p-4 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Cryptographic Integrity Chain
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-black text-[11px] ${
                    verificationResult.fullyVerified
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {verificationResult.fullyVerified ? 'FULLY VERIFIED ✓' : verificationResult.overallState}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-400">1. Canonical Transaction Hash</span>
                  {renderLayerBadge(verificationResult.layers.transactionHash)}
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-400">2. Merkle Membership</span>
                  {renderLayerBadge(verificationResult.layers.merkleMembership)}
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-400">3. Merkle Audit Proof</span>
                  {renderLayerBadge(verificationResult.layers.merkleProof)}
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-400">4. Merkle Root Integrity</span>
                  {renderLayerBadge(verificationResult.layers.merkleRoot)}
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-400">5. Blockchain Smart Contract Anchor</span>
                  {renderLayerBadge(verificationResult.layers.blockchainAnchor)}
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-400">6. Block Confirmation ({verificationResult.proofDetails.confirmations} confs)</span>
                  {renderLayerBadge(verificationResult.layers.blockConfirmation)}
                </div>
              </div>

              {verificationResult.mismatches.length > 0 && (
                <div className="p-2 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] space-y-0.5">
                  <p className="font-semibold">Mismatches Detected:</p>
                  <ul className="list-disc list-inside">
                    {verificationResult.mismatches.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <div className="flex gap-2">
              <button
                onClick={handleVerifyIntegrity}
                disabled={verifying}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                {verifying ? (
                  <>Verifying Integrity...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Verify Integrity
                  </>
                )}
              </button>

              <button
                onClick={handleExportProof}
                className="py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5 border border-white/5"
                title="Export cryptographic proof report JSON"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Proof
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRunReconciliation}
                disabled={reconciling}
                className="flex-1 py-2.5 px-3 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {reconciling ? <>Reconciling...</> : <>Run Reconciliation</>}
              </button>

              <button 
                onClick={onClose}
                className="py-2.5 px-5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium text-xs transition-colors"
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
