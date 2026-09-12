'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWalletStore } from '@/stores/wallet-store';
import { auth } from '@/lib/firebase/client';
import { evaluatePaymentRisk, computeUserBehaviorProfile, PaymentRiskAssessment, PAYMENT_AI_MODEL_VERSION } from '@/lib/payments/payment-risk-engine';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Activity,
  Users,
  TrendingUp,
  Cpu,
  RefreshCw,
  Search,
  Zap,
  Shield,
  Database,
  GitBranch,
  AlertCircle,
  Layers,
  Eye,
  ChevronRight,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChainIntegrityReport {
  reportId: string;
  generatedAt: string;
  durationMs: number;
  totalBlocksScanned: number;
  validBlocks: number;
  tamperedBlocks: number;
  brokenLinks: number;
  orphanedBlocks: number;
  sequenceGaps: number[];
  genesisHashVerified: boolean;
  genesisHash: string;
  lastBlockHash: string;
  lastBlockNumber: number;
  chainHealthScore: number;
  overallStatus: 'INTACT' | 'COMPROMISED' | 'PARTIALLY_COMPROMISED' | 'EMPTY';
  results: Array<{
    blockId: string;
    blockNumber: number;
    status: 'VALID' | 'HASH_MISMATCH' | 'PREVIOUS_HASH_BROKEN' | 'ORPHANED' | 'GENESIS';
    storedHash: string;
    computedHash: string;
    hashMatch: boolean;
    chainContinuous: boolean;
    timestamp: string;
    sender: string;
    receiver: string;
    amount: number;
    currency: string;
    type: string;
  }>;
  summary: string;
}

interface SecurityEvent {
  id: string;
  eventId: string;
  type: string;
  userId: string;
  resource: string;
  action: string;
  result: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  metadata?: any;
}

// ─── Phase 3 Smart Contract Anchor Panel ────────────────────────────────────

