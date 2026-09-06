'use client';

import React, { useRef, useEffect } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { AIMessage } from './AIMessage';
import { AIEmptyState } from './AIEmptyState';
import type { AIMessage as AIMessageType } from '@/stores/ai-store';

interface AIChatProps {
  messages: AIMessageType[];
  isLoading: boolean;
}

export function AIChat({ messages, isLoading }: AIChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return <AIEmptyState />;
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 px-1 py-2 custom-scrollbar">
      {messages.map((msg) => (
        <AIMessage key={msg.id} message={msg} />
      ))}

      {/* Thinking indicator */}
      {isLoading && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-emerald-400" />
          </div>
          <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl rounded-tl-md">
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              <span>Analyzing...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
