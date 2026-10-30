'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck, ArrowLeft, Layers } from 'lucide-react';
import MerkleBatchExplorer from '../../../components/blockchain/MerkleBatchExplorer';

export default function MerkleBatchesPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/explorer"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
              title="Back to Explorer"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <Link href="/explorer" className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight hover:text-blue-600 transition">
                Merkle <span className="text-blue-600">Batch Explorer</span>
              </Link>
              <div className="text-[10px] text-slate-500 font-medium">Phase 6 Cryptographic Anchoring & Inclusion Proofs</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/explorer"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 bg-white shadow-2xs transition flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>Full Ledger</span>
            </Link>
            <Link
              href="/verify"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 bg-white shadow-2xs transition flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verify Record</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <MerkleBatchExplorer />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Blockchain Vehicle Passport. Phase 6 Advanced Merkle Tree Batch Anchoring & Cryptographic Verification.</p>
        </div>
      </footer>
    </div>
  );
}
