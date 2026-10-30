'use client';

import React, { useState } from 'react';
import {
  FullVehicleVerificationReport,
  CategoryVerificationItem,
} from '../../types/vehicle';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Hash,
  Database,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface VerificationReportViewProps {
  report: FullVehicleVerificationReport | null;
  loading: boolean;
  onRunVerification: () => void;
  onSimulateTamperClick?: () => void;
}

export const VerificationReportView: React.FC<VerificationReportViewProps> = ({
  report,
  loading,
  onRunVerification,
  onSimulateTamperClick,
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const getCategoryStatusBadge = (
    status: 'VERIFIED' | 'SUSPICIOUS' | 'TAMPER_DETECTED' | 'EMPTY' | string,
    isSuspicious?: boolean
  ) => {
    if (status === 'TAMPER_DETECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          ✕ TAMPER DETECTED
        </span>
      );
    }
    if (status === 'SUSPICIOUS' || isSuspicious) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          ⚠ SUSPICIOUS
        </span>
      );
    }
    if (status === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ✓ VERIFIED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
        — NO RECORDS
      </span>
    );
  };

  const getOverallStatusBadge = () => {
    if (!report) return null;
    if (report.hasTamper) {
      return (
        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          STATUS: ✕ TAMPER DETECTED
        </span>
      );
    }
    if (report.hasSuspicious) {
      return (
        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          STATUS: ⚠ SUSPICIOUS (ODOMETER AUDIT)
        </span>
      );
    }
    if (report.overallVerified) {
      return (
        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          STATUS: ✓ FULLY VERIFIED
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        STATUS: PENDING VERIFICATION
      </span>
    );
  };

  const categoryList = report
    ? [
        {
          key: 'vehicleIdentity',
          label: '1. Vehicle Identity & Passport',
          status: report.vehicleIdentity.tamperDetected
            ? 'TAMPER_DETECTED'
            : report.vehicleIdentity.isVerified
            ? 'VERIFIED'
            : 'NOT_VERIFIED',
          count: 1,
          rollbackDetected: false,
          records: [
            {
              id: report.vehicleId,
              category: 'VEHICLE' as any,
              label: `${report.passportId} (${report.vin})`,
              isVerified: report.vehicleIdentity.isVerified,
              tamperDetected: report.vehicleIdentity.tamperDetected,
              isSuspicious: false,
              calculatedHash: report.vehicleIdentity.calculatedHash,
              onChainHash: report.vehicleIdentity.onChainHash,
              timestamp: report.verifiedAt,
              blockchainTxHash: null,
            },
          ],
        },
        {
          key: 'ownership',
          label: '2. Ownership History & Transfers',
          status: report.categories.ownership.status,
          count: report.categories.ownership.count,
          rollbackDetected: false,
          records: report.categories.ownership.records,
        },
        {
          key: 'service',
          label: '3. Service & Maintenance Records',
          status: report.categories.service.status,
          count: report.categories.service.count,
          rollbackDetected: false,
          records: report.categories.service.records,
        },
        {
          key: 'odometer',
          label: '4. Chronological Odometer Records',
          status: report.categories.odometer.status,
          count: report.categories.odometer.count,
          rollbackDetected: report.categories.odometer.rollbackDetected,
          records: report.categories.odometer.records,
        },
        {
          key: 'accident',
          label: '5. Accident & Repair History',
          status: report.categories.accident.status,
          count: report.categories.accident.count,
          rollbackDetected: false,
          records: report.categories.accident.records,
        },
        {
          key: 'insurance',
          label: '6. Insurance Coverage & Policies',
          status: report.categories.insurance.status,
          count: report.categories.insurance.count,
          rollbackDetected: false,
          records: report.categories.insurance.records,
        },
        {
          key: 'documents',
          label: '7. Digital Documents & File Hashes',
          status: report.categories.documents.status,
          count: report.categories.documents.count,
          rollbackDetected: false,
          records: report.categories.documents.records,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Full Vehicle Passport Verification Engine
                </h3>
                {getOverallStatusBadge()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Audits all off-chain PostgreSQL records against immutable on-chain smart contract hashes. No fake trust scores.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSimulateTamperClick && (
              <button
                type="button"
                onClick={onSimulateTamperClick}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition shadow-2xs"
              >
                ⚠ Tamper Simulation (Dev)
              </button>
            )}

            <button
              type="button"
              onClick={onRunVerification}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50 shadow-xs"
            >
              <ShieldCheck className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Auditing 7 Categories...' : 'Run Full Verification'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Verification Results Table */}
      {!report && !loading ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">Passport Audit Not Executed</h4>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
            Click &ldquo;Run Full Verification&rdquo; to compute canonical SHA-256 hashes across all 7 lifecycle categories and cross-verify with Hardhat smart contracts.
          </p>
          <button
            type="button"
            onClick={onRunVerification}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
          >
            Run Full Verification Now &rarr;
          </button>
        </div>
      ) : loading ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-600 font-medium">
            Fetching canonical records, re-computing SHA-256 hashes, and querying smart contract records...
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categoryList.map((cat) => {
            const isExpanded = expandedCategory === cat.key;
            return (
              <div
                key={cat.key}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition hover:border-slate-300"
              >
                <div
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{cat.label}</h4>
                      <p className="text-xs text-slate-500">
                        {cat.count} record{cat.count === 1 ? '' : 's'} audited
                        {cat.rollbackDetected && (
                          <span className="text-amber-600 font-bold ml-1">
                            &bull; Possible Odometer Rollback Detected
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getCategoryStatusBadge(cat.status, cat.rollbackDetected)}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 bg-slate-50/50 space-y-3 text-xs">
                    {cat.records.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px] py-2">
                        No records registered in this category yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {cat.records.map((rec, idx) => {
                          const isMatch = rec.isVerified && !rec.tamperDetected;
                          return (
                            <div
                              key={rec.id || idx}
                              className={`p-3 rounded-xl border bg-white ${
                                rec.tamperDetected
                                  ? 'border-rose-300 bg-rose-50/30'
                                  : rec.isSuspicious
                                  ? 'border-amber-300 bg-amber-50/30'
                                  : isMatch
                                  ? 'border-emerald-200/80'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-semibold text-slate-700 text-[11px]">
                                  Record #{idx + 1}: {rec.label || rec.id}
                                </span>
                                {rec.tamperDetected ? (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    ✕ HASH MISMATCH (TAMPER DETECTED)
                                  </span>
                                ) : rec.isSuspicious ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    ⚠ SUSPICIOUS (ROLLBACK)
                                  </span>
                                ) : isMatch ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    ✓ HASH MATCH (ON-CHAIN VERIFIED)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    — NOT VERIFIED
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                                <div className="bg-slate-50 p-2 rounded border border-slate-200/60">
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                                    Computed Database Hash
                                  </span>
                                  <span className="text-slate-700 break-all">{rec.calculatedHash}</span>
                                </div>

                                <div className="bg-slate-50 p-2 rounded border border-slate-200/60">
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                                    On-Chain Smart Contract Hash
                                  </span>
                                  <span className="text-slate-700 break-all">
                                    {rec.onChainHash || 'None / Not Anchored'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Verification Metadata */}
          {report && (
            <div className="p-4 rounded-xl bg-slate-100/80 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
              <span>Audited at: {new Date(report.verifiedAt).toLocaleString()}</span>
              <span className="font-mono">Network: {report.network} &bull; Passport: {report.passportId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
