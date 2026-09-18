'use client';

import React, { useState } from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import {
  Play,
  RotateCcw,
  Zap,
  WifiOff,
  Clock,
  ServerCrash,
  FileWarning,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Layers,
  Sparkles,
  ShieldX,
  Activity,
  ArrowRight,
} from 'lucide-react';

export function ScenarioControlBar() {
  const {
    isSimulating,
    currentScenario,
    simulationSpeed,
    setSimulationSpeed,
    runDemoInsufficientFunds,
    runDemoNodeBusy,
    makeNodeBusy,
    runDemo1_NormalPayment,
    runDemo2_BlockchainUnavailable,
    runDemo3_RpcTimeout,
    runDemo4_WorkerCrash,
    runDemo5_DbChainMismatch,
    runDemo6_IntegrityAttack,
    resetSimulation,
    activeFailures,
    toggleFailure,
    clearAllFailures,
    setAllNodesOffline,
    setNodeStatus,
  } = useSimulation();

  return (
    <div className="space-y-4">
      {/* Primary Highlights: Non-Negotiable Invariants */}
      <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FEEF8B]/10 border border-[#FEEF8B]/30 flex items-center justify-center text-[#FEEF8B]">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Key Invariants & Demonstration Scenarios
              </h2>
              <p className="text-xs text-neutral-400">
                Test non-negative funds, busy-node transaction continuation, starvation-free recovery, and quarantine.
              </p>
            </div>
          </div>

          {/* Speed & Reset Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 text-xs font-mono">
              <span className="px-2 text-neutral-400 text-[10px] uppercase font-bold">Speed:</span>
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSimulationSpeed(s)}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    simulationSpeed === s
                      ? 'bg-[#FEEF8B] text-black font-bold shadow-[0_0_10px_rgba(254,239,139,0.5)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              onClick={resetSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold transition-all"
              title="Reset all simulation states back to default"
            >
              <RotateCcw size={14} />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>

        {/* Feature Highlight Cards (Scenario A & C) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Scenario A: Test Insufficient Funds */}
          <button
            onClick={runDemoInsufficientFunds}
            disabled={isSimulating}
            className={`flex flex-col p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
              currentScenario === 'DEMO_INSUFFICIENT_FUNDS'
                ? 'bg-rose-500/20 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.3)] ring-1 ring-rose-500'
                : 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/10'
            } ${isSimulating && currentScenario !== 'DEMO_INSUFFICIENT_FUNDS' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldX size={15} />
                Scenario A — Test Insufficient Funds
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold">
                NON-NEGATIVE GUARANTEE
              </span>
            </div>
            <span className="text-sm font-semibold text-white group-hover:text-rose-200 transition-colors">
              Attempt ₹7,000 with only ₹5,000 Available
            </span>
            <span className="text-xs text-neutral-300 mt-1 leading-relaxed">
              Immediate pre-transaction rejection before financial state mutation. Balance remains ₹5,000. Zero reservation. Zero recipient credit.
            </span>
          </button>

          {/* Scenario C: Busy Node & Continuation */}
          <button
            onClick={runDemoNodeBusy}
            disabled={isSimulating}
            className={`flex flex-col p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
              currentScenario === 'DEMO_NODE_BUSY'
                ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)] ring-1 ring-amber-500'
                : 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/10'
            } ${isSimulating && currentScenario !== 'DEMO_NODE_BUSY' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                <Activity size={15} />
                Scenario C — Busy Node Continuation
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                NODE NEVER DISAPPEARS
              </span>
            </div>
            <span className="text-sm font-semibold text-white group-hover:text-amber-200 transition-colors">
              Node A Busy: TX-001 Continues & TX-002 Routes Elsewhere
            </span>
            <span className="text-xs text-neutral-300 mt-1 leading-relaxed">
              When Node A becomes BUSY, its existing transaction is NOT terminated. New transactions route to Node B or temporary queue.
            </span>
          </button>
        </div>

        {/* Core Scenario Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Demo 1 */}
          <button
            onClick={runDemo1_NormalPayment}
            disabled={isSimulating}
            className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
              currentScenario === 'DEMO_1'
                ? 'bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                : 'bg-white/[0.02] border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5'
            } ${isSimulating && currentScenario !== 'DEMO_1' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Scenario B — Healthy Node Flow
              </span>
              {currentScenario === 'DEMO_1' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
              Send ₹4,000 from ₹10,000
            </span>
            <span className="text-[11px] text-neutral-400 mt-1 leading-snug">
              Validate → On-Chain Reservation (Avail: ₹6,000, Res: ₹4,000) → Verification → Finalize → Recipient Credit.
            </span>
          </button>

          {/* Demo 2 */}
          <button
            onClick={runDemo2_BlockchainUnavailable}
            disabled={isSimulating}
            className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
              currentScenario === 'DEMO_2'
                ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-500'
                : 'bg-white/[0.02] border-white/10 hover:border-amber-500/40 hover:bg-amber-500/5'
            } ${isSimulating && currentScenario !== 'DEMO_2' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                <WifiOff size={13} />
                Scenario D/E — Node Outage & Drain
              </span>
              {currentScenario === 'DEMO_2' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
              All Nodes Offline → Recovery
            </span>
            <span className="text-[11px] text-neutral-400 mt-1 leading-snug">
              Enters TEMP_PENDING with app reservation (NOT YET ANCHORED). Node returns → fair priority drain → finalized.
            </span>
          </button>

          {/* Demo 3 */}
          <button
            onClick={runDemo3_RpcTimeout}
            disabled={isSimulating}
            className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
              currentScenario === 'DEMO_3'
                ? 'bg-yellow-500/15 border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.2)] ring-1 ring-yellow-500'
                : 'bg-white/[0.02] border-white/10 hover:border-yellow-500/40 hover:bg-yellow-500/5'
            } ${isSimulating && currentScenario !== 'DEMO_3' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-wide flex items-center gap-1.5">
                <Clock size={13} />
                Demo 3 — In-Flight RPC Timeout
              </span>
              {currentScenario === 'DEMO_3' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-mono animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-white group-hover:text-yellow-300 transition-colors">
              Timeout After Submission
            </span>
            <span className="text-[11px] text-neutral-400 mt-1 leading-snug">
              Socket hangs up during commit. UNKNOWN state polls contract before retrying. Zero duplicate payments.
            </span>
          </button>

          {/* Demo 4 */}
          <button
            onClick={runDemo4_WorkerCrash}
            disabled={isSimulating}
            className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
              currentScenario === 'DEMO_4'
                ? 'bg-purple-500/15 border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-1 ring-purple-500'
                : 'bg-white/[0.02] border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5'
            } ${isSimulating && currentScenario !== 'DEMO_4' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wide flex items-center gap-1.5">
                <ServerCrash size={13} />
                Demo 4 — Worker Process Crash
              </span>
              {currentScenario === 'DEMO_4' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
              Process Killed Mid-Execution
            </span>
            <span className="text-[11px] text-neutral-400 mt-1 leading-snug">
              RAM wiped. Daemon restarts and reconstructs Array + Linked List queue directly from durable PostgreSQL records.
            </span>
          </button>

          {/* Demo 5 */}
          <button
            onClick={runDemo5_DbChainMismatch}
            disabled={isSimulating}
            className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
              currentScenario === 'DEMO_5'
                ? 'bg-blue-500/15 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.2)] ring-1 ring-blue-500'
                : 'bg-white/[0.02] border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5'
            } ${isSimulating && currentScenario !== 'DEMO_5' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                <FileWarning size={13} />
                Demo 5 — DB/Chain State Mismatch
              </span>
              {currentScenario === 'DEMO_5' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
              Post-Anchor State Reconciliation
            </span>
            <span className="text-[11px] text-neutral-400 mt-1 leading-snug">
              DB is lagging in PROCESSING while chain is FINALIZED. Reconciliation engine detects and synchronizes.
            </span>
          </button>

          {/* Demo 6 */}
          <button
            onClick={runDemo6_IntegrityAttack}
            disabled={isSimulating}
            className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
              currentScenario === 'DEMO_6'
                ? 'bg-rose-500/15 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.2)] ring-1 ring-rose-500'
                : 'bg-white/[0.02] border-white/10 hover:border-rose-500/40 hover:bg-rose-500/5'
            } ${isSimulating && currentScenario !== 'DEMO_6' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldAlert size={13} />
                Scenario F — Integrity Quarantine
              </span>
              {currentScenario === 'DEMO_6' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-white group-hover:text-rose-300 transition-colors">
              Hash Tamper Detection & Quarantine
            </span>
            <span className="text-[11px] text-neutral-400 mt-1 leading-snug">
              Payload tampered in DB → Hash chain verification fails → SECURITY_BREACH → Immediate quarantine; recipient uncredited.
            </span>
          </button>
        </div>
      </div>

      {/* Failure Simulator (Chaos Matrix) */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="text-rose-400" size={18} />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Failure Simulator / Chaos Controls
            </h3>
          </div>
          <button
            onClick={clearAllFailures}
            className="text-[11px] text-neutral-400 hover:text-white underline hover:no-underline"
          >
            Clear All Failures
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Busy Node Toggles */}
          <button
            onClick={() => makeNodeBusy('node-a')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-all"
          >
            Toggle Node A BUSY
          </button>
          <button
            onClick={() => makeNodeBusy('node-b')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-all"
          >
            Toggle Node B BUSY
          </button>

          <button
            onClick={() => setNodeStatus('node-a', 'OFFLINE')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white/5 border-white/10 text-neutral-300 hover:text-rose-300 hover:border-rose-500/30 transition-all"
          >
            Disable Node A
          </button>
          <button
            onClick={() => setNodeStatus('node-b', 'OFFLINE')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white/5 border-white/10 text-neutral-300 hover:text-rose-300 hover:border-rose-500/30 transition-all"
          >
            Disable Node B
          </button>
          <button
            onClick={() => setNodeStatus('node-c', 'OFFLINE')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white/5 border-white/10 text-neutral-300 hover:text-rose-300 hover:border-rose-500/30 transition-all"
          >
            Disable Node C
          </button>
          <button
            onClick={setAllNodesOffline}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20 transition-all shadow-[0_0_12px_rgba(244,63,94,0.15)]"
          >
            Make All Nodes Offline
          </button>

          <button
            onClick={() => toggleFailure('RPC_TIMEOUT')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              activeFailures.has('RPC_TIMEOUT')
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:border-amber-500/30'
            }`}
          >
            Simulate RPC Timeout
          </button>

          <button
            onClick={() => setNodeStatus('node-a', 'STALE')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white/5 border-white/10 text-neutral-300 hover:border-yellow-500/30 hover:text-yellow-300 transition-all"
          >
            Simulate Stale Node
          </button>

          <button
            onClick={() => toggleFailure('DB_RESTART')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              activeFailures.has('DB_RESTART')
                ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:border-purple-500/30'
            }`}
          >
            Simulate DB Restart
          </button>

          <button
            onClick={() => toggleFailure('WORKER_CRASH')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              activeFailures.has('WORKER_CRASH')
                ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:border-purple-500/30'
            }`}
          >
            Simulate Worker Crash
          </button>

          <button
            onClick={() => toggleFailure('BLOCKCHAIN_DELAY')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              activeFailures.has('BLOCKCHAIN_DELAY')
                ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:border-blue-500/30'
            }`}
          >
            Simulate Blockchain Delay
          </button>

          <button
            onClick={() => toggleFailure('CONTRACT_REVERT')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              activeFailures.has('CONTRACT_REVERT')
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:border-rose-500/30'
            }`}
          >
            Simulate Contract Revert
          </button>

          <button
            onClick={() => toggleFailure('INTEGRITY_MISMATCH')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              activeFailures.has('INTEGRITY_MISMATCH')
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:border-rose-500/30'
            }`}
          >
            Simulate Integrity Mismatch
          </button>
        </div>
      </div>
    </div>
  );
}
