'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function TransferPage() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const availableBalance = 24500.50; // Mock balance

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    // Mock blockchain transfer flow
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans flex flex-col items-center justify-center">
      <div className="w-full max-w-xl">
        <Link href="/wallet" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Wallet
        </Link>

        <div className="bg-gray-950/80 backdrop-blur-2xl border border-gray-800/80 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          {/* Subtle gradient background for aesthetics */}
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

          {isSuccess ? (
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6 py-10 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Transfer Successful!</h2>
                <p className="text-gray-400 text-lg">Successfully sent ${amount} to {recipient}</p>
              </div>
              
              <div className="bg-gray-900/50 rounded-xl p-4 w-full border border-gray-800 text-left mt-4">
                <div className="flex justify-between py-2 border-b border-gray-800">
                  <span className="text-gray-500">Network Fee</span>
                  <span className="text-gray-300">$0.00</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Total Deducted</span>
                  <span className="text-white font-medium">${Number(amount || 0).toFixed(2)}</span>
                </div>
              </div>

              <Link href="/wallet" className="mt-8 px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors w-full text-center">
                Return to Wallet
              </Link>
            </div>
          ) : (
            <div className="relative z-10 space-y-8">
              <div>
                <h1 className="text-3xl font-extrabold text-white mb-2">Transfer Funds</h1>
                <p className="text-gray-400">Send crypto or fiat instantly with SecureChain Pay.</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-900/60 rounded-xl border border-gray-800">
                <span className="text-sm text-gray-400">Available Balance</span>
                <span className="text-lg font-bold text-white">${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <form onSubmit={handleTransfer} className="space-y-6">
                
                {/* Recipient Input */}
                <div className="space-y-2">
                  <label htmlFor="recipient" className="block text-sm font-medium text-gray-400">
                    Recipient Address, Email, or @username
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </span>
                    <input
                      id="recipient"
                      type="text"
                      required
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="e.g. alice@example.com or 0x123..."
                      className="w-full bg-gray-900 border border-gray-700 text-white py-4 pl-12 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors placeholder:text-gray-600"
                    />
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-400">
                      Amount (USD)
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setAmount(availableBalance.toString())}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Use Max
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-bold">$</span>
                    <input
                      id="amount"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      max={availableBalance}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-gray-900 border border-gray-700 text-white text-2xl font-bold py-4 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors placeholder:text-gray-700"
                    />
                  </div>
                  {Number(amount) > availableBalance && (
                    <p className="text-rose-400 text-sm mt-1">Amount exceeds available balance.</p>
                  )}
                </div>

                {/* Note Input */}
                <div className="space-y-2">
                  <label htmlFor="note" className="block text-sm font-medium text-gray-400">
                    Note (Optional)
                  </label>
                  <input
                    id="note"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What is this for?"
                    className="w-full bg-gray-900 border border-gray-700 text-white py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors placeholder:text-gray-600 text-sm"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={!recipient || !amount || Number(amount) <= 0 || Number(amount) > availableBalance || isProcessing}
                    className="w-full py-4 bg-white text-black hover:bg-gray-200 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3"
                  >
                    {isProcessing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Initiating Transfer...
                      </>
                    ) : (
                      <>
                        Send ${Number(amount || 0).toFixed(2)}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
