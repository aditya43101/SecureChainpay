'use client';

import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Lock, Cpu, BarChart2 } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (settings: {
    riskPerTrade: number;
    maxDailyLoss: number;
    maxPortfolioExposure: number;
    allowedAssets: string[];
    allTimeMode: boolean;
  }) => void;
}

export function AutoTradingConfirmationModal({ isOpen, onClose, onConfirm }: ModalProps) {
  const [riskPerTrade, setRiskPerTrade] = useState(1.0);
  const [maxDailyLoss, setMaxDailyLoss] = useState(3.0);
  const [maxPortfolioExposure, setMaxPortfolioExposure] = useState(20.0);
  const [btcEnabled, setBtcEnabled] = useState(true);
  const [ethEnabled, setEthEnabled] = useState(true);
  const [allTimeMode, setAllTimeMode] = useState(true);

  const [confirmRisk, setConfirmRisk] = useState(false);
  const [confirmSafety, setConfirmSafety] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!confirmRisk || !confirmSafety) return;
    setIsSubmitting(true);

    const allowedAssets: string[] = [];
    if (btcEnabled) allowedAssets.push('BTCUSDT');
    if (ethEnabled) allowedAssets.push('ETHUSDT');

    await onConfirm({
      riskPerTrade: riskPerTrade / 100,
      maxDailyLoss: maxDailyLoss / 100,
      maxPortfolioExposure: maxPortfolioExposure / 100,
      allowedAssets,
      allTimeMode
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#121212] px-6 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Enable Auto-Trading & All-Time Mode
              <span className="px-2 py-0.5 text-xs font-semibold bg-brand-primary/20 text-brand-primary border border-brand-primary/40 rounded-md">
                REAL EXECUTION GATE
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Confirm risk parameters and safety policy before activating automated execution.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Strategy & Model info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#121212] border border-white/10 rounded-xl p-3.5 flex items-start gap-3">
              <Cpu className="w-5 h-5 text-brand-primary mt-0.5" />
              <div>
                <div className="text-xs font-medium text-neutral-400">Active Champion Model</div>
                <div className="text-sm font-semibold text-white">LOG_v1 (Scikit-Learn ML)</div>
                <div className="text-[11px] text-neutral-400">Directional Probability Engine</div>
              </div>
            </div>
            <div className="bg-[#121212] border border-white/10 rounded-xl p-3.5 flex items-start gap-3">
              <BarChart2 className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <div className="text-xs font-medium text-neutral-400">Validated Strategy</div>
                <div className="text-sm font-semibold text-white">HYBRID_v1 (Active Champion)</div>
                <div className="text-[11px] text-neutral-400">EMA Trend + RSI + MACD + ATR SL/TP</div>
              </div>
            </div>
          </div>

          {/* Risk Settings Form */}
          <div className="bg-black border border-white/10 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand-primary" />
              Execution Risk Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Risk Per Trade (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  value={riskPerTrade}
                  onChange={e => setRiskPerTrade(parseFloat(e.target.value))}
                  className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Max Daily Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1.0"
                  max="10.0"
                  value={maxDailyLoss}
                  onChange={e => setMaxDailyLoss(parseFloat(e.target.value))}
                  className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Max Exposure (%)</label>
                <input
                  type="number"
                  step="1.0"
                  min="5.0"
                  max="50.0"
                  value={maxPortfolioExposure}
                  onChange={e => setMaxPortfolioExposure(parseFloat(e.target.value))}
                  className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            {/* Allowed Assets */}
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">Approved Trading Assets</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-white">
                  <input
                    type="checkbox"
                    checked={btcEnabled}
                    onChange={e => setBtcEnabled(e.target.checked)}
                    className="rounded border-white/20 text-brand-primary focus:ring-0"
                  />
                  BTC / HSCT
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-white">
                  <input
                    type="checkbox"
                    checked={ethEnabled}
                    onChange={e => setEthEnabled(e.target.checked)}
                    className="rounded border-white/20 text-brand-primary focus:ring-0"
                  />
                  ETH / HSCT
                </label>
              </div>
            </div>

            {/* All-Time Mode Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <div className="text-sm font-semibold text-white">All-Time Mode</div>
                <div className="text-xs text-neutral-400">
                  Continuously monitor markets & trade only when valid setups pass all safety gates.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAllTimeMode(!allTimeMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  allTimeMode
                    ? 'bg-brand-primary text-black font-extrabold shadow-sm'
                    : 'bg-[#1a1a1a] text-neutral-400 border border-white/10'
                }`}
              >
                {allTimeMode ? 'ALL-TIME ON' : 'ALL-TIME OFF'}
              </button>
            </div>
          </div>

          {/* Explicit Consent Checkboxes */}
          <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/90 leading-relaxed">
                <strong>Execution Safety Notice:</strong> The LLM does NOT execute trades directly. Trades execute only through the 8-gate Execution Safety Engine when quantitative indicators, ML probabilities, and risk metrics pass.
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-amber-500/10">
              <input
                type="checkbox"
                checked={confirmRisk}
                onChange={e => setConfirmRisk(e.target.checked)}
                className="mt-0.5 rounded border-amber-500/40 text-amber-500 focus:ring-0"
              />
              <span className="text-xs text-neutral-300">
                I confirm the risk parameters ({riskPerTrade}% per trade, {maxDailyLoss}% max daily loss, {maxPortfolioExposure}% max portfolio exposure).
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmSafety}
                onChange={e => setConfirmSafety(e.target.checked)}
                className="mt-0.5 rounded border-amber-500/40 text-amber-500 focus:ring-0"
              />
              <span className="text-xs text-neutral-300">
                I understand that Auto-Trading can be paused at any time via Circuit Breaker or Emergency Stop.
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-black px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!confirmRisk || !confirmSafety || isSubmitting || (!btcEnabled && !ethEnabled)}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-brand-primary hover:bg-brand-pale text-black shadow-lg shadow-brand-primary/20 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? 'ENABLING...' : 'CONFIRM & ENABLE AUTO-TRADING'}
          </button>
        </div>
      </div>
    </div>
  );
}
