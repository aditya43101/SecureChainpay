'use client';

import { create } from 'zustand';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type AIMode = 'learning' | 'market-analysis' | 'trade-setup' | 'risk-analysis';
export type CryptoAsset = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'ADA';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: AIMode;
  asset?: CryptoAsset;
  status?: 'sending' | 'sent' | 'error';
}

export interface TradingContext {
  asset: CryptoAsset;
  timeframe: string;
  currentPrice: number | null;
  indicators: Record<string, unknown>;
  chartContext: Record<string, unknown>;
  portfolioContext: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════
// SETTINGS PERSISTENCE HELPERS
// ═══════════════════════════════════════════════════════════

const AI_SETTINGS_KEY = 'securechainpay_ai_settings';

interface AISettings {
  isAssistantEnabled: boolean;
  isFloatingBallEnabled: boolean;
  isTradingPanelEnabled: boolean;
  aiNotificationsEnabled: boolean;
  activeMode: AIMode;
}

function loadSettings(): Partial<AISettings> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveSettings(settings: AISettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════════════

interface AIState {
  // Settings (persisted)
  isAssistantEnabled: boolean;
  isFloatingBallEnabled: boolean;
  isTradingPanelEnabled: boolean;
  aiNotificationsEnabled: boolean;

  // Runtime state
  isPanelOpen: boolean;
  activeAsset: CryptoAsset;
  activeMode: AIMode;
  messages: AIMessage[];
  isLoading: boolean;

  // Trading context (Phase 2 prep)
  tradingContext: TradingContext;
  conversationId: string | null;

  // Actions
  setAssistantEnabled: (enabled: boolean) => void;
  setFloatingBallEnabled: (enabled: boolean) => void;
  setTradingPanelEnabled: (enabled: boolean) => void;
  setAINotificationsEnabled: (enabled: boolean) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  setActiveAsset: (asset: CryptoAsset) => void;
  setActiveMode: (mode: AIMode) => void;
  addMessage: (message: AIMessage) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  updateTradingContext: (partial: Partial<TradingContext>) => void;
  setConversationId: (id: string | null) => void;
  hydrateSettings: () => void;
}

// ═══════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════

export const useAIStore = create<AIState>((set, get) => {
  const defaults: AISettings = {
    isAssistantEnabled: true,
    isFloatingBallEnabled: true,
    isTradingPanelEnabled: true,
    aiNotificationsEnabled: false,
    activeMode: 'learning',
  };

  return {
    // Settings
    isAssistantEnabled: defaults.isAssistantEnabled,
    isFloatingBallEnabled: defaults.isFloatingBallEnabled,
    isTradingPanelEnabled: defaults.isTradingPanelEnabled,
    aiNotificationsEnabled: defaults.aiNotificationsEnabled,

    // Runtime
    isPanelOpen: false,
    activeAsset: 'BTC',
    activeMode: defaults.activeMode,
    messages: [],
    isLoading: false,

    // Trading context
    tradingContext: {
      asset: 'BTC',
      timeframe: '1H',
      currentPrice: null,
      indicators: {},
      chartContext: {},
      portfolioContext: {},
    },
    conversationId: null,

    // Settings actions (with persistence)
    setAssistantEnabled: (enabled) => {
      set({ isAssistantEnabled: enabled });
      const s = get();
      saveSettings({ isAssistantEnabled: enabled, isFloatingBallEnabled: s.isFloatingBallEnabled, isTradingPanelEnabled: s.isTradingPanelEnabled, aiNotificationsEnabled: s.aiNotificationsEnabled, activeMode: s.activeMode });
    },
    setFloatingBallEnabled: (enabled) => {
      set({ isFloatingBallEnabled: enabled });
      const s = get();
      saveSettings({ isAssistantEnabled: s.isAssistantEnabled, isFloatingBallEnabled: enabled, isTradingPanelEnabled: s.isTradingPanelEnabled, aiNotificationsEnabled: s.aiNotificationsEnabled, activeMode: s.activeMode });
    },
    setTradingPanelEnabled: (enabled) => {
      set({ isTradingPanelEnabled: enabled });
      const s = get();
      saveSettings({ isAssistantEnabled: s.isAssistantEnabled, isFloatingBallEnabled: s.isFloatingBallEnabled, isTradingPanelEnabled: enabled, aiNotificationsEnabled: s.aiNotificationsEnabled, activeMode: s.activeMode });
    },
    setAINotificationsEnabled: (enabled) => {
      set({ aiNotificationsEnabled: enabled });
      const s = get();
      saveSettings({ isAssistantEnabled: s.isAssistantEnabled, isFloatingBallEnabled: s.isFloatingBallEnabled, isTradingPanelEnabled: s.isTradingPanelEnabled, aiNotificationsEnabled: enabled, activeMode: s.activeMode });
    },

    // Runtime actions
    setPanelOpen: (open) => set({ isPanelOpen: open }),
    togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
    setActiveAsset: (asset) => set({ activeAsset: asset, tradingContext: { ...get().tradingContext, asset } }),
    setActiveMode: (mode) => {
      set({ activeMode: mode });
      const s = get();
      saveSettings({ isAssistantEnabled: s.isAssistantEnabled, isFloatingBallEnabled: s.isFloatingBallEnabled, isTradingPanelEnabled: s.isTradingPanelEnabled, aiNotificationsEnabled: s.aiNotificationsEnabled, activeMode: mode });
    },
    addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
    setLoading: (loading) => set({ isLoading: loading }),
    clearMessages: () => set({ messages: [] }),
    updateTradingContext: (partial) => set((s) => ({ tradingContext: { ...s.tradingContext, ...partial } })),
    setConversationId: (id) => set({ conversationId: id }),

    // Hydrate from localStorage on mount
    hydrateSettings: () => {
      const saved = loadSettings();
      set({
        isAssistantEnabled: saved.isAssistantEnabled ?? defaults.isAssistantEnabled,
        isFloatingBallEnabled: saved.isFloatingBallEnabled ?? defaults.isFloatingBallEnabled,
        isTradingPanelEnabled: saved.isTradingPanelEnabled ?? defaults.isTradingPanelEnabled,
        aiNotificationsEnabled: saved.aiNotificationsEnabled ?? defaults.aiNotificationsEnabled,
        activeMode: saved.activeMode ?? defaults.activeMode,
      });
    },
  };
});
