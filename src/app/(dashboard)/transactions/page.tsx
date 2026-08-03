'use client';

import React, { useState } from 'react';
import TransactionList from '@/components/transactions/TransactionList';
import { useWalletStore } from '@/stores/wallet-store';

export default function TransactionsPage() {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit' | 'trade'>('all');
  const transactions = useWalletStore((state) => state.transactions);

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">
              Transaction History
            </h1>
            <p className="text-gray-400">View and manage all your SecureChain Pay activities.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 p-1 bg-gray-900/80 backdrop-blur border border-gray-800 rounded-xl">
            {(['all', 'credit', 'debit', 'trade'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  filter === f
                    ? 'bg-white text-black shadow-lg shadow-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-gray-950/50 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-2xl">
          <TransactionList transactions={filteredTransactions} />
        </div>
      </div>
    </div>
  );
}
