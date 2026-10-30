'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Car,
  Layers,
  Search,
  Flame,
  Cpu,
  Lock,
  Network,
  Bot,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
  Activity,
  FileCheck2,
  Database,
  ExternalLink,
} from 'lucide-react';

export default function LandingPortalPage() {
  const { user, loginAsTestUser } = useAuth();

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 bg-gradient-to-b from-white via-blue-50/30 to-slate-50 border-b border-slate-200/80">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f01f_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f01f_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Pill Banner */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-brand-200/90 text-brand-700 text-xs font-semibold mb-6 shadow-xs animate-in fade-in slide-in-from-top-3">
              <span className="flex h-2 w-2 rounded-full bg-brand-600 animate-pulse" />
              <span>Avalanche EVM L2 Subnet • Merkle Tree Batch Commitments</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
              The Sovereign Ledger for{' '}
              <span className="bg-gradient-to-r from-brand-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Automotive Truth
              </span>
            </h1>

            {/* Subheading */}
            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Autonomous digital vehicle twins, tamper-evident cryptographic passports, zero-knowledge privacy verification, and cross-vehicle fraud intelligence on an immutable EVM blockchain.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/intelligence/twin"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-500/25 transition transform hover:-translate-y-0.5"
              >
                <Cpu className="w-4 h-4" />
                <span>Launch Autonomous Twin</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>

              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200 shadow-xs transition"
              >
                <Car className="w-4 h-4 text-brand-600" />
                <span>Manage Passports</span>
              </Link>

              <Link
                href="/explorer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
              >
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Inspect Merkle Batches</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-5xl mx-auto">
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/90 p-4 text-center shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-brand-700">100%</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                Cryptographic Anchor
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/90 p-4 text-center shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-emerald-700">0.0 ms</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                ZKP Verification Latency
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/90 p-4 text-center shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-cyan-700">64 / 64</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                Automated Tests Passing
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/90 p-4 text-center shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-purple-700">EVM L2</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                Avalanche Subnet
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Navigation Grid */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">
              Core Enterprise Modules
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Integrated Automotive Blockchain Ecosystem
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-md">
            Click any module below to inspect real-time vehicle lifecycle state, cryptographic proofs, or autonomous simulations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Autonomous Digital Twin */}
          <Link
            href="/intelligence/twin"
            className="group relative bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-brand-300 transition transform hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-600 flex items-center justify-center border border-blue-200/60 shadow-2xs group-hover:bg-brand-600 group-hover:text-white transition">
                  <Cpu className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-brand-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  DIGITAL TWIN
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition">
                Autonomous Digital Vehicle Twin
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Event-sourced vehicle state engine with what-if scenario simulations (maintenance, mileage, accidents) and ledger-to-physical drift reconciliation.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-600">
              <span>Open Control Center</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Card 2: Privacy & ZKP Verification */}
          <Link
            href="/intelligence/privacy"
            className="group relative bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-emerald-300 transition transform hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60 shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ZK PRIVACY
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition">
                Zero-Knowledge Privacy Center
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Prove odometer thresholds (&lt; 80,000 km) and certified service history using cryptographic ZKP range proofs without revealing invoices or owner identity.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600">
              <span>Generate ZKP Proof</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Card 3: Multi-Agent Investigations */}
          <Link
            href="/intelligence/investigations"
            className="group relative bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-cyan-300 transition transform hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200/60 shadow-2xs group-hover:bg-cyan-600 group-hover:text-white transition">
                  <Bot className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                  AUTONOMOUS AI
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-cyan-600 transition">
                Autonomous Investigation Console
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Multi-agent LLM swarm with deterministic tools: verify Merkle root anchors, detect timeline velocity anomalies, and export tamper-evident forensic dossiers.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-cyan-600">
              <span>Inspect Investigation Runs</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Card 4: Fraud Ring Graph */}
          <Link
            href="/intelligence/fraud-graph"
            className="group relative bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-purple-300 transition transform hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200/60 shadow-2xs group-hover:bg-purple-600 group-hover:text-white transition">
                  <Network className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  FRAUD GRAPH
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition">
                Cross-Vehicle Fraud Graph
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Graph-based intelligence engine uncovering coordinated VIN cloning rings, corrupt garage syndicates, and rollback clusters across the vehicle registry.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-purple-600">
              <span>Explore Graph Projection</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Card 5: Blockchain Merkle Explorer */}
          <Link
            href="/explorer"
            className="group relative bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-indigo-300 transition transform hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/60 shadow-2xs group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  MERKLE PROOFS
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition">
                Merkle Tree Batch Explorer
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Inspect committed Merkle root batches on-chain, browse cryptographic leaf nodes, and verify inclusion proofs against the deployed EVM smart contract.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
              <span>View On-Chain Batches</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Card 6: Cryptographic Tamper Lab */}
          <Link
            href="/tamper-lab"
            className="group relative bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-rose-300 transition transform hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/60 shadow-2xs group-hover:bg-rose-600 group-hover:text-white transition">
                  <Flame className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  SECURITY LAB
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-rose-600 transition">
                Cryptographic Tamper Lab
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Simulate odometer rollback attacks in off-chain database records and immediately watch the Merkle tree and blockchain verification flag the fraud.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-rose-600">
              <span>Simulate Attack Vector</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
            </div>
          </Link>
        </div>
      </section>

      {/* Trust & Architecture Showcase */}
      <section className="py-12 bg-white border-t border-slate-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Zero Trust Automotive Ledger</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Deterministic State Integrity Guaranteed by Cryptography
              </h2>
              <p className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                Every vehicle registration, odometer update, service invoice, and inspection certificate is hashed into an RFC 6962 compliant Merkle Tree and anchored to an immutable EVM blockchain. Physical vehicle reality is continuously compared with digital ledger assertions to eliminate fraud.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/verify"
                  className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-sm"
                >
                  Verify Any VIN / Passport ID
                </Link>
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition"
                >
                  Open Owner Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
