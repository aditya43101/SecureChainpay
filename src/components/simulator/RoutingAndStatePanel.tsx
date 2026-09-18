'use client';

import React, { useState } from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import {
  Sliders,
  Send,
  RotateCcw,
  Fingerprint,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  KeyRound,
  FileKey,
} from 'lucide-react';

export function RoutingAndStatePanel() {
  const {
    routingDecision,
    healthyNodeCount,
    sendCustomTransaction,
    resetSimulation,
    isSimulating,
    activeTransaction,
    setSelectedTransaction,
  } = useSimulation();

  const [amount, setAmount] = useState<number>(50);
  const [expiry, setExpiry] = useState<number>(10);

  const handleSend = () => {
    sendCustomTransaction(amount, expiry);
  };

  const isFinalized = activeTransaction?.applicationState === 'FINALIZED';
  const isQuarantined = activeTransaction?.applicationState === 'QUARANTINED';
  const isFundsReserved = activeTransaction && activeTransaction.applicationState !== 'CREATED' && !isFinalized && !isQuarantined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* LEFT: Transaction Creation & Identity Card */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FEEF8B]/10 border border-[#FEEF8B]/30 flex items-center justify-center text-[#FEEF8B]">
              <Send size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Create Demo Transaction
              </h3>
              <p className="text-[11px] text-neutral-400">Initiate payment & inspect persistent cryptographic identity</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#FEEF8B]">
            DEMO WALLETS
          </span>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
              Sender Wallet
            </label>
            <input
              type="text"
              readOnly
              value="0xDEMO...A01 (Demo Wallet A)"
              className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-neutral-300 font-mono text-[11px] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
              Recipient Wallet
            </label>
            <input
              type="text"
              readOnly
              value="0xDEMO...B02 (Demo Wallet B)"
              className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-neutral-300 font-mono text-[11px] focus:outline-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-bold text-neutral-400 block">
                Amount (₹ INR)
              </label>
              <div className="flex items-center gap-1">
                {[50, 500, 4000, 7000].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    disabled={isSimulating}
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded border transition-all ${
                      amount === p
                        ? 'bg-[#FEEF8B]/20 border-[#FEEF8B] text-[#FEEF8B] font-bold'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    ₹{p}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min="1"
              max="100000"
              step="1"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
              disabled={isSimulating}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-[#FEEF8B]/50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
              Reservation TTL (Minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={expiry}
              onChange={(e) => setExpiry(Number(e.target.value))}
              disabled={isSimulating}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-[#FEEF8B]/50"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSend}
            disabled={isSimulating}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isSimulating
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                : 'bg-gradient-to-r from-[#FEF9C3] via-[#FEEF8B] to-[#F5C542] text-black hover:opacity-95 shadow-[0_0_20px_rgba(254,239,139,0.3)] cursor-pointer'
            }`}
          >
            <Send size={14} />
            <span>Send ₹{amount.toLocaleString()}</span>
          </button>

          <button
            onClick={resetSimulation}
            className="py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-all"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>

        {/* Live Identity & Status Banner (Section 42 Compliant) */}
        <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1.5 font-mono">
              <Fingerprint size={13} className="text-[#FEEF8B]" />
              Transaction Status & Identity
            </span>
            <div className="flex items-center gap-1.5">
              {isFundsReserved && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  FUNDS LOCKED
                </span>
              )}
              {isFinalized && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  FINALIZED
                </span>
              )}
              {isQuarantined && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  SECURITY BREACH
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 block text-[9px]">Transaction ID</span>
              <span className="text-[#FEEF8B] font-bold truncate block" title={activeTransaction?.id || 'Pending creation'}>
                {activeTransaction?.id || 'SC-DEMO-000001'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 block text-[9px]">State</span>
              <span className={`font-bold truncate block ${isFinalized ? 'text-emerald-400' : isQuarantined ? 'text-rose-400' : 'text-amber-400'}`}>
                {activeTransaction?.applicationState || 'IDLE'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 block text-[9px]">Blockchain</span>
              <span className="text-cyan-400 font-bold truncate block">
                {activeTransaction?.blockchainState || 'NOT_ANCHORED'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 block text-[9px]">Recipient Credit</span>
              <span className={`font-bold truncate block ${isFinalized ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isFinalized ? 'CREDITED' : 'LOCKED'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Routing Engine & Dual State Distinction */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Routing Engine & State Machine
              </h3>
              <p className="text-[11px] text-neutral-400">Dynamic route arbitration & authoritative state comparison</p>
            </div>
          </div>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
              routingDecision.route === 'ON_CHAIN'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            {routingDecision.route.replace('_', ' ')}
          </span>
        </div>

        {/* Routing Evaluation Inputs & Decision */}
        <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/10 space-y-2.5">
          <div className="text-[10px] uppercase font-bold text-neutral-400">
            Routing Engine Inputs Evaluated:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
            <div className="p-1.5 rounded bg-white/5">
              <span className="text-neutral-500 block">Amount</span>
              <span className="text-white font-bold">₹{amount.toLocaleString()}</span>
            </div>
            <div className="p-1.5 rounded bg-white/5">
              <span className="text-neutral-500 block">Risk Level</span>
              <span className="text-emerald-400 font-bold">LOW (15/100)</span>
            </div>
            <div className="p-1.5 rounded bg-white/5">
              <span className="text-neutral-500 block">Healthy Nodes</span>
              <span className={healthyNodeCount > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {healthyNodeCount} / 3 Online
              </span>
            </div>
            <div className="p-1.5 rounded bg-white/5">
              <span className="text-neutral-500 block">Policy</span>
              <span className="text-[#FEEF8B] font-bold">ADAPTIVE v1.2</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
              Arbitration Rationale:
            </span>
            <p className="text-xs text-cyan-300 font-medium font-mono">
              "{routingDecision.reason}"
            </p>
          </div>
        </div>

        {/* Section 15: Dual State Distinction Card */}
        <div className="p-3.5 rounded-xl bg-[#0f1118] border border-blue-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-blue-400" />
              State Separation: Application vs Blockchain
            </span>
            <span className="text-[10px] font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              DUAL RECONCILIATION
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {/* Column 1: Application State */}
            <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                Application State
              </span>
              <span className="text-sm font-extrabold text-[#FEEF8B] block">
                {activeTransaction?.applicationState || 'READY'}
              </span>
              <span className="text-[10px] text-neutral-500 block leading-tight">
                Off-chain orchestrator state machine
              </span>
            </div>

            {/* Column 2: Blockchain State */}
            <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                Blockchain State
              </span>
              <span className="text-sm font-extrabold text-emerald-400 block">
                {activeTransaction?.blockchainState || 'NOT_ANCHORED'}
              </span>
              <span className="text-[10px] text-neutral-500 block leading-tight">
                Authoritative on-chain smart contract state
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-[11px] text-neutral-300 leading-snug">
            <span className="text-blue-300 font-bold">Key Architectural Principle: </span>
            "Application processing may continue after the blockchain reservation. Final credit occurs only after blockchain finalization."
          </div>
        </div>
      </div>
    </div>
  );
}
