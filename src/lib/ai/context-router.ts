/**
 * SecureChain Pay — AI Context Router
 * Combines query intent, static project knowledge, and domain-specific live context into a clean targeted prompt.
 */

import { classifyUserQuery, ClassificationResult } from './intent-classifier';
import { getModuleKnowledgeSummary, SECURECHAIN_PAY_KNOWLEDGE } from './project-knowledge';
import { fetchLiveContextForDomains, LiveContextPayload } from './live-context-service';

export interface ContextRouterResult {
  classification: ClassificationResult;
  systemDirective: string;
  contextPromptString: string;
}

export async function routeAndBuildAIContext(params: {
  userId: string;
  message: string;
  asset?: string;
  mode?: string;
}): Promise<ContextRouterResult> {
  const { userId, message, asset } = params;

  // 1. Classify Intent & Scope
  const classification = classifyUserQuery(message);

  // 2. Fetch Domain-Specific Live Context Only
  const liveContext = await fetchLiveContextForDomains(userId, classification.domains, asset);

  // 3. Build System Directives
  let systemDirective = `You are the Project-Aware AI Assistant & Copilot for SecureChain Pay (v1.0).
Your primary identity: PROJECT-AWARE FINANCIAL PLATFORM COPILOT.
You understand the complete implemented SecureChain Pay platform architecture.

MANDATORY RESPONSE GUIDELINES:
1. CANONICAL CURRENCY & TIMEZONE: SecureChain Pay natively uses HSCT (High-Security Chain Token, 1 HSCT = ₹1 INR, 1 USD = 83.50 HSCT) and displays timestamps in user's local timezone (Asia/Kolkata). When asked about trade timestamps, signals, or last updates, present timestamps in Asia/Kolkata timezone.
2. RESPONSE SCOPE CONTROL: 
   - Current requested scope mode: ${classification.scope}.
   ${classification.scope === 'SHORT' ? '- Keep answer concise and direct (1 to 3 sentences max).' : classification.scope === 'NORMAL' ? '- Provide a clear explanation (3 to 7 sentences).' : '- Provide a detailed, structured markdown explanation.'}
3. LANGUAGE MATCHING: Respond naturally in the user's primary language (${classification.language.toUpperCase()}). If Hinglish, respond in clean, natural Hinglish.
4. HALLUCINATION & SAFETY: Never fabricate balances, transactions, or feature availability. If requested data is missing, state it clearly. Never output private keys, secrets, or attempt unauthorized trade executions.
5. NO_TRADE & QUANTITATIVE SUPREMACY: Respect quantitative engine outputs (BUY, SELL, HOLD, NO_TRADE). Explain WHY NO_TRADE was issued if asked.`;

  // 4. Build Context String
  const parts: string[] = [];

  // Add Static Knowledge
  parts.push(getModuleKnowledgeSummary());

  // If user asks how to do an action, attach UI navigation instructions
  if (classification.isActionInstructionRequest || classification.domains.includes('PROJECT_KNOWLEDGE')) {
    parts.push(`[UI NAVIGATION GUIDE]
- Wallet & Balance: ${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.wallet.path} (${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.wallet.description})
- Dashboard Overview: ${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.dashboard.path} (${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.dashboard.description})
- Trade Desk: ${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.trade.path} (${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.trade.description})
- Auto-Trading & Risk Settings: ${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.settings.path} (${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.settings.description})
- Explorer & Blockchain proof: ${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.explorer.path} (${SECURECHAIN_PAY_KNOWLEDGE.uiNavigation.explorer.description})`);
  }

  // Add Domain Live Contexts
  if (liveContext.walletContext) {
    parts.push(`[LIVE WALLET CONTEXT (${liveContext.contextGeneratedAt})]
Balances: ${JSON.stringify(liveContext.walletContext.balances)}
Verified Address: ${liveContext.walletContext.address || 'Not initialized'}
Last Block: ${liveContext.walletContext.lastBlockNumber}`);
  }

  if (liveContext.transactionContext) {
    parts.push(`[LIVE RECENT TRANSACTIONS (${liveContext.contextGeneratedAt})]
Recent Log: ${JSON.stringify(liveContext.transactionContext.recentTransactions, null, 2)}`);
  }

  if (liveContext.tradingContext) {
    parts.push(`[LIVE TRADING & RISK STATE (${liveContext.contextGeneratedAt})]
Status: ${liveContext.tradingContext.status} (Enabled: ${liveContext.tradingContext.autoTradingEnabled}, All-Time Mode: ${liveContext.tradingContext.allTimeMode})
Strategy: ${liveContext.tradingContext.strategyVersion} | Risk Cap: ${liveContext.tradingContext.riskPerTradePct}% per trade | Max Daily Loss: ${liveContext.tradingContext.maxDailyLossPct}%
Today Realized PnL: ${liveContext.tradingContext.todayRealizedPnL} HSCT (${liveContext.tradingContext.todayTradesCount} trades)
Open Paper Positions: ${liveContext.tradingContext.openPositionsCount}`);
  }

  if (liveContext.blockchainContext) {
    parts.push(`[LIVE GLOBAL BLOCKCHAIN CONTEXT (${liveContext.contextGeneratedAt})]
Chain Height: Block #${liveContext.blockchainContext.lastBlockNumber} | Total Blocks: ${liveContext.blockchainContext.totalBlocks}`);
  }

  const contextPromptString = `\n\n=== PROJECT KNOWLEDGE & ROUTED CONTEXT ===\n${parts.join('\n\n')}`;

  return {
    classification,
    systemDirective,
    contextPromptString
  };
}
