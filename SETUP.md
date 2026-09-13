# SecureChain Pay - Local Setup & Execution Guide

This document provides complete instructions to set up, configure, and run the **SecureChain Pay** project locally for development, auditing, and production builds.

---

## 1. Prerequisites
Ensure your environment meets the following requirements:
- **Node.js**: v18.18+ or v20+ recommended (Compatible with Next.js 16)
- **Package Manager**: `npm` (v9+) or `pnpm`
- **Python** (Optional, for `ml-service`): Python 3.10+
- **PostgreSQL**: PostgreSQL 14+ instance (or Cloud Supabase / Neon connection)
- **Firebase Project**: Firebase account with Authentication and Cloud Firestore enabled

---

## 2. Dependency Installation

### Node.js Frontend & Backend
Install all root application dependencies:
```bash
npm install
```

### (Optional) Python Machine Learning Microservice
If running the Python ML forecasting service:
```bash
cd ml-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

---

## 3. Configure Environment Variables (`.env`)

Copy the provided `.env.example` template to `.env.local` or `.env`:
```bash
cp .env.example .env.local
```

Open `.env.local` in an editor and populate the required service credentials:

### Key Variables Required:
1. **Firebase Configuration**:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase web client API key.
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Your Firebase Auth domain (e.g., `project-id.firebaseapp.com`).
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Your Firebase project ID.
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket.
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase sender ID.
   - `NEXT_PUBLIC_FIREBASE_APP_ID`: Your Firebase app ID.
   - `FIREBASE_ADMIN_CLIENT_EMAIL`: Service account email for administrative access.
   - `FIREBASE_ADMIN_PRIVATE_KEY`: Service account private key (format with `\n`).

2. **Database (Prisma + PostgreSQL)**:
   - `DATABASE_URL`: `postgresql://user:password@localhost:5432/securechain_pay?schema=public`

3. **Blockchain & Smart Contracts**:
   - `NEXT_PUBLIC_RPC_URL`: RPC endpoint URL (e.g., `http://127.0.0.1:8545` or Infura/Alchemy URL).
   - `NEXT_PUBLIC_CHAIN_ID`: 31337 (Local Hardhat) or 11155111 (Sepolia testnet).
   - `NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS`: Deployed `SecureChainAnchor` contract address.
   - `NEXT_PUBLIC_LEDGER_CONTRACT_ADDRESS`: Deployed `SecureChainLedger` contract address.
   - `PRIVATE_SERVER_KEY`: Server operator private key used for periodic anchoring transactions.

4. **AI & External APIs**:
   - `GEMINI_API_KEY`: Google Gemini API key for Payment Copilot and Trading AI analysis.
   - `REDIS_URL` (Optional): Redis connection URL for high-frequency caching.

---

## 4. Configure Firebase & Firestore

1. In the Firebase Console, create a new project.
2. Enable **Authentication** -> **Email/Password** and **Anonymous** or **Google** providers.
3. Enable **Cloud Firestore** in test mode or deploy the included security rules:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```
   *(See `FIRESTORE_COLLECTIONS.md` for a comprehensive listing of all Firestore collections used by the app).*

---

## 5. Configure Database (Prisma ORM)

Generate the Prisma Client and run database migrations:
```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations to your PostgreSQL database
npx prisma db push

# (Optional) Seed the database
npx prisma db seed
```

---

## 6. Smart Contracts & Local Blockchain (Hardhat)

### Compile Smart Contracts
Compile the Solidity contracts located in `contracts/`:
```bash
npx hardhat compile
```

### Run a Local Hardhat Node (Optional)
To test EVM anchoring locally:
```bash
npx hardhat node
```

### Deploy Contracts Locally
In a separate terminal tab:
```bash
npx hardhat run scripts/deploy.ts --network localhost
```
Copy the output contract addresses into your `.env.local` under `NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS`.

---

## 7. Start the Development Server

Run the Next.js development server:
```bash
npm run dev
```

The application will be available at:
```
http://localhost:3000
```

---

## 8. Running Test Suites

### Hardhat Smart Contract & Security Integrity Tests
Run the blockchain integration and Phase 4/Phase 5 security simulation tests:
```bash
npx hardhat test
```
To run specific security tests:
- `npx hardhat test test/Phase4Integrity.test.cjs`
- `npx hardhat test test/Phase5Recovery.test.cjs`
- `npx hardhat test test/SecureChainAnchor.test.cjs`

### TypeScript Type-Checking
Verify that all TypeScript code passes strict compiler validation:
```bash
npx tsc --noEmit
```

---

## 9. Production Build

Create an optimized production bundle:
```bash
npm run build
```

Start the production server locally:
```bash
npm run start
```

---

## 10. Auditing the Trading Assistant

If you are investigating the issue: **"Trading Assistant is not taking trades"**, focus your audit on the following files:

1. **Auto-Trading Orchestrator**: `src/app/api/auto-trading/run/route.ts`
   - Inspect eligibility rules: minimum confidence check, balance requirement, and max concurrent position guards.
2. **Signal Generation**: `src/lib/trading/signal-generator.ts`
   - Verify indicator thresholds and strategy weight calculations.
3. **Strategy Engine**: `src/lib/trading/strategy-engine.ts`
   - Check RSI bounds, EMA crosses, and trend confirmation conditions.
4. **Risk Engine**: `src/lib/trading/risk-engine.ts`
   - Check daily loss cutoff, risk-reward ratios, and balance headroom limits.
5. **Paper Execution Engine**: `src/lib/trading/paper-execution-engine.ts`
   - Inspect order state transitions and Firestore balance updates.
