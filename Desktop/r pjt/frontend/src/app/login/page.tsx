'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchTestUsers } from '../../lib/api';
import { User } from '../../types/auth';
import {
  ShieldCheck,
  Car,
  KeyRound,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  Wrench,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

export default function LoginPage() {
  const { loginWithGoogle, loginWithGoogleEmail, loginAsTestUser, loading, error } = useAuth();
  const [testUsers, setTestUsers] = useState<User[]>([]);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  const fallbackTestUsers: User[] = [
    {
      id: 'demo-user-aarav-001',
      firebaseUid: 'seed-demo-aarav-001',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'VEHICLE_OWNER',
      isInitialized: true,
      onboardingStatus: 'COMPLETED_WITH_VEHICLE',
      blockchainUserId: 'USR-DEMO-001',
      blockchainAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      createdAt: '2026-10-28T22:00:04.522Z',
      updatedAt: '2026-10-28T22:00:04.522Z',
    },
    {
      id: 'demo-user-priya-002',
      firebaseUid: 'seed-demo-priya-002',
      name: 'Priya Verma',
      email: 'priya.verma@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: 'VEHICLE_OWNER',
      isInitialized: true,
      onboardingStatus: 'COMPLETED_WITH_VEHICLE',
      blockchainUserId: 'USR-DEMO-002',
      blockchainAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      createdAt: '2026-10-28T22:00:05.522Z',
      updatedAt: '2026-10-28T22:00:05.522Z',
    },
    {
      id: 'demo-user-rohan-003',
      firebaseUid: 'seed-demo-rohan-003',
      name: 'Rohan Mehta',
      email: 'rohan.mehta@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      role: 'VEHICLE_OWNER',
      isInitialized: true,
      onboardingStatus: 'COMPLETED_WITH_VEHICLE',
      blockchainUserId: 'USR-DEMO-003',
      blockchainAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      createdAt: '2026-10-28T22:00:06.522Z',
      updatedAt: '2026-10-28T22:00:06.522Z',
    },
    {
      id: 'demo-user-neha-004',
      firebaseUid: 'seed-demo-neha-004',
      name: 'Neha Kapoor',
      email: 'neha.kapoor@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: 'VEHICLE_OWNER',
      isInitialized: true,
      onboardingStatus: 'COMPLETED_WITH_VEHICLE',
      blockchainUserId: 'USR-DEMO-004',
      blockchainAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
      createdAt: '2026-10-28T22:00:07.522Z',
      updatedAt: '2026-10-28T22:00:07.522Z',
    },
    {
      id: 'demo-user-kabir-005',
      firebaseUid: 'seed-demo-kabir-005',
      name: 'Kabir Malhotra',
      email: 'kabir.malhotra@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      role: 'VEHICLE_OWNER',
      isInitialized: false,
      onboardingStatus: 'NOT_STARTED',
      blockchainUserId: null,
      blockchainAddress: null,
      createdAt: '2026-10-28T22:00:08.522Z',
      updatedAt: '2026-10-28T22:00:08.522Z',
    },
    {
      id: 'user-owner-a',
      firebaseUid: 'seed-owner-a',
      name: 'Alex Mercer (Vehicle Owner)',
      email: 'owner.a@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'VEHICLE_OWNER',
      isInitialized: true,
      blockchainUserId: 'USR-000001',
      blockchainAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
    },
    {
      id: 'user-owner-b',
      firebaseUid: 'seed-owner-b',
      name: 'Elena Rostova (Second Owner)',
      email: 'owner.b@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: 'VEHICLE_OWNER',
      isInitialized: true,
      blockchainUserId: 'USR-000002',
      blockchainAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      createdAt: '2025-01-15T00:00:00.000Z',
      updatedAt: '2025-01-15T00:00:00.000Z',
    },
    {
      id: 'user-garage',
      firebaseUid: 'seed-garage',
      name: 'Apex Certified Garage',
      email: 'garage@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150&auto=format&fit=crop&q=80',
      role: 'GARAGE',
      isInitialized: true,
      blockchainUserId: 'USR-000003',
      blockchainAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      createdAt: '2025-01-20T00:00:00.000Z',
      updatedAt: '2025-01-20T00:00:00.000Z',
    },
    {
      id: 'user-manufacturer',
      firebaseUid: 'seed-manufacturer',
      name: 'Nordic Motors OEM',
      email: 'manufacturer@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&auto=format&fit=crop&q=80',
      role: 'MANUFACTURER',
      isInitialized: true,
      blockchainUserId: 'USR-000004',
      blockchainAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      createdAt: '2025-01-25T00:00:00.000Z',
      updatedAt: '2025-01-25T00:00:00.000Z',
    },
    {
      id: 'user-insurance',
      firebaseUid: 'seed-insurance',
      name: 'SafeShield Underwriters',
      email: 'insurance@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=150&auto=format&fit=crop&q=80',
      role: 'INSURANCE_PROVIDER',
      isInitialized: true,
      blockchainUserId: 'USR-000005',
      blockchainAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
      createdAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
    },
    {
      id: 'user-admin',
      firebaseUid: 'seed-admin',
      name: 'System Regulator & Auditor',
      email: 'admin@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      role: 'ADMIN',
      isInitialized: true,
      blockchainUserId: 'USR-000006',
      blockchainAddress: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
      createdAt: '2025-02-05T00:00:00.000Z',
      updatedAt: '2025-02-05T00:00:00.000Z',
    },
    {
      id: 'user-new-user',
      firebaseUid: 'seed-new-user',
      name: 'Test New User (Uninitialized)',
      email: 'newuser@vehiclepassport.dev',
      photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: 'VEHICLE_OWNER',
      isInitialized: false,
      onboardingStatus: 'NOT_STARTED',
      blockchainUserId: null,
      blockchainAddress: null,
      createdAt: '2025-02-10T00:00:00.000Z',
      updatedAt: '2025-02-10T00:00:00.000Z',
    },
  ];

  useEffect(() => {
    fetchTestUsers()
      .then((res) => {
        if (res.success && res.data?.testUsers && res.data.testUsers.length > 0) {
          setTestUsers(res.data.testUsers);
        } else {
          setTestUsers(fallbackTestUsers);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch test users:', err);
        setTestUsers(fallbackTestUsers);
      });
  }, []);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'VEHICLE_OWNER':
        return <Car className="w-4 h-4 text-blue-600" />;
      case 'GARAGE':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'MANUFACTURER':
        return <Building2 className="w-4 h-4 text-emerald-600" />;
      case 'INSURANCE_PROVIDER':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'ADMIN':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      default:
        return <UserCheck className="w-4 h-4 text-slate-600" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'VEHICLE_OWNER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'GARAGE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MANUFACTURER':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'INSURANCE_PROVIDER':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ADMIN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">


      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Automotive Digital Identity &amp; Verification Layer
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Sign In to Blockchain Vehicle Passport
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            Enterprise tamper-evident automotive ledger with cryptographically anchored lifecycle records.
          </p>
        </div>

        {/* Login Box */}
        <div className="max-w-md w-full mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-10">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">Application Identity Sign-In</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authenticate via Google OAuth to access your vehicle passports and digital twins.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-start gap-2.5 font-semibold text-amber-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>{error}</span>
              </div>
              {error.includes('Authorized domains') && (
                <div className="pl-6 text-[11px] text-amber-700 space-y-1">
                  <p>
                    <strong>How to fix in 10 seconds:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-700">
                    <li>Open <strong>Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains</strong></li>
                    <li>Click <strong>&quot;Add domain&quot;</strong> and paste: <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200 font-mono font-bold text-amber-900">riya-project-five.vercel.app</code></li>
                  </ol>
                  <p className="pt-1 text-slate-600">
                    💡 <em>Until you add it, you can instantly sign in using the <strong>Direct Sign-In</strong> form below!</em>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => loginWithGoogle()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm transition hover:border-slate-300 active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Verifying...' : 'Sign in with Google'}</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-medium uppercase">Or Direct Sign-In</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customEmail) {
                  loginWithGoogleEmail(customEmail, customName);
                }
              }}
              className="space-y-2.5"
            >
              <div>
                <input
                  type="email"
                  placeholder="Enter your Google or work email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:border-brand-500 focus:outline-hidden"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Your Name (e.g. Riya Singh)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-2/3 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:border-brand-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={loading || !customEmail}
                  className="w-1/3 px-3 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Sign In / Register'}
                </button>
              </div>
            </form>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-slate-700 block mb-0.5">Automated Decentralized User ID:</strong>
              Signing in automatically assigns a unique <strong>USR-XXXXXX</strong> blockchain identifier and provisions vehicle ownership permissions.
            </div>
          </div>
        </div>

        {/* Authorized Stakeholder Portals */}
        <div className="border border-slate-200 rounded-2xl bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1">
                <KeyRound className="w-3.5 h-3.5" />
                Institutional Stakeholder Portals
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Authorized Role-Based Portals
              </h3>
              <p className="text-xs text-slate-500">
                Role-gated dashboards for Vehicle Owners, Certified Garages, Manufacturers, Insurers, and System Auditors.
              </p>
            </div>
            <span className="text-xs text-slate-600 self-start sm:self-auto bg-slate-50 border border-slate-200 px-3 py-1 rounded-full font-medium">
              Multi-Role Access
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
            {testUsers.map((testUser) => (
              <div
                key={testUser.id}
                className="group border border-slate-200 rounded-xl p-4 hover:border-brand-400 hover:shadow-md transition-all flex flex-col justify-between bg-slate-50/50 hover:bg-white"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeClass(
                        testUser.role
                      )}`}
                    >
                      {getRoleIcon(testUser.role)}
                      {testUser.role.replace('_', ' ')}
                    </span>

                    {testUser.isInitialized ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Initialized
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <AlertCircle className="w-3 h-3" />
                        New Account
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <img
                      src={testUser.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={testUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-sm truncate">
                        {testUser.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate">
                        {testUser.email}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] font-mono text-slate-400 truncate bg-slate-100 px-2 py-1 rounded">
                    Role ID: {testUser.firebaseUid}
                  </div>

                  {!testUser.isInitialized && (
                    <div className="mt-2 text-[11px] font-medium text-amber-700 bg-amber-50/80 p-1.5 rounded border border-amber-100">
                      💡 New Registration: Onboarding flow for newly provisioned vehicle owner.
                    </div>
                  )}
                </div>

                <button
                  onClick={() => loginAsTestUser(testUser.email)}
                  disabled={loading}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-white group-hover:bg-brand-600 group-hover:text-white border border-slate-300 group-hover:border-brand-600 text-slate-700 shadow-sm transition active:scale-95"
                >
                  <span>Access Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Blockchain Vehicle Passport &copy; 2026. Enterprise Tamper-Evident Automotive Ledger. All Rights Reserved.
      </footer>
    </div>
  );
}
