# BLOCKCHAIN VEHICLE PASSPORT — PRESENTATION DEMONSTRATION FLOW

**Project Name:** Blockchain-Based Digital Vehicle Passport  
**Presenter:** Aditya Singh (VIT Student, Reg: 25BCE5002)  
**Target Audience:** Academic Faculty Evaluation Panel & Technical Auditors  
**Total Allocated Demo Duration:** ~6 to 7 Minutes  
**Primary Vehicle for Demo:** Tata Nexon EV (`VP-000001` / VIN: `MAT612345NEXON001`)  
**Secondary Test Vehicle:** Honda City (`VP-000002` / ICE Comparison)

---

## PRESENTATION STAGE MATRIX

| Step | Section Name | Target Route | Persona / Role | Duration | Key Action & What to Show |
|---|---|---|---|---|---|
| **1** | **Introduction & Problem Statement** | `/` (Landing Page) | Public | 45 sec | Highlight systemic odometer fraud, flood damage concealment, and paper forgery. Point out architecture summary. |
| **2** | **Role-Based Authentication** | `/login` | Test Owner A (Alex Mercer) | 30 sec | Click institutional portal for "Test Owner A (Alex Mercer)". Explain separation of duties (Owner, Garage, Manufacturer, Insurer, Admin). |
| **3** | **Vehicle Passport Dashboard** | `/dashboard` | Vehicle Owner | 45 sec | Display active Tata Nexon EV passport (`VP-000001`), on-chain status `CONFIRMED`, current mileage (38,000 km), and Health Score (99/100). |
| **4** | **Lifecycle Timeline & Event Anchoring** | `/dashboard` (Timeline Tab) | Vehicle Owner | 45 sec | Open chronological timeline. Show genesis birth certificate, garage services, certified repairs, and insurance policy events with cryptographic hashes. |
| **5** | **Cryptographic Verification Audit** | `/dashboard` (Verification Tab) | Vehicle Owner | 45 sec | Click "Run Full Verification". Show live comparison of database SHA-256 state against on-chain smart contract anchor at `0x5FbDB2315678afecb367f032d93F642f64180aa3`. |
| **6** | **Tamper Lab & Live Fraud Detection** | `/tamper-lab` | Authenticated Owner | 60 sec | Click "Rollback Odometer Reading" (38,000 km → 12,000 km). Show immediate state transition to **TAMPER DETECTED** (Red). Then click "Restore Original State" to show recovery. |
| **7** | **Digital Vehicle Twin & Buyer Intelligence** | `/dashboard` (Digital Twin Tab) | Vehicle Owner / Buyer | 45 sec | Demonstrate 5-way ontological breakdown, monotonic odometer progression, service coverage ratio formula, and auto-generated "Questions to Ask Seller". |
| **8** | **Public Verification & PII Protection** | `/verify/VP-000001` | Public Buyer (Unauthenticated) | 45 sec | Open public verification portal. Show that buyer gets cryptographic proof while private owner email, phone, and full VIN are strictly masked (`MAT612345NE****`). |
| **9** | **Blockchain Explorer & Merkle Batches** | `/explorer` & `/explorer/batches` | Public Auditor | 30 sec | Inspect Hardhat EVM live block ledger, contract address, transaction hashes, and Merkle tree batch inclusion proofs. |
| **10** | **Conclusion & Viva Handover** | Dashboard / Presentation Slide | Presenter | 30 sec | Summarize technical contributions, gas optimization via Merkle batches, and invite faculty questions. |

---

## DETAILED STEP-BY-STEP RUNBOOK

### STEP 1: Introduction & Problem Statement
- **Starting URL:** `http://localhost:3000`
- **Click Sequence:**
  1. Open browser at `http://localhost:3000`.
  2. Scroll smoothly through the hero section highlighting the three pillars:
     - *Off-chain structured relational database (PostgreSQL + Prisma)* for high throughput.
     - *On-chain immutable proof anchoring (Solidity Smart Contracts on EVM)* for tamper resistance.
     - *Deterministic Canonical Hashing (SHA-256)* ensuring byte-level consistency.
- **Expected Result:** Landing page renders cleanly with responsive cards, live capability badges, and direct navigation links.
- **Presenter Narration:**
  > "Respected faculty members, used-car buyers and lenders face a massive asymmetry of information: odometers are rolled back in minutes, total-loss accident histories are erased, and paper maintenance booklets are easily forged. Our project, the Blockchain-Based Digital Vehicle Passport, bridges off-chain automotive lifecycles with on-chain cryptographic proofs, guaranteeing mathematical auditability without storing heavy media on the blockchain."

---

### STEP 2: Institutional Stakeholder Portals (RBAC)
- **Starting URL:** `http://localhost:3000/login`
- **Click Sequence:**
  1. Click the "Sign In" button in the top navigation bar.
  2. Under **Authorized Role-Based Portals**, point out the 5 pre-seeded institutional stakeholder roles:
     - *Vehicle Owner* (`Alex Mercer`)
     - *Certified Garage* (`Apex Certified Workshop`)
     - *Manufacturer* (`Nordic Motors / Genesis Factory`)
     - *Insurance Provider* (`SafeShield`)
     - *System Regulator / Admin* (`Platform Administrator`)
  3. Click on the button **Test Owner A (Alex Mercer)**.
