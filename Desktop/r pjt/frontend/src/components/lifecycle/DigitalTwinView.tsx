'use client';

import React, { useState, useEffect } from 'react';
import {
  Vehicle,
  DigitalVehicleTwin,
  EvidenceLevel,
  EvidenceItem,
  VehicleStateEvolution,
  DigitalTwinTimelineEvent,
} from '../../types/vehicle';
import {
  fetchDigitalTwin,
} from '../../lib/api';
import { BuyerReportModal } from './BuyerReportModal';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileText,
  Clock,
  Gauge,
  Wrench,
  Car,
  FileCheck,
  Link as LinkIcon,
  RefreshCw,
  ExternalLink,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
} from 'lucide-react';

interface DigitalTwinViewProps {
  vehicle: Vehicle;
  token: string;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  vehicle,
  token,
}) => {
  const [twin, setTwin] = useState<DigitalVehicleTwin | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'evolution' | 'timeline' | 'evidence' | 'odometer' | 'maintenance'
  >('overview');

  // Buyer Report Modal state
  const [isBuyerReportOpen, setIsBuyerReportOpen] = useState<boolean>(false);

  // Evidence filter state
  const [evidenceFilter, setEvidenceFilter] = useState<string>('ALL');

  const loadTwin = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDigitalTwin(vehicle.id, token);
      if (res.success && res.data) {
        setTwin(res.data);
      } else {
        setError(res.error || 'Failed to reconstruct Digital Vehicle Twin');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching digital twin';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTwin();
  }, [vehicle.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTwin();
  };

  const getEvidenceLevelBadge = (level: EvidenceLevel) => {
    switch (level) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>VERIFIED</span>
          </span>
        );
      case 'DERIVED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span>DERIVED</span>
          </span>
        );
      case 'ESTIMATED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>ESTIMATED</span>
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            <span>UNKNOWN</span>
          </span>
        );
    }
  };

  if (loading && !twin) {
    return (
      <div className="py-24 text-center space-y-4 bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
        <h3 className="text-base font-bold text-slate-900">Reconstructing Digital Vehicle Twin...</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Rebuilding real-world lifecycle state from verified blockchain anchors, service records, odometer readings, and anomaly detection engines.
        </p>
      </div>
    );
  }

  if (error || !twin) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-rose-900">Digital Vehicle Twin Error</h3>
        <p className="text-sm text-rose-700">{error || 'Twin unavailable'}</p>
        <button
          onClick={loadTwin}
          className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
        >
          Retry Reconstruction
        </button>
      </div>
    );
  }

  const filteredEvidence = evidenceFilter === 'ALL'
    ? twin.evidenceRegistry
    : twin.evidenceRegistry.filter((e) => e.level === evidenceFilter);

  return (
    <div className="space-y-6">
      {/* Reconstructed State Snapshot Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 border-b border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Cpu className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                Enterprise Digital Twin
              </span>
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs text-slate-500 font-mono">Passport #{twin.passportId}</span>
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs text-slate-500 font-mono">VIN {twin.vin}</span>
            </div>

            <div className="flex items-baseline space-x-3">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {twin.identity.manufacturer} {twin.identity.model}
              </h1>
              <span className="text-base font-medium text-slate-500">
                {twin.identity.variant || ''} ({twin.identity.manufacturingYear})
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                {twin.identity.fuelType}
              </span>
            </div>

            <p className="text-xs text-slate-500 flex items-center space-x-2">
              <span>Reconstructed at {new Date(twin.reconstructedAt).toLocaleString()}</span>
              <span>&bull;</span>
              <span>Engine {twin.engineVersion}</span>
              <span>&bull;</span>
              <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                <Lock className="w-3 h-3 text-emerald-600" />
                <span>On-Chain Ground Truth</span>
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
            <button
              onClick={() => setIsBuyerReportOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
            >
              <FileText className="w-4 h-4" />
              <span>Used-Car Buyer Intelligence Report</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs shadow-sm transition"
              title="Refresh Twin Reconstruction"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            </button>
          </div>
        </div>

        {/* Snapshot Metrics Grid */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-white text-slate-800">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-500">Current Mileage</div>
            <div className="text-lg font-black text-slate-900 mt-1">
              {twin.odometer.currentMileage.toLocaleString()} km
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1">
              {twin.odometer.rollbackDetected ? (
                <span className="text-rose-600 font-bold">Rollback Anomaly</span>
              ) : (
                <span className="text-emerald-600 font-medium">Monotonic Validated</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-500">Current Owner</div>
            <div className="text-lg font-black text-slate-900 mt-1 truncate" title={twin.ownership.currentOwnerName}>
              {twin.ownership.currentOwnerName}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {twin.ownership.totalOwnersCount} Owner{twin.ownership.totalOwnersCount === 1 ? '' : 's'} ({twin.ownership.currentOwnershipDurationDays} days)
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-500">Service Coverage</div>
            <div className="text-lg font-black text-slate-900 mt-1">
              {twin.maintenance.serviceCoverageScore}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {twin.maintenance.totalServicesCount} Services Logged
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-500">Accident History</div>
            <div className="text-lg font-black text-slate-900 mt-1">
              {twin.accidents.totalAccidentsCount} Incidents
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {twin.accidents.openRepairsCount === 0 ? (
                <span className="text-emerald-600 font-medium">All Repaired</span>
              ) : (
                <span className="text-amber-600 font-bold">{twin.accidents.openRepairsCount} Open Repairs</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-500">Health & Risk</div>
            <div className="text-lg font-black text-slate-900 mt-1 flex items-center space-x-1.5">
              <span>{twin.intelligence.healthScore}/100</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-bold">
              Risk: <span className={twin.intelligence.riskLevel === 'CRITICAL' || twin.intelligence.riskLevel === 'HIGH' ? 'text-rose-600' : 'text-slate-700'}>{twin.intelligence.riskLevel}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-500">Blockchain Integrity</div>
            <div className="text-sm font-black mt-1.5">
              {twin.blockchain.integrityStatus === 'VERIFIED' ? (
                <span className="inline-flex items-center text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center text-rose-700 font-bold">
                  <ShieldAlert className="w-4 h-4 mr-1 text-rose-600" />
                  Tamper Detected
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {twin.blockchain.totalAnchoredRecords} Anchors on-chain
            </div>
          </div>
        </div>

        {/* Evidence Level Explanation Strip */}
        <div className="px-6 py-3 bg-slate-100/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-600 font-semibold">Evidence Classification System:</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-700"><strong>VERIFIED:</strong> Backed by cryptographic/on-chain proof</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="text-slate-700"><strong>DERIVED:</strong> Calculated from primary records</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span className="text-slate-700"><strong>ESTIMATED:</strong> Predictive intelligence</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              <span className="text-slate-700"><strong>UNKNOWN:</strong> Missing lifecycle data</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'overview', label: 'Domain State', icon: Layers },
          { id: 'evolution', label: 'State Evolution', icon: Activity },
          { id: 'timeline', label: 'Unified Timeline', icon: Clock },
          { id: 'evidence', label: 'Evidence Registry', icon: FileCheck },
          { id: 'odometer', label: 'Odometer Intelligence', icon: Gauge },
          { id: 'maintenance', label: 'Service Coverage', icon: Wrench },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-semibold text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview / Domain State */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Identity Domain */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Car className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">Vehicle Identity</h4>
              </div>
              {getEvidenceLevelBadge(twin.identity.level)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Registration:</span>
                <p className="font-bold text-slate-800">{twin.identity.registrationNumber}</p>
              </div>
              <div>
                <span className="text-slate-400">Lifecycle Status:</span>
                <p className="font-bold text-slate-800">{twin.identity.status}</p>
              </div>
              <div>
                <span className="text-slate-400">Color:</span>
                <p className="font-bold text-slate-800">{twin.identity.color || 'Not Specified'}</p>
              </div>
              <div>
                <span className="text-slate-400">Manufacturing Year:</span>
                <p className="font-bold text-slate-800">{twin.identity.manufacturingYear}</p>
              </div>
            </div>
          </div>

          {/* Ownership Domain */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">Current Ownership</h4>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {twin.ownership.totalOwnersCount} Owner{twin.ownership.totalOwnersCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Current Owner:</span>
                <p className="font-bold text-slate-800">{twin.ownership.currentOwnerName}</p>
              </div>
              <div>
                <span className="text-slate-400">Owner Role:</span>
                <p className="font-bold text-slate-800">{twin.ownership.currentOwnerRole}</p>
              </div>
              <div>
                <span className="text-slate-400">Ownership Duration:</span>
                <p className="font-bold text-slate-800">{twin.ownership.currentOwnershipDurationDays} Days</p>
              </div>
              <div>
                <span className="text-slate-400">Transfers Logged:</span>
                <p className="font-bold text-slate-800">{twin.ownership.transfersCount}</p>
              </div>
            </div>
          </div>

          {/* Odometer State */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">Odometer Progression</h4>
              </div>
              {getEvidenceLevelBadge('VERIFIED')}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Current Mileage:</span>
                <p className="font-bold text-slate-800">{twin.odometer.currentMileage.toLocaleString()} km</p>
              </div>
              <div>
                <span className="text-slate-400">Annual Velocity:</span>
                <p className="font-bold text-slate-800">{twin.odometer.averageAnnualMileageKm.toLocaleString()} km/yr</p>
              </div>
              <div>
                <span className="text-slate-400">Rollback Status:</span>
                <p className={`font-bold ${twin.odometer.rollbackDetected ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {twin.odometer.rollbackDetected ? 'Anomaly Detected' : 'Strictly Monotonic'}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Readings Recorded:</span>
                <p className="font-bold text-slate-800">{twin.odometer.totalReadingsCount} Points</p>
              </div>
            </div>
          </div>

          {/* Maintenance State */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">Maintenance Health</h4>
              </div>
              {getEvidenceLevelBadge('DERIVED')}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Service Coverage:</span>
                <p className="font-bold text-slate-800">{twin.maintenance.serviceCoverageScore}%</p>
              </div>
              <div>
                <span className="text-slate-400">Last Service Date:</span>
                <p className="font-bold text-slate-800">
                  {twin.maintenance.lastServiceDate ? new Date(twin.maintenance.lastServiceDate).toLocaleDateString() : 'None'}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Total Services:</span>
                <p className="font-bold text-slate-800">{twin.maintenance.totalServicesCount} Completed</p>
              </div>
              <div>
                <span className="text-slate-400">Service Gaps:</span>
                <p className={`font-bold ${twin.maintenance.serviceGapsDetected ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {twin.maintenance.serviceGapsDetected ? 'Gaps Detected' : 'Consistent'}
                </p>
              </div>
            </div>
          </div>

          {/* Accidents & Repairs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">Accidents & Repairs</h4>
              </div>
              {getEvidenceLevelBadge('VERIFIED')}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Total Accidents:</span>
                <p className="font-bold text-slate-800">{twin.accidents.totalAccidentsCount}</p>
              </div>
              <div>
                <span className="text-slate-400">Open Repairs:</span>
                <p className={`font-bold ${twin.accidents.openRepairsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {twin.accidents.openRepairsCount}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Severe Accidents:</span>
                <p className="font-bold text-slate-800">{twin.accidents.severeAccidentsCount}</p>
              </div>
              <div>
                <span className="text-slate-400">Certification:</span>
                <p className="font-bold text-slate-800">
                  {twin.accidents.totalAccidentsCount === 0 ? 'Clean Record' : twin.accidents.openRepairsCount === 0 ? 'Certified Repaired' : 'Pending'}
                </p>
              </div>
            </div>
          </div>

          {/* Blockchain Anchor Domain */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">Blockchain Anchoring</h4>
              </div>
              {getEvidenceLevelBadge(twin.blockchain.level)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Integrity:</span>
                <p className={`font-bold ${twin.blockchain.integrityStatus === 'VERIFIED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {twin.blockchain.integrityStatus}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Network:</span>
                <p className="font-bold text-slate-800">{twin.blockchain.network}</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Smart Contract:</span>
                <p className="font-mono text-[11px] text-slate-700 truncate" title={twin.blockchain.contractAddress}>
                  {twin.blockchain.contractAddress}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: State Evolution Progression */}
      {activeTab === 'evolution' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Vehicle State Evolution</h3>
              <p className="text-xs text-slate-500">
                Step-by-step physical and legal state transitions reconstructed from authoritative records.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {twin.stateEvolution.length} State Transitions
            </span>
          </div>

          <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-blue-200">
            {twin.stateEvolution.map((evo, index) => (
              <div key={index} className="relative group">
                {/* Node icon */}
                <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                </div>

                <div className="bg-slate-50 hover:bg-blue-50/30 border border-slate-200 rounded-xl p-4 transition space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                        {evo.state}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{evo.label}</h4>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-400 font-mono">
                        {new Date(evo.timestamp).toLocaleDateString()}
                      </span>
                      {evo.verificationStatus === 'VERIFIED' ? (
                        <span className="text-emerald-700 bg-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded">
                          VERIFIED
                        </span>
                      ) : (
                        <span className="text-amber-700 bg-amber-100 text-[10px] font-bold px-2 py-0.5 rounded">
                          {evo.verificationStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700">{evo.description}</p>

                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                    <span>Trigger: <strong className="text-slate-700">{evo.triggerEvent}</strong></span>
                    {evo.mileage && <span>Mileage: <strong>{evo.mileage.toLocaleString()} km</strong></span>}
                    {evo.actor && <span>Recorded by: <strong>{evo.actor}</strong></span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Unified Lifecycle Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Unified Digital Vehicle Timeline</h3>
              <p className="text-xs text-slate-500">
                Consolidated chronological events from registrations, services, accidents, insurance, and blockchain anchors.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {twin.timeline.length} Total Events
            </span>
          </div>

          <div className="space-y-3">
            {twin.timeline.map((event) => (
              <div
                key={event.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-slate-50/50 transition space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                      {event.category}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{event.title}</h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getEvidenceLevelBadge(event.level)}
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(event.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600">{event.description}</p>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                  <span>Logged by: <strong className="text-slate-600">{event.actor}</strong></span>
                  {event.blockchainTxHash && (
                    <span className="font-mono text-blue-600 truncate max-w-xs" title={event.blockchainTxHash}>
                      Tx: {event.blockchainTxHash.substring(0, 14)}...
                    </span>
                  )}
                  {event.evidenceRef && (
                    <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      Ref: {event.evidenceRef}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Evidence Registry */}
      {activeTab === 'evidence' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Digital Twin Evidence Registry</h3>
              <p className="text-xs text-slate-500">
                Traceable ledger explaining why the system believes each assertion.
              </p>
            </div>
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1.5">
              {['ALL', 'VERIFIED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setEvidenceFilter(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    evidenceFilter === lvl
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Evidence Claim</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Value</th>
                  <th className="py-2.5 px-3">Source Record</th>
                  <th className="py-2.5 px-3">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvidence.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.label}</td>
                    <td className="py-3 px-3">{getEvidenceLevelBadge(item.level)}</td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-800">
                      {typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {item.sourceRecordType ? `${item.sourceRecordType} #${item.sourceRecordId?.substring(0, 8) || ''}` : 'System Engine'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-[11px]">{item.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Odometer Intelligence */}
      {activeTab === 'odometer' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Odometer Progression & Rollback Intelligence</h3>
              <p className="text-xs text-slate-500">
                Verification of monotonic mileage progression and mathematical velocity tracking.
              </p>
            </div>
            {twin.odometer.rollbackDetected ? (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                Rollback Anomaly Detected
              </span>
            ) : (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Clean Monotonic Curve
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">Current Verified Mileage</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{twin.odometer.currentMileage.toLocaleString()} km</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">Average Annual Velocity</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{twin.odometer.averageAnnualMileageKm.toLocaleString()} km/yr</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">Daily Average Usage</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{twin.odometer.dailyMileageVelocityKm} km/day</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Chronological Readings Log</h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {twin.odometer.readingsHistory.map((rd, i) => (
                <div key={i} className="p-3 bg-white flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono">{new Date(rd.date).toLocaleDateString()}</span>
                  <span className="font-bold text-slate-900 text-sm">{rd.mileage.toLocaleString()} km</span>
                  <span className="text-[10px] text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">{rd.source}</span>
                  {getEvidenceLevelBadge(rd.level)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Maintenance & Service Coverage */}
      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Service Coverage Intelligence</h3>
              <p className="text-xs text-slate-500">
                Mathematical evaluation of service maintenance against automotive manufacturer guidelines.
              </p>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {twin.maintenance.serviceCoverageScore}% Coverage
            </span>
          </div>

          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Coverage Formula Specification</span>
            </div>
            <p className="text-xs text-slate-700 font-mono">
              {twin.maintenance.coverageFormulaExplanation}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Recorded Maintenance Events ({twin.maintenance.services.length})</h4>
            {twin.maintenance.services.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No service records registered for this vehicle.</p>
            ) : (
              <div className="space-y-2">
                {twin.maintenance.services.map((srv) => (
                  <div key={srv.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{srv.type}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-500">{srv.garageName}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(srv.date).toLocaleDateString()} at {srv.mileage.toLocaleString()} km
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      {srv.cost && <span className="font-mono font-bold text-slate-700">${srv.cost}</span>}
                      {getEvidenceLevelBadge(srv.level)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buyer Report Modal */}
      <BuyerReportModal
        vehicle={vehicle}
        token={token}
        isOpen={isBuyerReportOpen}
        onClose={() => setIsBuyerReportOpen(false)}
      />
    </div>
  );
};
