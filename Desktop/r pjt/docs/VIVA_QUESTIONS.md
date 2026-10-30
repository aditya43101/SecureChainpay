# FACULTY VIVA QUESTIONS & EXPERT ANSWERS
## Blockchain-Based Digital Vehicle Passport & Lifecycle Verification Ledger

**Project:** Blockchain-Based Digital Vehicle Passport  
**Author:** Aditya Singh (25BCE5002)  
**Preparation:** 18 Critical Academic & Technical Examination Questions

---

### Q1: Why do we need a blockchain for vehicle records? Couldn't a standard centralized database with backups solve this problem?
**Answer:**
A centralized database—even with cryptographic signatures and off-site backups—is controlled by a single administrative entity. An insider with database administrator privileges, a corrupt employee at a regional transport office, or an attacker with SQL injection access can alter records, drop rows, or backdate entries without detection. 

Blockchain provides **distributed, decentralized immutability**. By committing cryptographic hashes of vehicle lifecycle milestones to an EVM smart contract, no single party—including ourselves, the platform developers, or database administrators—can rewrite history without causing a mathematical mismatch with the immutable ledger.

---

### Q2: What is the role of SHA-256 in your architecture, and does the hash store the vehicle data?
**Answer:**
SHA-256 is a one-way cryptographic hash function that produces a unique 256-bit (32-byte) digest from arbitrary input data. 

Critically: **A hash does NOT store or compress the original vehicle data**. It is mathematically impossible to reconstruct the vehicle's make, model, or odometer reading from the hash alone. Instead, the hash acts as an **immutable digital fingerprint**. If even a single character in the vehicle record changes—such as modifying an odometer reading from 38,000 to 12,000—the output hash changes unpredictably (known as the *avalanche effect*), instantly exposing off-chain tampering.

---

### Q3: What is "Canonical JSON Serialization", and why is it mandatory for blockchain hashing?
**Answer:**
In JavaScript and standard JSON, object keys have no guaranteed order. For example:
- `{"mileage": 15000, "date": "2024-01-01"}`
- `{"date": "2024-01-01", "mileage": 15000}`

These two JSON strings represent the exact same logical data, but because their serialized byte sequences differ, standard SHA-256 would generate completely different hashes, causing false tamper alarms. 

Our canonical hashing utility (`canonicalHash.ts`) deterministically sorts all object keys alphabetically, removes non-deterministic whitespace, and normalizes date formats before hashing. This guarantees that any client or backend node re-hashing the same logical record will arrive at the exact same 32-byte hash.

---

### Q4: Why don't you store images, PDF invoices, and full vehicle metadata directly on the blockchain?
**Answer:**
Storing large data directly on Ethereum or any EVM blockchain is economically unviable and technically flawed:
1. **Gas Cost:** Storing 1 megabyte of data on Ethereum mainnet costs thousands of dollars in gas.
2. **Blockchain Bloat:** Storing media forces every validating node in the network to download and store that data forever.
3. **Privacy:** Everything stored on a public blockchain is permanently visible to the entire world, which would violate privacy laws (such as India's DPDP Act and the EU's GDPR).

Therefore, our architecture uses a **hybrid design**: high-volume structured records and files reside off-chain in PostgreSQL and local/IPFS storage, while only the 32-byte cryptographic hashes are anchored on-chain.

---

### Q5: How does your system detect odometer rollbacks in real time?
**Answer:**
We implement a dual-layer defense:
1. **Cryptographic Layer:** The off-chain database record is re-hashed using our canonical algorithm and compared against the immutable hash stored in the Solidity smart contract. If an attacker updates the database value directly, the hashes desynchronize, immediately flipping the status to `TAMPER DETECTED`.
2. **Algorithmic Anomaly Engine:** Even if someone attempts to insert a new reading through the API, our backend enforces **monotonic progression** ($\text{Mileage}_{t} \ge \text{Mileage}_{t-1}$) and checks daily velocity thresholds ($\le 1,200\text{ km/day}$). Any decreasing mileage without a certified odometer replacement certificate is rejected or flagged as high-risk fraud.

---

### Q6: What smart contract methods did you write, and what data structures did you use in Solidity?
**Answer:**
Our core contract `VehiclePassport.sol` uses Solidity `^0.8.24` and OpenZeppelin's `Ownable.sol`. Key structures include:
- `UserRecord`: Tracks user reference hashes, wallet addresses, and institutional roles.
- `VehicleRecordProof`: Maps a unique `passportId` to its root metadata hash, owner address, creation timestamp, and active status.
- `LifecycleRecordProof`: Maps a record ID to its vehicle ID, record type (`SERVICE`, `ODOMETER`, `ACCIDENT`, `INSURANCE`), and canonical SHA-256 hash.
- `MerkleBatchProof`: Records batch roots, leaf counts, and submission timestamps.

