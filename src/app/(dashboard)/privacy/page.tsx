'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, Eye, EyeOff, Activity, AlertTriangle,
  Lock, Cpu, Database, FileText, RefreshCw, CheckCircle2, XCircle,
  TrendingUp, Users, Zap, Search, BarChart3, Bot, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type TabId = 'overview' | 'access' | 'ai-security' | 'policies' | 'incidents' | 'controls';

export default function PrivacyCenterPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [securityEvents, setSecurityEvents] = useState<any>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simParams, setSimParams] = useState({ amount: 5000, riskScore: 30, velocity10m: 1, isNewRecipient: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [ovRes, secRes] = await Promise.all([
        fetch('/api/privacy/overview').then(r => r.json()).catch(() => null),
        fetch('/api/privacy/security-events').then(r => r.json()).catch(() => null),
      ]);
      setOverview(ovRes);
      setSecurityEvents(secRes);
    } catch {}
    setLoading(false);
  }

  async function runSimulation() {
    setSimLoading(true);
    try {
      const res = await fetch('/api/admin/policies/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simParams),
      });
      setSimResult(await res.json());
    } catch {}
    setSimLoading(false);
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Shield size={16} /> },
    { id: 'access', label: 'Data Access', icon: <Eye size={16} /> },
    { id: 'ai-security', label: 'AI Security', icon: <Bot size={16} /> },
    { id: 'policies', label: 'Policy Decisions', icon: <FileText size={16} /> },
    { id: 'incidents', label: 'Incidents', icon: <AlertTriangle size={16} /> },
    { id: 'controls', label: 'User Controls', icon: <Lock size={16} /> },
  ];

  const score = overview?.privacyPostureScore ?? 0;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400';
  const scoreGlow = score >= 80 ? 'shadow-emerald-500/20' : score >= 50 ? 'shadow-amber-500/20' : 'shadow-rose-500/20';

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 rounded-xl border border-violet-500/20">
              <Shield className="text-violet-400" size={24} />
            </div>
            Privacy & Security Center
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Privacy-preserving intelligence, policy compliance & data access governance</p>
        </div>
        <Button onClick={loadData} variant="outline" className="border-white/10 text-neutral-300 gap-2 hover:bg-white/5">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-neutral-950/60 border border-white/5 rounded-2xl p-1.5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20' : 'text-neutral-500 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW TAB ─── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Privacy Posture Score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`col-span-1 bg-neutral-950/60 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg ${scoreGlow}`}>
              <span className="text-neutral-500 text-xs uppercase tracking-widest mb-3">Privacy Posture Score</span>
              <div className={`text-6xl font-black ${scoreColor} tabular-nums`}>{score}</div>
              <span className={`text-sm font-semibold mt-2 ${scoreColor}`}>
                {score >= 80 ? 'Strong' : score >= 50 ? 'Moderate' : 'Needs Attention'}
              </span>
            </div>

            {/* Dimensions */}
            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Data Minimization', value: overview?.dimensions?.dataMinimization || 'LOADING', icon: <EyeOff size={18} /> },
                { label: 'AI Secret Protection', value: overview?.dimensions?.aiSecretProtection || 'LOADING', icon: <Lock size={18} /> },
                { label: 'Cross-User Isolation', value: overview?.dimensions?.crossUserIsolation || 'LOADING', icon: <Users size={18} /> },
              ].map((d, i) => (
                <div key={i} className="bg-neutral-950/60 border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="text-neutral-500">{d.icon}</div>
                  <span className="text-xs text-neutral-500 uppercase tracking-wider">{d.label}</span>
                  <span className={`text-lg font-bold ${d.value === 'STRONG' || d.value === 'ENFORCED' ? 'text-emerald-400' : d.value === 'MODERATE' ? 'text-amber-400' : 'text-rose-400'}`}>
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Aggregated Analytics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Payments', value: overview?.aggregatedAnalytics?.totalPayments ?? '—', icon: <Zap size={16} className="text-cyan-400" /> },
              { label: 'Success Rate', value: overview?.aggregatedAnalytics?.successRate ?? '—', icon: <CheckCircle2 size={16} className="text-emerald-400" /> },
              { label: 'AI Requests', value: overview?.aiSecurity?.totalAIRequests ?? '—', icon: <Bot size={16} className="text-violet-400" /> },
              { label: 'Secrets Blocked', value: overview?.aiSecurity?.secretsBlocked ?? 0, icon: <ShieldAlert size={16} className="text-rose-400" /> },
            ].map((s, i) => (
              <div key={i} className="bg-neutral-950/60 border border-white/5 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">{s.icon}<span className="text-xs text-neutral-500 uppercase">{s.label}</span></div>
                <div className="text-2xl font-bold text-white">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Policy Decisions Summary */}
          <div className="bg-neutral-950/60 border border-white/5 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Policy Decision Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Allowed', count: overview?.policyDecisions?.allowed ?? 0, color: 'text-emerald-400 bg-emerald-500/10' },
                { label: 'Reviews', count: overview?.policyDecisions?.reviews ?? 0, color: 'text-amber-400 bg-amber-500/10' },
                { label: 'Blocked', count: overview?.policyDecisions?.blocked ?? 0, color: 'text-rose-400 bg-rose-500/10' },
                { label: 'Block Rate', count: (overview?.policyDecisions?.blockRate ?? '0') + '%', color: 'text-neutral-300 bg-white/5' },
              ].map((d, i) => (
                <div key={i} className={`rounded-xl p-4 ${d.color} border border-white/5`}>
                  <span className="text-xs opacity-70 uppercase">{d.label}</span>
                  <div className="text-2xl font-black mt-1">{d.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── DATA ACCESS TAB ─── */}
      {activeTab === 'access' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <h3 className="text-lg font-bold text-white">Data Access Log</h3>
          <p className="text-sm text-neutral-500">Denied access attempts and authorization events.</p>
          <div className="bg-neutral-950/60 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5 text-neutral-500 text-xs uppercase">
                <th className="text-left p-4">Actor</th><th className="text-left p-4">Resource</th><th className="text-left p-4">Action</th><th className="text-left p-4">Result</th><th className="text-left p-4">Time</th>
              </tr></thead>
              <tbody>
                {(securityEvents?.deniedAccesses || []).length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-neutral-600">No denied access events. System is operating normally.</td></tr>
                ) : (securityEvents.deniedAccesses.map((e: any, i: number) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 font-mono text-xs text-neutral-300">{e.actorId?.substring(0, 12)}...</td>
                    <td className="p-4 text-neutral-400">{e.resourceType}</td>
                    <td className="p-4 text-neutral-400">{e.action}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-rose-500/10 text-rose-400 text-xs rounded-full font-medium">{e.authorizationResult}</span></td>
                    <td className="p-4 text-neutral-500 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── AI SECURITY TAB ─── */}
      {activeTab === 'ai-security' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <h3 className="text-lg font-bold text-white">AI Security Audit</h3>
          <p className="text-sm text-neutral-500">Blocked AI requests — raw prompts are never stored.</p>
          <div className="bg-neutral-950/60 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5 text-neutral-500 text-xs uppercase">
                <th className="text-left p-4">Purpose</th><th className="text-left p-4">Model</th><th className="text-left p-4">Classification</th><th className="text-left p-4">Result</th><th className="text-left p-4">Reason</th><th className="text-left p-4">Time</th>
              </tr></thead>
              <tbody>
                {(securityEvents?.blockedAIRequests || []).length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-neutral-600">No blocked AI requests. AI Data Guard is active.</td></tr>
                ) : (securityEvents.blockedAIRequests.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 text-neutral-300">{r.purpose}</td>
                    <td className="p-4 font-mono text-xs text-neutral-400">{r.model}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full">{r.dataClassification}</span></td>
                    <td className="p-4"><span className="px-2 py-1 bg-rose-500/10 text-rose-400 text-xs rounded-full font-medium">{r.resultType}</span></td>
                    <td className="p-4 text-neutral-500 text-xs">{r.blockReason || '—'}</td>
                    <td className="p-4 text-neutral-500 text-xs">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── POLICIES TAB ─── */}
      {activeTab === 'policies' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <h3 className="text-lg font-bold text-white">Policy Simulation</h3>
          <p className="text-sm text-neutral-500">Test policy rules against mock payments without affecting real traffic.</p>

          <div className="bg-neutral-950/60 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Amount (HSCT)</label>
                <input type="number" value={simParams.amount} onChange={e => setSimParams(p => ({ ...p, amount: Number(e.target.value) }))}
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Risk Score (0-100)</label>
                <input type="number" value={simParams.riskScore} onChange={e => setSimParams(p => ({ ...p, riskScore: Number(e.target.value) }))}
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Velocity (10m)</label>
                <input type="number" value={simParams.velocity10m} onChange={e => setSimParams(p => ({ ...p, velocity10m: Number(e.target.value) }))}
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
                  <input type="checkbox" checked={simParams.isNewRecipient} onChange={e => setSimParams(p => ({ ...p, isNewRecipient: e.target.checked }))}
                    className="accent-violet-500" />
                  New Recipient
                </label>
              </div>
            </div>
            <Button onClick={runSimulation} disabled={simLoading} className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
              {simLoading ? <RefreshCw size={14} className="animate-spin" /> : <Cpu size={14} />} Run Simulation
            </Button>

            {simResult && (
              <div className="mt-4 p-5 bg-neutral-900 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 uppercase">Decision:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    simResult.result.decision === 'ALLOW' ? 'bg-emerald-500/10 text-emerald-400' :
                    simResult.result.decision === 'BLOCK' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>{simResult.result.decision}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {Object.entries(simResult.result.risks as Record<string, string>).map(([k, v]) => (
                    <div key={k} className="p-3 bg-neutral-950 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block mb-1">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className={`font-bold ${v === 'LOW' ? 'text-emerald-400' : v === 'MEDIUM' ? 'text-amber-400' : v === 'HIGH' ? 'text-orange-400' : 'text-rose-400'}`}>{v}</span>
                    </div>
                  ))}
                </div>
                {(simResult.result.reasons || []).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-neutral-500 uppercase">Reasons:</span>
                    {simResult.result.reasons.map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span className="text-neutral-300">{r.message}</span>
                        <span className="px-1.5 py-0.5 bg-white/5 rounded text-neutral-500">{r.code}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-neutral-600 pt-2 border-t border-white/5">
                  Policy: {simResult.result.policyId} {simResult.result.policyVersion}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── INCIDENTS TAB ─── */}
      {activeTab === 'incidents' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <h3 className="text-lg font-bold text-white">Privacy Incidents</h3>
          <div className="bg-neutral-950/60 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5 text-neutral-500 text-xs uppercase">
                <th className="text-left p-4">Type</th><th className="text-left p-4">Severity</th><th className="text-left p-4">Description</th><th className="text-left p-4">Status</th><th className="text-left p-4">Time</th>
              </tr></thead>
              <tbody>
                {(securityEvents?.incidents || []).length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-neutral-600">No privacy incidents detected. System is secure.</td></tr>
                ) : (securityEvents.incidents.map((inc: any, i: number) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 font-mono text-xs text-violet-300">{inc.incidentType}</td>
                    <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      inc.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400' :
                      inc.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>{inc.severity}</span></td>
                    <td className="p-4 text-neutral-400 max-w-xs truncate">{inc.description}</td>
                    <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${inc.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{inc.status}</span></td>
                    <td className="p-4 text-neutral-500 text-xs">{new Date(inc.createdAt).toLocaleString()}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── USER CONTROLS TAB ─── */}
      {activeTab === 'controls' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <h3 className="text-lg font-bold text-white">Your Privacy Controls</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'Payment Data', desc: 'View what payment data is stored for your account.', icon: <Database size={20} />, action: 'View Data' },
              { title: 'AI Processing', desc: 'See how AI models process your payment information.', icon: <Bot size={20} />, action: 'View AI Usage' },
              { title: 'Security Events', desc: 'View security events associated with your account.', icon: <ShieldAlert size={20} />, action: 'View Events' },
              { title: 'Export Data', desc: 'Export your available account and payment data.', icon: <FileText size={20} />, action: 'Export' },
            ].map((c, i) => (
              <div key={i} className="bg-neutral-950/60 border border-white/5 rounded-2xl p-6 flex items-start gap-4">
                <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 shrink-0">{c.icon}</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white">{c.title}</h4>
                  <p className="text-sm text-neutral-500 mt-1">{c.desc}</p>
                  <Button variant="outline" className="mt-3 text-xs border-white/10 text-neutral-400 hover:text-white">{c.action}</Button>
                </div>
              </div>
            ))}
          </div>

          {/* Data Retention Info */}
          <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl p-6 space-y-3">
            <h4 className="font-semibold text-violet-300 flex items-center gap-2"><Lock size={16} /> Data Retention Policy</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between p-3 bg-neutral-900/40 rounded-lg"><span className="text-neutral-400">Operational Telemetry</span><span className="text-neutral-300 font-mono">30 days</span></div>
              <div className="flex justify-between p-3 bg-neutral-900/40 rounded-lg"><span className="text-neutral-400">Aggregated Analytics</span><span className="text-neutral-300 font-mono">1 year</span></div>
              <div className="flex justify-between p-3 bg-neutral-900/40 rounded-lg"><span className="text-neutral-400">Payment Integrity Evidence</span><span className="text-neutral-300 font-mono">Protected</span></div>
              <div className="flex justify-between p-3 bg-neutral-900/40 rounded-lg"><span className="text-neutral-400">Security Audit Evidence</span><span className="text-neutral-300 font-mono">Protected</span></div>
            </div>
            <p className="text-xs text-neutral-600">Payment integrity and security audit records are retained for verification purposes and cannot be individually deleted.</p>
          </div>
        </div>
      )}
    </div>
  );
}
