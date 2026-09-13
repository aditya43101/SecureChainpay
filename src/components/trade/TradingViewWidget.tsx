'use client';

import React, { useEffect, useState } from 'react';
import { useAIStore } from '@/stores/ai-store';
import { useWalletStore } from '@/stores/wallet-store';
import { Target, ShieldAlert, TrendingUp, AlertTriangle, Sliders, Shield } from 'lucide-react';

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
      case 'HOLD':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-neutral-400 bg-neutral-800 border-neutral-700';
    }
  };

  const getModeBadge = (mode?: string) => {
    switch (mode) {
      case 'EXPLOIT':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'EXPLORE':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  const isApproved = recommendation && (recommendation.decisionTrace?.execution === 'APPROVED' || (recommendation.action === 'BUY' || recommendation.action === 'SELL') && recommendation.riskAssessment?.status === 'PASS');
  const decisionMode = recommendation?.decisionMode || (recommendation?.score >= 5 ? 'EXPLOIT' : (recommendation?.score >= 3 ? 'EXPLORE' : 'HOLD'));

  return (
    <div className="w-full bg-neutral-950/80 border border-white/10 rounded-3xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-xl shadow-2xl">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Controls */}
      <div className="relative z-10 flex flex-wrap justify-between items-center gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {cleanSymbol}/USD Real-Time TradingView Terminal
            </h3>
            <p className="text-xs text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
              <span>Live Price:</span>
              <span className="text-emerald-400 font-bold font-mono">
                ${(recommendation?.canonicalSnapshot?.lastPrice || recommendation?.entry?.suggestedEntry || currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-400">
                {recommendation?.canonicalSnapshot?.dataSource || 'Binance Spot Live'}
              </span>
              {recommendation?.canonicalSnapshot?.isStale && (
                <span className="text-amber-400 font-bold bg-amber-500/20 px-1.5 py-0.2 rounded text-[10px]">
                  STALE DATA ({recommendation?.canonicalSnapshot?.stalenessAgeSeconds}s)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* AI Signal Badge & Pipeline Status */}
        {showOverlay && recommendation && (
          <div className="flex flex-wrap items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-neutral-400 font-semibold">Signal:</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getActionColor(recommendation.action)}`}>
              {recommendation.action}
            </span>

            <span className="text-xs text-neutral-400 font-semibold ml-1">Confidence:</span>
            <span className="text-xs font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">
              {recommendation.score !== undefined ? `${recommendation.score}/7` : '3/7'}
            </span>

            <span className="text-xs text-neutral-400 font-semibold ml-1">Mode:</span>
            <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${getModeBadge(decisionMode)}`}>
              {decisionMode}
            </span>

            <span className="text-xs text-neutral-400 font-semibold ml-1">Lifecycle State:</span>
            <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${
              recommendation.decisionTrace?.rejectionReason === 'MARKET_DATA_STALE'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : recommendation.brainContext?.decision === 'ENTER_LONG' || recommendation.brainContext?.decision === 'ENTER_SHORT'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
                : recommendation.brainContext?.decision === 'WAIT' || recommendation.brainContext?.timing?.status === 'WAITING_FOR_ENTRY'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                : isApproved
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {recommendation.decisionTrace?.rejectionReason === 'MARKET_DATA_STALE'
                ? 'MARKET DATA STALE — BLOCKED'
                : recommendation.brainContext?.decision === 'ENTER_LONG' || recommendation.brainContext?.decision === 'ENTER_SHORT'
                ? 'ENTRY CONFIRMED — PAPER EXECUTION'
                : recommendation.brainContext?.decision === 'WAIT' || recommendation.brainContext?.timing?.status === 'WAITING_FOR_ENTRY'
                ? 'WAITING FOR ENTRY TIMING'
                : recommendation.brainContext?.decision === 'EXIT'
                ? 'STRATEGY REVERSAL — CLOSING'
                : isApproved
                ? 'ENTRY CONFIRMED — PAPER EXECUTION'
                : 'SIGNAL REJECTED / HOLD'}
            </span>
          </div>
        )}
      </div>

      {/* Explicit Rejection Reason Banner when not approved */}
      {showOverlay && recommendation && !isApproved && (
        <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl text-xs text-amber-300 flex items-center gap-2 mb-3 relative z-10">
          <ShieldAlert size={14} className="text-amber-400 flex-shrink-0" />
          <span>
            <strong>Reason:</strong> {recommendation.decisionTrace?.rejectionReason || recommendation.riskAssessment?.reasons?.[0] || recommendation.reasons?.[recommendation.reasons.length - 1] || 'Insufficient conviction or risk thresholds not satisfied'}
          </span>
        </div>
      )}

      {/* Validated Levels & Risk Overlay when approved */}
      {showOverlay && recommendation && isApproved && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3 mb-3 relative z-10">
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={13} className="text-cyan-400" />
              <span className="text-[11px] text-neutral-400 font-medium">Entry (Market)</span>
            </div>
            <span className="text-xs font-mono font-bold text-white">
              ${(recommendation.entry?.suggestedEntry || recommendation.canonicalSnapshot?.lastPrice || currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <Target size={13} className="text-emerald-400" />
              <span className="text-[11px] text-emerald-300 font-medium">Take Profit</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ${recommendation.takeProfit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldAlert size={13} className="text-red-400" />
              <span className="text-[11px] text-red-300 font-medium">Stop Loss</span>
            </div>
            <span className="text-xs font-mono font-bold text-red-400">
              ${recommendation.stopLoss?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={13} className="text-indigo-400" />
              <span className="text-[11px] text-indigo-300 font-medium">R:R Ratio</span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-300">
              1:{recommendation.riskReward || '1.5'}
            </span>
          </div>

          <div className="bg-cyan-500/10 border border-cyan-500/20 p-2.5 rounded-xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <Sliders size={13} className="text-cyan-400" />
              <span className="text-[11px] text-cyan-300 font-medium">Position Size</span>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-300">
              {recommendation.positionSize || 0} {cleanSymbol}
            </span>
            {recommendation.riskAssessment?.isCappedByExposure && (
              <span className="text-[9px] text-amber-300 font-mono">
                Capped (10% max)
              </span>
            )}
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield size={13} className="text-purple-400" />
              <span className="text-[11px] text-purple-300 font-medium">Stop Risk / Budget</span>
            </div>
            <span className="text-xs font-mono font-bold text-purple-300">
              ${(recommendation.riskAssessment?.appliedStopRiskUSD || recommendation.riskAssessment?.allowedRiskUSD || 250).toFixed(2)}
              {' '}
              <span className="text-[10px] text-purple-200">
                ({(((recommendation.riskAssessment?.appliedStopRiskPercent || (decisionMode === 'EXPLORE' ? 0.0025 : 0.01))) * 100).toFixed(3)}%)
              </span>
            </span>
            <span className="text-[9px] text-neutral-400 font-mono">
              Budget: ${recommendation.riskAssessment?.allowedRiskUSD || 250} ({decisionMode === 'EXPLORE' ? '0.25%' : '1.0%'})
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
