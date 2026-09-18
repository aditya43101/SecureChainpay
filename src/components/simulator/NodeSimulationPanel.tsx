'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import { NodeStatus } from '@/lib/simulation/simulation-types';
import { Server, Activity, Check, X, ShieldAlert, Wifi, Clock, Cpu } from 'lucide-react';

export function NodeSimulationPanel() {
  const { nodes, setNodeStatus } = useSimulation();

  const statusOptions: NodeStatus[] = [
    'HEALTHY',
    'BUSY',
    'DEGRADED',
    'STALE',
    'UNAVAILABLE_FOR_NEW_TX',
    'OFFLINE',
    'RPC_TIMEOUT',
  ];

  const getStatusBadge = (status: NodeStatus) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'BUSY':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse';
      case 'UNAVAILABLE_FOR_NEW_TX':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 'DEGRADED':
        return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
      case 'STALE':
        return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
      case 'OFFLINE':
        return 'bg-neutral-800 text-neutral-400 border-neutral-700';
      case 'RPC_TIMEOUT':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  return (
    <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-5">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Server size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Blockchain Node Cluster & Health Engine
            </h3>
            <p className="text-xs text-neutral-400">
              Busy node continuity, failover routing & telemetry probing (Nodes never disappear when busy)
            </p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-300">
          Available for New Tx: <span className="text-emerald-400 font-bold">{nodes.filter((n) => n.status === 'HEALTHY' && n.acceptsNewTransactions).length} / {nodes.length}</span>
        </div>
      </div>

      {/* Interactive Node Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`rounded-xl border p-4 transition-all ${
              node.status === 'HEALTHY'
                ? 'bg-[#0f1411] border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                : node.status === 'BUSY'
                ? 'bg-[#18140c] border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                : node.status === 'DEGRADED' || node.status === 'UNAVAILABLE_FOR_NEW_TX'
                ? 'bg-[#14120e] border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                : node.status === 'STALE'
                ? 'bg-[#14130d] border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.08)]'
                : 'bg-[#121214] border-white/10 opacity-80'
            }`}
          >
            {/* Top Node Title & Status Badge */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="text-xs font-extrabold text-white">{node.name}</div>
                <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[170px]" title={node.providerUrl}>
                  {node.providerUrl}
                </div>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${getStatusBadge(node.status)}`}>
                {node.status}
              </span>
            </div>

            {/* Busy Node Semantics Banner (Rule #9 & #10) */}
            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 mb-3 space-y-1 text-[10px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Accept New Tx:</span>
                <span className={node.acceptsNewTransactions ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {node.acceptsNewTransactions ? 'YES' : 'NO (ROUTED ELSEWHERE)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Existing Tx Processing:</span>
                <span className={node.isProcessingExisting ? 'text-amber-400 font-bold' : 'text-neutral-500'}>
                  {node.isProcessingExisting ? 'YES (CONTINUES)' : 'IDLE'}
                </span>
              </div>
              {node.currentTransactionId && (
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-neutral-400">Assigned Tx:</span>
                  <span className="text-[#FEEF8B] font-bold">{node.currentTransactionId}</span>
                </div>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 py-2 border-y border-white/5 text-[11px] font-mono mb-3">
              <div>
                <span className="text-neutral-500 text-[10px] block">Latency</span>
                <span className={node.latencyMs > 400 ? 'text-amber-400 font-bold' : node.latencyMs === 0 ? 'text-neutral-500' : 'text-emerald-400 font-bold'}>
                  {node.latencyMs > 0 && node.latencyMs < 9999 ? `${node.latencyMs}ms` : 'TIMEOUT'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] block">Latest Block</span>
                <span className="text-white font-bold">
                  {node.status === 'OFFLINE' ? '—' : `#${node.latestBlockNumber}`}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] block">Health Score</span>
                <span className={node.healthScore > 80 ? 'text-emerald-400' : node.healthScore > 40 ? 'text-amber-400' : 'text-rose-400'}>
                  {node.healthScore}/100
                </span>
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] block">Bytecode</span>
                <span className={node.hasContractCode ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                  {node.hasContractCode ? 'VERIFIED' : 'NONE'}
                </span>
              </div>
            </div>

            {/* Quick Status Override Selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-neutral-500 font-mono block">Override State:</span>
              <div className="flex flex-wrap gap-1">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => setNodeStatus(node.id, status)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all ${
                      node.status === status
                        ? 'bg-white/20 text-white font-bold ring-1 ring-white/40'
                        : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {status === 'UNAVAILABLE_FOR_NEW_TX' ? 'NO_NEW' : status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
