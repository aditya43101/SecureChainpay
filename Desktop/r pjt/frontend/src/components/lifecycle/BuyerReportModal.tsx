'use client';

import React, { useState, useEffect } from 'react';
import {
  Vehicle,
  BuyerIntelligenceReport,
  BuyerQuestionToAsk,
  VerifiedFact,
  UnknownFact,
} from '../../types/vehicle';
import { fetchBuyerReport } from '../../lib/api';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileText,
  Printer,
  X,
  Gauge,
  Wrench,
  Car,
  Clock,
  Sparkles,
  Info,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Search,
  FileQuestion,
  Lock,
} from 'lucide-react';

interface BuyerReportModalProps {
  vehicle: Vehicle;
  token: string;
  isOpen: boolean;
  onClose: () => void;
}

export const BuyerReportModal: React.FC<BuyerReportModalProps> = ({
  vehicle,
  token,
  isOpen,
  onClose,
}) => {
  const [report, setReport] = useState<BuyerIntelligenceReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'all' | 'questions' | 'verified' | 'odometer' | 'service' | 'accidents'>('all');

  const loadReport = async () => {
    if (!isOpen) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchBuyerReport(vehicle.id, token);
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || 'Failed to generate buyer intelligence report');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching buyer report';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen, vehicle.id]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const getTrustBadgeStyle = (badge?: string) => {
    switch (badge) {
      case 'VERIFIED':
        return {
          bg: 'bg-emerald-500',
          border: 'border-emerald-600',
          text: 'text-white',
          icon: <ShieldCheck className="w-8 h-8 text-white" />,
          title: 'VERIFIED VEHICLE HISTORY',
          subtitle: 'Cryptographically verified on-chain. Records are consistent and complete.',
        };
      case 'PROCEED_WITH_CAUTION':
        return {
          bg: 'bg-amber-500',
          border: 'border-amber-600',
          text: 'text-white',
          icon: <AlertTriangle className="w-8 h-8 text-white" />,
          title: 'PROCEED WITH CAUTION',
          subtitle: 'Notable lifecycle gaps or unverified events detected. Review questions before buying.',
        };
      case 'HIGH_RISK_TAMPER':
      default:
        return {
          bg: 'bg-rose-600',
          border: 'border-rose-700',
          text: 'text-white',
          icon: <ShieldAlert className="w-8 h-8 text-white" />,
          title: 'HIGH RISK / ANOMALIES DETECTED',
          subtitle: 'Discrepancies, odometer rollback, or data tampering detected. Exercise extreme caution.',
        };
    }
  };

  const trustBadge = report ? getTrustBadgeStyle(report.trustSummary.overallTrustBadge) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Used-Car Buyer Intelligence Report</h2>
              <p className="text-xs text-slate-500">
                Independent Lifecycle Audit &bull; Passport #{vehicle.passportId} &bull; VIN {vehicle.vin}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-sm transition-colors"
              title="Print or Save as PDF"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={loadReport}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs shadow-sm transition-colors"
              title="Refresh Report"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto p-6 space-y-6 print:overflow-visible print:p-2">
          {loading && !report ? (
            <div className="py-20 text-center space-y-4">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
              <p className="text-sm font-semibold text-slate-700">Reconstructing Buyer Intelligence from Verified Records...</p>
              <p className="text-xs text-slate-500">Analyzing on-chain anchors, service intervals, odometer progression, and anomaly engines.</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
              <h3 className="text-base font-bold text-rose-900">Failed to Generate Buyer Intelligence</h3>
              <p className="text-sm text-rose-700">{error}</p>
              <button
                onClick={loadReport}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
              >
                Retry Audit
              </button>
            </div>
          ) : report && trustBadge ? (
            <>
              {/* Trust Badge Banner */}
              <div className={`${trustBadge.bg} rounded-xl p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    {trustBadge.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white/80">Independent Buyer Assessment</div>
                    <h3 className="text-xl font-extrabold tracking-tight">{trustBadge.title}</h3>
                    <p className="text-xs text-white/90 mt-0.5">{trustBadge.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-white/20">
                  <div className="text-center px-3 py-1.5 bg-white/10 rounded-lg">
                    <div className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Health Score</div>
                    <div className="text-xl font-black">{report.trustSummary.healthScore}/100</div>
                  </div>
                  <div className="text-center px-3 py-1.5 bg-white/10 rounded-lg">
                    <div className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Risk Level</div>
                    <div className="text-xl font-black">{report.trustSummary.riskLevel}</div>
                  </div>
                </div>
              </div>

              {/* Sub-Check Trust Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className={`p-3 rounded-lg border text-center ${report.trustSummary.blockchainVerified ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-rose-50/60 border-rose-200 text-rose-800'}`}>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Blockchain Anchor</div>
                  <div className="text-xs font-bold mt-1 flex items-center justify-center space-x-1">
                    {report.trustSummary.blockchainVerified ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>Verified</span></>
                    ) : (
                      <><ShieldAlert className="w-3.5 h-3.5 text-rose-600" /><span>Unanchored</span></>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border text-center ${report.trustSummary.odometerIntegrityVerified ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-rose-50/60 border-rose-200 text-rose-800'}`}>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Odometer Integrity</div>
                  <div className="text-xs font-bold mt-1 flex items-center justify-center space-x-1">
                    {report.trustSummary.odometerIntegrityVerified ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>Consistent</span></>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5 text-rose-600" /><span>Anomaly</span></>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border text-center ${report.trustSummary.serviceIntegrityVerified ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-amber-50/60 border-amber-200 text-amber-800'}`}>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Service Coverage</div>
                  <div className="text-xs font-bold mt-1 flex items-center justify-center space-x-1">
                    {report.trustSummary.serviceIntegrityVerified ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>Adequate</span></>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /><span>Service Gaps</span></>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border text-center ${report.trustSummary.accidentRepairsVerified ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-amber-50/60 border-amber-200 text-amber-800'}`}>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Repair Status</div>
                  <div className="text-xs font-bold mt-1 flex items-center justify-center space-x-1">
                    {report.trustSummary.accidentRepairsVerified ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>All Repaired</span></>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /><span>Pending Repair</span></>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border text-center col-span-2 sm:col-span-1 ${report.trustSummary.documentConsistencyVerified ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-amber-50/60 border-amber-200 text-amber-800'}`}>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Doc OCR Match</div>
                  <div className="text-xs font-bold mt-1 flex items-center justify-center space-x-1">
                    {report.trustSummary.documentConsistencyVerified ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>Consistent</span></>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /><span>Mismatch</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle Facts Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Make & Model:</span>
                  <p className="font-bold text-slate-900 text-sm">{report.overview.manufacturer} {report.overview.model} {report.overview.variant || ''}</p>
                </div>
                <div>
                  <span className="text-slate-500">Model Year / Age:</span>
                  <p className="font-bold text-slate-900 text-sm">{report.overview.manufacturingYear} ({report.overview.vehicleAgeYears} yrs old)</p>
                </div>
                <div>
                  <span className="text-slate-500">Verified Mileage:</span>
                  <p className="font-bold text-slate-900 text-sm">{report.overview.currentVerifiedMileage.toLocaleString()} km</p>
                </div>
                <div>
                  <span className="text-slate-500">Total Registered Owners:</span>
                  <p className="font-bold text-slate-900 text-sm">{report.overview.totalOwnersCount} Owner{report.overview.totalOwnersCount === 1 ? '' : 's'}</p>
                </div>
              </div>

              {/* Questions to Ask Seller Section */}
              <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                <div className="bg-blue-50/80 px-5 py-3 border-b border-blue-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileQuestion className="w-5 h-5 text-blue-700" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      Recommended Questions to Ask the Seller ({report.questionsToAskSeller.length})
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                    Derived from Verified Data Gaps
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {report.questionsToAskSeller.length === 0 ? (
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                      <p className="text-xs font-bold text-emerald-900">Zero Red Flags Detected</p>
                      <p className="text-xs text-emerald-700 mt-0.5">The vehicle lifecycle records are continuous, verifiable, and free of anomalies.</p>
                    </div>
                  ) : (
                    report.questionsToAskSeller.map((q) => (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 transition space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                              q.severity === 'HIGH'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : q.severity === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {q.severity} Priority
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{q.category}</span>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-900">“{q.question}”</p>
                        <div className="flex items-center space-x-1.5 text-xs text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200">
                          <Info className="w-4 h-4 text-blue-600 shrink-0" />
                          <span><strong className="text-slate-700">Why we ask:</strong> {q.contextReason}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* What is Verified vs What is Unknown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* What is Verified */}
                <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b border-emerald-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">What is Verified ({report.whatIsVerified.length})</h4>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {report.whatIsVerified.map((fact, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-semibold text-slate-800">{fact.fact}</p>
                          <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500">
                            <span>Source: <strong className="text-slate-600">{fact.source}</strong></span>
                            {fact.onChainVerified && (
                              <span className="text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.2 rounded">On-Chain</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* What is Unknown */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                    <HelpCircle className="w-5 h-5 text-amber-600" />
                    <h4 className="font-bold text-slate-900 text-sm">What is Unknown ({report.whatIsUnknown.length})</h4>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {report.whatIsUnknown.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-500">
                        No missing data items identified. Complete lifecycle records present.
                      </div>
                    ) : (
                      report.whatIsUnknown.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="font-semibold text-slate-800">{item.description}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              <strong className="text-slate-600">Buyer Impact:</strong> {item.impactReason}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Odometer Transparency & Service Intelligence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Odometer */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <Gauge className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Odometer Transparency</h4>
                    </div>
                    {report.odometerTransparency.rollbackDetected ? (
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Rollback Anomaly
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Monotonic Progression
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{report.odometerTransparency.statusExplanation}</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {report.odometerTransparency.progression.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 px-2.5 rounded bg-slate-50 text-xs border border-slate-100">
                        <span className="text-slate-500 font-mono">{new Date(item.date).toLocaleDateString()}</span>
                        <span className="font-bold text-slate-900">{item.mileage.toLocaleString()} km</span>
                        <span className="text-[10px] text-slate-400 uppercase">{item.source}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Service Intelligence */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <Wrench className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Maintenance & Service Gaps</h4>
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {report.serviceIntelligence.serviceCoveragePercentage}% Coverage
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full ${
                          report.serviceIntelligence.serviceCoveragePercentage >= 80
                            ? 'bg-emerald-500'
                            : report.serviceIntelligence.serviceCoveragePercentage >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, report.serviceIntelligence.serviceCoveragePercentage))}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Formula: {report.serviceIntelligence.coverageCalculationFormula}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-200">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Services Recorded:</span>
                        <span className="font-bold text-slate-800">{report.serviceIntelligence.totalServices}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last Service Date:</span>
                        <span className="font-bold text-slate-800">
                          {report.serviceIntelligence.lastServiceDate
                            ? new Date(report.serviceIntelligence.lastServiceDate).toLocaleDateString()
                            : 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Maintenance Status:</span>
                        <span className={`font-bold ${report.serviceIntelligence.isOverdueForService ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {report.serviceIntelligence.frequencyAssessment}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Accident & Repair Intelligence */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Car className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Accident & Certified Repairs</h4>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                    report.accidentIntelligence.totalAccidents === 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : report.accidentIntelligence.allRepairsCertified
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {report.accidentIntelligence.totalAccidents} Accident{report.accidentIntelligence.totalAccidents === 1 ? '' : 's'} &bull; {report.accidentIntelligence.allRepairsCertified ? 'All Repaired' : 'Pending Repair'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{report.accidentIntelligence.summary}</p>
                {report.accidentIntelligence.incidents.length > 0 && (
                  <div className="space-y-2">
                    {report.accidentIntelligence.incidents.map((incident, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-800">{new Date(incident.date).toLocaleDateString()}</span>
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                              {incident.severity}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-1">{incident.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            incident.repairStatus === 'REPAIRED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {incident.repairStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Structured Explanation Layer */}
              {report.aiAnalysis && (
                <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 rounded-xl border border-blue-200 p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Deterministic AI Buyer Synthesis</span>
                    <span className="text-[10px] text-blue-600 font-normal ml-auto">
                      Confidence: {Math.round(report.aiAnalysis.confidenceScore * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {report.aiAnalysis.summary}
                  </p>
                </div>
              )}

              {/* Report Footer / Audit Metadata */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
                <span>Audit Engine: {report.engineVersion} &bull; Generated: {new Date(report.generatedAt).toLocaleString()}</span>
                <span className="flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Evidence-first &bull; Anchored on Ethereum Hardhat Node</span>
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
