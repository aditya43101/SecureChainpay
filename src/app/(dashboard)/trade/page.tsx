'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useWalletStore, USD_TO_HSCT } from '@/stores/wallet-store';
import { useAIStore } from '@/stores/ai-store';
import { useSearchParams } from 'next/navigation';
import { TradingViewWidget } from '@/components/trade/TradingViewWidget';
import { RefreshCw, Newspaper, Info, Sparkles, Bot, CheckCircle2 } from 'lucide-react';
import { AIAssistantPanel } from '@/components/trading-ai/AIAssistantPanel';
import { formatTime } from '@/lib/timezone-service';

type CryptoAsset = 'BTC' | 'ETH';

interface NewsItem {
  title: string;
  source: string;
  date: string;
  snippet: string;
}

interface AssetDetails {
  rank: number;
  marketCap: string;
  circulatingSupply: string;
  maxSupply: string;
  allTimeHigh: string;
}

const NEWS_DATA: Record<CryptoAsset, NewsItem[]> = {
  BTC: [
    {
      title: "Bitcoin Hash Rate Reaches New Milestone Amid Network Security Upgrades",
      source: "CryptoNews Daily",
      date: "August 24, 2026",
      snippet: "The total computational power securing the Bitcoin network has reached an all-time high, reinforcing the blockchain's robust resistance to external attacks."
    },
    {
      title: "Institutional Inflows in Spot Bitcoin ETFs Continue to Accelerate",
      source: "Financial Ledger",
      date: "August 23, 2026",
      snippet: "Global investment banks report record-high asset management inflows into Bitcoin exchange-traded funds, signaling long-term macro accumulation."
    },
    {
      title: "Bitcoin Scarcity Model Strengthens Post-Halving as Exchange Reserves Drop",
      source: "Decentralized Investor",
      date: "August 22, 2026",
      snippet: "On-chain analytic reports indicate liquid supply on major cryptocurrency exchanges has reached a multi-year low, suggesting positive price pressure."
    }
  ],
  ETH: [
    {
      title: "Ethereum Core Developers Detail EIP Upgrades for Gas Fee Reduction",
      source: "Etherscan Insights",
      date: "August 24, 2026",
      snippet: "The latest technical update proposals focus heavily on layer-2 rollup blob gas optimizations, promising to slash transaction costs by up to 90%."
    },
    {
      title: "Ethereum Staking TVL Surpasses 32 Million ETH, Locking Long-Term Supply",
      source: "Validator Network",
      date: "August 23, 2026",
      snippet: "Over 26% of the circulating Ethereum supply is now actively locked in the consensus layer protocol, contributing to validator rewards and coin deflation."
    },
    {
      title: "Layer-2 Activity on Arbitrum and Base Reaches All-Time Transaction Highs",
      source: "Layer-2 Tracker",
      date: "August 22, 2026",
      snippet: "Decentralized applications on Ethereum rollups are processing record numbers of micro-transactions, expanding utility while maintaining mainnet security."
    }
  ]
};

const DETAILS_DATA: Record<CryptoAsset, AssetDetails> = {
  BTC: {
    rank: 1,
    marketCap: "1.26 Trillion HSCT",
    circulatingSupply: "19.74 Million BTC",
    maxSupply: "21.00 Million BTC",
    allTimeHigh: "6,158,125 HSCT"
  },
  ETH: {
    rank: 2,
    marketCap: "415 Billion HSCT",
    circulatingSupply: "120.2 Million ETH",
    maxSupply: "Infinite (Inflationary/Burn model)",
    allTimeHigh: "408,398 HSCT"
  }
};

