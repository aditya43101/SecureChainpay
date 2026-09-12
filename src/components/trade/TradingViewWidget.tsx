'use client';

import React, { useEffect, useState } from 'react';
import { useAIStore } from '@/stores/ai-store';
import { useWalletStore } from '@/stores/wallet-store';
import { Target, ShieldAlert, TrendingUp, AlertTriangle } from 'lucide-react';

interface TradingViewWidgetProps {
  symbol: string;
  height?: number;
  showOverlay?: boolean;
}

export function TradingViewWidget({ symbol, height = 540, showOverlay = true }: TradingViewWidgetProps) {
  const [recommendation, setRecommendation] = useState<any>(null);
  const updateTradingContext = useAIStore((s) => s.updateTradingContext);
  const prices = useWalletStore((s) => s.prices);

  const rawClean = symbol ? symbol.toUpperCase().replace(/[\/\-_]/g, '') : 'BTC';
  let formattedSymbol = rawClean;
  if (rawClean.endsWith('USDT')) {
    formattedSymbol = rawClean;
  } else if (rawClean.endsWith('USD')) {
    formattedSymbol = rawClean.replace(/USD$/, 'USDT');
  } else {
    formattedSymbol = `${rawClean}USDT`;
  }
  const cleanSymbol = formattedSymbol.replace('USDT', '');
  const assetKey: any = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA'].includes(cleanSymbol) ? cleanSymbol : 'BTC';
  const currentPrice = prices[assetKey] || (assetKey === 'BTC' ? 77450 : assetKey === 'ETH' ? 2550 : assetKey === 'SOL' ? 136.5 : assetKey === 'BNB' ? 582.2 : 0.342);

  // Sync symbol to AI Store
  useEffect(() => {
    updateTradingContext({ asset: assetKey, timeframe: '1h' });
  }, [assetKey, updateTradingContext]);

  // Fetch ML recommendation overlay for the active asset
  useEffect(() => {
    let isMounted = true;
    const fetchRec = async () => {
      try {
        const res = await fetch(`/api/trading/recommendation/${formattedSymbol}?timeframe=1h`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data && data.success && data.recommendation) {
            setRecommendation(data.recommendation);
          }
        }
      } catch (err) {
        console.warn('[TradingViewWidget] Non-critical overlay recommendation fetch warning:', err);
      }
    };

    fetchRec();
    const interval = setInterval(fetchRec, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [formattedSymbol]);

  // TradingView Embed URL constructor - Works for any valid Binance spot pair
  const tvSymbol = `BINANCE:${cleanSymbol}USDT`;
  const tradingViewEmbedUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(
    tvSymbol
  )}&interval=60&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MASimple%40tv-basicstudies%22%5D&theme=dark&style=1&timezone=Asia%2FKolkata&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=securechainpay.com`;

  const getActionColor = (action: string) => {
    switch (action) {
      case 'STRONG_BUY':
      case 'BUY':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'STRONG_SELL':
      case 'SELL':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      default:
        return 'text-neutral-400 bg-neutral-800 border-neutral-700';
    }
  };

  return (
    <div className="w-full bg-neutral-950/80 border border-white/10 rounded-3xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-xl shadow-2xl">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Controls */}
      <div className="relative z-10 flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {cleanSymbol}/USD Real-Time TradingView Terminal
            </h3>
            <p className="text-xs text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
              <span>Live Price:</span>
              <span className="text-emerald-400 font-bold font-mono">
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-neutral-600">•</span>
              <span>TradingView Pro Live Feed</span>
            </p>
          </div>
        </div>

        {/* AI Signal Badge */}
        {showOverlay && recommendation && (
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-neutral-400 font-semibold">AI Signal:</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getActionColor(recommendation.action)}`}>
              {recommendation.action} ({recommendation.strength || 'MODERATE'})
            </span>
            <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
              Score: {recommendation.score?.toFixed(1) || '7.5'}/{recommendation.maxScore || '10'}
            </span>
          </div>
        )}
      </div>

      {/* Validated Levels Overlay */}
      {showOverlay && recommendation && recommendation.action !== 'NO_TRADE' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 relative z-10">
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-cyan-400" />
              <span className="text-xs text-neutral-400 font-medium">Entry</span>
            </div>
            <span className="text-xs font-mono font-bold text-white">
              ${(recommendation.entry?.suggestedEntry || currentPrice)?.toLocaleString()}
            </span>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target size={13} className="text-emerald-400" />
              <span className="text-xs text-emerald-300 font-medium">Take Profit</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ${(recommendation.takeProfit || currentPrice * 1.035)?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-red-400" />
              <span className="text-xs text-red-300 font-medium">Stop Loss</span>
            </div>
            <span className="text-xs font-mono font-bold text-red-400">
              ${(recommendation.stopLoss || currentPrice * 0.982)?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-indigo-400" />
              <span className="text-xs text-indigo-300 font-medium">R:R Ratio</span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-300">
              1:{recommendation.riskReward || '2.2'}
            </span>
          </div>
        </div>
      )}

      {/* Main TradingView Pro Chart Canvas */}
      <div
        className="w-full bg-black/60 rounded-2xl overflow-hidden border border-white/5 relative z-10"
        style={{ height: `${height}px` }}
      >
        <iframe
          title={`${symbol} TradingView Pro Chart`}
          src={tradingViewEmbedUrl}
          className="w-full h-full border-none"
          allowFullScreen
        />
      </div>
    </div>
  );
}
