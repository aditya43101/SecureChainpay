/**
 * SecureChain Pay — Intent Classifier & Response Scope Controller
 * Classifies user message intent into target domain contexts and determines response length scope.
 */

export type ContextDomain =
  | 'AUTH_CONTEXT'
  | 'WALLET_CONTEXT'
  | 'PAYMENT_CONTEXT'
  | 'TRANSACTION_CONTEXT'
  | 'BLOCKCHAIN_CONTEXT'
  | 'TRADING_CONTEXT'
  | 'RISK_CONTEXT'
  | 'SAFETY_CONTEXT'
  | 'PORTFOLIO_CONTEXT'
  | 'AI_CONTEXT'
  | 'USER_SETTINGS_CONTEXT'
  | 'NOTIFICATION_CONTEXT'
  | 'PROJECT_KNOWLEDGE';

export type ResponseScope = 'SHORT' | 'NORMAL' | 'DETAILED';

export interface ClassificationResult {
  domains: ContextDomain[];
  scope: ResponseScope;
  language: 'en' | 'hinglish' | 'hi';
  isConceptual: boolean;
  isActionInstructionRequest: boolean;
}

export function classifyUserQuery(message: string): ClassificationResult {
  const cleanMsg = message.toLowerCase().trim();
  const domains = new Set<ContextDomain>();

  // 1. Language Detection
  let language: 'en' | 'hinglish' | 'hi' = 'en';
  const hinglishKeywords = ['kya', 'kaise', 'karo', 'batao', 'hai', 'nhi', 'hoon', 'kar', 'dikha', 'sahi', 'paisa', 'karte', 'rupee', 'samjhao'];
  if (hinglishKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(cleanMsg))) {
    language = 'hinglish';
  }

  // 2. Scope Determination
  let scope: ResponseScope = 'SHORT'; // Default is SHORT (1-3 sentences)
  if (cleanMsg.includes('detail') || cleanMsg.includes('explain step') || cleanMsg.includes('full report') || cleanMsg.includes('comprehensive') || cleanMsg.includes('sab batao')) {
    scope = 'DETAILED';
  } else if (cleanMsg.length > 80 || cleanMsg.includes('why') || cleanMsg.includes('kyu') || cleanMsg.includes('how does') || cleanMsg.includes('kaise kaam')) {
    scope = 'NORMAL';
  }

  // 3. Action / How-To Detection
  const isActionInstructionRequest = cleanMsg.includes('how to') || cleanMsg.includes('how do i') || cleanMsg.includes('kaise kare') || cleanMsg.includes('kahan se') || cleanMsg.includes('where can i');
  const isConceptual = cleanMsg.startsWith('what is') || cleanMsg.startsWith('kya hai') || cleanMsg.includes('explain') || cleanMsg.includes('meaning of');

  // 4. Domain Mapping
  // Wallet Domain
  if (cleanMsg.includes('balance') || cleanMsg.includes('wallet') || cleanMsg.includes('paisa') || cleanMsg.includes('hsct') || cleanMsg.includes('money') || cleanMsg.includes('fund')) {
    domains.add('WALLET_CONTEXT');
    domains.add('PORTFOLIO_CONTEXT');
  }

  // Payment / Transfer Domain
  if (cleanMsg.includes('send') || cleanMsg.includes('pay') || cleanMsg.includes('transfer') || cleanMsg.includes('deposit') || cleanMsg.includes('bhejna') || cleanMsg.includes('receive') || cleanMsg.includes('withdraw')) {
    domains.add('PAYMENT_CONTEXT');
    domains.add('WALLET_CONTEXT');
  }

  // Transaction Domain
  if (cleanMsg.includes('transaction') || cleanMsg.includes('history') || cleanMsg.includes('transfer status') || cleanMsg.includes('tx')) {
    domains.add('TRANSACTION_CONTEXT');
  }

  // Blockchain & Explorer Domain
  if (cleanMsg.includes('blockchain') || cleanMsg.includes('genesis') || cleanMsg.includes('block') || cleanMsg.includes('explorer') || cleanMsg.includes('merkle') || cleanMsg.includes('hash') || cleanMsg.includes('on-chain') || cleanMsg.includes('onchain')) {
    domains.add('BLOCKCHAIN_CONTEXT');
  }

  // Trading & Market Domain
  if (cleanMsg.includes('trade') || cleanMsg.includes('trading') || cleanMsg.includes('btc') || cleanMsg.includes('eth') || cleanMsg.includes('market') || cleanMsg.includes('price') || cleanMsg.includes('buy') || cleanMsg.includes('sell') || cleanMsg.includes('no_trade') || cleanMsg.includes('signal') || cleanMsg.includes('indicator') || cleanMsg.includes('rsi') || cleanMsg.includes('macd')) {
    domains.add('TRADING_CONTEXT');
  }

  // Risk & Safety Domain
  if (cleanMsg.includes('risk') || cleanMsg.includes('stop loss') || cleanMsg.includes('circuit breaker') || cleanMsg.includes('drawdown') || cleanMsg.includes('safety') || cleanMsg.includes('limit') || cleanMsg.includes('paused')) {
    domains.add('RISK_CONTEXT');
    domains.add('SAFETY_CONTEXT');
  }

  // Auto-Trading & All-Time Mode Domain
  if (cleanMsg.includes('auto') || cleanMsg.includes('automated') || cleanMsg.includes('bot') || cleanMsg.includes('all-time') || cleanMsg.includes('alltime') || cleanMsg.includes('24/7') || cleanMsg.includes('paper')) {
    domains.add('TRADING_CONTEXT');
    domains.add('SAFETY_CONTEXT');
    domains.add('USER_SETTINGS_CONTEXT');
  }

  // Project Knowledge Domain
  if (domains.size === 0 || isConceptual || isActionInstructionRequest || cleanMsg.includes('securechain') || cleanMsg.includes('app') || cleanMsg.includes('platform') || cleanMsg.includes('help') || cleanMsg.includes('feature')) {
    domains.add('PROJECT_KNOWLEDGE');
  }

  return {
    domains: Array.from(domains),
    scope,
    language,
    isConceptual,
    isActionInstructionRequest
  };
}
