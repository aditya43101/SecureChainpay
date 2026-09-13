# SecureChain Pay - Firestore Architecture & Collections Reference

This document provides the authoritative reference for the code-level Cloud Firestore collections, subcollections, document paths, and data contracts used throughout the SecureChain Pay ecosystem.

---

## 1. Core Architecture Overview

SecureChain Pay uses a **Hybrid Cloud & Blockchain State Model**:
- **Non-Custodial Client Storage**: Private keys are generated locally via `ethers.Wallet.createRandom()`, AES-GCM encrypted in memory using a client secret derived from the user's UID, and stored in Firestore under strict read-only rules for the client.
- **Authoritative Server Provisioning**: Client direct writes to sensitive collections are prohibited in `firestore.rules`. All wallet provisioning, balance transitions, block appendages, and audit entries are performed via authenticated server endpoints utilizing the **Firebase Admin SDK**.

---

## 2. User & Identity Collections

### A. `users/{uid}`
Represents the primary user profile record.
- **Document Path**: `users/{uid}`
- **Access Rule**: Owner can read; non-sensitive fields updatable by client; sensitive fields protected.
- **Fields**:
  ```json
  {
    "username": "aditya",
    "displayName": "Aditya Singh",
    "name": "Aditya Singh",
    "email": "user@example.com",
    "phoneNumber": "+1234567890",
    "walletAddress": "0x1234...5678",
    "accountTier": "Tier 1",
    "role": "USER",
    "createdAt": "2026-09-13T10:00:00.000Z",
    "updatedAt": "2026-09-13T10:00:00.000Z"
  }
  ```

### B. `usernames/{username}`
Unique username reservation and collision prevention registry.
- **Document Path**: `usernames/{username.toLowerCase()}`
- **Access Rule**: Public read; create only if authenticated and claimed for owner's UID.
- **Fields**:
  ```json
  {
    "uid": "USER_FIREBASE_UID"
  }
  ```

---

## 3. Non-Custodial Wallet & Ledger Subcollections

### A. `users/{uid}/wallet/data`
Authoritative non-custodial wallet cryptographic parameters and ledger balances.
- **Document Path**: `users/{uid}/wallet/data`
- **Access Rule**: Owner read-only. Server Admin SDK write-only. Direct client writes forbidden.
- **Fields**:
  ```json
  {
    "ownerUid": "USER_FIREBASE_UID",
    "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "publicKey": "0x04...",
    "encryptedPrivateKey": "{\"iv\":\"...\",\"data\":\"...\",\"salt\":\"...\"}",
    "keyGeneratedAt": "2026-09-13T10:00:00.000Z",
    "algorithm": "ECDSA/secp256k1",
    "walletVersion": "1.0",
    "keyFingerprint": "a1b2c3d4e5f67890",
    "balances": {
      "HSCT": 1000.00,
      "USD": 11.97,
      "BTC": 0.05,
      "ETH": 0.85,
      "SOL": 4.50,
      "BNB": 1.20,
      "ADA": 150.00,
      "lifetimeDeposited": 1000.00
    },
    "lastBlockNumber": 42,
    "lastBlockHash": "0xabc...def"
  }
  ```

### B. `users/{uid}/transactions/{txId}`
User-specific transaction receipts and cryptographic transfer history.
- **Document Path**: `users/{uid}/transactions/{txId}`
- **Access Rule**: Owner read-only. Written atomically by server execution service.
- **Fields**:
  ```json
  {
    "id": "TX_1789240000000_ABCDE",
    "applicationTransactionId": "TX_1789240000000_ABCDE",
    "userId": "USER_FIREBASE_UID",
    "sender": "0xSenderAddress...",
    "receiver": "0xReceiverAddress...",
    "receiverUsername": "rahul",
    "receiverDisplayName": "Rahul Sharma",
    "amount": 50.00,
    "currency": "HSCT",
    "asset": "HSCT",
    "type": "TRANSFER",
    "status": "confirmed",
    "canonicalPayload": "appId:...|sender:...|receiver:...|amount:50|asset:HSCT|...",
    "signature": "0xSignatureHex...",
    "transactionHash": "0xTransactionHash...",
    "blockNumber": 42,
    "blockHash": "0xBlockHash...",
    "timestamp": "2026-09-13T10:05:00.000Z",
    "note": "Lunch split"
  }
  ```

