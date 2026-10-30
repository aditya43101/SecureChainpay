'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import {
  fetchMyVehicles,
  createVehicle,
  updateVehicle,
  verifyVehiclePassportApi,
  registerVehicleOnBlockchainApi,
  fetchVehicleTimeline,
  fetchFullVehicleVerification,
} from '../../lib/api';
import {
  Vehicle,
  CreateVehicleInput,
  FuelType,
  VehicleVerificationResult,
  TimelineEvent,
  FullVehicleVerificationReport,
} from '../../types/vehicle';
import { TimelineView } from '../../components/lifecycle/TimelineView';
import { VerificationReportView } from '../../components/lifecycle/VerificationReportView';
import { TransferOwnershipModal } from '../../components/lifecycle/TransferOwnershipModal';
import { AddServiceModal } from '../../components/lifecycle/AddServiceModal';
import { TamperSimulationModal } from '../../components/lifecycle/TamperSimulationModal';
import { PassportQRCodeModal } from '../../components/PassportQRCodeModal';
import { VehicleIntelligenceView } from '../../components/lifecycle/VehicleIntelligenceView';
import { DigitalTwinView } from '../../components/lifecycle/DigitalTwinView';
import { EcosystemView } from '../../components/lifecycle/EcosystemView';
import { SelectiveDisclosureModal } from '../../components/privacy/SelectiveDisclosureModal';

import {
  ShieldCheck,
  Car,
  KeyRound,
  LogOut,
  UserCheck,
  CheckCircle2,
  Calendar,
  Building2,
  Wrench,
  ShieldAlert,
  Hash,
  Database,
  Layers,
  Clock,
  LayoutDashboard,
  FileCheck,
  History,
  AlertTriangle,
  FileSpreadsheet,
  Link as LinkIcon,
  User as UserIcon,
  Sparkles,
  Lock,
  Plus,
  X,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Fuel,
  Palette,
  Cpu,
  Edit2,
  QrCode,
  ArrowRightLeft,
  Flame,
  BrainCircuit,
  Share2,
  Activity,
} from 'lucide-react';

type DashboardTab =
  | 'overview'
  | 'vehicles'
  | 'digital-twin'
  | 'ecosystem'
  | 'intelligence'
  | 'passport'
  | 'timeline'
  | 'ownership'
  | 'service'
  | 'accident'
  | 'insurance'
  | 'documents'
  | 'blockchain'
  | 'profile';

