'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  RefreshCw,
  Zap,
  Activity,
  GitBranch,
  ArrowRight,
  Database,
  Layers,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  ShieldQuestion,
  Workflow,
  FileCheck,
  Check,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyntheticBlock {
  blockNumber: number;
  hash: string;
  previousHash: string;
  chainRoot: string;
  txCount: number;
  status: 'VERIFIED' | 'CORRUPTED' | 'QUARANTINED';
  isTampered?: boolean;
  tamperReason?: string;
}

interface TimelineEvent {
  time: string;
  title: string;
  description: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS' | 'BLOCKED' | 'RECOVERY';
}

interface StageProgress {
  name: string;
  percent: number;
  status: 'pending' | 'in_progress' | 'completed';
}

const INITIAL_SYNTHETIC_BLOCKS: SyntheticBlock[] = [
  {
    blockNumber: 0,
    hash: '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
    previousHash: '0x0000000000000000000000000000000000000000',
    chainRoot: '0x1111222233334444555566667777888899990000',
    txCount: 1,
    status: 'VERIFIED',
  },
  {
    blockNumber: 1,
    hash: '0x2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
    previousHash: '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
    chainRoot: '0x2222333344445555666677778888999900001111',
    txCount: 3,
    status: 'VERIFIED',
  },
  {
    blockNumber: 2,
    hash: '0x3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
    previousHash: '0x2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
    chainRoot: '0x3333444455556666777788889999000011112222',
    txCount: 2,
    status: 'VERIFIED',
  },
  {
    blockNumber: 3,
    hash: '0x4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
    previousHash: '0x3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
    chainRoot: '0x4444555566667777888899990000111122223333',
    txCount: 4,
    status: 'VERIFIED',
  },
  {
    blockNumber: 4,
    hash: '0x5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e',
    previousHash: '0x4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
    chainRoot: '0x5555666677778888999900001111222233334444',
    txCount: 2,
    status: 'VERIFIED',
  },
  {
    blockNumber: 5,
    hash: '0x6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f',
    previousHash: '0x5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e',
    chainRoot: '0x6666777788889999000011112222333344445555',
    txCount: 5,
    status: 'VERIFIED',
  },
];

