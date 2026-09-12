'use client';

import React, { useState } from 'react';
import TransactionDetail from './TransactionDetail';
import { Transaction } from '@/stores/wallet-store';
import { formatTxAmountForDisplay, sanitizeTxDescription } from '@/lib/currency/currency-service';
import { formatDateTime } from '@/lib/timezone-service';
import { ArrowUpRight, ArrowDownLeft, Send, ShieldCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface TransactionListProps {
  transactions: Transaction[];
  limit?: number;
}

export default function TransactionList({ transactions, limit }: TransactionListProps) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const displayTxs = limit ? transactions.slice(0, limit) : transactions;

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2.5">
        {displayTxs.length === 0 ? (
          /* Friendly Empty State per Prompt Section 30 */
          <div className="p-8 sm:p-10 text-center rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center mx-auto">
              <Send size={22} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm sm:text-base">No transactions yet</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Make your first payment or deposit to see your real-time cryptographic activity here.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/wallet/transfer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs transition-all shadow-md min-h-[44px]"
              >
                Send Money
              </Link>
            </div>
          </div>
        ) : (
          displayTxs.map((tx) => (
            <div
              key={tx.id}
              onClick={() => setSelectedTx(tx)}
              className="group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[#0a0a0a] hover:bg-[#121212] border border-white/5 hover:border-brand-primary/30 transition-all cursor-pointer shadow-sm min-h-[56px]"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div
                  className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex-shrink-0 transition-transform group-hover:scale-105 ${
                    tx.type === 'credit'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                  }`}
                >
                  {tx.type === 'credit' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </div>

                <div className="min-w-0">
                  <h4 className="text-white text-xs sm:text-sm font-bold truncate group-hover:text-brand-primary transition-colors">
                    {sanitizeTxDescription(tx.description)}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-neutral-500">{formatDateTime(tx.date)}</span>
                    <span className="w-1 h-1 rounded-full bg-neutral-700" />
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                        tx.status === 'completed' || tx.status === 'CONFIRMED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : tx.status === 'pending' || tx.status === 'SUBMITTED'
                          ? 'bg-amber-500/10 text-amber-300'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-3">
                <div className="text-right flex-shrink-0">
                  <div
                    className={`font-extrabold text-sm sm:text-base ${
                      tx.type === 'credit' ? 'text-emerald-400' : 'text-white'
                    }`}
                  >
                    {tx.type === 'credit' ? '+' : '-'}
                    {formatTxAmountForDisplay(tx.amount, tx.currency).primary}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-neutral-500 font-medium">
                    {formatTxAmountForDisplay(tx.amount, tx.currency).secondary}
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-neutral-600 group-hover:text-brand-primary transition-colors hidden sm:block"
                />
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTx && <TransactionDetail transaction={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
}
