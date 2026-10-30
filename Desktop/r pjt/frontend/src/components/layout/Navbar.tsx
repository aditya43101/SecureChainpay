'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
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
  ChevronDown,
  LayoutDashboard,
  LogOut,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, loginAsTestUser, logout } = useAuth();
  const [intelOpen, setIntelOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const isIntelActive = pathname.startsWith('/intelligence') || pathname.startsWith('/admin');

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                Vehicle<span className="text-brand-600">Passport</span>
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-brand-700 border border-blue-200">
                EVM L2
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:block -mt-0.5">
              Autonomous Digital Vehicle Ledger
            </span>
          </div>
        </Link>

        {/* Primary Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-1">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              pathname === '/dashboard'
                ? 'bg-brand-50 text-brand-700 border border-brand-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-brand-600" />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/explorer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              pathname === '/explorer'
                ? 'bg-brand-50 text-brand-700 border border-brand-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Explorer</span>
          </Link>

          <Link
            href="/verify"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              pathname.startsWith('/verify')
                ? 'bg-brand-50 text-brand-700 border border-brand-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Search className="w-4 h-4 text-emerald-600" />
            <span>Verify</span>
          </Link>

          <Link
            href="/tamper-lab"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              pathname === '/tamper-lab'
                ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
                : 'text-slate-600 hover:text-rose-600 hover:bg-slate-100/80'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-500" />
            <span>Tamper Lab</span>
          </Link>

          {/* Intelligence Suite Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIntelOpen(!intelOpen)}
              onBlur={() => setTimeout(() => setIntelOpen(false), 200)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isIntelActive
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/25'
                  : 'text-slate-700 hover:text-brand-600 hover:bg-slate-100/80 border border-slate-200/80'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isIntelActive ? 'text-white' : 'text-brand-600'}`} />
              <span>Intelligence Suite</span>
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
            </button>

            {intelOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                  Autonomous Web3 Capabilities
                </div>

                <Link
                  href="/intelligence/twin"
                  className={`flex items-start gap-3 px-3 py-2 hover:bg-blue-50/70 transition ${
                    pathname === '/intelligence/twin' ? 'bg-blue-50/90 text-brand-700' : 'text-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-brand-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      Autonomous Digital Twin
                      <span className="text-[9px] bg-blue-100 text-brand-700 px-1.5 py-0.2 rounded font-semibold">Simulation</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Event-sourced state engine & hypothetical scenario simulator
                    </p>
                  </div>
                </Link>

                <Link
                  href="/intelligence/privacy"
                  className={`flex items-start gap-3 px-3 py-2 hover:bg-blue-50/70 transition ${
                    pathname === '/intelligence/privacy' ? 'bg-blue-50/90 text-brand-700' : 'text-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      Privacy & ZKP Engine
                      <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-semibold">ZK Proofs</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Zero-knowledge range proofs & selective document disclosure
                    </p>
                  </div>
                </Link>

                <Link
                  href="/intelligence/investigations"
                  className={`flex items-start gap-3 px-3 py-2 hover:bg-blue-50/70 transition ${
                    pathname === '/intelligence/investigations' ? 'bg-blue-50/90 text-brand-700' : 'text-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      Multi-Agent Investigation Console
                      <span className="text-[9px] bg-cyan-100 text-cyan-700 px-1.5 py-0.2 rounded font-semibold">AI Agents</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Autonomous agent swarm with tool calling & fraud dispute handoff
                    </p>
                  </div>
                </Link>

                <Link
                  href="/intelligence/fraud-graph"
                  className={`flex items-start gap-3 px-3 py-2 hover:bg-blue-50/70 transition ${
                    pathname === '/intelligence/fraud-graph' ? 'bg-blue-50/90 text-brand-700' : 'text-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      Fraud Ring Graph
                      <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold">Fraud Graph</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Cross-vehicle anomaly graph & rollback cluster detection
                    </p>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Right Section: Network Status & User Role Switcher */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Live EVM Status Pill */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>EVM Subnet 31337</span>
          </div>

          {/* Quick User / Role Switcher */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                onBlur={() => setTimeout(() => setRoleMenuOpen(false), 200)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-2xs"
              >
                <img
                  src={user.photoUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'}
                  alt={user.name}
                  className="w-6 h-6 rounded-full object-cover border border-slate-200"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[110px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-brand-600 font-semibold leading-none">
                    {user.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Switch Test User Role
                  </div>

                  <button
                    onClick={() => loginAsTestUser('ADMIN')}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Platform Admin</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">ADMIN</span>
                  </button>

                  <button
                    onClick={() => loginAsTestUser('GARAGE')}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Certified Garage</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">GARAGE</span>
                  </button>

                  <button
                    onClick={() => loginAsTestUser('INSURANCE_PROVIDER')}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Insurance Provider</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">INSURER</span>
                  </button>

                  <button
                    onClick={() => loginAsTestUser('VEHICLE_OWNER')}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Vehicle Owner</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-brand-700 font-bold border border-blue-200">OWNER</span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <span>Sign In</span>
              </Link>
              <button
                onClick={() => loginAsTestUser('ADMIN')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs shadow-brand-500/20"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Dev Login</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
