'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import {
  Layers,
  Database,
  Lock,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Wallet,
  CheckCircle2,
  Clock,
  Cpu,
} from 'lucide-react';

export function QueueAndReservationPanel() {
  const {
    queue,
    arrayIndex,
    activeQueueIndex,
    balances,
    activeTransaction,
    drainTemporaryQueue,
    restoreAllNodes,
    healthyNodeCount,
    isSimulating,
  } = useSimulation();

  // Calculate percentages for Sender Balance bar
  const total = balances.senderTotal || 10000;
  const availablePct = Math.max(0, Math.min(100, (balances.senderAvailable / total) * 100));
  const reservedPct = Math.max(0, Math.min(100, (balances.senderReserved / total) * 100));

  const isFinalized = activeTransaction?.applicationState === 'FINALIZED';
  const isQuarantined = activeTransaction?.applicationState === 'QUARANTINED';
  const isPending = activeTransaction && !isFinalized && !isQuarantined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* LEFT: Temporary Transaction Pool + Starvation Prevention & Index Visualizer */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Temporary Queue & Starvation Prevention
              </h3>
              <p className="text-[11px] text-neutral-400">
                Fair Priority Scheduler (Age + Expiry awareness) + Array (O(1) lookup)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
              NO STARVATION
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
              {queue.length} ENQUEUED
            </span>
          </div>
        </div>

        {/* Temporary Pool Card */}
        {queue.length > 0 ? (
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {queue[0].transactionId}
              </span>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
                NOT YET ANCHORED ON BLOCKCHAIN
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-neutral-500 block">Sender</span>
                <span className="text-neutral-300 font-semibold">Demo A</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Recipient</span>
                <span className="text-neutral-300 font-semibold">Demo B</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Amount</span>
                <span className="text-amber-300 font-bold">₹{queue[0].amount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Reservation</span>
                <span className="text-cyan-400 font-semibold">OFF-CHAIN TEMPORARY</span>
              </div>
            </div>

            {/* Starvation Prevention Details */}
            <div className="pt-2 border-t border-amber-500/20 grid grid-cols-4 gap-2 text-[9px] font-mono">
              <div>
                <span className="text-neutral-500 block">Queue Age</span>
                <span className="text-amber-300 font-bold">
                  {Math.max(1, Math.round((Date.now() - new Date(queue[0].enqueuedAt || Date.now()).getTime()) / 1000))}s
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Retry Count</span>
                <span className="text-neutral-300 font-bold">0 / 5</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Priority Score</span>
                <span className="text-emerald-400 font-bold">HIGH (Fair FIFO)</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Next Slot</span>
                <span className="text-cyan-400 font-bold">NEXT ELIGIBLE</span>
              </div>
            </div>

            {/* Action Bar for Queued Transactions */}
            <div className="pt-2.5 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-2 bg-black/40 -mx-3.5 -mb-3.5 p-3 rounded-b-xl">
              <span className="text-[10px] text-amber-200/90 font-mono text-center sm:text-left">
                {healthyNodeCount > 0
                  ? `⚡ Cluster node active. Ready to anchor on-chain.`
                  : `⚠️ All nodes OFFLINE. Turn on a node above or click to restore:`}
              </span>
              <button
                onClick={() => {
                  if (healthyNodeCount === 0) {
                    restoreAllNodes();
                  } else {
                    drainTemporaryQueue();
                  }
                }}
                disabled={isSimulating}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#FEF9C3] via-[#FEEF8B] to-[#F5C542] text-black font-extrabold text-[10px] uppercase font-mono hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(254,239,139,0.3)] cursor-pointer"
              >
                <Sparkles size={12} />
                <span>{healthyNodeCount > 0 ? 'Process & Finalize Now' : 'Restore Nodes & Process Queue'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#09090b] border border-white/5 text-center text-xs text-neutral-500 font-mono">
            Temporary queue is empty. (DB pending transactions are drained with fair starvation prevention when nodes become available).
          </div>
        )}

        {/* Array Visualization */}
        <div className="p-3 rounded-xl bg-[#09090b] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-neutral-400 font-mono">
              Transaction Index / Array
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">
              Array = O(1) Fast Transaction Lookup
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {arrayIndex.length > 0 ? (
              arrayIndex.map((txId, idx) => (
                <div
                  key={txId}
                  className={`px-3 py-1.5 rounded-lg border font-mono text-xs flex items-center gap-2 transition-all ${
                    activeQueueIndex === idx
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold ring-1 ring-amber-500'
                      : 'bg-white/5 border-white/10 text-neutral-300'
                  }`}
                >
                  <span className="text-[10px] text-neutral-500">Index {idx} →</span>
                  <span>{txId}</span>
                  {activeQueueIndex === idx && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200">
                      PROCESSING
                    </span>
                  )}
                </div>
              ))
            ) : (
              <span className="text-[11px] text-neutral-500 font-mono italic">
                Array empty [ ]
              </span>
            )}
          </div>
        </div>

        {/* Linked List Visualization */}
        <div className="p-3 rounded-xl bg-[#09090b] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-neutral-400 font-mono">
              Processing Linked List (FIFO Fair Queue)
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">
              Older DB Pending Transactions Prioritized
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs font-mono">
            <span className="px-2 py-1 rounded bg-white/10 text-[#FEEF8B] font-bold text-[10px]">
              HEAD
            </span>
            <ArrowRight size={14} className="text-neutral-500 flex-shrink-0" />

            {queue.length > 0 ? (
              queue.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <div
                    className={`px-3 py-1.5 rounded-lg border flex-shrink-0 flex items-center gap-1.5 ${
                      idx === 0
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-white/5 border-white/10 text-neutral-300'
                    }`}
                  >
                    <span>[{item.transactionId}]</span>
                  </div>
                  <ArrowRight size={14} className="text-neutral-500 flex-shrink-0" />
                </React.Fragment>
              ))
            ) : (
              <span className="text-neutral-500 text-[11px] px-2 italic">EMPTY</span>
            )}

            <span className="px-2 py-1 rounded bg-white/5 text-neutral-500 font-bold text-[10px]">
              NULL
            </span>
          </div>
        </div>

        <p className="text-[10px] text-neutral-500 italic">
          * Notice: In-memory Array and Linked List are fast processing structures. PostgreSQL durable store is authoritative source of truth.
        </p>
      </div>

      {/* RIGHT: Live Reservation & Balance Visualization */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Wallet Balance & Non-Negative Invariant
              </h3>
              <p className="text-[11px] text-neutral-400">
                Guaranteed double-spend prevention through strict balance reservation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 font-extrabold tracking-wider">
              NEGATIVE: NEVER
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
              INR (₹)
            </span>
          </div>
        </div>

        {/* Sender Balance Breakdown */}
        <div className="p-4 rounded-xl bg-[#09090b] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Sender: Demo Wallet A
            </span>
            <span className="text-xs font-mono font-bold text-white">
              Total: ₹{balances.senderTotal.toLocaleString()}
            </span>
          </div>

          {/* Invariant Header Banner */}
          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div>
              <span className="text-[9px] text-neutral-500 uppercase block">Total</span>
              <span className="font-bold text-white">₹{balances.senderTotal.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[9px] text-emerald-400 uppercase block">Available</span>
              <span className="font-bold text-emerald-400">₹{balances.senderAvailable.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[9px] text-amber-400 uppercase block">Reserved</span>
              <span className="font-bold text-amber-400">₹{balances.senderReserved.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[9px] text-rose-400 uppercase block">Negative State</span>
              <span className="font-bold text-rose-400">NEVER (Strict)</span>
            </div>
          </div>

          {/* Segmented Progress Bar: Available vs Reserved */}
          <div className="space-y-1">
            <div className="h-4 w-full bg-neutral-900 rounded-lg overflow-hidden flex p-0.5 gap-1 border border-white/10">
              <div
                style={{ width: `${availablePct}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-md transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                title={`Available: ₹${balances.senderAvailable.toLocaleString()}`}
              />
              <div
                style={{ width: `${reservedPct}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-md transition-all duration-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                title={`Reserved: ₹${balances.senderReserved.toLocaleString()}`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono pt-1">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-sm bg-emerald-400" />
                <span>Available: ₹{balances.senderAvailable.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-sm bg-amber-400" />
                <span>Reserved: ₹{balances.senderReserved.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recipient Balance Breakdown & Lock State */}
        <div className="p-4 rounded-xl bg-[#09090b] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Recipient: Demo Wallet B
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-400">Recipient Credit:</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold tracking-wider ${
                  isFinalized
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : balances.recipientIncoming > 0
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse'
                    : 'bg-white/5 border border-white/10 text-neutral-400'
                }`}
              >
                {isFinalized ? 'CREDITED' : balances.recipientIncoming > 0 ? 'LOCKED' : 'IDLE'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] text-neutral-400 block">Spendable Balance (Finalized Only)</span>
              <span className="text-sm font-extrabold text-emerald-400 block">
                ₹{balances.recipientConfirmed.toLocaleString()}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] text-neutral-400 block">Incoming Processing (Unspendable)</span>
              <span className="text-sm font-extrabold text-amber-400 block">
                ₹{balances.recipientIncoming.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-neutral-300">
            <span className="text-emerald-400 font-bold">Rule: </span>
            Recipient spendable balance increases <span className="underline font-bold text-white">ONLY AFTER</span> final blockchain verification. During processing, funds remain <span className="text-amber-300 font-bold">LOCKED</span> as unspendable incoming balance.
          </div>
        </div>
      </div>
    </div>
  );
}
