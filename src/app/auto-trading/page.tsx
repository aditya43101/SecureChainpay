'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  Octagon,
  Play,
  Pause,
  RefreshCw,
  Sliders,
  Activity,
  AlertTriangle,
  Zap,
  CheckCircle,
  XCircle,
  BarChart,
  BarChart2,
  Cpu,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { AutoTradingConfirmationModal } from '@/components/trading/AutoTradingConfirmationModal';
import { TradingViewWidget } from '@/components/trade/TradingViewWidget';

export default function AutoTradingPage() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleLogs, setCycleLogs] = useState<string[]>([]);
  const [chartSymbol, setChartSymbol] = useState('BTCUSDT');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/auto-trading/status');
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
      }
    } catch (err) {
      console.error('Failed to fetch auto trading status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000); // live refresh every 2s
    return () => clearInterval(interval);
  }, []);

  const handleEnableAutoTrading = async (userConfig: any) => {
    try {
      const res = await fetch('/api/auto-trading/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userConfig)
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Error enabling auto trading:', err);
    }
  };

  const handleDisableAutoTrading = async () => {
    try {
      const res = await fetch('/api/auto-trading/disable', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Error disabling auto trading:', err);
    }
  };

  const handleEmergencyStop = async () => {
    if (!confirm('CRITICAL ACTION: Are you sure you want to trigger EMERGENCY STOP? This will immediately halt auto-trading and cancel pending orders.')) {
      return;
    }
    try {
      const res = await fetch('/api/auto-trading/emergency-stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Error triggering emergency stop:', err);
    }
  };

  const handleTriggerCycle = async () => {
    setRunningCycle(true);
    try {
      const res = await fetch('/api/auto-trading/run', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.cycleResult) {
        setCycleLogs(data.cycleResult.logs || []);
        await fetchStatus();
      }
    } catch (err) {
      console.error('Error running monitoring cycle:', err);
    } finally {
      setRunningCycle(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-brand-primary">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-sm font-semibold">Loading Execution Safety Engine...</span>
        </div>
      </div>
    );
  }

  const settings = statusData?.settings || {};
  const dailyState = statusData?.dailyState || {};
  const account = statusData?.account || { positions: [], orders: [] };
  const events = statusData?.recentEvents || [];

  const isEnabled = settings.enabled && settings.status === 'ENABLED';
  const isEmergencyStop = settings.status === 'EMERGENCY_STOP';
  const isPaused = settings.status === 'PAUSED';

  return (
    <div className="min-h-screen bg-black text-neutral-100 p-6 space-y-6">
      {/* Header & Control Banner */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold border ${
            isEmergencyStop
              ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
              : isPaused
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : isEnabled
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-[#1a1a1a] text-neutral-400 border-white/10'
          }`}>
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white tracking-tight">Auto-Trading & Execution Engine</h1>
              
              {/* Visual Distinction Badge */}
              <span className={`px-3 py-1 text-xs font-black rounded-lg border tracking-wider uppercase ${
                settings.mode === 'AUTO'
                  ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-sm shadow-red-500/20'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {settings.mode === 'AUTO' ? '⚡ REAL EXECUTION' : '🧪 SIMULATED FUNDS'}
              </span>

              {/* Status Badge */}
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md border ${
                isEmergencyStop
                  ? 'bg-red-950 text-red-400 border-red-800'
                  : isPaused
                  ? 'bg-amber-950 text-amber-400 border-amber-800'
                  : isEnabled
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-[#1a1a1a] text-neutral-400 border-white/10'
              }`}>
                STATUS: {settings.status || 'DISABLED'}
              </span>
            </div>

            <p className="text-xs text-neutral-400 mt-1 flex items-center gap-4">
              <span>All-Time Mode: <strong className={settings.allTimeMode ? 'text-brand-primary' : 'text-neutral-500'}>{settings.allTimeMode ? 'ACTIVE' : 'OFF'}</strong></span>
              <span>•</span>
              <span>Champion Strategy: <strong className="text-white">{settings.strategyVersion || 'HYBRID_v1'}</strong></span>
              <span>•</span>
              <span>Champion Model: <strong className="text-white">{settings.modelVersion || 'LOG_v1'}</strong></span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTriggerCycle}
            disabled={runningCycle}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#121212] hover:bg-[#1a1a1a] text-neutral-200 border border-white/10 transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningCycle ? 'animate-spin' : ''}`} />
            Run Monitoring Cycle
          </button>

          {!isEnabled ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-brand-primary hover:bg-brand-pale text-black shadow-lg shadow-brand-primary/20 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-black text-black" />
              ENABLE AUTO-TRADING
            </button>
          ) : (
            <button
              onClick={handleDisableAutoTrading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#121212] hover:bg-[#1a1a1a] text-neutral-200 border border-white/10 transition-all flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              STOP AUTO-TRADING
            </button>
          )}

          {/* Emergency Stop Button */}
          <button
            onClick={handleEmergencyStop}
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 border border-red-500"
          >
            <Octagon className="w-4 h-4 fill-white text-red-600" />
            EMERGENCY STOP
          </button>
        </div>
      </div>

      {/* SECTION 1: All-Time Mode Status Banner */}
      {settings.allTimeMode && (
        <div className="bg-[#0a0a0a] border border-brand-primary/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-ping" />
            <div>
              <div className="text-xs font-bold text-brand-primary uppercase tracking-wider">All-Time Monitoring Active</div>
              <div className="text-xs text-neutral-400">
                Continuously analyzing market data for BTCUSDT & ETHUSDT. Will execute only if all 8 safety gates pass.
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-md px-2.5 py-1">
            Interval: 15s
          </span>
        </div>
      )}

      {/* Cycle Logs Banner */}
      {cycleLogs.length > 0 && (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 space-y-2">
          <div className="text-xs font-bold text-neutral-300 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-brand-primary" />
            Latest Cycle Execution Logs
          </div>
          <div className="bg-black rounded-lg p-3 text-[11px] font-mono text-neutral-300 max-h-32 overflow-y-auto space-y-1">
            {cycleLogs.map((log, idx) => (
              <div key={idx} className="leading-tight">{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Risk & Performance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI 1: Risk Per Trade */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
          <div className="text-xs text-neutral-400 mb-1 flex items-center justify-between">
            <span>Risk Per Trade</span>
            <Sliders className="w-3.5 h-3.5 text-neutral-500" />
          </div>
          <div className="text-2xl font-black text-white">
            {((settings.riskPerTrade || 0.01) * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">Configured Position Size Risk</div>
        </div>

        {/* KPI 2: Max Daily Loss */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
          <div className="text-xs text-neutral-400 mb-1 flex items-center justify-between">
            <span>Max Daily Loss</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {((settings.maxDailyLoss || 0.03) * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Today P&L: {(dailyState.realizedPnL || 0).toFixed(2)} HSCT
          </div>
        </div>

        {/* KPI 3: Max Portfolio Exposure */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
          <div className="text-xs text-neutral-400 mb-1 flex items-center justify-between">
            <span>Max Exposure Limit</span>
            <Shield className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <div className="text-2xl font-black text-brand-primary">
            {((settings.maxPortfolioExposure || 0.20) * 100).toFixed(0)}%
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Max Open Positions: {settings.maxOpenPositions || 3}
          </div>
        </div>

        {/* KPI 4: Today Trades & Win Rate */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
          <div className="text-xs text-neutral-400 mb-1 flex items-center justify-between">
            <span>Today's Trades</span>
            <BarChart className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {dailyState.totalTrades || 0}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-medium">
            {dailyState.totalTrades > 0
              ? `Win Rate: ${(((dailyState.winningTrades || 0) / dailyState.totalTrades) * 100).toFixed(0)}%`
              : 'No trades executed today'}
          </div>
        </div>
      </div>

      {/* Live Binance & TradingView Pro Chart Component */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-brand-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Live Execution Market Feed</h3>
          </div>
          <div className="flex bg-[#121212] border border-white/10 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setChartSymbol('BTCUSDT')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${chartSymbol === 'BTCUSDT' ? 'bg-brand-primary text-black font-extrabold shadow-sm' : 'text-neutral-400 hover:text-white'}`}
            >
              BTC/USDT
            </button>
            <button
              type="button"
              onClick={() => setChartSymbol('ETHUSDT')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${chartSymbol === 'ETHUSDT' ? 'bg-brand-primary text-black font-extrabold shadow-sm' : 'text-neutral-400 hover:text-white'}`}
            >
              ETH/USDT
            </button>
          </div>
        </div>
        <TradingViewWidget symbol={chartSymbol} height={440} showOverlay={true} />
      </div>

      {/* Main Grid: Active Positions & Safety Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Positions & Recent Orders (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 4: Active Open Positions */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-primary" />
                Active Auto-Traded Positions
              </span>
              <span className="text-xs font-normal text-neutral-400">
                {account.positions.length} Open
              </span>
            </h3>

            {account.positions.length === 0 ? (
              <div className="bg-black rounded-xl p-8 text-center text-neutral-400 text-xs border border-white/10">
                No active auto-traded positions. Monitoring market for valid setups...
              </div>
            ) : (
              <div className="space-y-3">
                {account.positions.map((pos: any) => (
                  <div key={pos.id} className="bg-black border border-white/10 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{pos.symbol}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          pos.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {pos.side}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 mt-1 space-x-3">
                        <span>Entry: ${pos.averageEntry.toFixed(2)}</span>
                        <span>Qty: {pos.quantity}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-semibold text-neutral-300">
                        SL: ${pos.stopLoss.toFixed(2)} | TP: ${pos.takeProfit.toFixed(2)}
                      </div>
                      <div className={`text-sm font-bold mt-1 ${pos.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5 & 6: Order Execution Log */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-primary" />
              Recent Execution Order History & Idempotency Audit
            </h3>

            {account.orders.length === 0 ? (
              <div className="bg-black rounded-xl p-6 text-center text-neutral-400 text-xs border border-white/10">
                No orders executed yet in this session.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="text-[11px] text-neutral-400 uppercase bg-black border-b border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Price</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {account.orders.map((ord: any) => (
                      <tr key={ord.id} className="hover:bg-[#121212]">
                        <td className="py-2.5 px-3 font-semibold text-white">{ord.symbol}</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-bold ${ord.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {ord.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">${ord.price?.toFixed(2) || '0.00'}</td>
                        <td className="py-2.5 px-3">{ord.quantity}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1a1a1a] text-neutral-300 border border-white/10">
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                          {new Date(ord.executedAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Safety Events & Circuit Breakers (1 col) */}
        <div className="space-y-6">
          {/* SECTION 9: Safety Events & Circuit Breaker Audit Log */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Execution Safety Audit Events
            </h3>

            {events.length === 0 ? (
              <div className="bg-black rounded-xl p-6 text-center text-neutral-400 text-xs border border-white/10">
                No safety events recorded. Execution engine healthy.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {events.map((ev: any) => (
                  <div key={ev.id} className="bg-black border border-white/10 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-[11px] uppercase ${
                        ev.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {ev.eventType}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {new Date(ev.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-neutral-300 text-[11px] leading-relaxed">
                      {ev.details}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal Component */}
      <AutoTradingConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleEnableAutoTrading}
      />
    </div>
  );
}
