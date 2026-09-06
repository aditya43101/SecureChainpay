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
  default: ['Analyze this chart', 'Find setup', 'Explain trend', 'Check risk', 'BTC vs ETH'],
};

interface AIAssistantPanelProps {
  /** Inline mode: renders as side panel on trade page. Drawer mode: renders as overlay. */
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

  const handleSend = useCallback(async (text: string) => {
    // Add user message
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
  }, [activeMode, activeAsset, tradingContext, addMessage, setLoading]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setPanelOpen(false);
  }, [setPanelOpen]);

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
      {/* Backdrop for drawer mode */}
      {isDrawer && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setPanelOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`flex flex-col bg-neutral-950/95 backdrop-blur-2xl border-l border-white/5 ${
          isDrawer
            ? 'fixed inset-y-0 right-0 z-50 w-full sm:w-96 animate-in slide-in-from-right duration-300'
            : 'w-[340px] lg:w-[380px] flex-shrink-0 hidden md:flex'
        }`}
        role="complementary"
        aria-label="AI Trading Assistant Panel"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 space-y-2.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Bot size={14} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1">
                  Trading AI
                  <Sparkles size={12} className="text-emerald-400" />
                </h3>
              </div>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close AI panel"
            >
              {isDrawer ? <X size={18} /> : <Minimize2 size={16} />}
            </button>
          </div>

          <AIContextHeader asset={activeAsset} />
          <AIModeSelector activeMode={activeMode} onModeChange={setActiveMode} compact />
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-hidden flex flex-col px-3 py-2 min-h-0">
          <AIChat messages={messages} isLoading={isLoading} />
        </div>

        {/* Suggestions + Input */}
        <div className="px-3 py-3 border-t border-white/5 space-y-2.5 flex-shrink-0">
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
