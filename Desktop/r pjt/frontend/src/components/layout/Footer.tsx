'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Layers, GitBranch, Cpu, Lock, CheckCircle2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/90 bg-white/80 backdrop-blur-sm mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left Brand & Mission */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                Blockchain-Based Digital Vehicle Passport & Autonomous Twin Engine
              </div>
              <div className="text-[11px] text-slate-500">
                Avalanche / EVM L2 Subnet • Merkle Tree Batch Commitments • Zero-Knowledge Proofs
              </div>
            </div>
          </div>

          {/* Quick System Links */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-brand-600 transition">Dashboard</Link>
            <Link href="/explorer" className="hover:text-brand-600 transition">Blockchain Explorer</Link>
            <Link href="/verify" className="hover:text-brand-600 transition">Public Verifier</Link>
            <Link href="/tamper-lab" className="hover:text-rose-600 transition">Tamper Lab</Link>
            <Link href="/intelligence/twin" className="hover:text-brand-600 transition">Autonomous Twin</Link>
            <Link href="/intelligence/privacy" className="hover:text-emerald-600 transition">ZKP Privacy</Link>
          </div>

          {/* Cryptographic Badges */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Smart Contracts Live
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Chain ID: 31337
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 mt-6 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
          <div>
            © {new Date().getFullYear()} VehiclePassport Enterprise. Tamper-evident automotive state infrastructure.
          </div>
          <div className="flex items-center gap-4 mt-2 sm:mt-0 font-medium">
            <span>RFC 6962 Merkle Trees</span>
            <span>•</span>
            <span>Zero-Knowledge Range Verification</span>
            <span>•</span>
            <span>Event-Sourced Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
