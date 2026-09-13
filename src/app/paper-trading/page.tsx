'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import {
  ShieldAlert,
  TrendingUp,
  RotateCcw,
  BarChart2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  X,
  Target,
  Shield,
  Activity,
  Award,
  Flame,
  BrainCircuit,
  Eye,
  Percent
} from 'lucide-react';
import { formatDateTime } from '@/lib/timezone-service';
import { TradingViewWidget } from '@/components/trade/TradingViewWidget';

export default function PaperTradingPage() {
  const [account, setAccount] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [selectedTrade, setSelectedTrade] = useState<any>(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [placing, setPlacing] = useState(false);

  const fetchPaperData = async () => {
    try {
      // 1. Account
      const resAcc = await fetch('/api/paper/account');
      if (resAcc.ok) {
        const data = await resAcc.json();
        if (data.success) setAccount(data.account);
      }

      // 2. Positions
      const resPos = await fetch('/api/paper/positions');
      if (resPos.ok) {
        const data = await resPos.json();
        if (data.success) setPositions(data.positions);
      }

      // 3. Orders
      const resOrd = await fetch('/api/paper/orders');
      if (resOrd.ok) {
        const data = await resOrd.json();
        if (data.success) setOrders(data.orders);
      }

      // 4. Analytics
      const resAnalytics = await fetch('/api/paper/analytics');
      if (resAnalytics.ok) {
        const data = await resAnalytics.json();
        if (data.success) setAnalytics(data.analytics);
      }
    } catch (e) {
      console.error('Failed to load paper trading data:', e);
    }
  };

  useEffect(() => {
    fetchPaperData();
    const interval = setInterval(fetchPaperData, 8000); // refresh every 8s
    return () => clearInterval(interval);
  }, []);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    try {
      const res = await fetch('/api/paper/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, side })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Paper trade failed: ${data.error || 'Unknown error'}`);
        return;
      }

      fetchPaperData();
    } catch (err) {
      console.error(err);
      alert('Failed to place paper order.');
    } finally {
      setPlacing(false);
    }
  };

  const handleClosePosition = async (posId: string) => {
    setClosingId(posId);
    try {
      const res = await fetch(`/api/paper/positions/${posId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Failed to close position: ${data.error || 'Unknown error'}`);
        return;
      }
      fetchPaperData();
      if (data.outcome) {
        setSelectedTrade(data.outcome);
      }
    } catch (err) {
      console.error('Error closing position:', err);
      alert('Error closing position');
    } finally {
      setClosingId(null);
    }
  };

  const handleInspectTrade = async (tradeId: string) => {
    setLoadingModal(true);
    try {
      const res = await fetch(`/api/paper/trades/${tradeId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSelectedTrade(data.trade);
        }
      }
    } catch (err) {
      console.error('Failed to inspect trade:', err);
    } finally {
      setLoadingModal(false);
    }
  };

  const handleResetAccount = async () => {
    if (!confirm('Are you sure you want to reset your simulated paper account back to 100,000 HSCT?')) return;
    try {
      const res = await fetch('/api/paper/account', { method: 'POST' });
      if (res.ok) {
        fetchPaperData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col pl-[280px] overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* Safety Notice Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-amber-400 flex-shrink-0" size={24} />
              <div>
                <h4 className="text-sm font-bold text-amber-300">PAPER TRADING ENVIRONMENT (PHASE 2 OUTCOME SYSTEM)</h4>
                <p className="text-xs text-amber-200/80">
                  Fully simulated execution with live market data, realistic slippage (0.05%), transaction fees (0.075%), and immutable decision snapshots. No real funds or exchange accounts are touched.
                </p>
              </div>
            </div>
            <button
              onClick={handleResetAccount}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl text-neutral-200 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={14} /> Reset Account
            </button>
          </div>

          {/* Virtual Account Balance Cards */}
          {account && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-900/80 border border-white/5 p-5 rounded-2xl backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium block mb-1">Simulated Equity</span>
                <span className="text-2xl font-bold font-mono text-white">{account.equity.toLocaleString()} HSCT</span>
                <span className={`text-xs font-mono font-bold block mt-1 ${account.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {account.totalReturn >= 0 ? '+' : ''}{account.totalReturn}% total return
                </span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-5 rounded-2xl backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium block mb-1">Available Cash</span>
                <span className="text-2xl font-bold font-mono text-cyan-400">{account.cashBalance.toLocaleString()} HSCT</span>
                <span className="text-xs text-neutral-500 block mt-1">Virtual capital buffer</span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-5 rounded-2xl backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium block mb-1">Unrealized P&L</span>
                <span className={`text-2xl font-bold font-mono ${account.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {account.unrealizedPnL >= 0 ? '+' : ''}{account.unrealizedPnL} HSCT
                </span>
                <span className="text-xs text-neutral-500 block mt-1">Active open positions</span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-5 rounded-2xl backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium block mb-1">Realized Net P&L</span>
                <span className={`text-2xl font-bold font-mono ${account.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {account.realizedPnL >= 0 ? '+' : ''}{account.realizedPnL} HSCT
                </span>
                <span className="text-xs text-neutral-500 block mt-1">After simulated fees & slippage</span>
              </div>
            </div>
          )}

          {/* Outcome Analytics Dashboard */}
          {analytics && (
            <div className="bg-neutral-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-200">Outcome Intelligence & Performance Metrics</h3>
                </div>
                <span className="text-xs text-neutral-400 font-mono">Total Closed Trades: {analytics.totalTrades}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                  <span className="text-[11px] text-neutral-400 block mb-0.5">Win Rate</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">{analytics.winRate}%</span>
                  <span className="text-[10px] text-neutral-500 block">{analytics.wins}W / {analytics.losses}L</span>
                </div>
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                  <span className="text-[11px] text-neutral-400 block mb-0.5">Profit Factor</span>
                  <span className="text-lg font-bold font-mono text-cyan-400">{analytics.profitFactor}x</span>
                  <span className="text-[10px] text-neutral-500 block">Gross Win / Loss</span>
                </div>
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                  <span className="text-[11px] text-neutral-400 block mb-0.5">Avg PnL / Trade</span>
                  <span className={`text-lg font-bold font-mono ${analytics.averagePnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {analytics.averagePnL >= 0 ? '+' : ''}${analytics.averagePnL}
                  </span>
                  <span className="text-[10px] text-neutral-500 block">Net realized</span>
                </div>
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                  <span className="text-[11px] text-neutral-400 block mb-0.5">Avg Win</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">+${analytics.averageWin}</span>
                  <span className="text-[10px] text-neutral-500 block">Winning trades</span>
                </div>
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                  <span className="text-[11px] text-neutral-400 block mb-0.5">Avg Loss</span>
                  <span className="text-lg font-bold font-mono text-red-400">-${analytics.averageLoss}</span>
                  <span className="text-[10px] text-neutral-500 block">Losing trades</span>
                </div>
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                  <span className="text-[11px] text-neutral-400 block mb-0.5">Avg Duration</span>
                  <span className="text-lg font-bold font-mono text-indigo-400">{analytics.averageHoldingDurationMinutes}m</span>
                  <span className="text-[10px] text-neutral-500 block">Position hold time</span>
                </div>
              </div>

              {/* Sliced Performance: Asset & Decision Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Asset Breakdown */}
                <div className="bg-black/30 border border-white/5 p-3.5 rounded-2xl">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Target size={14} className="text-orange-400" /> Asset Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 bg-neutral-900/60 rounded-xl border border-orange-500/20">
                      <div className="text-orange-400 font-bold mb-1">BTC/USDT</div>
                      <div className="text-neutral-300">Trades: {analytics.byAsset.BTC.trades}</div>
                      <div className="text-neutral-300">Win Rate: {analytics.byAsset.BTC.winRate}%</div>
                      <div className={analytics.byAsset.BTC.netPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        PnL: {analytics.byAsset.BTC.netPnL >= 0 ? '+' : ''}${analytics.byAsset.BTC.netPnL}
                      </div>
                    </div>
                    <div className="p-2.5 bg-neutral-900/60 rounded-xl border border-blue-500/20">
                      <div className="text-blue-400 font-bold mb-1">ETH/USDT</div>
                      <div className="text-neutral-300">Trades: {analytics.byAsset.ETH.trades}</div>
                      <div className="text-neutral-300">Win Rate: {analytics.byAsset.ETH.winRate}%</div>
                      <div className={analytics.byAsset.ETH.netPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        PnL: {analytics.byAsset.ETH.netPnL >= 0 ? '+' : ''}${analytics.byAsset.ETH.netPnL}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decision Mode Breakdown */}
                <div className="bg-black/30 border border-white/5 p-3.5 rounded-2xl">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BrainCircuit size={14} className="text-purple-400" /> Decision Mode Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 bg-neutral-900/60 rounded-xl border border-purple-500/20">
                      <div className="text-purple-400 font-bold mb-1">EXPLORATION (3-4/7)</div>
                      <div className="text-neutral-300">Trades: {analytics.byDecisionMode.EXPLORATION.trades}</div>
                      <div className="text-neutral-300">Win Rate: {analytics.byDecisionMode.EXPLORATION.winRate}%</div>
                      <div className={analytics.byDecisionMode.EXPLORATION.netPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        PnL: {analytics.byDecisionMode.EXPLORATION.netPnL >= 0 ? '+' : ''}${analytics.byDecisionMode.EXPLORATION.netPnL}
                      </div>
                    </div>
                    <div className="p-2.5 bg-neutral-900/60 rounded-xl border border-emerald-500/20">
                      <div className="text-emerald-400 font-bold mb-1">EXPLOITATION (5-7/7)</div>
                      <div className="text-neutral-300">Trades: {analytics.byDecisionMode.EXPLOITATION.trades}</div>
                      <div className="text-neutral-300">Win Rate: {analytics.byDecisionMode.EXPLOITATION.winRate}%</div>
                      <div className={analytics.byDecisionMode.EXPLOITATION.netPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        PnL: {analytics.byDecisionMode.EXPLOITATION.netPnL >= 0 ? '+' : ''}${analytics.byDecisionMode.EXPLOITATION.netPnL}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confidence Performance Tier Bar */}
              {analytics.confidencePerformance && analytics.confidencePerformance.length > 0 && (
                <div className="bg-black/30 border border-white/5 p-3.5 rounded-2xl">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Percent size={14} className="text-indigo-400" /> Outcomes by Confidence Tier (1/7 through 7/7)
                  </h4>
                  <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono">
                    {analytics.confidencePerformance.map((c: any) => (
                      <div key={c.score} className="p-2 bg-neutral-900/70 rounded-xl border border-white/5">
                        <span className="text-indigo-400 font-bold block">{c.score}/7</span>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">{c.totalTrades} trades</span>
                        <span className={`text-[11px] font-bold block mt-0.5 ${c.winRate >= 50 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                          {c.totalTrades > 0 ? `${c.winRate}%` : '-'}
                        </span>
                        <span className={`text-[10px] block ${c.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {c.totalTrades > 0 ? `${c.netPnL >= 0 ? '+' : ''}$${c.netPnL}` : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Interactive Chart Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Live Paper Trading Market Chart</h3>
              </div>
              <div className="flex bg-neutral-900/80 border border-white/10 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSymbol('BTCUSDT')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${symbol === 'BTCUSDT' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-neutral-400'}`}
                >
                  BTC/USDT
                </button>
                <button
                  type="button"
                  onClick={() => setSymbol('ETHUSDT')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${symbol === 'ETHUSDT' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-neutral-400'}`}
                >
                  ETH/USDT
                </button>
              </div>
            </div>
            <TradingViewWidget symbol={symbol} height={420} showOverlay={true} />
          </div>

          {/* Simulated Order Execution Form */}
          <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-400" />
              Simulated Order Execution
            </h3>
            <form onSubmit={handlePlaceOrder} className="flex flex-wrap items-center gap-4">
              <div className="w-44">
                <label className="text-xs text-neutral-400 font-medium block mb-1">Asset</label>
                <select
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="BTCUSDT">BTC/HSCT</option>
                  <option value="ETHUSDT">ETH/HSCT</option>
                </select>
              </div>

              <div className="w-44">
                <label className="text-xs text-neutral-400 font-medium block mb-1">Order Side</label>
                <div className="grid grid-cols-2 gap-1 bg-black/50 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSide('BUY')}
                    className={`py-1 text-xs font-bold rounded-lg transition-colors ${side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400'}`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide('SELL')}
                    className={`py-1 text-xs font-bold rounded-lg transition-colors ${side === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-neutral-400'}`}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div className="self-end">
                <button
                  type="submit"
                  disabled={placing}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                    side === 'BUY'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                      : 'bg-red-500 hover:bg-red-400 text-white'
                  } disabled:opacity-50`}
                >
                  {placing ? 'Placing Order...' : `Execute Paper ${side}`}
                </button>
              </div>
            </form>
          </div>

          {/* Active Paper Positions Table */}
          <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity size={18} className="text-cyan-400" />
                Active Paper Positions ({positions.length})
              </h3>
              <span className="text-xs text-neutral-400">Live Excursion Tracking Active</span>
            </div>

            {positions.length === 0 ? (
              <p className="text-xs text-neutral-500">No open simulated positions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400">
                      <th className="py-2.5 px-3">Asset</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Entry Price</th>
                      <th className="py-2.5 px-3">Live Price</th>
                      <th className="py-2.5 px-3">Stop Loss</th>
                      <th className="py-2.5 px-3">Take Profit</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Unrealized P&L</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {positions.map(p => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{p.symbol}</td>
                        <td className={`py-2.5 px-3 font-bold ${p.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>{p.side}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.decisionMode === 'EXPLOITATION' || p.decisionMode === 'EXPLOIT'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {p.decisionMode || 'EXPLORATION'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-300">{p.confidence || 3}/7</td>
                        <td className="py-2.5 px-3 text-white">${p.averageEntry.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-white">${p.currentPrice.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-red-400">${p.stopLoss.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-emerald-400">${p.takeProfit.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-indigo-400">{p.durationMinutes || 0}m</td>
                        <td className={`py-2.5 px-3 font-bold ${p.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {p.unrealizedPnL >= 0 ? '+' : ''}${p.unrealizedPnL.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleClosePosition(p.id)}
                            disabled={closingId === p.id}
                            className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                          >
                            {closingId === p.id ? 'Closing...' : 'Close Position'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Simulated Orders & Historical Outcomes Table */}
          <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-indigo-400" />
              Simulated Orders & Completed Trade Audit Trail
            </h3>
            {orders.length === 0 ? (
              <p className="text-xs text-neutral-500">No simulated orders recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400">
                      <th className="py-2.5 px-3">Asset</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Price</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Fee / Cost</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{o.symbol}</td>
                        <td className={`py-2.5 px-3 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{o.side}</td>
                        <td className="py-2.5 px-3 text-white">${o.price ? o.price.toLocaleString() : o.requestedPrice?.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-neutral-300">{o.quantity}</td>
                        <td className="py-2.5 px-3 text-neutral-400">${(o.fees || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.status === 'FILLED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">{formatDateTime(o.executedAt || o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Trade Detail Audit Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl custom-scrollbar">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Paper Trade Audit Detail</h3>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Outcome Badge & Top Summary */}
            <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5 font-mono">
              <div>
                <span className="text-xs text-neutral-400 block">Trade ID</span>
                <span className="text-xs font-bold text-white">{selectedTrade.tradeId}</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-neutral-400 block">Outcome</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                  selectedTrade.outcome === 'WIN'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : selectedTrade.outcome === 'LOSS'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {selectedTrade.outcome}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-400 block">Realized Net P&L</span>
                <span className={`text-base font-bold ${selectedTrade.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedTrade.realizedPnL >= 0 ? '+' : ''}${selectedTrade.realizedPnL.toFixed(2)} ({selectedTrade.returnPercent?.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Excursions & Duration Grid */}
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
                <span className="text-[11px] text-neutral-400 block">MAE (Max Adverse)</span>
                <span className="text-red-400 font-bold text-sm block mt-0.5">
                  -{selectedTrade.MAE?.maxAdversePercent || 0}%
                </span>
                <span className="text-[10px] text-neutral-500">Low/High: ${selectedTrade.MAE?.maxAdversePrice || '-'}</span>
              </div>
              <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
                <span className="text-[11px] text-neutral-400 block">MFE (Max Favorable)</span>
                <span className="text-emerald-400 font-bold text-sm block mt-0.5">
                  +{selectedTrade.MFE?.maxFavorablePercent || 0}%
                </span>
                <span className="text-[10px] text-neutral-500">Peak: ${selectedTrade.MFE?.maxFavorablePrice || '-'}</span>
              </div>
              <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
                <span className="text-[11px] text-neutral-400 block">Holding Duration</span>
                <span className="text-indigo-400 font-bold text-sm block mt-0.5">
                  {selectedTrade.holdingDurationMinutes || 0} min
                </span>
                <span className="text-[10px] text-neutral-500">Exit: {selectedTrade.exitReason}</span>
              </div>
            </div>

            {/* Entry Decision Snapshot Context */}
            {selectedTrade.entrySnapshot && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Shield size={14} className="text-cyan-400" /> Frozen Entry Decision Snapshot
                </h4>
                <div className="bg-black/30 border border-white/5 p-3.5 rounded-2xl space-y-2 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-neutral-500">Entry Price:</span> ${selectedTrade.entryPrice}</div>
                    <div><span className="text-neutral-500">Exit Price:</span> ${selectedTrade.exitPrice}</div>
                    <div><span className="text-neutral-500">Stop Loss:</span> ${selectedTrade.stopLoss}</div>
                    <div><span className="text-neutral-500">Take Profit:</span> ${selectedTrade.takeProfit}</div>
                    <div><span className="text-neutral-500">Strategy Version:</span> {selectedTrade.strategyVersion}</div>
                    <div><span className="text-neutral-500">Decision Mode:</span> {selectedTrade.decisionMode}</div>
                    <div><span className="text-neutral-500">Confidence Score:</span> {selectedTrade.confidenceScore}/7</div>
                    <div><span className="text-neutral-500">Market Regime:</span> {selectedTrade.entrySnapshot.market?.marketRegime || 'RANGING'}</div>
                  </div>

                  {selectedTrade.entrySnapshot.indicators && (
                    <div className="pt-2 border-t border-white/5">
                      <span className="text-neutral-500 block mb-1">Indicators at Entry:</span>
                      <div className="grid grid-cols-3 gap-1 text-[11px] text-neutral-400">
                        <div>RSI: {selectedTrade.entrySnapshot.indicators.rsi?.toFixed(1) || 'N/A'}</div>
                        <div>EMA20: ${selectedTrade.entrySnapshot.indicators.emaFast?.toFixed(0) || 'N/A'}</div>
                        <div>EMA50: ${selectedTrade.entrySnapshot.indicators.emaSlow?.toFixed(0) || 'N/A'}</div>
                        <div>ATR: ${selectedTrade.entrySnapshot.indicators.atr?.toFixed(1) || 'N/A'}</div>
                        <div>MACD: {selectedTrade.entrySnapshot.indicators.macd?.histogram?.toFixed(1) || 'N/A'}</div>
                        <div>Volatility: {selectedTrade.entrySnapshot.market?.volatility?.toFixed(1) || 'N/A'}</div>
                      </div>
                    </div>
                  )}

                  {selectedTrade.entrySnapshot.decision?.decisionReason && (
                    <div className="pt-2 border-t border-white/5 text-neutral-400">
                      <span className="text-neutral-500 block mb-0.5">Decision Reason:</span>
                      <p className="text-[11px] leading-relaxed">{selectedTrade.entrySnapshot.decision.decisionReason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Learning Event Linkage */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-center justify-between text-xs">
              <span className="text-indigo-300">Phase 3 Learning Event Emitted</span>
              <span className="font-mono text-indigo-200">{selectedTrade.learningEventId || 'STORED_IN_EVENTS'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
