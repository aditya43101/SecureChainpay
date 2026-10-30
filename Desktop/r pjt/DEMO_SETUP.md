# 📘 BLOCKCHAIN VEHICLE PASSPORT — DEMO SETUP & RUN GUIDE
**Enterprise Digital Vehicle Passport & Tamper-Evident Automotive Ledger**

---

## 🌟 Executive Overview
This guide enables complete local replication and academic demonstration of the **Blockchain Vehicle Passport** project. The application utilizes a 3-layer architecture:
1. **Blockchain Layer (EVM Subnet):** Solidity smart contract `VehiclePassport.sol` deployed on Hardhat EVM (Chain ID `31337`) anchoring decentralized users, vehicles, ownership deeds, and cryptographic hash roots.
2. **Backend Services & Persistence:** Express + TypeScript + Prisma ORM connected to PostgreSQL storing structured metadata, telemetry, and service history.
3. **Frontend Application:** Next.js 14 App Router, Tailwind CSS, Lucide icons, and Playwright automated end-to-end testing suite.

---

## ⚙️ Prerequisites & System Requirements
- **Node.js:** v18.0.0 or higher (`node -v`)
- **npm:** v9.0.0 or higher
- **PostgreSQL:** Running locally on port `5432` with database `vehicle_passport_db`
- **Python:** Python 3.10+ (for Playwright automated verification scripts)
- **Hardhat:** Bundled locally in `blockchain/`

---

## 🚀 Quick Start (Under 3 Minutes)

### Step 1: Start the Local Blockchain Node
In terminal 1:
```bash
cd blockchain
npx hardhat node
```
*This starts a local Ethereum node at `http://127.0.0.1:8545` with Chain ID `31337`.*

---

### Step 2: Seed the Blockchain & Database Demo Dataset
In terminal 2 (from repository root):
```bash
# Runs smart contract registrations, sequential transfers, and syncs PostgreSQL
npm run seed:demo
```
*Or execute individually:*
```bash
# 1. Mine real on-chain users, vehicles, transfers, and service records
cd blockchain && npx hardhat run scripts/seedDemoBlockchain.ts --network localhost

# 2. Synchronize PostgreSQL database with on-chain records
cd ../backend && npx ts-node prisma/seed_demo.ts
```

---

### Step 3: Verify Ledger Integrity
In terminal 2:
```bash
# Runs independent on-chain assertion test and database consistency audit
npm run verify:demo
```
Expected output:
- `100% LEDGER INTEGRITY` on smart contract queries
- `29 PASSED, 0 FAILED` across all consistency checks

---

### Step 4: Start Backend API Server
In terminal 2:
```bash
cd backend
npm run dev
```
*Backend runs on `http://localhost:5001`. Health check available at `http://localhost:5001/api/health`.*

---

### Step 5: Start Frontend Development Server
In terminal 3:
```bash
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

## 👥 Evaluator Demo Personas & Logins

You can sign in using **Direct Sign-In** on the login page (`http://localhost:3000/login`) by entering the email address below, or by clicking the quick **Access Portal** card:

| Demo ID | Persona Name | Role | Email Address | Demonstration Focus |
|---|---|---|---|---|
| **DEMO-U001** | Aarav Sharma | Primary Owner | `aarav.sharma@vehiclepassport.dev` | Owns 4 vehicles (`DEMO-V001`, `DEMO-V002`, `DEMO-V006`, `DEMO-V008`). Shows multi-vehicle overview, service records, and passport sheet. |
| **DEMO-U002** | Priya Verma | Recipient / Co-Owner | `priya.verma@vehiclepassport.dev` | Owns 2 active vehicles (`DEMO-V003`, `DEMO-V007`). Demonstrates clean role-based data isolation and previous ownership in transfer history. |
| **DEMO-U003** | Rohan Mehta | Genesis Owner | `rohan.mehta@vehiclepassport.dev` | Owns `DEMO-V004`. Genesis seller of `DEMO-V008` (Orbit M2). |
| **DEMO-U004** | Neha Kapoor | Secondary Owner | `neha.kapoor@vehiclepassport.dev` | Owns `DEMO-V005` (Terra H7 Hybrid). |
| **DEMO-U005** | Kabir Malhotra | **State B: Uninitialized** | `kabir.malhotra@vehiclepassport.dev` | **Explicit State B demo**: Demonstrates uninitialized account lifecycle, lands on `/initialize`, clicks "Initialize Vehicle Passport" to mint on-chain identity. |
| **DEMO-GARAGE**| Apex Certified Garage | Service Provider | `garage@vehiclepassport.dev` | Authorized institutional actor for cryptographic service & odometer logging. |

---

## 🚗 Seeded Fictional Vehicles Overview

| Vehicle ID | Passport ID | Make & Model | Synthetic VIN | Plate Number | Current Owner |
|---|---|---|---|---|---|
| `DEMO-V001` | `VP-DEMO-001` | Aurora X1 Sedan (Petrol) | `DEMOV001X1SEDAN01` | `MH02DM1001` | Aarav Sharma |
| `DEMO-V002` | `VP-DEMO-002` | Falcon E2 Electric Car | `DEMOV002E2ELEC002` | `MH02DM1002` | Aarav Sharma |
| `DEMO-V003` | `VP-DEMO-003` | Summit R5 SUV (Diesel) | `DEMOV003R5SUVD003` | `MH02DM1003` | Priya Verma |
| `DEMO-V004` | `VP-DEMO-004` | Metro C3 Hatchback (Hybrid)| `DEMOV004C3HATCH04` | `DL01DM1004` | Rohan Mehta |
| `DEMO-V005` | `VP-DEMO-005` | Terra H7 Hybrid SUV | `DEMOV005H7HYBRD05` | `MH02DM1005` | Neha Kapoor |
| `DEMO-V006` | `VP-DEMO-006` | Nova S4 Sedan (Petrol) | `DEMOV006S4SEDAN06` | `MH02DM1006` | Aarav Sharma |
| `DEMO-V007` | `VP-DEMO-007` | Volt E5 Electric Car | `DEMOV007E5ELEC007` | `MH02DM1007` | Priya Verma |
| `DEMO-V008` | `VP-DEMO-008` | Orbit M2 Compact (Transferred)| `DEMOV008M2COMP008` | `HR26DM1008` | Aarav Sharma *(Provenance: Rohan &rarr; Priya &rarr; Aarav)* |

---

## 🧪 Running Automated Browser Tests

To execute the headless browser testing suite using Python Playwright:
```bash
# 1. Run the full QA browser verification suite (11 suites, responsive checks)
python3 scripts/run_qa_e2e_tests.py

# 2. Run the 5 academic evaluation demo journeys
python3 scripts/run_demo_e2e_journeys.py
```
*High-resolution browser screenshots and JSON test reports will be generated automatically in `docs/screenshots/qa/`.*

---

## 🛡️ Security & Privacy Architecture Note
- **No Private Keys Committed:** All test wallets utilize Hardhat standard deterministic mnemonic accounts for local development.
- **Selective Disclosure:** Zero knowledge and SHA-256 state commitments ensure sensitive owner contact info is redacted while proving cryptographic authenticity.
- **Tamper Evidence:** Any modification to off-chain records produces an immediate hash mismatch against the smart contract canonical root.

