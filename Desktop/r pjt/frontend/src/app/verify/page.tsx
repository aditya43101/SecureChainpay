'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Search,
  ArrowRight,
  Car,
  QrCode,
  Lock,
  Layers,
  FileCheck2,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export default function VerifyLandingPage() {
  const router = useRouter();
  const [passportQuery, setPassportQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passportQuery.trim()) return;
    const clean = passportQuery.trim().toUpperCase();
    router.push(`/verify/${clean}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">


      {/* Hero Search Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Zero-Trust Blockchain Verification</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Verify Any Vehicle's History with <span className="text-blue-600">Cryptographic Certainty</span>
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed">
            Enter a Vehicle Passport ID or scan a vehicle QR code to verify specifications, odometer readings, certified service logs, and ownership transfers anchored to the blockchain.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="pt-2">
            <div className="flex flex-col sm:flex-row items-center gap-2 max-w-lg mx-auto bg-white p-2 rounded-2xl border border-slate-300 shadow-md">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={passportQuery}
                  onChange={(e) => setPassportQuery(e.target.value)}
                  placeholder="Enter Passport ID (e.g. VP-000001)"
                  className="w-full pl-10 pr-3 py-2.5 text-sm font-mono rounded-xl bg-transparent focus:outline-hidden text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>Verify Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Demo Passport Cards */}
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sample Live Blockchain Passports</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/verify/VP-000001"
              className="group p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                  VP-000001
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  VERIFIED
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 group-hover:text-blue-600 transition">
                  Tata Nexon EV (2024)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Empowered Plus LR • Electric • 32,000 km</p>
              </div>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>2 Services • 1 Insurance</span>
                <span className="text-blue-600 font-semibold group-hover:translate-x-1 transition flex items-center gap-0.5">
                  View Passport <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>

            <Link
              href="/verify/VP-000002"
              className="group p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                  VP-000002
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  VERIFIED
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 group-hover:text-blue-600 transition">
                  Honda City (2023)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">ZX VTEC • Petrol • 10,500 km</p>
              </div>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>1 Service • 1 Odometer</span>
                <span className="text-blue-600 font-semibold group-hover:translate-x-1 transition flex items-center gap-0.5">
                  View Passport <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>

            <Link
              href="/verify/VP-DEMO-001"
              className="group p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md">
                  VP-DEMO-001
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  VERIFIED
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 group-hover:text-blue-600 transition">
                  Aurora X1 Sedan (2024)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Aura Dynamic • Petrol • 22,000 km</p>
              </div>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>2 Services • 1 Odometer</span>
                <span className="text-blue-600 font-semibold group-hover:translate-x-1 transition flex items-center gap-0.5">
                  View Passport <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>

            <Link
              href="/verify/VP-DEMO-008"
              className="group p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                  VP-DEMO-008
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  VERIFIED
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 group-hover:text-blue-600 transition">
                  Orbit M2 Compact (2022)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Active Turbo • Multi-Owner Transferred</p>
              </div>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>2 Transfers Anchored</span>
                <span className="text-blue-600 font-semibold group-hover:translate-x-1 transition flex items-center gap-0.5">
                  View Passport <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Value Proposition Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Tamper-Evident Records</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every record is hashed using SHA-256 and anchored to an immutable smart contract. Any unauthorized database modification triggers an immediate cryptographic mismatch alert.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Odometer Rollback Detection</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sequential odometer audit engine compares chronological mileage logs across multiple sources (owners, certified garages, inspections) to detect rollback fraud.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Document Intelligence & OCR</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Uploaded registration and service documents undergo automated OCR field extraction and cross-verification against official vehicle database specifications.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4">
          <p>© 2026 Blockchain Vehicle Passport. Designed for trust, transparency, and fraud prevention.</p>
        </div>
      </footer>
    </div>
  );
}
