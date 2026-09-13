# PROJECT_EXPORT_MANIFEST.md

## Project Identity
- **Project Name**: SecureChain Pay (Hybrid Non-Custodial Blockchain & Autonomous AI Financial Hub)
- **Export Date**: September 13, 2026
- **Repository Location**: `/Users/adityasingh/Desktop/bloackchain`
- **Export File**: `SecureChain-Pay-Full-Project-Export.zip`

---

## 1. Core Architecture Overview
SecureChain Pay is a full-stack, enterprise-grade hybrid payment, non-custodial wallet, canonical blockchain ledger, and autonomous algorithmic trading ecosystem. It combines client-side cryptographic key derivation with a tamper-evident server ledger anchored onto Ethereum/EVM smart contracts, protected by a 5-phase zero-trust security state machine with self-healing chain reconciliation, and powered by real-time indicator engines and AI-driven trade execution.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    NEXT.JS 16 APP ROUTER                                     │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────────┐ │
│  │ Dashboard / Wallet    │  │ Trade Terminal & Pairs  │  │ AI Trading & Auto-Pilot Hub    │ │
│  │ (Send, Receive, QR)   │  │ (BTC, ETH, SOL, etc.)   │  │ (Signals, Execution, ML)       │ │
│  └──────────┬────────────┘  └────────────┬────────────┘  └────────────────┬───────────────┘ │
└─────────────┼────────────────────────────┼────────────────────────────────┼─────────────────┘
              │                            │                                │
              ▼                            ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   APPLICATION / SERVICE LAYER                               │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────────┐ │
│  │ Payment Copilot & AI  │  │ Trading Assistant Engine│  │ 5-Phase Security Engine        │ │
│  │ Route Selection & Risk│  │ Indicators & Strategies │  │ State Machine & Auto-Freeze    │ │
│  └──────────┬────────────┘  └────────────┬────────────┘  └────────────────┬───────────────┘ │
└─────────────┼────────────────────────────┼────────────────────────────────┼─────────────────┘
              │                            │                                │
              ▼                            ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               PERSISTENCE & BLOCKCHAIN LAYER                                │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────────┐ │
│  │ Firebase Firestore    │  │ PostgreSQL + Prisma ORM │  │ EVM Smart Contracts (Hardhat)  │ │
│  │ Real-time collections │  │ Relational records      │  │ Canonical Anchor & Ledger      │ │
│  └───────────────────────┘  └─────────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technical Stack & Frameworks

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 16.1.1 (App Router, Server Actions, Edge/Node route handlers), React 19, TypeScript 5 |
| **Styling & UI** | Tailwind CSS 3.4, Radix UI primitives, Lucide Icons, Framer Motion animations |
| **Client State** | Zustand 5 (Auth, Wallet, Explorer, AI, Paper Trading stores) |
| **Authentication** | Firebase Auth (Client & Admin SDKs) + Non-custodial PBKDF2/AES-256-GCM seed derivation |
| **Databases** | Cloud Firestore (Primary real-time document store) + PostgreSQL with Prisma ORM 6.2 |
| **Caching & Pub/Sub** | Redis (ioredis / Upstash) for rate limiting, live ticker pub/sub, and nonce guards |
| **Blockchain** | Solidity ^0.8.28, Hardhat, Ethers.js v6, SHA-256 Merkle trees, Genesis trust anchor |
| **Trading Engine** | Custom technical indicator engine, Strategy orchestrator, Signal generation, Risk engine |
| **AI / Machine Learning** | Google Gemini 1.5 Flash (Payments Copilot & Trading analysis) + Python ML Service (FastAPI) |

---

## 3. Five-Phase Blockchain & Security Architecture

SecureChain Pay implements a 5-Phase Zero-Trust Cryptographic Ledger:

1. **Phase 1: Database Security & Access Isolation**
   - Firestore Security Rules enforcing strict non-custodial boundaries: users cannot mutate blocks, ledger balances, or tamper with transactions directly.
   - Server-side administrative verification with nonce validation and balance guardlocks.

2. **Phase 2: Canonical Blockchain + Genesis Trust Anchor**
   - Genesis block initialized with a deterministic cryptographic anchor (`block_0`).
   - Merkle-linked SHA-256 blocks storing serialized hybrid transactions.
   - Dual-hash chain validation verifying `previousHash` integrity across all block heights.

