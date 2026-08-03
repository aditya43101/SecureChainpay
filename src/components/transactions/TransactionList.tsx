"use client";

import React, { useState } from 'react';
import TransactionDetail from './TransactionDetail';

import { Transaction } from '@/stores/wallet-store';

interface TransactionListProps {
  transactions: Transaction[];
  limit?: number;
}

export default function TransactionList({ transactions, limit }: TransactionListProps) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const displayTxs = limit ? transactions.slice(0, limit) : transactions;

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3">
        {displayTxs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 rounded-xl bg-gray-900/50 border border-gray-800">
            No transactions found.
          </div>
        ) : (
          displayTxs.map((tx) => (
            <div
              key={tx.id}
              onClick={() => setSelectedTx(tx)}
              className="group flex items-center justify-between p-4 rounded-xl bg-gray-900/40 border border-gray-800/60 hover:bg-gray-800/60 hover:border-gray-700/80 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full shadow-inner ${
                    tx.type === 'credit'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {tx.type === 'credit' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  )}
                </div>
                <div>
                  <h4 className="text-gray-200 font-medium tracking-wide group-hover:text-white transition-colors">
                    {tx.description}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {new Date(tx.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        tx.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : tx.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`font-semibold text-lg ${
                    tx.type === 'credit' ? 'text-emerald-400' : 'text-gray-200'
                  }`}
                >
                  {tx.type === 'credit' ? '+' : '-'}
                  {tx.currency} {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTx && (
        <TransactionDetail
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}
