'use client';

import React, { useCallback } from 'react';
import { X, Minimize2, Bot, Sparkles } from 'lucide-react';
import { useAIStore } from '@/stores/ai-store';
import { aiService } from '@/lib/ai/ai-service';
import { AIChat } from './AIChat';
import { AIInput } from './AIInput';
import { AISuggestionChips } from './AISuggestionChips';
import { AIModeSelector } from './AIModeSelector';
import { AIContextHeader } from './AIContextHeader';

const PANEL_SUGGESTIONS: Record<string, string[]> = {
  default: [
    'Explain RSI',
    'Analyze BTC',
    'Explain MACD',
    'Analyze my portfolio',
    'Teach me risk management',
  ],
};

interface AIAssistantPanelProps {
  variant?: 'inline' | 'drawer';
}

export function AIAssistantPanel({ variant = 'inline' }: AIAssistantPanelProps) {
  const {
    isPanelOpen,
    setPanelOpen,
    activeAsset,
    activeMode,
    setActiveMode,
    messages,
    isLoading,
    addMessage,
    setLoading,
    tradingContext,
  } = useAIStore();

  const handleSend = useCallback(
    async (text: string) => {
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
        const response = await aiService.sendMessage(
          text,
          activeMode,
          tradingContext,
          activeAsset,
          useAIStore.getState().conversationId
        );

        if (response.conversationId) {
          useAIStore.getState().setConversationId(response.conversationId);
        }

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
    },
    [activeMode, activeAsset, tradingContext, addMessage, setLoading]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false);
    },
    [setPanelOpen]
  );

  React.useEffect(() => {
    if (isPanelOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isPanelOpen, handleKeyDown]);

  if (!isPanelOpen) return null;

  const isDrawer = variant === 'drawer';

  return (
    <>
      {isDrawer && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setPanelOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`flex flex-col bg-[#0a0a0a] border-l border-white/10 shadow-2xl ${
          isDrawer
            ? 'fixed inset-y-0 right-0 z-50 w-full sm:w-96 animate-in slide-in-from-right duration-300'
            : 'w-[340px] lg:w-[380px] flex-shrink-0 hidden md:flex'
        }`}
        role="complementary"
        aria-label="Trading AI Panel"
      >
        {/* Header per Prompt Section 22 */}
        <div className="px-4 py-3.5 border-b border-white/10 space-y-2.5 flex-shrink-0 bg-[#121212]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
                <Bot size={16} className="text-brand-primary" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  Trading AI
                  <Sparkles size={12} className="text-brand-primary" />
                </h3>
                <p className="text-[11px] text-neutral-400 font-medium">
                  Your intelligent trading companion
                </p>
              </div>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Close AI panel"
            >
              {isDrawer ? <X size={18} /> : <Minimize2 size={16} />}
            </button>
          </div>

          <AIContextHeader asset={activeAsset} />
          <AIModeSelector activeMode={activeMode} onModeChange={setActiveMode} compact />
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-hidden flex flex-col px-3 py-2 min-h-0">
          <AIChat messages={messages} isLoading={isLoading} />
        </div>

        {/* Suggestion Chips & Input */}
        <div className="px-3 py-3 border-t border-white/10 space-y-2.5 flex-shrink-0 bg-[#121212]/50">
          {messages.length === 0 && (
            <AISuggestionChips
              suggestions={PANEL_SUGGESTIONS.default}
              onSelect={handleSend}
              disabled={isLoading}
            />
          )}
          <AIInput
            onSend={handleSend}
            isLoading={isLoading}
            placeholder="Ask about this market..."
          />
        </div>
      </div>
    </>
  );
}
