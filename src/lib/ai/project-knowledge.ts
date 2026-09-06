/**
 * SecureChain Pay — Complete Exhaustive Technical Project Knowledge Base (v2.0)
 * Source of truth for complete application architecture, tech stack, cryptography,
 * quantitative pipeline, databases, APIs, security algorithms, and UI navigation.
 * Designed for full Project Demonstrations, Viva Defence, and Evaluator Queries.
 */

export const PROJECT_KNOWLEDGE_VERSION = 'v2.0';

export const SECURECHAIN_PAY_KNOWLEDGE = {
  project: {
    name: 'SecureChain Pay',
    tagline: 'Enterprise Blockchain Payments & AI-Assisted Quantitative Trading Platform',
    version: '1.0.0',
    projectKnowledgeVersion: PROJECT_KNOWLEDGE_VERSION,
    purpose: 'SecureChain Pay is an enterprise-grade financial platform integrating non-custodial crypto wallet functionality, instant sub-second P2P blockchain payments, quantitative AI trading strategies, machine learning predictions, execution safety risk controls, Merkle-anchored block ledger, and interactive AI assistance.',
    canonicalCurrency: 'HSCT (High-Security Chain Token)',
    currencyRules: [
      '1 HSCT = ₹1 INR (Indian Rupee, Fixed Peg)',
      '1 USD = 83.50 HSCT ($1 USD = ₹83.50 INR)',
      'All wallet balances, ledger transactions, trade execution prices, and P&L across the platform are natively calculated and stored in HSCT.',
      'USD is treated purely as a secondary derived display unit for global UI views.'
    ]
  },

  techStack: {
    frontend: [
      'Framework: Next.js 16 (App Router) with Turbopack bundler',
      'UI Library: React 19',
      'Styling: Vanilla CSS design system with HSL dark mode tokens & glassmorphism overlays',
      'Icons & Visuals: Lucide React icon suite',
      'Charts & Visualizations: Recharts & Lightweight Charts for TradingDesk & Backtesting'
    ],
    backend: [
      'Server Framework: Next.js Serverless API Routes (Node.js runtime)',
      'Language: TypeScript (Strict Type Checking)',
      'API Specs: RESTful JSON endpoints with Zod request validation'
    ],
    databases: [
      'Relational Database: Prisma ORM with SQLite (Local) / PostgreSQL (Production)',
      'NoSQL & Realtime Ledger: Firebase Firestore Admin SDK (`global_blocks`, `users`, `transactions`, `wallet` collections)',
      'State Caching: In-memory fallback stores (`tradingFallbackStore`) for resilient zero-downtime execution'
    ],
    cryptographyAndSecurity: [
      'Wallet Encryption: Client-side AES-256-GCM symmetric encryption for private key storage',
      'Asymmetric Signatures: ECDSA secp256k1 curve (same curve used in Bitcoin & Ethereum)',
      'Hashing Algorithm: SHA-256 cryptographic hash function for block hash generation',
      'Merkle Tree Engine: Custom Merkle Tree implementation for transaction batching & proof generation',
      'EVM Anchoring: Hardhat local node / Ethereum Sepolia testnet smart contract anchoring'
    ],
    aiAndMachineLearning: [
      'Primary LLM Engine: Google Gemini API (gemini-flash-latest / gemini-3.6-flash)',
      'Fallback LLM: Mistral AI REST API (mistral-small-latest)',
      'ML Microservice: Python FastAPI server executing Logistic Regression & XGBoost classification models for 4H candle direction prediction',
      'Context Router: Dynamic multi-domain intent classifier & live context assembler'
    ]
  },

  uiNavigation: {
    dashboard: { path: '/dashboard', label: 'Overview Dashboard', description: 'Main portfolio overview, quick action buttons, live market prices, and account summary.' },
    wallet: { path: '/wallet', label: 'My Wallet', description: 'Manage HSCT, BTC, and ETH balances, view recent activity, simulated deposit, and quick send/receive.' },
    trade: { path: '/trade', label: 'Trading Desk', description: 'Live crypto trading, chart analysis, manual buy/sell order placement, AI signal panel, and auto-trading toggles.' },
    explorer: { path: '/explorer', label: 'Block Explorer', description: 'Inspect the Global Blockchain Ledger, Global Genesis Block (#0), block verification, hashes, and Merkle anchoring proofs.' },
    transactions: { path: '/transactions', label: 'Transaction History', description: 'Detailed log of all sent, received, trade, and genesis transactions with blockchain proof links.' },
    aiAssistant: { path: '/ai-assistant', label: 'AI Assistant & Viva Defender', description: 'Interactive project copilot for trading setup analysis, market context, wallet help, and platform viva defence.' },
    settings: { path: '/settings', label: 'Settings', description: 'Configure Auto-Trading parameters, risk caps, max daily loss limits, strategy selection, and profile settings.' },
    paperTrading: { path: '/paper-trading', label: 'Paper Trading', description: 'Simulated virtual trading environment with $100,000 virtual equity and zero financial risk.' },
    backtesting: { path: '/backtesting', label: 'Backtesting Engine', description: 'Run historical strategy simulations against past market candles to test performance.' },
    kyc: { path: '/kyc', label: 'Identity Verification (KYC)', description: 'Submit document verification for identity verification and merchant tier upgrades.' },
    profile: { path: '/profile', label: 'User Profile', description: 'View user UID, linked accounts, security audit logs, and account tier.' },
    adminDashboard: { path: '/admin-dashboard', label: 'Admin Dashboard', description: 'System health monitoring, continuity simulation, and policy management.' },
    privacy: { path: '/privacy', label: 'Privacy & Security Center', description: 'Audit trail of sanitized data requests, security events, and data protection settings.' }
  },

  architecture: {
    walletArchitecture: {
      description: 'Non-custodial, cryptographically verified HD wallet architecture.',
      keys: 'Client-side AES-256-GCM encrypted private key generated with secp256k1 ECDSA algorithm.',
      verification: 'Pre-flight cryptographic integrity check verifies keypair, address derivation, and public key match before every transaction.',
      mnemonic: '12-word BIP-39 compliant mnemonic seed phrase generated upon wallet creation.'
    },

    blockchainLedger: {
      description: 'Hybrid Off-Chain + Dual-Write Global Blockchain Ledger.',
      layers: [
        'Layer 1 (Off-Chain Settlement): Sub-second balance updates in local & database state for instant payment UX.',
        'Layer 2 (Dual-Write Firestore Ledger): Every completed transaction is dual-written to global_blocks collection. Global Genesis Block (#0) acts as immutable genesis anchor.',
        'Layer 3 (Merkle Tree Batching): Off-chain transactions are aggregated into Merkle Trees where SHA-256 leaf hashes build a single cryptographic Merkle Root.',
        'Layer 4 (EVM Smart Contract Anchoring): Merkle Roots are periodically submitted to an EVM Smart Contract on Hardhat/Ethereum for public verification.',
        'Layer 5 (Automated Reconciliation): Phase 3 Reconciliation Engine scans for ledger discrepancies and automatically repairs missing on-chain proofs.'
      ]
    },

    tradingPipeline: {
      description: 'Strict 10-step quantitative execution pipeline.',
      steps: [
        'Step 1 (Market Data Feed): Realtime 100-candle market data ingested from Binance API via WebSocket/REST.',
        'Step 2 (Technical Indicators): Calculation of EMA (9/21/50/200), RSI (14), MACD (12/26/9), ATR (14), and Bollinger Bands.',
        'Step 3 (ML Prediction Microservice): Python FastAPI ML service predicts candle direction probability using trained models.',
        'Step 4 (Strategy Engine): Strategy algorithms (HYBRID_v1, TREND_FOLLOWING, MEAN_REVERSION) score market conditions.',
        'Step 5 (Signal Recommendation): System evaluates composite score to generate validated signal (BUY, SELL, HOLD, NO_TRADE).',
        'Step 6 (Risk Engine): Enforces strict 1% risk-per-trade position sizing, 3% max daily loss cap, and stop-loss/take-profit boundaries.',
        'Step 7 (Safety Engine & Circuit Breaker): Automatically halts auto-trading if daily loss > 3% or maximum drawdown is hit.',
        'Step 8 (Execution Engine): Routes orders to virtual Paper Account ($100,000 equity) or Live HD Wallet balance.',
        'Step 9 (Trade Journal & Rationale Logging): Logs complete execution rationale, quantitative scores, and technical indicators for auditability.',
        'Step 10 (Adaptive Feedback Learning): Phase 7 Feedback Engine analyzes win/loss metrics to optimize champion strategy versions.'
      ]
    },

    autoTrading: {
      modes: {
        OFF: 'Disabled. Auto-trading cycle skips execution.',
        PAPER: 'Simulated execution in virtual paper trading environment ($100,000 virtual capital).',
        LIVE: 'Live wallet balance execution using actual HSCT holdings.'
      },
      allTimeMode: 'Continuous 24/7 background worker monitoring market candles & executing quantitative risk evaluations.',
      safetyGates: 'If daily loss limit (3%) or drawdown cap is breached, Auto-Trading automatically pauses and sets status to DISABLED or PAUSED.'
    }
  },

  modules: [
    'Authentication (NextAuth / JWT)', 'User Profile & Identity', 'Non-Custodial HD Wallet (secp256k1)',
    'Dual-Write Blockchain Ledger (Genesis Block #0)', 'Merkle Tree Batching & EVM Anchoring',
    'Instant P2P Payments & HSCT Currency Engine', 'Live Market Data Feed (Binance API)',
    'Technical Indicators Engine (EMA, RSI, MACD, ATR, Bollinger Bands)',
    'Python FastAPI ML Prediction Microservice', 'Quantitative Strategy Engine (HYBRID_v1)',
    'Risk Engine (1% Trade Cap, 3% Daily Loss Limit)', 'Safety Circuit Breaker & Drawdown Control',
    'Paper Trading Sandbox ($100k Virtual Equity)', 'Backtesting Simulator (Historical Candle Simulation)',
    'Auto-Trading & 24/7 All-Time Mode', 'Trade Journal & Rationale Audit Log',
    'Adaptive Feedback Learning Pipeline', 'Block Explorer & Cryptographic Hash Verification',
    'KYC Identity Verification', 'Admin System Health & Policy Simulator',
    'AI Assistant & Evaluator Viva Defender (Google Gemini)'
  ]
};

