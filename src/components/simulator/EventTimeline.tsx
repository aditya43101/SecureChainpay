'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulation/simulation-context';
import {
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldAlert,
  Layers,
  Sparkles,
} from 'lucide-react';

export function EventTimeline() {
  const { timeline, metrics } = useSimulation();

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return {
          icon: <CheckCircle2 size={13} className="text-emerald-400" />,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        };
      case 'WARNING':
        return {
          icon: <AlertTriangle size={13} className="text-amber-400" />,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        };
      case 'ERROR':
        return {
          icon: <XCircle size={13} className="text-rose-400" />,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        };
      case 'RECOVERY':
        return {
          icon: <RefreshCw size={13} className="text-cyan-400" />,
          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
        };
      case 'QUARANTINE':
        return {
          icon: <ShieldAlert size={13} className="text-rose-400" />,
          color: 'text-rose-300 bg-rose-500/20 border-rose-500/40',
        };
      default:
        return {
          icon: <Clock size={13} className="text-[#FEEF8B]" />,
          color: 'text-[#FEEF8B] bg-[#FEEF8B]/10 border-[#FEEF8B]/30',
        };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Metrics Grid (1 Column) */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Activity size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live System Telemetry
              </h3>
              <p className="text-[11px] text-neutral-400">Real-time metrics counter</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#FEEF8B]">
            SIMULATED
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded-lg bg-[#09090b] border border-white/5">
            <span className="text-neutral-500 text-[10px] block">Completed Tx</span>
            <span className="text-emerald-400 font-extrabold text-sm">{metrics.completedTransactions}</span>
          </div>
          <div className="p-2 rounded-lg bg-[#09090b] border border-white/5">
            <span className="text-neutral-500 text-[10px] block">Reserved Amount</span>
            <span className="text-amber-400 font-extrabold text-sm">{metrics.reservedAmount} ETH</span>
          </div>
          <div className="p-2 rounded-lg bg-[#09090b] border border-white/5">
            <span className="text-neutral-500 text-[10px] block">Temporary Tx</span>
            <span className="text-white font-extrabold text-sm">{metrics.temporaryTransactions}</span>
          </div>
          <div className="p-2 rounded-lg bg-[#09090b] border border-white/5">
            <span className="text-neutral-500 text-[10px] block">On-Chain Settled</span>
            <span className="text-cyan-400 font-extrabold text-sm">{metrics.onChainTransactions}</span>
          </div>
          <div className="p-2 rounded-lg bg-[#09090b] border border-white/5">
            <span className="text-neutral-500 text-[10px] block">Quarantined</span>
            <span className="text-rose-400 font-extrabold text-sm">{metrics.quarantinedTransactions}</span>
          </div>
          <div className="p-2 rounded-lg bg-[#09090b] border border-white/5">
            <span className="text-neutral-500 text-[10px] block">Recovery Events</span>
            <span className="text-purple-400 font-extrabold text-sm">{metrics.recoveryEvents}</span>
          </div>
          <div className="p-2 rounded-lg bg-[#09090b] border border-white/5 col-span-2">
            <span className="text-neutral-500 text-[10px] block">Reconciliations Executed</span>
            <span className="text-[#FEEF8B] font-extrabold text-sm">{metrics.reconciliationEvents}</span>
          </div>
        </div>

        <div className="text-[10px] text-neutral-500 pt-2 border-t border-white/5 font-mono">
          * Counter values update immediately as simulated actions or failure recoveries run.
        </div>
      </div>

      {/* Event Timeline Stream (2 Columns) */}
      <div className="lg:col-span-2 bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FEEF8B]/10 border border-[#FEEF8B]/30 flex items-center justify-center text-[#FEEF8B]">
              <Clock size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Audited Simulation Event Timeline
              </h3>
              <p className="text-[11px] text-neutral-400">
                Timestamped ledger of orchestrator actions, failure detections, and state transitions
              </p>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-400">
            {timeline.length} Events Logged
          </span>
        </div>

        {/* Scrollable Timeline */}
        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {timeline.length > 0 ? (
            timeline.map((evt) => {
              const badge = getEventBadge(evt.type);
              return (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-xl bg-[#09090b] border border-white/5 flex items-start justify-between gap-3 text-xs hover:border-white/10 transition-all font-mono"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5">{badge.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{evt.title}</span>
                        {evt.stepName && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-neutral-400 font-mono">
                            {evt.stepName}
                          </span>
                        )}
                        {evt.transactionId && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 font-mono">
                            {evt.transactionId}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 font-sans mt-0.5">{evt.description}</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-neutral-500 font-mono whitespace-nowrap">
                    {evt.timestamp}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-8 rounded-xl bg-[#09090b] border border-white/5 text-center text-xs text-neutral-500 font-mono">
              Timeline awaiting events. Run any demo scenario above to generate live audit steps.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
