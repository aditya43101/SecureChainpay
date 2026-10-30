# DEMO DATA PLAN: BLOCKCHAIN VEHICLE PASSPORT
## Comprehensive Plan for Demo Dataset, Seeded Personas, Lifecycle Provenance & Live Blockchain Verification

**Author:** Senior Blockchain Engineer, Full-Stack Developer & Database Architect  
**Project:** Blockchain Vehicle Passport  
**Date:** October 29, 2026  
**Status:** PROPOSED & READY FOR APPROVAL  

---

## 1. Existing System Architecture & Schema Compatibility

Before adding or mutating any demonstration data, we analyzed the existing technology stack and database schema across all system layers:

```
+--------------------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER (Next.js 14)                                |
|   /dashboard (Vehicle Passports, Multi-Vehicle Grid, Overview, Timeline, Lifecycle, QR Codes)   |
|   /verify/[passportId] (Public Zero-Knowledge Verification Portal with PII Masking)              |
|   /explorer & /explorer/batches (Public Blockchain Ledger & Merkle Proof Visualizer)             |
|   /login (Google Sign-In, Direct Identity Auth, Seed Persona Portals)                            |
|   /initialize (Explicit Blockchain Identity Onboarding Action Screen)                             |
|   /onboarding (Option 1: Add Vehicle Now vs Option 2: Continue Without Vehicle)                  |
|   /tamper-lab (Interactive Odometer Rollback Simulation & Hash Mismatch Recovery)               |
+--------------------------------------------------------------------------------------------------+
                                                 |
                       +-------------------------+-------------------------+
                       |                                                   |
                       v                                                   v
         [LOCAL DEV BROWSER PATH]                                [EXPRESS BACKEND PATH]
       Next.js API (/app/api/*)                                Express Server (:5001)
     In-Memory / JSON Cache Store                           Prisma ORM & PostgreSQL DB
  (For standalone Vercel / Cloud Demo)                   (Local Development / Production)
                       |                                                   |
                       +-------------------------+-------------------------+
                                                 |
                                                 v
                                    [BLOCKCHAIN EVM LAYER]
                             Hardhat Node (Chain ID: 31337 / :8545)
                    Smart Contract: VehiclePassport.sol (0x5FbDB231...aa3)
                    Smart Contract: PrivacyVerifier.sol (0xc3e53F4d...690)
```

### Representation in Current Architecture:
1. **User Profiles (`User` Model in PostgreSQL & `serverStore.ts`)**:
   - `id`: Unique UUID (e.g. `demo-user-aarav-001`).
   - `firebaseUid`: Distinct synthetic UID (`demo-uid-aarav-001`).
   - `email`: Normalized unique demo email (`aarav.sharma@vehiclepassport.dev`).
   - `role`: Prisma enum `UserRole.VEHICLE_OWNER` (or `GARAGE`, `ADMIN`, etc.).
   - `isInitialized`: Boolean flag (`true` for State A pre-seeded users; `false` for State B new user).
   - `onboardingStatus`: `COMPLETED_WITH_VEHICLE`, `COMPLETED_WITHOUT_VEHICLE`, or `NOT_STARTED`.
   - `blockchainUserId`: Sequential deterministic ID (`USR-000010`, etc.).
   - `blockchainAddress`: Hardhat EVM deterministic account address (e.g. `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`).
   - `blockchainTxHash`: Verified on-chain transaction hash from smart contract `initializeUser()`.

2. **Vehicle Entities (`Vehicle` Model)**:
   - `passportId`: Unique passport identifier with format `VP-000101` to `VP-000108`.
   - `vin`: Exactly 17 uppercase alphanumeric characters adhering to ISO 3779 (no letters I, O, Q), prefixed with `DEMO` (e.g. `DEMOV001X1SEDAN01`).
   - `registrationNumber`: Unique synthetic plate number (e.g. `MH02DM1001`).
   - `currentOwnerId`: Foreign key to `User.id`.
   - `blockchainVehicleId`: Sequential ID (`VEH-000101`, etc.).
   - `blockchainStatus`: `CONFIRMED`.
   - `blockchainTxHash`: Verified transaction hash from smart contract `registerVehicle()`.

