'use client';

import React from 'react';
import { BookOpen, Sparkles, CheckCircle2, ShieldCheck, ArrowRight, Layers } from 'lucide-react';

export function ProfessorNotesPanel() {
  const principles = [
    {
      title: '1. Node Available',
      desc: 'Payment is initialized directly on blockchain and sender funds are reserved before recipient credit.',
      badge: 'DIRECT SETTLEMENT',
      color: 'text-emerald-400',
    },
    {
      title: '2. Node Unavailable',
      desc: 'Payment enters a temporary durable state instead of being rejected or blindly retried.',
      badge: 'FAIL-SAFE POOL',
      color: 'text-amber-400',
    },
    {
      title: '3. Node Recovery',
      desc: 'The same transaction identity is revalidated and promoted to blockchain.',
      badge: 'IDEMPOTENT PROMOTION',
      color: 'text-cyan-400',
    },
    {
      title: '4. Failure & Timeouts',
      desc: 'The system verifies the last committed state and resumes from it instead of blindly replaying.',
      badge: 'STATE-AWARE HEALING',
      color: 'text-purple-400',
    },
    {
      title: '5. Final Settlement',
      desc: 'Recipient receives spendable funds only after final blockchain validation.',
      badge: 'ATOMIC CLEARANCE',
      color: 'text-[#FEEF8B]',
    },
  ];

  const pipeline = [
    'NODE HEALTH',
    'ADAPTIVE ROUTING',
    'TEMPORARY RESERVATION',
    'BLOCKCHAIN PROMOTION',
    'STATE-AWARE RECOVERY',
    'INTEGRITY VERIFICATION',
    'FINAL SETTLEMENT',
  ];

  return (
    <div className="space-y-5">
      {/* Novelty & Architectural Contribution Card */}
      <div className="bg-gradient-to-br from-[#0c0c0e] via-[#0f1118] to-[#0c0c0e] border border-cyan-500/20 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-wider">
                Research & Engineering Innovation
              </span>
              <h3 className="text-base font-extrabold text-white">
                SECURECHAIN PAY — ARCHITECTURAL CONTRIBUTION
              </h3>
            </div>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
            Adaptive Blockchain-Anchored Transaction Continuity
          </span>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed max-w-4xl">
          Traditional decentralized financial payment applications crash or fail irreversibly when RPC nodes time out, desynchronize, or drop offline. SecureChain Pay contributes an <strong>adaptive transaction orchestration architecture</strong> that bridges off-chain memory pools with on-chain EVM state machines to deliver uninterrupted payment execution without sacrificing non-custodial cryptographic guarantees.
        </p>

        {/* 7-Stage Architectural Contribution Pipeline */}
        <div className="pt-2">
          <div className="text-[10px] uppercase font-bold text-neutral-400 font-mono mb-2">
            Integrated Fault-Tolerant Settlement Chain:
          </div>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            {pipeline.map((item, idx) => (
              <React.Fragment key={item}>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white font-semibold hover:border-cyan-500/40 hover:text-cyan-300 transition-colors">
                  {item}
                </div>
                {idx < pipeline.length - 1 && (
                  <ArrowRight size={13} className="text-neutral-500 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Professor Reference: How SecureChain Pay Works */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
          <div className="w-8 h-8 rounded-xl bg-[#FEEF8B]/10 border border-[#FEEF8B]/30 flex items-center justify-center text-[#FEEF8B]">
            <BookOpen size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              How SecureChain Pay Works (Academic & Practical Summary)
            </h3>
            <p className="text-xs text-neutral-400">Core operational principles for demonstration & thesis review</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {principles.map((p) => (
            <div
              key={p.title}
              className="p-3.5 rounded-xl bg-[#09090b] border border-white/5 space-y-1.5 hover:border-white/10 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${p.color}`}>{p.title}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-neutral-400 border border-white/5">
                  {p.badge}
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-snug">"{p.desc}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
