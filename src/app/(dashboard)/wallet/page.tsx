'use client';

import React from 'react';
import Link from 'next/link';
import TransactionList from '@/components/transactions/TransactionList';
import { useWalletStore } from '@/stores/wallet-store';

export default function WalletPage() {
  const { balances, transactions, executeTransaction } = useWalletStore();

  const [showDepositInput, setShowDepositInput] = React.useState(false);
  const [depositAmount, setDepositAmount] = React.useState('');
  const [isDepositing, setIsDepositing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSimulateDeposit = async () => {
    setError(null);
    const amount = Number(depositAmount);
    
    if (!depositAmount || isNaN(amount)) {
      setError('Please enter a valid number.');
      return;
    }
    if (amount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (amount > 100000) {
      setError('Maximum deposit is $100,000.');
      return;
    }

    setIsDepositing(true);
    try {
      await executeTransaction('credit', amount, 'USD', 'Simulated USD Deposit', { source: 'Bank Transfer Simulation' });
      
      setShowDepositInput(false);
      setDepositAmount('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Deposit failed. Please try again.');
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">
            My Wallet
          </h1>
          <p className="text-gray-400">Manage your SecureChain Pay assets and quick actions.</p>
        </div>

        {/* Balance Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-gray-900 to-black border border-gray-800/80 p-8 md:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
             <svg className="w-64 h-64" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.23-.97-2.33-1.84h-1.7c.1 1.74 1.25 2.92 2.93 3.3V19h2.33v-1.6c1.61-.31 2.89-1.35 2.89-2.99 0-2.35-1.99-2.85-3.74-3.27z"/>
            </svg>
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="space-y-2">
              <span className="text-gray-400 font-medium tracking-wide uppercase text-sm">Available Balance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl text-gray-500 font-semibold">$</span>
                <span className="text-6xl font-black tracking-tight text-white">{balances.USD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xl text-gray-400 font-medium">USD</span>
              </div>
              <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                +0.0% this month
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-end">
              
              {!showDepositInput ? (
                <button 
                  onClick={() => setShowDepositInput(true)} 
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-gray-100 text-black rounded-xl font-bold transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] w-full md:w-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  Deposit Funds
                </button>
              ) : (
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <div className="flex bg-black/40 border border-white/20 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.1)] focus-within:border-emerald-500/50 transition-colors">
                    <span className="flex items-center pl-4 text-gray-400 font-medium">$</span>
                    <input 
                      type="text" 
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="Amount" 
                      className="bg-transparent border-none focus:outline-none focus:ring-0 text-white font-semibold py-4 px-3 w-32"
                      disabled={isDepositing}
                      autoFocus
                    />
                    <button 
                      onClick={handleSimulateDeposit}
                      disabled={isDepositing || !depositAmount}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold px-6 py-4 transition-colors"
                    >
                      {isDepositing ? <span className="w-5 h-5 block border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm'}
                    </button>
                    <button 
                      onClick={() => { setShowDepositInput(false); setError(null); setDepositAmount(''); }}
                      disabled={isDepositing}
                      className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white font-bold px-4 py-4 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  {error && <span className="text-red-400 text-sm font-medium animate-in fade-in">{error}</span>}
                </div>
              )}
              <Link href="/trade" className="flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all duration-300 shadow-lg w-full md:w-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Trade Crypto
              </Link>
              
              {/* DEV ONLY: STRESS TEST BUTTON */}
              {process.env.NODE_ENV === 'development' && (
                <button 
                  onClick={async () => {
                    if (!confirm("Run Stress Test? This will create 100 blocks.")) return;
                    setIsDepositing(true);
                    try {
                      console.log("[SecureChain: Stress Test] Starting 100 blocks...");
                      for(let i=1; i<=100; i++) {
                        await executeTransaction('credit', 10, 'USD', `Stress Test Block ${i}`, { source: 'Stress Test' });
                      }
                      console.log("[SecureChain: Stress Test] Successfully created 100 blocks!");
                      alert("Stress test complete! 100 blocks added.");
                    } catch(err) {
                      console.error("Stress Test Failed:", err);
                      alert("Stress test failed!");
                    } finally {
                      setIsDepositing(false);
                    }
                  }}
                  disabled={isDepositing}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all duration-300 shadow-lg w-full md:w-auto disabled:opacity-50"
                >
                  🧨 Stress Test
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats & Recent Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Recent Activity</h2>
              <Link href="/transactions" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                View All
              </Link>
            </div>
            <div className="bg-gray-950/50 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-2xl">
              <TransactionList transactions={transactions.slice(0, 5)} />
            </div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Assets Overview</h2>
            <div className="bg-gray-950/50 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-2xl space-y-6">
              {[
                { name: 'US Dollar', symbol: 'USD', amount: balances.USD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: 'bg-green-500' },
                { name: 'Ethereum', symbol: 'ETH', amount: balances.ETH.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }), color: 'bg-blue-500' },
                { name: 'Bitcoin', symbol: 'BTC', amount: balances.BTC.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 }), color: 'bg-orange-500' },
              ].map(asset => (
                <div key={asset.symbol} className="flex justify-between items-center p-4 rounded-xl hover:bg-gray-800/40 transition-colors border border-transparent hover:border-gray-800">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${asset.color} shadow-[0_0_10px_currentColor] opacity-80`} />
                    <div>
                      <h4 className="font-semibold text-white">{asset.name}</h4>
                      <p className="text-sm text-gray-500">{asset.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right font-medium">
                    {asset.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
