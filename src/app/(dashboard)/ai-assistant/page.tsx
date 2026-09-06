'use client';

import React, { useCallback, useEffect } from 'react';
import { Bot, Sparkles, Trash2 } from 'lucide-react';
import { useAIStore } from '@/stores/ai-store';
import { aiService } from '@/lib/ai/ai-service';
import { AIChat } from '@/components/trading-ai/AIChat';
import { AIInput } from '@/components/trading-ai/AIInput';
import { AISuggestionChips } from '@/components/trading-ai/AISuggestionChips';
import { AIModeSelector } from '@/components/trading-ai/AIModeSelector';
import { AIContextHeader } from '@/components/trading-ai/AIContextHeader';

const FULL_PAGE_SUGGESTIONS = [
  'Analyze BTC',
  'Analyze ETH',
  'Find a trade setup',
  'Explain RSI',
  'Explain my risk',
  'Compare BTC vs ETH',
];

export default function AIAssistantPage() {
  const {
    activeAsset,
    activeMode,
    setActiveMode,
    messages,
    isLoading,
    addMessage,
    setLoading,
    clearMessages,
    tradingContext,
    hydrateSettings,
  } = useAIStore();

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  const handleSend = useCallback(async (text: string) => {
    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user' as const,
      content: text,
      timestamp: new Date().toISOString(),
      mode: activeMode,
      asset: activeAsset,
      status: 'sent' as const,
    };
    addMessage(userMsg);
    setLoading(true);

    try {
      const response = await aiService.sendMessage(text, activeMode, tradingContext, activeAsset);
      const aiMsg = {
        id: `ai_${Date.now()}`,
        role: 'assistant' as const,
        content: response.content,
        timestamp: response.timestamp,
        mode: activeMode,
        asset: activeAsset,
        status: 'sent' as const,
      };
      addMessage(aiMsg);
    } catch {
      const errorMsg = {
        id: `err_${Date.now()}`,
        role: 'assistant' as const,
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString(),
        status: 'error' as const,
      };
      addMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [activeMode, activeAsset, tradingContext, addMessage, setLoading]);

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-180px)] flex flex-col animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <Bot size={24} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              Trading AI Assistant
              <Sparkles size={20} className="text-emerald-400" />
            </h1>
            <p className="text-sm text-neutral-400 mt-0.5">
              Analyze markets, understand trading setups, and learn with your AI trading assistant.
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
        <AIModeSelector activeMode={activeMode} onModeChange={setActiveMode} />
        <div className="ml-auto">
          <AIContextHeader asset={activeAsset} />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 bg-neutral-950/50 border border-white/5 rounded-2xl p-4 flex flex-col overflow-hidden">
        <AIChat messages={messages} isLoading={isLoading} />
      </div>

      {/* Suggestions + Input */}
      <div className="mt-4 space-y-3 flex-shrink-0">
        {messages.length === 0 && (
          <AISuggestionChips
            suggestions={FULL_PAGE_SUGGESTIONS}
            onSelect={handleSend}
            disabled={isLoading}
          />
        )}
        <AIInput
          onSend={handleSend}
          isLoading={isLoading}
        />
        <p className="text-[11px] text-neutral-600 text-center">
          AI-powered analysis for educational purposes only. Not financial advice. Always do your own research.
        </p>
      </div>
    </div>
  );
}