- **Expected Result:** Instant authentication via development session token; browser redirects to `http://localhost:3000/dashboard`.
- **Presenter Narration:**
  > "Security begins at authentication. While Google OAuth is fully integrated for real users, we have implemented role-based stakeholder portals. This ensures strict separation of duties: only certified garages can log service records, only manufacturers can issue birth certificates, and vehicle owners cannot fabricate their own odometer histories."

---

### STEP 3: Vehicle Passport & Health Overview
- **Starting URL:** `http://localhost:3000/dashboard`
- **Click Sequence:**
  1. Ensure the active vehicle selected is **Tata Nexon EV** (`VP-000001`).
  2. Review the Passport Header:
     - Passport ID: `VP-000001`
     - VIN: `MAT612345NEXON001`
     - Registration: `MH02EV1001`
     - Powertrain: `ELECTRIC`
     - Blockchain Status: `CONFIRMED`
     - Vehicle Health Score: `99/100` (`EXCELLENT`)
- **Expected Result:** High-level metrics, active smart contract connection, and health breakdown cards are visible.
- **Presenter Narration:**
  > "Here is Alex Mercer's active vehicle passport for his Tata Nexon EV. Notice that the passport ID is permanently mapped to an on-chain registration record. Our system computes a deterministic 0 to 100 Health Score based on 7 weighted pillars: blockchain integrity, odometer monotonicity, service compliance, accident severity, document integrity, insurance continuity, and ownership stability."

---

### STEP 4: Full Lifecycle Chronological Timeline
- **Starting URL:** `http://localhost:3000/dashboard`
- **Click Sequence:**
  1. Click on the **Timeline** tab in the dashboard navigation.
  2. Inspect the sequential events:
     - `FACTORY_DELIVERY` (0 km genesis by Nordic Motors)
     - `INITIAL_REGISTRATION` (Registered to Alex Mercer)
     - `GARAGE_SERVICE` (15,000 km standard maintenance by Apex Certified)
     - `COLLISION_RECORDED` (Front bumper structural repair)
     - `REPAIRED_AND_CERTIFIED` (Authorized garage sign-off)
     - `INSURANCE_POLICY` (SafeShield active policy coverage)
- **Expected Result:** Timeline displays chronologically with individual category badges, actor attributions, and SHA-256 record hashes.
- **Presenter Narration:**
  > "Every single lifecycle milestone is captured as an immutable event. Notice that every event shows the verified actor who signed it—such as the certified garage or insurer—along with its unique SHA-256 canonical hash. This prevents backdating and unrecorded repair gaps."

---

### STEP 5: Live Cryptographic Verification Audit
- **Starting URL:** `http://localhost:3000/dashboard`
- **Click Sequence:**
  1. Click on the **Verification** or **Blockchain Verification** tab.
  2. Click the **Run Full Verification** button.
  3. Inspect the verification grid:
     - Vehicle Identity Proof: `VERIFIED` (Match)
     - Service Records Anchor: `VERIFIED` (Match)
     - Odometer Telemetry: `VERIFIED` (Match)
     - Accident & Repairs: `VERIFIED` (Match)
     - Overall Status: `ALL RECORDS CRYPTOGRAPHICALLY VERIFIED`
- **Expected Result:** Live query executes against Hardhat contract `0x5FbDB2315678afecb367f032d93F642f64180aa3`, re-hashes current database records with canonical JSON, compares against smart contract storage, and renders green checkmarks.
- **Presenter Narration:**
  > "When we click 'Run Verification', the backend fetches the stored record from PostgreSQL, serializes it deterministically using our canonical key-sorted JSON utility, hashes it with SHA-256, and compares it to the cryptographic proof anchored inside the Solidity smart contract. Because no off-chain data has been tampered with, every single category returns VERIFIED."

---

### STEP 6: Tamper Lab — Odometer Fraud Simulation & Detection
- **Starting URL:** `http://localhost:3000/tamper-lab`
- **Click Sequence:**
  1. Click **Tamper Lab** in the top navigation bar.
  2. Verify initial state: `ALL RECORDS CRYPTOGRAPHICALLY VERIFIED` (Green).
  3. Under **Simulate Odometer Rollback**, observe the proposed rollback: 38,000 km rolled back to 12,000 km.
  4. Click the red button: **Rollback Odometer Reading**.
  5. Watch the top banner immediately switch to **TAMPER DETECTED — Cryptographic Mismatch** (Red).
  6. Point to the audit breakdown:
     - Database Hash: mutated
     - On-Chain Anchor: immutable historical proof
     - Rollback Detected: `YES`
  7. Click the green button: **Restore Original State / Remediate Database**.
  8. Watch the system immediately return to **ALL RECORDS CRYPTOGRAPHICALLY VERIFIED** (Green).
