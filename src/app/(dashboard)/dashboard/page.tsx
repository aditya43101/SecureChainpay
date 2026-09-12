'use client';

import { useEffect, useState } from 'react';
import { WalletCard } from '@/components/dashboard/WalletCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ArrowUpRight, ArrowDownLeft, RefreshCcw, Sparkles, TrendingUp, ChevronRight, ShieldCheck, Clock } from 'lucide-react';
import { useWalletStore, USD_TO_HSCT } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';
import { formatTxAmountForDisplay } from '@/lib/currency/currency-service';
import Link from 'next/link';

export default function DashboardPage() {
  const [cryptoData, setCryptoData] = useState<any[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const { transactions, fetchPrices, subscribeToLivePrices, prices, tickerStats } = useWalletStore();
  const user = useAuthStore((s) => s.user);
  const realTransactions = transactions.filter(t => t.type !== 'genesis');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user?.name || user?.username || 'Trader';

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
    }, 1000); // refresh every 1 second as requested
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 fill-mode-both pb-20 md:pb-0 px-2 sm:px-0">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
            {getGreeting()}, <span className="text-[#FEEF8B]">{displayName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-medium">
            Welcome to your non-custodial decentralized fintech portfolio.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs bg-[#FEEF8B]/10 text-[#FEEF8B] px-3.5 py-1.5 rounded-full border border-[#FEEF8B]/20 w-fit backdrop-blur-md shadow-[0_0_15px_rgba(254,239,139,0.1)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FEEF8B] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FEEF8B]"></span>
          </span>
          <span className="font-semibold">SecureChain PoA Engine Active</span>
        </div>
      </div>

      {/* Main Stats Grid: Balance Card & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        <div className="lg:col-span-2">
          <WalletCard />
        </div>
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
      </div>

      {/* Market Overview Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Market Overview</h2>
            <p className="text-xs text-neutral-400">Live prices indexed against HSCT ledger</p>
          </div>
          <Link 
            href="/trade" 
            className="flex items-center gap-1 text-xs font-semibold text-[#FEEF8B] hover:text-white transition-colors bg-[#FEEF8B]/10 hover:bg-[#FEEF8B]/20 px-3 py-1.5 rounded-full border border-[#FEEF8B]/20"
          >
            Open Pro Terminal <ChevronRight size={14} />
          </Link>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden p-4 sm:p-6 shadow-xl">
          {loadingMarkets ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 w-full bg-white/[0.03] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left border-collapse min-w-[520px]">
                <thead>
                  <tr className="border-b border-white/5 text-neutral-400 text-xs font-semibold pb-3">
                    <th className="py-2.5 font-medium">Asset</th>
                    <th className="py-2.5 font-medium">Price (HSCT)</th>
                    <th className="py-2.5 font-medium">24h Change</th>
                    <th className="py-2.5 font-medium">Market Cap</th>
                    <th className="py-2.5 text-right font-medium">Action</th>
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
                        <td className="py-3.5 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            asset.symbol === 'BTC' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                            asset.symbol === 'ETH' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' :
                            asset.symbol === 'SOL' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' :
                            asset.symbol === 'BNB' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' :
                            'bg-[#FEEF8B]/15 text-[#FEEF8B] border border-[#FEEF8B]/25'
                          }`}>
                            {asset.symbol}
                          </div>
                          <div>
                            <p className="font-bold text-xs sm:text-sm text-white">{asset.name}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">{asset.symbol}/HSCT</p>
                          </div>
                        </td>
                        <td className="py-3.5 font-mono font-bold text-xs sm:text-sm text-white">
                          {(livePrice * USD_TO_HSCT).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT
                        </td>
                        <td className="py-3.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {isPositive ? '▲' : '▼'} {Math.abs(liveChange).toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-neutral-400 text-xs">
                          {((asset.marketCap * USD_TO_HSCT) / 1e9).toFixed(2)}B HSCT
                        </td>
                        <td className="py-3.5 text-right">
                          <Link href={`/trade?asset=${asset.symbol}`}>
                            <button className="px-3 py-1.5 bg-[#FEEF8B] hover:bg-[#FDE047] text-black text-xs font-bold rounded-xl transition-all shadow-[0_0_12px_rgba(254,239,139,0.2)] hover:scale-105 active:scale-95 min-h-[32px]">
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

      {/* Recent Activity Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Recent Activity</h2>
            <p className="text-xs text-neutral-400">On-chain transactions verified by consensus</p>
          </div>
          <Link 
            href="/transactions" 
            className="text-xs px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-300 hover:text-white font-semibold transition-colors"
          >
            View All
          </Link>
        </div>
        
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
          {realTransactions.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 bg-[#FEEF8B]/10 border border-[#FEEF8B]/20 rounded-2xl flex items-center justify-center text-[#FEEF8B]">
                <ShieldCheck size={28} />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">Your wallet is ready</h3>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-sm">
                Make your first payment or scan a QR code to start building your on-chain transaction history.
              </p>
              <Link href="/wallet/transfer">
                <button className="px-5 py-2.5 bg-[#FEEF8B] text-black font-bold text-xs rounded-xl shadow-[0_0_16px_rgba(254,239,139,0.25)] hover:bg-[#FDE047] transition-all">
                  Send Money Now →
                </button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {realTransactions.slice(0, 6).map((tx) => (
                <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group cursor-pointer">
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'credit' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      tx.type === 'debit' ? 'bg-[#FEEF8B]/10 text-[#FEEF8B] border border-[#FEEF8B]/20' :
                      'bg-white/10 text-neutral-300 border border-white/10'
                    }`}>
                      {tx.type === 'credit' && <ArrowDownLeft size={20} />}
                      {tx.type === 'debit' && <ArrowUpRight size={20} />}
                      {(tx.type !== 'credit' && tx.type !== 'debit') && <RefreshCcw size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#FEEF8B] transition-colors truncate">
                        {tx.description || `${tx.type === 'credit' ? 'Received' : 'Sent'} ${tx.currency}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-neutral-400 font-mono">{new Date(tx.date).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0 pl-3">
                    <p className={`text-xs sm:text-sm font-extrabold font-mono ${tx.type === 'credit' ? 'text-emerald-400' : 'text-white'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{formatTxAmountForDisplay(tx.amount, tx.currency).primary}
                    </p>
                    <p className="text-[10px] text-neutral-400 font-medium">
                      {formatTxAmountForDisplay(tx.amount, tx.currency).secondary}
                    </p>
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
