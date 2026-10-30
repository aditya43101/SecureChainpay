'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { createVehicle } from '../../lib/api';
import { FuelType } from '../../types/vehicle';
import {
  Car,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  PlusCircle,
  FileText,
  Lock,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';

export default function OnboardingPage() {
  const { user, token, completeOnboardingWithoutVehicle, completeOnboardingWithVehicle, logout } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'CHOICE' | 'ADD_VEHICLE'>('CHOICE');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    manufacturer: '',
    model: '',
    variant: '',
    manufacturingYear: new Date().getFullYear(),
    fuelType: 'PETROL' as FuelType,
    color: '',
    engineNumber: '',
    vin: '',
    registrationNumber: '',
  });

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-500 font-medium">Checking identity and authentication...</p>
        </div>
      </div>
    );
  }

  const handleSkipVehicle = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const success = await completeOnboardingWithoutVehicle();
      if (!success) {
        setErrorMsg('Could not complete onboarding. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update onboarding state';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('Session expired. Please log in again.');
      return;
    }

    // Client-side validations
    const vin = formData.vin.trim().toUpperCase();
    const reg = formData.registrationNumber.trim().toUpperCase();

    if (vin.length !== 17) {
      setErrorMsg('VIN must be exactly 17 characters long.');
      return;
    }

    if (!reg) {
      setErrorMsg('Registration Number is required.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await createVehicle(
        {
          ...formData,
          vin,
          registrationNumber: reg,
        },
        token
      );

      if (res.success && res.data?.vehicle) {
        // Successfully created and anchored! Mark onboarding completed and navigate to dashboard
        await completeOnboardingWithVehicle();
        router.push('/dashboard');
      } else {
        setErrorMsg(res.error || 'Failed to create and anchor vehicle passport.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vehicle creation failed';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 bg-slate-50">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header / Identity Pill */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-brand-200 text-brand-700 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Digital Identity Verified: {user.blockchainUserId || 'USR-PENDING'}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome, {user.name}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Your cryptographic account is ready. Let&apos;s configure your automotive passport profile.
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MODE: CHOICE (Option 1 vs Option 2) */}
        {mode === 'CHOICE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OPTION 1: ADD MY VEHICLE */}
            <div className="bg-white rounded-3xl border-2 border-brand-500 shadow-md shadow-brand-500/5 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-brand-600 transition">
              <div className="absolute top-0 right-0 bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-bl-xl shadow-xs">
                Recommended
              </div>

              <div className="space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-xs">
                  <Car className="w-7 h-7" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900 group-hover:text-brand-600 transition">
                    Add My Vehicle
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    Do you own a vehicle? Add your vehicle details to create its digital vehicle passport and anchor its genesis state.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                    <span>Cryptographic EVM state anchoring</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                    <span>Tamper-evident service & odometer log</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                    <span>Verified ownership transfer capability</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  id="btn-add-vehicle-option"
                  onClick={() => setMode('ADD_VEHICLE')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.99] shadow-sm shadow-brand-500/20 transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add My Vehicle</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>

            {/* OPTION 2: CONTINUE WITHOUT A VEHICLE */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col justify-between hover:border-slate-300 transition">
              <div className="space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Continue Without a Vehicle
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    You can explore your account, inspect ecosystem intelligence, and add a vehicle whenever you are ready.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>No fake or demo vehicle assigned</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>Access clean empty-state dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>Register vehicles at any time later</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  id="btn-skip-vehicle-option"
                  onClick={handleSkipVehicle}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Completing setup...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue Without a Vehicle</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODE: ADD_VEHICLE (Real Registration Form) */}
        {mode === 'ADD_VEHICLE' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Register Your Vehicle Passport
                  </h2>
                  <p className="text-xs text-slate-500">
                    Please provide accurate details from your Registration Certificate (RC).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMode('CHOICE')}
                disabled={submitting}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                &larr; Back to Options
              </button>
            </div>

            <form onSubmit={handleCreateVehicleSubmit} className="space-y-5 text-xs">
              {/* Row 1: Manufacturer & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Manufacturer *
                  </label>
                  <input
                    type="text"
                    required
                    id="input-manufacturer"
                    placeholder="e.g. Tata Motors, Tesla, BMW"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50 focus:bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Model *
                  </label>
                  <input
                    type="text"
                    required
                    id="input-model"
                    placeholder="e.g. Nexon EV, Model 3, X1"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50 focus:bg-white text-xs"
                  />
                </div>
              </div>

              {/* Row 2: Variant & Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Variant / Trim (Optional)
                  </label>
                  <input
                    type="text"
                    id="input-variant"
                    placeholder="e.g. Empowered Plus, Long Range"
                    value={formData.variant}
                    onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50 focus:bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Manufacturing Year *
                  </label>
                  <input
                    type="number"
                    required
                    id="input-year"
                    min={1950}
                    max={new Date().getFullYear() + 1}
                    value={formData.manufacturingYear}
                    onChange={(e) => setFormData({ ...formData, manufacturingYear: parseInt(e.target.value, 10) })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50 focus:bg-white text-xs"
                  />
                </div>
              </div>

              {/* Row 3: Fuel Type & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Fuel Type *
                  </label>
                  <select
                    id="select-fuel-type"
                    value={formData.fuelType}
                    onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as FuelType })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden bg-white text-xs"
                  >
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="CNG">CNG</option>
                    <option value="LPG">LPG</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Exterior Color (Optional)
                  </label>
                  <input
                    type="text"
                    id="input-color"
                    placeholder="e.g. Daytona Grey, Glacier White"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50 focus:bg-white text-xs"
                  />
                </div>
              </div>

              {/* Row 4: VIN (17 alphanumeric) */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  VIN (Vehicle Identification Number) *
                </label>
                <input
                  type="text"
                  required
                  id="input-vin"
                  maxLength={17}
                  placeholder="17-character VIN (e.g. MAT612345NEXON001)"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden font-mono text-xs uppercase"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Must be exactly 17 alphanumeric characters. Stored normalized and anchored on-chain.
                </span>
              </div>

              {/* Row 5: Registration Number & Engine Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Registration Number *
                  </label>
                  <input
                    type="text"
                    required
                    id="input-registration"
                    placeholder="e.g. MH02EV1001 or DL01AX2020"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden font-mono text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Engine / Motor Number (Optional)
                  </label>
                  <input
                    type="text"
                    id="input-engine-number"
                    placeholder="e.g. EM564321A"
                    value={formData.engineNumber}
                    onChange={(e) => setFormData({ ...formData, engineNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden font-mono text-xs"
                  />
                </div>
              </div>

              {/* Verified Ownership Callout */}
              <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-100 flex items-start gap-3 text-xs text-brand-900">
                <Lock className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Sovereign Ownership Registration:</strong> This vehicle will be anchored with you (
                  <span className="font-semibold">{user.name}</span>, Blockchain ID:{' '}
                  <span className="font-mono">{user.blockchainUserId || 'USR-000001'}</span>) as the initial verified owner.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMode('CHOICE')}
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleSkipVehicle}
                    disabled={submitting}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold hover:bg-slate-100 transition"
                  >
                    Skip for Now
                  </button>

                  <button
                    type="submit"
                    id="btn-submit-vehicle"
                    disabled={submitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white font-semibold shadow-sm shadow-brand-500/20 transition disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Anchoring on Ledger...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>Register & Anchor Passport</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Footer sign-out option */}
        <div className="text-center pt-4">
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of {user.email}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
