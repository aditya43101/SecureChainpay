'use client';

import { useEffect, useState } from 'react';
import { WalletCard } from '@/components/dashboard/WalletCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ArrowUpRight, ArrowDownLeft, RefreshCcw, MoreHorizontal, Info } from 'lucide-react';
import { useWalletStore, USD_TO_HSCT } from '@/stores/wallet-store';
import { formatTxAmountForDisplay } from '@/lib/currency/currency-service';
import Link from 'next/link';

export default function DashboardPage() {
  const [cryptoData, setCryptoData] = useState<any[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const { transactions, fetchPrices, subscribeToLivePrices, prices, tickerStats } = useWalletStore();
  const realTransactions = transactions.filter(t => t.type !== 'genesis');

  useEffect(() => {
    const unsubscribe = subscribeToLivePrices();
    return () => unsubscribe();
  }, [subscribeToLivePrices]);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch('/api/crypto/market-data');
        const json = await res.json();
        if (json && json.success && Array.isArray(json.data)) {
          setCryptoData(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch market data:', err);
      } finally {
        setLoadingMarkets(false);
      }
    };

    fetchMarkets();
    fetchPrices().catch(() => null);

    const interval = setInterval(() => {
      fetchMarkets();
      fetchPrices().catch(() => null);
    }, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-700 fill-mode-both pb-20 md:pb-0 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white mb-1 sm:mb-2">Overview</h1>
          <p className="text-neutral-400 text-sm sm:text-base">Welcome to your SecureChain Pay Dashboard.</p>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm bg-emerald-500/10 text-emerald-400 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-emerald-500/20 w-fit backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.1)]">
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

      {/* Markets Section */}
      <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Market Overview</h2>
          <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-neutral-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Prices
          </div>
        </div>

        <div className="bg-neutral-900/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl p-4 sm:p-6">
          {loadingMarkets ? (
            <div className="space-y-4 py-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-16 w-full bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left border-collapse min-w-[540px]">
                <thead>
                  <tr className="border-b border-white/5 text-neutral-400 text-xs sm:text-sm font-semibold pb-4">
                    <th className="py-3 sm:py-4 font-medium">Asset</th>
                    <th className="py-3 sm:py-4 font-medium">Price (HSCT)</th>
                    <th className="py-3 sm:py-4 font-medium">24h Change</th>
                    <th className="py-3 sm:py-4 font-medium">Market Cap</th>
                    <th className="py-3 sm:py-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cryptoData.map((asset) => {
                    const livePrice = (asset.symbol === 'BTC' || asset.symbol === 'ETH')
                      ? prices[asset.symbol as 'BTC' | 'ETH']
                      : asset.price;
                    const liveChange = (asset.symbol === 'BTC' || asset.symbol === 'ETH')
                      ? tickerStats[asset.symbol as 'BTC' | 'ETH'].change
                      : asset.change24h;
                    const isPositive = liveChange >= 0;
                    return (
                      <tr key={asset.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            asset.symbol === 'BTC' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                            asset.symbol === 'ETH' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                            asset.symbol === 'SOL' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                            asset.symbol === 'BNB' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                            'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {asset.symbol}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{asset.name}</p>
                            <p className="text-xs text-neutral-500 font-mono">{asset.symbol}/HSCT</p>
                          </div>
                        </td>
                        <td className="py-4 font-mono font-semibold text-white">
                          {(livePrice * USD_TO_HSCT).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full ${
                            isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {isPositive ? '▲' : '▼'} {Math.abs(liveChange).toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 font-mono text-neutral-400 text-sm">
                          {((asset.marketCap * USD_TO_HSCT) / 1e9).toFixed(2)}B HSCT
                        </td>
                        <td className="py-4 text-right">
                          <Link href={`/trade?asset=${asset.symbol}`}>
                            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 group-hover:scale-105 active:scale-95">
                              Trade
                            </button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                        {tx.type === 'credit' ? '+' : '-'}{formatTxAmountForDisplay(tx.amount, tx.currency).primary}
                      </p>
                      <p className="text-xs text-neutral-400 font-medium">
                        {formatTxAmountForDisplay(tx.amount, tx.currency).secondary}
                      </p>
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

