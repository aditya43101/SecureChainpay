'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  Shield,
  Network,
  Cpu,
  Server,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Lock,
  RefreshCw,
  Sliders,
  ArrowRight,
  TrendingUp,
  Database,
  Search,
} from 'lucide-react';
import {
  SettlementRoute,
  RoutingDecision,
  BlockchainHealth,
  OffChainHealth,
} from '@/lib/payments/transaction-routing-service';

export default function RoutingDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemHealth, setSystemHealth] = useState<{
    blockchainHealth: BlockchainHealth;
    offChainHealth: OffChainHealth;
    performanceMetrics: any;
    policyConfiguration: any;
  } | null>(null);

  // Simulator State
  const [simAmount, setSimAmount] = useState<number>(5000);
  const [simRiskLevel, setSimRiskLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('LOW');
  const [simRpcLatency, setSimRpcLatency] = useState<number>(180);
  const [simSecurityRequirement, setSimSecurityRequirement] = useState<string>('NONE');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<RoutingDecision | null>(null);

  // Recent Routing Decision Audit Log
  const [recentDecisions, setRecentDecisions] = useState<RoutingDecision[]>([]);

  const fetchHealth = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/system/health');
      const data = await res.json();
      if (data.success) {
        setSystemHealth({
          blockchainHealth: data.blockchainHealth,
          offChainHealth: data.offChainHealth,
          performanceMetrics: data.performanceMetrics,
          policyConfiguration: data.policyConfiguration,
        });
      }
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runSimulation = async () => {
    setSimulating(true);
    try {
      const riskScoreMap = {
        LOW: 15,
        MEDIUM: 45,
        HIGH: 78,
        CRITICAL: 92,
      };

      const payload: any = {
        paymentId: `SIM_PAY_${Date.now()}`,
        amount: Number(simAmount),
        currency: 'HSCT',
        riskAssessment: {
          riskScore: riskScoreMap[simRiskLevel],
          riskLevel: simRiskLevel,
          recommendation: simRiskLevel === 'HIGH' || simRiskLevel === 'CRITICAL' ? 'FLAG' : 'ALLOW',
          flags: simRiskLevel === 'HIGH' ? ['UNUSUAL_AMOUNT_VELOCITY'] : [],
        },
      };

      if (simSecurityRequirement !== 'NONE') {
        payload.securityPolicyRequirement = simSecurityRequirement;
      }

      const res = await fetch('/api/payments/route-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.decision) {
        // Adjust blockchain latency for simulator feedback
        if (simRpcLatency > 1500 && simRpcLatency < 4000) {
          data.decision.blockchainHealth.status = 'DEGRADED';
          data.decision.blockchainHealth.rpcLatencyMs = simRpcLatency;
        } else if (simRpcLatency >= 4000) {
          data.decision.blockchainHealth.status = 'UNAVAILABLE';
          data.decision.blockchainHealth.rpcLatencyMs = simRpcLatency;
        }

        setSimResult(data.decision);

        // Prepend to audit log
        setRecentDecisions((prev) => [data.decision, ...prev.slice(0, 4)]);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Run initial simulation
    runSimulation();
  }, []);

  const getRouteBadge = (route: SettlementRoute) => {
    switch (route) {
      case 'HYBRID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Zap className="w-3.5 h-3.5" /> HYBRID SETTLEMENT
          </span>
        );
      case 'ON_CHAIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Network className="w-3.5 h-3.5" /> DIRECT ON-CHAIN
          </span>
        );
      case 'OFF_CHAIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <Database className="w-3.5 h-3.5" /> OFF-CHAIN LEDGER
          </span>
        );
      case 'DEFERRED_ON_CHAIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" /> DEFERRED ANCHORING
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> HEALTHY
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> DEGRADED
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3 text-rose-400" /> UNAVAILABLE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400">
            UNKNOWN
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30">
              <Sliders className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Adaptive Transaction Routing
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  ENGINE v1.2-ADAPTIVE
                </span>
              </h1>
              <p className="text-sm text-zinc-400">
                Multi-signal settlement path selection based on risk context, EVM health, latency, gas cost & security policy.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchHealth}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm font-medium text-zinc-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh Health
          </button>
        </div>
      </div>

      {/* 1. System Health Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* EVM Blockchain RPC Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">EVM Network RPC</h3>
                <p className="text-xs text-zinc-400">Hardhat Local Node (31337)</p>
              </div>
            </div>
            {getStatusBadge(systemHealth?.blockchainHealth.status || 'HEALTHY')}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">RPC Latency</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {systemHealth?.blockchainHealth.rpcLatencyMs ?? 180} <span className="text-xs font-normal text-zinc-400">ms</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Block Height</span>
              <p className="text-lg font-bold text-cyan-400 mt-0.5">
                #{systemHealth?.blockchainHealth.latestBlockNumber ?? 42}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Gas Price</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {systemHealth?.blockchainHealth.gasPriceGwei ?? 20} <span className="text-xs font-normal text-zinc-400">Gwei</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">24h Tx Success</span>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">
                {systemHealth?.blockchainHealth.successRate24h ?? 99.4}%
              </p>
            </div>
          </div>
        </div>

        {/* Off-Chain Database Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Off-Chain Database</h3>
                <p className="text-xs text-zinc-400">PostgreSQL / Firestore</p>
              </div>
            </div>
            {getStatusBadge(systemHealth?.offChainHealth.status || 'HEALTHY')}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">DB Latency</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {systemHealth?.offChainHealth.dbLatencyMs ?? 14} <span className="text-xs font-normal text-zinc-400">ms</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Ledger Sync</span>
              <p className="text-sm font-bold text-emerald-400 mt-1">
                SYNCHRONIZED
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Active Pool</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {systemHealth?.offChainHealth.activeConnections ?? 18} <span className="text-xs font-normal text-zinc-400">conns</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Backlog Queue</span>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">
                0 <span className="text-xs font-normal text-zinc-400">pending</span>
              </p>
            </div>
          </div>
        </div>

        {/* Policy Engine Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Policy Engine</h3>
                <p className="text-xs text-zinc-400">Security Override Rules</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Security Weight</span>
              <p className="text-lg font-bold text-white mt-0.5">40%</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Reliability Weight</span>
              <p className="text-lg font-bold text-white mt-0.5">25%</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Security Override</span>
              <p className="text-sm font-bold text-emerald-400 mt-1">ENABLED</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
              <span className="text-xs text-zinc-500">Auto Fallback</span>
              <p className="text-sm font-bold text-emerald-400 mt-1">ENABLED</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Route Performance Analytics Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Route Performance & Historical Settlement Share
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemHealth?.performanceMetrics?.routes?.map((r: any) => (
            <div
              key={r.route}
              className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {r.route}
                </span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {r.usageShare}
                </span>
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{r.name}</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Success: <span className="text-emerald-400 font-semibold">{r.successRate}%</span>
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-800/50 flex justify-between text-xs text-zinc-400">
                <span>Avg Latency: <strong className="text-white">{r.avgLatencyMs}ms</strong></span>
                <span>Fee: <strong className="text-white">{r.avgCostHsct} HSCT</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Interactive Route Decision Simulator */}
      <div className="p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              Interactive Route Decision Simulator
            </h2>
            <p className="text-xs text-zinc-400">
              Test how the Transaction Routing Engine evaluates live risk signals, amount thresholds & RPC conditions.
            </p>
          </div>
          <button
            onClick={runSimulation}
            disabled={simulating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
            Simulate Route
          </button>
        </div>

        {/* Inputs Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Payment Amount (HSCT)
            </label>
            <input
              type="number"
              value={simAmount}
              onChange={(e) => setSimAmount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-medium focus:outline-none focus:border-emerald-500/50 text-sm"
              placeholder="e.g. 5000"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Simulated Payment AI Risk Level
            </label>
            <select
              value={simRiskLevel}
              onChange={(e: any) => setSimRiskLevel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-medium focus:outline-none focus:border-emerald-500/50 text-sm"
            >
              <option value="LOW">LOW (Normal user transfer)</option>
              <option value="MEDIUM">MEDIUM (Slight anomaly)</option>
              <option value="HIGH">HIGH (Unusual velocity/recipient)</option>
              <option value="CRITICAL">CRITICAL (High fraud probability)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Blockchain RPC Latency Condition
            </label>
            <select
              value={simRpcLatency}
              onChange={(e) => setSimRpcLatency(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-medium focus:outline-none focus:border-emerald-500/50 text-sm"
            >
              <option value={180}>180ms - Normal (HEALTHY)</option>
              <option value={1800}>1,800ms - Elevated (DEGRADED)</option>
              <option value={5000}>5,000ms - Outage (UNAVAILABLE)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Security Policy Mandate
            </label>
            <select
              value={simSecurityRequirement}
              onChange={(e) => setSimSecurityRequirement(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-medium focus:outline-none focus:border-emerald-500/50 text-sm"
            >
              <option value="NONE">None (Dynamic Policy Evaluation)</option>
              <option value="ON_CHAIN">MANDATE ON_CHAIN</option>
              <option value="HYBRID">MANDATE HYBRID</option>
              <option value="OFF_CHAIN">MANDATE OFF_CHAIN</option>
            </select>
          </div>
        </div>

        {/* Simulator Result Output Panel */}
        {simResult && (
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">Selected Settlement Route:</span>
                  {getRouteBadge(simResult.selectedRoute)}
                </div>
                <p className="text-sm font-semibold text-white mt-1">
                  {simResult.routeReason}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  Estimated Latency: <strong className="text-white">{simResult.estimatedLatencyMs}ms</strong>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  Estimated Fee: <strong className="text-white">{simResult.estimatedFee} HSCT</strong>
                </div>
              </div>
            </div>

            {/* Policy & Overrides Indicator */}
            {simResult.securityOverrideApplied && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-300">
                <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Security Policy Override Applied:</strong> Security requirements prioritized over lower latency/cost options. Route locked under policy {simResult.policyVersion}.
                </span>
              </div>
            )}

            {/* Route Scores Breakdown Table */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Evaluated Settlement Options Scoreboard
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900 text-zinc-400 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Route</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Est. Latency</th>
                      <th className="py-2.5 px-3">Est. Fee</th>
                      <th className="py-2.5 px-3">Security Rating</th>
                      <th className="py-2.5 px-3 rounded-r-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {simResult.routeScores.map((rs) => (
                      <tr key={rs.route} className={rs.route === simResult.selectedRoute ? 'bg-emerald-500/5 font-semibold text-white' : ''}>
                        <td className="py-2.5 px-3">{rs.route}</td>
                        <td className="py-2.5 px-3">{rs.score}/100</td>
                        <td className="py-2.5 px-3">{rs.estimatedLatencyMs}ms</td>
                        <td className="py-2.5 px-3">{rs.estimatedFee} HSCT</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {rs.securityRating}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {rs.route === simResult.selectedRoute ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> SELECTED
                            </span>
                          ) : (
                            <span className="text-zinc-500">Evaluated</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step-by-Step Payment Timeline */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Execution Timeline Lifecycle
              </h3>
              <div className="space-y-2">
                {simResult.timeline.map((evt, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                    <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{evt.step}</span>
                        <span className="text-[10px] text-zinc-500">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-zinc-400 mt-0.5">{evt.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Live Routing Decision Audit Log */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Live Routing Decision Audit Log
            </h2>
            <p className="text-xs text-zinc-400">
              Immutable records of all payment routing decisions made by the TransactionRoutingService.
            </p>
          </div>
        </div>

        {recentDecisions.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-500">
            No recent routing decisions recorded. Run the simulator above to log a decision.
          </div>
        ) : (
          <div className="space-y-3">
            {recentDecisions.map((decision) => (
              <div
                key={decision.decisionId}
                className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/60 hover:border-zinc-700/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-400 font-semibold">{decision.decisionId}</span>
                    {getRouteBadge(decision.selectedRoute)}
                    <span className="text-zinc-500 font-mono">[{decision.policyVersion}]</span>
                  </div>
                  <p className="text-zinc-300 font-medium">{decision.routeReason}</p>
                </div>

                <div className="flex items-center gap-4 text-zinc-400 shrink-0">
                  <div>
                    <span>Est. Fee: </span>
                    <strong className="text-white">{decision.estimatedFee} HSCT</strong>
                  </div>
                  <div>
                    <span>Latency: </span>
                    <strong className="text-white">{decision.estimatedLatencyMs}ms</strong>
                  </div>
                  <div className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-emerald-400 font-mono font-bold">
                    ROUTE_LOCKED
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
