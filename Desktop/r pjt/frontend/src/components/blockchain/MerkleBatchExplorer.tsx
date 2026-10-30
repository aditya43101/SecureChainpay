'use client';

import React, { useEffect, useState } from 'react';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Zap,
  ArrowRight,
  FileCheck2,
  Lock,
} from 'lucide-react';
import {
  MerkleBatchDTO,
  BatchOverviewDTO,
  BatchInclusionProofDTO,
} from '../../types/vehicle';
import {
  fetchBatches,
  fetchBatchDetails,
  fetchRecordInclusionProof,
} from '../../lib/api';
import MerkleProofVisualizerModal from './MerkleProofVisualizerModal';

export default function MerkleBatchExplorer() {
  const [batches, setBatches] = useState<MerkleBatchDTO[]>([]);
  const [overview, setOverview] = useState<BatchOverviewDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Selected Batch Drawer
  const [selectedBatch, setSelectedBatch] = useState<MerkleBatchDTO | null>(null);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState<boolean>(false);

  // Proof Modal
  const [activeProof, setActiveProof] = useState<BatchInclusionProofDTO | null>(null);
  const [isProofModalOpen, setIsProofModalOpen] = useState<boolean>(false);
  const [proofLoading, setProofLoading] = useState<boolean>(false);

  const loadBatches = async (currentPage = 1, status = selectedStatus, search = searchQuery) => {
    setLoading(true);
    try {
      const res = await fetchBatches({
        page: currentPage,
        limit: 10,
        status: status === 'ALL' ? undefined : status,
        search: search.trim() || undefined,
      });

      if (res.success && res.data) {
        setBatches(res.data.batches);
        const stats = (res.data as any).overview || (res.data as any).stats || {};
        setOverview({
          totalBatches: stats.totalBatches ?? res.data.batches.length,
          confirmedBatches: stats.confirmedBatches ?? res.data.batches.filter((b: any) => b.status === 'CONFIRMED').length,
          pendingBatches: stats.pendingBatches ?? 0,
          failedBatches: stats.failedBatches ?? 0,
          committedRecords: stats.committedRecords ?? stats.totalCommittedRecords ?? 0,
          networkChainId: stats.networkChainId ?? 31337,
          contractAddress: stats.contractAddress ?? '0x5FbDB2315678afecb367f032d93F642f64180aa3',
          latestBatch: stats.latestBatch ?? res.data.batches[0] ?? null,
        });
        setPage(res.data.page);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches(1, selectedStatus, searchQuery);
  }, [selectedStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadBatches(1, selectedStatus, searchQuery);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInspectBatch = async (batchId: string) => {
    setBatchDetailsLoading(true);
    try {
      const res = await fetchBatchDetails(batchId);
      if (res.success && res.data) {
        const raw = res.data as any;
        const normalizedBatch = raw.batch
          ? { ...raw.batch, isAnchored: raw.onChain?.isAnchored ?? true }
          : raw;
        setSelectedBatch(normalizedBatch);
      }
    } catch (err) {
      console.error('Error fetching batch details:', err);
    } finally {
      setBatchDetailsLoading(false);
    }
  };

  const handleOpenProof = async (batchId: string, recordId: string) => {
    setProofLoading(true);
    try {
      const res = await fetchRecordInclusionProof(batchId, recordId);
      if (res.success && res.data) {
        setActiveProof(res.data);
        setIsProofModalOpen(true);
      }
    } catch (err) {
      console.error('Error fetching proof:', err);
    } finally {
      setProofLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Confirmed On-Chain
          </span>
        );
      case 'PENDING_CONFIRMATION':
      case 'SUBMITTING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            Pending On-Chain
          </span>
        );
      case 'FAILED':
      case 'RECONCILIATION_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Batches</div>
          <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
            {overview?.totalBatches ?? '0'}
            <span className="text-xs font-semibold text-emerald-600">
              ({overview?.confirmedBatches ?? 0} confirmed)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Aggregated Merkle batches</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Committed Records</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {overview?.committedRecords ?? '0'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Individual lifecycle leaves anchored</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Gas Reduction Efficiency</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 flex items-center gap-1">
            <Zap className="w-5 h-5 text-emerald-500" />
            99.0%
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">2,329 gas/rec vs 225k individual</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Cryptographic Standard</div>
          <div className="text-sm font-extrabold text-slate-900 mt-2 truncate">
            Sorted-Pair Keccak-256
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
            EVM Contract: 0x5FbD...80aa3
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Batch ID (e.g. BATCH-2026-000001), Merkle Root, or Tx Hash..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-slate-50/50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
            {['ALL', 'CONFIRMED', 'PENDING_CONFIRMATION', 'FAILED'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1 rounded-lg font-bold transition text-[11px] ${
                  selectedStatus === st
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'PENDING_CONFIRMATION' ? 'Pending' : st}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadBatches(page, selectedStatus, searchQuery)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Batches Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Merkle Batch Ledger</h3>
              <p className="text-[11px] text-slate-500">
                Cryptographic roots anchored on Ethereum / EVM blockchain
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading Merkle batches from blockchain...</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Batches Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No Merkle batches match the selected criteria or no batches have been created yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Batch ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Merkle Root</th>
                  <th className="py-3 px-4 text-center">Leaves</th>
                  <th className="py-3 px-4">Block #</th>
                  <th className="py-3 px-4">Tx Hash</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/60 transition group">
                    <td className="py-4 px-5">
                      <span className="font-extrabold text-slate-900 group-hover:text-blue-600 transition">
                        {batch.batchIdentifier}
                      </span>
                      <div className="text-[10px] font-mono text-slate-400">
                        v{batch.algorithmVersion} • {batch.oddNodeConvention}
                      </div>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(batch.status)}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-800">
                        <span className="font-semibold">{batch.merkleRoot.slice(0, 10)}...{batch.merkleRoot.slice(-6)}</span>
                        <button
                          onClick={() => handleCopy(batch.merkleRoot, `root-${batch.id}`)}
                          className="text-slate-400 hover:text-blue-600 transition"
                          title="Copy Root"
                        >
                          {copiedKey === `root-${batch.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold font-mono text-[11px] border border-blue-100">
                        {batch.leafCount} recs
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-700">
                      {batch.blockNumber ? `#${batch.blockNumber}` : '—'}
                    </td>
                    <td className="py-4 px-4">
                      {batch.transactionHash ? (
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                          <span>{batch.transactionHash.slice(0, 8)}...</span>
                          <button
                            onClick={() => handleCopy(batch.transactionHash!, `tx-${batch.id}`)}
                            className="text-slate-400 hover:text-blue-600 transition"
                          >
                            {copiedKey === `tx-${batch.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(batch.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => handleInspectBatch(batch.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-xs font-bold transition flex items-center gap-1 ml-auto"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Batch Details Drawer / Inspection Panel */}
      {selectedBatch && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-start justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Batch Inspection: {selectedBatch.batchIdentifier}
                </h3>
                {getStatusBadge(selectedBatch.status)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Root committed to smart contract at block #{selectedBatch.blockNumber || 'Pending'}
              </p>
            </div>
            <button
              onClick={() => setSelectedBatch(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-100 transition"
            >
              Close Panel ✕
            </button>
          </div>

          {/* Technical Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Merkle Root (EVM Committed)
              </span>
              <span className="font-mono text-xs font-bold text-slate-900 break-all block">
                {selectedBatch.merkleRoot}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Batch ID Hex Commitment
              </span>
              <span className="font-mono text-xs font-semibold text-slate-700 break-all block">
                {selectedBatch.batchIdHex}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Smart Contract & Chain
              </span>
              <span className="font-mono text-xs font-semibold text-blue-700 break-all block">
                {selectedBatch.contractAddress}
              </span>
              <span className="text-[10px] text-slate-500">Chain ID: {selectedBatch.networkChainId}</span>
            </div>
          </div>

          {/* Records Committed in this Batch */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-blue-600" />
                Committed Records in this Batch ({selectedBatch.records?.length || selectedBatch.leafCount})
              </h4>
              <span className="text-[11px] text-slate-500">
                Each record has an independent logarithmic inclusion proof
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {selectedBatch.records && selectedBatch.records.length > 0 ? (
                selectedBatch.records.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center font-mono">
                          #{rec.leafIndex}
                        </span>
                        <span className="font-bold text-slate-900">{rec.recordType}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          Record ID: {rec.recordId.slice(0, 18)}...
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                        <span>Leaf: {rec.leafHash.slice(0, 16)}...</span>
                        <span>•</span>
                        <span>SHA-256 Snapshot: {rec.recordHashSnapshot.slice(0, 16)}...</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenProof(selectedBatch.id, rec.recordId)}
                      disabled={proofLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>View & Verify Proof</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  Record commitments are stored securely and indexed by leaf position.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cryptographic Proof Visualizer Modal */}
      <MerkleProofVisualizerModal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        proofData={activeProof}
      />
    </div>
  );
}