3. **Phase 3: Smart Contract Controlled Write Layer**
   - Solidity contracts (`contracts/SecureChainAnchor.sol`, `contracts/SecureChainLedger.sol`).
   - Periodic anchoring of off-chain Merkle roots onto EVM L1/L2 smart contracts.
   - Dual-write verification ensuring Firestore ledger records match contract-anchored root states.

4. **Phase 4: Attack Detection + Transaction Freeze**
   - Real-time `SecurityStateMachine`: States `NORMAL`, `SUSPICIOUS`, `ATTACK_DETECTED`, `FROZEN`, `RECOVERING`.
   - Heuristics for double-spend detection, block hash mutation, orphan forks, and velocity spikes.
   - Automatic execution of `TransactionSecurityGate`: instantly locks writes and pauses contract endpoints.

5. **Phase 5: Self-Healing Blockchain Recovery**
   - `RecoveryController` initiates automated checkpoint rollbacks to the last known valid EVM-anchored state.
   - Reconciliation engine re-verifies uncorrupted transactions, discards invalid forks, and resumes normal operations.

---

## 4. Complete Trading Engine Architecture
Prepared for external inspection and audit regarding *"Trading Assistant is not taking trades"*:

```
Market Data Provider (Binance / Coingecko REST & WS)
  │
  ▼
LiveCandleFeed & CandleStorage (src/lib/trading/candle-storage.ts)
  │ (OHLCV Aggregation & Historical Ingestion)
  ▼
IndicatorEngine (src/lib/trading/indicator-engine.ts)
  │ (EMA-9/21, RSI-14, MACD, Bollinger Bands, ATR, ADX, SuperTrend)
  ▼
StrategyEngine (src/lib/trading/strategy-engine.ts)
  │ (Trend Momentum, Mean Reversion, Breakout, Scalping rules)
  ▼
SignalGenerator (src/lib/trading/signal-generator.ts)
  │ (Multi-timeframe consensus, Signal score & weight aggregation)
  ▼
Trading AI & Gemini Analysis (src/lib/trading/ai-learning-engine.ts, src/lib/ai/gemini.ts)
  │ (Contextual market analysis, Confidence threshold evaluation)
  ▼
RiskEngine & PositionSizer (src/lib/trading/risk-engine.ts, src/lib/trading/position-sizer.ts)
  │ (Max drawdown checks, Daily loss limits, Balance allocation, Stop-Loss / Take-Profit)
  ▼
Auto-Trading Orchestrator (src/app/api/auto-trading/run/route.ts)
  │ (Trade eligibility checks, Active position count, Minimum confidence gates)
  ▼
PaperExecutionEngine (src/lib/trading/paper-execution-engine.ts)
  │ (Order creation, Slippage simulation, Position update, Balance deduction)
  ▼
Firestore & UI Synchronization (src/stores/paper-trading-store.ts, src/components/trading/)
```

---

## 5. Directory Structure & Source File Statistics

### Source File Count
- **Total Workspace Source Files**: ~272 core files (TypeScript, Solidity, Python, Prisma, SQL, JSON)
- **Zero Secrets / Zero Build Artifacts** included in export archive.

### Major Directories

| Directory | Description |
|---|---|
| `contracts/` | Solidity smart contracts (`SecureChainAnchor.sol`, `SecureChainLedger.sol`, `PaymentChannel.sol`, `WalletFactory.sol`) |
| `src/app/` | Next.js 16 App Router pages, layouts, dashboard views, and 77 API route handlers |
| `src/components/` | Modular UI components (Dashboard, Wallet, Trading, Trading-AI, Transactions, Admin, Shared, Auth) |
| `src/lib/blockchain/` | Canonical blockchain implementation, Merkle trees, Genesis anchor, Smart contract connectors |
| `src/lib/trading/` | 14-module algorithmic trading engine, live candles, indicators, strategies, paper execution |
| `src/lib/security/` | Security state machine, attack detectors, transaction gatekeeper, integrity monitor |
| `src/lib/recovery/` | Phase 5 self-healing recovery controller, rollback planner, reconciliation pipeline |
| `src/lib/wallet/` | Non-custodial PBKDF2/AES key derivation, transaction signing, address validation |
| `src/lib/payments/` | Payment Copilot, routing decision engine, risk evaluator, dynamic fee calculator |
| `src/stores/` | Zustand stores (`wallet-store`, `auth-store`, `ai-store`, `explorer-store`) |
| `src/types/` | Full TypeScript definitions for transactions, blocks, recovery, verification, and trading |
| `prisma/` | Prisma relational database schema and database seed scripts |
| `scripts/` | Verification scripts, migration tests, Hardhat deployment scripts, Phase 4 & 5 test runners |
| `test/` | Comprehensive Hardhat test suites (`Phase4Integrity.test.cjs`, `Phase5Recovery.test.cjs`, etc.) |
| `ml-service/` | Standalone Python FastAPI microservice for ML model inference and training scripts |
| `public/` | Static application assets, SVG icons, and web manifest |

