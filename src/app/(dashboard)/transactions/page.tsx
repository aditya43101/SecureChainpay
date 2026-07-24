'use client';

import React, { useState } from 'react';
import TransactionList, { Transaction } from '@/components/transactions/TransactionList';

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_8d7f2b9a1e',
    type: 'credit',
    amount: 1500.00,
    currency: 'USD',
    status: 'completed',
    date: '2026-07-14T10:30:00Z',
    description: 'Added funds via Razorpay',
    networkFee: 0,
  },
  {
    id: 'tx_9e2a4c1f3d',
    type: 'debit',
    amount: 250.50,
    currency: 'USD',
    status: 'completed',
    date: '2026-07-13T15:45:00Z',
    recipient: '0x71C...976F',
    description: 'Payment to Merchant',
    networkFee: 0.05,
  },
  {
    id: 'tx_3b1d9e8f4a',
    type: 'credit',
    amount: 850.00,
    currency: 'USD',
    status: 'pending',
    date: '2026-07-12T09:15:00Z',
    sender: 'alice@example.com',
    description: 'Received from Alice',
    networkFee: 0,
  },
  {
    id: 'tx_4f5a6b7c8d',
    type: 'debit',
    amount: 100.00,
    currency: 'USD',
    status: 'failed',
    date: '2026-07-10T14:20:00Z',
    recipient: 'bob@example.com',
    description: 'Transfer to Bob',
    networkFee: 0.1,
  },
  {
    id: 'tx_1a2b3c4d5e',
    type: 'credit',
    amount: 3200.00,
    currency: 'USD',
    status: 'completed',
    date: '2026-07-05T11:00:00Z',
    description: 'Salary Deposit',
    networkFee: 0,
  },
];

export default function TransactionsPage() {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');

  const filteredTransactions = MOCK_TRANSACTIONS.filter((tx) => {
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
          
          <div className="flex items-center gap-2 p-1 bg-gray-900/80 backdrop-blur border border-gray-800 rounded-xl">
            {(['all', 'credit', 'debit'] as const).map((f) => (
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
