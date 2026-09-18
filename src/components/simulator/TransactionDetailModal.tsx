'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import { X, Fingerprint, Hash, Clock, ShieldCheck, Database, Layers, CheckCircle2 } from 'lucide-react';

export function TransactionDetailModal() {
  const { selectedTransaction, setSelectedTransaction } = useSimulation();

  if (!selectedTransaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0c0c0e] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-[#09090b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FEEF8B]/10 border border-[#FEEF8B]/30 flex items-center justify-center text-[#FEEF8B]">
              <Fingerprint size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white font-mono flex items-center gap-2">
                {selectedTransaction.id}
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-white/10 text-emerald-400 border border-white/10">
                  {selectedTransaction.applicationState}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">Transaction Lifecycle Audit & Metadata</p>
            </div>
          </div>

          <button
            onClick={() => setSelectedTransaction(null)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {/* Core Metadata Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Idempotency Key</span>
              <span className="text-cyan-300 font-semibold truncate block" title={selectedTransaction.idempotencyKey}>
                {selectedTransaction.idempotencyKey}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Reservation ID</span>
              <span className="text-emerald-400 font-semibold truncate block" title={selectedTransaction.reservationId}>
                {selectedTransaction.reservationId}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Sender</span>
              <span className="text-white font-semibold truncate block" title={selectedTransaction.sender}>
                {selectedTransaction.sender}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Recipient</span>
              <span className="text-white font-semibold truncate block" title={selectedTransaction.recipient}>
                {selectedTransaction.recipient}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Settlement Amount</span>
              <span className="text-[#FEEF8B] font-bold block">
                {selectedTransaction.amount} {selectedTransaction.asset}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Settlement Route</span>
              <span className="text-white font-bold block">
                {selectedTransaction.route}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Blockchain State</span>
              <span className="text-emerald-400 font-bold block">
                {selectedTransaction.blockchainState}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-neutral-500 text-[10px] block">Block & Confirmations</span>
              <span className="text-cyan-300 font-bold block">
                {selectedTransaction.blockNumber ? `#${selectedTransaction.blockNumber} (${selectedTransaction.confirmations} conf)` : 'Unconfirmed'}
              </span>
            </div>
          </div>

          {/* Cryptographic Hashes */}
          <div className="p-3 rounded-xl bg-[#09090b] border border-white/10 space-y-2 text-xs font-mono">
            <div>
              <span className="text-neutral-500 text-[10px] block">Blockchain Transaction Hash</span>
              <span className="text-emerald-300 font-semibold break-all">
                {selectedTransaction.blockchainTxHash || 'NOT_YET_ANCHORED'}
              </span>
            </div>

            <div>
              <span className="text-neutral-500 text-[10px] block">Cryptographic Off-Chain Integrity Hash</span>
              <span className="text-neutral-300 font-semibold break-all">
                {selectedTransaction.integrityHash}
              </span>
            </div>

            {selectedTransaction.isTampered && (
              <div className="p-2 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300">
                <span className="text-[10px] uppercase font-bold block">Integrity Violation Detected:</span>
                <span className="text-[11px] break-all">{selectedTransaction.tamperedHash}</span>
              </div>
            )}
          </div>

          {/* Chronological State History */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-bold text-neutral-400 font-mono">
              Complete State Transition Audit History ({selectedTransaction.stateHistory.length} events):
            </div>
            <div className="space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto pr-1">
              {selectedTransaction.stateHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-neutral-500 text-[10px] mt-0.5">#{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#FEEF8B] font-bold">{item.state}</span>
                        {item.blockchainState && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-neutral-400">
                            Chain: {item.blockchainState}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 font-sans mt-0.5">{item.note}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#09090b] flex justify-end">
          <button
            onClick={() => setSelectedTransaction(null)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
