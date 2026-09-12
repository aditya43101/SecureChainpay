'use client';

import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Zap } from 'lucide-react';
import type { CryptoAsset } from '@/stores/ai-store';

interface AIContextHeaderProps {
  asset: CryptoAsset;
}

export function AIContextHeader({ asset }: AIContextHeaderProps) {
  const [autoStatus, setAutoStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auto-trading/status')
      .then(res => res.json())
      .then(data => {
        if (data.success) setAutoStatus(data.settings);
      })
      .catch(() => {});
  }, []);

  const isEnabled = autoStatus?.status === 'ENABLED';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">
            Analyzing: <span className="font-bold">{asset}</span>
          </span>
        </div>
        <span className="text-[10px] text-emerald-400/80 font-mono">LIVE DATA</span>
      </div>

      <div className="flex items-center justify-between px-3 py-1 bg-black border border-white/10 rounded-lg text-[11px]">
        <div className="flex items-center gap-1.5 text-neutral-300 font-medium">
          <ShieldCheck size={13} className={isEnabled ? 'text-brand-primary' : 'text-neutral-500'} />
          <span>Auto Trading: <strong className={isEnabled ? 'text-brand-primary font-bold' : 'text-neutral-400'}>{isEnabled ? 'ON' : 'OFF'}</strong></span>
        </div>
        <div className="flex items-center gap-1 text-neutral-400">
          <Zap size={11} className={autoStatus?.allTimeMode ? 'text-brand-gold' : 'text-neutral-600'} />
          <span>All-Time: <strong>{autoStatus?.allTimeMode ? 'ON' : 'OFF'}</strong></span>
        </div>
      </div>
    </div>
  );
}
