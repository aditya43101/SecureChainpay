'use client';

import React from 'react';
import { Bot, User } from 'lucide-react';
import type { AIMessage as AIMessageType } from '@/stores/ai-store';

interface AIMessageProps {
  message: AIMessageType;
}

export function AIMessage({ message }: AIMessageProps) {
  const isAI = message.role === 'assistant';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${
        isAI
          ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30'
          : 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
      }`}>
        {isAI
          ? <Bot size={16} className="text-emerald-400" />
          : <User size={16} className="text-indigo-400" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] space-y-1 ${isAI ? '' : 'items-end'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isAI
            ? 'bg-white/5 border border-white/10 text-neutral-200 rounded-tl-md'
            : 'bg-indigo-600/20 border border-indigo-500/20 text-white rounded-tr-md'
        }`}>
          {/* Render markdown-like bold */}
          {message.content.split('\n').map((line, i) => {
            const formatted = line
              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
              .replace(/##\s*(.*)/g, '<h3 class="text-lg font-bold text-white mt-2 mb-1">$1</h3>');
            return <span key={i} dangerouslySetInnerHTML={{ __html: formatted + (i < message.content.split('\n').length - 1 ? '<br/>' : '') }} />;
          })}
        </div>
        <div className={`flex items-center gap-1.5 px-1 ${isAI ? '' : 'justify-end'}`}>
          <span className="text-[11px] text-neutral-600">{time}</span>
          {message.status === 'error' && (
            <span className="text-[11px] text-red-400">Failed to send</span>
          )}
        </div>
      </div>
    </div>
  );
}
