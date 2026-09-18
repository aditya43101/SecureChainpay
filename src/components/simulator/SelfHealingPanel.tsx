'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import { HealingStep } from '@/lib/simulation/simulation-types';
import { RefreshCw, CheckCircle2, ShieldCheck, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

export function SelfHealingPanel() {
  const { activeHealingStep, isSimulating } = useSimulation();

  const steps: { key: HealingStep; label: string; desc: string }[] = [
    { key: 'MONITOR', label: 'Monitor', desc: 'Heartbeat telemetry' },
    { key: 'DETECT', label: 'Detect', desc: 'Anomaly / RPC gap' },
    { key: 'CLASSIFY', label: 'Classify', desc: 'Timeout vs Revert' },
    { key: 'VERIFY', label: 'Verify', desc: 'Storage scan' },
    { key: 'RECOVER', label: 'Recover', desc: 'State promotion' },
    { key: 'RECHECK', label: 'Recheck', desc: 'TTL & Invariants' },
    { key: 'RECONCILE', label: 'Reconcile', desc: 'Sync audit ledger' },
    { key: 'RESUME', label: 'Resume', desc: 'Clear settlement' },
  ];

  return (
    <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <RefreshCw size={15} className={activeHealingStep !== 'IDLE' ? 'animate-spin' : ''} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Self-Healing Engine (State-Aware Recovery Pipeline)
            </h3>
            <p className="text-[11px] text-neutral-400">
              Autonomous remediation without blind replay or double-spending
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
            NEVER BLIND RETRY
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-300">
            Stage: <span className="text-amber-400 font-bold">{activeHealingStep}</span>
          </span>
        </div>
      </div>

      {/* 8-Step Pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {steps.map((step, idx) => {
          const isActive = activeHealingStep === step.key;
          return (
            <div
              key={step.key}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                isActive
                  ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-2 ring-amber-400 scale-[1.04]'
                  : 'bg-[#09090b] border-white/5 text-neutral-400'
              }`}
            >
              <div className="text-[9px] font-mono uppercase font-bold text-neutral-500 mb-0.5">
                Step 0{idx + 1}
              </div>
              <div className={`text-xs font-bold ${isActive ? 'text-amber-300' : 'text-white'}`}>
                {step.label}
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 truncate" title={step.desc}>
                {step.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Core Architectural Invariant Callout */}
      <div className="p-3 rounded-xl bg-[#09090b] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-neutral-300">
          <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0" />
          <span>
            <strong className="text-white font-semibold">Self-Healing Protocol Rule: </strong>
            In case of node disruption or timeout, the engine inspects the cryptographic storage mapping (<code className="text-cyan-300 font-mono text-[11px]">payments[txId]</code>) to verify existing commitments before undertaking state transitions.
          </span>
        </div>
        <div className="text-[10px] font-mono text-neutral-400 whitespace-nowrap bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
          FAILURE → DETECT → VERIFY → RESUME
        </div>
      </div>
    </div>
  );
}
