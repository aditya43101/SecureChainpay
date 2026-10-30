'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Key,
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  Layers,
  Bot,
  Send,
  History,
  Sliders,
  Cpu,
  Plus,
  Ban,
  Clock,
  ArrowRight,
  Database,
  Hash,
} from 'lucide-react';
import {
  fetchMyVehicles,
  getVehiclePrivacyCredentialsApi,
  issuePrivacyCredentialApi,
  revokePrivacyCredentialApi,
  createZkpChallengeApi,
  createSelectiveDisclosureApi,
  verifySelectiveDisclosureApi,
  generateZkpRangeProofApi,
  verifyZkpRangeProofApi,
  getPrivacyDisclosureLogsApi,
} from '../../../lib/api';
import {
  Vehicle,
  PrivacyCredentialDTO,
  ZkpChallengeSessionDTO,
  SelectiveDisclosurePresentationDTO,
  SelectiveVerificationResultDTO,
  ZkpRangeProofPayloadDTO,
  ZkpVerificationResultDTO,
  PrivacyDisclosureLogDTO,
} from '../../../types/vehicle';

export default function PrivacyVerificationCenterPage() {
  const { user, token: authToken, loginAsTestUser } = useAuth();
  const [token, setToken] = useState<string>('');

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'CENTER' | 'DISCLOSURE' | 'ZKP' | 'VERIFIER' | 'AUDIT'>('CENTER');

  // Vehicle selection state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Screen A: Privacy Center state
  const [credentials, setCredentials] = useState<PrivacyCredentialDTO[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState<boolean>(false);
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);
  const [issueLoading, setIssueLoading] = useState<boolean>(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueForm, setIssueForm] = useState({
    credentialType: 'VEHICLE_HEALTH_PASSPORT',
    serviceVerified: true,
    garageCertification: 'ISO-9001 Master Certified',
    odometerReading: 48500,
    batterySoHPercent: 94,
    cleanTitle: true,
    customerName: 'Robert Vance (Confidential)',
    internalInvoiceNotes: 'Warranty claim processed #WC-8891; private discount applied.',
  });

  // Revocation state
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('Routine credential cycle or data update');
  const [revokeLoading, setRevokeLoading] = useState<boolean>(false);

  // Screen B: Selective Disclosure Builder state
  const [selectedCredForDisclosure, setSelectedCredForDisclosure] = useState<string>('');
  const [availableKeys, setAvailableKeys] = useState<string[]>([
    'serviceVerified',
    'garageCertification',
    'odometerReading',
    'batterySoHPercent',
    'cleanTitle',
    'customerName',
    'internalInvoiceNotes',
  ]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['serviceVerified', 'garageCertification', 'odometerReading']);
  const [generatingDisclosure, setGeneratingDisclosure] = useState<boolean>(false);
  const [disclosureError, setDisclosureError] = useState<string | null>(null);
  const [generatedPresentation, setGeneratedPresentation] = useState<SelectiveDisclosurePresentationDTO | null>(null);

  // Screen C: ZKP Range Proof state
  const [zkpClaimType, setZkpClaimType] = useState<string>('ODOMETER_THRESHOLD');
  const [zkpThreshold, setZkpThreshold] = useState<number>(60000);
  const [activeSession, setActiveSession] = useState<ZkpChallengeSessionDTO | null>(null);
  const [requestingChallenge, setRequestingChallenge] = useState<boolean>(false);
  const [generatingZkp, setGeneratingZkp] = useState<boolean>(false);
  const [zkpError, setZkpError] = useState<string | null>(null);
  const [generatedZkpPayload, setGeneratedZkpPayload] = useState<ZkpRangeProofPayloadDTO | null>(null);
  const [zkpStatement, setZkpStatement] = useState<string>('');

  // Screen D: Independent Verification state
  const [verifierMode, setVerifierMode] = useState<'SELECTIVE' | 'ZKP'>('SELECTIVE');
  const [verifierPayload, setVerifierPayload] = useState<string>('');
  const [verifierIdentifier, setVerifierIdentifier] = useState<string>('Independent Vehicle Verifier #409');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [selectiveVerifyResult, setSelectiveVerifyResult] = useState<SelectiveVerificationResultDTO | null>(null);
  const [zkpVerifyResult, setZkpVerifyResult] = useState<ZkpVerificationResultDTO | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Screen E: Audit History state
  const [auditLogs, setAuditLogs] = useState<PrivacyDisclosureLogDTO[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  // Clipboard copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Initialize token from AuthContext or fallback to dev token
  useEffect(() => {
    if (authToken) {
      setToken(authToken);
    }
  }, [authToken]);

  // Load vehicles
  useEffect(() => {
    loadVehicles();
  }, [token]);

  // Update selected vehicle object when selectedVehicleId changes
  useEffect(() => {
    if (vehicles.length > 0 && selectedVehicleId) {
      const found = vehicles.find((v) => v.id === selectedVehicleId || v.vin === selectedVehicleId);
      setSelectedVehicle(found || vehicles[0]);
    }
  }, [vehicles, selectedVehicleId]);

  // Load credentials & audit logs when vehicle or token changes
  useEffect(() => {
    if (selectedVehicleId && token) {
      loadCredentials(selectedVehicleId);
      loadAuditLogs(selectedVehicleId);
    }
  }, [selectedVehicleId, token]);

  async function loadVehicles() {
    try {
      if (token) {
        const res = await fetchMyVehicles(token);
        if (res.success && res.data) {
          const vList = Array.isArray(res.data) ? res.data : (res.data as any).vehicles || [];
          if (vList.length > 0) {
            setVehicles(vList);
            setSelectedVehicleId(vList[0].id);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Could not load vehicles with auth, using demo seed vehicles:', e);
    }

    // Default demo vehicles
    const demoVehicles: any[] = [
      {
        id: 'c4e3b1c8-8924-42f0-9a41-a3f2c5a00001',
        passportId: 'VP-000001',
        vin: 'WAUZZZF28NA000001',
        manufacturer: 'Audi',
        model: 'A6 Avant 45 TFSI',
        manufacturingYear: 2022,
        status: 'ACTIVE',
        fuelType: 'PETROL',
        currentOwnerId: 'user-owner-1',
        registrationNumber: 'M-VP 2022',
      },
      {
        id: 'c4e3b1c8-8924-42f0-9a41-a3f2c5a00002',
        passportId: 'VP-000002',
        vin: 'WBA33AY08NF000002',
        manufacturer: 'BMW',
        model: '330e Plug-in Hybrid',
        manufacturingYear: 2023,
        status: 'ACTIVE',
        fuelType: 'HYBRID',
        currentOwnerId: 'user-owner-2',
        registrationNumber: 'B-VP 2023',
      },
      {
        id: 'c4e3b1c8-8924-42f0-9a41-a3f2c5a00004',
        passportId: 'VP-000004',
        vin: '5YJ3E1EB8NF000004',
        manufacturer: 'Tesla',
        model: 'Model 3 Long Range',
        manufacturingYear: 2022,
        status: 'ACTIVE',
        fuelType: 'ELECTRIC',
        currentOwnerId: 'user-owner-4',
        registrationNumber: 'HH-VP 2022',
      },
    ];
    setVehicles(demoVehicles);
    setSelectedVehicleId(demoVehicles[0].id);
  }

  async function loadCredentials(vehicleId: string) {
    if (!token) return;
    setLoadingCredentials(true);
    try {
      const res = await getVehiclePrivacyCredentialsApi(vehicleId, token);
      if (res.success && res.data) {
        setCredentials(res.data);
        if (res.data.length > 0 && !selectedCredForDisclosure) {
          setSelectedCredForDisclosure(res.data[0].credentialId);
        }
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
    } finally {
      setLoadingCredentials(false);
    }
  }

  async function loadAuditLogs(vehicleId: string) {
    if (!token) return;
    setLoadingAudit(true);
    try {
      const res = await getPrivacyDisclosureLogsApi(vehicleId, token);
      if (res.success && res.data) {
        setAuditLogs(res.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  }

  async function handleIssueCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedVehicleId) return;

    setIssueLoading(true);
    setIssueError(null);
    try {
      const attributes = {
        serviceVerified: issueForm.serviceVerified,
        garageCertification: issueForm.garageCertification,
        odometerReading: Number(issueForm.odometerReading),
        batterySoHPercent: Number(issueForm.batterySoHPercent),
        cleanTitle: issueForm.cleanTitle,
        customerName: issueForm.customerName,
        internalInvoiceNotes: issueForm.internalInvoiceNotes,
      };

      const res = await issuePrivacyCredentialApi(
        {
          vehicleId: selectedVehicleId,
          credentialType: issueForm.credentialType,
          attributes,
          numericalWitness: Number(issueForm.odometerReading),
          validityDays: 365,
        },
        token
      );

      if (res.success && res.data) {
        setShowIssueModal(false);
        await loadCredentials(selectedVehicleId);
        await loadAuditLogs(selectedVehicleId);
      } else {
        setIssueError(res.error?.message || 'Failed to issue credential');
      }
    } catch (err: any) {
      setIssueError(err.message || 'Error occurred while issuing credential');
    } finally {
      setIssueLoading(false);
    }
  }

  async function handleRevokeCredential(credentialId: string) {
    if (!token) return;
    setRevokeLoading(true);
    try {
      const res = await revokePrivacyCredentialApi(credentialId, revokeReason, token);
      if (res.success) {
        setRevokingId(null);
        await loadCredentials(selectedVehicleId);
        await loadAuditLogs(selectedVehicleId);
      } else {
        alert(res.error?.message || 'Failed to revoke credential');
      }
    } catch (e: any) {
      alert(e.message || 'Error during revocation');
    } finally {
      setRevokeLoading(false);
    }
  }

  async function handleGenerateDisclosure() {
    if (!token || !selectedCredForDisclosure || selectedKeys.length === 0) return;

    setGeneratingDisclosure(true);
    setDisclosureError(null);
    try {
      const res = await createSelectiveDisclosureApi(selectedCredForDisclosure, selectedKeys, token);
      if (res.success && res.data) {
        setGeneratedPresentation(res.data);
        await loadAuditLogs(selectedVehicleId);
      } else {
        setDisclosureError(res.error?.message || 'Failed to generate presentation');
      }
    } catch (e: any) {
      setDisclosureError(e.message || 'Error generating disclosure');
    } finally {
      setGeneratingDisclosure(false);
    }
  }

  async function handleRequestZkpChallenge() {
    if (!token || !selectedVehicleId) return;

    setRequestingChallenge(true);
    setZkpError(null);
    try {
      const res = await createZkpChallengeApi(selectedVehicleId, zkpClaimType, zkpThreshold, token);
      if (res.success && res.data) {
        setActiveSession(res.data);
      } else {
        setZkpError(res.error?.message || 'Failed to create challenge session');
      }
    } catch (e: any) {
      setZkpError(e.message || 'Error creating challenge');
    } finally {
      setRequestingChallenge(false);
    }
  }

  async function handleGenerateZkpProof() {
    if (!token || !selectedVehicleId || !activeSession) return;

    setGeneratingZkp(true);
    setZkpError(null);
    try {
      const res = await generateZkpRangeProofApi(
        {
          vehicleId: selectedVehicleId,
          claimType: zkpClaimType,
          threshold: zkpThreshold,
          nonce: activeSession.nonce,
        },
        token
      );

      if (res.success && res.data) {
        setGeneratedZkpPayload(res.data.proof);
        setZkpStatement(res.data.statement);
        await loadAuditLogs(selectedVehicleId);
      } else {
        setZkpError(res.error?.message || 'Failed to generate ZKP proof');
      }
    } catch (e: any) {
      setZkpError(e.message || 'Error generating ZKP range proof');
    } finally {
      setGeneratingZkp(false);
    }
  }

  async function handleIndependentVerification() {
    setVerifying(true);
    setVerifyError(null);
    setSelectiveVerifyResult(null);
    setZkpVerifyResult(null);

    try {
      if (!verifierPayload.trim()) {
        throw new Error('Please paste a valid JSON proof or presentation payload.');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(verifierPayload);
      } catch (pe) {
        throw new Error('Invalid JSON format. Please ensure valid JSON formatting.');
      }

      if (verifierMode === 'SELECTIVE') {
        const res = await verifySelectiveDisclosureApi(parsed, verifierIdentifier);
        if (res.data) {
          setSelectiveVerifyResult(res.data);
        } else {
          setVerifyError(res.error?.message || 'Verification endpoint returned failure.');
        }
      } else {
        const res = await verifyZkpRangeProofApi(parsed, verifierIdentifier);
        if (res.data) {
          setZkpVerifyResult(res.data);
        } else {
          setVerifyError(res.error?.message || 'Verification endpoint returned failure.');
        }
      }
    } catch (e: any) {
      setVerifyError(e.message || 'Verification execution failed.');
    } finally {
      setVerifying(false);
    }
  }

  function handleSendToVerifier(type: 'SELECTIVE' | 'ZKP') {
    if (type === 'SELECTIVE' && generatedPresentation) {
      setVerifierMode('SELECTIVE');
      setVerifierPayload(JSON.stringify(generatedPresentation, null, 2));
      setActiveTab('VERIFIER');
    } else if (type === 'ZKP' && generatedZkpPayload) {
      setVerifierMode('ZKP');
      setVerifierPayload(JSON.stringify(generatedZkpPayload, null, 2));
      setActiveTab('VERIFIER');
    }
  }

  function copyToClipboard(text: string, keyName: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Banner Context */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Privacy & Verification Center</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                  Phase 9 ZKP Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Merkle Selective Disclosure • secp256k1 Pedersen Commitments • 20-bit CDS94 NIZK Range Proofs
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/intelligence/investigations"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-sky-50/60 border border-slate-200 transition"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Investigation Console</span>
            </Link>

            <Link
              href="/intelligence/fraud-graph"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-sky-50/60 border border-slate-200 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fraud Graph</span>
            </Link>

            {!token && (
              <button
                onClick={() => loginAsTestUser('owner@vehiclepassport.io')}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Dev Login (Owner)</span>
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
                  loadCredentials(selectedVehicleId);
                  loadAuditLogs(selectedVehicleId);
                }
              }}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
              title="Refresh Vehicle State"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* 5-Tab Navigation Bar */}
        <div className="flex border-b border-slate-200 space-x-2 sm:space-x-4">
          {[
            { id: 'CENTER', label: 'Screen A: Privacy Center', icon: ShieldCheck },
            { id: 'DISCLOSURE', label: 'Screen B: Selective Disclosure', icon: Sliders },
            { id: 'ZKP', label: 'Screen C: Zero-Knowledge Prover', icon: Cpu },
            { id: 'VERIFIER', label: 'Screen D: Independent Verifier', icon: FileCheck },
            { id: 'AUDIT', label: 'Screen E: Audit & History', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition ${
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

        {/* ==================================================================== */}
        {/* SCREEN A: PRIVACY CENTER & CREDENTIAL MANAGEMENT                     */}
        {/* ==================================================================== */}
        {activeTab === 'CENTER' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Active Credentials</span>
                  <Lock className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {credentials.filter((c) => c.status === 'ACTIVE').length}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Bound to Vehicle Root Commitment</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Proof Architecture</span>
                  <Cpu className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">secp256k1 Pedersen NIZK</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">CDS94 20-bit OR-Proofs (Fiat-Shamir)</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Smart Contract Verifier</span>
                  <Database className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">PrivacyVerifier.sol</div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">0x2E2Ed0...c2 (Hardhat 31337)</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Replay Defense</span>
                  <Key className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-sm font-bold text-emerald-600 mt-1">256-bit Ephemeral Nonce</div>
                <div className="text-[11px] text-slate-400 mt-1">10-Minute Challenge Window</div>
              </div>
            </div>

            {/* Educational Threat Model: What is Hidden vs What is Public */}
            <div className="bg-gradient-to-r from-sky-50 to-blue-50/60 rounded-xl border border-sky-200 p-5">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-sky-600 text-white rounded-lg mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-sky-950">Cryptographic Privacy Model & Scope Guarantees</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    This system implements genuine zero-knowledge range proofs and salted Merkle Disclosed Credentials.
                    Unlike UI-only filtering, private values never exist in verifiable presentation proofs.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="bg-white/80 backdrop-blur-xs rounded-lg p-3 border border-sky-100">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800 mb-1.5">
                        <EyeOff className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Strictly Undisclosed / Private</span>
                      </div>
                      <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                        <li>Exact odometer readings (proven within threshold bounds)</li>
                        <li>Private buyer/seller identities, addresses, and contact info</li>
                        <li>Internal workshop invoice notes, margins, and cost details</li>
                        <li>Random 256-bit attribute blinding salts and secret scalar witnesses</li>
                      </ul>
                    </div>

                    <div className="bg-white/80 backdrop-blur-xs rounded-lg p-3 border border-sky-100">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-sky-800 mb-1.5">
                        <Eye className="w-3.5 h-3.5 text-sky-600" />
                        <span>Public Statement & Verifier Bindings</span>
                      </div>
                      <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                        <li>Selected claims explicitly chosen for disclosure</li>
                        <li>Vehicle root commitment & cryptographic issuer signature</li>
                        <li>Numerical threshold statement ($v \le T$, e.g., mileage $\le 60,000$ km)</li>
                        <li>Ephemeral verifier challenge nonce (guaranteeing replay resistance)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Issued Credentials Section */}
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Vehicle Privacy Credentials</h2>
                  <p className="text-xs text-slate-500">Cryptographically committed credentials available for selective disclosure</p>
                </div>
                <button
                  onClick={() => setShowIssueModal(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Issue Demo Credential</span>
                </button>
              </div>

              {loadingCredentials ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-sky-600 mb-2" />
                  Loading privacy credentials...
                </div>
              ) : credentials.length === 0 ? (
                <div className="p-8 text-center">
                  <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">No Privacy Credentials Issued Yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Issue a privacy credential for this vehicle to enable selective disclosure and zero-knowledge proofs.
                  </p>
                  <button
                    onClick={() => setShowIssueModal(true)}
                    className="mt-3 inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Issue First Credential</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {credentials.map((cred) => {
                    const isRevoked = cred.status === 'REVOKED';
                    return (
                      <div key={cred.id} className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-900">{cred.credentialId}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isRevoked
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {cred.status}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              {cred.credentialType}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center space-x-2">
                            <span>Issuer: {cred.issuer?.name || 'Authorized Certified Garage'}</span>
                            <span>•</span>
                            <span>Valid until: {new Date(cred.validUntil).toLocaleDateString()}</span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                            <Hash className="w-3 h-3" />
                            <span className="truncate max-w-md">Commitment: {cred.rootCommitment}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedCredForDisclosure(cred.credentialId);
                              setActiveTab('DISCLOSURE');
                            }}
                            disabled={isRevoked}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              isRevoked
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
                            }`}
                          >
                            Build Disclosure
                          </button>

                          {!isRevoked && (
                            <button
                              onClick={() => setRevokingId(cred.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN B: SELECTIVE DISCLOSURE BUILDER                               */}
        {/* ==================================================================== */}
        {activeTab === 'DISCLOSURE' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Selective Disclosure Presentation Builder</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose specific verified facts to reveal. Undisclosed attributes remain strictly hidden while preserving
                  the cryptographic Merkle binding to the issuer signature.
                </p>
              </div>

              {/* Credential selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Source Privacy Credential</label>
                <select
                  value={selectedCredForDisclosure}
                  onChange={(e) => setSelectedCredForDisclosure(e.target.value)}
                  className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {credentials.map((c) => (
                    <option key={c.credentialId} value={c.credentialId} disabled={c.status === 'REVOKED'}>
                      {c.credentialId} — {c.credentialType} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Attribute Checkboxes */}
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Configure Claim Disclosure Policy</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableKeys.map((keyName) => {
                    const isSelected = selectedKeys.includes(keyName);
                    const isSensitive = keyName === 'customerName' || keyName === 'internalInvoiceNotes';
                    return (
                      <label
                        key={keyName}
                        className={`flex items-start space-x-3 p-3 rounded-lg border transition cursor-pointer ${
                          isSelected
                            ? 'bg-sky-50/70 border-sky-300 text-sky-900'
                            : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKeys([...selectedKeys, keyName]);
                            } else {
                              setSelectedKeys(selectedKeys.filter((k) => k !== keyName));
                            }
                          }}
                          className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                        />
                        <div className="flex-1 text-xs">
                          <div className="font-semibold flex items-center justify-between">
                            <span>{keyName}</span>
                            {isSensitive && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Sensitive
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {isSelected ? 'Will be cryptographically disclosed' : 'Kept strictly confidential (Zero Leakage)'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Side-by-Side Dual Pane Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-4">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 mb-2">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>Disclosed Attributes ({selectedKeys.length})</span>
                  </div>
                  {selectedKeys.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No attributes selected for disclosure.</p>
                  ) : (
                    <ul className="text-xs text-emerald-900 space-y-1.5">
                      {selectedKeys.map((k) => (
                        <li key={k} className="flex items-center justify-between bg-white/80 p-2 rounded border border-emerald-100">
                          <span className="font-medium">{k}</span>
                          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Reveals Value + Salt + Merkle Proof
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 mb-2">
                    <EyeOff className="w-4 h-4 text-slate-500" />
                    <span>Undisclosed Attributes ({availableKeys.length - selectedKeys.length})</span>
                  </div>
                  {availableKeys.filter((k) => !selectedKeys.includes(k)).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">All attributes are currently marked for disclosure.</p>
                  ) : (
                    <ul className="text-xs text-slate-700 space-y-1.5">
                      {availableKeys
                        .filter((k) => !selectedKeys.includes(k))
                        .map((k) => (
                          <li key={k} className="flex items-center justify-between bg-white/80 p-2 rounded border border-slate-200">
                            <span className="font-medium text-slate-600">{k}</span>
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              Value & Salt STRIPPED (Zero Leakage)
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {disclosureError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{disclosureError}</span>
                </div>
              )}

              <button
                onClick={handleGenerateDisclosure}
                disabled={generatingDisclosure || selectedKeys.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition disabled:opacity-50"
              >
                {generatingDisclosure ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Computing Salted Merkle Tree...</span>
                  </>
                ) : (
                  <>
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Generate Presentation</span>
                  </>
                )}
              </button>
            </div>

            {/* Generated Presentation Display */}
            {generatedPresentation && (
              <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">Selective Disclosure Presentation Ready</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(generatedPresentation, null, 2), 'DISCLOSURE_JSON')}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedKey === 'DISCLOSURE_JSON' ? 'Copied!' : 'Copy JSON'}</span>
                    </button>
                    <button
                      onClick={() => handleSendToVerifier('SELECTIVE')}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-xs transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Verify in Verifier Tab</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-sky-300 overflow-x-auto max-h-72">
                  <pre>{JSON.stringify(generatedPresentation, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN C: ZERO-KNOWLEDGE RANGE PROOF GENERATOR                       */}
        {/* ==================================================================== */}
        {activeTab === 'ZKP' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Zero-Knowledge Threshold Range Prover</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Proves that a private numerical value (e.g. odometer mileage or battery state of health) satisfies a
                  defined threshold without revealing the actual value or secret blinding factor.
                </p>
              </div>

              {/* Step 1: Request Verifier Challenge Nonce (Replay Protection) */}
              <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <span className="text-xs font-bold text-slate-900">Request Ephemeral Verifier Challenge Nonce</span>
                  </div>
                  <button
                    onClick={handleRequestZkpChallenge}
                    disabled={requestingChallenge}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 border border-sky-200 shadow-xs transition"
                  >
                    {requestingChallenge ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
                    <span>{activeSession ? 'Refresh Nonce' : 'Obtain Fresh Nonce'}</span>
                  </button>
                </div>

                {activeSession ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Challenge Nonce</div>
                      <div className="font-mono text-slate-800 text-[11px] truncate">{activeSession.nonce}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Session Expiry</div>
                      <div className="text-slate-800 text-[11px]">{new Date(activeSession.expiresAt).toLocaleTimeString()} (Active)</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    A verifier-bound 256-bit challenge nonce ensures this proof cannot be intercepted and replayed for another vehicle or session.
                  </p>
                )}
              </div>

              {/* Step 2: Define Predicate & Threshold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Claim Type</label>
                  <select
                    value={zkpClaimType}
                    onChange={(e) => setZkpClaimType(e.target.value)}
                    className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="ODOMETER_THRESHOLD">ODOMETER_THRESHOLD (Mileage &le; Threshold)</option>
                    <option value="BATTERY_SOH_THRESHOLD">BATTERY_SOH_THRESHOLD (Battery SoH &ge; Threshold)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Policy Threshold</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={zkpThreshold}
                      onChange={(e) => setZkpThreshold(Number(e.target.value))}
                      className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                      {zkpClaimType === 'ODOMETER_THRESHOLD' ? 'km' : '%'}
                    </span>
                  </div>
                </div>
              </div>

              {zkpError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{zkpError}</span>
                </div>
              )}

              <button
                onClick={handleGenerateZkpProof}
                disabled={generatingZkp || !activeSession}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition disabled:opacity-50"
              >
                {generatingZkp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Decomposing Bits & Proving CDS94...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Generate Zero-Knowledge Range Proof</span>
                  </>
                )}
              </button>
            </div>

            {/* Generated ZKP Payload Card */}
            {generatedZkpPayload && (
              <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Zero-Knowledge Proof Generated</h3>
                      <p className="text-xs text-emerald-700 font-medium">{zkpStatement}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(generatedZkpPayload, null, 2), 'ZKP_JSON')}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedKey === 'ZKP_JSON' ? 'Copied!' : 'Copy Proof'}</span>
                    </button>
                    <button
                      onClick={() => handleSendToVerifier('ZKP')}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-xs transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Verify in Verifier Tab</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Proof System</div>
                    <div className="font-mono text-slate-800 text-[11px] font-bold">{generatedZkpPayload.proofSystem}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Decomposition Width</div>
                    <div className="font-mono text-slate-800 text-[11px]">{generatedZkpPayload.bitWidth} Bits (1,048,575 max)</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">CDS94 Bit Proofs</div>
                    <div className="font-mono text-slate-800 text-[11px]">{generatedZkpPayload.bitProofs.length} 1-out-of-2 Proofs</div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-sky-300 overflow-x-auto max-h-72">
                  <pre>{JSON.stringify(generatedZkpPayload, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN D: INDEPENDENT PROOF VERIFIER                                 */}
        {/* ==================================================================== */}
        {activeTab === 'VERIFIER' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Independent Proof & Presentation Verifier</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allows any buyer, garage, or authority to verify a cryptographic proof independently without logging in or trusting client flags.
                </p>
              </div>

              {/* Mode switch */}
              <div className="flex border-b border-slate-200 space-x-4">
                <button
                  onClick={() => {
                    setVerifierMode('SELECTIVE');
                    setSelectiveVerifyResult(null);
                    setZkpVerifyResult(null);
                  }}
                  className={`py-2 text-xs font-bold border-b-2 transition ${
                    verifierMode === 'SELECTIVE'
                      ? 'border-sky-600 text-sky-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Verify Selective Disclosure (MDC)
                </button>
                <button
                  onClick={() => {
                    setVerifierMode('ZKP');
                    setSelectiveVerifyResult(null);
                    setZkpVerifyResult(null);
                  }}
                  className={`py-2 text-xs font-bold border-b-2 transition ${
                    verifierMode === 'ZKP'
                      ? 'border-sky-600 text-sky-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Verify Zero-Knowledge Range Proof (NIZK)
                </button>
              </div>

              {/* Input details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">Paste JSON Payload</label>
                  <div className="space-x-2">
                    <button
                      onClick={() => {
                        if (verifierMode === 'SELECTIVE' && generatedPresentation) {
                          setVerifierPayload(JSON.stringify(generatedPresentation, null, 2));
                        } else if (verifierMode === 'ZKP' && generatedZkpPayload) {
                          setVerifierPayload(JSON.stringify(generatedZkpPayload, null, 2));
                        } else {
                          alert('Generate a presentation or proof first, or paste your JSON payload.');
                        }
                      }}
                      className="text-[11px] text-sky-600 hover:text-sky-800 font-medium"
                    >
                      Pre-fill Latest Output
                    </button>
                  </div>
                </div>

                <textarea
                  value={verifierPayload}
                  onChange={(e) => setVerifierPayload(e.target.value)}
                  placeholder={
                    verifierMode === 'SELECTIVE'
                      ? 'Paste SelectiveDisclosurePresentationDTO JSON payload here...'
                      : 'Paste ZkpRangeProofPayloadDTO JSON payload here...'
                  }
                  rows={8}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Verifier Identifier (Audited)</label>
                  <input
                    type="text"
                    value={verifierIdentifier}
                    onChange={(e) => setVerifierIdentifier(e.target.value)}
                    className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                onClick={handleIndependentVerification}
                disabled={verifying || !verifierPayload.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Cryptographic Proof...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verify Proof Independently</span>
                  </>
                )}
              </button>
            </div>

            {/* Verification Result: Selective Disclosure */}
            {selectiveVerifyResult && (
              <div
                className={`rounded-xl border p-6 space-y-4 shadow-xs ${
                  selectiveVerifyResult.valid
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-rose-50/40 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {selectiveVerifyResult.valid ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-600" />
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {selectiveVerifyResult.valid ? 'VALID PRESENTATION' : 'VERIFICATION FAILED'}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Verified in {selectiveVerifyResult.verificationDurationMs}ms • Issuer: {selectiveVerifyResult.issuerAddress}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectiveVerifyResult.valid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectiveVerifyResult.valid ? 'CRYPTOGRAPHICALLY VALID' : 'REJECTED'}
                  </span>
                </div>

                {selectiveVerifyResult.error && (
                  <div className="p-3 bg-rose-100/70 border border-rose-300 text-rose-800 text-xs rounded-lg">
                    Rejection Reason: {selectiveVerifyResult.error}
                  </div>
                )}

                {selectiveVerifyResult.valid && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-slate-800">Independently Proven Attributes</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(selectiveVerifyResult.verifiedAttributes).map(([key, val]) => (
                        <div key={key} className="bg-white p-3 rounded-lg border border-emerald-100 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-600">{key}</span>
                          <span className="text-xs font-bold text-emerald-700">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 pt-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectiveVerifyResult.hiddenFieldCount} undisclosed attributes safely preserved without leakage.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verification Result: ZKP Range Proof */}
            {zkpVerifyResult && (
              <div
                className={`rounded-xl border p-6 space-y-4 shadow-xs ${
                  zkpVerifyResult.valid
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-rose-50/40 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {zkpVerifyResult.valid ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-600" />
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {zkpVerifyResult.valid ? 'ZERO-KNOWLEDGE PROOF VALID' : 'ZKP VERIFICATION FAILED'}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Verified in {zkpVerifyResult.verificationDurationMs}ms • Non-interactive Fiat-Shamir
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      zkpVerifyResult.valid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {zkpVerifyResult.valid ? 'NIZK VERIFIED' : 'INVALID PROOF'}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900">Proven Statement:</div>
                  <div className="text-xs font-medium text-slate-700 bg-sky-50 p-2 rounded border border-sky-100">
                    {zkpVerifyResult.statement}
                  </div>
                  {zkpVerifyResult.onChainReceiptTx && (
                    <div className="text-xs text-slate-500 flex items-center space-x-1 font-mono pt-1">
                      <Database className="w-3.5 h-3.5 text-sky-600" />
                      <span>On-chain Receipt: {zkpVerifyResult.onChainReceiptTx}</span>
                    </div>
                  )}
                </div>

                {zkpVerifyResult.error && (
                  <div className="p-3 bg-rose-100/70 border border-rose-300 text-rose-800 text-xs rounded-lg">
                    Rejection Reason: {zkpVerifyResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN E: DISCLOSURE AUDIT & HISTORY                                 */}
        {/* ==================================================================== */}
        {activeTab === 'AUDIT' && (
          <div className="bg-white rounded-xl border border-sky-100 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Privacy & Disclosure Audit Log</h2>
                <p className="text-xs text-slate-500">Immutable ledger of selective disclosures and verification sessions</p>
              </div>
              <button
                onClick={() => loadAuditLogs(selectedVehicleId)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {loadingAudit ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-sky-600 mb-2" />
                Loading audit logs...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No disclosure logs recorded for this vehicle yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Log #</th>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Claim / Details</th>
                      <th className="px-4 py-3">Verifier ID</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Blockchain Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-800">{log.logNumber}</td>
                        <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{log.disclosureType}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{log.claimType}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{log.disclosedFields}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-[11px]">{log.verifierIdentifier || 'Anonymous Verifier'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {log.verificationStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-400">
                          {log.blockchainReceiptTx ? `${log.blockchainReceiptTx.slice(0, 10)}...` : 'Off-Chain'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL: ISSUE DEMO PRIVACY CREDENTIAL                                */}
      {/* ==================================================================== */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-sky-100 overflow-hidden">
            <div className="px-6 py-4 bg-sky-50/60 border-b border-sky-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">Issue Demo Privacy Credential</h3>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleIssueCredential} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Credential Type</label>
                <select
                  value={issueForm.credentialType}
                  onChange={(e) => setIssueForm({ ...issueForm, credentialType: e.target.value })}
                  className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  <option value="VEHICLE_HEALTH_PASSPORT">VEHICLE_HEALTH_PASSPORT</option>
                  <option value="BATTERY_HEALTH_PASSPORT">BATTERY_HEALTH_PASSPORT</option>
                  <option value="SERVICE_INTEGRITY_PASSPORT">SERVICE_INTEGRITY_PASSPORT</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Odometer (km)</label>
                  <input
                    type="number"
                    value={issueForm.odometerReading}
                    onChange={(e) => setIssueForm({ ...issueForm, odometerReading: Number(e.target.value) })}
                    className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Battery SoH (%)</label>
                  <input
                    type="number"
                    value={issueForm.batterySoHPercent}
                    onChange={(e) => setIssueForm({ ...issueForm, batterySoHPercent: Number(e.target.value) })}
                    className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name (Confidential)</label>
                <input
                  type="text"
                  value={issueForm.customerName}
                  onChange={(e) => setIssueForm({ ...issueForm, customerName: e.target.value })}
                  className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Garage Certification</label>
                <input
                  type="text"
                  value={issueForm.garageCertification}
                  onChange={(e) => setIssueForm({ ...issueForm, garageCertification: e.target.value })}
                  className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              {issueError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {issueError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issueLoading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition disabled:opacity-50"
                >
                  {issueLoading ? 'Issuing & Anchoring...' : 'Issue Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: REVOKE CREDENTIAL                                             */}
      {/* ==================================================================== */}
      {revokingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-rose-200 overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center space-x-2 text-rose-800">
              <Ban className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-bold">Revoke Privacy Credential</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to revoke this credential? Revocation will be permanently recorded in PostgreSQL and the on-chain smart contract.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Revocation Reason</label>
                <input
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRevokingId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRevokeCredential(revokingId)}
                  disabled={revokeLoading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
                >
                  {revokeLoading ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
