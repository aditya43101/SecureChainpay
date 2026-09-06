'use client';

import React from 'react';
import { BookOpen, BarChart3, Target, ShieldAlert } from 'lucide-react';
import type { AIMode } from '@/stores/ai-store';

interface AIModeSelectorProps {
  activeMode: AIMode;
  onModeChange: (mode: AIMode) => void;
  compact?: boolean;
}

const MODES: { id: AIMode; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'learning', label: 'Learning', icon: <BookOpen size={16} />, description: 'Learn trading concepts' },
  { id: 'market-analysis', label: 'Analysis', icon: <BarChart3 size={16} />, description: 'Analyze markets' },
  { id: 'trade-setup', label: 'Trade Setup', icon: <Target size={16} />, description: 'Find setups' },
  { id: 'risk-analysis', label: 'Risk', icon: <ShieldAlert size={16} />, description: 'Assess risk' },
];

export function AIModeSelector({ activeMode, onModeChange, compact }: AIModeSelectorProps) {
  return (
    <div className={`flex gap-1.5 ${compact ? '' : 'p-1 bg-white/5 rounded-xl border border-white/5'}`}>
      {MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          title={mode.description}
          aria-label={`${mode.label} mode: ${mode.description}`}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            activeMode === mode.id
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5 border border-transparent'
          }`}
        >
          {mode.icon}
          {!compact && <span>{mode.label}</span>}
        </button>
      ))}
    </div>
  );
}
