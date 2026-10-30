'use strict';
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Calendar,
  Gauge,
  Wrench,
  Car,
  FileCheck,
  Zap,
  Award,
  Layers,
  HeartPulse,
  Share2,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { fetchSharedPassport } from '../../../../lib/api';
import { SharedPassportDTO } from '../../../../types/vehicle';

export default function SharedPassportPage() {
  const params = useParams();
  const shareId = params?.shareId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [data, setData] = useState<SharedPassportDTO | null>(null);

  useEffect(() => {
    if (!shareId) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchSharedPassport(shareId);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || { code: 'NOT_FOUND', message: 'Share profile could not be loaded.' });
        }
      } catch (err: any) {
        setError({ code: 'NETWORK_ERROR', message: err.message || 'Failed to connect to verification network.' });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-slate-700">Verifying Cryptographic Share Proof...</p>
          <p className="text-xs text-slate-500">Querying on-chain state and privacy disclosure rules</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const isRevoked = error?.code === 'DISCLOSURE_REVOKED';
    const isExpired = error?.code === 'DISCLOSURE_EXPIRED';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
              isRevoked ? 'bg-rose-100 text-rose-600' : isExpired ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isRevoked ? <Lock className="w-7 h-7" /> : isExpired ? <Calendar className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>

          <h2 className="text-lg font-bold text-slate-900">
            {isRevoked
              ? 'Disclosure Revoked'
              : isExpired
              ? 'Verification Link Expired'
              : 'Report Not Available'}
          </h2>

          <p className="text-xs text-slate-600 leading-relaxed">
            {error?.message || 'This vehicle report could not be found or is no longer accessible.'}
          </p>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Platform
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { disclosedData, disclosedCategories, verificationSummary, title, expiresAt } = data;
  const isVerified = verificationSummary.overallState === 'VERIFIED';

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Top Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-500/20">
              VP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Selective Disclosure</span>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">Privacy Protocol</span>
              </div>
              <h1 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">{title || 'Shared Vehicle Report'}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/verify/${verificationSummary.passportId}`}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold hidden sm:inline-flex items-center gap-1"
            >
              Full Public Passport <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Verification Status Card */}
        <div
          className={`p-6 rounded-2xl border shadow-sm ${
            isVerified
              ? 'bg-gradient-to-r from-emerald-50 via-white to-blue-50 border-emerald-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  isVerified ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-600 text-white'
                }`}
              >
                {isVerified ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Official Status</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {verificationSummary.overallState}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-0.5">
                  {isVerified ? 'VEHICLE PASSPORT VERIFIED' : 'INTEGRITY MISMATCH DETECTED'}
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  {isVerified
                    ? 'Cryptographic blockchain hashes and lifecycle signatures match immutable decentralized ledgers. Only owner-authorized categories are displayed below.'
                    : 'Discrepancy identified between database records and immutable blockchain proofs.'}
                </p>
              </div>
            </div>

            <div className="sm:text-right text-xs text-slate-500 space-y-1 shrink-0 bg-white/80 p-3 rounded-xl border border-slate-200/80">
              <div>
                <span className="font-medium text-slate-400">Passport: </span>
                <span className="font-mono font-bold text-slate-900">{verificationSummary.passportId}</span>
              </div>
              <div>
                <span className="font-medium text-slate-400">Expires: </span>
                <span className="font-semibold text-slate-700">{expiresAt ? new Date(expiresAt).toLocaleDateString() : 'Never'}</span>
              </div>
            </div>
          </div>

          {/* Disclosed Scope Chips */}
          <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center flex-wrap gap-2 text-xs">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5 text-blue-600" /> Disclosed Scope:
            </span>
            {disclosedCategories.map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-700 shadow-2xs"
              >
                ✓ {cat}
              </span>
            ))}
          </div>
        </div>

        {/* 1. Vehicle Identity Card (if disclosed) */}
        {disclosedData.vehicleIdentity && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold">
              <Car className="w-5 h-5 text-blue-600" />
              <h3 className="text-base">Vehicle Specifications</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Manufacturer</span>
                <span className="text-sm font-bold text-slate-900">{disclosedData.vehicleIdentity.manufacturer}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Model / Variant</span>
                <span className="text-sm font-bold text-slate-900 truncate block">
                  {disclosedData.vehicleIdentity.model} ({disclosedData.vehicleIdentity.variant})
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Year / Powertrain</span>
                <span className="text-sm font-bold text-slate-900">
                  {disclosedData.vehicleIdentity.manufacturingYear} • {disclosedData.vehicleIdentity.fuelType}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Masked Registration</span>
                <span className="text-sm font-mono font-bold text-blue-700">
                  {disclosedData.vehicleIdentity.registrationNumberMasked}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Odometer Verification Card (if disclosed) */}
        {disclosedData.odometer && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold">
                <Gauge className="w-5 h-5 text-blue-600" />
                <h3 className="text-base">Verified Odometer Integrity</h3>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                {disclosedData.odometer.rollbackDetected ? '⚠ Rollback Detected' : '✓ Monotonic Verified'}
              </span>
            </div>

            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Latest Recorded Mileage</span>
                <span className="text-2xl font-black text-slate-900">
                  {disclosedData.odometer.currentReadingKm.toLocaleString()} km
                </span>
              </div>
              <div className="text-right text-xs text-slate-500">
                <span>Total Milestones: </span>
                <span className="font-bold text-slate-900">{disclosedData.odometer.readingsCount}</span>
              </div>
            </div>

            {disclosedData.odometer.history.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Reading Milestones</span>
                <div className="space-y-1.5">
                  {disclosedData.odometer.history.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                      <span className="font-bold text-slate-800">{r.readingKm.toLocaleString()} km</span>
                      <span className="text-slate-500">{new Date(r.readingDate).toLocaleDateString()}</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-medium">
                        {r.sourceType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. EV Battery Passport (if disclosed and applicable) */}
        {disclosedData.batteryPassport && disclosedData.batteryPassport.isApplicable && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="text-base">EV Battery Passport</h3>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                {disclosedData.batteryPassport.evidenceClassification}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nominal Capacity</span>
                <span className="text-base font-bold text-slate-900">{disclosedData.batteryPassport.nominalCapacityKwh} kWh</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Capacity</span>
                <span className="text-base font-bold text-slate-900">{disclosedData.batteryPassport.currentCapacityKwh} kWh</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Retained Capacity</span>
                <span className="text-base font-black text-emerald-600">{disclosedData.batteryPassport.capacityRetentionPercentage}%</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">State of Health</span>
                <span className="text-base font-black text-blue-600">{disclosedData.batteryPassport.sohPercentage}%</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Certified Service Records (if disclosed) */}
        {disclosedData.service && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h3 className="text-base">Certified Service History ({disclosedData.service.totalServices})</h3>
              </div>
              <span className="text-xs text-slate-500">Blockchain Anchored</span>
            </div>

            {disclosedData.service.records.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No service records registered yet.</p>
            ) : (
              <div className="space-y-2.5">
                {disclosedData.service.records.map((s, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{s.serviceType}</span>
                      <span className="text-[10px] text-slate-400">{new Date(s.serviceDate).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-600">{s.description}</p>
                    <div className="text-[10px] text-slate-400 pt-0.5">Recorded Odometer: {s.odometerReadingKm.toLocaleString()} km</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Accident & Repair History (if disclosed) */}
        {disclosedData.accident && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base">Accident & Repair Records</h3>
              </div>
              <span className="text-xs text-slate-500">{disclosedData.accident.totalAccidents} incidents documented</span>
            </div>

            {disclosedData.accident.records.length === 0 ? (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Clean incident history: Zero collision damage recorded on platform.
              </div>
            ) : (
              <div className="space-y-2.5">
                {disclosedData.accident.records.map((a, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Severity: {a.severity}</span>
                      <span className="text-[10px] text-slate-500">{new Date(a.accidentDate).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-600">Damage Area: {a.damageArea} • {a.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Vehicle Health & Risk (if disclosed) */}
        {(disclosedData.vehicleHealth || disclosedData.riskSummary) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disclosedData.vehicleHealth && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <HeartPulse className="w-5 h-5 text-rose-500" />
                    <h3 className="text-sm">Health Score</h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    {disclosedData.vehicleHealth.status}
                  </span>
                </div>
                <div className="text-3xl font-black text-slate-900">
                  {disclosedData.vehicleHealth.score} <span className="text-sm font-normal text-slate-400">/ 100</span>
                </div>
                <p className="text-xs text-slate-600">{disclosedData.vehicleHealth.summary}</p>
              </div>
            )}

            {disclosedData.riskSummary && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm">Risk Assessment</h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                    Level: {disclosedData.riskSummary.overallRiskLevel}
                  </span>
                </div>
                <div className="text-3xl font-black text-slate-900">
                  {disclosedData.riskSummary.overallRiskScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
                </div>
                <p className="text-xs text-slate-600">{disclosedData.riskSummary.summary}</p>
              </div>
            )}
          </div>
        )}

        {/* 7. Blockchain Proof Card (if disclosed) */}
        {disclosedData.blockchainProof && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm">Decentralized Blockchain Proof</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">EVM Smart Contract</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between">
                <span className="text-slate-500">Contract:</span>
                <span className="text-slate-800 truncate max-w-xs">{disclosedData.blockchainProof.contractAddress}</span>
              </div>
              {disclosedData.blockchainProof.genesisTxHash && (
                <div className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between">
                  <span className="text-slate-500">Genesis Tx:</span>
                  <span className="text-blue-600 truncate max-w-xs">{disclosedData.blockchainProof.genesisTxHash}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="pt-8 text-center text-xs text-slate-400 space-y-1">
          <p>Secured by Blockchain Vehicle Passport • Decentralized Provenance Infrastructure</p>
          <p>Sensitive owner PII and confidential records remain protected under selective disclosure protocol.</p>
        </footer>
      </main>
    </div>
  );
}
