'use client';

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

export function AIEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.1)]">
        <Bot size={28} className="text-emerald-400" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 justify-center">
          <Sparkles size={16} className="text-emerald-400" />
          Trading AI Assistant
        </h3>
        <p className="text-sm text-neutral-400 max-w-xs leading-relaxed">
          Ask about BTC, ETH, trading strategies, risk management, or market analysis. I&apos;m here to help you learn and analyze.
        </p>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-neutral-600 pt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
        AI-powered analysis • Not financial advice
      </div>
    </div>
  );
}
