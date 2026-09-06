'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Play, TrendingUp, ShieldAlert, Award, Activity, RefreshCw, BarChart2 } from 'lucide-react';

export default function BacktestingPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [strategy, setStrategy] = useState('HYBRID');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/backtest/history');
      if (res.ok) {
        const data = await res.json();
        if (data.success) setHistory(data.history);
      }
    } catch (e) {
      console.error("Failed to load backtest history:", e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRunBacktest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe,
          strategyName: strategy,
          initialCapital,
          feeRate: 0.00075,
          slippageRate: 0.0005,
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Backtest failed: ${err.error || 'Unknown error'}`);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setResult(data.summary);
        fetchHistory();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to run backtest simulation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col pl-[280px] overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* Configuration Banner */}
          <div className="bg-neutral-900/80 border border-white/5 p-6 rounded-3xl backdrop-blur-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart2 size={20} className="text-emerald-400" />
                  Historical Simulation Engine
                </h2>
                <p className="text-xs text-neutral-400">Replay historical market data chronologically with zero look-ahead bias and simulated fees/slippage.</p>
              </div>
              <button
                onClick={handleRunBacktest}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-sm rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                {loading ? 'Simulating...' : 'Run Backtest'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
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

              <div>
                <label className="text-xs text-neutral-400 font-medium block mb-1">Timeframe</label>
                <select
                  value={timeframe}
                  onChange={e => setTimeframe(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                  <option value="1d">1d</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-medium block mb-1">Strategy</label>
                <select
                  value={strategy}
                  onChange={e => setStrategy(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="HYBRID">Hybrid (Multi-Factor + ML)</option>
                  <option value="EMA_TREND">EMA Trend Strategy</option>
                  <option value="RSI">RSI Momentum</option>
                  <option value="MACD">MACD Crossover</option>
                  <option value="BREAKOUT">Swing Breakout</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-medium block mb-1">Initial Capital ($)</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={e => setInitialCapital(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Results Summary Dashboard */}
          {result && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs text-neutral-400 block mb-1">Net Return</span>
                  <span className={`text-lg font-bold font-mono ${result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn}%
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-1">vs Buy&Hold: {result.benchmarkReturn}%</span>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs text-neutral-400 block mb-1">Max Drawdown</span>
                  <span className="text-lg font-bold font-mono text-red-400">
                    -{result.maxDrawdown}%
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs text-neutral-400 block mb-1">Win Rate</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {result.winRate}%
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-1">{result.winningTrades}W / {result.losingTrades}L</span>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs text-neutral-400 block mb-1">Profit Factor</span>
                  <span className="text-lg font-bold font-mono text-cyan-400">
                    {result.profitFactor}
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs text-neutral-400 block mb-1">Sharpe Ratio</span>
                  <span className="text-lg font-bold font-mono text-indigo-400">
                    {result.sharpeRatio}
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs text-neutral-400 block mb-1">Total Fees & Slip</span>
                  <span className="text-lg font-bold font-mono text-amber-400">
                    ${(result.totalFees + result.totalSlippage).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Trade Log Table */}
              <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl">
                <h3 className="text-base font-bold text-white mb-4">Executed Trades ({result.trades.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Side</th>
                        <th className="py-2.5 px-3">Entry Price</th>
                        <th className="py-2.5 px-3">Exit Price</th>
                        <th className="py-2.5 px-3">Net PnL</th>
                        <th className="py-2.5 px-3">Return %</th>
                        <th className="py-2.5 px-3">Exit Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {result.trades.map((t: any) => (
                        <tr key={t.tradeNumber} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 text-neutral-400">{t.tradeNumber}</td>
                          <td className={`py-2.5 px-3 font-bold ${t.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</td>
                          <td className="py-2.5 px-3 text-white">${t.entryPrice.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-white">${t.exitPrice.toLocaleString()}</td>
                          <td className={`py-2.5 px-3 font-bold ${t.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {t.netPnL >= 0 ? '+' : ''}${t.netPnL}
                          </td>
                          <td className={`py-2.5 px-3 font-bold ${t.returnPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {t.returnPercentage}%
                          </td>
                          <td className="py-2.5 px-3 text-neutral-300">{t.exitReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Past History */}
          <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl">
            <h3 className="text-base font-bold text-white mb-4">Recent Backtest Runs</h3>
            {history.length === 0 ? (
              <p className="text-xs text-neutral-500">No previous backtest runs recorded.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((h: any) => (
                  <div key={h.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{h.symbol} ({h.timeframe})</span>
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${h.totalReturn >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {h.totalReturn >= 0 ? '+' : ''}{h.totalReturn}%
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 flex justify-between font-mono">
                      <span>Strategy: {h.strategy}</span>
                      <span>Win Rate: {h.winRate}%</span>
                    </div>
                    <div className="text-[11px] text-neutral-500 flex justify-between font-mono">
                      <span>Trades: {h.totalTrades}</span>
                      <span>Sharpe: {h.sharpeRatio}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
