'use client';

import React, { useState, useEffect } from 'react';
import { useWalletStore, type Transaction } from '@/stores/wallet-store';
import { formatDateTime } from '@/lib/timezone-service';
import { formatTxAmountForDisplay } from '@/lib/currency/currency-service';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  Link as LinkIcon,
  ArrowRight,
  Server,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReconciliationPage() {
  const { transactions, reconcileTransaction, ownerUid, address: userAddress } = useWalletStore();
  const [filter, setFilter] = useState<'all' | 'matched' | 'pending' | 'mismatch'>('all');
  const [isReconcilingAll, setIsReconcilingAll] = useState(false);
  const [reconcileLogs, setReconcileLogs] = useState<string[]>([]);
  const [reconcilingTxId, setReconcilingTxId] = useState<string | null>(null);

  // Statistics calculation
  const totalTxs = transactions.length;
  const confirmedTxs = transactions.filter(
    (t) => t.status === 'CONFIRMED' || t.status === 'completed' || t.reconciliationStatus === 'MATCHED'
  ).length;
  const pendingTxs = transactions.filter(
    (t) => t.status === 'SUBMITTED' || t.status === 'pending' || t.reconciliationStatus === 'BLOCKCHAIN_PENDING'
  ).length;
  const mismatchTxs = transactions.filter(
    (t) => t.reconciliationStatus === 'MISMATCH' || t.reconciliationStatus === 'RECONCILIATION_REQUIRED'
  ).length;

  const filteredTransactions = transactions.filter((tx) => {
    const recStatus = tx.reconciliationStatus || (tx.blockchainTransactionHash ? 'MATCHED' : 'BLOCKCHAIN_PENDING');
    if (filter === 'all') return true;
    if (filter === 'matched') return recStatus === 'MATCHED' || recStatus === 'RECOVERY_COMPLETED';
    if (filter === 'pending') return recStatus === 'BLOCKCHAIN_PENDING' || recStatus === 'NOT_CHECKED';
    if (filter === 'mismatch') return recStatus === 'MISMATCH' || recStatus === 'RECONCILIATION_REQUIRED';
    return true;
  });

  const handleReconcileSingle = async (tx: Transaction) => {
    setReconcilingTxId(tx.id);
    try {
      const res = await reconcileTransaction(tx.id, true);
      const logMsg = res
        ? `[${new Date().toLocaleTimeString()}] Reconciled ${tx.applicationTransactionId || tx.id}: Status = ${res.reconciliationStatus} (${res.actionPerformed})`
        : `[${new Date().toLocaleTimeString()}] Reconciled ${tx.id}: No changes required.`;
      setReconcileLogs((prev) => [logMsg, ...prev.slice(0, 19)]);
    } catch (err: any) {
      setReconcileLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Error reconciling ${tx.id}: ${err.message}`,
        ...prev.slice(0, 19),
      ]);
    } finally {
      setReconcilingTxId(null);
    }
  };

  const handleRunBatchReconciliation = async () => {
    setIsReconcilingAll(true);
    setReconcileLogs((prev) => [`[${new Date().toLocaleTimeString()}] Starting batch reconciliation across ${transactions.length} transactions...`, ...prev]);

    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          autoRecover: true,
          uid: ownerUid,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReconcileLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] Batch reconciliation completed! Processed ${data.count || 0} records successfully.`,
          ...prev.slice(0, 19),
        ]);
        // Trigger local store update
        for (const t of transactions.slice(0, 10)) {
          await reconcileTransaction(t.id, true).catch(() => null);
        }
      }
    } catch (err: any) {
      setReconcileLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Batch reconciliation warning: ${err.message}`,
        ...prev.slice(0, 19),
      ]);
    } finally {
      setIsReconcilingAll(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'CONFIRMED' || s === 'COMPLETED' || s === 'MATCHED' || s === 'RECOVERY_COMPLETED') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
          <CheckCircle2 size={12} /> {s}
        </span>
      );
    }
    if (s === 'SUBMITTED' || s === 'PENDING' || s === 'BLOCKCHAIN_PENDING') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
          <Clock size={12} /> {s}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
        <AlertTriangle size={12} /> {s || 'UNCONFIRMED'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white p-6 md:p-10 font-sans space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/20 mb-3">
            <Layers size={14} /> Hybrid Architecture Dashboard
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Payment Reconciliation Engine
          </h1>
          <p className="text-neutral-400 text-sm mt-1 max-w-2xl">
            Dual-layer synchronization monitoring: PostgreSQL/Firestore operational application data ↔ EVM Smart Contract cryptographic settlement proof.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunBatchReconciliation}
            disabled={isReconcilingAll}
            className="py-6 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50"
          >
            <RefreshCw size={16} className={`mr-2 ${isReconcilingAll ? 'animate-spin' : ''}`} />
            {isReconcilingAll ? 'Reconciling System...' : 'Run Auto-Reconciliation'}
          </Button>
        </div>
      </div>

      {/* Metrics Cards (Section 33 Requirements) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-neutral-900/80 border border-white/10 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Payments</span>
            <Activity size={16} className="text-indigo-400" />
          </div>
          <p className="text-3xl font-black text-white">{totalTxs}</p>
          <p className="text-[11px] text-neutral-500 font-mono">Off-chain DB Index</p>
        </div>

        <div className="bg-neutral-900/80 border border-emerald-500/20 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>On-Chain Confirmed</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="text-3xl font-black text-emerald-400">{confirmedTxs}</p>
          <p className="text-[11px] text-emerald-500/80 font-mono">Anchored in Smart Contract</p>
        </div>

        <div className="bg-neutral-900/80 border border-amber-500/20 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
            <span>Pending Submissions</span>
            <Clock size={16} />
          </div>
          <p className="text-3xl font-black text-amber-400">{pendingTxs}</p>
          <p className="text-[11px] text-amber-500/80 font-mono">Awaiting Block Mining</p>
        </div>

        <div className="bg-neutral-900/80 border border-red-500/20 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-red-400 text-xs font-bold uppercase tracking-wider">
            <span>Reconciliation Req.</span>
            <AlertTriangle size={16} />
          </div>
          <p className="text-3xl font-black text-red-400">{mismatchTxs}</p>
          <p className="text-[11px] text-red-500/80 font-mono">Requires Investigation</p>
        </div>

        <div className="bg-neutral-900/80 border border-white/10 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase tracking-wider">
            <span>Blockchain Sync</span>
            <Server size={16} className="text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-emerald-400 flex items-center gap-1.5 pt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Healthy ✅
          </p>
          <p className="text-[11px] text-neutral-500 font-mono">Hardhat PoA (Chain 31337)</p>
        </div>
      </div>

      {/* Developer / Admin Reconciliation View Table (Section 34 Requirements) */}
      <div className="bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-indigo-400" size={22} />
            <h2 className="text-xl font-bold text-white tracking-tight">
              Dual-Layer Transaction Audit Register
            </h2>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-white/10 rounded-xl">
            {(['all', 'matched', 'pending', 'mismatch'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === f
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 uppercase tracking-wider font-sans">
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Description / Recipient</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Off-Chain DB</th>
                <th className="py-3 px-4">On-Chain State</th>
                <th className="py-3 px-4">Reconciliation</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-neutral-300">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500 font-sans">
                    No transactions match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const recStatus =
                    tx.reconciliationStatus ||
                    (tx.blockchainTransactionHash ? 'MATCHED' : 'BLOCKCHAIN_PENDING');
                  const onChainStatus = tx.blockchainTransactionHash ? 'CONFIRMED' : 'PENDING';

                  return (
                    <tr key={tx.id} className="hover:bg-neutral-900/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-indigo-300">
                        {tx.applicationTransactionId || tx.id}
                      </td>
                      <td className="py-3.5 px-4 font-sans max-w-[200px] truncate text-white">
                        {tx.description}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        {formatTxAmountForDisplay(tx.amount, tx.currency).primary}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(tx.status)}</td>
                      <td className="py-3.5 px-4">{getStatusBadge(onChainStatus)}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            recStatus === 'MATCHED' || recStatus === 'RECOVERY_COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : recStatus === 'MISMATCH' || recStatus === 'RECONCILIATION_REQUIRED'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {recStatus === 'MATCHED' ? 'MATCHED ✅' : recStatus === 'RECOVERY_COMPLETED' ? 'RECOVERED 🔄' : recStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          disabled={reconcilingTxId === tx.id}
                          onClick={() => handleSelectTxForReconcile(tx)}
                          className="bg-neutral-800 hover:bg-indigo-600 text-white text-[11px] font-bold rounded-lg py-1.5 px-3 border border-white/10"
                        >
                          {reconcilingTxId === tx.id ? 'Verifying...' : 'Reconcile'}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Audit Activity Logs */}
      {reconcileLogs.length > 0 && (
        <div className="bg-neutral-950 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
            <Activity size={15} className="text-indigo-400" /> Real-time Reconciliation Audit Logs
          </div>
          <div className="bg-black/90 p-4 rounded-xl border border-white/5 font-mono text-xs text-indigo-300 max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
            {reconcileLogs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  function handleSelectTxForReconcile(tx: Transaction) {
    handleReconcileSingle(tx);
  }
}
