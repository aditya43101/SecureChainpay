'use client';

import React, { useState } from 'react';
import { TimelineEvent } from '../../types/vehicle';
import {
  Calendar,
  User,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  History,
  FileSpreadsheet,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Car,
  ChevronDown,
  ChevronUp,
  Hash,
} from 'lucide-react';

interface TimelineViewProps {
  events: TimelineEvent[];
  loading: boolean;
  onRefresh: () => void;
  onSelectEvent?: (event: TimelineEvent) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  events,
  loading,
  onRefresh,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredEvents =
    filterType === 'ALL'
      ? events
      : events.filter((e) => e.category === filterType);

  const getEventIcon = (category: string) => {
    switch (category) {
      case 'REGISTRATION':
        return <Car className="w-4 h-4 text-emerald-600" />;
      case 'OWNERSHIP':
        return <History className="w-4 h-4 text-blue-600" />;
      case 'SERVICE':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'ODOMETER':
        return <Clock className="w-4 h-4 text-indigo-600" />;
      case 'ACCIDENT':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'INSURANCE':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'DOCUMENT':
        return <FileSpreadsheet className="w-4 h-4 text-teal-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getEventBadgeClass = (category: string) => {
    switch (category) {
      case 'REGISTRATION':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OWNERSHIP':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'SERVICE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ODOMETER':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ACCIDENT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'INSURANCE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'DOCUMENT':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status: 'CONFIRMED' | 'PENDING' | 'SUSPICIOUS' | 'TAMPER_DETECTED') => {
    if (status === 'SUSPICIOUS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
          <AlertTriangle className="w-3 h-3" />
          ⚠ SUSPICIOUS
        </span>
      );
    }
    if (status === 'CONFIRMED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          ✓ CONFIRMED
        </span>
      );
    }
    if (status === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
          <Clock className="w-3 h-3" />
          ⏳ PENDING
        </span>
      );
    }
    if (status === 'TAMPER_DETECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
          <AlertCircle className="w-3 h-3" />
          ✕ TAMPER DETECTED
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Vehicle Passport Lifecycle Timeline</h3>
            <span className="text-[11px] font-mono px-2 py-0.5 bg-brand-50 text-brand-700 border border-brand-200 rounded-full font-semibold">
              {events.length} Lifecycle Events
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological, immutable audit trail of manufacturing, ownership transfers, servicing, odometer, accidents, and insurance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 focus:outline-hidden font-medium"
          >
            <option value="ALL">All Event Types</option>
            <option value="OWNERSHIP">Ownership Transfers</option>
            <option value="SERVICE">Service Records</option>
            <option value="ODOMETER">Odometer Records</option>
            <option value="ACCIDENT">Accidents &amp; Repairs</option>
            <option value="INSURANCE">Insurance Policies</option>
            <option value="DOCUMENT">Documents</option>
          </select>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <Clock className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      {loading && events.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Loading lifecycle events from PostgreSQL and Hardhat ledger...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">No events found</h4>
          <p className="text-xs text-slate-400 mt-1">No lifecycle records match the selected category filter.</p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:top-3 before:bottom-3 before:left-3 sm:before:left-4 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((event) => {
            const isExpanded = selectedEvent?.id === event.id;
            const dateObj = new Date(event.date);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const formattedYear = event.year || dateObj.getFullYear();
            const isRollback = event.status === 'SUSPICIOUS' || event.title.includes('Rollback');

            return (
              <div key={event.id} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-6 sm:-left-8 top-3.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border-2 border-slate-300 group-hover:border-brand-500 flex items-center justify-center shadow-xs transition z-10">
                  {getEventIcon(event.category)}
                </div>

                {/* Event Card */}
                <div
                  onClick={() => setSelectedEvent(isExpanded ? null : event)}
                  className={`bg-white rounded-2xl border transition shadow-xs cursor-pointer overflow-hidden ${
                    isExpanded
                      ? 'border-brand-400 ring-2 ring-brand-100'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="p-4 sm:p-5">
                    {/* Top Row: Year, Category Badge, Status, Date */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 font-mono tracking-tight">
                          {formattedYear}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getEventBadgeClass(
                            event.category
                          )}`}
                        >
                          {event.title}
                        </span>
                        {getStatusBadge(event.status)}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formattedDate}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 ml-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
                        )}
                      </div>
                    </div>

                    {/* Event Description */}
                    <h4 className="text-sm font-bold text-slate-900 mb-1">{event.description}</h4>

                    {/* Actor information */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        <strong className="text-slate-700">{event.actor}</strong>
                      </span>
                    </div>

                    {/* Rollback alert if flagged */}
                    {isRollback && (
                      <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong>⚠ Possible Odometer Rollback Detected:</strong>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            This odometer entry is lower than previously recorded chronological mileage on this vehicle. The event is preserved with audit flag for transparency.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Blockchain Tx & Hash Preview Badge */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600">
                      {event.blockchainTxHash ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-emerald-800">
                          <LinkIcon className="w-3 h-3 text-emerald-600" />
                          <span className="font-semibold">Tx:</span>
                          <span className="truncate max-w-[120px] sm:max-w-[200px]">
                            {event.blockchainTxHash.substring(0, 10)}...{event.blockchainTxHash.substring(event.blockchainTxHash.length - 8)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Off-chain entry</span>
                      )}

                      {event.recordHash && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold">Hash:</span>
                          <span className="truncate max-w-[100px]">
                            {event.recordHash.substring(0, 10)}...
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Expanded Details Drawer */}
                    {isExpanded && event.details && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-slate-50/60 p-3.5 rounded-xl text-xs">
                        <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                          Full Record Metadata
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                          {Object.entries(event.details).map(([key, val]) => {
                            if (val === null || val === undefined) return null;
                            const label = key
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, (str) => str.toUpperCase());
                            const displayVal =
                              Array.isArray(val)
                                ? val.join(', ')
                                : typeof val === 'object'
                                ? JSON.stringify(val)
                                : String(val);

                            return (
                              <div key={key} className="bg-white p-2 rounded-lg border border-slate-200/70">
                                <span className="font-semibold text-slate-500 block text-[10px]">
                                  {label}
                                </span>
                                <span className="font-mono text-slate-800 break-all text-[11px]">
                                  {displayVal}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
