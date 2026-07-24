import React from 'react';
import Link from 'next/link';
import TransactionList from '@/components/transactions/TransactionList';

export default function WalletPage() {
  // Using the same mock data for the recent activity preview
  const recentTransactions = [
    {
      id: 'tx_8d7f2b9a1e',
      type: 'credit' as const,
      amount: 1500.00,
      currency: 'USD',
      status: 'completed' as const,
      date: '2026-07-14T10:30:00Z',
      description: 'Added funds via Razorpay',
    },
    {
      id: 'tx_9e2a4c1f3d',
      type: 'debit' as const,
      amount: 250.50,
      currency: 'USD',
      status: 'completed' as const,
      date: '2026-07-13T15:45:00Z',
      recipient: '0x71C...976F',
      description: 'Payment to Merchant',
    },
    {
      id: 'tx_3b1d9e8f4a',
      type: 'credit' as const,
      amount: 850.00,
      currency: 'USD',
      status: 'pending' as const,
      date: '2026-07-12T09:15:00Z',
      sender: 'alice@example.com',
      description: 'Received from Alice',
    }
  ];

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
                <span className="text-6xl font-black tracking-tight text-white">24,500.50</span>
                <span className="text-xl text-gray-400 font-medium">USD</span>
              </div>
              <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                +12.5% this month
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Link href="/wallet/add-money" className="flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-gray-100 text-black rounded-xl font-bold transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Add Money
              </Link>
              <Link href="/wallet/transfer" className="flex items-center justify-center gap-2 px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all duration-300 border border-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Transfer
              </Link>
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
              <TransactionList transactions={recentTransactions} />
            </div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Assets Overview</h2>
            <div className="bg-gray-950/50 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-2xl space-y-6">
              {[
                { name: 'US Dollar', symbol: 'USD', amount: '24,500.50', color: 'bg-green-500' },
                { name: 'Ethereum', symbol: 'ETH', amount: '4.250', color: 'bg-blue-500' },
                { name: 'Bitcoin', symbol: 'BTC', amount: '0.150', color: 'bg-orange-500' },
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
