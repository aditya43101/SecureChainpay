'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import { ArchitectureStep } from '@/lib/simulation/simulation-types';
import {
  User,
  ShieldCheck,
  Sliders,
  Activity,
  Link,
  Layers,
  Clock,
  Cpu,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowDown,
  Anchor,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export function MainArchitectureGraph() {
  const { activeArchitectureStep, routingDecision, healthyNodeCount, activeTransaction } = useSimulation();

  const isStepActive = (step: ArchitectureStep) => activeArchitectureStep === step;

  const getNodeClass = (step: ArchitectureStep, colorClass: string = 'emerald') => {
    const active = isStepActive(step);
    if (active) {
      return `border-${colorClass}-400 bg-${colorClass}-500/20 text-white shadow-[0_0_25px_rgba(254,239,139,0.3)] ring-2 ring-${colorClass}-400 scale-[1.03] transition-all duration-300`;
    }
    return `border-white/10 bg-[#121214] text-neutral-300 hover:border-white/20 transition-all`;
  };

  return (
    <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders size={16} className="text-[#FEEF8B]" />
            Core Architecture & Adaptive Pipeline Flow
          </h3>
          <p className="text-xs text-neutral-400">
            Interactive transaction pipeline with visual pre-anchor & post-anchor boundary
          </p>
        </div>

        {activeTransaction && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
            <span className="text-neutral-400">Active Tx:</span>
            <span className="text-[#FEEF8B] font-bold">{activeTransaction.id}</span>
            <span className="text-neutral-500">•</span>
            <span className="text-cyan-400">{activeArchitectureStep}</span>
          </div>
        )}
      </div>

      {/* Flow Diagram Container */}
      <div className="relative">
        {/* Top Common Ingress: User -> Security -> Router -> Node Health */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 max-w-4xl mx-auto mb-6">
          {/* USER */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${getNodeClass(
              'USER',
              'emerald'
            )}`}
          >
            <div className="p-2 rounded-lg bg-white/5 text-[#FEEF8B]">
              <User size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Client Layer</div>
              <div className="text-xs font-bold">1. User Intent</div>
            </div>
          </div>

          {/* PAYMENT SECURITY */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${getNodeClass(
              'SECURITY',
              'emerald'
            )}`}
          >
            <div className="p-2 rounded-lg bg-white/5 text-emerald-400">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Anti-Replay</div>
              <div className="text-xs font-bold">2. Payment Security</div>
            </div>
          </div>

          {/* ROUTING ENGINE */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${getNodeClass(
              'ROUTER',
              'emerald'
            )}`}
          >
            <div className="p-2 rounded-lg bg-white/5 text-cyan-400">
              <Sliders size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Decision Unit</div>
              <div className="text-xs font-bold">3. Routing Engine</div>
            </div>
          </div>

          {/* NODE HEALTH ENGINE */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${getNodeClass(
              'NODE_HEALTH',
              'emerald'
            )}`}
          >
            <div className="p-2 rounded-lg bg-white/5 text-amber-400">
              <Activity size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Consensus</div>
              <div className="text-xs font-bold">4. Node Health Check</div>
            </div>
          </div>
        </div>

        {/* Branching Divider / Boundary Indicators */}
        <div className="relative border-t border-b border-white/10 py-6 my-4 bg-black/40 rounded-2xl">
          {/* Vertical Blockchain Anchor Marker */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 border-r border-dashed border-cyan-500/40 hidden md:block" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold uppercase hidden md:flex items-center gap-1 z-10">
            <Anchor size={12} />
            Blockchain Anchor Boundary
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT COLUMN: ON-CHAIN PATH (POST-ANCHOR) */}
            <div className="space-y-3 p-3 sm:p-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Healthy Branch: On-Chain Path
                </span>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  POST-ANCHOR
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Direct EVM broadcast when healthy RPC consensus exists.
              </p>

              <div className="space-y-2 pt-2">
                {/* 5A: Blockchain Init */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between ${getNodeClass(
                    'BLOCKCHAIN_INIT',
                    'emerald'
                  )}`}
                >
                  <div className="flex items-center gap-2">
                    <Link size={15} className="text-emerald-400" />
                    <span className="text-xs font-semibold">5a. Blockchain Initialization</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">Mempool Deposit</span>
                </div>

                {/* 6A: Funds Reserved */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between ${getNodeClass(
                    'FUNDS_RESERVED',
                    'emerald'
                  )}`}
                >
                  <div className="flex items-center gap-2">
                    <Lock size={15} className="text-emerald-400" />
                    <span className="text-xs font-semibold">6a. Sender Funds Reserved</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">Recipient Uncredited</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: TEMPORARY OFF-CHAIN PATH (PRE-ANCHOR) */}
            <div className="space-y-3 p-3 sm:p-4 rounded-xl bg-amber-500/[0.03] border border-amber-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Unavailable Branch: Temporary Path
                </span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  PRE-ANCHOR
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Guaranteed continuity via durable temporary pool when RPCs are offline.
              </p>

              <div className="space-y-2 pt-2">
                {/* 5B: Temp Tx Creation */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between ${getNodeClass(
                    'TEMP_TX',
                    'amber'
                  )}`}
                >
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-amber-400" />
                    <span className="text-xs font-semibold">5b. Temporary Pool Enqueue</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400">Array + Linked List</span>
                </div>

                {/* 6B: Off-Chain Reserve */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between ${getNodeClass(
                    'OFFCHAIN_RESERVE',
                    'amber'
                  )}`}
                >
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-amber-400" />
                    <span className="text-xs font-semibold">6b. Off-Chain Ledger Reservation</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">15m TTL Lock</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Converging Settlement Pipeline: Processing -> Final Validation -> Finalize / Quarantine */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 max-w-4xl mx-auto mt-6">
          {/* PROCESSING */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${getNodeClass(
              'PROCESSING',
              'blue'
            )}`}
          >
            <div className="p-2 rounded-lg bg-white/5 text-blue-400">
              <Cpu size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Worker Execution</div>
              <div className="text-xs font-bold">7. Processing</div>
            </div>
          </div>

          {/* FINAL VALIDATION */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${getNodeClass(
              'FINAL_VALIDATION',
              'cyan'
            )}`}
          >
            <div className="p-2 rounded-lg bg-white/5 text-cyan-400">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Invariant Check</div>
              <div className="text-xs font-bold">8. Final Validation</div>
            </div>
          </div>

          {/* FINALIZE */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${getNodeClass(
              'FINALIZE',
              'emerald'
            )}`}
          >
            <div className="p-2 rounded-lg bg-white/5 text-emerald-400">
              <Lock size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">On-Chain Anchor</div>
              <div className="text-xs font-bold">9. Finalization</div>
            </div>
          </div>

          {/* RECIPIENT CREDIT */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${getNodeClass(
              'RECIPIENT_CREDIT',
              'emerald'
            )}`}
          >
            <div className="p-2 rounded-lg bg-white/5 text-[#FEEF8B]">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Spendable Funds</div>
              <div className="text-xs font-bold">10. Recipient Credit</div>
            </div>
          </div>
        </div>

        {/* Alternate Quarantine Outcome Node */}
        {isStepActive('QUARANTINE') && (
          <div className="mt-4 p-3 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-300 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} />
              <span className="text-xs font-bold uppercase">
                Integrity Quarantine Activated — Recipient Transfer Aborted
              </span>
            </div>
            <span className="text-[10px] font-mono bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 font-bold">
              OFF-CHAIN HASH MISMATCH
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