export function getModuleKnowledgeSummary(): string {
  return `=== SECURECHAIN PAY COMPLETE TECHNICAL PROJECT KNOWLEDGE (v${PROJECT_KNOWLEDGE_VERSION}) ===
SecureChain Pay is an enterprise blockchain payment & AI quantitative trading platform natively powered by HSCT (1 HSCT = ₹1 INR, 1 USD = 83.50 HSCT).

COMPLETE ARCHITECTURE SUMMARY FOR DEMO & VIVA DEFENCE:
1. CANONICAL CURRENCY: HSCT (High-Security Chain Token). 1 HSCT = ₹1 INR, 1 USD = 83.50 HSCT.
2. TECH STACK: Next.js 16 (App Router), React 19, Turbopack, TypeScript, Prisma ORM (SQLite/PostgreSQL), Firebase Firestore Ledger, TailWind/Vanilla CSS.
3. CRYPTOGRAPHY: Client-side AES-256-GCM private key encryption, secp256k1 ECDSA signatures, SHA-256 Merkle Tree batching, EVM Smart Contract anchoring on Block Genesis #0.
4. 10-STEP QUANT TRADING PIPELINE: 
   - Market Data (Binance Feed) -> Indicators (EMA 9/21/50/200, RSI, MACD, ATR, Bollinger) -> ML Prediction (Python FastAPI) -> Strategy Scoring (HYBRID_v1) -> Signal (BUY/SELL/HOLD/NO_TRADE) -> Risk Engine (1% risk/trade, 3% max daily loss) -> Safety Circuit Breaker -> Execution (Paper/Live) -> Trade Rationale Logging -> Adaptive Feedback Learning.
5. AUTO-TRADING SAFETY: Max daily loss limit is 3%. If hit, circuit breaker trips and auto-trading halts automatically.
6. NAVIGATION MAP:
   - Dashboard Overview: /dashboard
   - HD Wallet: /wallet
   - Live Trade Desk: /trade
   - Block Explorer: /explorer
   - Transaction Audit Log: /transactions
   - AI Assistant & Viva Defender: /ai-assistant
   - Auto-Trading & Risk Settings: /settings
   - Paper Trading ($100k virtual equity): /paper-trading
   - Backtesting Simulator: /backtesting
   - KYC Verification: /kyc
   - Admin System Health: /admin-dashboard`;
}

