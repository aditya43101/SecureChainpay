'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useWalletStore, USD_TO_HSCT } from '@/stores/wallet-store';
import { useAIStore } from '@/stores/ai-store';
import { useSearchParams } from 'next/navigation';
import { TradingViewWidget } from '@/components/trade/TradingViewWidget';
import { RefreshCw, Newspaper, Info, Sparkles, Bot, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
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
      title: 'Bitcoin Hash Rate Reaches New Milestone Amid Network Security Upgrades',
      source: 'CryptoNews Daily',
      date: 'August 24, 2026',
      snippet:
        "The total computational power securing the Bitcoin network has reached an all-time high, reinforcing the blockchain's robust resistance to external attacks.",
    },
    {
      title: 'Institutional Inflows in Spot Bitcoin ETFs Continue to Accelerate',
      source: 'Financial Ledger',
      date: 'August 23, 2026',
      snippet:
        'Global investment banks report record-high asset management inflows into Bitcoin exchange-traded funds, signaling long-term macro accumulation.',
    },
    {
      title: 'Bitcoin Scarcity Model Strengthens Post-Halving as Exchange Reserves Drop',
      source: 'Decentralized Investor',
      date: 'August 22, 2026',
      snippet:
        'On-chain analytic reports indicate liquid supply on major cryptocurrency exchanges has reached a multi-year low, suggesting positive price pressure.',
    },
  ],
  ETH: [
    {
      title: 'Ethereum Core Developers Detail EIP Upgrades for Gas Fee Reduction',
      source: 'Etherscan Insights',
      date: 'August 24, 2026',
      snippet:
        'The latest technical update proposals focus heavily on layer-2 rollup blob gas optimizations, promising to slash transaction costs by up to 90%.',
    },
    {
      title: 'Ethereum Staking TVL Surpasses 32 Million ETH, Locking Long-Term Supply',
      source: 'Validator Network',
      date: 'August 23, 2026',
      snippet:
        'Over 26% of the circulating Ethereum supply is now actively locked in the consensus layer protocol, contributing to validator rewards and coin deflation.',
    },
    {
      title: 'Layer-2 Activity on Arbitrum and Base Reaches All-Time Transaction Highs',
      source: 'Layer-2 Tracker',
      date: 'August 22, 2026',
      snippet:
        'Decentralized applications on Ethereum rollups are processing record numbers of micro-transactions, expanding utility while maintaining mainnet security.',
    },
  ],
};

