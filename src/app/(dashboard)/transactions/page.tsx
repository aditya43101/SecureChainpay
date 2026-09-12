'use client';

import React, { useState } from 'react';
import TransactionList from '@/components/transactions/TransactionList';
import { useWalletStore } from '@/stores/wallet-store';
import { History, Filter } from 'lucide-react';

export default function TransactionsPage() {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit' | 'trade'>('all');
  const transactions = useWalletStore((state) => state.transactions);

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  return (
    <div className="min-h-screen text-white p-4 sm:p-6 md:p-10 font-sans pb-32 md:pb-12 max-w-6xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <History className="h-6 w-6" />
            </span>
            Transaction History
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm mt-1">
            Real-time chronological activity ledger across all your cryptographic transfers and trades.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-x-auto no-scrollbar">
          {(['all', 'credit', 'debit', 'trade'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] whitespace-nowrap ${
                filter === f
                  ? 'bg-brand-primary text-neutral-950 font-extrabold shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {f === 'all'
                ? 'All Transactions'
                : f === 'credit'
                ? 'Received'
                : f === 'debit'
                ? 'Sent'
                : 'Trading Orders'}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List Container */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-xl">
        <TransactionList transactions={filteredTransactions} />
      </div>
    </div>
  );
}
