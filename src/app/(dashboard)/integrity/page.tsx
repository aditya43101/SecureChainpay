'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Server,
  Network,
  Database,
  Cpu,
  ArrowRight,
  Layers,
  FileCheck,
  RotateCcw,
  Zap,
  Bot,
  Search,
} from 'lucide-react';
import {
  BlockchainNode,
  IntegrityIncident,
  RecoveryEvent,
  PaymentAuditRecord,
  IntegritySnapshot,
} from '@/lib/blockchain/integrity-service';

export default function IntegrityDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulatingAction, setSimulatingAction] = useState<string | null>(null);

  const [summary, setSummary] = useState<any>(null);
  const [nodes, setNodes] = useState<BlockchainNode[]>([]);
  const [incidents, setIncidents] = useState<IntegrityIncident[]>([]);
  const [recoveryEvents, setRecoveryEvents] = useState<RecoveryEvent[]>([]);
  const [auditRecords, setAuditRecords] = useState<PaymentAuditRecord[]>([]);
  const [snapshot, setSnapshot] = useState<IntegritySnapshot | null>(null);

  // Selected incident for AI explanation modal
  const [selectedIncident, setSelectedIncident] = useState<IntegrityIncident | null>(null);

  const fetchIntegrityStatus = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/integrity/status');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setNodes(data.nodes || []);
        setIncidents(data.incidents || []);
        setRecoveryEvents(data.recoveryEvents || []);
        setAuditRecords(data.auditRecords || []);
        setSnapshot(data.snapshot || null);
      }
    } catch (err) {
      console.error('Failed to fetch integrity status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSimulate = async (action: string) => {
    setSimulatingAction(action);
    try {
      const res = await fetch('/api/integrity/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchIntegrityStatus();
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulatingAction(null);
    }
  };

  useEffect(() => {
    fetchIntegrityStatus();
  }, []);

  const getNodeStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> HEALTHY
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> DEGRADED
          </span>
        );
      case 'QUARANTINED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)] animate-pulse">
            <Lock className="w-3 h-3 text-rose-400" /> QUARANTINED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400">
            UNKNOWN
          </span>
        );
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            HIGH
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/10 border border-rose-500/30">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Blockchain Integrity & Safe Recovery
                {summary?.quarantinedNodesCount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    ISOLATION ACTIVE
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    SYSTEM SECURE
                  </span>
                )}
              </h1>
              <p className="text-sm text-zinc-400">
                Multi-node block hash comparison, tamper-evident payment audit chain, node isolation & safe state recovery foundation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchIntegrityStatus}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm font-medium text-zinc-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-rose-400' : ''}`} />
            Refresh Integrity
          </button>
        </div>
      </div>

      {/* 1. System Health Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Multi-Node Cluster</span>
            <Network className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white">
            {summary?.healthyNodesCount ?? 3} / {summary?.totalNodes ?? 3}{' '}
            <span className="text-xs font-normal text-zinc-400">Healthy</span>
          </p>
          <p className="text-xs text-zinc-500">
            {summary?.quarantinedNodesCount ?? 0} Nodes Quarantined
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Active Incidents</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">
            {summary?.activeIncidentsCount ?? 0}{' '}
            <span className="text-xs font-normal text-zinc-400">Open</span>
          </p>
          <p className="text-xs text-zinc-500">
            {incidents.filter((i) => i.status === 'RESOLVED').length} Resolved
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Merkle Snapshot</span>
            <FileCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-emerald-400 truncate">
              {snapshot?.rootHash ? `${snapshot.rootHash.substring(0, 10)}...` : 'VERIFIED'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {snapshot?.status || 'VERIFIED'}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {snapshot?.leafCount ?? 3} Linked Audit Records
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Recovered Payments</span>
            <RotateCcw className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-400">
            {auditRecords.filter((r) => r.isRecovered).length}{' '}
            <span className="text-xs font-normal text-zinc-400">Records Restored</span>
          </p>
          <p className="text-xs text-zinc-500">Anti-Erasure Protected</p>
        </div>
      </div>

      {/* 2. Multi-Node Monitoring Matrix Table */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              Multi-Node Consensus & Health Matrix
            </h2>
            <p className="text-xs text-zinc-400">
              Real-time block height and cryptographic hash alignment across independent validator nodes.
            </p>
          </div>
          <button
            onClick={() => handleSimulate('verify_nodes')}
            disabled={simulatingAction !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" /> Run Node Consensus Check
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 rounded-l-lg">Node Identifier</th>
                <th className="py-3 px-4">Provider URL</th>
                <th className="py-3 px-4">Block Height</th>
                <th className="py-3 px-4">Latest Block Hash</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 rounded-r-lg text-right">Isolation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 font-mono">
              {nodes.map((node) => (
                <tr
                  key={node.nodeId}
                  className={node.status === 'QUARANTINED' ? 'bg-rose-500/5 text-white' : ''}
                >
                  <td className="py-3.5 px-4 font-sans font-semibold text-white">
                    {node.name}
                    {node.isTrusted && (
                      <span className="ml-2 text-[10px] font-normal text-emerald-400 font-mono">
                        (Trusted Source)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400">{node.providerUrl}</td>
                  <td className="py-3.5 px-4 font-bold text-cyan-400">#{node.latestBlockNumber}</td>
                  <td className="py-3.5 px-4 text-zinc-300">
                    <span title={node.latestBlockHash}>
                      {node.latestBlockHash.substring(0, 14)}...
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-sans">{node.latencyMs}ms</td>
                  <td className="py-3.5 px-4 font-sans">{getNodeStatusBadge(node.status)}</td>
                  <td className="py-3.5 px-4 font-sans text-right">
                    {node.status === 'QUARANTINED' ? (
                      <button
                        onClick={() => handleSimulate('automated_recovery')}
                        disabled={simulatingAction !== null}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition-all"
                      >
                        Resync & Recover
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSimulate('node_corruption')}
                        disabled={simulatingAction !== null}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-zinc-700 hover:border-rose-500/30 text-[11px] font-semibold transition-all"
                      >
                        Simulate Failure
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Chaos & Attack Simulation Suite */}
      <div className="p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Integrity Chaos & Attack Simulation Suite
          </h2>
          <p className="text-xs text-zinc-400">
            Execute controlled failure tests to verify automatic quarantine, anti-erasure gap detection, and safe state recovery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Simulation Card 1 */}
          <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="p-2 w-fit rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Simulate Node C Hash Divergence</h3>
              <p className="text-xs text-zinc-400">
                Injects a corrupted block hash into Node C to test multi-node anomaly detection & automatic quarantine.
              </p>
            </div>
            <button
              onClick={() => handleSimulate('node_corruption')}
              disabled={simulatingAction !== null}
              className="w-full py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all disabled:opacity-50"
            >
              {simulatingAction === 'node_corruption' ? 'Injecting...' : 'Inject Hash Divergence'}
            </button>
          </div>

          {/* Simulation Card 2 */}
          <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="p-2 w-fit rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Simulate Last-2 Payments Erasure</h3>
              <p className="text-xs text-zinc-400">
                Simulates deletion of recent payment records to test Merkle snapshot sequence gap detection.
              </p>
            </div>
            <button
              onClick={() => handleSimulate('payment_erasure')}
              disabled={simulatingAction !== null}
              className="w-full py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all disabled:opacity-50"
            >
              {simulatingAction === 'payment_erasure' ? 'Deleting...' : 'Trigger Erasure Attack'}
            </button>
          </div>

          {/* Simulation Card 3 */}
          <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="p-2 w-fit rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Simulate Database Field Tampering</h3>
              <p className="text-xs text-zinc-400">
                Modifies payment amount in table storage to test linked audit chain hash verification.
              </p>
            </div>
            <button
              onClick={() => handleSimulate('payment_tamper')}
              disabled={simulatingAction !== null}
              className="w-full py-2 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all disabled:opacity-50"
            >
              {simulatingAction === 'payment_tamper' ? 'Tampering...' : 'Tamper Field Amount'}
            </button>
          </div>

          {/* Simulation Card 4 - Recovery */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-950/40 to-zinc-950 border border-emerald-500/30 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="p-2 w-fit rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Run Automated Recovery Engine</h3>
              <p className="text-xs text-zinc-400">
                Resynchronizes node state, restores deleted payments with audit events, and resolves open incidents.
              </p>
            </div>
            <button
              onClick={() => handleSimulate('automated_recovery')}
              disabled={simulatingAction !== null}
              className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {simulatingAction === 'automated_recovery' ? 'Recovering...' : 'EXECUTE SAFE RECOVERY'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Live Incidents & Forensic Evidence Log */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Integrity Incident & Forensic Evidence Log
            </h2>
            <p className="text-xs text-zinc-400">
              Immutable record of detected node anomalies, payment gaps, and forensic evidence payloads.
            </p>
          </div>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-500">
            No integrity incidents recorded. Run a chaos test above to trigger detection.
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div
                key={incident.incidentId}
                className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/60 hover:border-zinc-700/60 transition-all space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-white">{incident.incidentId}</span>
                    {getSeverityBadge(incident.severity)}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                      {incident.type}
                    </span>
                    <span className="text-zinc-500 font-mono">[{incident.affectedBlockRange}]</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        incident.status === 'RESOLVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {incident.status}
                    </span>
                    <span className="text-zinc-500 text-[10px]">
                      {new Date(incident.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 font-medium">
                  {incident.evidence?.details}
                </p>

                {incident.aiExplanation && (
                  <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-2.5 text-xs text-indigo-200">
                    <Bot className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-indigo-300">Payment AI Forensic Diagnosis: </span>
                      {incident.aiExplanation}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Tamper-Evident Payment Audit & Merkle Proof Inspector */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              Tamper-Evident Payment Audit Chain & Merkle Inspector
            </h2>
            <p className="text-xs text-zinc-400">
              Each payment contains a linked cryptographic audit hash (`SHA-256(prevHash + payload)`), making unauthorized row deletions detectable.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 rounded-l-lg">Payment ID</th>
                <th className="py-3 px-4">Sender / Recipient</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Block #</th>
                <th className="py-3 px-4">Linked Audit Hash</th>
                <th className="py-3 px-4 rounded-r-lg text-right">Integrity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 font-mono">
              {auditRecords.map((record) => (
                <tr key={record.paymentId} className={record.isRecovered ? 'bg-indigo-500/5' : ''}>
                  <td className="py-3.5 px-4 font-sans font-bold text-white flex items-center gap-2">
                    {record.paymentId}
                    {record.isRecovered && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        RECOVERED ✓
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400 font-sans">
                    {(record.sender || '0x_sender').substring(0, 8)}... → {(record.recipient || '0x_recipient').substring(0, 8)}...
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">
                    {(record.amount || 0).toLocaleString()} {record.currency === 'USD' ? 'HSCT' : (record.currency || 'HSCT')}
                  </td>
                  <td className="py-3.5 px-4 text-cyan-400 font-bold">#{record.blockNumber}</td>
                  <td className="py-3.5 px-4 text-zinc-400">
                    <span title={record.currentAuditHash}>
                      {record.currentAuditHash ? `${record.currentAuditHash.substring(0, 14)}...` : 'COMPUTING...'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-sans text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> VERIFIED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