const DETAILS_DATA: Record<CryptoAsset, AssetDetails> = {
  BTC: {
    rank: 1,
    marketCap: '1.26 Trillion HSCT',
    circulatingSupply: '19.74 Million BTC',
    maxSupply: '21.00 Million BTC',
    allTimeHigh: '6,158,125 HSCT',
  },
  ETH: {
    rank: 2,
    marketCap: '415 Billion HSCT',
    circulatingSupply: '120.2 Million ETH',
    maxSupply: 'Infinite (Inflationary/Burn model)',
    allTimeHigh: '408,398 HSCT',
  },
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

  useEffect(() => {
    if (assetParam === 'ETH' || assetParam === 'BTC') {
      setSelectedAsset(assetParam);
    }
  }, [assetParam]);

  useEffect(() => {
    setActiveAsset(selectedAsset);
  }, [selectedAsset, setActiveAsset]);

  useEffect(() => {
    const unsubscribe = subscribeToLivePrices();
    return () => unsubscribe();
  }, [subscribeToLivePrices]);

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
    const liveInterval = setInterval(syncPrices, 1000);
    return () => clearInterval(liveInterval);
  }, [fetchPrices]);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const formattedSymbol =
          selectedAsset === 'BTC' ? 'BTCUSDT' : selectedAsset === 'ETH' ? 'ETHUSDT' : selectedAsset;
        const res = await fetch(`/api/market/ticker/${formattedSymbol}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setRealStats(data);
        }
      } catch (err) {
        console.warn('Failed to fetch real stats:', err);
      }
    };
    fetchStats();

    const interval = setInterval(fetchStats, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedAsset]);

  const [inputMode, setInputMode] = useState<'CRYPTO' | 'HSCT'>('CRYPTO');

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

  const priceInUsd = prices[selectedAsset] || (selectedAsset === 'BTC' ? 84500 : 2650);
  const priceInHsct = priceInUsd * USD_TO_HSCT;

  const availableHsct = Number(
    balances.HSCT && balances.HSCT > 0
      ? balances.HSCT
      : balances.USD && balances.USD > 0
      ? balances.USD * USD_TO_HSCT
      : 100000
  );

  const maxAffordableCrypto = priceInHsct > 0 ? availableHsct / priceInHsct : 0;

  const handlePercentageSelect = (percentage: number) => {
    setError('');
    setSuccessMsg('');
    if (tradeType === 'buy') {
      const targetHsct = availableHsct * percentage;
      if (inputMode === 'HSCT') {
        setAmount(targetHsct.toFixed(2));
      } else {
        const targetCrypto = priceInHsct > 0 ? targetHsct / priceInHsct : 0;
        setAmount(targetCrypto.toFixed(6));
      }
    } else {
      const availCrypto = balances[selectedAsset] || 0;
      const targetCrypto = availCrypto * percentage;
      if (inputMode === 'HSCT') {
        const targetHsct = targetCrypto * priceInHsct;
        setAmount(targetHsct.toFixed(2));
      } else {
        setAmount(targetCrypto.toFixed(6));
      }
    }
  };

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const rawInput = parseFloat(amount);
    if (isNaN(rawInput) || rawInput <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    let numCryptoAmount = rawInput;
    let totalHsct = rawInput * priceInHsct;

    if (inputMode === 'HSCT') {
      totalHsct = rawInput;
      numCryptoAmount = priceInHsct > 0 ? rawInput / priceInHsct : 0;
    }

    if (tradeType === 'buy') {
      if (availableHsct < totalHsct) {
        setError(
          `Insufficient HSCT balance. You need ${totalHsct.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })} HSCT (Available: ${availableHsct.toLocaleString('en-US', { minimumFractionDigits: 2 })} HSCT).`
        );
        return;
      }
      try {
        await executeTransaction(
          'trade',
          totalHsct,
          'HSCT',
          `Bought ${numCryptoAmount.toFixed(6)} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })} HSCT`,
          { tradeAsset: selectedAsset, tradeAmount: numCryptoAmount }
        );
        await fetchPrices();
        setSuccessMsg(
          `✓ Instant Order Filled! Bought ${numCryptoAmount.toFixed(6)} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })} HSCT.`
        );
        setAmount('');
        setTimeout(() => setSuccessMsg(''), 5000);
      } catch (err: any) {
        setError(err.message || 'Transaction failed');
        return;
      }
    } else {
      if ((balances[selectedAsset] || 0) < numCryptoAmount) {
        setError(
          `Insufficient ${selectedAsset} balance (Available: ${(balances[selectedAsset] || 0).toFixed(4)} ${selectedAsset})`
        );
        return;
      }
      try {
        await executeTransaction(
          'trade',
          numCryptoAmount,
          selectedAsset,
          `Sold ${numCryptoAmount.toFixed(6)} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })} HSCT`,
          { tradeAsset: 'HSCT', tradeAmount: totalHsct }
        );
        await fetchPrices();
        setSuccessMsg(
          `✓ Instant Order Filled! Sold ${numCryptoAmount.toFixed(6)} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })} HSCT.`
        );
        setAmount('');
        setTimeout(() => setSuccessMsg(''), 5000);
      } catch (err: any) {
        setError(err.message || 'Transaction failed');
        return;
      }
    }
  };

  const news = NEWS_DATA[selectedAsset];
  const details = DETAILS_DATA[selectedAsset];

  const dailyHighHsct = realStats
    ? parseFloat(realStats.high24h) * USD_TO_HSCT
    : (tickerStats[selectedAsset]?.high || priceInUsd * 1.025) * USD_TO_HSCT;
  const dailyLowHsct = realStats
    ? parseFloat(realStats.low24h) * USD_TO_HSCT
    : (tickerStats[selectedAsset]?.low || priceInUsd * 0.978) * USD_TO_HSCT;

  const rawVolumeUsd = realStats
    ? parseFloat(realStats.volume24h) * priceInUsd
    : selectedAsset === 'BTC'
    ? 24.85e9
    : 12.4e9;
  const rawVolumeHsct = rawVolumeUsd * USD_TO_HSCT;
  const dailyVolumeHsct = `${~~(rawVolumeHsct / 1e9)}B HSCT`;

  const priceChangePercent = realStats
    ? parseFloat(realStats.change24h)
    : tickerStats[selectedAsset]?.change || 0.0;

  const showAIPanel = isAssistantEnabled && isTradingPanelEnabled;
  const lastMarketDataAt = useWalletStore((s) => s.lastMarketDataAt);

  return (
    <div className="min-h-screen text-white font-sans pb-28 md:pb-12">
      <div className="flex">
        {/* Main Trading Content */}
        <div className={`flex-1 min-w-0 p-4 sm:p-6 md:p-10 transition-all ${showAIPanel && aiPanelOpen ? 'md:pr-0' : ''}`}>
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Block */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a0a0a] border border-white/10 p-5 sm:p-6 rounded-3xl shadow-xl">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-brand-primary" size={24} />
                    Trading Terminal
                  </h1>
                  <span className="px-2.5 py-0.5 border text-xs font-bold rounded-full flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE 1s SYNC
                  </span>
                  {lastMarketDataAt && (
                    <span className="text-xs text-neutral-400 font-mono">
                      Updated: <span className="text-neutral-200 font-bold">{formatTime(lastMarketDataAt)}</span>
                    </span>
                  )}
                </div>
                <p className="text-neutral-400 text-xs sm:text-sm mt-1">
                  Non-custodial instant execution • Live USD quotes with HSCT settlement
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Asset Selectors */}
                <div className="flex bg-[#121212] border border-white/10 p-1 rounded-2xl shadow-inner">
                  <button
                    onClick={() => setSelectedAsset('BTC')}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all min-h-[40px] ${
                      selectedAsset === 'BTC'
                        ? 'bg-brand-primary text-neutral-950 font-extrabold shadow-md'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    BTC / USD
                  </button>
                  <button
                    onClick={() => setSelectedAsset('ETH')}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all min-h-[40px] ${
                      selectedAsset === 'ETH'
                        ? 'bg-brand-primary text-neutral-950 font-extrabold shadow-md'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    ETH / USD
                  </button>
                </div>

                <button
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all flex items-center justify-center text-white disabled:opacity-50 min-h-[44px] min-w-[44px]"
                  aria-label="Refresh price feed"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin text-brand-primary' : ''} />
                </button>
              </div>
            </div>

            {/* Live Ticker Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-[#0a0a0a] border border-white/10 p-4 sm:p-5 rounded-2xl font-mono text-xs">
              <div>
                <span className="text-neutral-400 text-[10px] uppercase font-semibold block mb-1">PAIR</span>
                <span className="text-white font-extrabold text-sm sm:text-base">{selectedAsset}/USD</span>
              </div>
              <div>
                <span className="text-neutral-400 text-[10px] uppercase font-semibold block mb-1">LAST PRICE</span>
                <span className="text-brand-primary font-black text-sm sm:text-base">
                  ${priceInUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-neutral-500 text-[10px] block font-mono">
                  ≈ {priceInHsct.toLocaleString('en-US', { maximumFractionDigits: 2 })} HSCT
                </span>
              </div>
              <div>
                <span className="text-neutral-400 text-[10px] uppercase font-semibold block mb-1">24H CHANGE</span>
                <span
                  className={`font-bold text-sm sm:text-base flex items-center gap-1 ${
                    priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {priceChangePercent >= 0 ? '▲' : '▼'} {Math.abs(priceChangePercent).toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-neutral-400 text-[10px] uppercase font-semibold block mb-1">24H HIGH</span>
                <span className="text-emerald-400 font-bold text-sm sm:text-base">
                  $
                  {(realStats
                    ? parseFloat(realStats.high24h)
                    : tickerStats[selectedAsset]?.high || priceInUsd * 1.025
                  ).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 text-[10px] uppercase font-semibold block mb-1">24H LOW</span>
                <span className="text-rose-400 font-bold text-sm sm:text-base">
                  $
                  {(realStats
                    ? parseFloat(realStats.low24h)
                    : tickerStats[selectedAsset]?.low || priceInUsd * 0.978
                  ).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-neutral-400 text-[10px] uppercase font-semibold block mb-1">24H VOLUME</span>
                <span className="text-white font-bold text-sm sm:text-base">${~~(rawVolumeUsd / 1e9)}B</span>
                <span className="text-neutral-500 text-[10px] block font-mono">{dailyVolumeHsct}</span>
              </div>
            </div>

            {/* Main Grid: Chart & Order Panel */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
              {/* Left 3 Columns: Chart & Info */}
              <div className="xl:col-span-3 space-y-6">
                <TradingViewWidget symbol={selectedAsset} />

                {/* Details & News */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Asset Details */}
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-lg space-y-4">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                      <Info size={16} className="text-brand-primary" /> Asset Information
                    </h3>
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between py-1.5 border-b border-white/5">
                        <span className="text-neutral-400">Market Rank</span>
                        <span className="text-white font-bold">#{details.rank}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-white/5">
                        <span className="text-neutral-400">Market Cap</span>
                        <span className="text-white font-bold">{details.marketCap}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-white/5">
                        <span className="text-neutral-400">Circulating Supply</span>
                        <span className="text-white font-bold">{details.circulatingSupply}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-white/5">
                        <span className="text-neutral-400">Max Supply</span>
                        <span className="text-white font-bold">{details.maxSupply}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-neutral-400">All-Time High</span>
                        <span className="text-brand-primary font-bold">{details.allTimeHigh}</span>
                      </div>
                    </div>
                  </div>

                  {/* Market News */}
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-lg space-y-4">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                      <Newspaper size={16} className="text-brand-primary" /> Market News & Sentiment
                    </h3>
                    <div className="space-y-3">
                      {news.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-neutral-500">
                            <span className="font-semibold text-brand-primary">{item.source}</span>
                            <span>{item.date}</span>
                          </div>
                          <h4 className="text-xs font-bold text-neutral-200 line-clamp-1">{item.title}</h4>
                          <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">{item.snippet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 1 Column: Order Panel */}
              <div className="xl:col-span-1">
                <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl sticky top-6 space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                      <Sparkles size={16} className="text-brand-primary" /> Order Terminal
                    </h3>
                    <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold px-2 py-0.5 rounded-full">
                      Instant Fill
                    </span>
                  </div>

                  {/* Order Type Switcher */}
                  <div className="flex bg-black border border-white/10 rounded-2xl p-1">
                    <button
                      onClick={() => {
                        setTradeType('buy');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all min-h-[40px] ${
                        tradeType === 'buy'
                          ? 'bg-emerald-500 text-neutral-950 shadow-md'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Buy {selectedAsset}
                    </button>
                    <button
                      onClick={() => {
                        setTradeType('sell');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all min-h-[40px] ${
                        tradeType === 'sell'
                          ? 'bg-rose-500 text-white shadow-md'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Sell {selectedAsset}
                    </button>
                  </div>

                  <form onSubmit={handleTrade} className="space-y-4">
                    {/* Input Mode Toggle */}
                    <div className="flex bg-[#121212] border border-white/5 rounded-xl p-0.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setInputMode('CRYPTO');
                          setAmount('');
                        }}
                        className={`flex-1 py-1.5 rounded-lg transition-all ${
                          inputMode === 'CRYPTO'
                            ? 'bg-white/15 text-white font-extrabold shadow-sm'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        In {selectedAsset}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInputMode('HSCT');
                          setAmount('');
                        }}
                        className={`flex-1 py-1.5 rounded-lg transition-all ${
                          inputMode === 'HSCT'
                            ? 'bg-white/15 text-white font-extrabold shadow-sm'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        In HSCT (₹)
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-neutral-400">
                        <span>{inputMode === 'CRYPTO' ? `Amount (${selectedAsset})` : 'Total (HSCT)'}</span>
                        {tradeType === 'buy' && (
                          <span className="text-[10px] text-brand-primary lowercase font-mono">
                            max: ~{maxAffordableCrypto.toFixed(6)} {selectedAsset}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder={inputMode === 'CRYPTO' ? '0.001' : '5000'}
                          className="w-full bg-black border border-white/10 text-white font-mono text-base px-4 py-3.5 rounded-xl focus:outline-none focus:border-brand-primary/50 text-center min-h-[48px]"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs">
                          {inputMode === 'CRYPTO' ? selectedAsset : 'HSCT'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Percentage Presets */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: '25%', value: 0.25 },
                        { label: '50%', value: 0.5 },
                        { label: '75%', value: 0.75 },
                        { label: 'MAX', value: 1.0 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handlePercentageSelect(preset.value)}
                          className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-primary/40 rounded-lg text-[11px] font-mono font-bold text-neutral-300 hover:text-white transition-all active:scale-95"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {amount && !isNaN(parseFloat(amount)) && (
                      <div className="p-3 bg-black border border-white/10 rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">Order Crypto Size</span>
                          <span className="font-mono font-bold text-white">
                            {inputMode === 'CRYPTO'
                              ? `${parseFloat(amount).toFixed(6)} ${selectedAsset}`
                              : `${(priceInHsct > 0 ? parseFloat(amount) / priceInHsct : 0).toFixed(6)} ${selectedAsset}`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-t border-white/5 pt-1.5">
                          <span className="text-neutral-400">HSCT Settlement</span>
                          <span className="font-mono text-brand-primary font-bold">
                            {(inputMode === 'CRYPTO'
                              ? parseFloat(amount) * priceInHsct
                              : parseFloat(amount)
                            ).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            HSCT
                          </span>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="text-rose-300 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {successMsg && (
                      <div className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                        <span>{successMsg}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className={`w-full py-3.5 rounded-xl font-extrabold text-sm transition-all shadow-md min-h-[48px] ${
                        tradeType === 'buy'
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950'
                          : 'bg-rose-500 hover:bg-rose-400 text-white'
                      }`}
                    >
                      {tradeType === 'buy' ? 'Execute Buy Order' : 'Execute Sell Order'}
                    </button>
                  </form>

                  <div className="pt-4 border-t border-white/5 text-xs text-neutral-400 space-y-1.5">
                    <div className="flex justify-between">
                      <span>Available {selectedAsset}</span>
                      <span className="font-mono text-white font-bold">
                        {(balances[selectedAsset] || 0).toFixed(4)} {selectedAsset}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Spendable HSCT</span>
                      <span className="font-mono text-brand-primary font-bold">
                        {(balances.HSCT && balances.HSCT > 0
                          ? balances.HSCT
                          : balances.USD && balances.USD > 0
                          ? balances.USD * USD_TO_HSCT
                          : 100000
                        ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        HSCT
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Panel Toggle Button */}
        {showAIPanel && !aiPanelOpen && (
          <button
            onClick={() => setAIPanelOpen(true)}
            className="fixed top-24 right-4 z-20 px-3.5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-pale text-neutral-950 text-xs font-extrabold flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-all border border-brand-primary/40 min-h-[40px]"
            aria-label="Open Trading AI Panel"
          >
            <Bot size={16} />
            Trading AI
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
    <Suspense
      fallback={
        <div className="text-white text-center p-12 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-neutral-400 font-medium">Loading Trading Terminal...</p>
          </div>
        </div>
      }
    >
      <TradeContent />
    </Suspense>
  );
}
