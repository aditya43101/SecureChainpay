/**
 * SecureChain Pay — Static Project Knowledge (v1.0)
 * Source of truth for complete application architecture, modules, features, navigation, and terminology.
 */

export const PROJECT_KNOWLEDGE_VERSION = 'v1.0';

export interface ModuleKnowledge {
  name: string;
  description: string;
  keyConcepts: string[];
  navigationPath?: string;
  userActions?: string[];
}

export const SECURECHAIN_PAY_KNOWLEDGE = {
  project: {
    name: 'SecureChain Pay',
    tagline: 'Enterprise Blockchain Payments & AI-Assisted Quantitative Trading Platform',
    version: '1.0.0',
    projectKnowledgeVersion: PROJECT_KNOWLEDGE_VERSION,
    purpose: 'SecureChain Pay is an enterprise-grade financial platform integrating non-custodial crypto wallet functionality, instant P2P blockchain payments, quantitative AI trading strategies, machine learning predictions, execution safety risk controls, and interactive AI assistance.',
    canonicalCurrency: 'HSCT (High-Security Chain Token)',
    currencyRules: [
      '1 HSCT = ₹1 INR (Indian Rupee)',
      '1 USD = 83.50 HSCT',
      'All balances, transactions, trade prices, and P&L across the platform are natively tracked in HSCT.',
      'USD is treated purely as a secondary derived display unit.'
    ]
  },

  uiNavigation: {
    dashboard: { path: '/dashboard', label: 'Overview Dashboard', description: 'Main portfolio overview, quick action buttons, live market prices, and account summary.' },
    wallet: { path: '/wallet', label: 'My Wallet', description: 'Manage HSCT, BTC, and ETH balances, view recent activity, simulated deposit, and quick send/receive.' },
    trade: { path: '/trade', label: 'Trading Desk', description: 'Live crypto trading, chart analysis, manual buy/sell order placement, AI signal panel, and auto-trading toggles.' },
    explorer: { path: '/explorer', label: 'Block Explorer', description: 'Inspect the Global Blockchain Ledger, Global Genesis Block (#0), block verification, hashes, and Merkle anchoring proofs.' },
    transactions: { path: '/transactions', label: 'Transaction History', description: 'Detailed log of all sent, received, trade, and genesis transactions with blockchain proof links.' },
    aiAssistant: { path: '/ai-assistant', label: 'AI Assistant', description: 'Interactive project copilot for trading setup analysis, market context, wallet help, and platform guidance.' },
    settings: { path: '/settings', label: 'Settings', description: 'Configure Auto-Trading parameters, risk caps, max daily loss limits, strategy selection, and profile settings.' },
    paperTrading: { path: '/paper-trading', label: 'Paper Trading', description: 'Simulated virtual trading environment with virtual equity and zero financial risk.' },
    backtesting: { path: '/backtesting', label: 'Backtesting Engine', description: 'Run historical strategy simulations against past market candles to test performance.' },
    kyc: { path: '/kyc', label: 'Identity Verification (KYC)', description: 'Submit document verification for identity verification and merchant tier upgrades.' },
    profile: { path: '/profile', label: 'User Profile', description: 'View user UID, linked accounts, security audit logs, and account tier.' }
  },

  architecture: {
    walletArchitecture: {
      description: 'Non-custodial, cryptographically verified HD wallet.',
      keys: 'Client-side AES-256-GCM encrypted private key generated with secp256k1 ECDSA algorithm.',
      verification: 'Pre-flight cryptographic integrity check verifies keypair, address derivation, and public key match before every transaction.'
    },

    blockchainLedger: {
      description: 'Hybrid Off-Chain + Dual-Write Global Blockchain Ledger.',
      layers: [
        'Layer 1: Off-chain sub-second balance settlement for instant UX.',
        'Layer 2: Dual-write to Global Firestore Blockchain Ledger (`global_blocks` collection). Global Genesis Block (#0) serves as system anchor.',
        'Layer 3: Merkle Tree Batching engine batches off-chain transactions into cryptographic roots.',
        'Layer 4: Real EVM Smart Contract anchoring on Hardhat local node / Ethereum testnet.',
        'Layer 5: Phase 3 Reconciliation Engine automatically detects and recovers missing/failed on-chain proofs.'
      ]
    },

    tradingPipeline: {
      description: 'Strict 10-step quantitative execution pipeline.',
      steps: [
        '1. Market Data: 100-candle WebSocket feed (Binance API).',
        '2. Technical Indicators: Calculation of EMA (9/21/50), RSI (14), MACD (12/26/9), ATR (14), and Bollinger Bands.',
        '3. ML Prediction: Python FastAPI ML microservice (logistic regression & probability scoring).',
        '4. Strategy Engine: Quantitative scoring combining trend, momentum, volatility, and ML signal.',
        '5. Hybrid Recommendation: Evaluates signals to output validated action (BUY, SELL, HOLD, NO_TRADE).',
        '6. Risk Engine: Validates risk-per-trade cap (1%), max daily loss (3%), max open positions (3), stop-loss, and take-profit.',
        '7. Safety Engine: Enforces circuit breakers, drawdown limits, and emergency stops.',
        '8. Execution Engine: Places trade in Paper Trading virtual ledger or wallet balance.',
        '9. Trade Journal & Attribution: Records execution metadata, strategy parameters, and trade rationale.',
        '10. Feedback Learning (Phase 7): Adaptive feedback registry filters bad setups and updates champion strategy version.'
      ]
    },

    autoTrading: {
      modes: {
        OFF: 'Disabled. Auto-trading cycle skips execution.',
        PAPER: 'Simulated execution in virtual paper trading environment.',
        LIVE: 'Live wallet balance execution.'
      },
      allTimeMode: 'Continuous 24/7 background monitoring & automated risk evaluation.',
      safetyGates: 'If daily loss limit (3%) or drawdown cap is breached, Auto-Trading automatically pauses and sets status to DISABLED or PAUSED.'
    }
  },

  modules: [
    'Authentication', 'User Account', 'Wallet', 'Blockchain', 'Payments',
    'Transactions', 'Trading', 'AI Assistant', 'ML Prediction', 'Strategy Engine',
    'Risk Engine', 'Safety Engine', 'Paper Trading', 'Auto-Trading', 'All-Time Mode',
    'Trade Journal', 'Feedback Learning', 'Notifications', 'Settings', 'Security'
  ]
};

export function getModuleKnowledgeSummary(): string {
  return `[SECURECHAIN PAY PROJECT KNOWLEDGE (v${PROJECT_KNOWLEDGE_VERSION})]
SecureChain Pay is an enterprise blockchain payment & AI quantitative trading platform natively powered by HSCT (1 HSCT = ₹1 INR, 1 USD = 83.50 HSCT).
Core Modules: ${SECURECHAIN_PAY_KNOWLEDGE.modules.join(', ')}.
Key Navigation Paths:
- Wallet & Balances: /wallet
- Dashboard Overview: /dashboard
- Trade Desk: /trade
- Block Explorer & Genesis Block #0: /explorer
- Auto-Trading & Risk Settings: /settings
- Transaction Log: /transactions
- Paper Trading: /paper-trading
- Backtesting: /backtesting`;
}