export default function DashboardPage() {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');


  // Vehicles state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState<boolean>(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Passport QR Modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  // Selective Disclosure Modal state
  const [isDisclosureModalOpen, setIsDisclosureModalOpen] = useState<boolean>(false);

  // Add Vehicle Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [submittingVehicle, setSubmittingVehicle] = useState<boolean>(false);
  const [vehicleFormError, setVehicleFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateVehicleInput>({
    manufacturer: '',
    model: '',
    variant: '',
    manufacturingYear: 2024,
    fuelType: 'PETROL',
    color: '',
    engineNumber: '',
    vin: '',
    registrationNumber: '',
  });

  // Edit Vehicle Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editFormData, setEditFormData] = useState({ color: '', variant: '', engineNumber: '' });
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Blockchain verification state
  const [verificationResult, setVerificationResult] = useState<VehicleVerificationResult | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [retryingBlockchain, setRetryingBlockchain] = useState<boolean>(false);

  // Lifecycle & Verification State
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);
  const [fullVerificationReport, setFullVerificationReport] = useState<FullVehicleVerificationReport | null>(null);
  const [loadingFullVerification, setLoadingFullVerification] = useState<boolean>(false);

  // Lifecycle Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);
  const [isTamperModalOpen, setIsTamperModalOpen] = useState<boolean>(false);

  const loadTimeline = async (vId?: string) => {
    const targetId = vId || selectedVehicle?.id;
    if (!token || !targetId) return;
    setLoadingTimeline(true);
    try {
      const res = await fetchVehicleTimeline(targetId, token);
      if (res.success && res.data?.timeline) {
        setTimelineEvents(res.data.timeline);
      }
    } catch (err) {
      console.error('Failed to load vehicle timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleRunFullVerification = async (vId?: string) => {
    const targetId = vId || selectedVehicle?.id;
    if (!token || !targetId) return;
    setLoadingFullVerification(true);
    try {
      const res = await fetchFullVehicleVerification(targetId, token);
      if (res.success && res.data) {
        setFullVerificationReport(res.data);
      }
    } catch (err) {
      console.error('Failed to run full verification:', err);
    } finally {
      setLoadingFullVerification(false);
    }
  };

  useEffect(() => {
    setVerificationResult(null);
    setVerificationError(null);
    setFullVerificationReport(null);
    if (selectedVehicle?.id) {
      loadTimeline(selectedVehicle.id);
    }
  }, [selectedVehicle?.id]);

  const handleVerifyVehicle = async (vehicleId: string) => {
    if (!token) return;
    setVerifying(true);
    setVerificationError(null);
    try {
      const res = await verifyVehiclePassportApi(vehicleId, token);
      if (res.success && res.data) {
        setVerificationResult(res.data);
      } else {
        setVerificationError(res.error || 'Verification failed');
      }
    } catch (err: any) {
      setVerificationError(err.message || 'Verification request failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleRetryBlockchainRegistration = async (vehicleId: string) => {
    if (!token) return;
    setRetryingBlockchain(true);
    setVerificationError(null);
    try {
      const res = await registerVehicleOnBlockchainApi(vehicleId, token);
      if (res.success && res.data?.vehicle) {
        setVehicles((prev) =>
          prev.map((v) => (v.id === vehicleId ? res.data!.vehicle : v))
        );
        if (selectedVehicle?.id === vehicleId) {
          setSelectedVehicle(res.data.vehicle);
        }
        await handleVerifyVehicle(vehicleId);
      } else {
        setVerificationError(res.error || 'Blockchain registration failed. Please try again.');
      }
    } catch (err: any) {
      setVerificationError(err.message || 'Retry failed');
    } finally {
      setRetryingBlockchain(false);
    }
  };



  // Load vehicles when token is available
  useEffect(() => {
    if (token && user?.isInitialized) {
      loadVehicles();
    }
  }, [token, user]);

  const loadVehicles = async () => {
    if (!token) return;
    setLoadingVehicles(true);
    try {
      const res = await fetchMyVehicles(token);
      if (res.success && res.data?.vehicles) {
        setVehicles(res.data.vehicles);
        if (res.data.vehicles.length > 0) {
          if (!selectedVehicle || !res.data.vehicles.some((v) => v.id === selectedVehicle.id)) {
            setSelectedVehicle(res.data.vehicles[0]);
          }
        } else {
          setSelectedVehicle(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setVehicleFormError(null);
    setSubmittingVehicle(true);

    try {
      const res = await createVehicle(formData, token);
      if (res.success && res.data?.vehicle) {
        setIsAddModalOpen(false);
        setFormData({
          manufacturer: '',
          model: '',
          variant: '',
          manufacturingYear: 2024,
          fuelType: 'PETROL',
          color: '',
          engineNumber: '',
          vin: '',
          registrationNumber: '',
        });
        await loadVehicles();
        setSelectedVehicle(res.data.vehicle);
        setActiveTab('vehicles');
      } else {
        setVehicleFormError(res.error || 'Failed to create vehicle passport');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vehicle creation failed';
      setVehicleFormError(msg);
    } finally {
      setSubmittingVehicle(false);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingVehicle) return;
    setEditFormError(null);
    setSubmittingEdit(true);

    try {
      const res = await updateVehicle(editingVehicle.id, editFormData, token);
      if (res.success && res.data?.vehicle) {
        setIsEditModalOpen(false);
        await loadVehicles();
        if (selectedVehicle?.id === editingVehicle.id) {
          setSelectedVehicle(res.data.vehicle);
        }
      } else {
        setEditFormError(res.error || 'Failed to update vehicle');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setEditFormError(msg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditFormData({
      color: vehicle.color || '',
      variant: vehicle.variant || '',
      engineNumber: vehicle.engineNumber || '',
    });
    setEditFormError(null);
    setIsEditModalOpen(true);
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-500 font-medium">Loading passport profile...</p>
        </div>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'VEHICLE_OWNER':
        return <Car className="w-4 h-4 text-blue-600" />;
      case 'GARAGE':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'MANUFACTURER':
        return <Building2 className="w-4 h-4 text-emerald-600" />;
      case 'INSURANCE_PROVIDER':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'ADMIN':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      default:
        return <UserCheck className="w-4 h-4 text-slate-600" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'VEHICLE_OWNER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'GARAGE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MANUFACTURER':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'INSURANCE_PROVIDER':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ADMIN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getFuelBadgeClass = (fuel: string) => {
    switch (fuel) {
      case 'ELECTRIC':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'HYBRID':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'PETROL':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'DIESEL':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CNG':
      case 'LPG':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'vehicles', label: 'My Vehicles', icon: Car, badge: 'Active' },
    { id: 'digital-twin', label: 'Digital Vehicle Twin', icon: Cpu, badge: 'Live' },
    { id: 'ecosystem', label: 'Industry & EV Ecosystem', icon: Layers, badge: 'EV' },
    { id: 'intelligence', label: 'Vehicle Intelligence', icon: BrainCircuit, badge: 'AI' },
    { id: 'passport', label: 'Vehicle Passport', icon: FileCheck, badge: 'Verified' },
    { id: 'timeline', label: 'Lifecycle Timeline', icon: Clock, badge: null },
    { id: 'ownership', label: 'Ownership History', icon: History, badge: null },
    { id: 'service', label: 'Service & Odometer', icon: Wrench, badge: null },
    { id: 'accident', label: 'Accident & Repair', icon: AlertTriangle, badge: null },
    { id: 'insurance', label: 'Insurance Policies', icon: ShieldCheck, badge: null },
    { id: 'documents', label: 'Documents & Hashes', icon: FileSpreadsheet, badge: 'IPFS' },
    { id: 'blockchain', label: 'Blockchain Verification', icon: LinkIcon, badge: 'On-Chain' },
    { id: 'profile', label: 'Profile', icon: UserIcon, badge: null },
  ];


  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">


      {/* Main Container with Sidebar Navigation */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as DashboardTab)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200/80 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-brand-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge ? (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              {/* User Identity Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={user.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={user.name}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{user.name}</h1>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeClass(
                            user.role
                          )}`}
                        >
                          {getRoleIcon(user.role)}
                          {user.role.replace('_', ' ')}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Passport Initialized
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-1">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end gap-1 text-xs text-slate-400">
                    <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                    <span className="text-[11px] text-emerald-600 font-medium">
                      ✓ Vehicle Passport Authorized
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      User ID (UUID)
                    </span>
                    <code className="text-xs font-mono text-slate-800 truncate block" title={user.id}>
                      {user.id}
                    </code>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Firebase UID
                    </span>
                    <code className="text-xs font-mono text-slate-800 truncate block" title={user.firebaseUid}>
                      {user.firebaseUid}
                    </code>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Total Registered Vehicles
                    </span>
                    <span className="text-sm font-bold text-brand-700 block">
                      {vehicles.length} Vehicle{vehicles.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Car className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Vehicle Passports
                    </span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">
                      {vehicles.length} Active Records
                    </span>
                    <button
                      onClick={() => setActiveTab('vehicles')}
                      className="text-[11px] text-brand-600 hover:text-brand-800 font-medium inline-flex items-center gap-0.5"
                    >
                      Manage in My Vehicles &rarr;
                    </button>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Relationship Model
                    </span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">
                      User 1 &rarr; N Vehicles
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">PostgreSQL Relational DB</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Passport Generation
                    </span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">
                      Unique VP-XXXXXX
                    </span>
                    <span className="text-[11px] text-emerald-600 font-medium">Collision-safe sequence</span>
                  </div>
                </div>
              </div>

              {/* Quick Vehicle Preview list in Overview */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Your Registered Vehicles</h3>
                    <p className="text-xs text-slate-500">
                      Digital vehicle passports managed under your identity.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Vehicle</span>
                  </button>
                </div>

                {vehicles.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
                    <Car className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-600">No vehicles registered yet.</p>
                    <button
                      id="btn-overview-add-first-vehicle"
                      onClick={() => setIsAddModalOpen(true)}
                      className="mt-3 text-xs text-brand-600 hover:underline font-semibold"
                    >
                      Add Your First Vehicle &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {vehicles.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVehicle(v);
                          setActiveTab('passport');
                        }}
                        className="p-4 rounded-xl border border-slate-200 hover:border-brand-400 hover:shadow-sm cursor-pointer transition bg-slate-50/50 hover:bg-white flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                              {v.passportId}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getFuelBadgeClass(
                                v.fuelType
                              )}`}
                            >
                              {v.fuelType}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {v.manufacturer} {v.model}
                          </h4>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            Reg: {v.registrationNumber}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-brand-600 font-semibold">
                          <span>View Passport</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* MY VEHICLES TAB */}
          {activeTab === 'vehicles' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">My Vehicles</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage and inspect digital vehicle passports owned by your profile ({user.name}).
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-98 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register New Vehicle</span>
                </button>
              </div>

              {loadingVehicles ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-xs text-slate-500">Loading your vehicle passports...</p>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
                    <Car className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">No Vehicles Registered</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      You have not added any vehicles to your digital passport profile yet.
                    </p>
                  </div>
                  <button
                    id="btn-add-first-vehicle"
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Your First Vehicle</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {vehicles.map((v) => (
                    <div
                      key={v.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all p-5 flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Passport ID & Status */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
                            {v.passportId}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getFuelBadgeClass(
                                v.fuelType
                              )}`}
                            >
                              {v.fuelType}
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              {v.status}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-slate-900">
                          {v.manufacturer} {v.model}
                        </h3>
                        {v.variant && (
                          <p className="text-xs text-slate-600 font-medium -mt-0.5">
                            {v.variant} ({v.manufacturingYear})
                          </p>
                        )}

                        {/* Specs overview */}
                        <div className="mt-4 space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">REG NO:</span>
                            <span className="font-bold text-slate-800">{v.registrationNumber}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">VIN:</span>
                            <span className="font-bold text-slate-800 truncate max-w-[170px]" title={v.vin}>
                              {v.vin}
                            </span>
                          </div>
                          {v.color && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">COLOR:</span>
                              <span className="text-slate-700">{v.color}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedVehicle(v);
                            setActiveTab('passport');
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-xs transition"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>View Passport</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVehicle(v);
                            setIsTransferModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                          title="Transfer Vehicle Ownership to another user by name"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                          <span>Transfer</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVehicle(v);
                            setActiveTab('digital-twin');
                          }}
                          className="p-2 rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                          title="Digital Vehicle Twin & Buyer Intelligence"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVehicle(v);
                            setActiveTab('ecosystem');
                          }}
                          className="p-2 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                          title="Industry & EV Ecosystem Intelligence"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVehicle(v);
                            setActiveTab('intelligence');
                          }}
                          className="p-2 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
                          title="Vehicle Intelligence & Health Score"
                        >
                          <BrainCircuit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVehicle(v);
                            setIsQrModalOpen(true);
                          }}
                          className="p-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                          title="View Passport QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVehicle(v);
                            setIsDisclosureModalOpen(true);
                          }}
                          className="p-2 rounded-xl text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition"
                          title="Selective Disclosure & Privacy Share"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                          title="Edit Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VEHICLE PASSPORT DETAIL TAB */}
          {activeTab === 'passport' && (
            <div className="space-y-6">
              {selectedVehicle ? (
                <>
                  {/* Digital Passport Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Official Passport Ribbon */}
                    <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 sm:px-8 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-widest text-brand-100 font-semibold block">
                            Official Digital Vehicle Passport
                          </span>
                          <span className="text-xl font-bold font-mono block tracking-tight">
                            {selectedVehicle.passportId}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                        <span className="text-xs bg-emerald-500/20 text-emerald-100 border border-emerald-400/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {selectedVehicle.status}
                        </span>
                        <button
                          onClick={() => setIsQrModalOpen(true)}
                          className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-full font-medium transition flex items-center gap-1"
                          title="View Passport QR Code"
                        >
                          <QrCode className="w-3 h-3" />
                          QR Code
                        </button>
                        <button
                          onClick={() => setActiveTab('digital-twin')}
                          className="text-xs bg-blue-500/30 hover:bg-blue-500/50 text-white px-3 py-1 rounded-full font-semibold transition flex items-center gap-1 border border-blue-300/40"
                          title="View Digital Vehicle Twin & Buyer Intelligence"
                        >
                          <Cpu className="w-3 h-3" />
                          Digital Twin
                        </button>
                        <button
                          onClick={() => setActiveTab('intelligence')}
                          className="text-xs bg-indigo-500/30 hover:bg-indigo-500/50 text-white px-3 py-1 rounded-full font-semibold transition flex items-center gap-1 border border-indigo-300/40"
                          title="View Vehicle Intelligence & Health"
                        >
                          <BrainCircuit className="w-3 h-3" />
                          Intelligence
                        </button>
                        <Link
                          href={`/verify/${selectedVehicle.passportId}`}
                          target="_blank"
                          className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-full font-medium transition flex items-center gap-1"
                          title="Open Public Verification Link"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Public Verify
                        </Link>
                        <button
                          onClick={() => openEditModal(selectedVehicle)}
                          className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full font-medium transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Passport Body */}
                    <div className="p-6 sm:p-8 space-y-6">
                      {/* Vehicle Identity Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                        <div>
                          <div className="text-2xl font-extrabold text-slate-900">
                            {selectedVehicle.manufacturer} {selectedVehicle.model}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {selectedVehicle.variant || 'Standard Edition'} &bull; Model Year{' '}
                            {selectedVehicle.manufacturingYear}
                          </p>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-[11px] text-slate-400 block uppercase">Registration</span>
                          <span className="text-lg font-bold text-slate-800">
                            {selectedVehicle.registrationNumber}
                          </span>
                        </div>
                      </div>

                      {/* Specifications Grid */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                          Technical Specifications
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block text-[11px]">VIN Number</span>
                            <span className="font-mono font-bold text-slate-800 block mt-0.5 truncate" title={selectedVehicle.vin}>
                              {selectedVehicle.vin}
                            </span>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block text-[11px]">Fuel Type</span>
                            <span className="font-bold text-slate-800 block mt-0.5">
                              {selectedVehicle.fuelType}
                            </span>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block text-[11px]">Exterior Color</span>
                            <span className="font-bold text-slate-800 block mt-0.5">
                              {selectedVehicle.color || 'Not specified'}
                            </span>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block text-[11px]">Engine Number</span>
                            <span className="font-mono font-bold text-slate-800 block mt-0.5 truncate">
                              {selectedVehicle.engineNumber || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Current Ownership Record */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                          Verified Ownership
                        </h4>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                              {selectedVehicle.currentOwner?.name?.[0] || 'O'}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">
                                {selectedVehicle.currentOwner?.name || user.name}
                              </div>
                              <div className="text-xs text-slate-500 font-mono">
                                {selectedVehicle.currentOwner?.email || user.email}
                              </div>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Current Legal Owner
                          </span>
                        </div>
                      </div>

                      {/* Blockchain Verification Section */}
                      <div className="p-5 rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-md">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
                              <LinkIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white tracking-tight">
                                Blockchain Verification
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Cryptographic proof anchored to EVM smart contract
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {verificationResult?.isVerified ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                ✓ VERIFIED
                              </span>
                            ) : verificationResult?.tamperDetected ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                ⚠️ TAMPER DETECTED
                              </span>
                            ) : selectedVehicle.blockchainStatus === 'CONFIRMED' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                ✓ VERIFIED
                              </span>
                            ) : selectedVehicle.blockchainStatus === 'FAILED' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                BLOCKCHAIN REGISTRATION FAILED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                <Clock className="w-3.5 h-3.5" />
                                PENDING / NOT REGISTERED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Error Notification */}
                        {verificationError && (
                          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{verificationError}</span>
                          </div>
                        )}

                        {/* Blockchain Metadata Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs mb-5">
                          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                            <span className="text-slate-400 block text-[11px]">Blockchain Vehicle ID</span>
                            <span className="font-mono font-bold text-white block mt-0.5 text-xs">
                              {selectedVehicle.blockchainVehicleId || 'PENDING'}
                            </span>
                          </div>

                          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                            <span className="text-slate-400 block text-[11px]">Transaction Hash</span>
                            <span
                              className="font-mono font-bold text-brand-300 block mt-0.5 text-xs truncate"
                              title={selectedVehicle.blockchainTxHash || 'None'}
                            >
                              {selectedVehicle.blockchainTxHash
                                ? `${selectedVehicle.blockchainTxHash.slice(0, 10)}...${selectedVehicle.blockchainTxHash.slice(-8)}`
                                : 'Pending Confirmation'}
                            </span>
                          </div>

                          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                            <span className="text-slate-400 block text-[11px]">Block Number</span>
                            <span className="font-mono font-bold text-white block mt-0.5 text-xs">
                              {selectedVehicle.blockNumber !== null && selectedVehicle.blockNumber !== undefined
                                ? `#${selectedVehicle.blockNumber}`
                                : 'Pending'}
                            </span>
                          </div>

                          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 sm:col-span-2">
                            <span className="text-slate-400 block text-[11px]">Record Hash (SHA-256)</span>
                            <span
                              className="font-mono font-bold text-slate-200 block mt-0.5 text-[11px] break-all"
                              title={selectedVehicle.recordHash || ''}
                            >
                              {selectedVehicle.recordHash || 'Not generated yet'}
                            </span>
                          </div>

                          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                            <span className="text-slate-400 block text-[11px]">Network</span>
                            <span className="font-bold text-emerald-400 block mt-0.5 text-xs">
                              Local Hardhat (Chain 31337)
                            </span>
                          </div>
                        </div>

                        {/* Real-time Verification Comparison View (if verified) */}
                        {verificationResult && (
                          <div className={`p-4 rounded-xl mb-4 border text-xs ${
                            verificationResult.isVerified
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                          }`}>
                            <div className="flex items-center gap-2 font-bold mb-2">
                              {verificationResult.isVerified ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  <span>MATCH → Cryptographically Verified on Blockchain</span>
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                                  <span>MISMATCH → Tamper Detected! Local Database Record Has Been Altered</span>
                                </>
                              )}
                            </div>
                            <div className="space-y-1 font-mono text-[11px] opacity-90">
                              <div>Calculated DB Hash: <span className="break-all">{verificationResult.calculatedHash}</span></div>
                              <div>On-Chain State Hash: <span className="break-all">{verificationResult.onChainHash || 'None'}</span></div>
                              <div className="text-[10px] opacity-75 mt-1 font-sans">
                                Verified at: {new Date(verificationResult.verifiedAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Lifecycle Action Bar */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-700/60">
                          <button
                            type="button"
                            onClick={() => handleRunFullVerification(selectedVehicle.id)}
                            disabled={loadingFullVerification}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 active:scale-95 transition shadow-xs disabled:opacity-50"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>{loadingFullVerification ? 'Auditing 7 Categories...' : 'Full Verification Audit'}</span>
                          </button>

                          {/* Ownership Transfer Action - Available to verified owner or admin */}
                          {user && selectedVehicle && (
                            user.role === 'ADMIN' ||
                            user.id === selectedVehicle.currentOwnerId ||
                            user.email?.toLowerCase() === selectedVehicle.currentOwner?.email?.toLowerCase() ||
                            (user.blockchainUserId && user.blockchainUserId === selectedVehicle.currentOwner?.blockchainUserId)
                          ) && (
                            <button
                              type="button"
                              onClick={() => setIsTransferModalOpen(true)}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                              <span>Transfer Vehicle</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setIsServiceModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition"
                          >
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                            <span>Add Service</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsTamperModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 transition"
                          >
                            <Flame className="w-3.5 h-3.5 text-rose-400" />
                            <span>Tamper Simulation</span>
                          </button>

                          {(!selectedVehicle.blockchainVehicleId || selectedVehicle.blockchainStatus === 'FAILED') && (
                            <button
                              type="button"
                              onClick={() => handleRetryBlockchainRegistration(selectedVehicle.id)}
                              disabled={retryingBlockchain}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition disabled:opacity-50"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              <span>{retryingBlockchain ? 'Registering on-chain...' : 'Retry Blockchain Registration'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Full Verification Report (If executed) */}
                      {fullVerificationReport && (
                        <div className="pt-2">
                          <VerificationReportView
                            report={fullVerificationReport}
                            loading={loadingFullVerification}
                            onRunVerification={() => handleRunFullVerification(selectedVehicle.id)}
                            onSimulateTamperClick={() => setIsTamperModalOpen(true)}
                          />
                        </div>
                      )}

                      {/* Embedded Lifecycle Timeline */}
                      <div className="pt-4">
                        <TimelineView
                          events={timelineEvents}
                          loading={loadingTimeline}
                          onRefresh={() => loadTimeline(selectedVehicle.id)}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
                  <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-800">No Vehicle Selected</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Please select a vehicle from &ldquo;My Vehicles&rdquo; to view its complete digital passport.
                  </p>
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold"
                  >
                    Go to My Vehicles &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DIGITAL VEHICLE TWIN TAB */}
          {activeTab === 'digital-twin' && (
            <div className="space-y-6">
              {selectedVehicle ? (
                <DigitalTwinView vehicle={selectedVehicle} token={token || ''} />
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">No Vehicle Selected</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
                    Please select a vehicle from &ldquo;My Vehicles&rdquo; to reconstruct its complete Digital Vehicle Twin, lifecycle state evolution, evidence registry, and buyer intelligence report.
                  </p>
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
                  >
                    Go to My Vehicles &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* INDUSTRY & EV ECOSYSTEM INTELLIGENCE TAB */}
          {activeTab === 'ecosystem' && (
            <div className="space-y-6">
              {selectedVehicle && token ? (
                <EcosystemView
                  vehicle={selectedVehicle}
                  token={token}
                  userRole={user?.role}
                  onRefreshVehicle={loadVehicles}
                />
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">No Vehicle Selected</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
                    Please select a vehicle from &ldquo;My Vehicles&rdquo; to explore its complete Industry & EV Ecosystem: Manufacturer Digital Birth Certificate, EV Battery Passport, Insurance Claims, and Garage Network.
                  </p>
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
                  >
                    Go to My Vehicles &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VEHICLE INTELLIGENCE TAB */}
          {activeTab === 'intelligence' && (
            <div className="space-y-6">
              {selectedVehicle ? (
                <VehicleIntelligenceView vehicle={selectedVehicle} token={token || ''} />
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">No Vehicle Selected</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
                    Please select a vehicle from &ldquo;My Vehicles&rdquo; to analyze its explainable health score, fraud telemetry, anomaly detection, and predictive maintenance schedule.
                  </p>
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
                  >
                    Go to My Vehicles &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">User Profile</h2>
                <p className="text-xs text-slate-500">
                  Application identity details retrieved and verified via Google OAuth.
                </p>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <img
                  src={user.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={user.name}
                  className="w-16 h-16 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{user.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeClass(
                        user.role
                      )}`}
                    >
                      {getRoleIcon(user.role)}
                      {user.role.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                      Passport Initialized
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Application Role
                  </span>
                  <span className="font-bold text-slate-800 text-sm">{user.role}</span>
                  <p className="text-slate-500 mt-1">
                    Governs access rights across specialized automotive dashboards, claims processing, and registry nodes.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Vehicle Passport Access
                  </span>
                  <span className="font-bold text-emerald-700 text-sm">
                    Authorized ({vehicles.length} vehicles registered)
                  </span>
                  <p className="text-slate-500 mt-1">
                    User completed the explicit &ldquo;Initialize Vehicle Passport&rdquo; step.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Account Created
                  </span>
                  <span className="font-bold text-slate-800 text-sm">
                    {new Date(user.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Security Level
                  </span>
                  <span className="font-bold text-slate-800 text-sm">
                    Google OAuth + Firebase ID Token Verification
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* BLOCKCHAIN VERIFICATION TAB */}
          {activeTab === 'blockchain' && (

            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Smart Contract Verified
                      </span>
                      <span className="text-xs text-slate-400 font-mono">Chain ID: 31337</span>
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      Blockchain Identity &amp; Verification Registry
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Decentralized cryptographic proofs anchored to EVM smart contracts. No personal data stored on-chain.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Smart Contract Connected
                    </span>
                  </div>
                </div>

                {/* User Identity On-Chain Card */}
                <div className="mt-6 p-4 rounded-xl bg-slate-900 text-white border border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Your Blockchain Identity Mapping
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">Blockchain User ID</span>
                      <span className="font-mono font-bold text-white block mt-0.5 text-xs">
                        {user.blockchainUserId || 'USR-000001'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">Wallet Address</span>
                      <span
                        className="font-mono font-bold text-brand-300 block mt-0.5 text-xs truncate"
                        title={user.blockchainAddress || ''}
                      >
                        {user.blockchainAddress
                          ? `${user.blockchainAddress.slice(0, 8)}...${user.blockchainAddress.slice(-6)}`
                          : '0x7099...79C8'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">Registration Tx</span>
                      <span
                        className="font-mono font-bold text-slate-300 block mt-0.5 text-xs truncate"
                        title={user.blockchainTxHash || ''}
                      >
                        {user.blockchainTxHash
                          ? `${user.blockchainTxHash.slice(0, 10)}...${user.blockchainTxHash.slice(-6)}`
                          : 'Confirmed On-Chain'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">Privacy Model</span>
                      <span className="font-bold text-emerald-400 block mt-0.5 text-xs">
                        SHA-256 Reference Hash
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Registered Vehicles Proof Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Vehicle Proof Records</h3>
                    <p className="text-xs text-slate-500">
                      Canonical vehicle hashes anchored on the VehiclePassport smart contract.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    {vehicles.length} Vehicle{vehicles.length === 1 ? '' : 's'}
                  </span>
                </div>

                {vehicles.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No vehicles registered yet. Create a vehicle to generate its blockchain passport.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3">Vehicle</th>
                          <th className="px-5 py-3">Blockchain ID</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Record Hash</th>
                          <th className="px-5 py-3">Block #</th>
                          <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vehicles.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-900">{v.manufacturer} {v.model}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{v.passportId} &bull; {v.registrationNumber}</div>
                            </td>
                            <td className="px-5 py-4 font-mono font-bold text-slate-700">
                              {v.blockchainVehicleId || (
                                <span className="text-amber-600 font-normal">Pending</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {v.blockchainStatus === 'CONFIRMED' || v.blockchainVehicleId ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                                  <CheckCircle2 className="w-3 h-3" />
                                  CONFIRMED
                                </span>
                              ) : v.blockchainStatus === 'FAILED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-rose-50 text-rose-700 border border-rose-200 text-[11px]">
                                  <ShieldAlert className="w-3 h-3" />
                                  FAILED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">
                                  <Clock className="w-3 h-3" />
                                  PENDING
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 font-mono text-[11px] text-slate-500 max-w-xs truncate" title={v.recordHash || ''}>
                              {v.recordHash ? `${v.recordHash.slice(0, 10)}...${v.recordHash.slice(-6)}` : '—'}
                            </td>
                            <td className="px-5 py-4 font-mono text-slate-600">
                              {v.blockNumber !== null && v.blockNumber !== undefined ? `#${v.blockNumber}` : '—'}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  handleVerifyVehicle(v.id);
                                }}
                                disabled={verifying}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white bg-brand-600 hover:bg-brand-700 transition disabled:opacity-50"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Verify</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Active Verification Result Card */}
              {verificationResult && (
                <div className={`p-6 rounded-2xl border shadow-sm ${
                  verificationResult.isVerified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {verificationResult.isVerified ? (
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                          ✓
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                          !
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold">
                          {verificationResult.isVerified
                            ? 'MATCH → Cryptographically Verified on Smart Contract'
                            : 'MISMATCH → Tamper Detected! Record altered in local database'}
                        </h4>
                        <p className="text-xs opacity-75">
                          Passport ID: {verificationResult.passportId} &bull; Network: {verificationResult.network}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono opacity-60">
                      {new Date(verificationResult.verifiedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 bg-white/70 rounded-xl border border-current/10">
                      <span className="block text-[10px] uppercase font-sans font-bold opacity-60 mb-0.5">Calculated Database Hash</span>
                      <span className="break-all font-bold">{verificationResult.calculatedHash}</span>
                    </div>

                    <div className="p-3 bg-white/70 rounded-xl border border-current/10">
                      <span className="block text-[10px] uppercase font-sans font-bold opacity-60 mb-0.5">On-Chain Smart Contract Hash</span>
                      <span className="break-all font-bold">{verificationResult.onChainHash || 'Not Found'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LIFECYCLE TABS */}
          {['timeline', 'ownership', 'service', 'accident', 'insurance', 'documents'].includes(activeTab) && (
            <div className="space-y-6">
              {selectedVehicle ? (
                <>
                  {/* Vehicle Banner */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                        {selectedVehicle.manufacturer.substring(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-extrabold text-slate-900">
                            {selectedVehicle.manufacturer} {selectedVehicle.model}
                          </h2>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {selectedVehicle.registrationNumber}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          Passport ID: {selectedVehicle.passportId} &bull; VIN: {selectedVehicle.vin}
                        </p>
                      </div>
                    </div>

                    {/* Quick action triggers */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRunFullVerification(selectedVehicle.id)}
                        disabled={loadingFullVerification}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Audit All Hashes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('intelligence')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>AI Intelligence &amp; Health</span>
                      </button>

                      {/* Available to verified current owner or admin */}
                      {user && selectedVehicle && (
                        user.role === 'ADMIN' ||
                        user.id === selectedVehicle.currentOwnerId ||
                        user.email?.toLowerCase() === selectedVehicle.currentOwner?.email?.toLowerCase() ||
                        (user.blockchainUserId && user.blockchainUserId === selectedVehicle.currentOwner?.blockchainUserId)
                      ) && (
                        <button
                          type="button"
                          onClick={() => setIsTransferModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                          <span>Transfer</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsServiceModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                      >
                        <Wrench className="w-3.5 h-3.5 text-amber-600" />
                        <span>Add Service</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsTamperModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Tamper Simulation</span>
                      </button>
                    </div>
                  </div>

                  {/* Verification Report if open */}
                  {fullVerificationReport && (
                    <VerificationReportView
                      report={fullVerificationReport}
                      loading={loadingFullVerification}
                      onRunVerification={() => handleRunFullVerification(selectedVehicle.id)}
                      onSimulateTamperClick={() => setIsTamperModalOpen(true)}
                    />
                  )}

                  {/* Timeline Stream Filtered according to Tab */}
                  <TimelineView
                    events={
                      activeTab === 'timeline'
                        ? timelineEvents
                        : activeTab === 'ownership'
                        ? timelineEvents.filter((e) => e.category === 'OWNERSHIP')
                        : activeTab === 'service'
                        ? timelineEvents.filter((e) => e.category === 'SERVICE' || e.category === 'ODOMETER')
                        : activeTab === 'accident'
                        ? timelineEvents.filter((e) => e.category === 'ACCIDENT')
                        : activeTab === 'insurance'
                        ? timelineEvents.filter((e) => e.category === 'INSURANCE')
                        : timelineEvents.filter((e) => e.category === 'DOCUMENT')
                    }
                    loading={loadingTimeline}
                    onRefresh={() => loadTimeline(selectedVehicle.id)}
                  />
                </>
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
                  <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-800">No Vehicle Selected</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Please select a vehicle from &ldquo;My Vehicles&rdquo; to view lifecycle records.
                  </p>
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold"
                  >
                    Go to My Vehicles &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ================= ADD VEHICLE MODAL ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Register New Vehicle</h3>
                <p className="text-xs text-slate-500">
                  Generate a tamper-evident digital vehicle passport.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="p-6 space-y-4 text-xs">
              {vehicleFormError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{vehicleFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tata, Honda, BMW"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nexon, City, X1"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Variant</label>
                  <input
                    type="text"
                    placeholder="e.g. EV Empowered, ZX"
                    value={formData.variant || ''}
                    onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Year *</label>
                  <input
                    type="number"
                    required
                    min={1900}
                    max={new Date().getFullYear() + 1}
                    value={formData.manufacturingYear}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturingYear: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Fuel Type *</label>
                  <select
                    value={formData.fuelType}
                    onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as FuelType })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden bg-white"
                  >
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="CNG">CNG</option>
                    <option value="LPG">LPG</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Exterior Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Daytona Grey"
                    value={formData.color || ''}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  VIN (Vehicle Identification Number) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={17}
                  placeholder="17-character VIN (e.g. MAT612345NEXON001)"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-mono uppercase"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Must be 17 characters excluding I, O, Q. Normalized uppercase.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Registration Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MH02EV1001"
                    value={formData.registrationNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, registrationNumber: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Engine Number</label>
                  <input
                    type="text"
                    placeholder="e.g. EM564321A"
                    value={formData.engineNumber || ''}
                    onChange={(e) => setFormData({ ...formData, engineNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500">
                <strong>Ownership Assignment:</strong> You ({user.name}) will be automatically registered as the current legal owner. A unique Passport ID will be generated upon registration.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVehicle}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-50 shadow-xs"
                >
                  {submittingVehicle ? 'Registering...' : 'Register Vehicle Passport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT VEHICLE MODAL ================= */}
      {isEditModalOpen && editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Vehicle: {editingVehicle.manufacturer} {editingVehicle.model}
                </h3>
                <p className="text-xs text-slate-500 font-mono">{editingVehicle.passportId}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateVehicle} className="p-6 space-y-4 text-xs">
              {editFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{editFormError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Variant</label>
                <input
                  type="text"
                  value={editFormData.variant}
                  onChange={(e) => setEditFormData({ ...editFormData, variant: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Exterior Color</label>
                <input
                  type="text"
                  value={editFormData.color}
                  onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Engine Number</label>
                <input
                  type="text"
                  value={editFormData.engineNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, engineNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= OWNERSHIP TRANSFER MODAL ================= */}
      {isTransferModalOpen && selectedVehicle && token && (
        <TransferOwnershipModal
          vehicle={selectedVehicle}
          token={token}
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={async () => {
            await loadVehicles();
            await loadTimeline(selectedVehicle.id);
            await handleRunFullVerification(selectedVehicle.id);
          }}
        />
      )}

      {/* ================= ADD SERVICE MODAL ================= */}
      {isServiceModalOpen && selectedVehicle && token && (
        <AddServiceModal
          vehicle={selectedVehicle}
          userRole={user.role}
          token={token}
          isOpen={isServiceModalOpen}
          onClose={() => setIsServiceModalOpen(false)}
          onSuccess={async () => {
            await loadTimeline(selectedVehicle.id);
            await handleRunFullVerification(selectedVehicle.id);
          }}
        />
      )}

      {/* ================= TAMPER SIMULATION MODAL ================= */}
      {isTamperModalOpen && selectedVehicle && token && (
        <TamperSimulationModal
          vehicle={selectedVehicle}
          token={token}
          isOpen={isTamperModalOpen}
          onClose={() => setIsTamperModalOpen(false)}
          onTampered={async () => {
            await loadTimeline(selectedVehicle.id);
            await handleRunFullVerification(selectedVehicle.id);
          }}
        />
      )}

      {/* ================= PASSPORT QR CODE MODAL ================= */}
      {isQrModalOpen && selectedVehicle && (
        <PassportQRCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          passportId={selectedVehicle.passportId}
          vehicleTitle={`${selectedVehicle.manufacturer} ${selectedVehicle.model} (${selectedVehicle.manufacturingYear})`}
          vin={selectedVehicle.vin}
          registrationNumber={selectedVehicle.registrationNumber}
          blockchainStatus={selectedVehicle.blockchainStatus || 'PENDING'}
          txHash={selectedVehicle.blockchainTxHash}
        />
      )}

      {/* ================= SELECTIVE DISCLOSURE MODAL ================= */}
      {isDisclosureModalOpen && selectedVehicle && token && (
        <SelectiveDisclosureModal
          isOpen={isDisclosureModalOpen}
          onClose={() => setIsDisclosureModalOpen(false)}
          vehicleId={selectedVehicle.id}
          passportId={selectedVehicle.passportId}
          token={token}
        />
      )}
    </div>
  );
}

