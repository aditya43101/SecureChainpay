'use client';

import React, { useState, useEffect } from 'react';
import {
  Vehicle,
  VehicleIntelligenceReport,
  VehicleHealthAssessment,
  VehicleRiskAssessment,
  PredictiveMaintenanceAssessment,
  DetectedAnomaly,
  AIQuestionResponse,
} from '../../types/vehicle';
import {
  fetchVehicleIntelligence,
  askVehicleIntelligenceAi,
} from '../../lib/api';
import {
  BrainCircuit,
  Activity,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Send,
  HelpCircle,
  ExternalLink,
  Flame,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface VehicleIntelligenceViewProps {
  vehicle: Vehicle;
  token: string;
}

export const VehicleIntelligenceView: React.FC<VehicleIntelligenceViewProps> = ({
  vehicle,
  token,
}) => {
  const [report, setReport] = useState<VehicleIntelligenceReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Sub-tabs inside intelligence view
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'health' | 'anomalies' | 'risk' | 'maintenance' | 'graph' | 'ai'
  >('overview');

  // Expanded states
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);

  // AI Assistant State
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiHistory, setAiHistory] = useState<
    Array<{ question: string; response: AIQuestionResponse }>
  >([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchVehicleIntelligence(vehicle.id, token);
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || 'Failed to load intelligence report');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching intelligence';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [vehicle.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReport();
  };

  const handleAskAi = async (questionToAsk?: string) => {
    const q = (questionToAsk || aiQuestion).trim();
    if (!q || !token) return;

    try {
      setAiLoading(true);
      setAiError(null);
      const res = await askVehicleIntelligenceAi(vehicle.id, q, token);
      if (res.success && res.data) {
        setAiHistory((prev) => [{ question: q, response: res.data! }, ...prev]);
        setAiQuestion('');
      } else {
        setAiError(res.error || 'Failed to get answer from AI Assistant');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI query failed';
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> EXCELLENT
          </span>
        );
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> GOOD
          </span>
        );
      case 'FAIR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" /> FAIR
          </span>
        );
      case 'POOR':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3.5 h-3.5" /> POOR
          </span>
        );
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" /> LOW RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" /> MEDIUM RISK
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
            <AlertCircle className="w-3.5 h-3.5" /> HIGH RISK
          </span>
        );
      case 'CRITICAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <Flame className="w-3.5 h-3.5 text-rose-600" /> CRITICAL RISK
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
            LOW
          </span>
        );
    }
  };

  const getUrgencyBadge = (urg: string) => {
    switch (urg) {
      case 'IMMEDIATE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
            DUE NOW
          </span>
        );
      case 'SOON':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            SOON
          </span>
        );
      case 'ROUTINE':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            ROUTINE
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h3 className="text-base font-bold text-slate-900">Running Vehicle Intelligence Engine...</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Evaluating cryptographic proofs, odometer telemetry, service chronology, accident repair
          consistency, and algorithmic predictive maintenance models.
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Intelligence Evaluation Failed</h3>
        <p className="text-xs text-rose-600 mt-1 mb-4">{error || 'Unknown error occurred'}</p>
        <button
          onClick={loadReport}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { health, risk, anomalies, predictiveMaintenance, evidenceGraph } = report;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-brand-600 text-white flex items-center justify-center shadow-sm">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Vehicle Intelligence Layer</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  AI Diagnostic Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Passport <span className="font-mono font-semibold text-slate-700">{report.passportId}</span> •{' '}
                VIN <span className="font-mono font-semibold text-slate-700">{report.vin}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMethodologyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Scoring Formula</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Evaluating...' : 'Re-Evaluate'}</span>
            </button>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-start gap-3">
          <Info className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <strong className="text-slate-900 font-semibold">Executive Assessment: </strong>
            {report.executiveSummary}
          </div>
        </div>

        {/* High-Level Score Badges Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 block">Health Score</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{health.overallScore}</span>
              <span className="text-xs text-slate-400 font-medium">/ 100</span>
              {getHealthBadge(health.status)}
            </div>
          </div>

          <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 block">Risk Evaluation</span>
            <div className="flex items-center gap-2 mt-1">
              {getRiskBadge(risk.overallRiskLevel)}
              <span className="text-xs font-bold text-slate-600">Score: {risk.overallRiskScore}</span>
            </div>
          </div>

          <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 block">Detected Anomalies</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-lg font-black ${
                  anomalies.totalCount > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {anomalies.totalCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({anomalies.criticalCount} crit, {anomalies.highCount} high)
              </span>
            </div>
          </div>

          <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 block">Maintenance Predictions</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-black text-brand-600">
                {predictiveMaintenance.predictions.length}
              </span>
              <span className="text-xs text-slate-500 font-medium">Telemetry-based items</span>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1 mt-5 pt-3 border-t border-slate-100 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'health', label: 'Health Score (Explainable)', icon: Activity },
            {
              id: 'anomalies',
              label: `Anomalies (${anomalies.totalCount})`,
              icon: AlertCircle,
              badge: anomalies.totalCount > 0,
            },
            { id: 'risk', label: 'Risk Drivers', icon: ShieldAlert },
            { id: 'maintenance', label: 'Predictive Maintenance', icon: Wrench },
            { id: 'graph', label: 'Evidence Graph', icon: Sparkles },
            { id: 'ai', label: 'Ask Intelligence AI', icon: BrainCircuit },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health Score Mini Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-600" />
                  Health Breakdown
                </h3>
                {getHealthBadge(health.status)}
              </div>

              <div className="my-4 text-center">
                <div className="inline-flex items-baseline justify-center">
                  <span className="text-5xl font-black text-slate-900">{health.overallScore}</span>
                  <span className="text-sm text-slate-400 font-bold ml-1">/ 100</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{health.summary}</p>
              </div>

              {/* Progress bars for top components */}
              <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
                {Object.values(health?.components || {}).map((comp) => (
                  <div key={comp.component} className="text-xs">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-600 font-medium">{comp.label}</span>
                      <span className="font-bold text-slate-800">{comp.score}/100</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          comp.score >= 85
                            ? 'bg-emerald-500'
                            : comp.score >= 70
                            ? 'bg-blue-500'
                            : comp.score >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${comp.score}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveSubTab('health')}
              className="mt-4 w-full flex items-center justify-center gap-1 py-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl transition"
            >
              <span>View Component Evidence & Deductions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary Risk Drivers */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-600" />
                  Primary Risk Drivers
                </h3>
                {getRiskBadge(risk.overallRiskLevel)}
              </div>

              <div className="mt-4 space-y-2">
                {(risk?.primaryRiskDrivers || []).length > 0 ? (
                  (risk?.primaryRiskDrivers || []).map((driver, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{driver}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                    <strong>No High Risk Factors Identified</strong>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      All cryptographic and operational metrics conform to expected benchmarks.
                    </p>
                  </div>
                )}
              </div>

              {/* Recommended Actions */}
              <div className="mt-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Recommended Actions
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {(risk?.recommendedActions || []).map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-brand-600 font-bold">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => setActiveSubTab('risk')}
              className="mt-4 w-full flex items-center justify-center gap-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              <span>Explore Risk Categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick AI & Next Maintenance */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-brand-600" />
                  Upcoming Maintenance
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {predictiveMaintenance?.currentMileage?.toLocaleString() || '24,500'} km
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {(predictiveMaintenance?.predictions || []).slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.title}
                      </span>
                      {getUrgencyBadge(item.urgency)}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                      {item.reason}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-600">
                        {item.status} ({item.confidence} confidence)
                      </span>
                      {item.estimatedDueMileage && (
                        <span>• Due @ {item.estimatedDueMileage.toLocaleString()} km</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveSubTab('maintenance')}
              className="mt-4 w-full flex items-center justify-center gap-1 py-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl transition"
            >
              <span>View Full Predictive Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB: HEALTH (EXPLAINABLE) */}
      {activeSubTab === 'health' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Explainable Vehicle Health Score
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculated using a transparent deterministic weighted-sum model. Every point
                  deduction references cryptographically verifiable on-chain or telemetry evidence.
                </p>
              </div>
              <button
                onClick={() => setShowMethodologyModal(true)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline"
              >
                Formula &amp; Weights
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {Object.values(health?.components || {}).map((comp) => {
              const isExpanded = expandedComponent === comp.component;
              return (
                <div
                  key={comp.component}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition"
                >
                  <div
                    onClick={() =>
                      setExpandedComponent(isExpanded ? null : comp.component)
                    }
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                          comp.score >= 85
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : comp.score >= 70
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : comp.score >= 50
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {comp.score}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{comp.label}</h4>
                          <span className="text-[10px] text-slate-400 font-medium">
                            (Weight: {Math.round(comp.weight * 100)}%)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{comp.explanation}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getHealthBadge(comp.status)}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3">
                      {/* Penalties */}
                      {comp.penalties.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">
                            Point Deductions Applied:
                          </span>
                          <div className="space-y-1">
                            {comp.penalties.map((pen, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs p-2 bg-rose-50/70 border border-rose-200 rounded-lg text-rose-900"
                              >
                                <span>{pen.reason}</span>
                                <span className="font-bold font-mono">
                                  -{pen.pointsDeducted} pts
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Positive Factors */}
                      {comp.positiveFactors.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                            Positive Factors:
                          </span>
                          <div className="space-y-1">
                            {comp.positiveFactors.map((pos, idx) => (
                              <div
                                key={idx}
                                className="text-xs p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                <span>{pos}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Evidence Trail */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Evidence Trail:
                        </span>
                        <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                          {comp.evidence.map((ev, idx) => (
                            <li key={idx} className="font-mono text-[11px]">
                              {ev}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB: ANOMALIES */}
      {activeSubTab === 'anomalies' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cryptographic &amp; Operational Anomaly Audit
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated verification checks: odometer rollback, velocity jumps, duplicate
                  services, chronology inversions, severe unresolved accidents, and on-chain hash
                  discrepancies.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                  {anomalies.criticalCount} Critical
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800">
                  {anomalies.highCount} High
                </span>
              </div>
            </div>
          </div>

          {anomalies.items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-emerald-200 p-10 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Zero Anomalies or Tampering Detected
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                All odometer readings are strictly monotonic, service records follow chronological
                timelines, accident repairs have been completed, and blockchain hashes match on-chain
                state.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(anomalies?.items || []).map((anom) => {
                const isExpanded = expandedAnomaly === anom.id;
                return (
                  <div
                    key={anom.id}
                    className="bg-white rounded-2xl border border-rose-200 overflow-hidden shadow-xs"
                  >
                    <div
                      onClick={() => setExpandedAnomaly(isExpanded ? null : anom.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-rose-50/30 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 flex-shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{anom.title}</span>
                            {getSeverityBadge(anom.severity)}
                            <span className="text-[10px] font-mono text-slate-400">
                              [{anom.category}]
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">{anom.explanation}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-rose-100 bg-rose-50/20 space-y-3 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-white border border-rose-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Expected Telemetry
                            </span>
                            <span className="font-mono text-slate-800 font-semibold block mt-0.5">
                              {anom.evidence.expected}
                            </span>
                          </div>

                          <div className="p-3 bg-white border border-rose-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Actual Recorded Value
                            </span>
                            <span className="font-mono text-rose-700 font-semibold block mt-0.5">
                              {anom.evidence.actual}
                            </span>
                          </div>
                        </div>

                        {anom.recommendation && (
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider block">
                              Audit Recommendation:
                            </span>
                            <p className="text-slate-700 mt-0.5">{anom.recommendation}</p>
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Associated Record Evidence:
                          </span>
                          <div className="space-y-1">
                            {anom.evidence.sourceRecords.map((rec, idx) => (
                              <div
                                key={idx}
                                className="font-mono text-[11px] p-2 bg-white rounded border border-slate-200 flex justify-between"
                              >
                                <span>
                                  {rec.type}: ID {rec.id} ({rec.date || 'No Date'})
                                </span>
                                <span className="font-bold text-slate-700">
                                  {rec.value !== undefined ? `Value: ${rec.value}` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: RISK */}
      {activeSubTab === 'risk' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Comprehensive Vehicle Risk Engine
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluates 8 categorical risk pillars from financial, safety, maintenance, and
                  cryptographic authenticity standpoints.
                </p>
              </div>
              {getRiskBadge(risk.overallRiskLevel)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(risk?.categories || {}).map((cat: any) => (
              <div
                key={cat.category}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">{cat.label}</h4>
                  {getRiskBadge(cat.riskLevel)}
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-700">Risk Score: {cat.score}/100</span>
                  <span className="text-[10px] text-slate-400">
                    ({cat.affectedRecordsCount || 0} affected records)
                  </span>
                </div>

                <p className="text-xs text-slate-600">{cat.reason}</p>

                {(cat.evidence || []).length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Evidence Trail:
                    </span>
                    <ul className="text-[11px] text-slate-500 space-y-0.5 list-disc list-inside font-mono">
                      {(cat.evidence || []).map((ev: any, idx: number) => (
                        <li key={idx}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: PREDICTIVE MAINTENANCE */}
      {activeSubTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Powertrain-Aware Predictive Maintenance
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {vehicle.fuelType} ARCHITECTURE
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Algorithmically scheduled from verified service logs, mileage velocity, and
                  powertrain specifications.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Current Telemetry</span>
                <span className="text-sm font-bold text-slate-800">
                  {predictiveMaintenance.currentMileage.toLocaleString()} km
                </span>
              </div>
            </div>

            <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Regulatory &amp; Engineering Notice: </strong>
                All items below are explicitly classified as <em>PREDICTED</em> or <em>ESTIMATED</em>.
                They reflect algorithmic maintenance recommendations and do not represent confirmed
                mechanical failures.
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {(predictiveMaintenance?.predictions || []).map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{item.title}</span>
                      {getUrgencyBadge(item.urgency)}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      System: {item.system} • Service: {item.recommendedServiceType}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      STATUS: {item.status}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      CONFIDENCE: {item.confidence}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{item.reason}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Due Mileage:</span>
                    <span className="font-bold text-slate-800">
                      {item.estimatedDueMileage
                        ? `${item.estimatedDueMileage.toLocaleString()} km`
                        : 'Interval Based'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Mileage Remaining:</span>
                    <span
                      className={`font-bold ${
                        (item.mileageRemaining || 0) <= 0 ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      {item.mileageRemaining !== undefined
                        ? `${item.mileageRemaining.toLocaleString()} km`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Recommended Interval:</span>
                    <span className="font-bold text-slate-800">
                      {item.supportingHistory.recommendedIntervalKm?.toLocaleString()} km
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Last Recorded:</span>
                    <span className="font-bold text-slate-800">
                      {item.supportingHistory.lastRelatedServiceMileage
                        ? `${item.supportingHistory.lastRelatedServiceMileage.toLocaleString()} km`
                        : 'No prior log'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: EVIDENCE GRAPH */}
      {activeSubTab === 'graph' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Cryptographic Evidence Relationship Graph
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizes how on-chain root anchors connect to lifecycle events and evidence nodes.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 block">Total Nodes</span>
                <span className="text-lg font-bold text-slate-900">
                  {evidenceGraph.nodes.length}
                </span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 block">Total Links</span>
                <span className="text-lg font-bold text-slate-900">
                  {evidenceGraph.links.length}
                </span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 block">Verified Anchors</span>
                <span className="text-lg font-bold text-emerald-600">
                  {evidenceGraph.nodes.filter((n) => n.status === 'VERIFIED').length}
                </span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 block">Tamper / Discrepancy</span>
                <span className="text-lg font-bold text-rose-600">
                  {
                    evidenceGraph.nodes.filter(
                      (n) => n.status === 'TAMPERED' || n.status === 'SUSPICIOUS'
                    ).length
                  }
                </span>
              </div>
            </div>

            {/* Nodes List */}
            <div className="space-y-2 mt-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Evidence Graph Topology:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(evidenceGraph?.nodes || []).map((node) => (
                  <div
                    key={node.id}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          node.status === 'VERIFIED'
                            ? 'bg-emerald-500'
                            : node.status === 'TAMPERED'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                      ></span>
                      <span className="font-semibold text-slate-800">{node.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">[{node.category}]</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: ASK INTELLIGENCE AI */}
      {activeSubTab === 'ai' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Evidence-Bounded AI Vehicle Assistant
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Strict Evidence Guardrails
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Answers strictly from verified blockchain anchors and cryptographic vehicle telemetry.
                Hallucinations are blocked.
              </p>
            </div>
          </div>

          {/* Quick Prompts */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Suggested Questions:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'Is there any odometer tampering detected on this vehicle?',
                'Summarize the overall health and safety of this car',
                'What predictive maintenance items should I service first?',
                'Explain why the vehicle risk level is what it is',
                'Are there any unaddressed severe accident repairs?',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskAi(suggestion)}
                  disabled={aiLoading}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
              placeholder="Ask anything about this vehicle's verified telemetry..."
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={() => handleAskAi()}
              disabled={aiLoading || !aiQuestion.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{aiLoading ? 'Analyzing...' : 'Ask AI'}</span>
            </button>
          </div>

          {aiError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {aiError}
            </div>
          )}

          {/* Conversation History */}
          <div className="space-y-3 mt-4">
            {aiHistory.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                    Q: {item.question}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Model: {item.response.modelIdentifier}
                  </span>
                </div>

                <div className="p-3 bg-white border border-slate-200/80 rounded-lg text-slate-800 leading-relaxed">
                  {item.response.answer}
                </div>

                {item.response.evidenceReferences.length > 0 && (
                  <div className="pt-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">Evidence Citing: </span>
                    {item.response.evidenceReferences.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Methodology Modal */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Health Scoring Formula &amp; Weights
              </h3>
              <button
                onClick={() => setShowMethodologyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The Vehicle Health Score is a deterministic weighted-sum metric (0–100). Each component
              is individually evaluated against verified database logs and blockchain state:
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="font-semibold text-slate-800">1. Blockchain Cryptographic Integrity</span>
                <span className="font-bold text-slate-900">25% (0.25)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="font-semibold text-slate-800">2. Odometer Telemetry &amp; Rollback</span>
                <span className="font-bold text-slate-900">20% (0.20)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="font-semibold text-slate-800">3. Service Compliance &amp; Continuity</span>
                <span className="font-bold text-slate-900">18% (0.18)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="font-semibold text-slate-800">4. Accident &amp; Repair History</span>
                <span className="font-bold text-slate-900">15% (0.15)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="font-semibold text-slate-800">5. Smart Document Consistency</span>
                <span className="font-bold text-slate-900">10% (0.10)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="font-semibold text-slate-800">6. Insurance Policy Continuity</span>
                <span className="font-bold text-slate-900">7% (0.07)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="font-semibold text-slate-800">7. Ownership Transfer Stability</span>
                <span className="font-bold text-slate-900">5% (0.05)</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-snug">
              <strong>100% Explainability Guarantee: </strong>
              Every deduction lists the exact rule triggered and the database record ID. No
              opaque or unexplainable black-box deductions are permitted.
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setShowMethodologyModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
