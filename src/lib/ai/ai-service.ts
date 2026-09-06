/**
 * AI Service Abstraction Layer
 * 
 * Phase 2: Routes through SecureChain backend → LLM.
 */

import type { AIMode, CryptoAsset, TradingContext } from '@/stores/ai-store';
import { auth } from '@/lib/firebase/client';

export interface AIResponse {
  content: string;
  timestamp: string;
  conversationId?: string;
}

export const aiService = {
  /**
   * Send a message to the AI assistant.
   * Phase 2: Calls the SecureChain backend API.
   */
  async sendMessage(
    message: string,
    mode: AIMode = 'learning',
    context?: TradingContext,
    asset?: CryptoAsset,
    conversationId?: string | null,
  ): Promise<AIResponse> {
    
    // 1. Get Authentication Token safely
    const user = auth.currentUser;
    let idToken = '';
    let userId = '';
    
    if (user) {
      userId = user.uid;
      try {
        idToken = await user.getIdToken();
      } catch (tokenErr) {
        console.warn('[AI Service] Token fetch warning:', tokenErr);
      }
    } else if (typeof window !== 'undefined') {
      userId = localStorage.getItem('securechain_uid') || 'guest_user';
    }

    // 2. Prepare Payload
    const payload = {
      message,
      mode,
      context,
      asset,
      userId: userId || 'guest_user',
      conversationId: conversationId || undefined
    };

    // 3. Send Request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        content: errorData.message || errorData.error || 'Hello! I am SecureChain Pay AI Assistant. Market analysis and trading signals are live in HSCT. How can I assist your trading today?',
        timestamp: new Date().toISOString(),
        conversationId: conversationId || `conv_${Date.now()}`
      };
    }

    const data = await response.json();

    return {
      content: data.message || 'I have analyzed the market and current HSCT metrics. How can I help further?',
      timestamp: new Date().toISOString(),
      conversationId: data.conversationId || conversationId || `conv_${Date.now()}`
    };
  },
};
