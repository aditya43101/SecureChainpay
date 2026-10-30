'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import {
  Car,
  Activity,
  History,
  GitBranch,
  ShieldCheck,
  Cpu,
  Layers,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  ArrowRight,
  Sliders,
  ExternalLink,
  Copy,
  Search,
  Key,
  Bot,
  Zap,
  RotateCcw,
  Gauge,
  Sparkles,
  ChevronRight,
  Info,
  Lock,
  Compass,
} from 'lucide-react';
import {
  fetchMyVehicles,
  getAutonomousTwinApi,
  getTwinEventsTimelineApi,
  syncTwinEventsApi,
  reconcileTwinApi,
  getTwinReconciliationsApi,
  simulateTwinScenarioApi,
  getTwinScenariosHistoryApi,
  handoffTwinAnomalyToInvestigationApi,
} from '../../../lib/api';
import {
  Vehicle,
  AutonomousDigitalVehicleTwinDTO,
  TwinLifecycleEventDTO,
  TwinScenarioType,
  ScenarioSimulationResultDTO,
  TwinReconciliationResultDTO,
} from '../../../types/vehicle';

export default function DigitalVehicleTwinControlCenterPage() {
  const { user, token: authToken, loginAsTestUser } = useAuth();
  const [token, setToken] = useState<string>('');

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TIMELINE' | 'PROVENANCE' | 'TRUST' | 'SIMULATOR' | 'RECONCILE'>('OVERVIEW');

  // Vehicle selection state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Twin Core State
  const [twin, setTwin] = useState<AutonomousDigitalVehicleTwinDTO | null>(null);
  const [loadingTwin, setLoadingTwin] = useState<boolean>(false);
  const [twinError, setTwinError] = useState<string | null>(null);

  // Timeline State
  const [timelineEvents, setTimelineEvents] = useState<TwinLifecycleEventDTO[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);
  const [eventFilter, setEventFilter] = useState<string>('ALL');
  const [syncingEvents, setSyncingEvents] = useState<boolean>(false);

  // Simulator State
  const [selectedScenarioType, setSelectedScenarioType] = useState<TwinScenarioType>('SCHEDULED_MAINTENANCE');
  const [simInputs, setSimInputs] = useState<Record<string, any>>({
    serviceType: 'Major Comprehensive Service',
    plannedMileage: 60000,
    cost: 450,
  });
  const [simulationResult, setSimulationResult] = useState<ScenarioSimulationResultDTO | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simHistory, setSimHistory] = useState<any[]>([]);

  // Reconciliation State
  const [reconciling, setReconciling] = useState<boolean>(false);
  const [reconciliationResult, setReconciliationResult] = useState<TwinReconciliationResultDTO | null>(null);
  const [reconciliationHistory, setReconciliationHistory] = useState<any[]>([]);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // Investigation Handoff Modal State
  const [showHandoffModal, setShowHandoffModal] = useState<boolean>(false);
  const [handoffForm, setHandoffForm] = useState({
    anomalyId: 'TWIN_ANOMALY_001',
    reason: 'Multi-signal divergence between event-sourced odometer timeline and recorded service ledger.',
    investigationType: 'MULTI_SIGNAL',
  });
  const [handoffLoading, setHandoffLoading] = useState<boolean>(false);
  const [handoffSuccessMsg, setHandoffSuccessMsg] = useState<string | null>(null);

  // Sync token from context or fallback
  useEffect(() => {
    if (authToken) {
      setToken(authToken);
    } else {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (stored) {
        setToken(stored);
      } else {
        const devToken = 'dev-seed-token:seed-admin:admin@vehiclepassport.dev:Platform Administrator';
        setToken(devToken);
        try { localStorage.setItem('token', devToken); } catch (_) {}
      }
    }
  }, [authToken]);

  // Load vehicles
  useEffect(() => {
    async function loadVehicles() {
      if (!token) {
        loadFallbackVehicles();
        return;
      }
      try {
        const res = await fetchMyVehicles(token);
        if (res.success && res.data) {
          const vList = Array.isArray(res.data) ? res.data : (res.data as any).vehicles || [];
          if (vList.length > 0) {
            setVehicles(vList);
            setSelectedVehicleId(vList[0].id);
            return;
          }
        }
        loadFallbackVehicles();
      } catch (err) {
        console.error('Failed to load user vehicles, loading fallback seed list:', err);
        loadFallbackVehicles();
      }
    }
    loadVehicles();
  }, [token]);

  function loadFallbackVehicles() {
    const demoVehicles: any[] = [
      {
        id: 'demo-veh-001-aurora',
        passportId: 'VP-DEMO-001',
        vin: 'DEMOV001X1SEDAN01',
        manufacturer: 'Aurora Motors',
        model: 'Aurora X1 Sedan',
        manufacturingYear: 2024,
        status: 'ACTIVE',
        fuelType: 'PETROL',
        registrationNumber: 'MH02DM1001',
      },
      {
        id: 'demo-veh-002-falcon',
        passportId: 'VP-DEMO-002',
        vin: 'DEMOV002E2ELEC002',
        manufacturer: 'Falcon Dynamics',
        model: 'Falcon E2 Electric Car',
        manufacturingYear: 2024,
        status: 'ACTIVE',
        fuelType: 'ELECTRIC',
        registrationNumber: 'MH02DM1002',
      },
      {
        id: 'demo-veh-008-orbit',
        passportId: 'VP-DEMO-008',
        vin: 'DEMOV008M2COMP008',
        manufacturer: 'Orbit Motors',
        model: 'Orbit M2 Compact Car',
        manufacturingYear: 2022,
        status: 'ACTIVE',
        fuelType: 'PETROL',
        registrationNumber: 'MH02DM1008',
      },
      {
        id: 'veh-001-nexon',
        passportId: 'VP-000001',
        vin: 'MAT622144P1A00001',
        manufacturer: 'Tata',
        model: 'Nexon EV',
        manufacturingYear: 2024,
        status: 'ACTIVE',
        fuelType: 'ELECTRIC',
        registrationNumber: 'MH02EV1001',
      },
      {
        id: 'veh-002-city',
        passportId: 'VP-000002',
        vin: 'MAK344122H1A00002',
        manufacturer: 'Honda',
        model: 'City',
        manufacturingYear: 2023,
        status: 'ACTIVE',
        fuelType: 'PETROL',
        registrationNumber: 'MH02HC2002',
      },
    ];
    setVehicles(demoVehicles);
    setSelectedVehicleId(demoVehicles[0].id);
  }

  // Set selected vehicle object
  useEffect(() => {
    if (selectedVehicleId && vehicles.length > 0) {
      const match = vehicles.find((v) => v.id === selectedVehicleId) || null;
      setSelectedVehicle(match);
      if (token) {
        loadAutonomousTwin(selectedVehicleId);
        loadEventTimeline(selectedVehicleId);
        loadScenarioHistory(selectedVehicleId);
        loadReconciliationHistory(selectedVehicleId);
      }
    }
  }, [selectedVehicleId, vehicles, token]);

  // Load Autonomous Twin Data
  async function loadAutonomousTwin(vehicleId: string) {
    if (!token) return;
    setLoadingTwin(true);
    setTwinError(null);
    try {
      const res = await getAutonomousTwinApi(vehicleId, token);
      if (res.success && res.data) {
        setTwin(res.data);
      } else {
        setTwinError(res.error || 'Failed to generate Autonomous Digital Twin');
      }
    } catch (err: any) {
      setTwinError(err.message || 'Error communicating with Digital Twin Service');
    } finally {
      setLoadingTwin(false);
    }
  }

  // Load Event Timeline
  async function loadEventTimeline(vehicleId: string) {
    if (!token) return;
    setLoadingTimeline(true);
    try {
      const res = await getTwinEventsTimelineApi(vehicleId, token);
      if (res.success && res.data) {
        setTimelineEvents(res.data.events || []);
      }
    } catch (err) {
      console.error('Failed to load event timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  }

  // Trigger Event Stream Sync
  async function handleSyncEvents() {
    if (!token || !selectedVehicleId) return;
    setSyncingEvents(true);
    try {
      const res = await syncTwinEventsApi(selectedVehicleId, token);
      if (res.success) {
        await loadEventTimeline(selectedVehicleId);
        await loadAutonomousTwin(selectedVehicleId);
      }
    } catch (err) {
      console.error('Failed to sync events:', err);
    } finally {
      setSyncingEvents(false);
    }
  }

  // Load Scenario History
  async function loadScenarioHistory(vehicleId: string) {
    if (!token) return;
    try {
      const res = await getTwinScenariosHistoryApi(vehicleId, token);
      if (res.success && res.data) {
        setSimHistory(res.data);
      }
    } catch (err) {
      console.error('Failed to load scenario history:', err);
    }
  }

  // Load Reconciliation History
  async function loadReconciliationHistory(vehicleId: string) {
    if (!token) return;
    try {
      const res = await getTwinReconciliationsApi(vehicleId, token);
      if (res.success && res.data) {
        setReconciliationHistory(res.data);
      }
    } catch (err) {
      console.error('Failed to load reconciliation history:', err);
    }
  }

  // Run What-If Simulation
  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedVehicleId) return;

    setSimulating(true);
    try {
      const res = await simulateTwinScenarioApi(
        selectedVehicleId,
        {
          scenarioType: selectedScenarioType,
          inputs: simInputs,
        },
        token
      );
      if (res.success && res.data) {
        setSimulationResult(res.data);
        await loadScenarioHistory(selectedVehicleId);
      }
    } catch (err: any) {
      console.error('Failed to execute simulation:', err);
    } finally {
      setSimulating(false);
    }
  }

  // Run Operational Reconciliation
  async function handleReconcile() {
    if (!token || !selectedVehicleId) return;

    setReconciling(true);
    setReconcileError(null);
    try {
      const res = await reconcileTwinApi(selectedVehicleId, token);
      if (res.success && res.data) {
        setReconciliationResult(res.data);
        await loadAutonomousTwin(selectedVehicleId);
        await loadReconciliationHistory(selectedVehicleId);
      } else {
        setReconcileError(res.error || 'Reconciliation failed.');
      }
    } catch (err: any) {
      setReconcileError(err.message || 'Operational reconciliation encountered an error.');
    } finally {
      setReconciling(false);
    }
  }

  // Handoff Anomaly to Investigation Agent
  async function handleHandoffInvestigation(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedVehicleId) return;

    setHandoffLoading(true);
    setHandoffSuccessMsg(null);
    try {
      const res = await handoffTwinAnomalyToInvestigationApi(
        selectedVehicleId,
        {
          anomalyId: handoffForm.anomalyId,
          reason: handoffForm.reason,
          investigationType: handoffForm.investigationType,
        },
        token
      );

      if (res.success && res.data) {
        setHandoffSuccessMsg(`Investigation Run #${res.data.runNumber || res.data.id} initiated successfully! Multi-agent swarm dispatched.`);
        setTimeout(() => {
          setShowHandoffModal(false);
          setHandoffSuccessMsg(null);
        }, 3000);
      }
    } catch (err: any) {
      console.error('Failed to handoff investigation:', err);
    } finally {
      setHandoffLoading(false);
    }
  }

  // Scenario form updater
  function handleScenarioTypeChange(type: TwinScenarioType) {
    setSelectedScenarioType(type);
    setSimulationResult(null);

    const baseMileage = twin?.derivedState.odometer.value.mileage || 50000;

    if (type === 'SCHEDULED_MAINTENANCE') {
      setSimInputs({
        serviceType: 'Major Scheduled Inspection',
        plannedMileage: baseMileage + 5000,
        cost: 450,
      });
    } else if (type === 'ODOMETER_PROJECTION') {
      setSimInputs({
        hypotheticalMileage: baseMileage + 12000,
        projectionMonths: 6,
      });
    } else if (type === 'OWNERSHIP_PRECHECK') {
      setSimInputs({
        proposedOwnerName: 'Certified Automotive Fleet Operator LLC',
        proposedOwnerRole: 'DEALER_FLEET',
      });
    } else if (type === 'BATTERY_DEGRADATION') {
      setSimInputs({
        projectedMonths: 24,
        annualMileageKm: 20000,
        fastDcPercentage: 45,
      });
    }
  }

  const filteredEvents = timelineEvents.filter((evt) => {
    if (eventFilter === 'ALL') return true;
    return evt.eventType.includes(eventFilter);
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Page Title & Context Banner */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-sm">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  TWIN SIMULATION
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                  AUTONOMOUS TWIN ENGINE
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Autonomous Digital Vehicle Twin Control Center
              </h1>
            </div>
          </div>

          {/* Quick Cross-Suite Links */}
          <div className="flex items-center space-x-2">
            <Link
              href="/intelligence/investigations"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-sky-50/60 border border-slate-200 transition"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Investigation Agent</span>
            </Link>

            <Link
              href="/intelligence/privacy"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-sky-50/60 border border-slate-200 transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Privacy ZKP</span>
            </Link>

            <Link
              href="/intelligence/fraud-graph"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-sky-50/60 border border-slate-200 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fraud Graph</span>
            </Link>

            {!token && (
              <button
                onClick={() => loginAsTestUser('owner@vehiclepassport.io')}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Dev Login</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Vehicle Selection Header Bar */}
        <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 font-bold text-xs">
              VIN
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Subject Vehicle</div>
              <div className="text-sm font-bold text-slate-900">
                {selectedVehicle
                  ? `${selectedVehicle.manufacturingYear || (selectedVehicle as any).year} ${
                      selectedVehicle.manufacturer || (selectedVehicle as any).make
                    } ${selectedVehicle.model}`
                  : 'Loading Vehicle...'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vin} ({v.manufacturingYear || (v as any).year} {v.manufacturer || (v as any).make} {v.model})
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                if (selectedVehicleId) {
                  loadAutonomousTwin(selectedVehicleId);
                  loadEventTimeline(selectedVehicleId);
                }
              }}
              disabled={loadingTwin}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
              title="Refresh Vehicle State"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTwin ? 'animate-spin text-sky-600' : ''}`} />
              <span>Sync Twin</span>
            </button>
          </div>
        </div>

        {/* 6-Tab Navigation Bar */}
        <div className="flex border-b border-slate-200 space-x-1 sm:space-x-3 overflow-x-auto">
          {[
            { id: 'OVERVIEW', label: 'Screen A: Twin Overview', icon: Activity },
            { id: 'TIMELINE', label: 'Screen B: Event Timeline', icon: History },
            { id: 'PROVENANCE', label: 'Screen C: State Provenance', icon: Compass },
            { id: 'TRUST', label: 'Screen D: Trust & Verification', icon: ShieldCheck },
            { id: 'SIMULATOR', label: 'Screen E: Scenario Simulator', icon: Cpu },
            { id: 'RECONCILE', label: 'Screen F: Data Reconciliation', icon: RotateCcw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? 'border-sky-600 text-sky-700 bg-sky-50/50 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Loading Spinner */}
        {loadingTwin && (
          <div className="p-8 text-center bg-white rounded-xl border border-sky-100">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Reconstructing Autonomous Digital Vehicle Twin & Provenance Matrix...</p>
          </div>
        )}

        {/* Error Notice */}
        {twinError && !loadingTwin && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{twinError}</span>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN A: TWIN OVERVIEW & FIVE-WAY ONTOLOGY                          */}
        {/* ==================================================================== */}
        {activeTab === 'OVERVIEW' && twin && !loadingTwin && (
          <div className="space-y-6">
            {/* Top KPI & Integrity Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Digital State Status</span>
                  <Activity className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-lg font-bold text-slate-900">{twin.summary.currentState}</div>
                <div className="text-xs text-emerald-600 font-medium mt-1 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{twin.summary.dataFreshness} Projection</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Recorded Odometer</span>
                  <Gauge className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {twin.derivedState.odometer.value.mileage.toLocaleString()} km
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  Daily Velocity: ~{twin.derivedState.odometer.value.dailyVelocityKm} km/day
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Health & Risk Index</span>
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {twin.summary.healthScore} / 100
                </div>
                <div className={`text-xs font-semibold mt-1 ${twin.summary.riskLevel === 'LOW' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Risk Classification: {twin.summary.riskLevel}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Cryptographic Trust Badge</span>
                  <Lock className="w-4 h-4 text-sky-600" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    twin.summary.trustBadge === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {twin.summary.trustBadge}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  {twin.eventsCount} Lifecycle Events Streamed
                </div>
              </div>
            </div>

            {/* Five-Way Ontological State Breakdown */}
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs overflow-hidden">
              <div className="bg-gradient-to-r from-sky-50 to-cyan-50 px-5 py-4 border-b border-sky-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Five-Way Ontological State Representation</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Strict formal separation between physical asset, ground truth records, verified proofs, derived projection, and what-if simulation.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-sky-700 bg-sky-100 px-2.5 py-1 rounded-md border border-sky-200">
                  SCHEMA v10.0
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-100 p-4">
                {/* Pillar A */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>A. Physical Vehicle</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded-md">
                    REAL WORLD ASSET
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {twin.ontology.physicalVehicle.observationNote}
                  </p>
                  <div className="text-xs text-slate-400 font-mono">telemetry: NOT_CONNECTED</div>
                </div>

                {/* Pillar B */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-sky-700 uppercase">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    <span>B. Recorded History</span>
                  </div>
                  <div className="text-xs font-semibold text-sky-900 bg-sky-50 px-2 py-1 rounded-md">
                    {twin.ontology.recordedHistory.totalSourceRecords} Ground Truth Records
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>• Odometer: {twin.ontology.recordedHistory.sourcesBreakdown.odometerReadings}</div>
                    <div>• Services: {twin.ontology.recordedHistory.sourcesBreakdown.serviceInvoices}</div>
                    <div>• Transfers: {twin.ontology.recordedHistory.sourcesBreakdown.ownershipTransfers}</div>
                    <div>• Documents: {twin.ontology.recordedHistory.sourcesBreakdown.uploadedDocuments}</div>
                  </div>
                </div>

                {/* Pillar C */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700 uppercase">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>C. Verified Claims</span>
                  </div>
                  <div className="text-xs font-semibold text-emerald-900 bg-emerald-50 px-2 py-1 rounded-md">
                    {twin.ontology.verifiedClaims.totalVerifiedClaims} Cryptographic Claims
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>• On-Chain Anchor: {twin.ontology.verifiedClaims.onChainAnchorVerified ? 'VERIFIED' : 'PENDING'}</div>
                    <div>• Merkle Batches: {twin.ontology.verifiedClaims.merkleBatchesVerified}</div>
                    <div>• ZKP Proofs: {twin.ontology.verifiedClaims.zkpRangeProofsVerified}</div>
                  </div>
                </div>

                {/* Pillar D */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-700 uppercase">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>D. Derived Digital State</span>
                  </div>
                  <div className="text-xs font-semibold text-indigo-900 bg-indigo-50 px-2 py-1 rounded-md">
                    COMPUTED PROJECTION
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Engine: {twin.ontology.derivedDigitalState.engineVersion}</div>
                    <div>Freshness: <span className="font-bold text-emerald-600">{twin.ontology.derivedDigitalState.freshness}</span></div>
                    <div>Drift: {twin.ontology.derivedDigitalState.driftDetected ? 'DETECTED' : 'NONE'}</div>
                  </div>
                </div>

                {/* Pillar E */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-700 uppercase">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>E. Simulated State</span>
                  </div>
                  <div className="text-xs font-semibold text-amber-900 bg-amber-50 px-2 py-1 rounded-md">
                    {twin.ontology.simulatedFutureState.activeSimulationsCount} Scenarios Run
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {twin.ontology.simulatedFutureState.simulationNotice}
                  </p>
                  <div className="text-xs font-mono text-emerald-600 font-bold">isSimulated: false</div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Investigation Handoff Banner */}
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Autonomous Investigation Integration</div>
                  <div className="text-xs text-slate-600">
                    Directly dispatch Autonomous Investigation Agent swarm from detected Digital Twin anomalies.
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowHandoffModal(true)}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs transition inline-flex items-center space-x-1.5"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Dispatch Agent Case</span>
                </button>
                <button
                  onClick={() => setActiveTab('SIMULATOR')}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1.5"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Launch Simulator</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN B: EVENT-SOURCED LIFECYCLE TIMELINE STREAM                    */}
        {/* ==================================================================== */}
        {activeTab === 'TIMELINE' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Event-Sourced Lifecycle Stream</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deterministic chronology distinguishing event occurrence, database ingestion, and actor provenance.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5"
                  >
                    <option value="ALL">All Event Types ({timelineEvents.length})</option>
                    <option value="ODOMETER">Odometer Records</option>
                    <option value="SERVICE">Service & Maintenance</option>
                    <option value="OWNERSHIP">Ownership Transfers</option>
                    <option value="DOCUMENT">Document Verification</option>
                    <option value="MERKLE">Merkle Anchoring</option>
                    <option value="PRIVACY">Privacy & ZKP</option>
                  </select>

                  <button
                    onClick={handleSyncEvents}
                    disabled={syncingEvents}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingEvents ? 'animate-spin' : ''}`} />
                    <span>Sync Life Events</span>
                  </button>
                </div>
              </div>

              {loadingTimeline ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading chronological event stream...</p>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No lifecycle events recorded for the selected filter. Click &quot;Sync Life Events&quot; to ingest source records.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((evt, idx) => (
                    <div
                      key={evt.id}
                      className="p-3.5 rounded-lg border border-slate-200 hover:border-sky-300 bg-slate-50/50 hover:bg-white transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{evt.eventType}</span>
                          <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                            evt.sourceVerificationStatus === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {evt.sourceVerificationStatus}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 font-medium">{evt.sourceSystem}</span>
                        </div>
                        <p className="text-slate-600">{evt.summary}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400 font-mono text-[11px] pt-1">
                          <span>Event Time: {new Date(evt.eventTime).toLocaleDateString()}</span>
                          <span>Recorded: {new Date(evt.recordedTime).toLocaleDateString()}</span>
                          <span>Ingestion: {new Date(evt.ingestionTime).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <div className="text-right md:min-w-[200px] shrink-0 space-y-1 font-mono text-[11px] text-slate-500">
                        <div>Idempotency: {evt.idempotencyKey.slice(0, 14)}...</div>
                        {evt.blockchainTxHash && (
                          <div className="text-sky-600 flex items-center md:justify-end space-x-1">
                            <span>Tx: {evt.blockchainTxHash.slice(0, 12)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN C: STATE PROVENANCE EXPLORER                                  */}
        {/* ==================================================================== */}
        {activeTab === 'PROVENANCE' && twin && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-5">
              <div className="mb-5">
                <h2 className="text-sm font-bold text-slate-900">State Provenance & Traceability Explorer</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect the source records, calculation rules, verification status, and freshness of every derived twin attribute.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Odometer Provenance */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Odometer Reading</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {twin.derivedState.odometer.verifiedStatus}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {twin.derivedState.odometer.value.mileage.toLocaleString()} km
                  </div>
                  <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Source Record:</span>
                      <span className="font-mono">{twin.derivedState.odometer.sourceRecordId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Source System:</span>
                      <span>{twin.derivedState.odometer.sourceSystem}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Computation Rule:</span>
                      <span className="font-mono text-sky-700">{twin.derivedState.odometer.ruleVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Freshness:</span>
                      <span className="font-bold text-emerald-600">{twin.derivedState.odometer.freshness}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Maintenance Provenance */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Maintenance Coverage</span>
                    <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                      {twin.derivedState.maintenance.verifiedStatus}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {twin.derivedState.maintenance.value.totalServices} Logged Invoices
                  </div>
                  <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Coverage Score:</span>
                      <span className="font-bold">{twin.derivedState.maintenance.value.serviceCoveragePercentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Service Gaps / Overdue:</span>
                      <span className={twin.derivedState.maintenance.value.isOverdueForService ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                        {twin.derivedState.maintenance.value.isOverdueForService ? 'OVERDUE' : 'UP TO DATE'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Computation Rule:</span>
                      <span className="font-mono text-sky-700">{twin.derivedState.maintenance.ruleVersion}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Ownership Provenance */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Current Ownership</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {twin.derivedState.ownership.verifiedStatus}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {twin.derivedState.ownership.value.currentOwnerName}
                  </div>
                  <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Owner Role:</span>
                      <span className="font-semibold">{twin.derivedState.ownership.value.currentOwnerRole}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Owners:</span>
                      <span>{twin.derivedState.ownership.value.totalOwnersCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Computation Rule:</span>
                      <span className="font-mono text-sky-700">{twin.derivedState.ownership.ruleVersion}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Blockchain Integrity Provenance */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Blockchain Ledger Anchor</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {twin.derivedState.blockchainIntegrity.verifiedStatus}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {twin.derivedState.blockchainIntegrity.value.status}
                  </div>
                  <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ledger Contract:</span>
                      <span className="font-mono text-[11px]">{twin.derivedState.blockchainIntegrity.value.contractAddress?.slice(0, 16)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Source System:</span>
                      <span>{twin.derivedState.blockchainIntegrity.sourceSystem}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Computation Rule:</span>
                      <span className="font-mono text-sky-700">{twin.derivedState.blockchainIntegrity.ruleVersion}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN D: TRUST & VERIFICATION CENTER                                */}
        {/* ==================================================================== */}
        {activeTab === 'TRUST' && twin && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-xs space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">Merkle Batch Verification</div>
                <div className="text-2xl font-bold text-slate-900">{twin.integrations.merkleBatchesCount} Batches</div>
                <p className="text-xs text-slate-500">
                  Authoritative records anchored cryptographically into Merkle Trees.
                </p>
                <Link
                  href="/explorer/batches"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center space-x-1 pt-2"
                >
                  <span>Open Merkle Batch Explorer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-xs space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">Zero-Knowledge Credentials</div>
                <div className="text-2xl font-bold text-slate-900">{twin.integrations.privacyCredentialsCount} Active</div>
                <p className="text-xs text-slate-500">
                  Pedersen commitments &amp; selective disclosure proofs.
                </p>
                <Link
                  href="/intelligence/privacy"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center space-x-1 pt-2"
                >
                  <span>Open ZKP Privacy Center</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-xs space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">Fraud Graph &amp; Agent</div>
                <div className="text-2xl font-bold text-slate-900">{twin.integrations.fraudFindingsCount} Findings</div>
                <p className="text-xs text-slate-500">
                  Correlated intelligence from Fraud Graph and Autonomous Agent.
                </p>
                <Link
                  href="/intelligence/fraud-graph"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center space-x-1 pt-2"
                >
                  <span>Open Fraud Graph</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN E: SCENARIO SIMULATOR (WHAT-IF ENGINE)                        */}
        {/* ==================================================================== */}
        {activeTab === 'SIMULATOR' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-5">
              <div className="mb-4">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    ISOLATION BOUNDARY ENFORCED
                  </span>
                  <span className="text-xs text-slate-500 font-mono">isSimulated: true</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1">Scenario Simulation Engine (What-If Studio)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluate hypothetical lifecycle events in memory isolation. Simulated outputs never alter authoritative records or trigger blockchain transactions.
                </p>
              </div>

              {/* Scenario Type Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {[
                  { id: 'SCHEDULED_MAINTENANCE', label: '1. Scheduled Service', desc: 'Simulate upcoming maintenance impact' },
                  { id: 'ODOMETER_PROJECTION', label: '2. Odometer Projection', desc: 'Test hypothetical mileage progression' },
                  { id: 'OWNERSHIP_PRECHECK', label: '3. Ownership Pre-Check', desc: 'Pre-check buyer transfer prerequisites' },
                  { id: 'BATTERY_DEGRADATION', label: '4. Battery Degradation', desc: 'Simulate fast DC charging & EU SoH warranty' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleScenarioTypeChange(s.id as any)}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      selectedScenarioType === s.id
                        ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">{s.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>

              {/* Interactive Simulation Form */}
              <form onSubmit={handleSimulate} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="text-xs font-bold text-slate-700 uppercase">Scenario Parameters</div>

                {selectedScenarioType === 'SCHEDULED_MAINTENANCE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Service Type</label>
                      <input
                        type="text"
                        value={simInputs.serviceType || ''}
                        onChange={(e) => setSimInputs({ ...simInputs, serviceType: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Planned Mileage (km)</label>
                      <input
                        type="number"
                        value={simInputs.plannedMileage || ''}
                        onChange={(e) => setSimInputs({ ...simInputs, plannedMileage: Number(e.target.value) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Estimated Cost (€)</label>
                      <input
                        type="number"
                        value={simInputs.cost || ''}
                        onChange={(e) => setSimInputs({ ...simInputs, cost: Number(e.target.value) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                )}

                {selectedScenarioType === 'ODOMETER_PROJECTION' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Hypothetical Odometer (km)</label>
                      <input
                        type="number"
                        value={simInputs.hypotheticalMileage || ''}
                        onChange={(e) => setSimInputs({ ...simInputs, hypotheticalMileage: Number(e.target.value) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                      <span className="text-[10px] text-slate-400">Try a lower number to test simulated rollback detection</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Projection Horizon (Months)</label>
                      <input
                        type="number"
                        value={simInputs.projectionMonths || 6}
                        onChange={(e) => setSimInputs({ ...simInputs, projectionMonths: Number(e.target.value) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                )}

                {selectedScenarioType === 'OWNERSHIP_PRECHECK' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Prospective Buyer Name</label>
                      <input
                        type="text"
                        value={simInputs.proposedOwnerName || ''}
                        onChange={(e) => setSimInputs({ ...simInputs, proposedOwnerName: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Proposed Role</label>
                      <select
                        value={simInputs.proposedOwnerRole || 'DEALER_FLEET'}
                        onChange={(e) => setSimInputs({ ...simInputs, proposedOwnerRole: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      >
                        <option value="VEHICLE_OWNER">Private Owner</option>
                        <option value="DEALER_FLEET">Commercial Fleet Operator</option>
                        <option value="INSURANCE_PARTNER">Insurance Partner</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedScenarioType === 'BATTERY_DEGRADATION' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Simulated Horizon (Months)</label>
                      <input
                        type="number"
                        value={simInputs.projectedMonths || 24}
                        onChange={(e) => setSimInputs({ ...simInputs, projectedMonths: Number(e.target.value) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Annual Mileage (km/yr)</label>
                      <input
                        type="number"
                        value={simInputs.annualMileageKm || 20000}
                        onChange={(e) => setSimInputs({ ...simInputs, annualMileageKm: Number(e.target.value) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Fast DC Charge Ratio (%)</label>
                      <input
                        type="number"
                        value={simInputs.fastDcPercentage || 45}
                        onChange={(e) => setSimInputs({ ...simInputs, fastDcPercentage: Number(e.target.value) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={simulating}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1.5 shadow-sm"
                  >
                    <Cpu className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
                    <span>{simulating ? 'Simulating in Memory...' : 'Run Hypothetical Simulation'}</span>
                  </button>
                </div>
              </form>

              {/* Simulation Result Diff Output */}
              {simulationResult && (
                <div className="mt-6 space-y-4 pt-4 border-t border-slate-200">
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-900">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Simulation Completed: {simulationResult.explanation}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      isSimulated: true
                    </span>
                  </div>

                  {/* Diff Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Attribute</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Base Value</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Simulated Value</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Explanation</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {simulationResult.diffs.map((diff, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">{diff.attribute}</td>
                            <td className="px-3 py-2 text-slate-500">{String(diff.baseValue)}</td>
                            <td className="px-3 py-2 font-bold text-sky-700">{String(diff.simulatedValue)}</td>
                            <td className="px-3 py-2 text-slate-600">{diff.changeExplanation}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                diff.impactLevel === 'POSITIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : diff.impactLevel === 'CRITICAL'
                                  ? 'bg-rose-100 text-rose-800'
                                  : diff.impactLevel === 'WARNING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {diff.impactLevel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Assumptions */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="text-xs font-bold text-slate-700 mb-1">Model Assumptions &amp; Limitations</div>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
                      {simulationResult.assumptions.map((asm, i) => (
                        <li key={i}>{asm}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN F: RECONCILIATION & DATA QUALITY AUDIT                         */}
        {/* ==================================================================== */}
        {activeTab === 'RECONCILE' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Projection Drift &amp; Operational Reconciliation</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Compare stored Digital Twin projections against authoritative database records and repair drift safely.
                  </p>
                </div>

                <button
                  onClick={handleReconcile}
                  disabled={reconciling}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1.5 shadow-xs"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
                  <span>{reconciling ? 'Reconciling Records...' : 'Execute Operational Reconciliation'}</span>
                </button>
              </div>

              {reconcileError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{reconcileError}</span>
                </div>
              )}

              {reconciliationResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span>Reconciliation Completed: {reconciliationResult.status}</span>
                    <span className="font-mono">{reconciliationResult.durationMs}ms</span>
                  </div>
                  <p className="text-xs text-emerald-700">{reconciliationResult.repairSummary}</p>
                  <div className="text-xs text-slate-600">
                    Sources Compared: <span className="font-bold">{reconciliationResult.sourcesCompared}</span> | Discrepancies Found: <span className="font-bold">{reconciliationResult.discrepanciesCount}</span>
                  </div>
                </div>
              )}

              {/* Past Reconciliation Run History */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-700 uppercase mb-3">Reconciliation Audit Log</div>
                {reconciliationHistory.length === 0 ? (
                  <p className="text-xs text-slate-400">No previous reconciliation runs recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {reconciliationHistory.map((run) => (
                      <div
                        key={run.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{run.status}</span>
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="text-slate-600">{run.repairStatus}</span>
                        </div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          {new Date(run.startedAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Investigation Handoff Modal */}
      {showHandoffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-sky-100 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Handoff Anomaly to Investigation Agent</h3>
              </div>
              <button
                onClick={() => setShowHandoffModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              This initiates an autonomous investigation case without exposing private witness data or personal records.
            </p>

            <form onSubmit={handleHandoffInvestigation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Anomaly ID / Ref</label>
                <input
                  type="text"
                  value={handoffForm.anomalyId}
                  onChange={(e) => setHandoffForm({ ...handoffForm, anomalyId: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Investigation Type</label>
                <select
                  value={handoffForm.investigationType}
                  onChange={(e) => setHandoffForm({ ...handoffForm, investigationType: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="MULTI_SIGNAL">MULTI_SIGNAL (Correlate all signals)</option>
                  <option value="ODOMETER_ROLLBACK">ODOMETER_ROLLBACK</option>
                  <option value="OWNERSHIP_IDENTITY">OWNERSHIP_IDENTITY</option>
                  <option value="DOCUMENT_INTEGRITY">DOCUMENT_INTEGRITY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Investigation</label>
                <textarea
                  value={handoffForm.reason}
                  onChange={(e) => setHandoffForm({ ...handoffForm, reason: e.target.value })}
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              {handoffSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
                  {handoffSuccessMsg}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHandoffModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={handoffLoading}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1.5"
                >
                  <Bot className={`w-3.5 h-3.5 ${handoffLoading ? 'animate-spin' : ''}`} />
                  <span>{handoffLoading ? 'Dispatching Agent...' : 'Dispatch Investigation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