- **Expected Result:** Demonstrates real-time tamper evidence and rollback detection.
- **Presenter Narration:**
  > "This is our Tamper Lab. Let us simulate what happens when a corrupt actor gains unauthorized write access to the PostgreSQL database and rolls back the odometer from 38,000 km to 12,000 km. [Click Rollback]. Notice how the system immediately flags TAMPER DETECTED. The database record changed, but the smart contract proof is immutable. When we click 'Restore Original State' [Click Restore], the authoritative cryptographic state is restored."

---

### STEP 7: Digital Vehicle Twin & Used-Car Buyer Intelligence
- **Starting URL:** `http://localhost:3000/dashboard`
- **Click Sequence:**
  1. Return to `/dashboard` and click the **Digital Twin** tab.
  2. Review the **5-Way Ontological State Breakdown**:
     - *Physical Vehicle:* Inferred asset (software disclaims direct physical observation).
     - *Recorded History:* 100% auditable ground truth from database.
     - *Verified Claims:* Cryptographic anchors and Merkle batch commitments.
     - *Derived State:* Monotonic progression and mathematically computed service coverage.
     - *Simulated State:* What-if scenario analysis.
  3. Scroll to **Used-Car Buyer Intelligence Report**:
     - Trust Badge: `VERIFIED`
     - Service Coverage: `100%` (Formula: actual services / expected based on age and mileage).
     - Transparent "What is Verified" vs. "What is Unknown" checklists.
     - "Questions to Ask the Seller" generated objectively from data gaps.
- **Expected Result:** Demonstrates academic rigor in knowledge representation and consumer empowerment.
- **Presenter Narration:**
  > "In Phase 10, we developed the Autonomous Digital Vehicle Twin. Instead of claiming false IoT telemetry, our architecture uses a 5-Way Ontological ontology that explicitly separates physical reality, recorded history, cryptographic proofs, derived scores, and simulated what-if projections. For prospective used-car buyers, it generates transparent due-diligence checklists and evidence-bounded questions without making ungrounded accusations."

---

### STEP 8: Public Verification & Strict PII Masking
- **Starting URL:** `http://localhost:3000/verify/VP-000001`
- **Click Sequence:**
  1. In a new tab (or unauthenticated window), open `http://localhost:3000/verify/VP-000001`.
  2. Show that NO login is required to verify any passport via QR code or public portal.
  3. Highlight strict privacy preservation:
     - Owner Name: Redacted / hidden
     - Owner Email & Phone: Omitted entirely
     - Registration Number: Masked as `MH02****1001`
     - VIN: Masked as `MAT612345NE****`
     - Database internal UUIDs: Omitted
  4. Show that despite masking, the cryptographic verification badge confirms `VERIFIED` on-chain.
- **Expected Result:** Public verification functions with enterprise-grade privacy protection complying with DPDP and GDPR guidelines.
- **Presenter Narration:**
  > "Anyone scanning the QR code on a vehicle's windshield lands on this public verification page without needing an account. However, to comply with privacy laws, no Personally Identifiable Information is leaked: the owner's identity is completely masked, yet the vehicle's integrity, accident history, and blockchain proof remain 100% verifiable."

---

### STEP 9: Blockchain Explorer & Merkle Batch Anchoring
- **Starting URL:** `http://localhost:3000/explorer`
- **Click Sequence:**
  1. Click **Explorer** in the top navigation bar.
  2. Inspect live network parameters:
     - Network: `Hardhat Local EVM` (Chain ID `31337`)
     - Smart Contract: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
     - Total Confirmed Anchors: `40+`
  3. Search `VP-000001` in the transaction filter.
  4. Click on **Merkle Batches** (`/explorer/batches`).
  5. Show how multiple lifecycle events are aggregated into a single Merkle Tree root, cutting gas costs by over 95%.
- **Expected Result:** Live block numbers and on-chain receipts demonstrate a fully functional EVM deployment.
- **Presenter Narration:**
  > "Finally, our Blockchain Explorer allows anyone to audit the underlying ledger. Rather than making a separate blockchain transaction for every single oil change—which would be prohibitively expensive on public networks—our Phase 6 Merkle Batch Engine aggregates records into cryptographic trees, anchoring only the Merkle root on-chain and verifying inclusion via cryptographic sibling proofs."

---

### STEP 10: Conclusion & Viva Handover
- **Summary:**
  - Full-stack production-grade architecture combining Next.js 14, Express, PostgreSQL Prisma, and Solidity EVM.
  - 10 complete implementation phases verified with automated end-to-end regression suites.
  - Zero hardcoded mock results; live cryptographic math running in real time.
- **Presenter Final Remark:**
  > "In conclusion, our Blockchain-Based Digital Vehicle Passport transforms automotive history from fragmented, forgeable paper receipts into an immutable, mathematically verifiable digital asset. Thank you, and I look forward to your questions."
