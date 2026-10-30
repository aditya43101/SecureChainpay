'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Bot,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Car,
  FileText,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  Sliders,
  Play,
  StopCircle,
  ExternalLink,
  ChevronRight,
  Database,
  KeyRound,
  FileCode,
  Sparkles,
  Layers,
  FileCheck,
  Activity,
  History,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  createInvestigationApi,
  listInvestigationsApi,
  getInvestigationApi,
  cancelInvestigationApi,
  getInvestigationReportApi,
  getInvestigationEvidenceApi,
  getInvestigationTimelineApi,
  getInvestigationOverviewApi,
  listInvestigationToolsApi,
  fetchMyVehicles,
} from '../../../lib/api';
import {
  InvestigationRunDTO,
  InvestigationStepDTO,
  InvestigationEvidenceDTO,
  InvestigationReportDTO,
  InvestigationOverviewDTO,
  InvestigationTypeEnum,
  Vehicle,
} from '../../../types/vehicle';

export default function AutonomousInvestigationConsolePage() {
  const { user, token: authToken } = useAuth();
  const [token, setToken] = useState<string>('');

  // Overview KPIs
  const [overview, setOverview] = useState<InvestigationOverviewDTO | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // List of runs
  const [runs, setRuns] = useState<InvestigationRunDTO[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Selected Run
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<InvestigationRunDTO | null>(null);
  const [report, setReport] = useState<InvestigationReportDTO | null>(null);
  const [evidenceList, setEvidenceList] = useState<InvestigationEvidenceDTO[]>([]);
  const [timelineSteps, setTimelineSteps] = useState<InvestigationStepDTO[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'REPORT' | 'TIMELINE' | 'EVIDENCE'>('REPORT');

  // New Investigation Modal State
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [investigationType, setInvestigationType] = useState<InvestigationTypeEnum>('ODOMETER_ROLLBACK');
  const [maxSteps, setMaxSteps] = useState<number>(10);
  const [executionBudgetMs, setExecutionBudgetMs] = useState<number>(60000);
  const [submittingRun, setSubmittingRun] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Available Tools Registry Inspection
  const [availableTools, setAvailableTools] = useState<any[]>([]);

  // Token initialization
  useEffect(() => {
    if (authToken) {
      setToken(authToken);
    }
  }, [authToken]);

  // Load initial dashboard overview and vehicles
  useEffect(() => {
    if (!token) return;

    loadDashboardData();
    loadVehicles();
    loadTools();
  }, [token]);

  // Auto-refresh active run if in RUNNING or QUEUED state
  useEffect(() => {
    if (!token || !selectedRunId || !activeRun) return;

    if (activeRun.status === 'RUNNING' || activeRun.status === 'QUEUED') {
      const interval = setInterval(() => {
        loadRunDetails(selectedRunId, false);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [token, selectedRunId, activeRun?.status]);

  async function loadDashboardData() {
    if (!token) return;
    setLoadingOverview(true);
    setLoadingRuns(true);
    try {
      const [overviewRes, listRes] = await Promise.all([
        getInvestigationOverviewApi(token),
        listInvestigationsApi({}, token),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }
      if (listRes.success && listRes.data) {
        setRuns(listRes.data.runs);
        if (listRes.data.runs.length > 0 && !selectedRunId) {
          selectRun(listRes.data.runs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoadingOverview(false);
      setLoadingRuns(false);
    }
  }

  async function loadVehicles() {
    if (!token) return;
    try {
      const res = await fetchMyVehicles(token);
      if (res.success && res.data) {
        const vList = Array.isArray(res.data) ? res.data : (res.data as any).vehicles || [];
        setVehicles(vList);
        if (vList.length > 0) {
          setSelectedVehicleId(vList[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load vehicles:', e);
    }
  }

  async function loadTools() {
    if (!token) return;
    try {
      const res = await listInvestigationToolsApi(token);
      if (res.success && res.data) {
        setAvailableTools(res.data);
      }
    } catch (e) {
      console.error('Failed to load tools:', e);
    }
  }

  async function selectRun(runId: string) {
    setSelectedRunId(runId);
    await loadRunDetails(runId, true);
  }

  async function loadRunDetails(runId: string, showSpinner = true) {
    if (!token) return;
    if (showSpinner) setLoadingDetails(true);

    try {
      const [runRes, reportRes, evidenceRes, timelineRes] = await Promise.all([
        getInvestigationApi(runId, token),
        getInvestigationReportApi(runId, token).catch(() => ({ success: false, data: undefined })),
        getInvestigationEvidenceApi(runId, token),
        getInvestigationTimelineApi(runId, token),
      ]);

      if (runRes.success && runRes.data) {
        setActiveRun(runRes.data);
      }
      if (reportRes.success && reportRes.data) {
        setReport(reportRes.data);
      } else {
        setReport(null);
      }
      if (evidenceRes.success && evidenceRes.data) {
        setEvidenceList(evidenceRes.data);
      }
      if (timelineRes.success && timelineRes.data) {
        setTimelineSteps(timelineRes.data);
      }
    } catch (err) {
      console.error('Error loading run details:', err);
    } finally {
      if (showSpinner) setLoadingDetails(false);
    }
  }

  async function handleStartInvestigation(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedVehicleId) return;

    setSubmittingRun(true);
    setSubmitError(null);

    try {
      const res = await createInvestigationApi(
        {
          targetType: 'VEHICLE',
          targetId: selectedVehicleId,
          vehicleId: selectedVehicleId,
          investigationType,
          maxSteps,
          executionBudgetMs,
          waitForCompletion: true,
        },
        token
      );

      if (res.success && res.data) {
        setShowNewModal(false);
        await loadDashboardData();
        selectRun(res.data.id);
      } else {
        setSubmitError(res.error || 'Failed to start investigation run.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Network error starting run.');
    } finally {
      setSubmittingRun(false);
    }
  }

  async function handleCancelRun(runId: string) {
    if (!token || !confirm('Are you sure you want to stop this investigation immediately?')) return;

    try {
      const res = await cancelInvestigationApi(runId, 'User requested immediate termination', token);
      if (res.success) {
        await loadRunDetails(runId, true);
        await loadDashboardData();
      }
    } catch (e) {
      console.error('Failed to cancel run:', e);
    }
  }

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      const matchesStatus = selectedStatus === 'ALL' || r.status === selectedStatus;
      const matchesSearch =
        searchQuery === '' ||
        r.runNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.vehicleId && r.vehicleId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.investigationType.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [runs, selectedStatus, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Top Context Sub-Banner */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Investigation Console</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                  Phase 8 Certified
                </span>
              </div>
              <p className="text-xs text-slate-500">Autonomous Evidence Correlation & Fraud Case Orchestration Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/intelligence/privacy"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-sky-50/60 border border-slate-200 transition"
            >
              <Lock className="w-3.5 h-3.5 text-sky-600" />
              <span>Privacy & ZKP Center</span>
            </Link>

            <Link
              href="/intelligence/fraud-graph"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-sky-50/60 border border-slate-200 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fraud Intelligence Graph</span>
            </Link>

            <button
              onClick={() => loadDashboardData()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
              title="Refresh console state"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm shadow-sky-600/30 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>New Investigation</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Metrics Dashboard Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">Total Runs</span>
              <Activity className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{loadingOverview ? '—' : overview?.totalRuns || 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Audited across lifetime</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm">
            <div className="flex items-center justify-between text-sky-600 mb-1">
              <span className="text-xs font-medium">Running</span>
              <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-sky-700">{loadingOverview ? '—' : overview?.runningRuns || 0}</div>
            <div className="text-[11px] text-sky-600/80 mt-0.5">Active step orchestrations</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-xs font-medium">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {loadingOverview ? '—' : overview?.completedRuns || 0}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5">Verified reports ready</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <span className="text-xs font-medium">Review Required</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {loadingOverview ? '—' : overview?.reviewRequiredRuns || 0}
            </div>
            <div className="text-[11px] text-amber-600/80 mt-0.5">Contradictions flagged</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
            <div className="flex items-center justify-between text-rose-600 mb-1">
              <span className="text-xs font-medium">Failed / Timed Out</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-700">{loadingOverview ? '—' : overview?.failedRuns || 0}</div>
            <div className="text-[11px] text-rose-600/80 mt-0.5">Bounded failures caught</div>
          </div>
        </div>

        {/* Main Work Area: Left Master List + Right Detail Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Investigation Runs List (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col h-[740px]">
            {/* Search and Filters Header */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by run #, vehicle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px]">
                {['ALL', 'COMPLETED', 'REVIEW_REQUIRED', 'RUNNING', 'FAILED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatus(st)}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition ${
                      selectedStatus === st
                        ? 'bg-sky-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {st === 'REVIEW_REQUIRED' ? 'REVIEW' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Runs Scrollable List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingRuns ? (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-sky-500" />
                  <span>Loading investigation runs...</span>
                </div>
              ) : filteredRuns.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                  <HelpCircle className="w-6 h-6 mx-auto text-slate-300" />
                  <p>No investigations found matching your filter criteria.</p>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="text-sky-600 hover:underline font-semibold"
                  >
                    Start a new investigation
                  </button>
                </div>
              ) : (
                filteredRuns.map((r) => {
                  const isSelected = r.id === selectedRunId;
                  return (
                    <div
                      key={r.id}
                      onClick={() => selectRun(r.id)}
                      className={`p-3.5 cursor-pointer transition flex flex-col space-y-1.5 ${
                        isSelected
                          ? 'bg-sky-50/70 border-l-4 border-sky-600'
                          : 'hover:bg-slate-50/80 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900">{r.runNumber}</span>
                        <StatusBadge status={r.status} />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="inline-flex items-center space-x-1 font-medium text-slate-700">
                          <Car className="w-3 h-3 text-slate-400" />
                          <span>{r.investigationType.replace('_', ' ')}</span>
                        </span>
                        <span>{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                        <span>{r.stepCount} steps executed</span>
                        <span>{r.evidenceCount} evidence items</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* List Footer Info */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
              Showing {filteredRuns.length} of {runs.length} runs
            </div>
          </div>

          {/* Right Column: Active Run Detail Console (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col min-h-[740px]">
            {activeRun ? (
              <>
                {/* Detail Header */}
                <div className="p-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-sky-50/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2.5">
                        <h2 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                          {activeRun.runNumber}
                        </h2>
                        <StatusBadge status={activeRun.status} />
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          v1.0
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Target: <span className="font-mono font-medium text-slate-700">{activeRun.targetId}</span> ({activeRun.targetType}) •
                        Started: {new Date(activeRun.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {(activeRun.status === 'RUNNING' || activeRun.status === 'QUEUED') && (
                        <button
                          onClick={() => handleCancelRun(activeRun.id)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                          <span>Stop Run</span>
                        </button>
                      )}

                      <button
                        onClick={() => loadRunDetails(activeRun.id, true)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition"
                        title="Reload details"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center space-x-6 border-b border-slate-100 mt-4 pt-1">
                    <button
                      onClick={() => setActiveTab('REPORT')}
                      className={`pb-2.5 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition ${
                        activeTab === 'REPORT'
                          ? 'border-sky-600 text-sky-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Investigation Report</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('TIMELINE')}
                      className={`pb-2.5 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition ${
                        activeTab === 'TIMELINE'
                          ? 'border-sky-600 text-sky-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Execution Timeline ({timelineSteps.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('EVIDENCE')}
                      className={`pb-2.5 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition ${
                        activeTab === 'EVIDENCE'
                          ? 'border-sky-600 text-sky-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Evidence Inventory ({evidenceList.length})</span>
                    </button>
                  </div>
                </div>

                {/* Tab Content Display Area */}
                <div className="p-5 flex-1 overflow-y-auto">
                  {loadingDetails ? (
                    <div className="py-20 text-center text-xs text-slate-400 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-sky-500 mx-auto" />
                      <p>Loading run details...</p>
                    </div>
                  ) : activeTab === 'REPORT' ? (
                    report ? (
                      <div className="space-y-6">
                        {/* Executive Summary Card */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50/50 to-white border border-sky-100 shadow-sm">
                          <div className="flex items-center space-x-2 text-sky-800 font-semibold text-xs uppercase tracking-wider mb-1.5">
                            <Sparkles className="w-4 h-4 text-sky-600" />
                            <span>Executive Synthesis</span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed font-sans">{report.executiveSummary}</p>
                        </div>

                        {/* Cryptographic Verification Matrix */}
                        <div className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-sm space-y-3">
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                            <ShieldCheck className="w-4 h-4 text-sky-600" />
                            <span>Cryptographic Commitment Verification Matrix</span>
                          </h3>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[11px] text-slate-500 block">Record Canonical Hash</span>
                              <span className="font-semibold text-emerald-700 flex items-center space-x-1 mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{report.verificationResults.canonicalHashing}</span>
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[11px] text-slate-500 block">Blockchain Anchor</span>
                              <span className="font-semibold text-emerald-700 flex items-center space-x-1 mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{report.verificationResults.blockchainAnchoring}</span>
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[11px] text-slate-500 block">Merkle Batch Inclusion</span>
                              <span className="font-semibold text-sky-700 flex items-center space-x-1 mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{report.verificationResults.merkleInclusion}</span>
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[11px] text-slate-500 block">Document Consistency</span>
                              <span className="font-semibold text-emerald-700 flex items-center space-x-1 mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{report.verificationResults.documentConsistency}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Structured Findings */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                              <ShieldAlert className="w-4 h-4 text-amber-500" />
                              <span>Evaluated Findings ({report.findings.length})</span>
                            </h3>
                            <span className="text-[11px] text-slate-400">Strictly grounded in persisted evidence</span>
                          </div>

                          {report.findings.length === 0 ? (
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 text-center">
                              No anomalies or contradictions detected during this investigation.
                            </div>
                          ) : (
                            report.findings.map((finding) => (
                              <div
                                key={finding.findingId}
                                className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-sm space-y-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2">
                                    <SeverityBadge severity={finding.severity} />
                                    <span className="font-bold text-xs text-slate-900">{finding.title}</span>
                                  </div>
                                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                    {finding.assessmentStatus}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-700 leading-relaxed">{finding.explanation}</p>

                                {/* Supporting Evidence Badges */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span className="text-[11px] text-slate-500 font-medium">Evidence citations:</span>
                                  {finding.supportingEvidenceRefs.map((ref) => (
                                    <span
                                      key={ref}
                                      className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-mono"
                                    >
                                      {ref}
                                    </span>
                                  ))}
                                  {finding.contradictingEvidenceRefs.map((ref) => (
                                    <span
                                      key={ref}
                                      className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-mono"
                                    >
                                      {ref} (contrasting)
                                    </span>
                                  ))}
                                </div>

                                {finding.recommendedNextSteps.length > 0 && (
                                  <div className="text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                    <span className="font-semibold text-slate-800">Recommended Action: </span>
                                    {finding.recommendedNextSteps.join('; ')}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Verified Facts & Unknowns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Verified Facts */}
                          <div className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-sm space-y-2">
                            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center space-x-1.5">
                              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Verified Record Facts ({report.verifiedFacts.length})</span>
                            </h4>
                            <ul className="space-y-1.5 text-xs text-slate-600">
                              {report.verifiedFacts.map((fact, idx) => (
                                <li key={idx} className="flex items-start space-x-2">
                                  <span className="text-emerald-500 font-bold">•</span>
                                  <span>{fact.claim}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Identified Unknowns */}
                          <div className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-sm space-y-2">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                              <span>Known Limitations & Gaps ({report.unknowns.length})</span>
                            </h4>
                            <ul className="space-y-1.5 text-xs text-slate-600">
                              {report.unknowns.map((unk, idx) => (
                                <li key={idx} className="flex items-start space-x-2">
                                  <span className="text-slate-400 font-bold">•</span>
                                  <span>{unk}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-20 text-center text-xs text-slate-400 space-y-2">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                        <p>Report is currently being synthesized or run terminated without artifacts.</p>
                      </div>
                    )
                  ) : activeTab === 'TIMELINE' ? (
                    /* Execution Timeline View */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Audited step executions in sequence</span>
                        <span>Execution time: {activeRun.executionDurationMs}ms</span>
                      </div>

                      <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-200">
                        {timelineSteps.map((step) => (
                          <div key={step.id} className="relative flex items-start space-x-3.5 pl-1">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                                step.status === 'COMPLETED'
                                  ? 'bg-emerald-500 text-white'
                                  : step.status === 'FAILED'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-300 text-slate-700'
                              }`}
                            >
                              {step.stepIndex}
                            </div>

                            <div className="flex-1 bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-slate-900">{step.toolName}</span>
                                <span className="text-[11px] font-mono text-slate-400">{step.durationMs}ms</span>
                              </div>
                              <p className="text-xs text-slate-600">{step.resultSummary || 'Executed successfully'}</p>
                              {step.errorMessage && (
                                <p className="text-xs text-rose-600 font-mono">{step.errorMessage}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Evidence Explorer View */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Persisted cryptographic evidence items</span>
                        <span>Total: {evidenceList.length}</span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="py-2.5 px-3">Evidence #</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Description</th>
                              <th className="py-2.5 px-3">Source ID</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {evidenceList.map((ev) => (
                              <tr key={ev.id} className="hover:bg-slate-50/60 transition">
                                <td className="py-2.5 px-3 font-mono font-bold text-sky-700">{ev.evidenceNumber}</td>
                                <td className="py-2.5 px-3 font-medium text-slate-700">{ev.evidenceType}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      ev.verificationStatus === 'VERIFIED'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : ev.verificationStatus === 'MISMATCH'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {ev.verificationStatus}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{ev.description}</td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                  {ev.sourceRecordId}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3">
                <Bot className="w-12 h-12 text-slate-300" />
                <h3 className="text-base font-semibold text-slate-700">Select an Investigation Run</h3>
                <p className="text-xs max-w-md text-slate-500">
                  Choose a run from the left ledger to inspect its executive report, chronological tool execution
                  timeline, and cryptographic evidence matrix.
                </p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start First Investigation</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Investigation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">Launch Autonomous Investigation</h3>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartInvestigation} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Target Vehicle Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Target Vehicle Passport</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 font-sans"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.passportId} — {v.manufacturer} {v.model} ({v.vin})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400">Strictly enforced against authenticated caller role</span>
              </div>

              {/* Investigation Type */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Investigation Workflow Type</label>
                <select
                  value={investigationType}
                  onChange={(e) => setInvestigationType(e.target.value as InvestigationTypeEnum)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 font-sans"
                >
                  <option value="ODOMETER_ROLLBACK">Odometer Rollback Investigation (Workflow A)</option>
                  <option value="OWNERSHIP_IDENTITY">Ownership & Identity Discrepancy (Workflow B)</option>
                  <option value="DOCUMENT_INTEGRITY">Document Integrity & Blockchain Anchor (Workflow C)</option>
                  <option value="FRAUD_GRAPH">Cross-Entity Fraud Graph Traversal (Workflow D)</option>
                  <option value="MULTI_SIGNAL">Multi-Signal Synthesis & Correlation (Workflow E)</option>
                  <option value="GENERAL">General Autonomous Vehicle Passport Audit</option>
                </select>
              </div>

              {/* Bounded Execution Budget Controls */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Step Ceiling</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Max 20 steps</span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Timeout (sec)</label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={executionBudgetMs / 1000}
                    onChange={(e) => setExecutionBudgetMs(parseInt(e.target.value, 10) * 1000)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Default 60s</span>
                </div>
              </div>

              {/* Safety Rules Banner */}
              <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-lg text-[11px] text-sky-900 space-y-1">
                <div className="font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  <span>Bounded Autonomy & Read-Only Invariants</span>
                </div>
                <p className="text-slate-600">
                  The agent only calls allowlisted project tools with resource-level authorization. It will never
                  mutate authoritative vehicle history or create unsupported accusations.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRun}
                  className="px-4 py-1.5 rounded-lg text-white bg-sky-600 hover:bg-sky-700 font-semibold shadow-sm transition flex items-center space-x-1.5"
                >
                  {submittingRun ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing Run...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Run</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          <span>COMPLETED</span>
        </span>
      );
    case 'REVIEW_REQUIRED':
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3" />
          <span>REVIEW REQ</span>
        </span>
      );
    case 'RUNNING':
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>RUNNING</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
          <StopCircle className="w-3 h-3" />
          <span>CANCELLED</span>
        </span>
      );
    case 'TIMED_OUT':
    case 'FAILED':
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3" />
          <span>{status}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
          {status}
        </span>
      );
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'CRITICAL':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          CRITICAL
        </span>
      );
    case 'HIGH':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          HIGH
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
          MEDIUM
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          {severity}
        </span>
      );
  }
}