Key methods include `registerVehicle()`, `anchorRecord()`, `transferVehicleOwnership()`, `anchorBatchRoot()`, and `verifyInclusionProof()`.

---

### Q7: What is Merkle Batch Anchoring (Phase 6), and what are its mathematical advantages?
**Answer:**
If a vehicle fleet generates 10,000 service and odometer events daily, sending 10,000 separate blockchain transactions incurs significant transaction latency and high gas costs.

With Merkle batching, our `merkleService.ts` aggregates hundreds of records into a binary Merkle tree. Each leaf is the hash of an individual record. We pair adjacent hashes, hash them together, and repeat until arriving at a single 32-byte **Merkle Root**. 
- Only the single Merkle Root is submitted to the smart contract in one transaction.
- When an individual record needs verification, the client presents an **inclusion proof** consisting of $\log_2(N)$ sibling hashes.
- The smart contract verifies the proof in $O(\log N)$ time, cutting transaction gas costs by over 95%.

---

### Q8: How does your project protect user privacy during public verification?
**Answer:**
Under the Digital Personal Data Protection (DPDP) Act and GDPR, vehicle registration certificates contain sensitive PII (Personally Identifiable Information), including the owner's full legal name, home address, and contact number.

Our public verification endpoint (`GET /api/public/passport/:passportId`) strictly sanitizes all responses:
- The owner's identity is completely stripped.
- Firebase UIDs, emails, phone numbers, and database internal UUIDs are omitted.
- The license plate is masked (e.g. `MH02****1001`).
- The chassis VIN is masked (e.g. `MAT612345NE****`).
- Prospective used-car buyers receive mathematical proof that the vehicle is authentic and un-tampered without learning the personal identity of the seller.

---

### Q9: What is the "Digital Vehicle Twin" (Phase 10), and why is it not merely a 3D model?
**Answer:**
In automotive engineering and computer science, a Digital Twin is an evolving, authoritative software projection of a physical asset's current state and historical lineage. 

Our Digital Twin adheres to a **5-Way Ontological State Breakdown**:
1. *Physical Reality:* The physical vehicle in the real world (explicitly disclaimed as not directly observed by software).
2. *Recorded History:* The authoritative timeline of service invoices, odometer readings, and insurance claims.
3. *Verified Claims:* Cryptographic anchors and on-chain Merkle commitments.
4. *Derived Digital State:* Deterministically calculated health scores, maintenance schedules, and risk flags.
5. *Simulated Future State:* What-if scenario modeling for predictive maintenance and battery degradation.

---

### Q10: How does your role-based access control (RBAC) prevent unauthorized parties from logging fake services?
**Answer:**
RBAC is enforced on the backend via Express middleware (`auth.ts`), independent of frontend UI state. When a user authenticates, their token encodes their assigned `UserRole`:
- `VEHICLE_OWNER` can only manage their own vehicles and initiate ownership transfers.
- `GARAGE` is exclusively authorized to create and sign service and maintenance records.
- `MANUFACTURER` is exclusively authorized to issue the genesis birth certificate.
- `INSURANCE_PROVIDER` is exclusively authorized to file and verify accident claims.
- `ADMIN` manages system health and audit investigations.

If an owner attempts to call `POST /api/vehicles/:id/service`, the backend rejects the request with `HTTP 403 Forbidden`.

---

### Q11: What is the "Garbage-In, Garbage-Out" problem, and how does your project address it?
**Answer:**
A fundamental principle of blockchain systems is that a blockchain guarantees **tamper evidence**, not **ground truth**. If a fraudulent mechanic intentionally enters an incorrect odometer value, the blockchain will faithfully and immutably record that lie.

Our project mitigates this through multiple defenses:
1. **Stakeholder Identity Attribution:** Every record is permanently linked to the authenticated technician or garage wallet address, establishing legal accountability.
2. **Cross-Entity Consistency Rules (Phase 7 Fraud Graph):** Our Rules Engine cross-examines document OCR data against database entries, flags duplicate invoices across different vehicles, and detects chronological contradictions.
3. **Document OCR Auditing:** We extract text from uploaded PDF invoices and verify that invoice dates and vehicle VINs match the database claims before anchoring.

---

