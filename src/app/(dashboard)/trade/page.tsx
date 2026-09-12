'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useWalletStore, USD_TO_HSCT } from '@/stores/wallet-store';
import { useAIStore } from '@/stores/ai-store';
import { useSearchParams } from 'next/navigation';
import { TradingViewWidget } from '@/components/trade/TradingViewWidget';
import { RefreshCw, Newspaper, Info, Sparkles, Bot, CheckCircle2, TrendingUp, AlertCircle, ArrowDownUp, Coins } from 'lucide-react';
import { AIAssistantPanel } from '@/components/trading-ai/AIAssistantPanel';
import { formatTime } from '@/lib/timezone-service';

type CryptoAsset = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'ADA';

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
  SOL: [
    {
      title: 'Solana DeFi Volume Surges as Firedancer Validator Client Hits Testnet',
      source: 'Solana Floor',
      date: 'August 24, 2026',
      snippet:
        'High-throughput independent validator client upgrades yield sub-second transaction finality, driving unprecedented on-chain decentralized exchange volumes.',
    },
    {
      title: 'Solana Pay Enterprise Integrations Expand into Merchant Point-of-Sale',
      source: 'Fintech Dispatch',
      date: 'August 23, 2026',
      snippet:
        'Retail payment rails announce direct zero-slippage settlement using Solana decentralized consensus and instant state sync.',
    },
    {
      title: 'Active Solana Wallet Addresses Reach New Network Record',
      source: 'Blockchain Weekly',
      date: 'August 22, 2026',
      snippet:
        'Ecosystem adoption accelerates with millions of active non-custodial wallets engaging in micro-settlements and high-frequency swaps.',
    },
  ],
  BNB: [
    {
      title: 'BNB Chain Completes Quarterly Auto-Burn Removing Millions from Circulation',
      source: 'Binance Ledger',
      date: 'August 24, 2026',
      snippet:
        'The protocol auto-burn mechanism permanently burned hundreds of thousands of BNB tokens, tightening circulating supply and increasing scarce token value.',
    },
    {
      title: 'BNB Greenfield Decentralized Storage Records Rapid DApp Adoption',
      source: 'Web3 Tech Review',
      date: 'August 23, 2026',
      snippet:
        'Decentralized data availability layers anchored to BNB Smart Chain process enterprise workloads with verifiable on-chain proofs.',
    },
    {
      title: 'OpBNB Layer-2 Scaling Solution Lowers Gas Fees to Sub-Cent Level',
      source: 'Crypto Developer Daily',
      date: 'August 22, 2026',
      snippet:
        'Optimistic rollup transactions on BNB chain demonstrate high TPS resilience during market volatility spikes.',
    },
  ],
  ADA: [
    {
      title: 'Cardano Chang Hardfork Phase 2 Enters Full Decentralized Governance',
      source: 'Cardano Feed',
      date: 'August 24, 2026',
      snippet:
        'Voltaire-era governance implementation transfers on-chain treasury control and protocol parameter decisions to constitutional delegate representatives.',
    },
    {
      title: 'Hydra Layer-2 Heads Demonstrate Millions of Real-Time Micropayments',
      source: 'Cardano Insights',
      date: 'August 23, 2026',
      snippet:
        'State channels built on Cardano architecture enable instant, isomorphic off-chain transfers with cryptographic settlement on the base ledger.',
    },
    {
      title: 'Institutional Staking Pools on Cardano Network Maintain 68% Participation',
      source: 'PoS Validator News',
      date: 'August 22, 2026',
      snippet:
        'Ouroboros consensus mechanism exhibits high capital stability with liquid delegation mechanisms providing consistent staking yields.',
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
  SOL: {
    rank: 5,
    marketCap: '64 Billion HSCT',
    circulatingSupply: '468 Million SOL',
    maxSupply: 'Infinite (Disinflationary 1.5%)',
    allTimeHigh: '21,700 HSCT',
  },
  BNB: {
    rank: 4,
    marketCap: '86 Billion HSCT',
    circulatingSupply: '145 Million BNB',
    maxSupply: '200 Million BNB (Burn Model)',
    allTimeHigh: '59,800 HSCT',
  },
  ADA: {
    rank: 9,
    marketCap: '12.4 Billion HSCT',
    circulatingSupply: '35.7 Billion ADA',
    maxSupply: '45.00 Billion ADA',
    allTimeHigh: '258 HSCT',
  },
};

function TradeContent() {
  const {
    balances,
    executeTransaction,
    prices,
    fetchPrices,
    tickerStats,
    subscribeToLivePrices,
    ownerUid,
    syncTransactions,
  } = useWalletStore();
  const searchParams = useSearchParams();
  const assetParam = searchParams.get('asset');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>('BTC');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');

  // Dual Money-to-Bitcoin synchronized inputs
  const [moneyInput, setMoneyInput] = useState('');
  const [cryptoInput, setCryptoInput] = useState('');

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
    if (assetParam && ['BTC', 'ETH', 'SOL', 'BNB', 'ADA'].includes(assetParam.toUpperCase())) {
      setSelectedAsset(assetParam.toUpperCase() as CryptoAsset);
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
    const liveInterval = setInterval(syncPrices, 2000); // 2-second smooth update as requested
    return () => clearInterval(liveInterval);
  }, [fetchPrices]);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const formattedSymbol = `${selectedAsset}USDT`;
        const res = await fetch(`/api/market/ticker/${formattedSymbol}`, { cache: 'no-store' });
        if (res.ok && isMounted) {
          const data = await res.json();
          setRealStats(data);
        }
      } catch (err) {
        console.warn('Failed to fetch real stats:', err);
      }
    };
    fetchStats();

    const interval = setInterval(fetchStats, 2000); // 2-second refresh for ticker stats
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedAsset]);

  const priceInUsd = prices[selectedAsset] || (
    selectedAsset === 'BTC' ? 77450 :
    selectedAsset === 'ETH' ? 2550 :
    selectedAsset === 'SOL' ? 136.5 :
    selectedAsset === 'BNB' ? 582.2 :
    0.342
  );
  const priceInHsct = priceInUsd * USD_TO_HSCT;

  const availableHsct = Number(
    balances.HSCT && balances.HSCT > 0
      ? balances.HSCT
      : balances.USD && balances.USD > 0
      ? balances.USD * USD_TO_HSCT
      : 0
  );



  // Dual conversion change handlers
  const handleMoneyChange = (val: string) => {
    setMoneyInput(val);
    setError('');
    setSuccessMsg('');
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && priceInHsct > 0) {
      setCryptoInput((num / priceInHsct).toFixed(6));
    } else {
      setCryptoInput('');
    }
  };

  const handleCryptoChange = (val: string) => {
    setCryptoInput(val);
    setError('');
    setSuccessMsg('');
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && priceInHsct > 0) {
      setMoneyInput((num * priceInHsct).toFixed(2));
    } else {
      setMoneyInput('');
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setRefreshSuccess(false);
    try {
      await fetchPrices();
      const formattedSymbol = `${selectedAsset}USDT`;
      const res = await fetch(`/api/market/ticker/${formattedSymbol}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRealStats(data);
      }
      if (ownerUid) {
        await syncTransactions(ownerUid);
      }
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 2500);
    } catch (err) {
      console.warn('Manual refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePercentageSelect = (percentage: number) => {
    setError('');
    setSuccessMsg('');
    if (tradeType === 'buy') {
      const targetHsct = availableHsct * percentage;
      handleMoneyChange(targetHsct.toFixed(2));
    } else {
      const availCrypto = balances[selectedAsset] || 0;
      const targetCrypto = availCrypto * percentage;
      handleCryptoChange(targetCrypto.toFixed(6));
    }
  };

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const parsedMoney = parseFloat(moneyInput);
    const parsedCrypto = parseFloat(cryptoInput);

    if (isNaN(parsedMoney) || parsedMoney <= 0 || isNaN(parsedCrypto) || parsedCrypto <= 0) {
      setError(`Please enter a valid amount in Money (HSCT) or ${selectedAsset}`);
      return;
    }

    const totalHsct = parsedMoney;
    const numCryptoAmount = parsedCrypto;

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
          `✓ Order Filled! Bought ${numCryptoAmount.toFixed(6)} ${selectedAsset} with ${totalHsct.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })} HSCT.`
        );
        setMoneyInput('');
        setCryptoInput('');
        setTimeout(() => setSuccessMsg(''), 6000);
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
          `✓ Order Filled! Sold ${numCryptoAmount.toFixed(6)} ${selectedAsset} for ${totalHsct.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })} HSCT.`
        );
        setMoneyInput('');
        setCryptoInput('');
        setTimeout(() => setSuccessMsg(''), 6000);
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
    : selectedAsset === 'ETH'
    ? 12.4e9
    : selectedAsset === 'SOL'
    ? 4.2e9
    : selectedAsset === 'BNB'
    ? 1.2e9
    : 0.35e9;
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
                {/* Asset Selectors for all Overview Cryptos */}
                <div className="flex flex-wrap items-center bg-[#121212] border border-white/10 p-1 rounded-2xl shadow-inner gap-1">
                  {(['BTC', 'ETH', 'SOL', 'BNB', 'ADA'] as const).map((sym) => {
                    const isSelected = selectedAsset === sym;
                    return (
                      <button
                        key={sym}
                        onClick={() => {
                          setSelectedAsset(sym);
                          setMoneyInput('');
                          setCryptoInput('');
                          setError('');
                          setSuccessMsg('');
                        }}
                        className={`px-3 sm:px-3.5 py-2 text-xs font-bold rounded-xl transition-all min-h-[40px] flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-brand-primary text-neutral-950 font-extrabold shadow-md'
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          sym === 'BTC' ? 'bg-amber-400' :
                          sym === 'ETH' ? 'bg-blue-400' :
                          sym === 'SOL' ? 'bg-purple-400' :
                          sym === 'BNB' ? 'bg-yellow-400' :
                          'bg-emerald-400'
                        }`} />
                        {sym} / USD
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  {refreshSuccess && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl animate-fade-in shadow-sm">
                      <CheckCircle2 size={13} /> Refreshed
                    </span>
                  )}
                  <button
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-primary/40 rounded-2xl transition-all flex items-center justify-center text-white disabled:opacity-50 min-h-[44px] min-w-[44px]"
                    title="Refresh live terminal data and balance"
                    aria-label="Refresh price feed"
                  >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin text-brand-primary' : ''} />
                  </button>
                </div>
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
                    {tradeType === 'buy' ? (
                      /* BUY MODE: Money (HSCT/₹) -> Crypto (BTC/ETH) */
                      <div className="space-y-3">
                        {/* 1. Money Input */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold text-neutral-400">
                            <span className="flex items-center gap-1 text-white">
                              <Coins size={13} className="text-amber-400" /> Enter Money to Spend (₹ / HSCT)
                            </span>
                            <span className="text-[10px] text-brand-primary lowercase font-mono">
                              avail: {availableHsct.toLocaleString('en-US', { maximumFractionDigits: 0 })} HSCT
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={moneyInput}
                              onChange={(e) => handleMoneyChange(e.target.value)}
                              placeholder="e.g. 5000"
                              className="w-full bg-black border border-white/10 text-white font-mono text-base px-4 py-3.5 rounded-xl focus:outline-none focus:border-brand-primary/60 text-center min-h-[48px]"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-primary font-bold text-xs bg-white/5 px-2 py-1 rounded-md border border-white/5">
                              HSCT (₹)
                            </span>
                          </div>
                        </div>

                        {/* Quick Money Presets */}
                        <div className="grid grid-cols-5 gap-1 text-[11px]">
                          {[
                            { label: '₹500', val: 500 },
                            { label: '₹1K', val: 1000 },
                            { label: '₹5K', val: 5000 },
                            { label: '₹25K', val: 25000 },
                            { label: 'MAX', val: availableHsct },
                          ].map((chip) => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => {
                                const roundedVal = Math.min(chip.val, availableHsct);
                                handleMoneyChange(roundedVal.toFixed(0));
                              }}
                              className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-primary/40 rounded-lg font-mono font-bold text-neutral-300 hover:text-white transition-all text-center"
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>

                        {/* Live Conversion Rate Divider */}
                        <div className="relative py-1 flex items-center justify-center">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                          </div>
                          <div className="relative bg-[#0a0a0a] px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono">
                            <ArrowDownUp size={11} className="text-brand-primary" />
                            <span>1 {selectedAsset} ≈ ₹{priceInHsct.toLocaleString('en-US', { maximumFractionDigits: 0 })} HSCT</span>
                          </div>
                        </div>

                        {/* 2. Calculated Crypto You Receive */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold text-neutral-400">
                            <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                              ✓ You Receive ({selectedAsset})
                            </span>
                            <span className="text-[10px] text-neutral-400 lowercase font-mono">
                              live conversion
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={cryptoInput}
                              onChange={(e) => handleCryptoChange(e.target.value)}
                              placeholder="0.000000"
                              className="w-full bg-black/70 border border-emerald-500/30 text-emerald-300 font-mono text-base px-4 py-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 text-center min-h-[48px]"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-extrabold text-xs bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                              {selectedAsset}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* SELL MODE: Crypto (BTC/ETH) -> Money (HSCT/₹) */
                      <div className="space-y-3">
                        {/* 1. Crypto to Sell */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold text-neutral-400">
                            <span className="flex items-center gap-1 text-white">
                              Sell Amount ({selectedAsset})
                            </span>
                            <span className="text-[10px] text-rose-400 lowercase font-mono">
                              avail: {(balances[selectedAsset] || 0).toFixed(4)} {selectedAsset}
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={cryptoInput}
                              onChange={(e) => handleCryptoChange(e.target.value)}
                              placeholder="0.001"
                              className="w-full bg-black border border-white/10 text-white font-mono text-base px-4 py-3.5 rounded-xl focus:outline-none focus:border-rose-500/50 text-center min-h-[48px]"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-1 rounded-md border border-rose-500/20">
                              {selectedAsset}
                            </span>
                          </div>
                        </div>

                        {/* Quick Crypto Percentage Presets */}
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
                              className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-rose-500/40 rounded-lg text-[11px] font-mono font-bold text-neutral-300 hover:text-white transition-all"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Live Conversion Rate Divider */}
                        <div className="relative py-1 flex items-center justify-center">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                          </div>
                          <div className="relative bg-[#0a0a0a] px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono">
                            <ArrowDownUp size={11} className="text-rose-400" />
                            <span>1 {selectedAsset} ≈ ₹{priceInHsct.toLocaleString('en-US', { maximumFractionDigits: 0 })} HSCT</span>
                          </div>
                        </div>

                        {/* 2. Calculated Money You Receive */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold text-neutral-400">
                            <span className="text-brand-primary font-extrabold flex items-center gap-1">
                              ✓ You Receive Money (HSCT / ₹)
                            </span>
                            <span className="text-[10px] text-neutral-400 lowercase font-mono">
                              instant credit
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={moneyInput}
                              onChange={(e) => handleMoneyChange(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-black/70 border border-brand-primary/30 text-brand-primary font-mono text-base px-4 py-3.5 rounded-xl focus:outline-none focus:border-brand-primary/60 text-center min-h-[48px]"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-primary font-extrabold text-xs bg-brand-primary/10 px-2 py-1 rounded-md border border-brand-primary/20">
                              HSCT
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Summary Breakdown */}
                    {moneyInput && !isNaN(parseFloat(moneyInput)) && parseFloat(moneyInput) > 0 && (
                      <div className="p-3.5 bg-black border border-white/10 rounded-2xl space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">
                            {tradeType === 'buy' ? 'Money Spending' : 'Crypto Selling'}
                          </span>
                          <span className="font-mono font-bold text-white">
                            {tradeType === 'buy'
                              ? `${parseFloat(moneyInput).toLocaleString('en-US', { minimumFractionDigits: 2 })} HSCT`
                              : `${parseFloat(cryptoInput || '0').toFixed(6)} ${selectedAsset}`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">
                            {tradeType === 'buy' ? 'Crypto Receiving' : 'Money Credited'}
                          </span>
                          <span className="font-mono font-bold text-emerald-400">
                            {tradeType === 'buy'
                              ? `≈ ${parseFloat(cryptoInput || '0').toFixed(6)} ${selectedAsset}`
                              : `≈ ${parseFloat(moneyInput).toLocaleString('en-US', { minimumFractionDigits: 2 })} HSCT`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[11px]">
                          <span className="text-neutral-400">Network Fee</span>
                          <span className="font-mono text-emerald-400 font-bold">0.00 HSCT (Free)</span>
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
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/10'
                          : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/10'
                      }`}
                    >
                      {tradeType === 'buy'
                        ? cryptoInput && parseFloat(cryptoInput) > 0
                          ? `Buy ${parseFloat(cryptoInput).toFixed(6)} ${selectedAsset} with Money`
                          : `Buy ${selectedAsset} with Money (HSCT)`
                        : cryptoInput && parseFloat(cryptoInput) > 0
                        ? `Sell ${parseFloat(cryptoInput).toFixed(6)} ${selectedAsset} for Money`
                        : `Sell ${selectedAsset}`}
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
                          : 0
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
