'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Clock,
  AlertTriangle,
  X,
  Trash2,
  Lock,
  Eye,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  createSelectiveDisclosure,
  fetchVehicleDisclosures,
  revokeSelectiveDisclosure,
} from '../../lib/api';
import { DisclosureProfileDTO } from '../../types/vehicle';

interface SelectiveDisclosureModalProps {
  vehicleId: string;
  passportId: string;
  token: string;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'vehicleIdentity', label: 'Vehicle Identity & Specs', desc: 'Manufacturer, model, year, fuel type (VIN & Reg masked)' },
  { id: 'odometer', label: 'Odometer Verification', desc: 'Current mileage, rollback integrity status & readings history' },
  { id: 'service', label: 'Certified Service Records', desc: 'Maintenance logs, dates, mileages and certified garage signatures' },
  { id: 'accident', label: 'Accident History', desc: 'Recorded collision events, severity and damage assessments' },
  { id: 'repair', label: 'Repair Certifications', desc: 'Post-accident repair completion status and facilities' },
  { id: 'insurance', label: 'Insurance Verification', desc: 'Coverage continuity & policy validation (private account details masked)' },
  { id: 'blockchainProof', label: 'Blockchain Proofs', desc: 'On-chain smart contract addresses, genesis anchors & transaction hashes' },
  { id: 'batteryPassport', label: 'EV Battery Passport', desc: 'Traction pack health %, nominal capacity & retention (EV only)' },
  { id: 'manufacturerCertificate', label: 'Birth Certificate', desc: 'Factory build date, manufacturing plant & specification snapshot' },
  { id: 'documents', label: 'Document Proofs', desc: 'Cryptographic SHA-256 file hashes & IPFS CIDs (no private files)' },
  { id: 'vehicleHealth', label: 'Vehicle Health Score', desc: 'Algorithmic 0–100 health score & explainable component deductions' },
  { id: 'riskSummary', label: 'Risk Intelligence', desc: '8-pillar vehicle risk score & safety indicators' },
];