function TradeContent() {
  const { balances, executeTransaction, prices, fetchPrices, tickerStats, subscribeToLivePrices } = useWalletStore();
  const searchParams = useSearchParams();
  const assetParam = searchParams.get('asset');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>('BTC');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [realStats, setRealStats] = useState<any>(null);

  // AI Panel State
  const aiPanelOpen = useAIStore((s) => s.isPanelOpen);
  const isTradingPanelEnabled = useAIStore((s) => s.isTradingPanelEnabled);
  const isAssistantEnabled = useAIStore((s) => s.isAssistantEnabled);
  const setAIPanelOpen = useAIStore((s) => s.setPanelOpen);
  const setActiveAsset = useAIStore((s) => s.setActiveAsset);

  // Handle asset parameter from query string
  useEffect(() => {
    if (assetParam === 'ETH' || assetParam === 'BTC') {
      setSelectedAsset(assetParam);
    }
  }, [assetParam]);

  // Sync selected asset to AI store
  useEffect(() => {
    setActiveAsset(selectedAsset);
  }, [selectedAsset, setActiveAsset]);

  // Subscribe to live WebSocket updates
  useEffect(() => {
    const unsubscribe = subscribeToLivePrices();
    return () => unsubscribe();
  }, [subscribeToLivePrices]);

  // 1-Second Continuous Real-Time Portfolio & Price Synchronization
  useEffect(() => {
    const syncPrices = async () => {
      try {
        await fetchPrices();
      } catch (err) {
        console.warn('Failed to fetch prices in trade page:', err);
      } finally {
        setLoading(false);
      }
    };
    
    syncPrices();
    const liveInterval = setInterval(syncPrices, 1000); // 1-second auto-sync interval
    return () => clearInterval(liveInterval);
  }, [fetchPrices]);

  // Fetch real market stats from backend
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const formattedSymbol = selectedAsset === 'BTC' ? 'BTCUSDT' : (selectedAsset === 'ETH' ? 'ETHUSDT' : selectedAsset);
        const res = await fetch(`/api/market/ticker/${formattedSymbol}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setRealStats(data);
        }
      } catch (err) {
        console.warn("Failed to fetch real stats:", err);
      }
    };
    fetchStats();
    
    const interval = setInterval(fetchStats, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedAsset]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPrices();
    } catch (err) {
      console.warn('Manual refresh failed:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const priceInUsd = prices[selectedAsset] || (selectedAsset === 'BTC' ? 84500 : 2650);
    const priceInHsct = priceInUsd * USD_TO_HSCT;
    const totalHsct = numAmount * priceInHsct;

    const availableHsct = Number((balances.HSCT && balances.HSCT > 0) ? balances.HSCT : ((balances.USD && balances.USD > 0) ? balances.USD * USD_TO_HSCT : 100000));

    if (tradeType === 'buy') {
      if (availableHsct < totalHsct) {
        setError(`Insufficient HSCT balance. You need ${totalHsct.toLocaleString('en-US', { minimumFractionDigits: 2 })} HSCT.`);
        return;
      }
      try {
        await executeTransaction(
          'trade',
          totalHsct,
          'HSCT',
          `Bought ${numAmount} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', { minimumFractionDigits: 2 })} HSCT`,
          { tradeAsset: selectedAsset, tradeAmount: numAmount }
        );
        await fetchPrices();
        setSuccessMsg(`✓ Instant Order Filled! Bought ${numAmount} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', { minimumFractionDigits: 2 })} HSCT.`);
        setAmount('');
        setTimeout(() => setSuccessMsg(''), 5000);
      } catch (err: any) {
        setError(err.message || 'Transaction failed');
        return;
      }
    } else {
      if ((balances[selectedAsset] || 0) < numAmount) {
        setError(`Insufficient ${selectedAsset} balance (Available: ${(balances[selectedAsset] || 0).toFixed(4)} ${selectedAsset})`);
        return;
      }
      try {
        await executeTransaction(
          'trade',
          numAmount,
          selectedAsset,
          `Sold ${numAmount} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', { minimumFractionDigits: 2 })} HSCT`,
          { tradeAsset: 'HSCT', tradeAmount: totalHsct }
        );
        await fetchPrices();
        setSuccessMsg(`✓ Instant Order Filled! Sold ${numAmount} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', { minimumFractionDigits: 2 })} HSCT.`);
        setAmount('');
        setTimeout(() => setSuccessMsg(''), 5000);
      } catch (err: any) {
        setError(err.message || 'Transaction failed');
        return;
      }
    }
  };

  const priceInUsd = prices[selectedAsset] || (selectedAsset === 'BTC' ? 84500 : 2650);
  const priceInHsct = priceInUsd * USD_TO_HSCT;
  
  const news = NEWS_DATA[selectedAsset];
  const details = DETAILS_DATA[selectedAsset];

  // Prefer real backend stats, fallback to store stats
  const dailyHighHsct = realStats ? parseFloat(realStats.high24h) * USD_TO_HSCT : (tickerStats[selectedAsset].high || priceInUsd * 1.025) * USD_TO_HSCT;
  const dailyLowHsct = realStats ? parseFloat(realStats.low24h) * USD_TO_HSCT : (tickerStats[selectedAsset].low || priceInUsd * 0.978) * USD_TO_HSCT;
  
  const rawVolumeUsd = realStats ? parseFloat(realStats.volume24h) * priceInUsd : (selectedAsset === 'BTC' ? 24.85e9 : 12.40e9);
  const rawVolumeHsct = rawVolumeUsd * USD_TO_HSCT;
  const dailyVolumeHsct = `${~~(rawVolumeHsct / 1e9)} Billion HSCT`;

  const priceChangePercent = realStats ? parseFloat(realStats.change24h) : (tickerStats[selectedAsset].change || 0.00);

  const showAIPanel = isAssistantEnabled && isTradingPanelEnabled;
  const lastMarketDataAt = useWalletStore((s) => s.lastMarketDataAt);

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="flex">
        {/* Main Trading Content */}
        <div className={`flex-1 min-w-0 p-4 md:p-8 transition-all ${showAIPanel && aiPanelOpen ? 'md:pr-0' : ''}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Block with Title & Manual Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/30 border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Trade Terminal</h1>
              
              {/* Connection Status Badge */}
              <span className="px-2.5 py-0.5 border text-xs font-mono font-bold rounded-full flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                TRADINGVIEW REAL-TIME (1s SYNC)
              </span>

              {/* Real-time Last Updated Timestamp */}
              {lastMarketDataAt && (
                <span className="text-xs text-neutral-400 font-mono">
                  Updated: <span className="text-neutral-200 font-bold">{formatTime(lastMarketDataAt)}</span>
                </span>
              )}
            </div>
            <p className="text-neutral-400 text-xs sm:text-sm mt-1">Non-custodial instant order execution • Live USD prices with HSCT settlement</p>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Quick selectors */}
            <div className="flex bg-black/40 border border-white/5 p-1 rounded-2xl">
              <button 
                onClick={() => setSelectedAsset('BTC')} 
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all min-h-[38px] ${selectedAsset === 'BTC' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm' : 'text-neutral-500 hover:text-white'}`}
              >
                BTC
              </button>
              <button 
                onClick={() => setSelectedAsset('ETH')} 
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all min-h-[38px] ${selectedAsset === 'ETH' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm' : 'text-neutral-500 hover:text-white'}`}
              >
                ETH
              </button>
            </div>
            
            {/* Refresh Button */}
            <button 
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2.5 sm:p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all flex items-center justify-center text-white disabled:opacity-50 min-h-[44px] min-w-[44px]"
              aria-label="Refresh price feed"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
            </button>
          </div>
        </div>

        {/* Live Ticker Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 bg-neutral-950/60 border border-white/5 p-4 sm:p-5 rounded-3xl font-mono text-xs sm:text-sm">
          <div>
            <span className="text-neutral-500 text-xs block mb-1">MARKET PAIR</span>
            <span className="text-white font-bold text-sm sm:text-base">{selectedAsset}/USD</span>
          </div>
          <div>
            <span className="text-neutral-500 text-xs block mb-1">LAST PRICE</span>
            <span className="text-white font-black text-sm sm:text-base">${priceInUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-neutral-500 text-[10px] block mt-0.5 font-mono">≈ {priceInHsct.toLocaleString('en-US', { maximumFractionDigits: 2 })} HSCT</span>
          </div>
          <div>
            <span className="text-neutral-500 text-xs block mb-1">24H CHANGE</span>
            <span className={`font-bold text-sm sm:text-base flex items-center gap-1 ${priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {priceChangePercent >= 0 ? '▲' : '▼'} {Math.abs(priceChangePercent).toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="text-neutral-500 text-xs block mb-1">24H HIGH</span>
            <span className="text-emerald-400 font-bold text-sm sm:text-base">${(realStats ? parseFloat(realStats.high24h) : (tickerStats[selectedAsset].high || priceInUsd * 1.025)).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            <span className="text-neutral-500 text-[10px] block mt-0.5 font-mono">≈ {dailyHighHsct.toLocaleString('en-US', { maximumFractionDigits: 2 })} HSCT</span>
          </div>
          <div>
            <span className="text-neutral-500 text-xs block mb-1">24H LOW</span>
            <span className="text-rose-400 font-bold text-sm sm:text-base">${(realStats ? parseFloat(realStats.low24h) : (tickerStats[selectedAsset].low || priceInUsd * 0.978)).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            <span className="text-neutral-500 text-[10px] block mt-0.5 font-mono">≈ {dailyLowHsct.toLocaleString('en-US', { maximumFractionDigits: 2 })} HSCT</span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-neutral-500 text-xs block mb-1">24H VOLUME</span>
            <span className="text-white font-bold text-sm sm:text-base">${~~(rawVolumeUsd / 1e9)}B</span>
            <span className="text-neutral-500 text-[10px] block mt-0.5 font-mono">≈ {dailyVolumeHsct}</span>
          </div>
        </div>

        {/* Main Grid: left 3 columns for chart/news, right 1 column for order book panel */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          
          {/* LEFT 3 COLUMNS: Chart, Stats, News */}
          <div className="xl:col-span-3 space-y-6">
            
            {/* Live Interactive TradingView Chart */}
            <TradingViewWidget symbol={selectedAsset} />

            {/* Two Column details and news block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Asset Statistics Card */}
              <div className="bg-neutral-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                  <Info size={18} className="text-indigo-400" />
                  Asset Information
                </h3>
                
                <div className="space-y-4 font-mono text-sm relative z-10">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-neutral-500">Market Rank</span>
                    <span className="text-white font-bold">#{details.rank}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-neutral-500">Market Cap</span>
                    <span className="text-white font-bold">{details.marketCap}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-neutral-500">Circulating Supply</span>
                    <span className="text-white font-bold">{details.circulatingSupply}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-neutral-500">Max Supply</span>
                    <span className="text-white font-bold">{details.maxSupply}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-neutral-500">All-Time High</span>
                    <span className="text-emerald-400 font-bold">{details.allTimeHigh}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic News Card */}
              <div className="bg-neutral-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                  <Newspaper size={18} className="text-purple-400" />
                  Market News & Analytics
                </h3>
                
                <div className="space-y-4 relative z-10">
                  {news.map((item, idx) => (
                    <div key={idx} className="space-y-1 group/news cursor-pointer">
                      <div className="flex justify-between items-center text-[10px] text-neutral-500">
                        <span className="font-semibold text-purple-400/80">{item.source}</span>
                        <span>{item.date}</span>
                      </div>
                      <h4 className="text-xs font-bold text-neutral-200 group-hover/news:text-indigo-400 transition-colors line-clamp-1">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                        {item.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT 1 COLUMN: Order Panel */}
          <div className="xl:col-span-1">
            <div className="bg-neutral-950/80 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden sticky top-6">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex justify-between items-center mb-6 z-10 relative">
                <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-400 animate-pulse" />
                  Order Panel
                </h3>
                <span className="text-[10px] bg-neutral-900 border border-white/5 text-neutral-400 font-mono px-2 py-0.5 rounded">
                  Instant Fill
                </span>
              </div>

              {/* Order Placement Action Switcher */}
              <div className="flex bg-neutral-900/60 border border-white/5 rounded-2xl p-1 mb-6 relative z-10">
                <button 
                  onClick={() => { setTradeType('buy'); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tradeType === 'buy' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/15' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  Buy
                </button>
                <button 
                  onClick={() => { setTradeType('sell'); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tradeType === 'sell' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/15' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  Sell
                </button>
              </div>

              <form onSubmit={handleTrade} className="space-y-6 relative z-10">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Amount ({selectedAsset})
                  </label>
                  <div className="relative">
                    <input 
                      type="number"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-neutral-900 border border-white/5 text-white font-mono text-lg px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-center"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">
                      {selectedAsset}
                    </span>
                  </div>
                </div>

                {amount && !isNaN(parseFloat(amount)) && (
                  <div className="p-4 bg-neutral-900 border border-white/5 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400 text-sm">USD Value</span>
                      <span className="font-mono font-bold text-white text-lg">
                        ${(parseFloat(amount) * priceInUsd).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-white/5 pt-2">
                      <span className="text-neutral-500 text-xs">Settlement (HSCT)</span>
                      <span className="font-mono text-neutral-300 text-sm">
                        {(parseFloat(amount) * priceInHsct).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} HSCT
                      </span>
                    </div>
                  </div>
                )}

                {error && <div className="text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs font-bold">{error}</div>}
                {successMsg && (
                  <div className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  className={`w-full py-4.5 rounded-2xl font-bold text-base transition-all ${
                    tradeType === 'buy' 
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_30px_rgba(16,185,129,0.4)]'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_20px_rgba(244,63,94,0.25)] hover:shadow-[0_4px_30px_rgba(244,63,94,0.4)]'
                  } active:scale-95`}
                >
                  {tradeType === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
                </button>
              </form>
              
              <div className="mt-6 pt-6 border-t border-white/5 text-xs text-neutral-500 flex flex-col gap-2 relative z-10">
                <div className="flex justify-between">
                  <span>Available {selectedAsset}</span>
                  <span className="font-mono text-white font-bold">{(balances[selectedAsset] || 0).toFixed(4)} {selectedAsset}</span>
                </div>
                <div className="flex justify-between">
                  <span>Available Balance</span>
                  <span className="font-mono text-white font-bold">{((balances.HSCT && balances.HSCT > 0) ? balances.HSCT : ((balances.USD && balances.USD > 0) ? balances.USD * USD_TO_HSCT : 100000)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      </div>

      {/* AI Panel Toggle Button (in trade page only) */}
      {showAIPanel && !aiPanelOpen && (
        <button
          onClick={() => setAIPanelOpen(true)}
          className="fixed top-28 right-4 z-20 px-3 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-all hover:scale-105 border border-emerald-500/30"
          aria-label="Open AI Trading Panel"
        >
          <Bot size={14} />
          AI Panel
        </button>
      )}

      {/* AI Side Panel */}
      {showAIPanel && <AIAssistantPanel variant="inline" />}
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="text-white text-center p-12 bg-black min-h-screen">Loading Trading Environment...</div>}>
      <TradeContent />
    </Suspense>
  );
}
