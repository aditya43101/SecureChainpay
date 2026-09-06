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
    
    // 1. Get Authentication Token
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated.");
    }
    
    const idToken = await user.getIdToken();

    // 2. Prepare Payload
    const payload = {
      message,
      mode,
      context,
      asset,
      conversationId: conversationId || undefined
    };

    // 3. Send Request
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to communicate with Trading AI');
    }

    const data = await response.json();

    return {
      content: data.message,
      timestamp: new Date().toISOString(),
      conversationId: data.conversationId
    };
  },
};