3. **Ownership History (`OwnershipHistory` Model)**:
   - `vehicleId`: Target vehicle UUID.
   - `previousOwnerId` / `newOwnerId`: Foreign keys to `User.id`.
   - `transferType`: `SALE` or `TRANSFER`.
   - `recordHash`: SHA-256 canonical hash of transfer deed.
   - `blockchainRecordId`: Canonical ID (`REC-000101`, etc.).
   - `blockchainTxHash`: Real transaction receipt hash from smart contract `transferVehicleOwnership()`.

4. **Service & Odometer Records (`ServiceRecord`, `OdometerRecord` Models)**:
   - Canonical proof hashing via `generateServiceRecordHash()` and `generateOdometerRecordHash()`.
   - On-chain proof committed via `anchorRecord(recordId, vehicleId, "SERVICE", recordHash)` on `VehiclePassport.sol`.

---

## 2. Five Demo User Personas

| Demo ID | Fictional Name | Email / Auth Identifier | Role | Initial State | Target On-Chain Address | Initial Vehicles |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEMO-U001** | **Aarav Sharma** | `aarav.sharma@vehiclepassport.dev` | `VEHICLE_OWNER` | **State A** (Pre-seeded, Initialized) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (Hardhat #1) | `DEMO-V001`, `DEMO-V002`, `DEMO-V008` (transferred later) |
| **DEMO-U002** | **Priya Verma** | `priya.verma@vehiclepassport.dev` | `VEHICLE_OWNER` | **State A** (Pre-seeded, Initialized) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (Hardhat #2) | `DEMO-V003` |
| **DEMO-U003** | **Rohan Mehta** | `rohan.mehta@vehiclepassport.dev` | `VEHICLE_OWNER` | **State A** (Pre-seeded, Initialized) | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` (Hardhat #4) | `DEMO-V004`, `DEMO-V008` (Genesis owner) |
| **DEMO-U004** | **Neha Kapoor** | `neha.kapoor@vehiclepassport.dev` | `VEHICLE_OWNER` | **State A** (Pre-seeded, Initialized) | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` (Hardhat #5) | `DEMO-V005`, `DEMO-V006`, `DEMO-V007` |
| **DEMO-U005** | **Kabir Malhotra** | `kabir.malhotra@vehiclepassport.dev` | `VEHICLE_OWNER` | **State B** (New, Uninitialized) | *None* (`null` until user action) | `0` (Clean empty state) |

### Demonstration States:
- **State A (Pre-seeded Users):** Aarav, Priya, Rohan, and Neha are pre-seeded in the database and anchored on the local smart contract. Upon signing in, their blockchain identity is immediately recognized, existing vehicles appear on their dashboards, and no duplicate registration is requested.
- **State B (New User Lifecycle):** Kabir Malhotra is registered in the database with `isInitialized: false`, `blockchainUserId: null`, and `onboardingStatus: NOT_STARTED`. Upon login, the application redirects to `/initialize` displaying the explicit action **"Initialize Vehicle Passport"**. Only after clicking this button does the EVM transaction execute, initializing Kabir on-chain and unlocking vehicle registration.

---

## 3. Eight Fictional Vehicles Specification

| Demo ID | Display Model | Manufacturer | Year | Fuel Type | Synthetic VIN | Registration No. | Initial Owner | Key Lifecycle Scenarios |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **DEMO-V001** | Aurora X1 Sedan | Aurora Motors | 2024 | `PETROL` | `DEMOV001X1SEDAN01` | `MH02DM1001` | Aarav Sharma | Initial registration, routine maintenance, brake inspection |
| **DEMO-V002** | Falcon E2 Electric Car | Falcon Dynamics | 2024 | `ELECTRIC` | `DEMOV002E2ELEC002` | `MH02DM1002` | Aarav Sharma | Multi-vehicle ownership proof, battery health check |
| **DEMO-V003** | Summit R5 SUV | Summit Auto | 2023 | `DIESEL` | `DEMOV003R5SUVD003` | `MH02DM1003` | Priya Verma | Recipient verification, private record isolation |
| **DEMO-V004** | Metro C3 Hatchback | Metro City Car | 2022 | `HYBRID` | `DEMOV004C3HATCH04` | `MH02DM1004` | Rohan Mehta | Urban fleet provenance, verified odometer |
| **DEMO-V005** | Terra H7 Hybrid SUV | Terra Automotive | 2024 | `HYBRID` | `DEMOV005H7HYBRD05` | `MH02DM1005` | Neha Kapoor | High-end SUV with manufacturer birth certificate |
| **DEMO-V006** | Nova S4 Sedan | Nova Engineering | 2023 | `PETROL` | `DEMOV006S4SEDAN06` | `MH02DM1006` | Neha Kapoor | Complete garage service history & oil service |
| **DEMO-V007** | Volt E5 Electric Car | Volt Mobility | 2024 | `ELECTRIC` | `DEMOV007E5ELEC007` | `MH02DM1007` | Neha Kapoor | EV charging diagnostics, high-voltage battery passport |
| **DEMO-V008** | Orbit M2 Compact Car | Orbit Motors | 2023 | `PETROL` | `DEMOV008M2COMP008` | `MH02DM1008` | Rohan Mehta | **Sequential Ownership Transfer:** Rohan &rarr; Priya &rarr; Aarav |

---

## 4. Multi-Vehicle per User Topology

The schema natively supports a one-to-many relationship (`User.vehicles: Vehicle[]`). The demo dataset clearly illustrates:
1. **Aarav Sharma owns 2 vehicles initially:** `DEMO-V001` (Aurora X1) and `DEMO-V002` (Falcon E2). After the transfer demonstration, Aarav gains ownership of `DEMO-V008`, totaling 3 vehicles.
2. **Neha Kapoor owns 3 vehicles:** `DEMO-V005` (Terra H7), `DEMO-V006` (Nova S4), and `DEMO-V007` (Volt E5).
3. **Priya Verma owns 1 vehicle initially:** `DEMO-V003` (Summit R5), and holds temporary custody of `DEMO-V008` during sequential transfer testing.
4. **Rohan Mehta owns 2 vehicles initially:** `DEMO-V004` (Metro C3) and `DEMO-V008` (Orbit M2).
5. **Kabir Malhotra owns 0 vehicles:** Demonstrating a clean empty dashboard for new users.

---

## 5. Realistic Historical Ownership Transitions (DEMO-V008)

To demonstrate multi-party custody tracking with immutable blockchain provenance, `DEMO-V008` (Orbit M2 Compact Car) undergoes an authentic sequential transfer:

```
[Genesis Registration] -> Owner: Rohan Mehta (Hardhat #4)
           |
           v (Transfer 1: Sale deed anchored on smart contract)
[Custody Transfer 1]  -> Owner: Priya Verma (Hardhat #2)
           |
           v (Transfer 2: Certified resale anchored on smart contract)
[Custody Transfer 2]  -> Final Owner: Aarav Sharma (Hardhat #1)
```

### On-Chain Execution Details for Each Transition:
- **Contract Function:** `VehiclePassport.transferVehicleOwnership(vehicleId, toOwnerAddress, transferRecordHash, recordId)`
- **Event Emitted:** `event VehicleOwnershipTransferred(string indexed blockchainVehicleId, address indexed previousOwner, address indexed newOwner, bytes32 transferRecordHash, uint256 timestamp)`
- **Record Anchor:** An associated lifecycle record of type `OWNERSHIP_TRANSFERRED` is simultaneously anchored.
- **Verification Guarantee:** When inspecting Aarav's dashboard for `DEMO-V008`, the historical ownership timeline displays the complete unbroken chain: Rohan &rarr; Priya &rarr; Aarav, including confirmed block numbers and transaction hashes.

---

## 6. Service and Maintenance History (Cryptographically Anchored)

Synthetic maintenance events will be generated with exact canonical hashing (`generateServiceRecordHash` and `generateOdometerRecordHash`) and anchored on the blockchain:

1. **DEMO-V001 (Aurora X1 Sedan):**
   - *Genesis Registration:* Odometer: 0 km.
   - *Routine Maintenance (10,000 km):* Certified engine oil service, pollen filter replacement. Garage: Apex Certified Garage.
   - *Brake Inspection (22,500 km):* Front brake disc pads inspection and brake fluid flush.
2. **DEMO-V002 (Falcon E2 Electric Car):**
   - *Genesis Registration:* Odometer: 0 km.
   - *EV Periodic Inspection (15,000 km):* High-voltage battery pack diagnostics (State of Health: 99.2%), cell balancing check.
   - *Electrical & Inverter Diagnostics (30,000 km):* Regenerative braking calibration, motor cooling circuit inspection.
3. **DEMO-V006 (Nova S4 Sedan):**
   - *Genesis Registration:* Odometer: 0 km.
   - *Routine Periodic Service (15,000 km):* Synthetic motor oil replacement, multipoint safety check.
   - *Major Inspection (35,000 km):* Spark plugs replacement, transmission fluid check.
4. **DEMO-V007 (Volt E5 Electric Car):**
   - *Genesis Registration:* Odometer: 0 km.
   - *Battery Cell State Diagnostics (12,000 km):* High-voltage thermal management test, fast-charging curve validation.
   - *Annual Safety & Software Audit (25,000 km):* Firmware version verification, suspension torque inspection.

---

## 7. Dual-Layer Synchronization (Database + Blockchain + Mock Store)

To ensure that both the **production Express/PostgreSQL/Hardhat backend (:5001)** AND the **standalone Next.js frontend server (:3000)** showcase identical demo data without discrepancies:
1. `backend/prisma/seed_demo.ts` will seed the PostgreSQL database and execute real transactions on the live Hardhat node (`http://127.0.0.1:8545`).
2. `frontend/src/lib/serverStore.ts` will be updated to include the exact matching demo personas and vehicles in its initial in-memory and disk cache fallback.
3. A bug discovered during our browser audit in `frontend/src/app/onboarding/page.tsx` (where `completeOnboardingWithVehicle()` was not called after vehicle registration, preventing state transition to the dashboard) will be safely resolved.

---

## 8. Verification Strategy & Deliverables

1. **Seeding Script (`npm run seed:demo`):** Safe, idempotent script that checks network chain ID, avoids overwriting production records, upserts demo users and vehicles, and anchors real cryptographic hashes on the smart contract.
2. **Verification Script (`npm run verify:demo`):** Validates database referential integrity, queries the live contract directly to verify owners and hashes, and outputs a structured pass/fail table.
3. **Browser E2E Automated Tests (`scripts/run_qa_e2e_tests.py`):** Playwright automated suite executing the 5 requested demo journeys (Aarav's multi-vehicle dashboard, Priya's isolated dashboard, Kabir's uninitialized-to-initialized journey, DEMO-V008 transfer flow, and Tamper-Lab detection).
4. **Academic Documentation:**
   - `DEMO_DATA_PLAN.md` (this architecture plan)
   - `DEMO_SETUP.md` (step-by-step setup and execution guide)
   - `DEMO_VERIFICATION_REPORT.md` (empirical results and proof ledger)
   - 5-Minute Professor Demonstration Script.

---

## 9. Request for Approval

In accordance with Section 2 Safety Rules:
- No production data will be altered.
- No real personal information or real VINs will be used.
- All actions will execute against the local development PostgreSQL database and local Hardhat Ethereum node (`http://127.0.0.1:8545`).
- The existing smart contract at `0x5FbDB2315678afecb367f032d93F642f64180aa3` will be used without redeploying.

**Awaiting your approval to proceed with implementing `seed_demo.ts`, `verify_demo_dataset.ts`, dual-layer synchronization, and executing the live verification.**

