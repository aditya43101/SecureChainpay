'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Brain, Award, AlertTriangle, ShieldCheck, Play, RefreshCw, Layers, Activity } from 'lucide-react';

export default function AILearningPage() {
  const [summary, setSummary] = useState<any>(null);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchLearningData = async () => {
    try {
      // 1. Summary
      const resSum = await fetch('/api/learning/summary');
      if (resSum.ok) {
        const data = await resSum.json();
        if (data.success) setSummary(data.data);
      }

      // 2. Patterns
      const resPat = await fetch('/api/learning/patterns');
      if (resPat.ok) {
        const data = await resPat.json();
        if (data.success) setPatterns(data.patterns);
      }

      // 3. Events
      const resEvt = await fetch('/api/learning/events');
      if (resEvt.ok) {
        const data = await resEvt.json();
        if (data.success) setEvents(data.events);
      }
    } catch (e) {
      console.error("Failed to load learning dashboard data:", e);
    } fontFinally: {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningData();
    setLoading(false);
  }, []);

  const handleTriggerLearning = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/learning/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Learning run failed: ${data.error || 'Unknown error'}`);
        return;
      }

      alert(`Batch Learning Completed!\nPatterns Discovered: ${data.patternsDiscovered}\nResult: ${data.evaluationResult?.reason || 'No candidate Challenger created.'}`);
      fetchLearningData();
    } catch (err) {
      console.error(err);
      alert('Failed to execute batch learning run.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col pl-[280px] overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* Header Banner */}
          <div className="bg-neutral-900/80 border border-white/5 p-6 rounded-3xl backdrop-blur-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Brain size={22} className="text-emerald-400" />
                AI Learning & Continuous Improvement
              </h2>
              <p className="text-xs text-neutral-400">Trade outcome attribution, loss pattern mining, and Champion / Challenger strategy versioning.</p>
            </div>

            <button
              onClick={handleTriggerLearning}
              disabled={running}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-sm rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
            >
              {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? 'Evaluating Feedback...' : 'Run Batch Learning'}
            </button>
          </div>

          {/* Overview KPI Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-neutral-900/80 border border-white/5 p-4 rounded-2xl">
                <span className="text-xs text-neutral-400 block mb-1">Trades Analyzed</span>
                <span className="text-2xl font-bold font-mono text-white">{summary.totalAttributions}</span>
                <span className="text-[11px] text-neutral-500 block mt-1">{summary.totalWins}W / {summary.totalLosses}L</span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-4 rounded-2xl">
                <span className="text-xs text-neutral-400 block mb-1">Validated Patterns</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">{summary.validatedPatterns}</span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-4 rounded-2xl">
                <span className="text-xs text-neutral-400 block mb-1">Champion Version</span>
                <span className="text-lg font-bold font-mono text-cyan-400">{summary.championStrategy?.versionName}</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">Active Production</span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-4 rounded-2xl">
                <span className="text-xs text-neutral-400 block mb-1">Champion Return</span>
                <span className="text-lg font-bold font-mono text-emerald-400">+{summary.championStrategy?.totalReturn}%</span>
                <span className="text-[10px] text-red-400 block mt-0.5">-{summary.championStrategy?.maxDrawdown}% Max DD</span>
              </div>

              <div className="bg-neutral-900/80 border border-white/5 p-4 rounded-2xl">
                <span className="text-xs text-neutral-400 block mb-1">Learning Events</span>
                <span className="text-2xl font-bold font-mono text-indigo-400">{summary.learningEventsCount}</span>
              </div>
            </div>
          )}

          {/* Discovered Patterns Grid */}
          <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers size={18} className="text-emerald-400" />
              Discovered Trade Feedback Memory ({patterns.length})
            </h3>

            {patterns.length === 0 ? (
              <p className="text-xs text-neutral-500">No feedback patterns stored yet. Execute trades or run backtests to mine patterns.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patterns.map(p => (
                  <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{p.symbol} ({p.strategy})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        p.type === 'FAILURE_PATTERN' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {p.type}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed">{p.observation}</p>

                    <div className="flex justify-between items-center text-[11px] text-neutral-400 font-mono pt-1 border-t border-white/5">
                      <span>Evidence: {p.evidenceCount} trades</span>
                      <span>Win Rate: {p.winRate}%</span>
                      <span>Confidence: {(p.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Champion / Challenger Versions */}
          {summary?.latestStrategies && (
            <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award size={18} className="text-yellow-400" />
                Strategy Version Registry (Champion vs Challenger)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400">
                      <th className="py-2.5 px-3">Version</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Total Return</th>
                      <th className="py-2.5 px-3">Max Drawdown</th>
                      <th className="py-2.5 px-3">Win Rate</th>
                      <th className="py-2.5 px-3">Profit Factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {summary.latestStrategies.map((s: any) => (
                      <tr key={s.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{s.versionName}</td>
                        <td className="py-2.5 px-3">
                          {s.isChampion ? (
                            <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-md font-bold text-[10px]">CHAMPION</span>
                          ) : s.isChallenger ? (
                            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-md font-bold text-[10px]">CHALLENGER</span>
                          ) : (
                            <span className="text-neutral-500 text-[10px]">ARCHIVED</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400">+{s.totalReturn}%</td>
                        <td className="py-2.5 px-3 text-red-400">-{s.maxDrawdown}%</td>
                        <td className="py-2.5 px-3 text-white">{s.winRate}%</td>
                        <td className="py-2.5 px-3 text-cyan-400">{s.profitFactor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Learning Events Audit Log */}
          <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-6 backdrop-blur-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              Learning Audit Log
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-neutral-500">No learning events recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {events.map(e => (
                  <div key={e.id} className="bg-white/5 border border-white/10 p-3.5 rounded-2xl flex items-start gap-3">
                    <ShieldCheck size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{e.title}</h4>
                        <span className="text-[10px] text-neutral-500">{new Date(e.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-neutral-300 mt-1">{e.description}</p>
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
