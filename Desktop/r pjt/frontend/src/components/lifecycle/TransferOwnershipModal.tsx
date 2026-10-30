'use client';

import React, { useEffect, useState } from 'react';
import { Vehicle } from '../../types/vehicle';
import { User } from '../../types/auth';
import { transferVehicleOwnershipApi, fetchTestUsers } from '../../lib/api';
import {
  History,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  Car,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Search,
  User as UserIcon,
} from 'lucide-react';

interface TransferOwnershipModalProps {
  vehicle: Vehicle;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  vehicle,
  token,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [nameSearch, setNameSearch] = useState('');
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [transferType, setTransferType] = useState('SALE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<any | null>(null);
  const [availableRecipients, setAvailableRecipients] = useState<User[]>([]);

  // Current owner details from vehicle
  const currentOwner = vehicle.currentOwner || {
    name: 'Current Vehicle Owner',
    email: 'owner@vehiclepassport.dev',
    blockchainUserId: 'USR-000001',
    role: 'VEHICLE_OWNER',
  };

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setError(null);
      setTxSuccess(null);
      setTargetIdentifier('');
      setSelectedUser(null);
      setNameSearch('');
      setNotes('');

      // Fetch registered users to provide recipient selection
      fetchTestUsers()
        .then((res) => {
          if (res.success && res.data?.testUsers) {
            // Filter out current owner
            const filtered = res.data.testUsers.filter(
              (u) =>
                u.id !== vehicle.currentOwnerId &&
                u.email?.toLowerCase() !== currentOwner.email?.toLowerCase()
            );
            setAvailableRecipients(filtered);
          }
        })
        .catch(() => {
          // Non-fatal fallback
        });
    }
  }, [isOpen, vehicle.currentOwnerId, currentOwner.email]);

  if (!isOpen) return null;

  // Filter recipients by name or email search query
  const filteredRecipients = availableRecipients.filter((u) => {
    if (!nameSearch.trim()) return true;
    const q = nameSearch.trim().toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.blockchainUserId?.toLowerCase().includes(q)
    );
  });

  // Selected recipient user if matched
  const matchedRecipient =
    selectedUser ||
    availableRecipients.find(
      (u) =>
        u.email.toLowerCase() === targetIdentifier.trim().toLowerCase() ||
        u.id === targetIdentifier.trim() ||
        u.blockchainUserId === targetIdentifier.trim() ||
        u.name?.toLowerCase() === targetIdentifier.trim().toLowerCase()
    );

  const isSelfTransfer =
    targetIdentifier.trim().toLowerCase() === currentOwner.email?.toLowerCase() ||
    targetIdentifier.trim() === vehicle.currentOwnerId ||
    (currentOwner.blockchainUserId && targetIdentifier.trim() === currentOwner.blockchainUserId) ||
    (currentOwner.name && targetIdentifier.trim().toLowerCase() === currentOwner.name.toLowerCase());

  const handleSelectUser = (u: User) => {
    setSelectedUser(u);
    setTargetIdentifier(u.name || u.email);
    setError(null);
  };

  const handleReviewStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const effectiveTarget = selectedUser?.email || targetIdentifier.trim();

    if (!effectiveTarget) {
      setError('Please search and select a recipient user by name or provide an email.');
      return;
    }

    if (isSelfTransfer) {
      setError('Cannot transfer vehicle to yourself (self-transfer is prohibited).');
      return;
    }

    setStep('review');
  };

  const handleFinalSubmit = async () => {
    setError(null);
    setSubmitting(true);

    const effectiveTarget = selectedUser?.email || selectedUser?.id || targetIdentifier.trim();

    try {
      const res = await transferVehicleOwnershipApi(
        vehicle.id,
        {
          targetUserIdentifier: effectiveTarget,
          transferType,
          notes: notes.trim() || undefined,
        },
        token
      );

      if (res.success && res.data) {
        setTxSuccess(res.data);
      } else {
        setError(res.error || 'Ownership transfer failed');
        setStep('form');
      }
    } catch (err: any) {
      setError(err.message || 'Transfer request failed');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Transfer Vehicle Ownership</h3>
              <p className="text-xs text-slate-500 font-mono">
                {vehicle.manufacturer} {vehicle.model} • {vehicle.registrationNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {txSuccess ? (
          /* ================= SUCCESS STATE ================= */
          <div className="p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900">Ownership Transfer Confirmed!</h4>
              <p className="text-xs text-slate-600 mt-1">
                Cryptographic ownership anchor confirmed on EVM blockchain ledger.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left font-mono text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500">Status</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold text-[11px]">
                  <ShieldCheck className="w-3 h-3" />
                  ANCHORED ON-CHAIN
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-[11px]">Transaction Hash:</span>
                <span className="break-all text-slate-800 font-bold">{txSuccess.blockchainTxHash || txSuccess.transactionHash}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Block Number:</span>
                  <span className="text-slate-800 font-bold">#{txSuccess.blockNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Passport ID:</span>
                  <span className="text-slate-800 font-bold">{txSuccess.passportId || vehicle.passportId}</span>
                </div>
              </div>
              <div className="pt-1 border-t border-slate-200 text-[11px]">
                <span className="text-slate-500 block">New Registered Owner:</span>
                <span className="text-blue-700 font-bold">
                  {txSuccess.newOwnerName} ({txSuccess.newOwnerBlockchainId || 'Registered'})
                </span>
              </div>
            </div>

            <button
              onClick={handleDone}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Done &amp; Update Garage
            </button>
          </div>
        ) : step === 'review' ? (
          /* ================= STEP 2: REVIEW & CONFIRM ================= */
          <div className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Transfer Error:</strong>
                  <p className="text-[11px] mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
              <strong className="flex items-center gap-1.5 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Irreversible Blockchain Transfer
              </strong>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                You are about to transfer all legal ownership and administrative authority for this vehicle. Once confirmed on-chain, this vehicle will be moved to the new owner's profile.
              </p>
            </div>

            {/* Transition Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Ownership Transition
              </div>

              <div className="flex items-center justify-between gap-3">
                {/* Current Owner */}
                <div className="flex-1 p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">From (Current Owner)</span>
                  <div className="font-bold text-slate-900 truncate">{currentOwner.name}</div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">{currentOwner.email}</div>
                  <div className="text-[10px] font-mono text-blue-600 font-bold">{currentOwner.blockchainUserId}</div>
                </div>

                <div className="text-slate-400">
                  <ArrowRight className="w-5 h-5 text-brand-600" />
                </div>

                {/* New Owner */}
                <div className="flex-1 p-2.5 bg-white rounded-lg border border-brand-300 shadow-xs">
                  <span className="text-[10px] text-brand-600 uppercase font-semibold block">To (New Owner)</span>
                  <div className="font-bold text-slate-900 truncate">
                    {matchedRecipient ? matchedRecipient.name : targetIdentifier}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    {matchedRecipient ? matchedRecipient.email : targetIdentifier}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-600 font-bold">
                    {matchedRecipient?.blockchainUserId || 'Registered Identity'}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400">Transfer Type:</span>
                  <span className="font-bold text-slate-700 ml-1">{transferType}</span>
                </div>
                <div>
                  <span className="text-slate-400">Passport ID:</span>
                  <span className="font-mono font-bold text-slate-700 ml-1">{vehicle.passportId}</span>
                </div>
              </div>

              {notes && (
                <div className="text-[11px] pt-1">
                  <span className="text-slate-400">Notes:</span>
                  <p className="text-slate-700 italic mt-0.5">&ldquo;{notes}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
              >
                &larr; Back to Search
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Anchoring on EVM Ledger...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm &amp; Anchor on Blockchain</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ================= STEP 1: FORM INPUTS WITH NAME SEARCH ================= */
          <form onSubmit={handleReviewStep} className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Transfer Error:</strong>
                  <p className="text-[11px] mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Current Owner & Vehicle Summary Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Current Registered Owner:</span>
                <span className="font-mono text-blue-700 font-bold">{currentOwner.blockchainUserId}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  {currentOwner.name?.charAt(0) || 'O'}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{currentOwner.name}</div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">{currentOwner.email}</div>
                </div>
              </div>
            </div>

            {/* 1. SEARCH USER BY NAME */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>Search Recipient by Name:</span>
                {selectedUser && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Recipient Selected
                  </span>
                )}
              </label>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Type name (e.g. Priya Patel, Rohan, Neha, Aarav)..."
                  value={nameSearch}
                  onChange={(e) => {
                    setNameSearch(e.target.value);
                    if (!selectedUser) {
                      setTargetIdentifier(e.target.value);
                    }
                    setError(null);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-medium bg-white placeholder:text-slate-400"
                />
              </div>

              {/* Matching Users List */}
              <div className="max-h-44 overflow-y-auto space-y-1.5 pt-1 pr-0.5">
                {filteredRecipients.length > 0 ? (
                  filteredRecipients.map((recipient) => {
                    const isSelected =
                      selectedUser?.id === recipient.id ||
                      targetIdentifier.trim().toLowerCase() === recipient.name?.toLowerCase() ||
                      targetIdentifier.trim().toLowerCase() === recipient.email?.toLowerCase();

                    return (
                      <button
                        type="button"
                        key={recipient.id}
                        onClick={() => handleSelectUser(recipient)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {recipient.name?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">
                              {recipient.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 truncate">
                              {recipient.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-mono text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {recipient.blockchainUserId || 'USR-REG'}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-slate-400 bg-slate-50 rounded-xl text-[11px]">
                    No registered user matching "{nameSearch}". You can also enter email directly below.
                  </div>
                )}
              </div>
            </div>

            {/* Selected Recipient Card Display */}
            {selectedUser && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-emerald-800 font-semibold uppercase block">
                      Target Recipient
                    </span>
                    <div className="font-bold text-emerald-950 text-xs truncate">
                      {selectedUser.name} ({selectedUser.email})
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setTargetIdentifier('');
                  }}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 ml-2 cursor-pointer"
                >
                  Change
                </button>
              </div>
            )}

            {/* Direct Input Fallback */}
            {!selectedUser && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Or Enter Recipient Name / Email / User ID:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya Patel or priya.patel@vehiclepassport.dev"
                  value={targetIdentifier}
                  onChange={(e) => {
                    setTargetIdentifier(e.target.value);
                    setError(null);
                  }}
                  className={`w-full px-3 py-2 border rounded-xl focus:border-brand-500 focus:outline-hidden font-medium ${
                    isSelfTransfer ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {isSelfTransfer && (
                  <span className="text-[11px] text-rose-600 font-semibold mt-1 block">
                    Self-transfer is prohibited. Recipient must be a different stakeholder.
                  </span>
                )}
              </div>
            )}

            {/* Transfer Type */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Transfer Type *</label>
              <select
                value={transferType}
                onChange={(e) => setTransferType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-medium bg-white"
              >
                <option value="SALE">Commercial Sale</option>
                <option value="TRANSFER">Direct Ownership Transfer</option>
                <option value="GIFT">Gift / Inheritance</option>
                <option value="FAMILY_REASSIGNMENT">Family Reassignment</option>
                <option value="OTHER">Other Assignment</option>
              </select>
            </div>

            {/* Transfer Notes */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Transfer Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Bill of sale verified, payment cleared, physical keys exchanged."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                <span>Review Transfer</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
