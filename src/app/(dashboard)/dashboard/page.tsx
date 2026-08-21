'use client';

import { WalletCard } from '@/components/dashboard/WalletCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ArrowUpRight, ArrowDownLeft, RefreshCcw, MoreHorizontal, Info } from 'lucide-react';
import { useWalletStore } from '@/stores/wallet-store';

export default function DashboardPage() {
  const { transactions } = useWalletStore();
  const realTransactions = transactions.filter(t => t.type !== 'genesis');

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 fill-mode-both pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">Overview</h1>
          <p className="text-neutral-400 text-base">Welcome to your SecureChain Pay Dashboard.</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20 w-fit backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          SecureChain Mainnet
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WalletCard />
        </div>
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
      </div>

      {/* Transactions Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white tracking-tight">Recent Activity</h2>
          <button className="text-sm px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-colors">
            View All
          </button>
        </div>
        
        <div className="bg-neutral-900/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl">
          {realTransactions.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 mb-2">
                <Info size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">Start your blockchain journey with SecureChain Pay.</h3>
              <p className="text-neutral-400 max-w-md">
                Your wallet has been successfully created. Make your first deposit or transfer to begin building your transaction history.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {realTransactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-white/[0.03] transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      tx.type === 'credit' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      tx.type === 'debit' ? 'bg-neutral-800 text-neutral-300 border border-neutral-700' :
                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {tx.type === 'credit' && <ArrowDownLeft size={24} />}
                      {tx.type === 'debit' && <ArrowUpRight size={24} />}
                      {(tx.type !== 'credit' && tx.type !== 'debit') && <RefreshCcw size={24} />}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {tx.type === 'credit' ? 'Received ' : 'Sent '} 
                        {tx.currency}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-neutral-500">{new Date(tx.date).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`text-base sm:text-lg font-bold ${tx.type === 'credit' ? 'text-emerald-400' : 'text-white'}`}>
                        {tx.type === 'credit' ? '+' : '-'}{tx.amount.toFixed(2)} {tx.currency}
                      </p>
                      <p className="text-sm text-neutral-500 font-medium">Block #{tx.blockNumber}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

