'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import { ShieldCheck, Database, Layers, Cpu, RefreshCw, AlertCircle } from 'lucide-react';

export function SimulatorHeader() {
  const { nodes, queue, metrics, isSimulating, activeHealingStep } = useSimulation();

  const healthyCount = nodes.filter((n) => n.status === 'HEALTHY').length;
  const busyCount = nodes.filter((n) => n.status === 'BUSY').length;
  const blockchainStatus =
    healthyCount > 0
      ? 'HEALTHY'
      : busyCount > 0
      ? 'BUSY'
      : nodes.some((n) => n.status === 'DEGRADED')
      ? 'DEGRADED'
      : 'UNAVAILABLE';

  const bcColor =
    blockchainStatus === 'HEALTHY'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : blockchainStatus === 'BUSY' || blockchainStatus === 'DEGRADED'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

  return (
    <div className="space-y-4">
      {/* Simulation Mode Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.15)]">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
          </span>
          <span className="tracking-wide uppercase font-bold">Simulation Mode Active</span>
          <span className="text-amber-200/80 font-normal hidden md:inline">— No real blockchain funds or private keys are used. Safe for classroom demonstration.</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-amber-400 font-mono bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/20">
          <span>ISOLATED TESTBED</span>
          <span>•</span>
          <span>HARDHAT / POA DEMO</span>
        </div>
      </div>

      {/* Main Title & System Status Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF9C3] via-[#FEEF8B] to-[#F5C542] flex items-center justify-center p-2 shadow-[0_0_20px_rgba(254,239,139,0.3)]">
              <Cpu className="text-black" size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                SECURECHAIN <span className="text-[#FEEF8B]">PAY</span>
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-neutral-300">
                Adaptive Transaction Architecture Simulator
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-2 max-w-xl">
            "Blockchain-anchored hybrid payment continuity and self-healing"
          </p>
        </div>

        {/* System Status Display */}
        <div className="bg-[#0f0f11] border border-white/10 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-wrap items-center gap-3 sm:gap-6">
          <div className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 pr-2 border-r border-white/10 hidden sm:block">
            System Status
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-neutral-400">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 font-medium">Blockchain</div>
              <div className={`text-xs font-bold px-2 py-0.5 rounded border ${bcColor}`}>
                {blockchainStatus}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-neutral-400">
              <Database size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 font-medium">Database</div>
              <div className="text-xs font-bold px-2 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                HEALTHY
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-neutral-400">
              <Layers size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 font-medium">Queue</div>
              <div className="text-xs font-bold text-white font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10">
                {queue.length} items
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-neutral-400">
              <Cpu size={16} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 font-medium">Workers</div>
              <div className="text-xs font-bold text-cyan-400 font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                2 ACTIVE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-neutral-400">
              <RefreshCw size={16} className={isSimulating && activeHealingStep !== 'IDLE' ? 'animate-spin text-amber-400' : ''} />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 font-medium">Recovery</div>
              <div className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                {activeHealingStep !== 'IDLE' ? activeHealingStep : 'READY'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
