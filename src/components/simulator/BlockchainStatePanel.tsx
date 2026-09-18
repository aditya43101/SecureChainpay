'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import { Database, Link, CheckCircle2, Clock, ShieldCheck, ExternalLink, Hash } from 'lucide-react';

export function BlockchainStatePanel() {
  const { activeTransaction, transactions, setSelectedTransaction } = useSimulation();

  return (
    <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Database size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Simulated Blockchain Explorer State
            </h3>
            <p className="text-[11px] text-neutral-400">
              EVM Smart Contract Storage (<span className="font-mono text-cyan-400">SecureChainPayment.sol</span>)
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-300">
          Chain ID: <span className="text-[#FEEF8B] font-bold">31337 (Local EVM)</span>
        </span>
      </div>

      {/* Main Active Transaction Explorer View */}
      {activeTransaction ? (
        <div className="p-4 rounded-xl bg-[#09090b] border border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white font-mono">
                {activeTransaction.id}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                  activeTransaction.blockchainState === 'FINALIZED'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : activeTransaction.blockchainState === 'FUNDS_RESERVED'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : activeTransaction.blockchainState === 'DISCREPANCY'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                {activeTransaction.blockchainState}
              </span>
            </div>

            <button
              onClick={() => setSelectedTransaction(activeTransaction)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono hover:underline"
            >
              <span>Inspect Full Lifecycle</span>
              <ExternalLink size={12} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Sender (EVM)</span>
              <span className="text-white font-semibold truncate block" title={activeTransaction.sender}>
                {activeTransaction.sender.split(' ')[0]}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Recipient (EVM)</span>
              <span className="text-white font-semibold truncate block" title={activeTransaction.recipient}>
                {activeTransaction.recipient.split(' ')[0]}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Settled Amount</span>
              <span className="text-[#FEEF8B] font-bold block">
                {activeTransaction.amount} {activeTransaction.asset}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Block & Confirmations</span>
              <span className="text-cyan-400 font-bold block">
                {activeTransaction.blockNumber ? `#${activeTransaction.blockNumber} (${activeTransaction.confirmations} conf)` : 'Unconfirmed'}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 truncate">
              <Hash size={14} className="text-neutral-500 flex-shrink-0" />
              <span className="text-neutral-400 text-[11px]">Tx Hash:</span>
              <span className="text-emerald-300 font-bold truncate">
                {activeTransaction.blockchainTxHash || 'NOT_YET_SUBMITTED_TO_MEMPOOL'}
              </span>
            </div>

            <div className="flex items-center gap-2 truncate flex-shrink-0">
              <span className="text-neutral-400 text-[11px]">Integrity Commitment:</span>
              <span className="text-neutral-300 truncate max-w-[150px]" title={activeTransaction.integrityHash}>
                {activeTransaction.integrityHash.substring(0, 18)}...
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-[#09090b] border border-white/5 text-center text-xs text-neutral-500 font-mono">
          No active transaction selected. Click one of the Demo buttons above or send a payment to inspect on-chain state.
        </div>
      )}

      {/* Recent Simulated Transactions History */}
      {transactions.length > 1 && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="text-[10px] uppercase font-bold text-neutral-400 font-mono">
            Recent Simulation Ledgers:
          </div>
          <div className="flex flex-wrap gap-2">
            {transactions.slice(1, 5).map((tx) => (
              <button
                key={tx.id}
                onClick={() => setSelectedTransaction(tx)}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-neutral-300 flex items-center gap-2 transition-all"
              >
                <span>{tx.id}</span>
                <span className="text-neutral-500">•</span>
                <span className="text-[#FEEF8B]">{tx.amount} ETH</span>
                <span className="text-neutral-500">•</span>
                <span className={tx.blockchainState === 'FINALIZED' ? 'text-emerald-400' : 'text-amber-400'}>
                  {tx.blockchainState}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
