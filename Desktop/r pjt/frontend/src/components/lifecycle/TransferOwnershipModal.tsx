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
  const [targetIdentifier, setTargetIdentifier] = useState('');
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
      setNotes('');

      // Fetch registered users to provide recipient selection
      fetchTestUsers()
        .then((res) => {
          if (res.success && res.data?.testUsers) {
            // Filter out current owner
            const filtered = res.data.testUsers.filter(
              (u) =>
                u.id !== vehicle.currentOwnerId &&
                u.email.toLowerCase() !== currentOwner.email?.toLowerCase() &&
                u.role === 'VEHICLE_OWNER'
            );
            setAvailableRecipients(filtered);
          }
        })
        .catch(() => {
          // Non-fatal
        });
    }
  }, [isOpen, vehicle.currentOwnerId, currentOwner.email]);

  if (!isOpen) return null;

  // Selected recipient user if matched
  const matchedRecipient = availableRecipients.find(
    (u) =>
      u.email.toLowerCase() === targetIdentifier.trim().toLowerCase() ||
      u.id === targetIdentifier.trim() ||
      u.blockchainUserId === targetIdentifier.trim()
  );

  const isSelfTransfer =
    targetIdentifier.trim().toLowerCase() === currentOwner.email?.toLowerCase() ||
    targetIdentifier.trim() === vehicle.currentOwnerId ||
    (currentOwner.blockchainUserId && targetIdentifier.trim() === currentOwner.blockchainUserId);

  const handleReviewStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetIdentifier.trim()) {
      setError('Please provide a recipient email or user ID');
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

    try {
      const res = await transferVehicleOwnershipApi(
        vehicle.id,
        {
          targetUserIdentifier: targetIdentifier.trim(),
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden my-8">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
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
                Cryptographic ownership anchor confirmed on EVM blockchain subnet.
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
                <span className="text-brand-700 font-bold">
                  {txSuccess.newOwnerName} ({txSuccess.newOwnerBlockchainId || 'Registered'})
                </span>
              </div>
            </div>

            <button
              onClick={handleDone}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              Done &amp; View Updated Passport
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
                Irreversible Blockchain Transfer Warning
              </strong>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                You are about to transfer all legal ownership and administrative authority for this vehicle. Once confirmed by the blockchain, this action cannot be undone.
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
                  <div className="font-bold text-slate-900 truncate">{matchedRecipient ? matchedRecipient.name : targetIdentifier}</div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">{matchedRecipient ? matchedRecipient.email : targetIdentifier}</div>
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
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
              >
                &larr; Back to Edit
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs disabled:opacity-50 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Anchoring on Hardhat EVM...</span>
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
          /* ================= STEP 1: FORM INPUTS ================= */
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

            {/* Quick Recipient Selection */}
            {availableRecipients.length > 0 && (
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Select Registered Stakeholder:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {availableRecipients.map((recipient) => (
                    <button
                      type="button"
                      key={recipient.id}
                      onClick={() => {
                        setTargetIdentifier(recipient.email);
                        setError(null);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                        targetIdentifier.toLowerCase() === recipient.email.toLowerCase()
                          ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {recipient.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-[11px]">{recipient.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{recipient.email}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {recipient.blockchainUserId}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Target Owner Manual Input */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Recipient Email or User ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. owner.b@vehiclepassport.dev"
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

            {/* Transfer Type */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Transfer Type *</label>
              <select
                value={transferType}
                onChange={(e) => setTransferType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-medium"
              >
                <option value="SALE">Commercial Sale</option>
                <option value="TRANSFER">Direct Ownership Transfer</option>
                <option value="GIFT">Gift / Inheritance</option>
                <option value="OTHER">Other Assignment</option>
              </select>
            </div>

            {/* Transfer Notes */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Transfer Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Title transfer after bill of sale signed and funds cleared."
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
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!targetIdentifier.trim() || Boolean(isSelfTransfer)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs disabled:opacity-50 shadow-xs"
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
