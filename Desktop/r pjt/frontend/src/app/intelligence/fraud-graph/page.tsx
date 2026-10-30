'use strict';
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Network,
  Bot,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Car,
  Wrench,
  FileText,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  X,
  Compass,
  GitBranch,
  Sliders,
  Maximize2,
  Minimize2,
  Info,
  Clock,
  Eye,
  FileWarning,
  Sparkles,
  UserCheck,
  Briefcase,
  Hash,
  ShieldQuestion,
  HelpCircle,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  fetchGraphOverview,
  fetchVehicleGraph,
  fetchFraudFindings,
  fetchFindingDetails,
  updateFindingStatus,
  fetchInvestigationCases,
  createInvestigationCase,
  reconcileGraphApi,
  findEvidencePathApi,
  fetchMyVehicles,
} from '../../../lib/api';
import {
  GraphOverviewDTO,
  VehicleGraphDTO,
  GraphNodeDTO,
  GraphEdgeDTO,
  FraudFindingDTO,
  FraudFindingDetailDTO,
  InvestigationCaseDTO,
  Vehicle,
} from '../../../types/vehicle';

export default function FraudIntelligenceGraphPage() {
  const { user, token: authToken } = useAuth();
  const [token, setToken] = useState<string>('');

  // Top-level stats
  const [overview, setOverview] = useState<GraphOverviewDTO | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);

  // Active Vehicle / Graph selection
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [depth, setDepth] = useState<number>(2);
  const [vehicleGraph, setVehicleGraph] = useState<VehicleGraphDTO | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);

  // Filters
  const [selectedEntityType, setSelectedEntityType] = useState<string>('ALL');
  const [selectedRelationshipType, setSelectedRelationshipType] = useState<string>('ALL');

  // Node selection & detail
  const [selectedNode, setSelectedNode] = useState<GraphNodeDTO | null>(null);

  // Findings list & Detail modal
  const [findings, setFindings] = useState<FraudFindingDTO[]>([]);
  const [findingsTotal, setFindingsTotal] = useState<number>(0);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [findingSeverityFilter, setFindingSeverityFilter] = useState<string>('ALL');
  const [findingStatusFilter, setFindingStatusFilter] = useState<string>('ALL');
  const [findingSearchQuery, setFindingSearchQuery] = useState<string>('');

  // Deep Finding Detail Inspector Modal
  const [inspectingFindingId, setInspectingFindingId] = useState<string | null>(null);
  const [findingDetail, setFindingDetail] = useState<FraudFindingDetailDTO | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [resolutionStatus, setResolutionStatus] = useState<string>('UNDER_REVIEW');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Investigation Cases Drawer
  const [showCasesDrawer, setShowCasesDrawer] = useState<boolean>(false);
  const [cases, setCases] = useState<InvestigationCaseDTO[]>([]);
  const [loadingCases, setLoadingCases] = useState<boolean>(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState<boolean>(false);
  const [newCaseTitle, setNewCaseTitle] = useState<string>('');
  const [newCaseDesc, setNewCaseDesc] = useState<string>('');
  const [newCasePriority, setNewCasePriority] = useState<string>('HIGH');
  const [creatingCase, setCreatingCase] = useState<boolean>(false);

  // Pathfinding Tool
  const [showPathTool, setShowPathTool] = useState<boolean>(false);
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [pathfinding, setPathfinding] = useState<boolean>(false);
  const [pathResult, setPathResult] = useState<any | null>(null);

  // Active View Tab: 'visual' or 'table'
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');

  // Canvas zoom/pan state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Obtain dev / auth token
  useEffect(() => {
    async function initAuth() {
      if (authToken) {
        setToken(authToken);
        return;
      }
      try {
        const res = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: 'dev-seed-token:seed-admin:admin@vehiclepassport.dev:Platform Administrator',
            email: 'admin@vehiclepassport.dev',
            name: 'Platform Administrator',
          }),
        });
        const d = await res.json();
        if (d.data?.token) setToken(d.data.token);
      } catch (err) {
        console.error('Failed to obtain dev token:', err);
      }
    }
    initAuth();
  }, [authToken]);

  // Load Overview & Vehicles
  useEffect(() => {
    if (!token) return;

    async function loadInitial() {
      setLoadingOverview(true);
      try {
        const [overviewRes, vehiclesRes] = await Promise.all([
          fetchGraphOverview(token),
          fetchMyVehicles(token),
        ]);

        if (overviewRes.success && overviewRes.data) {
          setOverview(overviewRes.data);
        }

        if (vehiclesRes.success && vehiclesRes.data?.vehicles) {
          setVehicles(vehiclesRes.data.vehicles);
          if (vehiclesRes.data.vehicles.length > 0 && !selectedVehicleId) {
            setSelectedVehicleId(vehiclesRes.data.vehicles[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load initial graph overview:', err);
      } finally {
        setLoadingOverview(false);
      }
    }

    loadInitial();
  }, [token]);

  // Load Graph for Selected Vehicle
  useEffect(() => {
    if (!token || !selectedVehicleId) return;

    async function loadVehicleGraphData() {
      setLoadingGraph(true);
      try {
        const res = await fetchVehicleGraph(selectedVehicleId, depth, token);
        if (res.success && res.data) {
          setVehicleGraph(res.data);
          // Set vehicle node as selected by default
          const vNode = res.data.nodes.find((n) => n.entityType === 'VEHICLE');
          if (vNode) setSelectedNode(vNode);
        }
      } catch (err) {
        console.error('Failed to load vehicle graph:', err);
      } finally {
        setLoadingGraph(false);
      }
    }

    loadVehicleGraphData();
  }, [token, selectedVehicleId, depth]);

  // Load Findings
  useEffect(() => {
    if (!token) return;

    async function loadFindingsData() {
      setLoadingFindings(true);
      try {
        const res = await fetchFraudFindings(
          {
            page: 1,
            limit: 20,
            severity: findingSeverityFilter !== 'ALL' ? findingSeverityFilter : undefined,
            status: findingStatusFilter !== 'ALL' ? findingStatusFilter : undefined,
            search: findingSearchQuery || undefined,
            vehicleId: selectedVehicleId || undefined,
          },
          token
        );

        if (res.success && res.data) {
          setFindings(res.data.findings);
          setFindingsTotal(res.data.total);
        }
      } catch (err) {
        console.error('Failed to load findings:', err);
      } finally {
        setLoadingFindings(false);
      }
    }

    loadFindingsData();
  }, [token, selectedVehicleId, findingSeverityFilter, findingStatusFilter, findingSearchQuery]);

  // Handle Finding Inspection
  const handleInspectFinding = async (findingId: string) => {
    setInspectingFindingId(findingId);
    setLoadingDetail(true);
    try {
      const res = await fetchFindingDetails(findingId, token);
      if (res.success && res.data) {
        setFindingDetail(res.data);
        setResolutionStatus(res.data.status);
        setResolutionNotes(res.data.resolutionReason || '');
      }
    } catch (err) {
      console.error('Failed to load finding details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle Finding Status Update
  const handleUpdateFindingStatus = async () => {
    if (!inspectingFindingId) return;
    setUpdatingStatus(true);
    try {
      const res = await updateFindingStatus(inspectingFindingId, resolutionStatus, resolutionNotes, token);
      if (res.success) {
        // Refresh detail & findings list
        handleInspectFinding(inspectingFindingId);
        const findingsRes = await fetchFraudFindings({ vehicleId: selectedVehicleId }, token);
        if (findingsRes.success && findingsRes.data) {
          setFindings(findingsRes.data.findings);
        }
      }
    } catch (err) {
      console.error('Failed to update finding status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Graph Reconcile
  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileMessage(null);
    try {
      const res = await reconcileGraphApi(token);
      if (res.success) {
        setReconcileMessage(`Sync complete: ${res.data?.sync?.nodesUpserted || 0} nodes projected in ${res.data?.sync?.durationMs || 0}ms.`);
        // Refresh overview and graph
        const [ovRes, gRes] = await Promise.all([
          fetchGraphOverview(token),
          fetchVehicleGraph(selectedVehicleId, depth, token),
        ]);
        if (ovRes.success && ovRes.data) setOverview(ovRes.data);
        if (gRes.success && gRes.data) setVehicleGraph(gRes.data);
      }
    } catch (err: any) {
      setReconcileMessage(`Sync error: ${err.message}`);
    } finally {
      setReconciling(false);
    }
  };

  // Handle Cases Drawer open
  const handleOpenCases = async () => {
    setShowCasesDrawer(true);
    setLoadingCases(true);
    try {
      const res = await fetchInvestigationCases({}, token);
      if (res.success && res.data) {
        setCases(res.data.cases);
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    } finally {
      setLoadingCases(false);
    }
  };

  // Handle Create Investigation Case
  const handleCreateCase = async () => {
    if (!newCaseTitle.trim()) return;
    setCreatingCase(true);
    try {
      const findingIds = inspectingFindingId ? [inspectingFindingId] : [];
      const res = await createInvestigationCase(
        {
          title: newCaseTitle,
          description: newCaseDesc,
          priority: newCasePriority,
          findingIds,
        },
        token
      );
      if (res.success) {
        setShowNewCaseModal(false);
        setNewCaseTitle('');
        setNewCaseDesc('');
        handleOpenCases();
      }
    } catch (err) {
      console.error('Failed to create case:', err);
    } finally {
      setCreatingCase(false);
    }
  };

  // Handle Shortest Evidence Path
  const handleFindPath = async () => {
    if (!pathSource || !pathTarget) return;
    setPathfinding(true);
    try {
      const res = await findEvidencePathApi(pathSource, pathTarget, token);
      if (res.success && res.data) {
        setPathResult(res.data);
      }
    } catch (err: any) {
      setPathResult({ found: false, message: err.message });
    } finally {
      setPathfinding(false);
    }
  };

  // Filtered nodes and edges for visualization
  const filteredNodes = useMemo(() => {
    if (!vehicleGraph) return [];
    return vehicleGraph.nodes.filter((node) => {
      if (selectedEntityType !== 'ALL' && node.entityType !== selectedEntityType) return false;
      return true;
    });
  }, [vehicleGraph, selectedEntityType]);

  const filteredEdges = useMemo(() => {
    if (!vehicleGraph) return [];
    const validNodeIds = new Set(filteredNodes.map((n) => n.id));
    return vehicleGraph.edges.filter((edge) => {
      if (!validNodeIds.has(edge.sourceNodeId) || !validNodeIds.has(edge.targetNodeId)) return false;
      if (selectedRelationshipType !== 'ALL' && edge.relationshipType !== selectedRelationshipType) return false;
      return true;
    });
  }, [vehicleGraph, filteredNodes, selectedRelationshipType]);

  // Node position calculation (Concentric ring layout)
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    if (!filteredNodes.length) return positions;

    const centerX = 400;
    const centerY = 300;

    const vehicleNodes = filteredNodes.filter((n) => n.entityType === 'VEHICLE');
    const ring1Nodes = filteredNodes.filter((n) =>
      ['USER', 'GARAGE', 'MANUFACTURER', 'INSURANCE_PROVIDER', 'MERKLE_BATCH'].includes(n.entityType)
    );
    const ring2Nodes = filteredNodes.filter((n) =>
      ['SERVICE_RECORD', 'ODOMETER_RECORD', 'ACCIDENT_RECORD', 'INSURANCE_CLAIM', 'DOCUMENT'].includes(n.entityType)
    );
    const otherNodes = filteredNodes.filter(
      (n) => !vehicleNodes.includes(n) && !ring1Nodes.includes(n) && !ring2Nodes.includes(n)
    );

    // Center: Vehicle nodes
    vehicleNodes.forEach((node, idx) => {
      const offset = (idx - (vehicleNodes.length - 1) / 2) * 80;
      positions.set(node.id, { x: centerX + offset, y: centerY });
    });

    // Ring 1: Primary entities (radius = 180)
    const r1 = 180;
    ring1Nodes.forEach((node, idx) => {
      const angle = (idx / ring1Nodes.length) * 2 * Math.PI - Math.PI / 2;
      positions.set(node.id, {
        x: centerX + r1 * Math.cos(angle),
        y: centerY + r1 * Math.sin(angle),
      });
    });

    // Ring 2: Lifecycle records (radius = 280)
    const r2 = 280;
    const combinedOuter = [...ring2Nodes, ...otherNodes];
    combinedOuter.forEach((node, idx) => {
      const angle = (idx / combinedOuter.length) * 2 * Math.PI - Math.PI / 2;
      positions.set(node.id, {
        x: centerX + r2 * Math.cos(angle),
        y: centerY + r2 * Math.sin(angle),
      });
    });

    return positions;
  }, [filteredNodes]);

  // Color & Icon mapping helpers
  const getNodeColor = (type: string, hasFinding: boolean) => {
    if (hasFinding) return { bg: 'bg-red-500', border: 'border-red-600', text: 'text-white' };
    switch (type) {
      case 'VEHICLE':
        return { bg: 'bg-blue-600', border: 'border-blue-700', text: 'text-white' };
      case 'GARAGE':
        return { bg: 'bg-emerald-600', border: 'border-emerald-700', text: 'text-white' };
      case 'USER':
        return { bg: 'bg-slate-700', border: 'border-slate-800', text: 'text-white' };
      case 'SERVICE_RECORD':
        return { bg: 'bg-teal-600', border: 'border-teal-700', text: 'text-white' };
      case 'ODOMETER_RECORD':
        return { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white' };
      case 'ACCIDENT_RECORD':
        return { bg: 'bg-rose-600', border: 'border-rose-700', text: 'text-white' };
      case 'INSURANCE_CLAIM':
        return { bg: 'bg-orange-600', border: 'border-orange-700', text: 'text-white' };
      case 'DOCUMENT':
        return { bg: 'bg-indigo-600', border: 'border-indigo-700', text: 'text-white' };
      case 'MERKLE_BATCH':
        return { bg: 'bg-purple-600', border: 'border-purple-700', text: 'text-white' };
      default:
        return { bg: 'bg-slate-500', border: 'border-slate-600', text: 'text-white' };
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-300">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">INFORMATIONAL</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">NEW</span>;
      case 'UNDER_REVIEW':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">UNDER REVIEW</span>;
      case 'NEEDS_MORE_EVIDENCE':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">MORE EVIDENCE</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">RESOLVED</span>;
      case 'DISMISSED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">DISMISSED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* ---------------- SUB-BANNER CONTEXT ---------------- */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Fraud Intelligence Graph</h1>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-full">Intelligence Engine</span>
              </div>
              <p className="text-xs text-slate-500">Cross-Entity Anomaly Correlation & Relational Provenance</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/admin/intelligence"
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Admin Dashboard
            </Link>
            <Link
              href="/intelligence/investigations"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Investigation Agent</span>
            </Link>
            <Link
              href="/intelligence/privacy"
              className="px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md flex items-center space-x-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>Privacy & ZKP</span>
            </Link>
            <Link
              href="/explorer"
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Explorer
            </Link>
            <button
              onClick={handleOpenCases}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md flex items-center space-x-1.5 transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Investigation Cases</span>
            </button>
            <button
              onClick={handleReconcile}
              disabled={reconciling}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
              <span>{reconciling ? 'Reconciling...' : 'Reconcile Graph'}</span>
            </button>
          </div>
        </div>

        {reconcileMessage && (
          <div className="bg-blue-50 border-t border-blue-100 px-4 py-1.5 text-xs text-blue-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>{reconcileMessage}</span>
            </div>
            <button onClick={() => setReconcileMessage(null)} className="text-blue-500 hover:text-blue-700">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ---------------- KPI BANNER ---------------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Graph Projection</span>
              <Network className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-900">{overview?.totalNodes ?? 0}</span>
              <span className="text-xs text-slate-500">nodes</span>
              <span className="text-slate-300">/</span>
              <span className="text-lg font-bold text-slate-700">{overview?.totalEdges ?? 0}</span>
              <span className="text-xs text-slate-500">edges</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Status: <span className="font-semibold text-emerald-600">{overview?.status || 'IDLE'}</span> ({overview?.syncDurationMs || 0}ms)
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Active Findings</span>
              <ShieldAlert className="w-4 h-4 text-orange-600" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-900">
                {overview?.findingsSummary?.totalFindings ?? 0}
              </span>
              <span className="text-xs text-slate-500">evaluated</span>
            </div>
            <div className="mt-1 text-[11px] text-orange-600 font-medium">
              {overview?.findingsSummary?.highSeverity ?? 0} High Priority Review Items
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Review Queue</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-900">
                {overview?.findingsSummary?.openFindings ?? 0}
              </span>
              <span className="text-xs text-slate-500">open / under review</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Requires authorized investigator audit</div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Investigation Cases</span>
              <Briefcase className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-900">
                {overview?.findingsSummary?.totalCases ?? 0}
              </span>
              <span className="text-xs text-slate-500">active cases</span>
            </div>
            <div className="mt-1 text-[11px] text-purple-600 font-medium cursor-pointer hover:underline" onClick={handleOpenCases}>
              Manage open forensic dockets &rarr;
            </div>
          </div>
        </div>

        {/* ---------------- CONTROLS & VEHICLE SELECTOR BAR ---------------- */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Target Vehicle:</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.passportId} — {v.manufacturer} {v.model} ({v.vin.slice(0, 8)}...)
                </option>
              ))}
            </select>

            <div className="flex items-center space-x-1 pl-2 border-l border-slate-200 text-xs text-slate-600">
              <span className="font-medium">Depth:</span>
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                    depth === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPathTool(!showPathTool)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center space-x-1.5 transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>Evidence Path Discovery</span>
            </button>

            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('visual')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'visual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Visual Graph
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Findings List ({findingsTotal})
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- SHORTEST EVIDENCE PATH TOOL DRAWER ---------------- */}
        {showPathTool && (
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Compass className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Shortest Evidence Path Discovery</h3>
              </div>
              <button onClick={() => setShowPathTool(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Traverse bounded relationship edges to identify direct and indirect provenance trails connecting any two entities across the passport ecosystem.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Source Node / Key:</label>
                <input
                  type="text"
                  placeholder="e.g. VEHICLE:id or UUID"
                  value={pathSource}
                  onChange={(e) => setPathSource(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Target Node / Key:</label>
                <input
                  type="text"
                  placeholder="e.g. GARAGE:id or UUID"
                  value={pathTarget}
                  onChange={(e) => setPathTarget(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <button
                  onClick={handleFindPath}
                  disabled={pathfinding || !pathSource || !pathTarget}
                  className="w-full px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm disabled:opacity-50 transition-colors"
                >
                  {pathfinding ? 'Traversing Paths...' : 'Find Evidence Path'}
                </button>
              </div>
            </div>

            {pathResult && (
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                {pathResult.found ? (
                  <div>
                    <div className="flex items-center space-x-2 text-emerald-700 font-semibold mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Path discovered in {pathResult.hops} hop(s):</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {pathResult.path.map((step: any, idx: number) => (
                        <React.Fragment key={idx}>
                          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-[11px] text-slate-800">
                            {step.label || step.nodeKey}
                          </span>
                          {idx < pathResult.path.length - 1 && (
                            <span className="flex items-center text-blue-600 font-semibold text-[10px]">
                              --[{pathResult.path[idx + 1]?.relationship || 'RELATION'}]--&gt;
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-amber-700 font-medium flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{pathResult.message || 'No connecting evidence path found within traversal bounds.'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- MAIN VISUAL GRAPH / TABLE SPLIT ---------------- */}
        {viewMode === 'visual' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left 3 cols: Canvas Interactive Graph Visualizer */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[650px] relative">
              {/* Toolbar */}
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Filter Entity:</span>
                    <select
                      value={selectedEntityType}
                      onChange={(e) => setSelectedEntityType(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    >
                      <option value="ALL">All Types</option>
                      <option value="VEHICLE">Vehicles</option>
                      <option value="GARAGE">Garages</option>
                      <option value="USER">Users</option>
                      <option value="SERVICE_RECORD">Services</option>
                      <option value="ODOMETER_RECORD">Odometers</option>
                      <option value="ACCIDENT_RECORD">Accidents</option>
                      <option value="INSURANCE_CLAIM">Claims</option>
                      <option value="DOCUMENT">Documents</option>
                      <option value="MERKLE_BATCH">Merkle Batches</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Filter Edge:</span>
                    <select
                      value={selectedRelationshipType}
                      onChange={(e) => setSelectedRelationshipType(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    >
                      <option value="ALL">All Relationships</option>
                      <option value="SERVICED_BY">SERVICED_BY</option>
                      <option value="HAS_ODOMETER_RECORD">HAS_ODOMETER_RECORD</option>
                      <option value="CLAIM_RELATES_TO_ACCIDENT">CLAIM_RELATES_TO_ACCIDENT</option>
                      <option value="SHARES_EVIDENCE_WITH">SHARES_EVIDENCE_WITH</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {filteredNodes.length} nodes / {filteredEdges.length} edges
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2, z + 0.15))}
                    className="p-1 hover:bg-slate-200 rounded"
                    title="Zoom In"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                    className="p-1 hover:bg-slate-200 rounded"
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-1 hover:bg-slate-200 rounded text-[11px]"
                    title="Reset Zoom"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Graph Canvas Container */}
              <div
                ref={canvasRef}
                className="flex-1 overflow-auto bg-slate-900/5 relative p-4 flex items-center justify-center cursor-grab active:cursor-grabbing"
              >
                {loadingGraph ? (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-xs text-slate-500 font-medium">Extracting Bounded Graph Neighborhood...</span>
                  </div>
                ) : filteredNodes.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs">
                    No nodes match current entity/relationship filter.
                  </div>
                ) : (
                  <svg
                    width={800 * zoomLevel}
                    height={600 * zoomLevel}
                    viewBox="0 0 800 600"
                    className="w-full h-full max-w-[800px] max-h-[600px] select-none"
                  >
                    {/* Definitions for arrowheads */}
                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 10 10"
                        refX="22"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                      </marker>
                      <marker
                        id="arrow-inferred"
                        viewBox="0 0 10 10"
                        refX="22"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
                      </marker>
                    </defs>

                    {/* Edge Lines */}
                    {filteredEdges.map((edge) => {
                      const sourcePos = nodePositions.get(edge.sourceNodeId);
                      const targetPos = nodePositions.get(edge.targetNodeId);
                      if (!sourcePos || !targetPos) return null;

                      const isSelected =
                        selectedNode &&
                        (edge.sourceNodeId === selectedNode.id || edge.targetNodeId === selectedNode.id);

                      return (
                        <g key={edge.id} className="transition-all duration-200">
                          <line
                            x1={sourcePos.x}
                            y1={sourcePos.y}
                            x2={targetPos.x}
                            y2={targetPos.y}
                            stroke={isSelected ? '#2563eb' : edge.isInferred ? '#94a3b8' : '#cbd5e1'}
                            strokeWidth={isSelected ? 2.5 : edge.isInferred ? 1.5 : 1.2}
                            strokeDasharray={edge.isInferred ? '4 3' : undefined}
                            markerEnd={edge.isInferred ? 'url(#arrow-inferred)' : 'url(#arrow)'}
                          />
                        </g>
                      );
                    })}

                    {/* Node Circles */}
                    {filteredNodes.map((node) => {
                      const pos = nodePositions.get(node.id);
                      if (!pos) return null;

                      const isSelected = selectedNode?.id === node.id;
                      const hasFinding = node.anomalyScore ? node.anomalyScore > 0 : false;
                      const style = getNodeColor(node.entityType, hasFinding);

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${pos.x}, ${pos.y})`}
                          onClick={() => setSelectedNode(node)}
                          className="cursor-pointer transition-transform duration-150 hover:scale-110"
                        >
                          {isSelected && (
                            <circle r={22} fill="none" stroke="#2563eb" strokeWidth={3} strokeDasharray="3 2" />
                          )}
                          <circle
                            r={16}
                            className={`${style.bg} transition-colors shadow-md`}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />

                          {/* Node Icon / Symbol */}
                          <text
                            textAnchor="middle"
                            dy=".3em"
                            className="text-[10px] fill-white font-bold pointer-events-none select-none"
                          >
                            {node.entityType === 'VEHICLE'
                              ? '🚗'
                              : node.entityType === 'GARAGE'
                              ? '🔧'
                              : node.entityType === 'MERKLE_BATCH'
                              ? '📦'
                              : node.entityType === 'DOCUMENT'
                              ? '📄'
                              : node.entityType === 'ODOMETER_RECORD'
                              ? '⏱'
                              : node.entityType === 'ACCIDENT_RECORD'
                              ? '💥'
                              : '•'}
                          </text>

                          {/* Node Label Below */}
                          <text
                            textAnchor="middle"
                            y={28}
                            className={`text-[9px] font-medium pointer-events-none select-none ${
                              isSelected ? 'fill-blue-700 font-bold' : 'fill-slate-600'
                            }`}
                          >
                            {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>

              {/* Legend Bar */}
              <div className="bg-white border-t border-slate-200 px-4 py-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Legend:</span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span>Vehicle</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  <span>Certified Garage</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  <span>Merkle Batch</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span>Conflict / Anomaly</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-4 h-0.5 border-b border-dashed border-slate-400"></span>
                  <span>Inferred Relation</span>
                </span>
              </div>
            </div>

            {/* Right 1 col: Node Inspector Side Panel */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-[650px] overflow-auto">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Node Inspector</span>
                {selectedNode && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700">
                    {selectedNode.entityType}
                  </span>
                )}
              </h3>

              {selectedNode ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block">Label / Title</label>
                    <div className="font-semibold text-slate-900 mt-0.5">{selectedNode.label}</div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block">Node Key / Provenance</label>
                    <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 break-all mt-0.5">
                      {selectedNode.nodeKey}
                    </div>
                  </div>

                  {selectedNode.sourceRecordHash && (
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block">Anchored Record Hash</label>
                      <div className="font-mono text-[10px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 break-all mt-0.5">
                        {selectedNode.sourceRecordHash}
                      </div>
                    </div>
                  )}

                  {selectedNode.metadata && (
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block">Entity Attributes</label>
                      <pre className="mt-1 bg-slate-50 p-2 rounded text-[10px] font-mono text-slate-800 border border-slate-200 max-h-40 overflow-auto">
                        {typeof selectedNode.metadata === 'string'
                          ? selectedNode.metadata
                          : JSON.stringify(selectedNode.metadata, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Actions on selected node */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <button
                      onClick={() => {
                        setPathSource(selectedNode.nodeKey);
                        setShowPathTool(true);
                      }}
                      className="w-full text-left px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium flex items-center justify-between"
                    >
                      <span>Set as Path Source</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      onClick={() => {
                        setPathTarget(selectedNode.nodeKey);
                        setShowPathTool(true);
                      }}
                      className="w-full text-left px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium flex items-center justify-between"
                    >
                      <span>Set as Path Target</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-4 space-y-2">
                  <Network className="w-8 h-8 stroke-1" />
                  <p className="text-xs">Select any node on the canvas to inspect its cryptographic attributes, metadata, and connected edges.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ---------------- ACCESSIBLE FINDINGS TABLE VIEW ---------------- */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table Filters Header */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter findings by keyword, rule, or VIN..."
                  value={findingSearchQuery}
                  onChange={(e) => setFindingSearchQuery(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded px-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1">
                  <span className="text-slate-500 font-medium">Severity:</span>
                  <select
                    value={findingSeverityFilter}
                    onChange={(e) => setFindingSeverityFilter(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                    <option value="INFORMATIONAL">Informational</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <select
                    value={findingStatusFilter}
                    onChange={(e) => setFindingStatusFilter(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="NEW">New</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="NEEDS_MORE_EVIDENCE">Needs Evidence</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="DISMISSED">Dismissed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Findings Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100/75 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Finding #</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Detection Rule</th>
                    <th className="px-4 py-3">Title & Summary</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingFindings ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        Loading evaluated findings...
                      </td>
                    </tr>
                  ) : findings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        No findings detected for current filters.
                      </td>
                    </tr>
                  ) : (
                    findings.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">{f.findingNumber}</td>
                        <td className="px-4 py-3">{getSeverityBadge(f.severity)}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{f.ruleName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{f.ruleId} v{f.ruleVersion}</div>
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          <div className="font-medium text-slate-900">{f.title}</div>
                          <div className="text-slate-500 text-[11px] truncate mt-0.5">{f.description}</div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(f.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleInspectFinding(f.id)}
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-medium transition-colors"
                          >
                            Inspect Evidence
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ---------------- DEEP FINDING DETAIL INSPECTOR MODAL ---------------- */}
      {inspectingFindingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 border border-orange-200 rounded-lg text-orange-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{findingDetail?.findingNumber}</span>
                    {findingDetail && getSeverityBadge(findingDetail.severity)}
                    {findingDetail && getStatusBadge(findingDetail.status)}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 mt-0.5">{findingDetail?.title}</h2>
                </div>
              </div>
              <button onClick={() => setInspectingFindingId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {loadingDetail ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  Loading cryptographic evidence breakdown...
                </div>
              ) : findingDetail ? (
                <>
                  {/* Narrative Section */}
                  <div>
                    <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                      What Was Detected
                    </h3>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {findingDetail.explanation}
                    </p>
                  </div>

                  {/* Supporting Evidence Comparison Table */}
                  <div>
                    <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                      Correlated Evidence References
                    </h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Source Record</th>
                            <th className="px-3 py-2">Field Evaluated</th>
                            <th className="px-3 py-2">Expected Value</th>
                            <th className="px-3 py-2">Actual Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono">
                          {findingDetail.evidenceReferences?.map((ev, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-800">
                                <div>{ev.recordType}</div>
                                <div className="text-[9px] text-slate-400 truncate max-w-xs">{ev.recordId}</div>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{ev.field || 'all'}</td>
                              <td className="px-3 py-2 text-emerald-700">{JSON.stringify(ev.expected) || 'N/A'}</td>
                              <td className="px-3 py-2 text-rose-700 font-bold">{JSON.stringify(ev.actual) || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Explicit Unknowns & Reviewer Guidance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-[11px] mb-1">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Explicit Unknowns</span>
                      </div>
                      <p className="text-amber-800 text-[11px] leading-relaxed">
                        {findingDetail.unknowns || 'No unverified external variables identified.'}
                      </p>
                    </div>

                    <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center space-x-1.5 text-blue-900 font-bold text-[11px] mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                        <span>Recommended Next Step</span>
                      </div>
                      <p className="text-blue-800 text-[11px] leading-relaxed">
                        {findingDetail.recommendedAction || 'Perform physical chassis and service workshop verification.'}
                      </p>
                    </div>
                  </div>

                  {/* Reviewer Action Form */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                      Authorized Reviewer Action
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Update Status:</label>
                        <select
                          value={resolutionStatus}
                          onChange={(e) => setResolutionStatus(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-medium"
                        >
                          <option value="NEW">NEW (Unassigned)</option>
                          <option value="UNDER_REVIEW">UNDER_REVIEW (Active Audit)</option>
                          <option value="NEEDS_MORE_EVIDENCE">NEEDS_MORE_EVIDENCE</option>
                          <option value="RESOLVED">RESOLVED (Explained / Corrected)</option>
                          <option value="DISMISSED">DISMISSED (Benign / Non-actionable)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Resolution / Audit Reason:</label>
                        <input
                          type="text"
                          placeholder="e.g. Verified cluster replacement invoice attached"
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => {
                          setNewCaseTitle(`Investigation: ${findingDetail.title}`);
                          setNewCaseDesc(`Opened from finding ${findingDetail.findingNumber}: ${findingDetail.description}`);
                          setShowNewCaseModal(true);
                        }}
                        className="text-xs text-blue-700 font-medium hover:underline flex items-center space-x-1"
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Open / Link Investigation Case</span>
                      </button>

                      <button
                        onClick={handleUpdateFindingStatus}
                        disabled={updatingStatus}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs shadow-sm disabled:opacity-50 transition-colors"
                      >
                        {updatingStatus ? 'Updating...' : 'Commit Status Update'}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- INVESTIGATION CASES DRAWER ---------------- */}
      {showCasesDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-purple-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Investigation Cases</h3>
              </div>
              <button onClick={() => setShowCasesDrawer(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{cases.length} cases registered</span>
              <button
                onClick={() => setShowNewCaseModal(true)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium shadow-sm transition-colors"
              >
                + New Case
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingCases ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                  Loading case records...
                </div>
              ) : cases.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No active investigation cases found.
                </div>
              ) : (
                cases.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{c.caseNumber}</span>
                      {getSeverityBadge(c.priority)}
                    </div>
                    <div className="font-semibold text-slate-900">{c.title}</div>
                    <p className="text-slate-600 text-[11px] line-clamp-2">{c.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>{c.findingsCount} linked finding(s)</span>
                      <span>Status: <strong className="text-slate-700">{c.status}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- NEW CASE MODAL ---------------- */}
      {showNewCaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Open Investigation Case</h3>
              <button onClick={() => setShowNewCaseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Case Title:</label>
                <input
                  type="text"
                  placeholder="e.g. Cross-Vehicle Odometer Rollback Docket"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Description:</label>
                <textarea
                  rows={3}
                  placeholder="Summary of suspected relational anomalies..."
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Priority:</label>
                <select
                  value={newCasePriority}
                  onChange={(e) => setNewCasePriority(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 font-medium"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowNewCaseModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                disabled={creatingCase || !newCaseTitle.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded shadow-sm disabled:opacity-50"
              >
                {creatingCase ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