---

## 6. Smart Contracts
1. **`SecureChainAnchor.sol`**:
   - Manages canonical block state hashes and periodic Merkle root commitments.
   - Enforces tamper-proof state registration with role-based access control and emergency circuit breaker pause.
2. **`SecureChainLedger.sol`**:
   - On-chain balance and payment channel verification.
3. **`PaymentChannel.sol`**:
   - Off-chain high-frequency micro-payment channel contracts with cryptographic signature settlement.
4. **`WalletFactory.sol`**:
   - Contract wallet generator supporting multi-signature execution and non-custodial ownership hooks.

---

## 7. Key Backend API Routes (77 Routes Total)

### Trading & Auto-Pilot
- `/api/auto-trading/run`: Evaluates market conditions and executes eligible automated trades.
- `/api/auto-trading/status`: Reports auto-trading operational state, active bots, and risk limits.
- `/api/auto-trading/enable` & `/api/auto-trading/disable`: Toggles automated trade execution.
- `/api/auto-trading/emergency-stop`: Instantly cancels open orders and halts trading loops.
- `/api/trading/analysis/[symbol]`: Real-time technical indicator and strategy score report.
- `/api/trading/recommendation/[symbol]`: AI and quantitative trade recommendation engine.
- `/api/trading/risk`: Portfolio risk metrics, drawdown monitoring, and exposure calculations.
- `/api/market/candles/[symbol]`: Historical and real-time aggregated OHLCV candle feed.
- `/api/market/ticker/[symbol]`: Live asset pricing, 24h volume, and delta calculations.
- `/api/paper/orders` & `/api/paper/positions`: Virtual paper trading order book and open position manager.
- `/api/backtest/run`: Runs historical simulation against custom indicator configurations.

### Blockchain & Transactions
- `/api/blockchain/blocks`: Paginated query interface for canonical ledger blocks.
- `/api/blockchain/verify-chain`: Full cryptographically verified ledger validation.
- `/api/blockchain/chain-status`: Current block height, difficulty, latest block hash, and anchor state.
- `/api/blockchain/append`: Securely appends a verified transaction block to the ledger.
- `/api/blockchain/convert-hsct`: Conversion handler between HSCT and supported cryptocurrencies.
- `/api/transactions/submit`: Non-custodial transaction ingress with signature verification.
- `/api/transactions/execute`: Atomic state transition and ledger commitment.
- `/api/merkle/proof` & `/api/merkle/batch`: Computes and verifies SHA-256 Merkle audit trails.

### Security & Self-Healing Recovery
- `/api/security/state`: Real-time state machine inspector (`NORMAL` -> `FROZEN`).
- `/api/security/incidents`: Incident event log for detected tampering or velocity violations.
- `/api/security/test-runner`: Simulation engine for running automated red-team security attacks.
- `/api/recovery/start`: Triggers Phase 5 automated recovery and reconciliation routine.
- `/api/recovery/status`: Tracks reconciliation progress, restored blocks, and verified root hashes.

### Payments Copilot & Wallet
- `/api/wallet/provision`: Provisions new non-custodial wallet records and initializes balances.
- `/api/wallet/topup`: Faucet and testnet token distribution endpoint.
- `/api/wallet/transfer`: Off-chain and on-chain transfer coordinator.
- `/api/wallet/request-money`: Peer-to-peer invoice and QR payment request creation.
- `/api/ai/payment-copilot/message`: Conversational financial assistant powered by Gemini.
- `/api/payments/route-selection`: Multi-rail smart payment routing (Instant, Low Fee, Private).
- `/api/payments/risk-eval`: Pre-transaction compliance, velocity, and anomaly scoring.

---

## 8. Export Verification
- [x] All source code preserved exactly as-is in workspace.
- [x] All functional logic, parameters, and trading thresholds intact.
- [x] No credentials or secret keys included (`.env` files excluded; `.env.example` provided).
- [x] Complete directory structure included for immediate code auditing and local execution.
