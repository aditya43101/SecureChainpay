"use client";

import React, { useEffect } from 'react';
import type { Transaction } from '@/stores/wallet-store';

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function TransactionDetail({ transaction, onClose }: TransactionDetailProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-4 right-4">
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div
              className={`flex items-center justify-center w-16 h-16 rounded-full shadow-inner mb-4 ${
                transaction.type === 'credit'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {transaction.type === 'credit' ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </div>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              {transaction.type === 'credit' ? '+' : '-'}
              {transaction.currency} {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-gray-400 mt-1">{transaction.description}</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
              <span className="text-gray-400 text-sm">Status</span>
              <span
                className={`text-sm font-medium px-2.5 py-1 rounded-full ${
                  transaction.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : transaction.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {transaction.status.toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
              <span className="text-gray-400 text-sm">Date</span>
              <span className="text-gray-200 text-sm font-medium">
                {new Date(transaction.date).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
              <span className="text-gray-400 text-sm">Transaction ID</span>
              <span className="text-gray-200 text-sm font-mono bg-gray-800/50 px-2 py-1 rounded">
                {transaction.id}
              </span>
            </div>

            {transaction.payload?.networkFee !== undefined && (
              <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
                <span className="text-gray-400 text-sm">Network Fee</span>
                <span className="text-gray-200 text-sm font-medium">
                  {transaction.currency} {transaction.payload.networkFee.toFixed(4)}
                </span>
              </div>
            )}

            {transaction.walletAddress && (
              <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
                <span className="text-gray-400 text-sm">From</span>
                <span className="text-gray-200 text-sm font-medium truncate max-w-[200px]" title={transaction.walletAddress}>
                  {transaction.walletAddress}
                </span>
              </div>
            )}

            {transaction.payload?.receiverWallet && (
              <div className="flex justify-between items-center py-3 border-b border-gray-800/50">
                <span className="text-gray-400 text-sm">To</span>
                <span className="text-gray-200 text-sm font-medium truncate max-w-[200px]" title={transaction.payload.receiverWallet}>
                  {transaction.payload.receiverWallet}
                </span>
              </div>
            )}
          </div>
          
          <div className="mt-8">
            <button 
              onClick={onClose}
              className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
