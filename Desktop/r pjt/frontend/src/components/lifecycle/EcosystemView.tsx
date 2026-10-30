'use client';

import React, { useState, useEffect } from 'react';
import {
  Vehicle,
  VehicleEcosystemOverview,
  ManufacturerCertificateDTO,
  BatteryPassportDTO,
  InsuranceIntelligenceReport,
  VehicleGarageIntelligence,
  EcosystemTimelineEvent,
  CreateManufacturerCertificateInput,
  LogBatteryEventInput,
  CreateInsuranceClaimInput,
} from '../../types/vehicle';
import {
  fetchVehicleEcosystem,
  createManufacturerCertificate,
  createBatteryPassport,
  logBatteryLifecycleEvent,
  fileInsuranceClaim,
} from '../../lib/api';
import {
  Building2,
  BatteryCharging,
  Shield,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Plus,
  FileText,
  Zap,
  Award,
  ChevronRight,
  Info,
  Car,
  Activity,
  Calendar,
  Lock,
} from 'lucide-react';

interface EcosystemViewProps {
  vehicle: Vehicle;
  token: string;
  userRole?: string;
  onRefreshVehicle?: () => void;
}

export const EcosystemView: React.FC<EcosystemViewProps> = ({
  vehicle,
  token,
  userRole,
  onRefreshVehicle,
}) => {
  const [ecosystem, setEcosystem] = useState<VehicleEcosystemOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activePillar, setActivePillar] = useState<
    'overview' | 'birth-cert' | 'battery' | 'insurance' | 'garages' | 'timeline'
  >('overview');

  // Modal / Form states
  const [showIssueCertModal, setShowIssueCertModal] = useState<boolean>(false);
  const [showLogBatteryModal, setShowLogBatteryModal] = useState<boolean>(false);
  const [showFileClaimModal, setShowFileClaimModal] = useState<boolean>(false);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form inputs
  const [plantInput, setPlantInput] = useState<string>('Main Assembly Plant 1');
  const [batteryEventType, setBatteryEventType] = useState<LogBatteryEventInput['eventType']>('BATTERY_INSPECTED');
  const [batteryCapInput, setBatteryCapInput] = useState<number>(39.8);
  const [batterySohInput, setBatterySohInput] = useState<number>(98.5);
  const [batteryCycleInput, setBatteryCycleInput] = useState<number>(85);
  const [batteryDescInput, setBatteryDescInput] = useState<string>('Periodic High-Voltage diagnostic and cell balancing scan');

  const [claimAmountInput, setClaimAmountInput] = useState<number>(18000);
  const [claimApprovedInput, setClaimApprovedInput] = useState<number>(16500);
  const [claimDescInput, setClaimDescInput] = useState<string>('OEM bumper & parking sensor replacement under policy coverage');
  const [claimAccidentId, setClaimAccidentId] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchVehicleEcosystem(vehicle.id, token);
      if (res.success && res.data) {
        setEcosystem(res.data);
      } else {
        setError(res.error || 'Failed to load vehicle ecosystem');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with ecosystem server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vehicle.id, token]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
    if (onRefreshVehicle) onRefreshVehicle();
  };

  const handleIssueBirthCert = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const res = await createManufacturerCertificate(
        vehicle.id,
        {
          manufacturingPlant: plantInput,
          manufacturingDate: `${vehicle.manufacturingYear}-01-15T00:00:00Z`,
          initialOdometer: 0,
          specificationSnapshot: {
            manufacturer: vehicle.manufacturer,
            model: vehicle.model,
            variant: vehicle.variant,
            fuelType: vehicle.fuelType,
            color: vehicle.color,
            assemblyLine: plantInput,
          },
        },
        token
      );
      if (res.success) {
        setShowIssueCertModal(false);
        loadData();
      } else {
        setFormError(res.error || 'Failed to issue birth certificate');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error issuing certificate');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleLogBatteryEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const res = await logBatteryLifecycleEvent(
        vehicle.id,
        {
          eventType: batteryEventType,
          capacityKwh: batteryCapInput,
          sohPercentage: batterySohInput,
          cycleCount: batteryCycleInput,
          description: batteryDescInput,
        },
        token
      );
      if (res.success) {
        setShowLogBatteryModal(false);
        loadData();
      } else {
        setFormError(res.error || 'Failed to log battery event');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error logging battery event');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const res = await fileInsuranceClaim(
        vehicle.id,
        {
          accidentRecordId: claimAccidentId || undefined,
          claimAmount: claimAmountInput,
          approvedAmount: claimApprovedInput,
          claimStatus: 'SETTLED',
          description: claimDescInput,
          claimDate: new Date().toISOString(),
          payoutDate: new Date().toISOString(),
        },
        token
      );
      if (res.success) {
        setShowFileClaimModal(false);
        loadData();
      } else {
        setFormError(res.error || 'Failed to file claim');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error filing claim');
    } finally {
      setFormSubmitting(false);
    }
  };

  if (loading && !ecosystem) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-800">Synthesizing Vehicle Ecosystem...</h3>
        <p className="text-sm text-slate-500 mt-1">
          Querying Manufacturer identity, EV Battery intelligence, Insurance policies, and Garage network.
        </p>
      </div>
    );
  }

  if (error || !ecosystem) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900">Ecosystem Unavailable</h3>
        <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{error || 'Could not load ecosystem intelligence.'}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    manufacturerCertificate: mfgCert,
    batteryPassport: bp,
    insuranceIntelligence: ins,
    garageIntelligence: garage,
    ecosystemTimeline,
    isEv,
  } = ecosystem;

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Ribbon */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                Automotive Ecosystem Network
              </span>
              <span className="text-xs text-slate-500 font-mono">{ecosystem.passportId}</span>
              {isEv && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-600" />
                  EV Traction Enabled
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Vehicle Industry & Ecosystem Trust Platform
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-stakeholder cryptographic provenance connecting Manufacturer, EV Battery, Insurance, and Garages.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Pillar Switcher Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pt-4 no-scrollbar">
          <button
            onClick={() => setActivePillar('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activePillar === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Ecosystem Overview
          </button>

          <button
            onClick={() => setActivePillar('birth-cert')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activePillar === 'birth-cert'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Birth Certificate
            {mfgCert && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            onClick={() => setActivePillar('battery')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activePillar === 'battery'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BatteryCharging className="w-3.5 h-3.5" />
            EV Battery Passport
            {isEv ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            ) : (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">N/A</span>
            )}
          </button>

          <button
            onClick={() => setActivePillar('insurance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activePillar === 'insurance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Insurance Intelligence
            {ins?.activePolicy && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            onClick={() => setActivePillar('garages')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activePillar === 'garages'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Garage Trust Network ({garage.servicingGaragesCount})
          </button>

          <button
            onClick={() => setActivePillar('timeline')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activePillar === 'timeline'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Ecosystem Timeline ({ecosystemTimeline.length})
          </button>
        </div>
      </div>

      {/* 2. SUB-VIEW: OVERVIEW */}
      {activePillar === 'overview' && (
        <div className="space-y-6">
          {/* Top 4 Pillars Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1: Manufacturer Birth Certificate */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:border-blue-200 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <Building2 className="w-5 h-5" />
                </span>
                {mfgCert ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    {mfgCert.verificationStatus}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                    Not Issued
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Manufacturer Certificate</h4>
              <p className="text-xs text-slate-500 mt-1">
                {mfgCert
                  ? `Certificate #${mfgCert.certificateNumber} anchored at 0 km`
                  : 'Vehicle lacks factory digital birth certificate.'}
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">{mfgCert ? mfgCert.manufacturerName : 'OEM'}</span>
                <button
                  onClick={() => setActivePillar('birth-cert')}
                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                >
                  View Details <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pillar 2: EV Battery Passport */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:border-emerald-200 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <BatteryCharging className="w-5 h-5" />
                </span>
                {isEv ? (
                  bp ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      SoH {bp.sohPercentage}%
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                      Pending Init
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                    Non-EV (ICE)
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-slate-800">EV Battery Passport</h4>
              <p className="text-xs text-slate-500 mt-1">
                {isEv
                  ? bp
                    ? `${bp.nominalCapacityKwh} kWh ${bp.chemistry} (${bp.events.length} lifecycle events)`
                    : 'EV traction battery requires initial registration.'
                  : `Traction battery passport is not applicable to ${vehicle.fuelType} vehicle.`}
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">{isEv && bp ? `${bp.cycleCount} Cycles` : 'N/A'}</span>
                <button
                  onClick={() => setActivePillar('battery')}
                  className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-0.5"
                >
                  {isEv ? 'Inspect Pack' : 'Status'} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pillar 3: Insurance Intelligence */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:border-indigo-200 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <Shield className="w-5 h-5" />
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    ins.coverageContinuity === 'CONTINUOUS'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                  }`}
                >
                  {ins.coverageContinuity}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Insurance Intelligence</h4>
              <p className="text-xs text-slate-500 mt-1">
                {ins?.activePolicy
                  ? `Active policy with ${ins.activePolicy.providerName || (ins.activePolicy as any).provider || 'SafeShield'}. ${ins.totalClaimsCount || 0} claim(s).`
                  : 'No active insurance coverage on record.'}
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">{ins?.accidentCorrelation?.correlationStatus || 'NO_CLAIMS'}</span>
                <button
                  onClick={() => setActivePillar('insurance')}
                  className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-0.5"
                >
                  Policy & Claims <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pillar 4: Garage Verification Intelligence */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:border-amber-200 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                  <Wrench className="w-5 h-5" />
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    garage?.allGaragesVerified
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                  }`}
                >
                  {garage?.allGaragesVerified ? 'Network Verified' : 'Mixed Verification'}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Garage Network</h4>
              <p className="text-xs text-slate-500 mt-1">
                {garage?.totalServicesPerformed || 2} certified service(s) performed across {garage?.servicingGaragesCount || 1} facility(ies).
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {garage?.networkSummary?.[0]?.garageName?.substring(0, 16) || 'Apex Network'}...
                </span>
                <button
                  onClick={() => setActivePillar('garages')}
                  className="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5"
                >
                  View Garages <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Ecosystem Provenance Architecture Diagram */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Vehicle Ecosystem Provenance Graph
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Decentralized relational map linking vehicle genesis to operational service and insurance coverage.
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-50 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200/60">
                Deterministic Source of Truth
              </span>
            </div>

            <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-6">
              <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto">
                {/* Node: Manufacturer */}
                <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-xl px-4 py-2.5 shadow-xs w-72 justify-center">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <div className="text-center">
                    <span className="text-xs font-semibold text-slate-800 block">Manufacturer (OEM)</span>
                    <span className="text-[11px] text-slate-500">
                      {mfgCert ? mfgCert.certificateNumber : 'Birth Certificate Anchor'}
                    </span>
                  </div>
                </div>

                <div className="w-0.5 h-5 bg-blue-300"></div>

                {/* Node: Central Vehicle Passport */}
                <div className="flex items-center gap-4 bg-blue-600 text-white rounded-2xl px-6 py-4 shadow-sm w-96 justify-between">
                  <div className="flex items-center gap-3">
                    <Car className="w-6 h-6 text-blue-200" />
                    <div>
                      <span className="text-sm font-bold block">{vehicle.manufacturer} {vehicle.model}</span>
                      <span className="text-xs text-blue-100 font-mono">{vehicle.passportId}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/80 text-white">
                    Core Anchor
                  </span>
                </div>

                {/* Branch Connectors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-2">
                  {/* Left: Garage Network */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-xs">
                    <Wrench className="w-4 h-4 text-amber-500 mx-auto mb-1.5" />
                    <span className="text-xs font-semibold text-slate-800 block">Garage Network</span>
                    <span className="text-[11px] text-slate-500">
                      {garage.servicingGaragesCount} Service Partner(s)
                    </span>
                    <div className="mt-2 text-[10px] text-emerald-600 font-medium">
                      {garage.totalServicesPerformed} Verified Record(s)
                    </div>
                  </div>

                  {/* Middle: EV Battery */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-xs">
                    <BatteryCharging className="w-4 h-4 text-emerald-500 mx-auto mb-1.5" />
                    <span className="text-xs font-semibold text-slate-800 block">Traction Battery</span>
                    <span className="text-[11px] text-slate-500">
                      {isEv ? (bp ? `${bp.nominalCapacityKwh} kWh LFP` : 'EV Compatible') : 'Not Applicable'}
                    </span>
                    <div className="mt-2 text-[10px] text-slate-600 font-medium">
                      {isEv && bp ? `SoH ${bp.sohPercentage}% (${bp.evidenceClassification})` : 'ICE Powertrain'}
                    </div>
                  </div>

                  {/* Right: Insurance Provider */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-xs">
                    <Shield className="w-4 h-4 text-indigo-500 mx-auto mb-1.5" />
                    <span className="text-xs font-semibold text-slate-800 block">Insurance Provider</span>
                    <span className="text-[11px] text-slate-500">
                      {ins.activePolicy ? ins.activePolicy.providerName : 'No Active Policy'}
                    </span>
                    <div className="mt-2 text-[10px] text-indigo-600 font-medium">
                      {ins.totalClaimsCount} Claim(s) Linked
                    </div>
                  </div>
                </div>

                <div className="w-full flex items-center justify-center pt-2">
                  <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-mono shadow-xs">
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    <span>On-Chain Cryptographic Consensus (Hardhat EVM Contract)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUB-VIEW: BIRTH CERTIFICATE */}
      {activePillar === 'birth-cert' && (
        <div className="space-y-6">
          {mfgCert ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {mfgCert.verificationStatus}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{mfgCert.certificateNumber}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">Manufacturer Digital Birth Certificate</h3>
                  <p className="text-xs text-slate-500">Cryptographically established at initial vehicle manufacturing assembly.</p>
                </div>

                {mfgCert.blockchainTxHash && (
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block font-mono">Blockchain Tx</span>
                    <a
                      href={`/explorer`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {mfgCert.blockchainTxHash.substring(0, 14)}...
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Certificate Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block">Manufacturing Plant</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    {mfgCert.manufacturingPlant || 'OEM Assembly Plant'}
                  </span>
                </div>
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block">Initial Genesis Odometer</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    {mfgCert.initialOdometer} km (Delivery Calibration)
                  </span>
                </div>
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block">Manufacturing Date</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    {new Date(mfgCert.manufacturingDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Technical Specifications Snapshot */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
                  Factory Technical Specification Snapshot
                </h4>
                <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto">
                  <pre>{JSON.stringify(mfgCert.specificationSnapshot, null, 2)}</pre>
                </div>
              </div>

              {/* Cryptographic Proof Card */}
              <div className="bg-blue-50/60 border border-blue-200/70 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Award className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-blue-900 block">Canonical Certificate Hash</span>
                    <span className="text-[11px] font-mono text-blue-700 break-all">{mfgCert.recordHash}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-white text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 shadow-2xs whitespace-nowrap self-start sm:self-auto">
                  Block #{mfgCert.blockNumber || 1}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No Birth Certificate Issued</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                This vehicle has not yet received a factory digital birth certificate anchor from an authorized manufacturer account.
              </p>

              {(userRole === 'MANUFACTURER' || userRole === 'ADMIN') && (
                <button
                  onClick={() => setShowIssueCertModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Issue Digital Birth Certificate
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. SUB-VIEW: EV BATTERY PASSPORT */}
      {activePillar === 'battery' && (
        <div className="space-y-6">
          {!isEv ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
              <BatteryCharging className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">Battery Passport Not Applicable</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                The traction battery lifecycle passport is strictly reserved for Electric (EV) and Plug-In Hybrid vehicles.
                This vehicle operates on a <strong>{vehicle.fuelType}</strong> internal combustion powertrain.
              </p>
            </div>
          ) : bp ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              {/* Battery Passport Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-600" />
                      Traction Pack Verified
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{bp.batterySerial}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">High-Voltage Battery Passport</h3>
                  <p className="text-xs text-slate-500">
                    Transparent degradation, chemistry specifications, and chronological service telemetry.
                  </p>
                </div>

                {(userRole === 'GARAGE' || userRole === 'MANUFACTURER' || userRole === 'ADMIN') && (
                  <button
                    onClick={() => setShowLogBatteryModal(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log Battery Event
                  </button>
                )}
              </div>

              {/* Capacity & Health Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
                  <span className="text-xs text-slate-500 block">State of Health (SoH)</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-emerald-700">{bp.sohPercentage}%</span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {bp.evidenceClassification}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, bp.sohPercentage)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block">Capacity Retention</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-slate-900">{bp.currentCapacityKwh}</span>
                    <span className="text-xs text-slate-500">/ {bp.nominalCapacityKwh} kWh</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {bp.capacityRetainedPercentage}% retained capacity
                  </span>
                </div>

                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block">Lifetime Charge Cycles</span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block">{bp.cycleCount}</span>
                  <span className="text-[11px] text-slate-500 mt-1 block">Standard full cycle equivalent</span>
                </div>

                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block">Chemistry Architecture</span>
                  <span className="text-sm font-semibold text-slate-900 mt-1 block">{bp.chemistry}</span>
                  <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
                    {bp.isOriginal ? 'Original OEM Pack' : 'Replacement Pack'}
                  </span>
                </div>
              </div>

              {/* Chronological Battery Event Ledger */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Battery Lifecycle Diagnostic Ledger
                </h4>
                <div className="space-y-3">
                  {bp.events.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-start gap-3">
                        <span className="p-2 rounded-lg bg-emerald-100/60 text-emerald-700 mt-0.5">
                          <Activity className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">
                              {evt.eventType.replace(/_/g, ' ')}
                            </span>
                            {evt.sohPercentage && (
                              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200/50">
                                {evt.sohPercentage}% SoH
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">{evt.description}</p>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Logged by {evt.recordedBy} on {new Date(evt.eventDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {evt.blockchainTxHash && (
                        <div className="text-right self-end sm:self-center">
                          <span className="text-[10px] text-slate-400 block font-mono">Proof</span>
                          <span className="text-[11px] text-blue-600 font-mono">
                            {evt.blockchainTxHash.substring(0, 10)}...
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
              <BatteryCharging className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">EV Battery Passport Not Initialized</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                This electric vehicle has not yet had its traction battery pack registered.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 5. SUB-VIEW: INSURANCE INTELLIGENCE */}
      {activePillar === 'insurance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Insurance Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      ins.coverageContinuity === 'CONTINUOUS'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    }`}
                  >
                    Coverage: {ins.coverageContinuity}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {ins.activePolicy ? ins.activePolicy.policyReference : 'No Active Policy'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">Insurance & Claim Correlation Intelligence</h3>
                <p className="text-xs text-slate-500">
                  Cross-referencing insurance policies, recorded collision events, and formal settlement claims.
                </p>
              </div>

              {(userRole === 'INSURANCE_PROVIDER' || userRole === 'ADMIN') && (
                <button
                  onClick={() => setShowFileClaimModal(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  File & Link Claim
                </button>
              )}
            </div>

            {/* Active Policy Card */}
            {ins.activePolicy && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-indigo-700 font-medium">Active Policy</span>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">{ins.activePolicy.providerName}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">{ins.activePolicy.coverageType}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Valid Until</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {new Date(ins.activePolicy.endDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            {/* Claims & Correlation Ledger */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Recorded Claims & Accident Linkage ({ins.totalClaimsCount})
              </h4>
              {ins.claims.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-500">
                  Zero insurance claims filed for this vehicle. Clean claims history.
                </div>
              ) : (
                <div className="space-y-3">
                  {ins.claims.map((claim) => (
                    <div
                      key={claim.id}
                      className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{claim.claimNumber}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            {claim.claimStatus}
                          </span>
                          {claim.accidentRecordId && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Accident Correlated
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-slate-600 font-semibold">
                          ${claim.approvedAmount?.toLocaleString() || claim.claimAmount?.toLocaleString()}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600">{claim.description}</p>

                      {claim.accidentDetails && (
                        <div className="bg-white p-3 rounded-lg border border-slate-100 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700 block mb-0.5">Linked Incident Evidence:</span>
                          Severity: <span className="capitalize text-slate-800">{claim.accidentDetails.severity}</span> •
                          Repair Status: <span className="capitalize text-slate-800">{claim.accidentDetails.repairStatus}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Risk Observations */}
            {ins.riskObservations.length > 0 && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60">
                <span className="text-xs font-semibold text-amber-900 block mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  Ecosystem Risk Observations
                </span>
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                  {ins.riskObservations.map((obs, idx) => (
                    <li key={idx}>{obs}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. SUB-VIEW: GARAGE NETWORK */}
      {activePillar === 'garages' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <h3 className="text-lg font-bold text-slate-900">Garage Verification & Trust Intelligence</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every service record evaluated against verified garage identity, blockchain anchors, and factual anomalies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {garage.networkSummary.map((g) => (
                <div
                  key={g.garageId}
                  className="p-5 bg-slate-50/70 rounded-xl border border-slate-200/90 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900">{g.garageName}</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Status: <strong className="text-slate-700">{g.verificationStatus}</strong>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-bold text-emerald-700">{g.trustIndex}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Trust Index</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Services Performed</span>
                      <span className="font-semibold text-slate-800">{g.servicesOnThisVehicle} on this vehicle</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Blockchain Anchors</span>
                      <span className="font-semibold text-slate-800">
                        {g.hasBlockchainAnchors ? 'Active & Confirmed' : 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. SUB-VIEW: TIMELINE */}
      {activePillar === 'timeline' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-5">
            <h3 className="text-lg font-bold text-slate-900">Unified Ecosystem Provenance Timeline</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidated chronological event log spanning Manufacturing, Traction Battery, Service, and Insurance.
            </p>
          </div>

          <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {ecosystemTimeline.map((item) => (
              <div key={item.id} className="relative pl-10">
                <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-2xs"></div>
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(item.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{item.description}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>Actor: {item.actor}</span>
                    {item.blockchainTxHash && (
                      <span className="font-mono text-blue-600">
                        Tx: {item.blockchainTxHash.substring(0, 10)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Issue Birth Certificate */}
      {showIssueCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Issue Digital Birth Certificate</h3>
            <p className="text-xs text-slate-500">
              Establish vehicle genesis identity on-chain with 0 km initial odometer reading.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleIssueBirthCert} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Manufacturing Assembly Plant</label>
                <input
                  type="text"
                  value={plantInput}
                  onChange={(e) => setPlantInput(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-blue-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueCertModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {formSubmitting ? 'Anchoring...' : 'Issue & Anchor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Log Battery Event */}
      {showLogBatteryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Log Battery Diagnostic Event</h3>
            <p className="text-xs text-slate-500">
              Record verified diagnostic telemetry and update the battery lifecycle passport.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleLogBatteryEvent} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Event Type</label>
                <select
                  value={batteryEventType}
                  onChange={(e) => setBatteryEventType(e.target.value as any)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                >
                  <option value="BATTERY_INSPECTED">BATTERY INSPECTED</option>
                  <option value="BATTERY_SERVICED">BATTERY SERVICED</option>
                  <option value="BATTERY_REPAIRED">BATTERY REPAIRED</option>
                  <option value="BATTERY_REPLACED">BATTERY REPLACED</option>
                  <option value="BATTERY_DECOMMISSIONED">BATTERY DECOMMISSIONED</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Measured Capacity (kWh)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={batteryCapInput}
                    onChange={(e) => setBatteryCapInput(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">State of Health (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={batterySohInput}
                    onChange={(e) => setBatterySohInput(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Cycle Count</label>
                <input
                  type="number"
                  value={batteryCycleInput}
                  onChange={(e) => setBatteryCycleInput(Number(e.target.value))}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Diagnostic Notes / Description</label>
                <textarea
                  value={batteryDescInput}
                  onChange={(e) => setBatteryDescInput(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                  rows={2}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogBatteryModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  {formSubmitting ? 'Logging...' : 'Save Diagnostic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: File Insurance Claim */}
      {showFileClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">File & Link Insurance Claim</h3>
            <p className="text-xs text-slate-500">
              Register formal insurance claim and correlate with documented vehicle accident.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleFileClaim} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Claim Amount ($)</label>
                  <input
                    type="number"
                    value={claimAmountInput}
                    onChange={(e) => setClaimAmountInput(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Approved Settlement ($)</label>
                  <input
                    type="number"
                    value={claimApprovedInput}
                    onChange={(e) => setClaimApprovedInput(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Claim Description</label>
                <textarea
                  value={claimDescInput}
                  onChange={(e) => setClaimDescInput(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                  rows={2}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFileClaimModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {formSubmitting ? 'Filing...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
