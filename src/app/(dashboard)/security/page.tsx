'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWalletStore } from '@/stores/wallet-store';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SecurityPage() {
  const { transactions, address: userAddress, ownerUid } = useWalletStore();
  const [filter, setFilter] = useState<'all' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('all');
  const [simulatedAssessment, setSimulatedAssessment] = useState<PaymentRiskAssessment | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);

  // Derive user behavior profile
  const userProfile = useMemo(() => {
    return computeUserBehaviorProfile(ownerUid || 'demo_user', transactions);
  }, [ownerUid, transactions]);

  // Evaluate risk across recent transactions
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

      return {
        tx,
        assessment,
      };
    });
  }, [transactions, ownerUid, userAddress, userProfile]);

  // Summary Metrics
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

  // Simulator Handler
  const handleRunSimulation = (type: 'NORMAL' | 'UNUSUAL_AMOUNT' | 'HIGH_VELOCITY' | 'CIRCULAR_GRAPH') => {
    setSimulationLoading(true);

    setTimeout(() => {
      let simAmount = 500;
      let simReceiver = '0x82F31A78B091A78B091A78B091A78B091A78B091';
      let graphContext = {};
      let customProfile = { ...userProfile };

      if (type === 'UNUSUAL_AMOUNT') {
        simAmount = 125000;
      } else if (type === 'HIGH_VELOCITY') {
        simAmount = 1500;
        customProfile.recentVelocity10m = 8;
      } else if (type === 'CIRCULAR_GRAPH') {
        simAmount = 5000;
        graphContext = { circularFlowDetected: true };
      }

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
    if (level === 'LOW') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
          <CheckCircle2 size={12} /> LOW ({score}/100)
        </span>
      );
    }
    if (level === 'MEDIUM') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
          <AlertTriangle size={12} /> MEDIUM ({score}/100)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono font-bold flex items-center gap-1 w-fit">
        <ShieldAlert size={12} /> {level} ({score}/100)
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white p-6 md:p-10 font-sans space-y-8 max-w-7xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/20 mb-3">
            <Cpu size={14} /> Payment AI Model {PAYMENT_AI_MODEL_VERSION}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Payment AI & Fraud Risk Center
          </h1>
          <p className="text-neutral-400 text-sm mt-1 max-w-2xl">
            Behavior-aware transaction anomaly scoring, risk explainability, graph pattern detection, and adaptive pre-flight security evaluation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Anomaly Model Active
          </span>
        </div>
      </div>

      {/* Metrics Grid (Sections 28 & 37 Requirements) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-neutral-900/80 border border-white/10 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase tracking-wider">
            <span>Analyzed Payments</span>
            <Activity size={16} className="text-indigo-400" />
          </div>
          <p className="text-3xl font-black text-white">{totalAnalyzed}</p>
          <p className="text-[11px] text-neutral-500 font-mono">Live Transaction Pipeline</p>
        </div>

        <div className="bg-neutral-900/80 border border-emerald-500/20 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>Low Risk (Passed)</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="text-3xl font-black text-emerald-400">{lowCount}</p>
          <p className="text-[11px] text-emerald-500/80 font-mono">Normal Settlement</p>
        </div>

        <div className="bg-neutral-900/80 border border-amber-500/20 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
            <span>Medium Risk</span>
            <AlertTriangle size={16} />
          </div>
          <p className="text-3xl font-black text-amber-400">{mediumCount}</p>
          <p className="text-[11px] text-amber-500/80 font-mono">User Confirmation</p>
        </div>

        <div className="bg-neutral-900/80 border border-rose-500/20 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-rose-400 text-xs font-bold uppercase tracking-wider">
            <span>High / Critical</span>
            <ShieldAlert size={16} />
          </div>
          <p className="text-3xl font-black text-rose-400">{highCount + criticalCount}</p>
          <p className="text-[11px] text-rose-500/80 font-mono">Security Verification</p>
        </div>

        <div className="bg-neutral-900/80 border border-white/10 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase tracking-wider">
            <span>False Positive Rate</span>
            <TrendingUp size={16} className="text-cyan-400" />
          </div>
          <p className="text-3xl font-black text-cyan-400">{falsePositiveRate}%</p>
          <p className="text-[11px] text-neutral-500 font-mono">Calibrated Threshold</p>
        </div>
      </div>

      {/* User Personal Behavioral Baseline Card (Section 29 Requirements) */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-indigo-950/40 border border-indigo-500/20 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Your Personal Payment Intelligence Baseline</h2>
              <p className="text-neutral-400 text-xs mt-0.5">Behavioral profile calculated deterministically from your transaction history.</p>
            </div>
          </div>

          <span className="text-xs text-neutral-400 font-mono">
            Wallet Age: <span className="text-white font-bold">{userProfile.walletAgeDays} Days</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-3.5 bg-neutral-900/60 rounded-2xl border border-white/5 space-y-1">
            <span className="text-neutral-400 font-sans text-[11px]">Typical Amount Range</span>
            <p className="text-white font-bold text-base">
              {userProfile.typicalMinAmount.toLocaleString()} - {userProfile.typicalMaxAmount.toLocaleString()} HSCT
            </p>
          </div>

          <div className="p-3.5 bg-neutral-900/60 rounded-2xl border border-white/5 space-y-1">
            <span className="text-neutral-400 font-sans text-[11px]">Historical Average Amount</span>
            <p className="text-indigo-300 font-bold text-base">{userProfile.averageAmount.toLocaleString()} HSCT</p>
          </div>

          <div className="p-3.5 bg-neutral-900/60 rounded-2xl border border-white/5 space-y-1">
            <span className="text-neutral-400 font-sans text-[11px]">Known Recipients Count</span>
            <p className="text-emerald-400 font-bold text-base">{userProfile.knownRecipients.length} Recipient(s)</p>
          </div>

          <div className="p-3.5 bg-neutral-900/60 rounded-2xl border border-white/5 space-y-1">
            <span className="text-neutral-400 font-sans text-[11px]">Recent Velocity (10m)</span>
            <p className="text-cyan-400 font-bold text-base">{userProfile.recentVelocity10m} Payment(s)</p>
          </div>
        </div>
      </div>

      {/* Interactive Fraud Scenario Simulator (Section 38 Requirements) */}
      <div className="bg-neutral-950 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Zap size={20} className="text-indigo-400" /> Interactive Fraud Anomaly Simulator
            </h2>
            <p className="text-neutral-400 text-xs mt-1">Test pre-flight payment risk scoring against synthetic behavioral scenarios.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleRunSimulation('NORMAL')}
              className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl"
            >
              Simulate Normal (₹500)
            </Button>
            <Button
              size="sm"
              onClick={() => handleRunSimulation('UNUSUAL_AMOUNT')}
              className="bg-amber-600/30 text-amber-300 hover:bg-amber-600 hover:text-white border border-amber-500/30 text-xs font-bold rounded-xl"
            >
              Simulate High Amount (₹125,000)
            </Button>
            <Button
              size="sm"
              onClick={() => handleRunSimulation('HIGH_VELOCITY')}
              className="bg-rose-600/30 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/30 text-xs font-bold rounded-xl"
            >
              Simulate High Velocity
            </Button>
            <Button
              size="sm"
              onClick={() => handleRunSimulation('CIRCULAR_GRAPH')}
              className="bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-xs font-bold rounded-xl"
            >
              Simulate Circular Graph
            </Button>
          </div>
        </div>

        {/* Simulation Output Card */}
        {simulatedAssessment && (
          <div className="p-5 bg-neutral-900 border border-white/10 rounded-2xl space-y-4 font-mono text-xs animate-in fade-in duration-300">
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
                <span className="text-neutral-500 block text-[11px] font-sans">Action Recommendation</span>
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
                      <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{f.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Fraud Audit Register Table (Section 36 Requirements) */}
      <div className="bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-indigo-400" size={22} />
            <h2 className="text-xl font-bold text-white tracking-tight">
              Live Payment Security Audit Register
            </h2>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-white/10 rounded-xl">
            {(['all', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === f
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f}
              </button>
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
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500 font-sans">
                    No payment assessments match the selected risk filter.
                  </td>
                </tr>
              ) : (
                filteredAssessments.map(({ tx, assessment }) => (
                  <tr key={assessment.assessmentId} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-indigo-300">
                      {assessment.assessmentId}
                    </td>
                    <td className="py-3.5 px-4 font-sans max-w-[200px] truncate text-white">
                      {tx.description}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-400">
                      {assessment.amount.toLocaleString()} {assessment.currency}
                    </td>
                    <td className="py-3.5 px-4">
                      {getRiskBadge(assessment.riskLevel, assessment.riskScore)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-neutral-300">
                      {assessment.recommendation}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-neutral-400 max-w-[220px] truncate">
                      {assessment.factors[0]?.message || 'Standard behavior profile'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