### Q12: How is ownership transferred between two users on your platform?
**Answer:**
Ownership transfer is an atomic lifecycle operation:
1. The current owner initiates a transfer to the buyer's registered blockchain identity or email.
2. The backend calls the smart contract method `transferVehicleOwnership(blockchainVehicleId, newOwnerAddress)`.
3. Once the EVM transaction is confirmed in a block, the PostgreSQL database updates `currentOwnerId` to the new owner in the same transaction boundary.
4. An immutable `OwnershipHistory` record is created recording the previous owner, new owner, timestamp, and on-chain transaction hash. The complete chain of title remains preserved forever.

---

### Q13: Explain your Vehicle Health Score formula (Phase 2).
**Answer:**
The Vehicle Health Score is a deterministic 0 to 100 rating based on seven weighted pillars:
1. **Blockchain Cryptographic Integrity (25%):** Penalized 100% if any on-chain hash desynchronization is detected.
2. **Odometer Telemetry & Monotonicity (20%):** Deductions for rollbacks, abnormal daily mileage jumps, or extended reporting gaps.
3. **Garage Service Compliance (18%):** Compares actual completed services against expected services based on age and mileage.
4. **Accident & Repair History (15%):** Penalties scaled by collision severity and whether certified repairs were completed.
5. **Document OCR Consistency (10%):** Validates that uploaded RC books and invoices match recorded database fields.
6. **Insurance Continuity (7%):** Checks for lapsed coverage or active un-repaired claims.
7. **Ownership Stability (5%):** Rewards long-term single ownership versus rapid commercial flipping.

---

### Q14: What is the difference between Hardhat local network and a public testnet/mainnet?
**Answer:**
In our development and demonstration environment, we run a local **Hardhat EVM Node** on `http://127.0.0.1:8545` with Chain ID `31337`. 
- It provides instant mining, deterministic accounts with 10,000 test ETH, and zero financial cost, which is ideal for offline academic evaluation.
- Because our smart contracts are standard Solidity code compiled with `@nomicfoundation/hardhat-toolbox`, the exact same compiled bytecodes can be deployed to public Ethereum testnets (such as Sepolia) or production Layer-2 networks (such as Polygon PoS or Arbitrum) simply by updating the RPC URL and private key in `.env`.

---

### Q15: How do Zero-Knowledge Proofs (ZKP) apply to your vehicle passport (Phase 9)?
**Answer:**
In traditional systems, if a buyer wants to verify that a car has driven less than 50,000 kilometers, the owner must reveal the exact odometer reading (e.g. 42,318 km). 

In Phase 9, we implemented **Pedersen Commitments and Non-Interactive Zero-Knowledge (NIZK) Range Proofs**:
- The owner commits to their private mileage using an elliptic curve commitment ($C = vG + rH$).
- The owner generates a cryptographic range proof demonstrating that $v \le 50,000$ without revealing $v$ or the blinding factor $r$.
- A lender or insurance company verifies the proof mathematically without learning the vehicle's exact driving habit or mileage.

---

### Q16: What database engine and ORM are used, and how do you handle migrations?
**Answer:**
We use **PostgreSQL 14** as our primary relational database, interfaced through **Prisma ORM (version 6.4.1)**.
- Prisma provides compile-time type safety: every query in TypeScript is strictly typed against our 35 relational models and 17 enums.
- Database migrations are managed via Prisma schema definitions (`schema.prisma`), ensuring foreign key integrity, cascade constraints, and indexed lookups on VINs, passport IDs, and blockchain transaction hashes.

---

### Q17: What are the main real-world challenges to deploying this system nationwide?
**Answer:**
1. **Legacy Data Migration:** Millions of older vehicles have fragmented paper records that cannot be retroactively verified with 100% certainty.
2. **Standardization:** Commercial repair shops, dealerships, and authorized service centers use competing DMS (Dealer Management Systems) requiring API adapters.
3. **Hardware Trust:** Preventing odometer tampering at the vehicle instrument cluster requires hardware cryptographic secure elements (e.g. HSM chips) connected to vehicle CAN buses.

---

### Q18: What are your key future enhancements?
**Answer:**
1. **IoT Hardware Integration:** Interfacing real OBD-II telemetry dongles with signed hardware attestation.
2. **Layer-2 Rollup Deployment:** Migrating from local Hardhat to Polygon or Base for cheap, scalable public anchoring.
3. **Decentralized Storage:** Connecting the local document storage abstraction directly to Filecoin / IPFS for decentralized media persistence.
4. **Self-Sovereign Identity (SSI):** Exporting vehicle passports as W3C Verifiable Credentials compatible with digital identity wallets.
