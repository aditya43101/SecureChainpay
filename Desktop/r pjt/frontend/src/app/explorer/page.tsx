'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchBlockchainExplorerOverview,
  fetchBlockchainExplorerTransactions,
} from '../../lib/api';
import {
  ExplorerOverviewData,
  ExplorerTransaction,
} from '../../types/vehicle';
import MerkleBatchExplorer from '../../components/blockchain/MerkleBatchExplorer';
import {
  Activity,
  Layers,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  Car,
  FileCheck2,
  Lock,
  RefreshCw,
} from 'lucide-react';

const EVENT_TYPES = [
  'ALL',
  'VEHICLE_REGISTERED',
  'USER_INITIALIZED',
  'SERVICE',
  'ODOMETER',
  'ACCIDENT',
  'INSURANCE',
  'DOCUMENT',
  'OWNERSHIP_TRANSFERRED',
];

export default function BlockchainExplorerPage() {
  const [overview, setOverview] = useState<ExplorerOverviewData | null>(null);
  const [transactions, setTransactions] = useState<ExplorerTransaction[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<ExplorerTransaction | null>(null);
  const [activeTab, setActiveTab] = useState<'BATCHES' | 'TRANSACTIONS'>('BATCHES');

  const loadData = async (currentPage = 1, type = selectedType, search = searchQuery) => {
    setLoading(true);
    try {
      const [overviewRes, txRes] = await Promise.all([
        fetchBlockchainExplorerOverview(),
        fetchBlockchainExplorerTransactions({
          page: currentPage,
          limit: 15,
          recordType: type,
          search: search.trim() || undefined,
        }),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }

      if (txRes.success && txRes.data) {
        setTransactions(txRes.data.transactions);
        setTotal(txRes.data.total);
        setPage(txRes.data.page);
        setTotalPages(txRes.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading explorer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, selectedType, searchQuery);
  }, [selectedType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(1, selectedType, searchQuery);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'VEHICLE_REGISTERED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'USER_INITIALIZED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SERVICE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ODOMETER':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ACCIDENT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'INSURANCE':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'DOCUMENT':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'OWNERSHIP_TRANSFERRED':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">


      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Top Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Network</div>
            <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5 truncate">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate">{overview?.network || 'Hardhat Local'}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">Chain ID: {overview?.chainId || 31337}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Latest Block</div>
            <div className="text-xl font-extrabold text-blue-600 mt-0.5">
              #{overview?.latestBlock ?? '—'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Live block height</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Anchored Records</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {overview?.stats.totalAnchors ?? '—'}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Immutable proofs</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Registered Vehicles</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {overview?.stats.totalVehicles ?? '—'}
            </div>
            <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Active Passports</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Initialized Users</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {overview?.stats.totalUsers ?? '—'}
            </div>
            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">On-chain identities</div>
          </div>
        </div>

        {/* Contract Address Bar */}
        {overview?.contractAddress && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 px-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">VehiclePassport Contract:</span>
              <span className="font-mono text-slate-800 font-semibold truncate max-w-md">
                {overview.contractAddress}
              </span>
            </div>
            <button
              onClick={() => handleCopy(overview.contractAddress)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 transition"
            >
              {copiedText === overview.contractAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText === overview.contractAddress ? 'Copied' : 'Copy Address'}</span>
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('BATCHES')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
              activeTab === 'BATCHES'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Merkle Batches & Inclusion Proofs (Phase 6)</span>
          </button>
          <button
            onClick={() => setActiveTab('TRANSACTIONS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
              activeTab === 'TRANSACTIONS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Direct Transaction Ledger</span>
          </button>
        </div>

        {activeTab === 'BATCHES' ? (
          <MerkleBatchExplorer />
        ) : (
          <>
            {/* Search & Filter Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Tx Hash, Record Hash, or Passport ID (e.g. VP-000001)..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-600 font-mono"
              />
            </form>

            <button
              onClick={() => loadData(1, selectedType, searchQuery)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Event Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" /> Event:
            </span>
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedType === type
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              On-Chain Activity Feed <span className="text-slate-400 font-normal">({total} total transactions)</span>
            </h3>
            {loading && <div className="text-xs text-blue-600 font-medium animate-pulse">Syncing transactions...</div>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tx Hash</th>
                  <th className="py-3 px-4">Block</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Vehicle / Passport</th>
                  <th className="py-3 px-4">Record Hash Proof</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      No blockchain records matched your query.
                    </td>
                  </tr>
                )}

                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[130px]">{tx.txHash}</span>
                        <button
                          onClick={() => handleCopy(tx.txHash)}
                          className="text-slate-400 hover:text-slate-600 transition"
                          title="Copy Tx Hash"
                        >
                          {copiedText === tx.txHash ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-blue-600">
                      #{tx.blockNumber}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeColor(tx.recordType)}`}>
                        {tx.recordType}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {tx.passportId ? (
                        <Link
                          href={`/verify/${tx.passportId}`}
                          className="font-mono font-bold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <span>{tx.passportId}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-slate-400">System Genesis</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      <span className="truncate max-w-[120px] inline-block">{tx.recordHash}</span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Page <span className="font-bold text-slate-800">{page}</span> of{' '}
                <span className="font-bold text-slate-800">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => loadData(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => loadData(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </main>

      {/* Transaction Inspection Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">On-Chain Transaction Details</h4>
                  <p className="text-[10px] text-slate-400 font-mono">Block #{selectedTx.blockNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Transaction Hash</span>
                <div className="text-slate-800 break-all font-semibold mt-0.5">{selectedTx.txHash}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Cryptographic Record Hash</span>
                <div className="text-slate-800 break-all font-semibold mt-0.5">{selectedTx.recordHash}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-sans font-bold text-slate-400">Event Type</span>
                  <div className="font-semibold text-slate-800 mt-0.5">{selectedTx.recordType}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-sans font-bold text-slate-400">Status</span>
                  <div className="font-semibold text-emerald-600 mt-0.5">{selectedTx.status}</div>
                </div>
              </div>

              {selectedTx.passportId && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 font-sans flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700">Target Vehicle Passport</span>
                    <div className="font-mono font-bold text-slate-900">{selectedTx.passportId}</div>
                  </div>
                  <Link
                    href={`/verify/${selectedTx.passportId}`}
                    className="text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
                  >
                    <span>Verify</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Blockchain Vehicle Passport Explorer. Real-time Ethereum event ledger.</p>
        </div>
      </footer>
    </div>
  );
}