### C. `users/{uid}/payment_requests/{requestId}` & `global_payment_requests/{requestId}`
Payment request links, peer-to-peer invoices, and custom QR codes.
- **Document Path**: `users/{uid}/payment_requests/{requestId}` and `global_payment_requests/{requestId}`
- **Access Rule**: Requestor and recipient read/update.
- **Fields**:
  ```json
  {
    "id": "REQ-1789240000000-XYZ",
    "requestorUid": "USER_FIREBASE_UID",
    "requestorUsername": "@aditya",
    "requestorDisplayName": "Aditya Singh",
    "requestorWalletAddress": "0x1234...",
    "receiverWalletAddress": "0x1234...",
    "amount": 25.00,
    "currency": "HSCT",
    "asset": "HSCT",
    "network": "SecureChain PoA",
    "note": "Freelance design",
    "status": "PENDING",
    "createdAt": "2026-09-13T10:00:00.000Z",
    "expiresAt": "2026-09-15T10:00:00.000Z",
    "paidTransactionId": null
  }
  ```

---

## 4. Global Blockchain & Ledger Collections

### A. `global_blocks/{blockId}`
Immutable append-only global blocks of the SecureChain PoA Hybrid Ledger.
- **Document Path**: `global_blocks/{blockNumber}` (formatted as 12-digit zero-padded index, e.g., `000000000042`)
- **Access Rule**: Public read (for Block Explorer). Zero direct client writes. Server Admin SDK only.
- **Fields**:
  ```json
  {
    "blockNumber": 42,
    "previousBlockHash": "0xprevhash...",
    "blockHash": "0xcurrenthash...",
    "merkleRoot": "0xmerkleroot...",
    "timestamp": "2026-09-13T10:05:00.000Z",
    "transactions": [ ... ],
    "transactionCount": 1,
    "validator": "0xPoAValidatorAddress...",
    "isAnchored": true,
    "anchorTxHash": "0xethanchor..."
  }
  ```

### B. `global_chain_meta/state`
Global chain height, tip hash, and consensus anchors.
- **Document Path**: `global_chain_meta/state`
- **Fields**:
  ```json
  {
    "chainHeight": 42,
    "tipHash": "0xcurrenthash...",
    "genesisHash": "0xgenesishash...",
    "totalVolumeHSCT": 500000.00,
    "totalTransactions": 142,
    "lastAnchorBlock": 40,
    "lastAnchorTime": "2026-09-13T09:00:00.000Z"
  }
  ```

---

## 5. Security & Self-Healing Protocol Collections

### A. `security_state/current`
System-wide security status, pause/freeze controls, and threat level.
- **Document Path**: `security_state/current`
- **Fields**:
  ```json
  {
    "status": "SECURE",
    "threatLevel": "LOW",
    "activeIncidentId": null,
    "isFrozen": false,
    "frozenAt": null,
    "frozenBy": null,
    "lastIntegrityCheck": "2026-09-13T10:10:00.000Z",
    "consecutiveValidChecks": 350
  }
  ```

### B. `security_incidents/{incidentId}`
Tamper events, signature mismatches, double-spend attempts, and hash breaks.
- **Document Path**: `security_incidents/{incidentId}`
- **Fields**:
  ```json
  {
    "incidentId": "INC_1789240000000",
    "type": "HASH_CHAIN_MISMATCH",
    "severity": "CRITICAL",
    "detectedAt": "2026-09-13T10:10:00.000Z",
    "affectedBlock": 42,
    "description": "Computed block hash does not match stored block hash",
    "autoFrozen": true,
    "resolved": false
  }
  ```

### C. `trusted_checkpoints/{checkpointId}`
Periodic cryptographic snapshots verified against smart contract anchors.
- **Document Path**: `trusted_checkpoints/{checkpointId}`
- **Fields**:
  ```json
  {
    "checkpointId": "CP_000000000040",
    "blockNumber": 40,
    "blockHash": "0xhash...",
    "merkleRoot": "0xroot...",
    "onChainAnchorTx": "0xanchortx...",
    "stateRoot": "0xstateroot...",
    "verifiedAt": "2026-09-13T09:00:00.000Z"
  }
  ```

### D. `recovery_locks/active` & `recovery_logs/{logId}`
Autonomous self-healing blockchain recovery locks and audit trail.
- **Fields**:
  ```json
  {
    "lockId": "RECOVERY_LOCK_CURRENT",
    "isLocked": false,
    "lockedAt": null,
    "lockedBy": null,
    "purpose": "Self-healing ledger reconstruction"
  }
  ```

---

## 6. Trading Engine & AI Context Collections

### A. `paper_positions/{id}` & `paper_orders/{id}`
Simulation and paper-trading portfolio state.
- **Fields**: symbol, side, entryPrice, quantity, stopLoss, takeProfit, status, pnl, createdAt.

### B. `auto_trading_configs/{uid}`
Automated trading parameters, strategy enablement, allocation limits, and risk limits.
- **Fields**: enabled, symbols, maxAllocationHsct, stopLossPct, takeProfitPct, strategyMode.

### C. `learning_patterns/{id}` & `learning_events/{id}`
AI assistive patterns, adaptive user risk profiles, and copilot learning memory.
- **Fields**: patternType, frequency, confidenceScore, contextVector, lastObserved.
