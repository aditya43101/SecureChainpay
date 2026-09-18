'use client';

import React, { useState, useEffect, useCallback } from 'react';
import TransactionList from '@/components/transactions/TransactionList';
import { useWalletStore } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';
import { auth } from '@/lib/firebase/client';
import { 
  History, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw, 
  TrendingUp, 
  Layers, 
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function TransactionsPage() {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit' | 'trade'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');

  const transactions = useWalletStore((state) => state.transactions);
  const syncTransactions = useWalletStore((state) => state.syncTransactions);
  const ownerUid = useWalletStore((state) => state.ownerUid);
  const authUser = useAuthStore((state) => state.user);

  const activeUid = authUser?.id || ownerUid || auth.currentUser?.uid;

  const handleSync = useCallback(async (showIndicator = false) => {
    if (!activeUid) return;
    if (showIndicator) setIsRefreshing(true);
    try {
      await syncTransactions(activeUid);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn('[TransactionsPage] Sync error:', err);
    } finally {
      if (showIndicator) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [activeUid, syncTransactions]);

  // Initial Sync on Mount & When User becomes active
  useEffect(() => {
    if (activeUid) {
      handleSync(false);
    }
  }, [activeUid, handleSync]);

  // Auto-polling interval (every 4 seconds) to immediately catch received payments
  useEffect(() => {
    if (!activeUid) return;
    const interval = setInterval(() => {
      handleSync(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeUid, handleSync]);

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'credit') return tx.type === 'credit';
    if (filter === 'debit') return tx.type === 'debit' || tx.type === 'transfer' as any;
    if (filter === 'trade') return tx.type === 'trade';
    return true;
  });

  // Calculate metrics
  const totalReceived = transactions
    .filter((tx) => tx.type === 'credit')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const totalSent = transactions
    .filter((tx) => tx.type === 'debit' || (tx.type as string) === 'transfer')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const totalTrades = transactions.filter((tx) => tx.type === 'trade').length;

  return (
    <div className="min-h-screen text-white p-4 sm:p-6 md:p-10 font-sans pb-32 md:pb-12 max-w-6xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary shadow-sm">
              <History className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                Transaction History
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </h1>
              <p className="text-neutral-400 text-xs sm:text-sm mt-0.5">
                Authoritative cryptographic activity ledger verified by EVM & SHA-256 state roots.
              </p>
            </div>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSync(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 hover:text-white transition-all min-h-[40px] disabled:opacity-60 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-primary' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Ledger Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Total Received
            </span>
            <div className="text-lg sm:text-xl font-extrabold text-emerald-400">
              +{totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} HSCT
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {transactions.filter((tx) => tx.type === 'credit').length} incoming
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-brand-primary" /> Total Sent
            </span>
            <div className="text-lg sm:text-xl font-extrabold text-white">
              -{totalSent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} HSCT
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
            {transactions.filter((tx) => tx.type === 'debit' || (tx.type as string) === 'transfer').length} outgoing
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Trading Orders
            </span>
            <div className="text-lg sm:text-xl font-extrabold text-cyan-400">
              {totalTrades} Executed
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Automated & Manual
          </span>
        </div>
      </div>

      {/* Filter Tabs & Real-time timestamp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-x-auto no-scrollbar">
          {(['all', 'credit', 'debit', 'trade'] as const).map((f) => {
            const count =
              f === 'all'
                ? transactions.length
                : f === 'credit'
                ? transactions.filter((tx) => tx.type === 'credit').length
                : f === 'debit'
                ? transactions.filter((tx) => tx.type === 'debit' || (tx.type as string) === 'transfer').length
                : transactions.filter((tx) => tx.type === 'trade').length;

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] whitespace-nowrap ${
                  filter === f
                    ? 'bg-brand-primary text-neutral-950 font-black shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>
                  {f === 'all'
                    ? 'All Transactions'
                    : f === 'credit'
                    ? 'Received'
                    : f === 'debit'
                    ? 'Sent'
                    : 'Trading Orders'}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                    filter === f ? 'bg-neutral-950/20 text-neutral-950' : 'bg-white/10 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 self-end sm:self-center">
          <Clock className="w-3.5 h-3.5 text-neutral-600" />
          <span>Last synchronized: {lastUpdated}</span>
        </div>
      </div>

      {/* Transactions List Container */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl">
        <TransactionList transactions={filteredTransactions} />
      </div>
    </div>
  );
}
