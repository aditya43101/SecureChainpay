'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import {
  fetchMyVehicles,
  simulateTamperApi,
  restoreTamperApi,
  fetchFullVehicleVerification,
} from '../../lib/api';
import { Vehicle, FullVehicleVerificationReport } from '../../types/vehicle';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Flame,
  ArrowRight,
  ExternalLink,
  Lock,
  Layers,
  CheckCircle2,
  XCircle,
  FileCheck2,
  Wrench,
  Activity,
  Car,
  Clock,
  RefreshCw,
} from 'lucide-react';

export default function TamperLabPage() {
  const { user, token } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tampering, setTampering] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [report, setReport] = useState<FullVehicleVerificationReport | null>(null);
  const [tamperResult, setTamperResult] = useState<any | null>(null);
  const [activeScenario, setActiveScenario] = useState<string>('odometer');
  const [tamperValue, setTamperValue] = useState<string>('12000');

  // Load vehicles
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchMyVehicles(token)
      .then((res) => {
        if (res.success && res.data?.vehicles) {
          setVehicles(res.data.vehicles);
          if (res.data.vehicles.length > 0) {
            setSelectedVehicle(res.data.vehicles[0]);
          }
        }
      })
      .catch((err) => console.error('Error fetching vehicles:', err))
      .finally(() => setLoading(false));
  }, [token]);

  // Run verification whenever vehicle changes
  useEffect(() => {
    if (!selectedVehicle || !token) return;
    runVerification(selectedVehicle.id);
  }, [selectedVehicle, token]);

  const runVerification = async (vehicleId: string) => {
    if (!token) return;
    setVerifying(true);
    try {
      const res = await fetchFullVehicleVerification(vehicleId, token);
      if (res.success && res.data) {
        setReport(res.data);
      }
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateTamper = async (field: string, customVal?: any) => {
    if (!selectedVehicle || !token) return;
    setTampering(true);
    setTamperResult(null);

    try {
      const res = await simulateTamperApi(
        selectedVehicle.id,
        {
          field,
          tamperedValue: customVal !== undefined ? customVal : tamperValue,
        },
        token
      );

      if (res.success) {
        setTamperResult(res);
        // Refresh verification state immediately
        await runVerification(selectedVehicle.id);
      }
    } catch (err: any) {
      alert(`Tamper simulation failed: ${err.message}`);
    } finally {
      setTampering(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedVehicle || !token) return;
    setRestoring(true);
    try {
      const res = await restoreTamperApi(selectedVehicle.id, token);
      if (res.success) {
        setTamperResult(null);
        await runVerification(selectedVehicle.id);
      }
    } catch (err: any) {
      alert(`Failed to restore: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">


      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30">
              <Flame className="w-3.5 h-3.5" />
              <span>Dev Simulation Sandbox</span>
            </div>
            <h1 className="text-xl font-black tracking-tight">Simulate Fraud & Verify Blockchain Tamper Detection</h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Demonstrates how direct off-chain database alterations (odometer rollbacks, fraudulent service invoices, forged titles) are immediately detected because their computed canonical SHA-256 hashes differ from the immutable blockchain proof.
            </p>
          </div>

          {/* Vehicle Selector */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1 shrink-0 w-full md:w-64">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Select Target Vehicle:</span>
            <select
              value={selectedVehicle?.id || ''}
              onChange={(e) => {
                const found = vehicles.find((v) => v.id === e.target.value);
                if (found) setSelectedVehicle(found);
              }}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.passportId} — {v.manufacturer} {v.model}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Verification Status Banner */}
        {report && (
          <div
            className={`p-6 rounded-2xl border transition shadow-xs ${
              report.hasTamper
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : report.hasSuspicious
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                    report.hasTamper ? 'bg-rose-600' : report.hasSuspicious ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}
                >
                  {report.hasTamper ? (
                    <ShieldAlert className="w-7 h-7" />
                  ) : report.hasSuspicious ? (
                    <AlertTriangle className="w-7 h-7" />
                  ) : (
                    <ShieldCheck className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight">
                      {report.hasTamper
                        ? 'TAMPER DETECTED — Cryptographic Mismatch'
                        : report.hasSuspicious
                        ? 'SUSPICIOUS TIMELINE ANOMALY'
                        : 'ALL RECORDS CRYPTOGRAPHICALLY VERIFIED'}
                    </h2>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/80 border border-current">
                      {report.passportId}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 mt-0.5">
                    {report.hasTamper
                      ? 'One or more database records do not match the immutable cryptographic proofs anchored on the blockchain.'
                      : 'Every lifecycle record recalculated matches the exact 32-byte SHA-256 hash stored on the Ethereum smart contract.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => selectedVehicle && runVerification(selectedVehicle.id)}
                  disabled={verifying}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                  <span>Verify Now</span>
                </button>

                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1.5"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restoring ? 'animate-spin' : ''}`} />
                  <span>Restore Original Hashes</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5 Tamper Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Scenario 1: Odometer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">Scenario 1</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Odometer Fraud</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Rollback Odometer Reading</h3>
              <p className="text-xs text-slate-500 mt-1">
                Directly alters database mileage to 12,000 km. Blockchain hash remains anchored to 32,000 km.
              </p>
            </div>
            <button
              onClick={() => handleSimulateTamper('odometer', 12000)}
              disabled={tampering}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Odometer Rollback</span>
            </button>
          </div>

          {/* Scenario 2: Service */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">Scenario 2</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Maintenance Fraud</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Modify Service Record</h3>
              <p className="text-xs text-slate-500 mt-1">
                Alters garage maintenance log mileage to 99,999 km without garage signature.
              </p>
            </div>
            <button
              onClick={() => handleSimulateTamper('service', 99999)}
              disabled={tampering}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Service Modification</span>
            </button>
          </div>

          {/* Scenario 3: Accident */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">Scenario 3</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Accident Concealment</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Modify Accident Severity</h3>
              <p className="text-xs text-slate-500 mt-1">
                Alters collision severity in database from MINOR to SEVERE to test mismatch detection.
              </p>
            </div>
            <button
              onClick={() => handleSimulateTamper('accident', 'SEVERE')}
              disabled={tampering}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Accident Tamper</span>
            </button>
          </div>

          {/* Scenario 4: Ownership */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">Scenario 4</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Title Fraud</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Modify Ownership Transfer</h3>
              <p className="text-xs text-slate-500 mt-1">
                Modifies transfer audit notes in PostgreSQL to demonstrate title forgery detection.
              </p>
            </div>
            <button
              onClick={() => handleSimulateTamper('ownership', 'Fraudulent forged transfer ledger')}
              disabled={tampering}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Ownership Tamper</span>
            </button>
          </div>

          {/* Scenario 5: Document */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">Scenario 5</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Document Forgery</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Modify Document Metadata</h3>
              <p className="text-xs text-slate-500 mt-1">
                Alters registration certificate title/hash in database to simulate forged paperwork.
              </p>
            </div>
            <button
              onClick={() => handleSimulateTamper('document', 'Forged Registration Certificate')}
              disabled={tampering}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Document Tamper</span>
            </button>
          </div>

          {/* Scenario 6: Vehicle Identity */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">Scenario 6</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Identity Cloning</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Modify Vehicle Model</h3>
              <p className="text-xs text-slate-500 mt-1">
                Alters vehicle specification model name in database to simulate identity cloning.
              </p>
            </div>
            <button
              onClick={() => handleSimulateTamper('vehicleModel', 'Tampered Nexon GT-X')}
              disabled={tampering}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Model Tamper</span>
            </button>
          </div>
        </div>

        {/* Detailed Category Audit Breakdown */}
        {report && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Cryptographic Verification Breakdown</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Vehicle Identity */}
              <div className="p-4 rounded-xl border bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">1. Vehicle Identity Specification</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      report.vehicleIdentity.tamperDetected
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {report.vehicleIdentity.tamperDetected ? 'TAMPERED' : 'VERIFIED'}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-slate-500 space-y-1">
                  <div className="truncate">On-Chain: {report.vehicleIdentity.onChainHash || 'None'}</div>
                  <div className="truncate">Current DB: {report.vehicleIdentity.calculatedHash}</div>
                </div>
              </div>

              {/* Service Records */}
              <div className="p-4 rounded-xl border bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">2. Garage Service History</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      report.categories.service.status === 'TAMPER_DETECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {report.categories.service.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {report.categories.service.count} maintenance logs verified against on-chain service hashes.
                </p>
              </div>

              {/* Odometer Records */}
              <div className="p-4 rounded-xl border bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">3. Odometer Rollback Audit</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      report.categories.odometer.status === 'TAMPER_DETECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : report.categories.odometer.rollbackDetected
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {report.categories.odometer.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {report.categories.odometer.count} chronological readings. Rollback detected:{' '}
                  {report.categories.odometer.rollbackDetected ? 'YES' : 'NO'}.
                </p>
              </div>

              {/* Accident Records */}
              <div className="p-4 rounded-xl border bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">4. Accident & Repair Integrity</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      report.categories.accident.status === 'TAMPER_DETECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {report.categories.accident.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {report.categories.accident.count} collision/repair logs verified.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Blockchain Vehicle Passport Tamper Lab. Development sandboxing environment.</p>
        </div>
      </footer>
    </div>
  );
}
