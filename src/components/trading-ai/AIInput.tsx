'use client';

import React, { useState, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface AIInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function AIInput({ onSend, isLoading, disabled, placeholder }: AIInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Ask about BTC, ETH, trading strategies, risk, or market analysis...'}
          disabled={isLoading || disabled}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 pr-12 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40 disabled:opacity-50 transition-all"
          aria-label="AI assistant message input"
        />
      </div>
      <button
        type="submit"
        disabled={!canSend}
        className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white flex items-center justify-center transition-all active:scale-95 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(16,185,129,0.2)] disabled:shadow-none"
        aria-label="Send message"
      >
        {isLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Send size={16} />
        )}
      </button>
    </form>
  );
}

/**
 * Programmatically set the input value from outside (e.g. suggestion chips).
 * The component is controlled internally, so we expose a callback approach instead.
 */
export function useAIInputSend() {
  const sendRef = useRef<((msg: string) => void) | null>(null);
  return { sendRef };
}
