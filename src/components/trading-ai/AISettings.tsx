'use client';

import React from 'react';
import { Bot, ToggleLeft, ToggleRight, Lock, Sparkles } from 'lucide-react';
import { useAIStore, type AIMode } from '@/stores/ai-store';

function Toggle({ enabled, onChange, label, description }: { enabled: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className="flex-shrink-0"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
      >
        {enabled ? (
          <ToggleRight size={32} className="text-emerald-400" />
        ) : (
          <ToggleLeft size={32} className="text-neutral-600" />
        )}
      </button>
    </div>
  );
}

const MODE_OPTIONS: { id: AIMode; label: string; description: string }[] = [
  { id: 'learning', label: 'Learning Mode', description: 'Explains concepts and educates about trading' },
  { id: 'market-analysis', label: 'Analysis Mode', description: 'Provides market analysis and insights' },
  { id: 'trade-setup', label: 'Recommendation Mode', description: 'Suggests potential trade setups' },
  { id: 'risk-analysis', label: 'Risk Analysis', description: 'Evaluates risk and position sizing' },
];

export function AISettings() {
  const {
    isAssistantEnabled,
    isFloatingBallEnabled,
    isTradingPanelEnabled,
    aiNotificationsEnabled,
    activeMode,
    setAssistantEnabled,
    setFloatingBallEnabled,
    setTradingPanelEnabled,
    setAINotificationsEnabled,
    setActiveMode,
  } = useAIStore();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
          <Bot size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Trading AI Settings</h2>
          <p className="text-sm text-neutral-400">Configure your AI trading assistant preferences</p>
        </div>
      </div>

      {/* Toggles */}
      <div className="bg-white/5 rounded-xl border border-white/5 p-5 divide-y divide-white/5">
        <Toggle
          enabled={isAssistantEnabled}
          onChange={setAssistantEnabled}
          label="Trading AI Assistant"
          description="Enable or disable the AI trading assistant globally"
        />
        <Toggle
          enabled={isFloatingBallEnabled}
          onChange={setFloatingBallEnabled}
          label="Floating AI Ball"
          description="Show the floating AI button on pages"
        />
        <Toggle
          enabled={isTradingPanelEnabled}
          onChange={setTradingPanelEnabled}
          label="Trading Screen AI Panel"
          description="Show the AI side panel on the trading screen"
        />
        <Toggle
          enabled={aiNotificationsEnabled}
          onChange={setAINotificationsEnabled}
          label="AI Notifications"
          description="Receive AI-generated market alerts and insights"
        />
      </div>

      {/* Trading Mode */}
      <div className="bg-white/5 rounded-xl border border-white/5 p-5 space-y-3">
        <h3 className="text-sm font-bold text-neutral-300 uppercase tracking-wider">Trading Mode</h3>
        <div className="space-y-2">
          {MODE_OPTIONS.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left ${
                activeMode === mode.id
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border border-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div>
                <p className="text-sm font-medium">{mode.label}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{mode.description}</p>
              </div>
              {activeMode === mode.id && (
                <Sparkles size={16} className="text-emerald-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Auto Trading — Live Control Panel */}
      <AutoTradingControlCard />
    </div>
  );
}

function AutoTradingControlCard() {
  const [statusData, setStatusData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/auto-trading/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setStatusData(json.settings);
        }
      }
    } catch (err) {
      console.warn('[AISettings] Auto-Trading status fetch warning:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggleEnable = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const isCurrentlyEnabled = statusData?.status === 'ENABLED';
      const endpoint = isCurrentlyEnabled ? '/api/auto-trading/disable' : '/api/auto-trading/enable';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCurrentlyEnabled ? {} : { mode: statusData?.mode || 'PAPER', allTimeMode: statusData?.allTimeMode ?? true }),
      });
      
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchStatus();
      } else {
        setErrorMsg(json.error || json.reasons?.join(', ') || 'Failed to update Auto-Trading state.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isEnabled = statusData?.status === 'ENABLED';
  const isPaused = statusData?.status === 'PAUSED';
  const isEmergencyStop = statusData?.status === 'EMERGENCY_STOP';

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
            isEnabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-neutral-800 text-neutral-400 border-white/10'
          }`}>
            <Bot size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">Auto-Trading & Strategy Engine</p>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                isEnabled 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : isPaused
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : isEmergencyStop
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-neutral-800 text-neutral-400 border-white/10'
              }`}>
                {loading ? 'SYNCING...' : (statusData?.status || 'DISABLED')}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">Automated signal execution with Risk & Safety Engine rules</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleEnable}
            disabled={loading || actionLoading}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border ${
              isEnabled
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
            } disabled:opacity-50`}
          >
            {actionLoading ? 'PROCESSING...' : (isEnabled ? 'DISABLE AUTO-TRADING' : 'ENABLE AUTO-TRADING')}
          </button>
          
          <a
            href="/auto-trading"
            className="px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            Manage Control Desk →
          </a>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Auto-Trading Configuration Details */}
      {statusData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5 font-mono text-xs">
          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-neutral-500 block text-[10px] uppercase">Execution Mode</span>
            <span className="text-emerald-400 font-bold">{statusData.mode || 'PAPER'} TRADING</span>
          </div>
          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-neutral-500 block text-[10px] uppercase">Risk Per Trade</span>
            <span className="text-white font-bold">{statusData.riskPerTradePercent ?? 1}%</span>
          </div>
          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-neutral-500 block text-[10px] uppercase">Daily Loss Limit</span>
            <span className="text-white font-bold">{statusData.maxDailyLossPercent ?? 3}%</span>
          </div>
          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-neutral-500 block text-[10px] uppercase">All-Time Mode</span>
            <span className="text-cyan-400 font-bold">{statusData.allTimeMode ? 'ACTIVE' : 'OFF'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
