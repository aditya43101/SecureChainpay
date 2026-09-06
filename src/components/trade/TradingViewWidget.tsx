'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, Time } from 'lightweight-charts';
import { useAIStore } from '@/stores/ai-store';
import { useWalletStore } from '@/stores/wallet-store';
import { Target, ShieldAlert, TrendingUp, AlertTriangle } from 'lucide-react';

interface TradingViewWidgetProps {
  symbol: string;
}

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

export function TradingViewWidget({ symbol }: TradingViewWidgetProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  
  const updateTradingContext = useAIStore(s => s.updateTradingContext);

  useEffect(() => {
    updateTradingContext({ timeframe });
  }, [timeframe, updateTradingContext]);

  // Init Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    chartRef.current = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#D9D9D9',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      }
    });

    seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
      upColor: '#10b981', // emerald-500
      downColor: '#ef4444', // red-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.remove();
    };
  }, []);

  const latestKlineData = useWalletStore(s => s.latestKlineData);
  const assetKey = symbol === 'BTC' ? 'BTC' : (symbol === 'ETH' ? 'ETH' : symbol.replace('USDT', ''));

  // Fetch Initial Candles & Quantitative Recommendation
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const formattedSymbol = symbol === 'BTC' ? 'BTCUSDT' : (symbol === 'ETH' ? 'ETHUSDT' : symbol);
        
        // 1. Candles
        const resCandles = await fetch(`/api/market/candles/${formattedSymbol}?timeframe=${timeframe}&limit=200`);
        if (resCandles.ok) {
          const data = await resCandles.json();
          if (isMounted && data && Array.isArray(data) && seriesRef.current) {
            const chartData = data.map(c => ({
              time: Math.floor(new Date(c.timestamp).getTime() / 1000) as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }));
            seriesRef.current.setData(chartData);
          }
        }

        // 2. Quantitative Recommendation
        const resRec = await fetch(`/api/trading/recommendation/${formattedSymbol}?timeframe=${timeframe}`);
        if (resRec.ok) {
          const recData = await resRec.json();
          if (isMounted && recData.success) {
            setRecommendation(recData.recommendation);
          }
        }
      } catch (err) {
        console.error("Failed to load chart data/recommendation:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [symbol, timeframe]);

  // Real-time live forming candle update from Binance stream
  useEffect(() => {
    const liveKline = latestKlineData[assetKey];
    if (seriesRef.current && liveKline) {
      try {
        seriesRef.current.update({
          time: liveKline.time as Time,
          open: liveKline.open,
          high: liveKline.high,
          low: liveKline.low,
          close: liveKline.close,
        });
      } catch (err) {
        // Quiet fail for timing sequence race conditions
      }
    }
  }, [latestKlineData, assetKey]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'SELL': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'HOLD': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30';
    }
  };

  return (
    <div className="w-full bg-[#09090b] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            {symbol}/USD Live Chart
          </h3>
          <p className="text-xs text-neutral-500 font-mono">Lightweight Charts + Quantitative Engine</p>
        </div>
        
        {/* Recommendation Overlay Header Badge */}
        {recommendation && (
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl">
            <span className="text-xs text-neutral-400 font-semibold">AI Strategy:</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getActionColor(recommendation.action)}`}>
              {recommendation.action} ({recommendation.strength})
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              Score: {recommendation.score}/{recommendation.maxScore}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                timeframe === tf 
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Validated Levels Toolbar Overlay */}
      {recommendation && recommendation.action !== 'NO_TRADE' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 relative z-10">
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-cyan-400" />
              <span className="text-xs text-neutral-400 font-medium">Entry Zone</span>
            </div>
            <span className="text-xs font-mono font-bold text-white">
              ${recommendation.entry?.suggestedEntry?.toLocaleString()}
            </span>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-emerald-400" />
              <span className="text-xs text-emerald-300 font-medium">Take Profit</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ${recommendation.takeProfit?.toLocaleString()}
            </span>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-red-400" />
              <span className="text-xs text-red-300 font-medium">Stop Loss</span>
            </div>
            <span className="text-xs font-mono font-bold text-red-400">
              ${recommendation.stopLoss?.toLocaleString()}
            </span>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-indigo-400" />
              <span className="text-xs text-indigo-300 font-medium">Risk/Reward</span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-300">
              1:{recommendation.riskReward}
            </span>
          </div>
        </div>
      )}

      <div className="w-full h-[500px] bg-black/40 rounded-2xl overflow-hidden border border-white/5 relative z-10">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
