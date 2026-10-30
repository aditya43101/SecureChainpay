'use client';

import React, { useState } from 'react';
import { Vehicle } from '../../types/vehicle';
import { simulateTamperApi } from '../../lib/api';
import {
  AlertTriangle,
  X,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Flame,
  RotateCcw,
} from 'lucide-react';

interface TamperSimulationModalProps {
  vehicle: Vehicle;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onTampered: () => void;
}

export const TamperSimulationModal: React.FC<TamperSimulationModalProps> = ({
  vehicle,
  token,
  isOpen,
  onClose,
  onTampered,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSimulate = async (field: 'mileage' | 'service' | 'model') => {
    setError(null);
    setSubmitting(true);
    try {
      let payload: any = { field };
      if (field === 'mileage') {
        payload.tamperedValue = 28250;
      } else if (field === 'service') {
        payload.tamperedValue = 'TAMPERED: Counterfeit oil change recorded';
      } else if (field === 'model') {
        payload.tamperedValue = 'Nexon EV Ultra Tampered Edition';
      }

      const res = await simulateTamperApi(vehicle.id, payload, token);
      if (res.success && res.data) {
        setResult(res.data);
        setTimeout(() => {
          onTampered();
        }, 1200);
      } else {
        setError(res.error || 'Tamper simulation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Simulation error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-rose-300 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-rose-100 bg-rose-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-200 text-rose-800 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-rose-950">Development Tamper Simulation</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                  Dev Only
                </span>
              </div>
              <p className="text-xs text-rose-700">
                Directly corrupts off-chain database values without updating the on-chain smart contract hash.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              {error}
            </div>
          )}

          {result ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Tamper Mutation Applied to PostgreSQL</span>
              </div>
              <p className="text-[11px] text-amber-800">
                {result.message || 'Database record was modified. The smart contract still holds the original canonical hash.'}
              </p>
              <div className="p-2.5 rounded-lg bg-white border border-amber-200 font-mono text-[11px] space-y-1">
                <div>Field: <strong>{result.tamperedField}</strong></div>
                <div>Original Value: <span className="line-through text-slate-400">{String(result.originalValue)}</span></div>
                <div>Tampered Value: <span className="text-rose-600 font-bold">{String(result.tamperedValue)}</span></div>
              </div>
              <p className="text-[11px] text-slate-600">
                Now re-run the <strong>Verification Engine</strong> to observe the instant <code className="text-rose-700 font-bold">✕ TAMPER DETECTED</code> cryptographic status!
              </p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 leading-relaxed">
                Choose a simulation target to alter its database values directly. Since the smart contract proof was created from the original canonical data, the verification engine will recompute the hash, detect a mismatch, and reject the record.
              </div>

              <div className="space-y-2.5">
                {/* Simulation Option 1: Rollback Odometer */}
                <button
                  type="button"
                  onClick={() => handleSimulate('mileage')}
                  disabled={submitting}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/40 transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 group-hover:text-rose-700">
                      1. Corrupt Odometer Mileage (e.g. Rollback to 28,250 km)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 group-hover:bg-rose-100 text-slate-600">
                      Odometer Table
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1 text-[11px]">
                    Alters odometer mileage in DB. Blockchain hash reflects original mileage &rarr; triggers TAMPER DETECTED.
                  </p>
                </button>

                {/* Simulation Option 2: Alter Service Description */}
                <button
                  type="button"
                  onClick={() => handleSimulate('service')}
                  disabled={submitting}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/40 transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 group-hover:text-rose-700">
                      2. Alter Service Record Details
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 group-hover:bg-rose-100 text-slate-600">
                      Service Table
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1 text-[11px]">
                    Modifies description or parts replaced in the service log &rarr; canonical SHA-256 changes &rarr; triggers TAMPER DETECTED.
                  </p>
                </button>

                {/* Simulation Option 3: Alter Vehicle Core Model */}
                <button
                  type="button"
                  onClick={() => handleSimulate('model')}
                  disabled={submitting}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/40 transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 group-hover:text-rose-700">
                      3. Alter Vehicle Identity Model Name
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 group-hover:bg-rose-100 text-slate-600">
                      Vehicle Table
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1 text-[11px]">
                    Modifies vehicle model in DB &rarr; Vehicle canonical hash fails verification on-chain.
                  </p>
                </button>
              </div>
            </>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
            >
              {result ? 'Close & View Report' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
