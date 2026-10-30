'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchPublicPassport, fetchPublicBuyerSummary, fetchPublicEcosystemSummary } from '../../../lib/api';
import { PublicPassportData, PublicBuyerSummary, PublicEcosystemSummary } from '../../../types/vehicle';
import { PassportQRCodeModal } from '../../../components/PassportQRCodeModal';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Car,
  QrCode,
  Calendar,
  Fuel,
  Wrench,
  Clock,
  FileCheck2,
  ExternalLink,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Building2,
  Activity,
  ArrowRight,
  Printer,
  Layers,
} from 'lucide-react';

export default function PublicVerifyPage() {
  const params = useParams();
  const router = useRouter();
  const passportId = (params?.passportId as string) || '';

  const [passportData, setPassportData] = useState<PublicPassportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [copiedPassport, setCopiedPassport] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [buyerSummary, setBuyerSummary] = useState<PublicBuyerSummary | null>(null);
  const [ecosystemSummary, setEcosystemSummary] = useState<PublicEcosystemSummary | null>(null);

  useEffect(() => {
    if (!passportId) return;

    setLoading(true);
    setError(null);

    fetchPublicPassport(passportId)
      .then((res) => {
        if (res.success && res.data) {
          setPassportData(res.data);
        } else {
          setError(res.error?.message || 'Vehicle passport not found.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to verify vehicle passport.');
      })
      .finally(() => setLoading(false));

    fetchPublicBuyerSummary(passportId)
      .then((res) => {
        if (res.success && res.data) {
          setBuyerSummary(res.data);
        }
      })
      .catch((err) => {
        console.warn('Optional buyer summary fetch skipped:', err);
      });

    fetchPublicEcosystemSummary(passportId)
      .then((res) => {
        if (res.success && res.data) {
          setEcosystemSummary(res.data);
        }
      })
      .catch((err) => {
        console.warn('Optional ecosystem summary fetch skipped:', err);
      });
  }, [passportId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const clean = searchQuery.trim().toUpperCase();
    router.push(`/verify/${clean}`);
  };

  const handleCopy = (text: string, type: 'tx' | 'passport') => {
    navigator.clipboard.writeText(text);
    if (type === 'passport') {
      setCopiedPassport(true);
      setTimeout(() => setCopiedPassport(false), 2000);
    } else {
      setCopiedTx(text);
      setTimeout(() => setCopiedTx(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <Link href="/verify" className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight hover:text-blue-600 transition">
                Vehicle Passport <span className="text-blue-600">Trust Portal</span>
              </Link>
              <div className="text-[10px] text-slate-500 font-medium">Public Blockchain Verification</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/explorer"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 bg-white shadow-2xs transition flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>Blockchain Explorer</span>
            </Link>
            <Link
              href="/login"
              className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-lg shadow-2xs transition"
            >
              Dashboard Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Search header bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Cryptographic Passport Verification</h1>
            <p className="text-xs text-slate-500">
              Query tamper-evident vehicle identity and lifecycle records anchored on the blockchain.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Lookup Passport ID (e.g. VP-000001)"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-2xs transition"
            >
              Verify
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
            <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-base font-bold text-slate-800">Verifying Cryptographic Proofs...</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Querying smart contract anchors and recalculating canonical SHA-256 record hashes for {passportId}.
            </p>
          </div>
        )}

        {/* Error / Not Found State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl border border-rose-200 p-12 text-center shadow-xs space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Verification Query Failed</h3>
              <p className="text-xs text-rose-600 font-medium">{error}</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-2">
                Make sure the Passport ID format is correct (e.g. <span className="font-mono font-semibold">VP-000001</span>) or search another vehicle passport.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <Link
                href="/verify/VP-000001"
                className="text-xs font-semibold px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition"
              >
                Real: VP-000001 (Nexon EV)
              </Link>
              <Link
                href="/verify/VP-000002"
                className="text-xs font-semibold px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition"
              >
                Real: VP-000002 (City)
              </Link>
              <Link
                href="/verify/VP-DEMO-001"
                className="text-xs font-semibold px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition"
              >
                Demo: VP-DEMO-001 (Aurora X1)
              </Link>
              <Link
                href="/verify/VP-DEMO-008"
                className="text-xs font-semibold px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition"
              >
                Demo: VP-DEMO-008 (Orbit M2)
              </Link>
            </div>
          </div>
        )}

        {/* Verification Success / Content State */}
        {!loading && passportData && (
          <div className="space-y-6">
            {/* Status Hero Card */}
            <div
              className={`rounded-2xl border p-6 sm:p-8 shadow-xs transition ${
                passportData.verificationStatus === 'VERIFIED'
                  ? 'bg-gradient-to-b from-emerald-50/60 to-white border-emerald-200'
                  : passportData.verificationStatus === 'SUSPICIOUS'
                  ? 'bg-gradient-to-b from-amber-50/60 to-white border-amber-200'
                  : 'bg-gradient-to-b from-rose-50/60 to-white border-rose-200'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs flex items-center gap-1.5">
                      <span>{passportData.passportId}</span>
                      <button
                        onClick={() => handleCopy(passportData.passportId, 'passport')}
                        className="text-slate-400 hover:text-slate-700 transition"
                        title="Copy Passport ID"
                      >
                        {copiedPassport ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </span>

                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      Plate: {passportData.vehicleSummary.registrationNumberMasked}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {passportData.vehicleSummary.manufacturer} {passportData.vehicleSummary.model}
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">
                    {passportData.vehicleSummary.variant} • {passportData.vehicleSummary.manufacturingYear} • {passportData.vehicleSummary.fuelType} • Color: {passportData.vehicleSummary.color}
                  </p>
                </div>

                {/* Big Verification Badge */}
                <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                  {passportData.verificationStatus === 'VERIFIED' ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm">
                      <ShieldCheck className="w-5 h-5" />
                      <span>CRYPTOGRAPHICALLY VERIFIED</span>
                    </div>
                  ) : passportData.verificationStatus === 'SUSPICIOUS' ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-sm shadow-sm">
                      <AlertTriangle className="w-5 h-5" />
                      <span>SUSPICIOUS TIMELINE ANOMALY</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm shadow-sm">
                      <ShieldAlert className="w-5 h-5" />
                      <span>CRYPTOGRAPHIC MISMATCH DETECTED</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 max-w-xs text-left md:text-right">
                    {passportData.statusExplanation}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setIsQrModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5 text-blue-600" />
                      <span>Passport QR</span>
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>Print Report</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200/80">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium">Services Logged</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {passportData.lifecycleSummary.totalServices} Records
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Garage Certified
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium">Odometer State</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {passportData.lifecycleSummary.totalOdometerReadings} Readings
                  </div>
                  <div
                    className={`text-[10px] font-semibold mt-0.5 flex items-center gap-1 ${
                      passportData.lifecycleSummary.rollbackDetected ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {passportData.lifecycleSummary.rollbackDetected ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Rollback Flagged
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Sequential Integrity
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium">Ownership Transitions</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {passportData.lifecycleSummary.totalOwnershipTransfers} Transfers
                  </div>
                  <div className="text-[10px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Genesis Anchored
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium">Verified Documents</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {passportData.lifecycleSummary.totalDocuments} Files
                  </div>
                  <div className="text-[10px] text-purple-600 font-semibold mt-0.5 flex items-center gap-1">
                    <FileCheck2 className="w-3 h-3" /> IPFS / SHA-256
                  </div>
                </div>
              </div>
            </div>

            {/* Blockchain Proof Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">On-Chain Proof Anchor</h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Network: {passportData.blockchainStatus.network}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-sans">Smart Contract Address</div>
                    <div className="text-slate-800 truncate font-semibold mt-0.5">
                      {passportData.blockchainStatus.contractAddress}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(passportData.blockchainStatus.contractAddress, 'tx')}
                    className="text-slate-400 hover:text-slate-700 ml-2"
                  >
                    {copiedTx === passportData.blockchainStatus.contractAddress ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="truncate">
                    <div className="text-[10px] text-slate-400 font-sans">Registration Transaction Hash</div>
                    <div className="text-slate-800 truncate font-semibold mt-0.5">
                      {passportData.blockchainStatus.blockchainTxHash || 'Genesis Anchor'}
                    </div>
                  </div>
                  {passportData.blockchainStatus.blockchainTxHash && (
                    <button
                      onClick={() => handleCopy(passportData.blockchainStatus.blockchainTxHash!, 'tx')}
                      className="text-slate-400 hover:text-slate-700 ml-2"
                    >
                      {copiedTx === passportData.blockchainStatus.blockchainTxHash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Document Integrity & Storage Proofs */}
            {passportData.categories.documents.proofs.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cryptographic Document Verification</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Documents stored off-chain with deterministic SHA-256 integrity proofs and IPFS CIDs.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                    {passportData.categories.documents.proofs.length} Verified Proofs
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {passportData.categories.documents.proofs.map((doc, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{doc.title}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {doc.consistencyStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">Type: {doc.documentType}</div>
                      <div className="text-[10px] font-mono text-slate-500 space-y-0.5">
                        <div className="truncate">SHA-256: {doc.fileHash}</div>
                        <div className="truncate text-blue-600">IPFS CID: {doc.ipfsCid}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
                        <span>Storage: {doc.storageProvider.toUpperCase()}</span>
                        <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* USED-CAR BUYER INTELLIGENCE SUMMARY */}
            {buyerSummary && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Used-Car Buyer Intelligence Summary</h3>
                      <p className="text-xs text-slate-500">
                        Sanitized independent due-diligence audit &bull; Masked VIN {buyerSummary.vinMasked}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${
                    buyerSummary.overallTrustBadge === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : buyerSummary.overallTrustBadge === 'PROCEED_WITH_CAUTION'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {buyerSummary.overallTrustBadge.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Key Buyer Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Vehicle Age</span>
                    <p className="font-extrabold text-slate-900 text-sm mt-0.5">{buyerSummary.vehicleAgeYears} Years Old</p>
                    <span className="text-[10px] text-slate-400">Mfg {buyerSummary.manufacturingYear}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Service Coverage</span>
                    <p className="font-extrabold text-slate-900 text-sm mt-0.5">{buyerSummary.serviceCoveragePercentage}%</p>
                    <span className="text-[10px] text-slate-400">{buyerSummary.totalServicesCount} Services</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Odometer Check</span>
                    <p className={`font-extrabold text-sm mt-0.5 ${buyerSummary.odometerRollbackDetected ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {buyerSummary.odometerRollbackDetected ? 'Rollback Flagged' : 'No Rollback'}
                    </p>
                    <span className="text-[10px] text-slate-400">{buyerSummary.currentVerifiedMileage.toLocaleString()} km</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Accident History</span>
                    <p className="font-extrabold text-slate-900 text-sm mt-0.5">{buyerSummary.totalAccidentsCount} Recorded</p>
                    <span className="text-[10px] text-slate-400">{buyerSummary.totalOwnersCount} Owner{buyerSummary.totalOwnersCount === 1 ? '' : 's'}</span>
                  </div>
                </div>

                {/* Questions for the Seller */}
                {buyerSummary.questionsToAskSeller && buyerSummary.questionsToAskSeller.length > 0 && (
                  <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                        Recommended Questions to Ask the Seller ({buyerSummary.questionsToAskSeller.length})
                      </span>
                      <span className="text-[10px] text-blue-600 font-semibold bg-white/70 px-2 py-0.5 rounded-full">
                        Derived from Verified Gaps
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {buyerSummary.questionsToAskSeller.slice(0, 3).map((q, idx) => (
                        <div key={idx} className="p-2.5 bg-white rounded-lg border border-blue-100 text-xs text-slate-800">
                          <p className="font-semibold">“{q.question}”</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Why: {q.contextReason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verified vs Unknowns Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1.5">
                    <span className="font-bold text-emerald-900 text-[11px] uppercase tracking-wider block">
                      Verified Lifecycle Facts
                    </span>
                    <ul className="space-y-1 text-slate-700">
                      {buyerSummary.whatIsVerified.slice(0, 4).map((f, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider block">
                      Disclosed Data Gaps / Unknowns
                    </span>
                    <ul className="space-y-1 text-slate-600">
                      {buyerSummary.whatIsUnknown.slice(0, 4).map((u, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{u}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* PUBLIC ECOSYSTEM PROVENANCE CARD */}
            {ecosystemSummary && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-900">Industry & EV Ecosystem Provenance</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Verified manufacturer origin, EV traction health, insurance status, and certified garage network.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 self-start sm:self-auto">
                    {ecosystemSummary.ecosystemEventsCount} Provenance Events
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Origin */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Origin Birth Certificate
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      {ecosystemSummary.manufacturerCertificate?.isIssued ? 'Verified Genesis' : 'Unregistered'}
                    </p>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {ecosystemSummary.manufacturerCertificate?.certificateNumber || 'Standard RC'}
                    </span>
                  </div>

                  {/* Battery */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      EV Traction Battery
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      {ecosystemSummary.isEv && ecosystemSummary.batteryPassport
                        ? `SoH ${ecosystemSummary.batteryPassport.currentHealthPct}% (${ecosystemSummary.batteryPassport.evidenceClassification})`
                        : 'ICE Powertrain (N/A)'}
                    </p>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {ecosystemSummary.isEv && ecosystemSummary.batteryPassport
                        ? `${ecosystemSummary.batteryPassport.nominalCapacityKwh} kWh ${ecosystemSummary.batteryPassport.chemistry}`
                        : 'No Traction Pack'}
                    </span>
                  </div>

                  {/* Insurance */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Insurance Continuity
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      {ecosystemSummary.insurance.coverageContinuity}
                    </p>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {ecosystemSummary.insurance.settledClaimsCount} Recorded Claim(s)
                    </span>
                  </div>

                  {/* Garages */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Servicing Garages
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      {ecosystemSummary.servicingGaragesSummary.allGaragesVerified
                        ? 'All Garages Verified'
                        : 'Standard Garages'}
                    </p>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {ecosystemSummary.servicingGaragesSummary.totalServices} Certified Service(s)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Public Timeline Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Verified Vehicle Lifecycle Timeline</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chronological audit stream of blockchain-anchored events for this vehicle.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  {passportData.timeline.length} Events
                </span>
              </div>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {passportData.timeline.map((evt, idx) => (
                  <div key={idx} className="relative group">
                    {/* Circle marker */}
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${
                        evt.status === 'VERIFIED' || evt.status === 'CONFIRMED'
                          ? 'border-emerald-600 text-emerald-600'
                          : evt.status === 'SUSPICIOUS'
                          ? 'border-amber-600 text-amber-600'
                          : 'border-rose-600 text-rose-600'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          evt.status === 'VERIFIED' || evt.status === 'CONFIRMED'
                            ? 'bg-emerald-600'
                            : evt.status === 'SUSPICIOUS'
                            ? 'bg-amber-600'
                            : 'bg-rose-600'
                        }`}
                      />
                    </div>

                    <div className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{evt.title}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              evt.status === 'VERIFIED' || evt.status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : evt.status === 'SUSPICIOUS'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {evt.status}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(evt.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600">{evt.description}</p>

                      {evt.txHash && (
                        <div className="text-[10px] font-mono text-slate-400 pt-1 flex items-center gap-1 truncate">
                          <span>Tx: {evt.txHash}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QR Code Modal */}
      {passportData && (
        <PassportQRCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          passportId={passportData.passportId}
          vehicleTitle={`${passportData.vehicleSummary.manufacturer} ${passportData.vehicleSummary.model}`}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <p>© 2026 Blockchain Vehicle Passport. Tamper-evident automotive records anchored via SHA-256 cryptographic proofs.</p>
        </div>
      </footer>
    </div>
  );
}
