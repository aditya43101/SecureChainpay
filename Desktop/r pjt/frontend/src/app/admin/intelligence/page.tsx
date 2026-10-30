'use strict';
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  Bot,
  Activity,
  Layers,
  Search,
  Database,
  Users,
  Car,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Filter,
  PlusCircle,
  FileText,
  Building,
  Network,
} from 'lucide-react';
import {
  fetchAdminOverview,
  fetchAdminBlockchainAnalytics,
  fetchAdminBlockchainRecords,
  fetchAdminTamperMonitoring,
  createAdminCase,
  updateAdminCase,
  fetchAdminDataQuality,
  fetchAdminAuditLogs,
  fetchAdminGlobalSearch,
} from '../../../lib/api';
import {
  AdminOverviewDTO,
  AdminBlockchainAnalyticsDTO,
  AdminCaseDTO,
  AdminAuditLogDTO,
  DataQualityAuditDTO,
} from '../../../types/vehicle';

export default function AdminIntelligenceDashboard() {
  const [token, setToken] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'blockchain' | 'tamper' | 'data-quality' | 'audit' | 'search'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [overview, setOverview] = useState<AdminOverviewDTO | null>(null);
  const [blockchain, setBlockchain] = useState<AdminBlockchainAnalyticsDTO | null>(null);
  const [cases, setCases] = useState<AdminCaseDTO[]>([]);
  const [auditAlerts, setAuditAlerts] = useState<any[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQualityAuditDTO | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);

  // Modals & form states
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [newCase, setNewCase] = useState({
    title: '',
    description: '',
    category: 'ODOMETER_ANOMALY',
    severity: 'MEDIUM',
  });

  useEffect(() => {
    // Resolve authentication token
    const storedToken =
      localStorage.getItem('vehicle_passport_token') ||
      localStorage.getItem('token') ||
      '';
    setToken(storedToken);
    if (storedToken) {
      loadAll(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const loadAll = async (authToken: string) => {
    try {
      setLoading(true);
      const [ovRes, bcRes, tmRes, dqRes, alRes] = await Promise.all([
        fetchAdminOverview(authToken).catch(() => ({ success: false, data: undefined })),
        fetchAdminBlockchainAnalytics(authToken).catch(() => ({ success: false, data: undefined })),
        fetchAdminTamperMonitoring(authToken).catch(() => ({ success: false, data: undefined })),
        fetchAdminDataQuality(authToken).catch(() => ({ success: false, data: undefined })),
        fetchAdminAuditLogs({ limit: 20 }, authToken).catch(() => ({ success: false, data: undefined })),
      ]);

      if (ovRes.success && ovRes.data) setOverview(ovRes.data);
      if (bcRes.success && bcRes.data) setBlockchain(bcRes.data);
      if (tmRes.success && tmRes.data) {
        setCases(tmRes.data.cases);
        setAuditAlerts(tmRes.data.recentAuditAlerts);
      }
      if (dqRes.success && dqRes.data) setDataQuality(dqRes.data);
      if (alRes.success && alRes.data) setAuditLogs(alRes.data.logs);
    } catch (err) {
      console.error('Failed to load admin intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll(token);
    setRefreshing(false);
  };

  const handleCreateCase = async () => {
    if (!newCase.title || !newCase.description) return;
    try {
      const res = await createAdminCase(newCase, token);
      if (res.success && res.data) {
        setCases([res.data, ...cases]);
        setShowCaseModal(false);
        setNewCase({ title: '', description: '', category: 'ODOMETER_ANOMALY', severity: 'MEDIUM' });
      }
    } catch (err) {
      console.error('Failed to create case:', err);
    }
  };

  const handleUpdateCaseStatus = async (caseId: string, newStatus: string) => {
    try {
      const res = await updateAdminCase(caseId, { status: newStatus }, token);
      if (res.success && res.data) {
        setCases(cases.map((c) => (c.id === caseId ? res.data! : c)));
      }
    } catch (err) {
      console.error('Failed to update case:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetchAdminGlobalSearch(searchQuery, token);
      if (res.success && res.data) {
        setSearchResults(res.data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-md">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Enterprise Operations</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">Admin Level 4</span>
              </div>
              <h1 className="text-lg font-black text-slate-900">System Intelligence & Operations Control</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <Link
              href="/intelligence/investigations"
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Investigation Agent</span>
            </Link>
            <Link
              href="/intelligence/fraud-graph"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Fraud Graph</span>
            </Link>
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
            >
              Exit to Dashboard
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 border-t border-slate-100 overflow-x-auto">
          {[
            { id: 'overview', label: 'System Overview & KPIs', icon: Activity },
            { id: 'blockchain', label: 'Blockchain Infrastructure', icon: Layers },
            { id: 'tamper', label: `Incident Cases (${cases.length})`, icon: ShieldAlert },
            { id: 'data-quality', label: 'Data Quality Audits', icon: Database },
            { id: 'audit', label: 'System Audit Trail', icon: FileText },
            { id: 'search', label: 'Global Entity Search', icon: Search },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-600">Loading System Telemetry & Audits...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: SYSTEM OVERVIEW */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Users</span>
                    <span className="text-2xl font-black text-slate-900">{overview.users.total}</span>
                    <p className="text-[11px] text-slate-500">
                      {overview.users.byRole['VEHICLE_OWNER'] || 0} Owners • {overview.users.byRole['GARAGE'] || 0} Garages
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Managed Vehicles</span>
                    <span className="text-2xl font-black text-slate-900">{overview.vehicles.total}</span>
                    <p className="text-[11px] text-slate-500">
                      {overview.vehicles.byFuel['ELECTRIC'] || 0} EVs • {overview.vehicles.byFuel['PETROL'] || 0} ICE
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">On-Chain Anchors</span>
                    <span className="text-2xl font-black text-emerald-600">{overview.blockchain.confirmed}</span>
                    <p className="text-[11px] text-slate-500">
                      {overview.blockchain.pending} Pending • {overview.blockchain.failed} Failed
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Admin Cases</span>
                    <span className={`text-2xl font-black ${cases.filter((c) => c.status === 'OPEN').length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                      {cases.filter((c) => c.status === 'OPEN').length}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {cases.filter((c) => c.status === 'RESOLVED').length} Resolved Cases
                    </p>
                  </div>
                </div>

                {/* Ecosystem Breakdown Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Lifecycle Totals */}
                  <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Lifecycle Provenance Ledger</h3>
                      <span className="text-xs text-slate-400">Total Entries</span>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Certified Garage Services', count: overview.lifecycleCounts.services },
                        { label: 'Odometer Milestone Readings', count: overview.lifecycleCounts.odometerReadings },
                        { label: 'Accident Incident Records', count: overview.lifecycleCounts.accidents },
                        { label: 'Insurance Policies Validated', count: overview.lifecycleCounts.insurances },
                        { label: 'Manufacturer Birth Certificates', count: overview.lifecycleCounts.manufacturerCertificates },
                        { label: 'EV Battery Passports', count: overview.lifecycleCounts.batteryPassports },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs">
                          <span className="font-medium text-slate-700">{item.label}</span>
                          <span className="font-bold text-slate-900">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trust & Integrity Health */}
                  <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Platform Trust & Verification Coverage</h3>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">100% Operational</span>
                    </div>
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Verification Requests Processed:</span>
                        <span className="font-bold text-slate-900">{overview.trustAndIntegrity.totalVerificationQueries}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Tamper Simulation Alerts:</span>
                        <span className="font-bold text-rose-600">{overview.trustAndIntegrity.tamperDetectionsLogged}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Verified Document Ratio:</span>
                        <span className="font-bold text-emerald-700">
                          {overview.documents.byConsistency['CONSISTENT'] || overview.documents.total} / {overview.documents.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BLOCKCHAIN INFRASTRUCTURE */}
            {activeTab === 'blockchain' && blockchain && (
              <div className="space-y-6">
                <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Decentralized EVM Node Telemetry</h3>
                      <p className="text-xs text-slate-500">Immutable smart contract anchoring on Ethereum-compatible network</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Node Online
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Network</span>
                      <span className="font-bold text-slate-900">{blockchain.network.name}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Contract Address</span>
                      <span className="font-bold text-blue-600 truncate block">{blockchain.network.contractAddress}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Latest Block Number</span>
                      <span className="font-bold text-slate-900">#{blockchain.network.currentBlockNumber}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Anchors */}
                <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Recent Cryptographic State Anchors</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="py-2.5">Record Type</th>
                          <th className="py-2.5">Vehicle Passport</th>
                          <th className="py-2.5">Tx Hash</th>
                          <th className="py-2.5">Block</th>
                          <th className="py-2.5">Status</th>
                          <th className="py-2.5">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {blockchain.recentAnchors.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 font-sans font-bold text-slate-900">{tx.recordType}</td>
                            <td className="py-2.5 text-blue-600 font-bold">{tx.passportId || 'N/A'}</td>
                            <td className="py-2.5 text-slate-500 truncate max-w-xs">{tx.txHash}</td>
                            <td className="py-2.5 text-slate-700">#{tx.blockNumber}</td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-sans text-[10px] font-bold">
                                {tx.status}
                              </span>
                            </td>
                            <td className="py-2.5 font-sans text-slate-400 text-[10px]">
                              {new Date(tx.timestamp).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TAMPER & ANOMALY INCIDENTS */}
            {activeTab === 'tamper' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Administrative Case Management</h3>
                    <p className="text-xs text-slate-500">Track and remediate potential fraud, tampering, or document mismatches</p>
                  </div>
                  <button
                    onClick={() => setShowCaseModal(true)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" /> Create Case
                  </button>
                </div>

                {cases.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-800">Zero Active Incident Cases</h4>
                    <p className="text-xs text-slate-500">No unhandled anomalies or integrity cases flagged on the platform.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cases.map((c) => (
                      <div
                        key={c.id}
                        className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-blue-600">{c.caseNumber}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  c.status === 'RESOLVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : c.status === 'OPEN'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {c.status}
                              </span>
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                                Severity: {c.severity}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 mt-1">{c.title}</h4>
                            <p className="text-xs text-slate-600 mt-0.5">{c.description}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            {c.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleUpdateCaseStatus(c.id, 'RESOLVED')}
                                className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors"
                              >
                                Mark Resolved
                              </button>
                            )}
                            {c.status === 'OPEN' && (
                              <button
                                onClick={() => handleUpdateCaseStatus(c.id, 'UNDER_REVIEW')}
                                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
                              >
                                Under Review
                              </button>
                            )}
                          </div>
                        </div>

                        {c.resolutionNotes && (
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600">
                            <span className="font-bold text-slate-800">Resolution: </span>
                            {c.resolutionNotes} (by {c.resolvedBy || 'Admin'})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: DATA QUALITY AUDITS */}
            {activeTab === 'data-quality' && dataQuality && (
              <div className="space-y-6">
                <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-base font-bold text-slate-900">Vehicle Data Quality Gaps</h3>
                  <p className="text-xs text-slate-500">Automated consistency auditing across vehicle lifecycle milestones</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Missing Odometer</span>
                      <span className="text-xl font-bold text-slate-900">{dataQuality.summary.missingOdometerCount} vehicles</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Missing Service</span>
                      <span className="text-xl font-bold text-slate-900">{dataQuality.summary.missingServiceCount} vehicles</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Missing Insurance</span>
                      <span className="text-xl font-bold text-slate-900">{dataQuality.summary.missingInsuranceCount} vehicles</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Doc Mismatches</span>
                      <span className="text-xl font-bold text-slate-900">{dataQuality.summary.documentMismatchesCount} docs</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SYSTEM AUDIT TRAIL */}
            {activeTab === 'audit' && (
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">Platform Security & Audit Trail</h3>
                  <span className="text-xs text-slate-400">Total Entries: {auditLogs.length}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-2.5">Action</th>
                        <th className="py-2.5">Actor</th>
                        <th className="py-2.5">Vehicle</th>
                        <th className="py-2.5">Details</th>
                        <th className="py-2.5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 font-bold text-slate-900">{log.action}</td>
                          <td className="py-2.5 text-slate-600">{log.actor}</td>
                          <td className="py-2.5 text-blue-600 font-medium">{log.passportId || 'N/A'}</td>
                          <td className="py-2.5 text-slate-500 font-mono text-[11px] truncate max-w-xs">
                            {log.details || '—'}
                          </td>
                          <td className="py-2.5 text-slate-400 text-[10px]">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: GLOBAL SEARCH */}
            {activeTab === 'search' && (
              <div className="space-y-6">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Passport ID, VIN, User Name, Email, Tx Hash..."
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Search
                  </button>
                </form>

                {searchResults && (
                  <div className="space-y-4">
                    {searchResults.vehicles.length > 0 && (
                      <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Vehicles</span>
                        <div className="space-y-1.5">
                          {searchResults.vehicles.map((v: any) => (
                            <div key={v.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
                              <span className="font-bold text-slate-900">{v.manufacturer} {v.model} ({v.passportId})</span>
                              <span className="text-slate-500">VIN: {v.vin}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Case Modal */}
      {showCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Create Administrative Incident Case</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  value={newCase.title}
                  onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  placeholder="e.g. Mileage Variance Investigation"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={newCase.category}
                  onChange={(e) => setNewCase({ ...newCase, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ODOMETER_ANOMALY">Odometer Anomaly</option>
                  <option value="TAMPER_DETECTION">Tamper Detection</option>
                  <option value="DOCUMENT_MISMATCH">Document Mismatch</option>
                  <option value="BLOCKCHAIN_MISMATCH">Blockchain Mismatch</option>
                  <option value="SUSPICIOUS_RECORD">Suspicious Record</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={newCase.description}
                  onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  rows={3}
                  placeholder="Details of the investigation..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCaseModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg"
              >
                Save Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
