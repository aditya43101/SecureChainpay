'use client';

import React, { useState } from 'react';
import { Vehicle } from '../../types/vehicle';
import { addVehicleServiceApi } from '../../lib/api';
import {
  Wrench,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  ShieldAlert,
} from 'lucide-react';

interface AddServiceModalProps {
  vehicle: Vehicle;
  userRole: string;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  vehicle,
  userRole,
  token,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    serviceDate: new Date().toISOString().split('T')[0],
    mileage: 45000,
    serviceType: 'Periodic Maintenance',
    description: '',
    partsReplaced: 'Engine Oil, Oil Filter',
    cost: 4500,
    technician: 'Ramesh Sharma',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const isGarageOrAdmin = userRole === 'GARAGE' || userRole === 'ADMIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGarageOrAdmin) {
      setError('RBAC restriction: Only authenticated GARAGE or ADMIN accounts can create certified service records.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const parts = formData.partsReplaced
        ? formData.partsReplaced.split(',').map((p) => p.trim()).filter(Boolean)
        : [];

      const res = await addVehicleServiceApi(
        vehicle.id,
        {
          serviceDate: new Date(formData.serviceDate).toISOString(),
          mileage: Number(formData.mileage),
          serviceType: formData.serviceType,
          description: formData.description,
          partsReplaced: parts,
          cost: formData.cost ? Number(formData.cost) : undefined,
          technician: formData.technician.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        },
        token
      );

      if (res.success && res.data) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      } else {
        setError(res.error || 'Failed to record service');
      }
    } catch (err: any) {
      setError(err.message || 'Service submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Certified Service Record</h3>
              <p className="text-xs text-slate-500 font-mono">
                {vehicle.manufacturer} {vehicle.model} ({vehicle.registrationNumber})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Service Record Anchored!</h4>
            <p className="text-xs text-slate-500">
              Canonical SHA-256 hash anchored to smart contract. Timeline updated.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {!isGarageOrAdmin && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
                <div>
                  <strong>Garage Authorization Required:</strong>
                  <p className="text-[11px] mt-0.5">
                    Your current account role is <code className="bg-amber-100 px-1 rounded font-mono">{userRole}</code>. Owners cannot self-certify garage records. Switch to the seeded garage account in dev mode to test.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Date *</label>
                <input
                  type="date"
                  required
                  value={formData.serviceDate}
                  onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Odometer Mileage (km) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={formData.mileage}
                  onChange={(e) => setFormData({ ...formData, mileage: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Service Type *</label>
              <input
                type="text"
                required
                placeholder="e.g. Periodic Maintenance, Brake System Overhaul"
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Service Description *</label>
              <textarea
                rows={2}
                required
                placeholder="Detailed description of inspection, fluids replaced, diagnostics..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Parts Replaced (comma separated)</label>
              <input
                type="text"
                placeholder="Engine Oil, Oil Filter, Air Filter"
                value={formData.partsReplaced}
                onChange={(e) => setFormData({ ...formData, partsReplaced: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Total Cost (INR)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Technician Name</label>
                <input
                  type="text"
                  value={formData.technician}
                  onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !formData.description.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50 shadow-xs"
              >
                {submitting ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Anchoring Proof...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Anchor Service Record</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
