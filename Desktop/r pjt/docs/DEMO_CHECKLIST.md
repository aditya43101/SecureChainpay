# FACULTY PRESENTATION DEMO CHECKLIST & REHEARSAL GUIDE

**Project:** Blockchain-Based Digital Vehicle Passport  
**Lead Presenter:** Aditya Singh (VIT Student 25BCE5002)  
**System Status:** Production Ready (Hardhat EVM + Node API + Next.js 14)

---

## 1. PRE-PRESENTATION SYSTEM STARTUP (T-15 MINUTES)

Follow this exact command sequence in your terminal before entering the evaluation hall:

### Step 1.1: Verify PostgreSQL Database
```bash
# Check that PostgreSQL is actively running on port 5432
lsof -i :5432
# If not running, start Postgres via homebrew:
brew services start postgresql@14 # (or your active postgres version)
```

### Step 1.2: Launch Blockchain EVM Node (Terminal 1)
```bash
cd "/Users/adityasingh/Desktop/r pjt/blockchain"
npx hardhat node
# Expected output: "Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/"
```

### Step 1.3: Deploy Smart Contracts (Terminal 2)
```bash
cd "/Users/adityasingh/Desktop/r pjt/blockchain"
# Deploy VehiclePassport contract
npx hardhat run scripts/deploy.ts --network localhost
# Deploy PrivacyVerifier contract
npx hardhat run scripts/deployPrivacyVerifier.ts --network localhost
# Expected output:
# VehiclePassport deployed successfully at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
# PrivacyVerifier deployed successfully at: 0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf
```

### Step 1.4: Seed Database and Anchor On-Chain State (Terminal 2)
```bash
cd "/Users/adityasingh/Desktop/r pjt/backend"
npm run prisma:seed
# Expected output: "Phase 4 Database & Blockchain Seed completed successfully."
```

### Step 1.5: Launch Backend API Server (Terminal 2)
```bash
cd "/Users/adityasingh/Desktop/r pjt/backend"
npm run dev
# Expected output:
# BlockchainService connected to contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3
# Vehicle Passport API Server running on port 5001
```

### Step 1.6: Launch Frontend Application (Terminal 3)
```bash
cd "/Users/adityasingh/Desktop/r pjt/frontend"
npm run dev
# Expected output: "Ready in ... - Local: http://localhost:3000"
```

---

## 2. PRE-DEMO HEALTH CHECKLIST

Verify these endpoints in your browser or curl before presenting:

| Target Component | URL / Test Command | Expected Output | Status |
|---|---|---|---|
| **Backend Health** | `curl -s http://localhost:5001/api/health` | `{"status":"ok", ...}` | [ ] PASS |
| **Frontend Root** | `http://localhost:3000` | Landing page renders in light mode | [ ] PASS |
| **Login Portal** | `http://localhost:3000/login` | Google button + 6 Test user cards | [ ] PASS |
| **Owner A Dashboard** | Login as Alex Mercer → `/dashboard` | `VP-000001` Tata Nexon EV visible | [ ] PASS |
| **Tamper Lab** | `http://localhost:3000/tamper-lab` | Green "ALL RECORDS CRYPTOGRAPHICALLY VERIFIED" | [ ] PASS |
| **Public Verify Portal** | `http://localhost:3000/verify/VP-000001` | PII masked, VERIFIED badge | [ ] PASS |
| **Blockchain Explorer** | `http://localhost:3000/explorer` | Chain ID 31337, latest block > 20 | [ ] PASS |

---

## 3. BROWSER PREPARATION (T-5 MINUTES)

To ensure a seamless, professional presentation without awkward tab switching:

1. **Window Setup:** Open Google Chrome maximized.
2. **Prepared Tabs:**
   - **Tab 1:** `http://localhost:3000` (Home Landing Page)
   - **Tab 2:** `http://localhost:3000/login` (Stakeholder Sign In)
   - **Tab 3:** `http://localhost:3000/dashboard` (Already logged in as Alex Mercer)
   - **Tab 4:** `http://localhost:3000/tamper-lab` (Tamper Simulation Sandbox)
   - **Tab 5:** `http://localhost:3000/verify/VP-000001` (Public Verification in Incognito/Separate Window)
   - **Tab 6:** `http://localhost:3000/explorer` (Blockchain Explorer)
3. **Display Zoom:** Set browser zoom to 100% or 110% for projector readability.
4. **Clean Screen:** Close unnecessary desktop notifications, personal tabs, and messaging apps.

---

## 4. TEST ACCOUNTS & SAMPLE DATA CHEAT SHEET

| Persona Name | Email | Role | Passwords/Auth |
|---|---|---|---|
| **Test Owner A (Alex Mercer)** | `owner.a@vehiclepassport.dev` | `VEHICLE_OWNER` | Click Test User Button |
| **Test Owner B (Elena Rostova)**| `owner.b@vehiclepassport.dev` | `VEHICLE_OWNER` | Click Test User Button |
| **Apex Certified Garage** | `garage@vehiclepassport.dev` | `GARAGE` | Click Test User Button |
| **Nordic Motors (Factory)** | `manufacturer@vehiclepassport.dev` | `MANUFACTURER` | Click Test User Button |
| **SafeShield Insurance** | `insurance@vehiclepassport.dev` | `INSURANCE_PROVIDER` | Click Test User Button |
| **System Administrator** | `admin@vehiclepassport.dev` | `ADMIN` | Click Test User Button |

---

## 5. COMMON FAILURE MODES & FAST RECOVERY STEPS

### Scenario A: "Tamper Lab does not show my vehicle"
- **Cause:** User navigated to `/tamper-lab` in a new window where they are not authenticated.
- **Recovery:** Click `Login` in the top navbar, click `Test Owner A (Alex Mercer)`, then click `Tamper Lab`. The vehicle immediately loads.

### Scenario B: "Verification reports TAMPER DETECTED before you clicked rollback"
- **Cause:** A previous test run or rehearsal left modified records in PostgreSQL.
- **Recovery:** In Terminal 2, run:
  ```bash
  cd "/Users/adityasingh/Desktop/r pjt/backend" && npm run prisma:seed
  ```
  Refresh the browser tab. The state is instantly restored to 100% verified.

### Scenario C: "Hardhat EVM node restarted with empty state"
- **Cause:** Computer went to sleep or Hardhat terminal was closed.
- **Recovery:**
  1. Restart node: `npx hardhat node` in `blockchain/`.
  2. Deploy contracts: `npx hardhat run scripts/deploy.ts --network localhost` and `npx hardhat run scripts/deployPrivacyVerifier.ts --network localhost`.
  3. Re-seed: `npm run prisma:seed` in `backend/`.
  4. Refresh the frontend.

### Scenario D: "Network port 5001 or 3000 already in use"
- **Recovery:**
  ```bash
  kill -9 $(lsof -ti:5001)
  kill -9 $(lsof -ti:3000)
  ```
  Restart `npm run dev` in backend and frontend.

---

## 6. BACKUP PRESENTATION SEQUENCE (IF PROJECTOR FAILS OR HARDWARE ISSUE)

1. **Offline PDF Backup:** Keep `Blockchain_Vehicle_Passport_Complete_Guide.pdf` ready on your desktop.
2. **Terminal Automated Test Run:** If browser UI freezes, demonstrate the live working architecture via the automated test suite in 10 seconds:
   ```bash
   cd backend && npx ts-node tests/phase2_intelligence.test.ts
   npx ts-node tests/phase6_batch_merkle.test.ts
   ```
   Show 100% green test assertions proving backend, hashing, database, and smart contract execution.