function Phase3ContractAnchorPanel() {
  const [chainStatus, setChainStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/blockchain/chain-status');
      const json = await res.json();
      if (json.success) {
        setChainStatus(json);
      } else {
        setError(json.error || 'Failed to fetch chain status');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const onChainState = chainStatus?.onChainState;
  const dbState = chainStatus?.dbState;
  const reconciliation = chainStatus?.reconciliation;
  const isSync = !reconciliation?.isDivergent;

  return (
    <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 28, marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color="#10B981" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
                Phase 3 — Smart Contract Chain Anchor
              </h2>
              <span style={{ padding: '2px 10px', background: isSync ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isSync ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 20, fontSize: 11, fontWeight: 700, color: isSync ? '#10B981' : '#EF4444' }}>
                {isSync ? '✓ SYNCHRONIZED' : '⚠ DIVERGENT'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              On-chain smart contract authority · Cryptographic chain root anchoring · Contract-first write protocol
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 14,
            background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(16,185,129,0.15)',
            border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : 'rgba(16,185,129,0.3)'}`,
            color: loading ? 'rgba(255,255,255,0.3)' : '#10B981',
            fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, color: '#FCA5A5', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {onChainState ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Anchor Contract Address</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#10B981', wordBreak: 'break-all', fontWeight: 700 }}>
              {onChainState.contractAddress}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>On-Chain Height</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>
              Block #{onChainState.latestBlockNumber}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              DB Height: #{dbState?.height ?? dbState?.lastBlockNumber ?? 0}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Latest Chain Root</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#818CF8', wordBreak: 'break-all' }}>
              {onChainState.chainRoot ? `${onChainState.chainRoot.substring(0, 24)}...` : 'None'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Block Writer Role</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all' }}>
              {onChainState.blockWriter}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          Loading smart contract on-chain state...
        </div>
      )}
    </div>
  );
}

// ─── Chain Integrity Panel ────────────────────────────────────────────────────


function ChainIntegrityPanel() {
  const [report, setReport] = useState<ChainIntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const runVerification = useCallback(async () => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) { setError('Not authenticated — please sign in.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/blockchain/verify-chain?maxBlocks=200', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setReport(json.report);
      } else {
        setError(json.error || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run on mount when user is authenticated
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) runVerification();
    });
    return () => unsubscribe();
  }, [runVerification]);

  const statusConfig = {
    INTACT: { color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', label: '✓ CHAIN INTACT', icon: '🛡️' },
    COMPROMISED: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', label: '⚠ COMPROMISED', icon: '🚨' },
    PARTIALLY_COMPROMISED: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', label: '⚡ PARTIAL COMPROMISE', icon: '⚠️' },
    EMPTY: { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', label: '○ EMPTY CHAIN', icon: '📋' },
  };
  const cfg = report ? statusConfig[report.overallStatus] : statusConfig.EMPTY;

  return (
    <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 28, marginBottom: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GitBranch size={22} color="#818CF8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
                Phase 2 — Chain Integrity Validator
              </h2>
              <span style={{ padding: '2px 10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#818CF8' }}>
                LIVE
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Full SHA-256 hash-chain traversal · Tamper detection · Genesis anchor verification
            </p>
          </div>
        </div>

        <button
          onClick={runVerification}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 14,
            background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.15)',
            border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.3)'}`,
            color: loading ? 'rgba(255,255,255,0.3)' : '#818CF8',
            fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Scanning Chain...' : 'Run Integrity Scan'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, color: '#FCA5A5', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Status Banner */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderRadius: 16,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>{cfg.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: cfg.color, letterSpacing: '0.5px' }}>{cfg.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{report.summary}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: cfg.color, lineHeight: 1 }}>{report.chainHealthScore}%</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Chain Health Score</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Blocks Scanned', value: report.totalBlocksScanned, color: '#818CF8' },
              { label: 'Valid Blocks', value: report.validBlocks, color: '#10B981' },
              { label: 'Tampered', value: report.tamperedBlocks, color: report.tamperedBlocks > 0 ? '#EF4444' : '#10B981' },
              { label: 'Broken Links', value: report.brokenLinks, color: report.brokenLinks > 0 ? '#F59E0B' : '#10B981' },
              { label: 'Orphaned', value: report.orphanedBlocks, color: report.orphanedBlocks > 0 ? '#F97316' : '#10B981' },
              { label: 'Seq. Gaps', value: report.sequenceGaps.length, color: report.sequenceGaps.length > 0 ? '#F59E0B' : '#10B981' },
            ].map((stat) => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Genesis + Last Block Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Hash size={14} color="#10B981" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Genesis Block</span>
                <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: report.genesisHashVerified ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: report.genesisHashVerified ? '#10B981' : '#EF4444' }}>
                  {report.genesisHashVerified ? '✓ VERIFIED' : '✗ MISMATCH'}
                </span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', wordBreak: 'break-all' }}>
                {report.genesisHash ? `${report.genesisHash.substring(0, 32)}...` : 'Not found'}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Layers size={14} color="#818CF8" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chain Head</span>
                <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                  Block #{report.lastBlockNumber}
                </span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', wordBreak: 'break-all' }}>
                {report.lastBlockHash ? `${report.lastBlockHash.substring(0, 32)}...` : 'Empty'}
              </div>
            </div>
          </div>

          {/* Scan time */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              Report ID: <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>{report.reportId}</span> · Scanned in {report.durationMs}ms · {new Date(report.generatedAt).toLocaleTimeString()}
            </span>
            {report.results.length > 0 && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#818CF8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <Eye size={13} />
                {showDetails ? 'Hide' : 'View'} Block Details
                <ChevronRight size={13} style={{ transform: showDetails ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            )}
          </div>

          {/* Block Details Table */}
          {showDetails && report.results.length > 0 && (
            <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['#', 'Status', 'Block ID', 'Hash Match', 'Chain Continuous', 'Type', 'Amount'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.results.map((r) => {
                      const sc = r.status === 'VALID' || r.status === 'GENESIS' ? '#10B981' :
                        r.status === 'HASH_MISMATCH' ? '#EF4444' :
                        r.status === 'PREVIOUS_HASH_BROKEN' ? '#F59E0B' : '#F97316';
                      return (
                        <tr key={r.blockId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)' }}>{r.blockNumber}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: `${sc}18`, color: sc }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.4)' }}>
                            {r.blockId.length > 20 ? `${r.blockId.substring(0, 20)}...` : r.blockId}
                          </td>
                          <td style={{ padding: '9px 14px', color: r.hashMatch ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                            {r.hashMatch ? '✓ YES' : '✗ NO'}
                          </td>
                          <td style={{ padding: '9px 14px', color: r.chainContinuous ? '#10B981' : '#F59E0B', fontWeight: 700 }}>
                            {r.chainContinuous ? '✓ YES' : '✗ NO'}
                          </td>
                          <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)' }}>{r.type}</td>
                          <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.6)' }}>{r.amount} {r.currency}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!report && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)' }}>
          <Shield size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p>Awaiting authentication to run chain integrity scan.</p>
        </div>
      )}

      {loading && !report && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>🔍 Scanning blockchain hash chain...</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Traversing blocks, recomputing SHA-256 canonical hashes</div>
        </div>
      )}
    </div>
  );
}

// ─── Security Events Feed ─────────────────────────────────────────────────────

function SecurityEventsFeed() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/security/events?limit=40', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) setEvents(json.events || []);
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) fetchEvents();
    });
    return () => unsubscribe();
  }, [fetchEvents]);

  const severityColor = (s: string) => {
    if (s === 'CRITICAL') return '#EF4444';
    if (s === 'HIGH') return '#F97316';
    if (s === 'MEDIUM') return '#F59E0B';
    return '#10B981';
  };

  const resultColor = (r: string) => {
    if (r === 'DENIED') return '#EF4444';
    if (r === 'SUSPICIOUS') return '#F97316';
    if (r === 'FLAGGED') return '#F59E0B';
    return '#10B981';
  };

  const attackAttempts = events.filter(e => e.result === 'DENIED' || e.result === 'FLAGGED').length;
  const criticalEvents = events.filter(e => e.severity === 'CRITICAL').length;
  const highEvents = events.filter(e => e.severity === 'HIGH').length;

  return (
    <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 28, marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={22} color="#F87171" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
              Security Audit Event Log
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Tamper-proof Firestore security events — real-time attack attempt feed
            </p>
          </div>
        </div>
        <button onClick={fetchEvents} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: `${events.length} Total Events`, color: '#818CF8' },
          { label: `${attackAttempts} Attack Attempts`, color: '#EF4444' },
          { label: `${criticalEvents} Critical`, color: '#EF4444' },
          { label: `${highEvents} High Severity`, color: '#F97316' },
        ].map(chip => (
          <span key={chip.label} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${chip.color}12`, border: `1px solid ${chip.color}30`, color: chip.color }}>
            {chip.label}
          </span>
        ))}
      </div>

      {events.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          <Lock size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
          <div>No security events found. The ledger is secured and quiet.</div>
        </div>
      )}

      {events.length > 0 && (
        <div style={{ maxHeight: 380, overflowY: 'auto', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#0a0a0c', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Time', 'Type', 'Resource', 'Result', 'Severity', 'User'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, idx) => (
                <tr key={ev.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: ev.result === 'DENIED' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                  <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.35)' }}>
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                    {ev.type?.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.4)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.resource}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: `${resultColor(ev.result)}18`, color: resultColor(ev.result) }}>
                      {ev.result}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: `${severityColor(ev.severity)}18`, color: severityColor(ev.severity) }}>
                      {ev.severity}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.3)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.userId === 'SYSTEM' ? 'SYSTEM' : `${(ev.userId || '').substring(0, 8)}...`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { transactions, address: userAddress, ownerUid } = useWalletStore();
  const [filter, setFilter] = useState<'all' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('all');
  const [simulatedAssessment, setSimulatedAssessment] = useState<PaymentRiskAssessment | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chain' | 'risk'>('chain');

  const userProfile = useMemo(() => {
    return computeUserBehaviorProfile(ownerUid || 'demo_user', transactions);
  }, [ownerUid, transactions]);

  const assessedTransactions = useMemo(() => {
    return transactions.slice(0, 50).map((tx) => {
      const recipient = tx.receiver || tx.payload?.receiverWallet || '0xExternal';
      const amount = Number(tx.amount || 0);
      const assessment = evaluatePaymentRisk({
        userId: ownerUid || 'user',
        senderAddress: userAddress || '0xSender',
        receiverAddress: recipient,
        receiverDisplayName: tx.description,
        amount,
        userTransactions: transactions,
        customProfile: userProfile,
      });
      return { tx, assessment };
    });
  }, [transactions, ownerUid, userAddress, userProfile]);

  const totalAnalyzed = assessedTransactions.length;
  const lowCount = assessedTransactions.filter((a) => a.assessment.riskLevel === 'LOW').length;
  const mediumCount = assessedTransactions.filter((a) => a.assessment.riskLevel === 'MEDIUM').length;
  const highCount = assessedTransactions.filter((a) => a.assessment.riskLevel === 'HIGH').length;
  const criticalCount = assessedTransactions.filter((a) => a.assessment.riskLevel === 'CRITICAL').length;
  const falsePositiveRate = totalAnalyzed > 0 ? ((mediumCount / totalAnalyzed) * 100).toFixed(1) : '0.0';

  const filteredAssessments = assessedTransactions.filter((item) => {
    if (filter === 'all') return true;
    return item.assessment.riskLevel === filter;
  });

  const handleRunSimulation = (type: 'NORMAL' | 'UNUSUAL_AMOUNT' | 'HIGH_VELOCITY' | 'CIRCULAR_GRAPH') => {
    setSimulationLoading(true);
    setTimeout(() => {
      let simAmount = 500;
      let simReceiver = '0x82F31A78B091A78B091A78B091A78B091A78B091';
      let graphContext = {};
      let customProfile = { ...userProfile };
      if (type === 'UNUSUAL_AMOUNT') simAmount = 125000;
      else if (type === 'HIGH_VELOCITY') { simAmount = 1500; customProfile.recentVelocity10m = 8; }
      else if (type === 'CIRCULAR_GRAPH') { simAmount = 5000; graphContext = { circularFlowDetected: true }; }
      const res = evaluatePaymentRisk({
        userId: ownerUid || 'demo_user',
        senderAddress: userAddress || '0xSender',
        receiverAddress: simReceiver,
        receiverDisplayName: 'Simulated Entity',
        amount: simAmount,
        currency: 'HSCT',
        customProfile,
        graphContext,
      });
      setSimulatedAssessment(res);
      setSimulationLoading(false);
    }, 400);
  };

  const getRiskBadge = (level: string, score: number) => {
    if (level === 'LOW') return (
      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
        <CheckCircle2 size={12} /> LOW ({score}/100)
      </span>
    );
    if (level === 'MEDIUM') return (
      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
        <AlertTriangle size={12} /> MEDIUM ({score}/100)
      </span>
    );
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
        <ShieldAlert size={12} /> {level} ({score}/100)
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white font-sans max-w-7xl mx-auto" style={{ padding: '32px 40px' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Page Header */}
      <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#818CF8', marginBottom: 12 }}>
              <Shield size={14} /> BLOCKCHAIN SECURITY COMMAND CENTER
            </div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Security & Chain Integrity
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 560 }}>
              Real-time blockchain hash chain verification, tamper detection, security event monitoring, and AI-powered payment fraud analysis.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a
              href="/security/simulation"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                color: '#F59E0B',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              <Zap size={14} />
              Security Lab Sandbox
            </a>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#10B981' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981', animation: 'pulse 2s infinite' }} />
              PHASE 1–4 ACTIVE
            </span>
          </div>
        </div>

        {/* Tab Nav */}
        <div style={{ display: 'flex', gap: 4, marginTop: 24, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, width: 'fit-content' }}>
          {[
            { id: 'chain', label: '🔗 Chain Integrity', icon: <GitBranch size={14} /> },
            { id: 'risk', label: '🤖 Payment AI Risk', icon: <Cpu size={14} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 20px', borderRadius: 10,
                background: activeTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                color: activeTab === tab.id ? '#818CF8' : 'rgba(255,255,255,0.4)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── CHAIN INTEGRITY TAB ─── */}
      {activeTab === 'chain' && (
        <>
          <Phase3ContractAnchorPanel />
          <ChainIntegrityPanel />
          <SecurityEventsFeed />
        </>
      )}

      {/* ─── PAYMENT AI RISK TAB ─── */}
      {activeTab === 'risk' && (
        <div className="space-y-8">
          {/* AI Model Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/20 mb-3">
                <Cpu size={14} /> Payment AI Model {PAYMENT_AI_MODEL_VERSION}
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Payment AI & Fraud Risk Center</h2>
              <p className="text-neutral-400 text-sm mt-1 max-w-2xl">
                Behavior-aware transaction anomaly scoring, risk explainability, graph pattern detection, and adaptive pre-flight security evaluation.
              </p>
            </div>
            <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold rounded-xl flex items-center gap-2 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Anomaly Model Active
            </span>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Analyzed Payments', val: totalAnalyzed, color: 'text-white', icon: <Activity size={16} className="text-indigo-400" /> },
              { label: 'Low Risk (Passed)', val: lowCount, color: 'text-emerald-400', icon: <CheckCircle2 size={16} className="text-emerald-400" /> },
              { label: 'Medium Risk', val: mediumCount, color: 'text-amber-400', icon: <AlertTriangle size={16} className="text-amber-400" /> },
              { label: 'High / Critical', val: highCount + criticalCount, color: 'text-rose-400', icon: <ShieldAlert size={16} className="text-rose-400" /> },
              { label: 'False Positive %', val: `${falsePositiveRate}%`, color: 'text-cyan-400', icon: <TrendingUp size={16} className="text-cyan-400" /> },
            ].map(m => (
              <div key={m.label} className="bg-neutral-900/80 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-400">
                  <span>{m.label}</span>{m.icon}
                </div>
                <p className={`text-3xl font-black ${m.color}`}>{m.val}</p>
              </div>
            ))}
          </div>

          {/* Behavioral Baseline */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                  <ShieldCheck size={22} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Personal Payment Intelligence Baseline</h3>
                  <p className="text-neutral-400 text-xs mt-0.5">Behavioral profile calculated deterministically from your transaction history.</p>
                </div>
              </div>
              <span className="text-xs text-neutral-400 font-mono">Wallet Age: <span className="text-white font-bold">{userProfile.walletAgeDays} Days</span></span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
              {[
                { label: 'Typical Amount Range', val: `${userProfile.typicalMinAmount.toLocaleString()} – ${userProfile.typicalMaxAmount.toLocaleString()} HSCT`, color: 'text-white' },
                { label: 'Historical Average Amount', val: `${userProfile.averageAmount.toLocaleString()} HSCT`, color: 'text-indigo-300' },
                { label: 'Known Recipients', val: `${userProfile.knownRecipients.length} Recipient(s)`, color: 'text-emerald-400' },
                { label: 'Recent Velocity (10m)', val: `${userProfile.recentVelocity10m} Payment(s)`, color: 'text-cyan-400' },
              ].map(s => (
                <div key={s.label} className="p-3.5 bg-neutral-900/60 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-neutral-400 font-sans text-[11px]">{s.label}</span>
                  <p className={`${s.color} font-bold text-base`}>{s.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Simulator */}
          <div className="bg-neutral-950 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Zap size={20} className="text-indigo-400" /> Interactive Fraud Anomaly Simulator
                </h3>
                <p className="text-neutral-400 text-xs mt-1">Test pre-flight payment risk scoring against synthetic behavioral scenarios.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { type: 'NORMAL' as const, label: 'Simulate Normal (₹500)', cls: 'bg-neutral-800 hover:bg-neutral-700 text-white' },
                  { type: 'UNUSUAL_AMOUNT' as const, label: 'High Amount (₹125,000)', cls: 'bg-amber-600/30 text-amber-300 hover:bg-amber-600 hover:text-white border border-amber-500/30' },
                  { type: 'HIGH_VELOCITY' as const, label: 'High Velocity', cls: 'bg-rose-600/30 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/30' },
                  { type: 'CIRCULAR_GRAPH' as const, label: 'Circular Graph', cls: 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30' },
                ].map(s => (
                  <Button key={s.type} size="sm" onClick={() => handleRunSimulation(s.type)} className={`${s.cls} text-xs font-bold rounded-xl`}>{s.label}</Button>
                ))}
              </div>
            </div>
            {simulatedAssessment && (
              <div className="p-5 bg-neutral-900 border border-white/10 rounded-2xl space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-neutral-400 font-sans text-xs font-bold uppercase">Simulation Result</span>
                  {getRiskBadge(simulatedAssessment.riskLevel, simulatedAssessment.riskScore)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-neutral-500 block text-[11px] font-sans">Simulated Amount</span>
                    <span className="text-white font-bold text-sm">{simulatedAssessment.amount.toLocaleString()} {simulatedAssessment.currency}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[11px] font-sans">Recommendation</span>
                    <span className="text-indigo-300 font-bold text-sm">{simulatedAssessment.recommendation}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[11px] font-sans">Model Version</span>
                    <span className="text-neutral-400 text-sm">{simulatedAssessment.modelVersion}</span>
                  </div>
                </div>
                {simulatedAssessment.factors.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <span className="text-amber-400 font-sans font-bold text-xs block">Flagged Risk Factors:</span>
                    <ul className="space-y-1 font-sans text-neutral-300">
                      {simulatedAssessment.factors.map((f, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
                          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" /> <span>{f.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Audit Register */}
          <div className="bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-indigo-400" size={22} />
                <h3 className="text-xl font-bold text-white tracking-tight">Live Payment Security Audit Register</h3>
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-white/10 rounded-xl">
                {(['all', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}>{f}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400 uppercase tracking-wider font-sans">
                    <th className="py-3 px-4">Assessment ID</th>
                    <th className="py-3 px-4">Description / Recipient</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Risk Level & Score</th>
                    <th className="py-3 px-4">Recommendation</th>
                    <th className="py-3 px-4">Primary Factor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-neutral-300">
                  {filteredAssessments.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-neutral-500 font-sans">No payment assessments match the selected risk filter.</td></tr>
                  ) : (
                    filteredAssessments.map(({ tx, assessment }) => (
                      <tr key={assessment.assessmentId} className="hover:bg-neutral-900/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-indigo-300">{assessment.assessmentId}</td>
                        <td className="py-3.5 px-4 font-sans max-w-[200px] truncate text-white">{tx.description}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">{assessment.amount.toLocaleString()} {assessment.currency}</td>
                        <td className="py-3.5 px-4">{getRiskBadge(assessment.riskLevel, assessment.riskScore)}</td>
                        <td className="py-3.5 px-4 font-bold text-neutral-300">{assessment.recommendation}</td>
                        <td className="py-3.5 px-4 font-sans text-neutral-400 max-w-[220px] truncate">{assessment.factors[0]?.message || 'Standard behavior profile'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