export const SelectiveDisclosureModal: React.FC<SelectiveDisclosureModalProps> = ({
  vehicleId,
  passportId,
  token,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [title, setTitle] = useState(`Shareable Verification Report — ${passportId}`);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'vehicleIdentity',
    'odometer',
    'service',
    'blockchainProof',
    'batteryPassport',
    'vehicleHealth',
  ]);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdShare, setCreatedShare] = useState<DisclosureProfileDTO | null>(null);
  const [copied, setCopied] = useState(false);

  // Manage tab state
  const [disclosures, setDisclosures] = useState<DisclosureProfileDTO[]>([]);
  const [loadingDisclosures, setLoadingDisclosures] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDisclosures();
    }
  }, [isOpen, vehicleId]);

  const loadDisclosures = async () => {
    try {
      setLoadingDisclosures(true);
      const res = await fetchVehicleDisclosures(vehicleId, token);
      if (res.success && res.data) {
        setDisclosures(res.data);
      }
    } catch (err) {
      console.error('Failed to load disclosures:', err);
    } finally {
      setLoadingDisclosures(false);
    }
  };

  if (!isOpen) return null;

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedCategories(CATEGORIES.map((c) => c.id));
  };

  const clearAll = () => {
    setSelectedCategories([]);
  };

  const handleCreate = async () => {
    if (selectedCategories.length === 0) {
      setError('Please select at least one category to disclose.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await createSelectiveDisclosure(
        vehicleId,
        {
          title: title.trim(),
          categories: selectedCategories,
          expiresInDays: expiresInDays,
        },
        token
      );

      if (res.success && res.data) {
        setCreatedShare(res.data);
        loadDisclosures();
      } else {
        setError(res.error?.message || 'Failed to generate shareable link.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this shareable link? Anyone with this URL will immediately lose access.')) {
      return;
    }
    try {
      const res = await revokeSelectiveDisclosure(vehicleId, shareId, token);
      if (res.success) {
        loadDisclosures();
        if (createdShare?.shareId === shareId) {
          setCreatedShare(null);
        }
      }
    } catch (err) {
      console.error('Revoke error:', err);
    }
  };

  const copyShareLink = (shareId: string) => {
    const fullUrl = `${window.location.origin}/verify/share/${shareId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100/80 text-blue-700 rounded-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Selective Vehicle Disclosure</h2>
              <p className="text-xs text-slate-500">
                Share verified vehicle records with buyers while protecting personal privacy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('create')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            Create Shareable Link
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Active Links ({disclosures.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'create' ? (
            <>
              {createdShare ? (
                /* Success View */
                <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-950">Shareable Link Ready!</h3>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Only the {createdShare.categories.length} selected categories are visible. Personal details (owner email, phone, full VIN) remain cryptographically masked.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-emerald-200 text-xs text-slate-700 font-mono">
                    <span className="truncate flex-1">
                      {typeof window !== 'undefined' ? `${window.location.origin}/verify/share/${createdShare.shareId}` : createdShare.shareUrl}
                    </span>
                    <button
                      onClick={() => copyShareLink(createdShare.shareId)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-sans font-bold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-emerald-800 pt-1">
                    <span>Expires: {createdShare.expiresAt ? new Date(createdShare.expiresAt).toLocaleDateString() : 'Never'}</span>
                    <a
                      href={`/verify/share/${createdShare.shareId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      Preview Report <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <button
                    onClick={() => setCreatedShare(null)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    Configure Another Link
                  </button>
                </div>
              ) : (
                /* Form View */
                <div className="space-y-5">
                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Title & Expiry */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Report Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                        placeholder="e.g. Buyer Inspection View"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Link Expiry
                      </label>
                      <select
                        value={expiresInDays === null ? 'never' : String(expiresInDays)}
                        onChange={(e) => setExpiresInDays(e.target.value === 'never' ? null : parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 bg-white"
                      >
                        <option value="1">24 Hours</option>
                        <option value="7">7 Days (Recommended)</option>
                        <option value="14">14 Days</option>
                        <option value="30">30 Days</option>
                        <option value="never">No Expiration</option>
                      </select>
                    </div>
                  </div>

                  {/* Privacy Notice Banner */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                    <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Platform Privacy Protocol Active:</span> Even if all categories are selected, sensitive PII (owner legal name, phone number, address, insurance policy numbers, and raw private keys) is strictly omitted by server-side policy.
                    </div>
                  </div>

                  {/* Categories Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Categories to Disclose ({selectedCategories.length}/{CATEGORIES.length})
                      </label>
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={selectAll}
                          className="text-blue-600 hover:text-blue-800 font-bold"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={clearAll}
                          className="text-slate-500 hover:text-slate-700 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {CATEGORIES.map((cat) => {
                        const isSelected = selectedCategories.includes(cat.id);
                        return (
                          <div
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                              isSelected
                                ? 'bg-blue-50/60 border-blue-300 shadow-sm'
                                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60 text-slate-500'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className={`text-xs font-bold ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                                {cat.label}
                              </div>
                              <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                {cat.desc}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleCreate}
                      disabled={isLoading || selectedCategories.length === 0}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 transition-colors"
                    >
                      {isLoading ? (
                        <>Generating Cryptographic Share Link...</>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          Generate Shareable Verification Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Manage Active Links */
            <div className="space-y-4">
              {loadingDisclosures ? (
                <div className="py-12 text-center text-xs text-slate-500 font-medium">
                  Loading active shareable links...
                </div>
              ) : disclosures.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Share Links Generated</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    You haven’t created any shareable links for this vehicle yet. Switch to the create tab to generate one.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disclosures.map((disc) => (
                    <div
                      key={disc.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{disc.title || 'Vehicle Report'}</span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                disc.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : disc.status === 'REVOKED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {disc.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Created: {new Date(disc.createdAt).toLocaleDateString()} • Expires: {disc.expiresAt ? new Date(disc.expiresAt).toLocaleDateString() : 'Never'} • Views: {disc.accessCount || 0}
                          </p>
                        </div>

                        {disc.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleRevoke(disc.shareId)}
                            className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Revoke access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Revoke
                          </button>
                        )}
                      </div>

                      {/* Categories preview */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {disc.categories.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-[10px] rounded font-medium"
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      {disc.status === 'ACTIVE' && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                          <button
                            onClick={() => copyShareLink(disc.shareId)}
                            className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            Copy Link
                          </button>
                          <a
                            href={`/verify/share/${disc.shareId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1"
                          >
                            Open Report <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
