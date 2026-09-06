'use client';

import React, { useEffect } from 'react';
import { Bot } from 'lucide-react';
import { useAIStore } from '@/stores/ai-store';
import { AIAssistantPanel } from './AIAssistantPanel';

export function AIAssistiveBall() {
  const { isAssistantEnabled, isFloatingBallEnabled, isPanelOpen, togglePanel, hydrateSettings } = useAIStore();

  // Hydrate settings from localStorage on mount
  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  // Don't render if assistant or floating ball is disabled
  if (!isAssistantEnabled || !isFloatingBallEnabled) return null;

  return (
    <>
      {/* Floating Button */}
      {!isPanelOpen && (
        <button
          onClick={togglePanel}
          className="fixed bottom-24 md:bottom-8 right-6 z-30 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-[0_4px_30px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_40px_rgba(16,185,129,0.6)] hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
          title="Ask Trading AI"
          aria-label="Open Trading AI Assistant"
        >
          <Bot size={24} className="group-hover:rotate-12 transition-transform" />

          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-2xl bg-emerald-400/20 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
        </button>
      )}

      {/* Drawer panel — shown when floating ball triggers it */}
      <AIAssistantPanel variant="drawer" />
    </>
  );
}
