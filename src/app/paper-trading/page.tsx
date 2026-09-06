'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ShieldAlert, TrendingUp, DollarSign, RotateCcw, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatDateTime } from '@/lib/timezone-service';

export default function PaperTradingPage() {
  const [account, setAccount] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    } catch (e) {
      console.error("Failed to load paper trading data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaperData();
    const interval = setInterval(fetchPaperData, 10000); // refresh every 10s
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

      alert(data.result.message);
      fetchPaperData();
    } catch (err) {
      console.error(err);
      alert('Failed to place paper order.');
    } finally {
      setPlacing(false);
    }
  };

  const handleResetAccount = async () => {
    if (!confirm('Are you sure you want to reset your simulated paper account back to $100,000?')) return;
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
    <div className="flex h-screen bg-[#0a0a0c] text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col pl-[280px] overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* Safety Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-amber-400 flex-shrink-0" size={24} />
              <div>
                <h4 className="text-sm font-bold text-amber-300">SIMULATED FUNDS ONLY</h4>
                <p className="text-xs text-amber-200/80">This paper trading environment operates on live market rates using virtual capital. No real funds or exchange orders are placed.</p>
              </div>
            </div>
            <button
              onClick={handleResetAccount}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl text-neutral-200 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={14} /> Reset Account
            </button>
          </div>

          {/* Virtual Account Balance Overview */}
          {account && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-900/80 border border-white/5 p-5 rounded-2xl backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium block mb-1">Simulated Equity</span>
                <span className="text-2xl font-bold font-mono text-white">${account.equity.toLocaleString()}</span>
                <span className={`text-xs font-mono font-bold block mt-1 ${account.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {account.totalReturn >= 0 ? '+' : ''}{account.totalReturn}% total return
                </span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-5 rounded-2xl backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium block mb-1">Simulated Cash</span>
                <span className="text-2xl font-bold font-mono text-cyan-400">${account.cashBalance.toLocaleString()}</span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-5 rounded-2xl backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium block mb-1">Unrealized P&L</span>
                <span className={`text-2xl font-bold font-mono ${account.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {account.unrealizedPnL >= 0 ? '+' : ''}${account.unrealizedPnL}
                </span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-5 rounded-2xl backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium block mb-1">Realized P&L</span>
                <span className={`text-2xl font-bold font-mono ${account.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {account.realizedPnL >= 0 ? '+' : ''}${account.realizedPnL}
                </span>
              </div>
            </div>
          )}

          {/* Quick Trade Order Form */}
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

          {/* Active Positions Table */}
          <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl">
            <h3 className="text-base font-bold text-white mb-4">Active Paper Positions ({positions.length})</h3>
            {positions.length === 0 ? (
              <p className="text-xs text-neutral-500">No open simulated positions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400">
                      <th className="py-2.5 px-3">Asset</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Entry Price</th>
                      <th className="py-2.5 px-3">Live Price</th>
                      <th className="py-2.5 px-3">Stop Loss</th>
                      <th className="py-2.5 px-3">Take Profit</th>
                      <th className="py-2.5 px-3">Unrealized P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {positions.map(p => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{p.symbol}</td>
                        <td className={`py-2.5 px-3 font-bold ${p.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>{p.side}</td>
                        <td className="py-2.5 px-3 text-neutral-300">{p.quantity}</td>
                        <td className="py-2.5 px-3 text-white">${p.averageEntry.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-white">${p.currentPrice.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-red-400">${p.stopLoss.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-emerald-400">${p.takeProfit.toLocaleString()}</td>
                        <td className={`py-2.5 px-3 font-bold ${p.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {p.unrealizedPnL >= 0 ? '+' : ''}${p.unrealizedPnL.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paper Orders History */}
          <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl">
            <h3 className="text-base font-bold text-white mb-4">Simulated Orders History</h3>
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
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{o.symbol}</td>
                        <td className={`py-2.5 px-3 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{o.side}</td>
                        <td className="py-2.5 px-3 text-white">${o.price.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-neutral-300">{o.quantity}</td>
                        <td className="py-2.5 px-3 text-emerald-400">{o.status}</td>
                        <td className="py-2.5 px-3 text-neutral-500">{formatDateTime(o.executedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