export default function SecuritySimulationPage() {
  const [blocks, setBlocks] = useState<SyntheticBlock[]>(INITIAL_SYNTHETIC_BLOCKS);
  const [quarantinedBlocks, setQuarantinedBlocks] = useState<SyntheticBlock[]>([]);
  const [systemState, setSystemState] = useState<
    | 'HEALTHY'
    | 'INCIDENT_DETECTED'
    | 'TRANSACTION_FROZEN'
    | 'EMERGENCY_LOCK'
    | 'RECOVERY_REQUIRED'
    | 'RECOVERY_IN_PROGRESS'
    | 'RECOVERED'
  >('HEALTHY');
  const [isContractPaused, setIsContractPaused] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [currentAttackName, setCurrentAttackName] = useState<string | null>(null);

  // Recovery Progress Metrics
  const [recoveryStages, setRecoveryStages] = useState<Record<string, StageProgress>>({
    genesis: { name: 'Genesis Root #0 Validation', percent: 0, status: 'pending' },
    blocks: { name: 'Deterministic Block Reconstruction', percent: 0, status: 'pending' },
    transactions: { name: 'Transaction Signatures & Hashes', percent: 0, status: 'pending' },
    chainRoot: { name: 'Chain Root Rolling Recomputation', percent: 0, status: 'pending' },
    smartContract: { name: 'Smart Contract Anchor Validation', percent: 0, status: 'pending' },
    reconciliation: { name: 'Atomic Database Reconciliation', percent: 0, status: 'pending' },
    audit: { name: 'Post-Recovery Cryptographic Audit', percent: 0, status: 'pending' },
  });

  const [metrics, setMetrics] = useState({
    detectionTimeMs: 0,
    freezeTimeMs: 0,
    recoveryTimeMs: 0,
    blocksVerified: 6,
    transactionsVerified: 17,
    blocksQuarantined: 0,
  });

  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    {
      time: new Date().toLocaleTimeString(),
      title: 'Simulation Sandbox Initialized',
      description: 'Synthetic chain state B0..B5 loaded. System status: HEALTHY.',
      type: 'INFO',
    },
  ]);
  const [txAttemptResult, setTxAttemptResult] = useState<{ success: boolean; message: string; timestamp: string } | null>(null);

  const addTimelineEvent = (title: string, description: string, type: TimelineEvent['type']) => {
    setTimeline((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        title,
        description,
        type,
      },
      ...prev.slice(0, 29),
    ]);
  };

  const handleReset = () => {
    setBlocks(INITIAL_SYNTHETIC_BLOCKS);
    setQuarantinedBlocks([]);
    setSystemState('HEALTHY');
    setIsContractPaused(false);
    setIsSimulating(false);
    setIsRecovering(false);
    setCurrentAttackName(null);
    setTxAttemptResult(null);
    setRecoveryStages({
      genesis: { name: 'Genesis Root #0 Validation', percent: 0, status: 'pending' },
      blocks: { name: 'Deterministic Block Reconstruction', percent: 0, status: 'pending' },
      transactions: { name: 'Transaction Signatures & Hashes', percent: 0, status: 'pending' },
      chainRoot: { name: 'Chain Root Rolling Recomputation', percent: 0, status: 'pending' },
      smartContract: { name: 'Smart Contract Anchor Validation', percent: 0, status: 'pending' },
      reconciliation: { name: 'Atomic Database Reconciliation', percent: 0, status: 'pending' },
      audit: { name: 'Post-Recovery Cryptographic Audit', percent: 0, status: 'pending' },
    });
    setMetrics({
      detectionTimeMs: 0,
      freezeTimeMs: 0,
      recoveryTimeMs: 0,
      blocksVerified: 6,
      transactionsVerified: 17,
      blocksQuarantined: 0,
    });
    addTimelineEvent('Sandbox Reset', 'Reset all synthetic blocks and restored system status to HEALTHY.', 'INFO');
  };

  const runAttackSimulation = async (
    attackType: 'HASH_TAMPER' | 'PREV_HASH_TAMPER' | 'ROOT_MISMATCH' | 'DB_DIVERGENCE' | 'UNAUTHORIZED_WRITE' | 'MISSING_BLOCK' | 'PAUSE_FAILURE',
    title: string
  ) => {
    if (isSimulating || isRecovering) return;
    setIsSimulating(true);
    setCurrentAttackName(title);
    setTxAttemptResult(null);

    const startMs = Date.now();
    addTimelineEvent(`Simulating ${title}`, 'Tamper injected into synthetic block state. Starting multi-signal detection...', 'WARNING');

    // 1. Inject Tamper into Synthetic Blocks
    const newBlocks = [...INITIAL_SYNTHETIC_BLOCKS];
    if (attackType === 'HASH_TAMPER') {
      newBlocks[3] = {
        ...newBlocks[3],
        hash: '0xDEADBEEF99990000111122223333444455556666',
        status: 'CORRUPTED',
        isTampered: true,
        tamperReason: 'Recalculated block hash mismatch',
      };
    } else if (attackType === 'PREV_HASH_TAMPER') {
      newBlocks[3] = {
        ...newBlocks[3],
        previousHash: '0x00000000BADPREVIOUS00000000000000000000',
        status: 'CORRUPTED',
        isTampered: true,
        tamperReason: 'PreviousHash linkage broken',
      };
    } else if (attackType === 'ROOT_MISMATCH') {
      newBlocks[3] = {
        ...newBlocks[3],
        chainRoot: '0xCORRUPTEDROOT99998888777766665555444433',
        status: 'CORRUPTED',
        isTampered: true,
        tamperReason: 'Chain root discrepancy',
      };
    } else if (attackType === 'MISSING_BLOCK') {
      newBlocks.splice(3, 1);
      newBlocks[3].status = 'CORRUPTED';
      newBlocks[3].isTampered = true;
      newBlocks[3].tamperReason = 'Sequence gap: block #3 missing';
    }

    setBlocks(newBlocks);

    // 2. Multi-Signal Detection (450ms)
    await new Promise((r) => setTimeout(r, 450));
    const detectionTime = Date.now() - startMs;
    setSystemState('INCIDENT_DETECTED');
    addTimelineEvent('Threat Confirmed', `Cryptographic inconsistency identified at Block #3 (${title}) in ${detectionTime}ms.`, 'ALERT');

    // 3. Freeze & Pause (500ms)
    const freezeStart = Date.now();
    await new Promise((r) => setTimeout(r, 500));
    const freezeTime = Date.now() - freezeStart;
    if (attackType === 'PAUSE_FAILURE') {
      setSystemState('EMERGENCY_LOCK');
      setIsContractPaused(false);
      addTimelineEvent('Contract Pause FAILED', 'EVM RPC reverted — Triggered EMERGENCY_LOCK server-side protection.', 'ALERT');
    } else {
      setSystemState('TRANSACTION_FROZEN');
      setIsContractPaused(true);
      addTimelineEvent('Global Transaction Freeze', `TransactionSecurityGate locked in ${freezeTime}ms. Smart contract paused on-chain.`, 'ALERT');
    }

    // 4. Last Trusted Checkpoint Step
    await new Promise((r) => setTimeout(r, 400));
    setSystemState('RECOVERY_REQUIRED');
    addTimelineEvent('Last Trusted Checkpoint Identified', 'Last verified healthy block: Block #2 (Hash: 0x3b4c...1b2c). Phase 5 Recovery Required.', 'SUCCESS');

    setMetrics((m) => ({ ...m, detectionTimeMs: detectionTime, freezeTimeMs: freezeTime }));
    setIsSimulating(false);
  };

  const runSelfHealingRecovery = async () => {
    if (isRecovering) return;
    setIsRecovering(true);
    setSystemState('RECOVERY_IN_PROGRESS');
    const recoveryStartMs = Date.now();

    addTimelineEvent('Phase 5 Recovery Started', 'Acquired exclusive recovery lock. Initializing deterministic reconstruction...', 'RECOVERY');

    // Stage 1: Genesis Validation
    setRecoveryStages((s) => ({ ...s, genesis: { ...s.genesis, status: 'in_progress', percent: 50 } }));
    await new Promise((r) => setTimeout(r, 400));
    setRecoveryStages((s) => ({ ...s, genesis: { ...s.genesis, status: 'completed', percent: 100 } }));
    addTimelineEvent('Genesis Root #0 Verified', 'Canonical Genesis hash (genesis:securechainpay:global:v1) validated.', 'SUCCESS');

    // Stage 2: Block Reconstruction & Corrupted Quarantine
    setRecoveryStages((s) => ({ ...s, blocks: { ...s.blocks, status: 'in_progress', percent: 40 } }));
    await new Promise((r) => setTimeout(r, 450));
    const quarantined = blocks.filter((b) => b.isTampered || b.status === 'CORRUPTED');
    const cleanReconstructed: SyntheticBlock[] = [
      INITIAL_SYNTHETIC_BLOCKS[0],
      INITIAL_SYNTHETIC_BLOCKS[1],
      INITIAL_SYNTHETIC_BLOCKS[2],
    ];
    setQuarantinedBlocks(quarantined);
    setBlocks(cleanReconstructed);
    setRecoveryStages((s) => ({ ...s, blocks: { ...s.blocks, status: 'completed', percent: 100 } }));
    addTimelineEvent('Reconstruction & Quarantine', `Quarantined ${quarantined.length} corrupted block(s) into forensic records. Reconstructed B0..B2.`, 'RECOVERY');

    // Stage 3: Transaction Validation
    setRecoveryStages((s) => ({ ...s, transactions: { ...s.transactions, status: 'in_progress', percent: 60 } }));
    await new Promise((r) => setTimeout(r, 400));
    setRecoveryStages((s) => ({ ...s, transactions: { ...s.transactions, status: 'completed', percent: 100 } }));
    addTimelineEvent('Transactions & Balances Recalculated', 'All 6 canonical transactions verified. Balances re-derived from ledger.', 'SUCCESS');

    // Stage 4: Chain Root Recomputation
    setRecoveryStages((s) => ({ ...s, chainRoot: { ...s.chainRoot, status: 'in_progress', percent: 70 } }));
    await new Promise((r) => setTimeout(r, 350));
    setRecoveryStages((s) => ({ ...s, chainRoot: { ...s.chainRoot, status: 'completed', percent: 100 } }));
    addTimelineEvent('Chain Root Recomputed', 'Rolling chain root (0x3333...2222) verified sequentially from Genesis.', 'SUCCESS');

    // Stage 5: Smart Contract Anchor Verification
    setRecoveryStages((s) => ({ ...s, smartContract: { ...s.smartContract, status: 'in_progress', percent: 80 } }));
    await new Promise((r) => setTimeout(r, 400));
    setRecoveryStages((s) => ({ ...s, smartContract: { ...s.smartContract, status: 'completed', percent: 100 } }));
    addTimelineEvent('Smart Contract Cross-Verification', 'SecureChainAnchor.sol verified: Genesis hash and Chain ID match.', 'SUCCESS');

    // Stage 6: Database Reconciliation
    setRecoveryStages((s) => ({ ...s, reconciliation: { ...s.reconciliation, status: 'in_progress', percent: 85 } }));
    await new Promise((r) => setTimeout(r, 450));
    setRecoveryStages((s) => ({ ...s, reconciliation: { ...s.reconciliation, status: 'completed', percent: 100 } }));
    addTimelineEvent('Database Reconciled', 'Firestore global_blocks, global_chain_meta, and user wallet balances synchronized.', 'SUCCESS');

    // Stage 7: Post-Recovery Full Audit
    setRecoveryStages((s) => ({ ...s, audit: { ...s.audit, status: 'in_progress', percent: 90 } }));
    await new Promise((r) => setTimeout(r, 500));
    setRecoveryStages((s) => ({ ...s, audit: { ...s.audit, status: 'completed', percent: 100 } }));
    addTimelineEvent('Full Post-Recovery Audit PASSED', 'Cryptographic continuity verified across all canonical blocks. Integrity score: 100%.', 'SUCCESS');

    // Final Unpause & Resumption
    await new Promise((r) => setTimeout(r, 350));
    setIsContractPaused(false);
    setSystemState('HEALTHY');
    const totalRecoveryTime = Date.now() - recoveryStartMs;
    setMetrics((m) => ({
      ...m,
      recoveryTimeMs: totalRecoveryTime,
      blocksVerified: cleanReconstructed.length,
      transactionsVerified: 6,
      blocksQuarantined: quarantined.length,
    }));
    addTimelineEvent('Smart Contract Unpaused & Transactions Resumed', `Self-healing completed in ${totalRecoveryTime}ms. TransactionSecurityGate UNLOCKED.`, 'SUCCESS');

    setIsRecovering(false);
  };

  const handleFullLifecycleDemo = async () => {
    handleReset();
    await new Promise((r) => setTimeout(r, 300));
    await runAttackSimulation('HASH_TAMPER', 'Block Hash Tampering Attack');
    await new Promise((r) => setTimeout(r, 800));
    await runSelfHealingRecovery();
    await new Promise((r) => setTimeout(r, 500));
    handleSimulateTransaction();
  };

  const handleSimulateTransaction = () => {
    const now = new Date().toLocaleTimeString();
    if (systemState !== 'HEALTHY') {
      setTxAttemptResult({
        success: false,
        message: '❌ TRANSACTION BLOCKED — Blockchain integrity protection is ACTIVE. Transactions are frozen.',
        timestamp: now,
      });
      addTimelineEvent('Transaction Blocked', 'TransactionSecurityGate rejected transaction intent (State: ' + systemState + ').', 'BLOCKED');
    } else {
      const nextBlockNum = blocks.length;
      const newBlock: SyntheticBlock = {
        blockNumber: nextBlockNum,
        hash: `0x${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}11223344`,
        previousHash: blocks[blocks.length - 1]?.hash || '0x000',
        chainRoot: `0xROOT${nextBlockNum}999988887777666655554444`,
        txCount: 1,
        status: 'VERIFIED',
      };
      setBlocks((prev) => [...prev, newBlock]);
      setTxAttemptResult({
        success: true,
        message: `✓ TRANSACTION COMMITTED — Appended as valid new Block #${nextBlockNum} extending recovered height #${blocks.length - 1}.`,
        timestamp: now,
      });
      addTimelineEvent('New Block Committed', `500 HSCT transferred — Block #${nextBlockNum} built on verified canonical state.`, 'SUCCESS');
    }
  };

  const getSystemStatusColor = () => {
    if (systemState === 'HEALTHY') return '#10B981';
    if (systemState === 'INCIDENT_DETECTED') return '#F59E0B';
    if (systemState === 'TRANSACTION_FROZEN') return '#EF4444';
    if (systemState === 'EMERGENCY_LOCK') return '#DC2626';
    if (systemState === 'RECOVERY_IN_PROGRESS') return '#8B5CF6';
    return '#6366F1';
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white font-sans max-w-7xl mx-auto" style={{ padding: '32px 40px' }}>
      {/* Sandbox Header */}
      <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#A78BFA', marginBottom: 12 }}>
              <Sparkles size={14} /> PHASE 5 — SELF-HEALING BLOCKCHAIN LAB
            </div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Blockchain Security & Self-Healing Command Center
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 680 }}>
              Live interactive sandbox demonstrating the complete self-healing lifecycle: attack injection ➔ multi-signal detection ➔ transaction freeze ➔ smart contract pause ➔ Genesis-based reconstruction ➔ post-audit ➔ safe resumption.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, fontSize: 11, fontWeight: 700, color: '#FCA5A5' }}>
              ⚠️ DEMO / SANDBOX MODE — No production blockchain or user funds are modified
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                onClick={handleFullLifecycleDemo}
                disabled={isSimulating || isRecovering}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-900/30"
              >
                <Flame size={14} className="mr-1.5" /> Start Full Attack & Recovery Lifecycle
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm" className="bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl border-white/10">
                <RotateCcw size={13} className="mr-1.5" /> Reset Sandbox
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* System Status Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>System State</span>
            <Activity size={14} color={getSystemStatusColor()} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: getSystemStatusColor() }}>
            {systemState.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            {systemState === 'HEALTHY' ? 'Normal Operations' : 'Active Protection Triggered'}
          </div>
        </div>

        <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Transaction Gate</span>
            <Lock size={14} color={systemState === 'HEALTHY' ? '#10B981' : '#EF4444'} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: systemState === 'HEALTHY' ? '#10B981' : '#EF4444' }}>
            {systemState === 'HEALTHY' ? 'ENABLED (OPEN)' : 'LOCKED (FROZEN)'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Server-side execution gate
          </div>
        </div>

        <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Contract Anchor</span>
            <ShieldCheck size={14} color={isContractPaused ? '#F59E0B' : '#10B981'} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: isContractPaused ? '#F59E0B' : '#10B981' }}>
            {isContractPaused ? 'PAUSED ON-CHAIN' : 'ACTIVE / UNPAUSED'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            SecureChainAnchor.sol
          </div>
        </div>

        <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Self-Healing Engine</span>
            <Workflow size={14} color="#A78BFA" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#A78BFA' }}>
            {isRecovering ? 'RECONSTRUCTING' : systemState === 'RECOVERY_REQUIRED' ? 'READY TO HEAL' : 'STANDBY'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Deterministic Genesis rebuild
          </div>
        </div>
      </div>

      {/* Recovery Progress Display (Phase 5 §36) */}
      {(isRecovering || recoveryStages.genesis.percent > 0) && (
        <div style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 24, padding: 24, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Workflow size={18} color="#A78BFA" />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
                Phase 5 Deterministic Self-Healing Progress
              </h2>
            </div>
            <span style={{ fontSize: 12, color: '#A78BFA', fontWeight: 700 }}>
              {isRecovering ? 'RECONSTRUCTION IN PROGRESS' : '100% RECOVERY COMPLETE'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {Object.entries(recoveryStages).map(([key, stage]) => (
              <div key={key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                  <span>{stage.name}</span>
                  <span style={{ color: stage.percent === 100 ? '#10B981' : '#A78BFA' }}>{stage.percent}%</span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${stage.percent}%`,
                      height: '100%',
                      background: stage.percent === 100 ? '#10B981' : 'linear-gradient(90deg, #8B5CF6, #6366F1)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synthetic Blockchain Visualizer (Before & After Recovered State §37) */}
      <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={18} color="#818CF8" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
              Canonical Blockchain Visualizer
            </h2>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {blocks.length} Canonical Blocks | {quarantinedBlocks.length} Forensic Quarantined
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {blocks.map((b, idx) => (
            <React.Fragment key={b.blockNumber}>
              <div
                style={{
                  minWidth: 170,
                  background: b.isTampered ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${b.isTampered ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16,
                  padding: 14,
                  transition: 'all 0.3s ease',
                  position: 'relative',
                }}
              >
                {b.isTampered && (
                  <span style={{ position: 'absolute', top: -8, right: 8, padding: '1px 8px', background: '#EF4444', color: '#fff', borderRadius: 8, fontSize: 9, fontWeight: 900 }}>
                    TAMPERED
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: b.isTampered ? '#F87171' : '#fff' }}>
                    {b.blockNumber === 0 ? 'Genesis #0' : `Block #${b.blockNumber}`}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: b.isTampered ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.1)', color: b.isTampered ? '#EF4444' : '#10B981', fontWeight: 700 }}>
                    {b.status}
                  </span>
                </div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  Hash: {b.hash.substring(0, 10)}...
                </div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                  Prev: {b.previousHash.substring(0, 8)}...
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{b.txCount} Tx(s)</span>
                  <span style={{ color: '#818CF8' }}>PoA</span>
                </div>
                {b.tamperReason && (
                  <div style={{ fontSize: 10, color: '#F87171', marginTop: 6, fontWeight: 600 }}>
                    ⚠ {b.tamperReason}
                  </div>
                )}
              </div>
              {idx < blocks.length - 1 && (
                <ArrowRight size={16} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Quarantined Forensic Blocks */}
        {quarantinedBlocks.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F87171', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> Preserved Forensic Evidence (Quarantined From Canonical Chain):
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {quarantinedBlocks.map((qb) => (
                <div key={qb.blockNumber} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, fontSize: 11 }}>
                  <span style={{ fontWeight: 800, color: '#F87171' }}>Corrupted Block #{qb.blockNumber}</span> — Hash: {qb.hash.substring(0, 12)}... (Quarantined)
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Two Column Layout: Action Control vs Live Incident Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, marginBottom: 28 }}>
        {/* Left Column: Attack Simulations & Recovery Trigger */}
        <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Zap size={18} color="#F59E0B" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
              Simulate Attacks & Trigger Self-Healing
            </h2>
          </div>

          {/* Recovery Required CTA */}
          {(systemState === 'RECOVERY_REQUIRED' || systemState === 'TRANSACTION_FROZEN' || systemState === 'INCIDENT_DETECTED') && (
            <div style={{ padding: 16, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#A78BFA', marginBottom: 4 }}>
                Ledger Tamper Detected — Recovery Ready
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 12px' }}>
                The chain is frozen at checkpoint Block #2. Click below to execute the deterministic self-healing recovery engine.
              </p>
              <Button
                onClick={runSelfHealingRecovery}
                disabled={isRecovering}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-900/30"
              >
                <Workflow size={14} className="mr-1.5" /> Start Phase 5 Self-Healing Recovery
              </Button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {[
              { type: 'HASH_TAMPER' as const, title: 'Block Hash Tampering', desc: 'Mutates Block #3 hash without updating data/nonce.' },
              { type: 'PREV_HASH_TAMPER' as const, title: 'Previous Hash Tampering', desc: 'Breaks hash-chain continuity link between Block #3 and #2.' },
              { type: 'ROOT_MISMATCH' as const, title: 'Chain Root Mismatch', desc: 'Alters cryptographic chain root in block header.' },
              { type: 'MISSING_BLOCK' as const, title: 'Missing Historical Block (Gap)', desc: 'Simulates deletion of Block #3 creating a sequence gap.' },
              { type: 'PAUSE_FAILURE' as const, title: 'Smart Contract Pause Failure', desc: 'Simulates EVM revert on pause — triggers emergency lock.' },
            ].map((atk) => (
              <button
                key={atk.type}
                disabled={isSimulating || isRecovering}
                onClick={() => runAttackSimulation(atk.type, atk.title)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#fff',
                  cursor: isSimulating || isRecovering ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FCD34D' }}>{atk.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{atk.desc}</div>
                </div>
                <Play size={14} color="#FCD34D" style={{ flexShrink: 0, marginLeft: 8 }} />
              </button>
            ))}
          </div>

          {/* Test Transaction Gate */}
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              Verify Transaction Gate Enforcement
            </div>
            <Button
              onClick={handleSimulateTransaction}
              disabled={isSimulating || isRecovering}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
            >
              <Sparkles size={13} className="mr-1.5" /> Simulate New Transaction (500 HSCT)
            </Button>
            {txAttemptResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: txAttemptResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${txAttemptResult.success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: txAttemptResult.success ? '#10B981' : '#F87171',
                }}
              >
                {txAttemptResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Incident Timeline */}
        <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} color="#818CF8" />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
                Incident Response & Recovery Timeline
              </h2>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Real-time event feed</span>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
            {timeline.map((ev, i) => {
              const borderCol =
                ev.type === 'ALERT' ? 'rgba(239,68,68,0.3)' :
                ev.type === 'WARNING' ? 'rgba(245,158,11,0.3)' :
                ev.type === 'SUCCESS' ? 'rgba(16,185,129,0.3)' :
                ev.type === 'RECOVERY' ? 'rgba(139,92,246,0.3)' :
                ev.type === 'BLOCKED' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.06)';
              const titleCol =
                ev.type === 'ALERT' ? '#F87171' :
                ev.type === 'WARNING' ? '#FCD34D' :
                ev.type === 'SUCCESS' ? '#10B981' :
                ev.type === 'RECOVERY' ? '#A78BFA' :
                ev.type === 'BLOCKED' ? '#F87171' : '#818CF8';

              return (
                <div
                  key={i}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${borderCol}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: titleCol }}>{ev.title}</span>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>{ev.time}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{ev.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Explanation Cards (Phase 5 §39) */}
      <div style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 24, marginBottom: 28 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldQuestion size={18} color="#A78BFA" /> Core Architectural Principles (Professor Reference Guide)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {[
            {
              title: 'WHY FREEZE?',
              desc: 'Prevents untrusted transactions from executing against a corrupted ledger while preserving client financial safety.',
            },
            {
              title: 'WHY GENESIS ROOT?',
              desc: 'Provides the cryptographic origin from which the canonical hash chain and rolling chain root are deterministically rebuilt.',
            },
            {
              title: 'WHY SMART CONTRACT ANCHOR?',
              desc: 'Provides an independent on-chain anchor (SecureChainAnchor.sol) that the database cannot silently redefine or tamper with.',
            },
            {
              title: 'WHY DATABASE RECONCILIATION?',
              desc: 'Restores the database state, transaction logs, and wallet balances strictly to match the verified canonical blockchain.',
            },
            {
              title: 'WHY POST-RECOVERY AUDIT?',
              desc: 'Exhaustively re-verifies every block and hash before unpausing the contract and unlocking the transaction gate.',
            },
          ].map((card, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#A78BFA', marginBottom: 6 }}>{card.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
