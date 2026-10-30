'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  LogOut,
  AlertCircle,
  FileCheck2,
  Car,
  Fingerprint,
} from 'lucide-react';

export default function InitializePage() {
  const { user, initializePassport, logout, error } = useAuth();
  const [initializing, setInitializing] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);

  const handleInitialize = async () => {
    setInitializing(true);
    setInitError(null);
    try {
      const success = await initializePassport();
      if (!success) {
        setInitError('Could not initialize vehicle passport. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Initialization failed';
      setInitError(msg);
    } finally {
      setInitializing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-500 font-medium">Checking authentication state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-xl w-full">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Fingerprint className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Initialize your Vehicle Passport
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            This creates your blockchain identity and enables you to register vehicles.
          </p>
        </div>

        {/* Identity confirmation card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <img
                src={user.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover border border-slate-200 flex-shrink-0"
              />
              <div>
                <div className="font-semibold text-slate-900">{user.name}</div>
                <div className="text-xs text-slate-500 font-mono">{user.email}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  UID: <code className="bg-slate-200/60 px-1 py-0.5 rounded font-mono">{user.firebaseUid}</code>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                Uninitialized
              </span>
            </div>
          </div>

          {(error || initError) && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error || initError || 'Blockchain initialization failed. Please try again.'}</span>
            </div>
          )}

          {/* Explicit Terms & What initialization establishes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Initialization Grants:
            </h3>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Blockchain User Identity:</strong> Registers a privacy-preserving user hash (SHA-256 of UID) on the smart contract with role <strong>{user.role}</strong>.
                </span>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Vehicle Passport Authority:</strong> Authorizes your blockchain identity to register and cryptographically anchor vehicle passports.
                </span>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Personal Data on Chain:</strong> Your name, email, and personal information remain strictly stored in PostgreSQL and are never exposed on-chain.
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 space-y-3">
            <button
              onClick={handleInitialize}
              disabled={initializing}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.99] shadow-sm shadow-brand-500/20 transition disabled:opacity-50"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>{initializing ? 'Creating your blockchain identity...' : 'Initialize Vehicle Passport'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={logout}
              disabled={initializing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cancel and Sign Out</span>
            </button>
          </div>

        </div>

        {/* Security notification note */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Security Protocol: Identity authentication alone does not grant passport permissions without explicit cryptographic registration.
        </p>
      </div>
    </div>
  );
}
