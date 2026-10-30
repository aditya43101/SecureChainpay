# Vehicle Ownership Transfer Audit Report

**Project:** Blockchain-Based Digital Vehicle Passport  
**Module:** Lifecycle Operations & Ownership Transfer (Phase 4 & Cross-System Hardening)  
**Date:** October 28, 2026  
**Final Status:** **IMPLEMENTED AND END-TO-END VERIFIED**

---

## 1. Executive Summary & Status Classification

| Dimension | Initial Audit State | Final Status |
| :--- | :--- | :--- |
| **Solidity Smart Contract** | Implemented, missing on-chain self-transfer rejection | **FIXED AND VERIFIED** (19/19 tests passing) |
| **Backend Express API** | Implemented, allowed admin override without vehicle ownership | **FIXED AND VERIFIED** (Strict current-owner enforcement) |
| **Frontend API Route (`/api/vehicles/[id]/ownership/transfer`)** | Broken/Vulnerable: No auth verification, no caller-owner validation | **REPAIRED AND VERIFIED** (Token verified, 401/403/400 enforced) |
| **Ownership History Retrieval (`GET /api/vehicles/[id]/ownership`)** | Missing Next.js route | **IMPLEMENTED AND VERIFIED** |
| **Frontend UI/UX** | Buttons visible to all users, no 2-step review, no recipient selection | **ENHANCED & VERIFIED** (Owner-gated, 2-step confirmation modal) |
| **End-to-End Test Suite** | Disjointed tests | **10/10 TESTS PASSED (Tests A through J)** |

---

## 2. Root Causes Identified & Repaired

1. **Smart Contract Self-Transfer Allowed on Chain:**
   - *Root Cause:* In `VehiclePassport.sol`, `transferVehicleOwnership` checked `newOwnerAddress != address(0)`, but did not enforce `newOwnerAddress != previousOwner` or check for duplicate `recordId`.
   - *Fix:* Added `require(newOwnerAddress != previousOwner, "Cannot transfer vehicle to current owner");` and `require(recordsById[recordId].timestamp == 0, "Record ID already anchored");`.

2. **Frontend API Route Authentication & Authorization Bypass:**
   - *Root Cause:* `frontend/src/app/api/vehicles/[vehicleId]/ownership/transfer/route.ts` did not inspect `Authorization` headers. Any unauthenticated caller could submit a transfer.
   - *Fix:* Integrated `parseSessionToken(token)`. Validated caller identity against `vehicle.currentOwnerId`. Added HTTP 401 (Unauthorized) and HTTP 403 (Forbidden) rejections.

3. **Missing Structured Ownership History API on Frontend:**
   - *Root Cause:* `GET /api/vehicles/[vehicleId]/ownership` did not exist in Next.js App Router, causing 404s when frontend requested structured history records.
   - *Fix:* Created `frontend/src/app/api/vehicles/[vehicleId]/ownership/route.ts` and enhanced `serverStore.ts` with `OwnershipHistoryRecord` disk caching.

4. **UI Button Gating & Accidental Submission Risk:**
   - *Root Cause:* The "Transfer Vehicle" button in `/dashboard` was rendered regardless of whether the logged-in user owned the selected vehicle. Furthermore, clicking "Transfer" instantly executed the transaction without a review step.
   - *Fix:* Gated the button in `/dashboard` to only display when `user.id === selectedVehicle.currentOwnerId`. Upgraded `TransferOwnershipModal.tsx` to include registered stakeholder recipient pills, a 2-step review dialog, irreversible blockchain warning, and on-chain confirmation receipt.

5. **Timeline Cache Invalidation Bug:**
   - *Root Cause:* `getVehicleTimelineData()` in `serverStore.ts` was not calling `loadFromDisk()`, resulting in stale in-memory maps in multi-request Next.js serverless evaluations.
   - *Fix:* Added `loadFromDisk()` at the entry of `getVehicleTimelineData()` and pre-seeded initial vehicles with persistent Genesis timeline events.

---

## 3. Files Modified & Added

1. [`blockchain/contracts/VehiclePassport.sol`](file:///Users/adityasingh/Desktop/r%20pjt/blockchain/contracts/VehiclePassport.sol):
   - Added self-transfer check: `require(newOwnerAddress != previousOwner, "Cannot transfer vehicle to current owner")`.
   - Added duplicate record ID check: `require(recordsById[recordId].timestamp == 0, "Record ID already anchored")`.
2. [`blockchain/test/VehiclePassport.test.ts`](file:///Users/adityasingh/Desktop/r%20pjt/blockchain/test/VehiclePassport.test.ts):
   - Added unit tests for self-transfer rejection, duplicate record ID rejection, and sequential transfers (A &rarr; B &rarr; C).
3. [`backend/src/controllers/lifecycleController.ts`](file:///Users/adityasingh/Desktop/r%20pjt/backend/src/controllers/lifecycleController.ts):
   - Enforced strict current-owner authorization (`if (vehicle.currentOwnerId !== req.user.id)`).
4. [`backend/src/controllers/authController.ts`](file:///Users/adityasingh/Desktop/r%20pjt/backend/src/controllers/authController.ts):
   - Fixed unique constraint collision on `blockchainUserId` generation.
   - Restored uninitialized state (`isInitialized: false`) for new user registrations until explicit passport initialization.
5. [`frontend/src/lib/serverStore.ts`](file:///Users/adityasingh/Desktop/r%20pjt/frontend/src/lib/serverStore.ts):
   - Added `OwnershipHistoryRecord` state management, disk caching, and `loadFromDisk()` calls.
   - Pre-seeded initial vehicle ownership histories and timelines.
6. [`frontend/src/app/api/vehicles/[vehicleId]/ownership/route.ts`](file:///Users/adityasingh/Desktop/r%20pjt/frontend/src/app/api/vehicles/%5BvehicleId%5D/ownership/route.ts):
   - Created route for `GET /api/vehicles/:vehicleId/ownership`.
7. [`frontend/src/app/api/vehicles/[vehicleId]/ownership/transfer/route.ts`](file:///Users/adityasingh/Desktop/r%20pjt/frontend/src/app/api/vehicles/%5BvehicleId%5D/ownership/transfer/route.ts):
   - Completely rewritten to require bearer token authentication, enforce current-owner authorization, validate recipient, reject self-transfer, and record structured ownership history.
8. [`frontend/src/app/dashboard/page.tsx`](file:///Users/adityasingh/Desktop/r%20pjt/frontend/src/app/dashboard/page.tsx):
   - Gated "Transfer Vehicle" and "Transfer" buttons to authenticated current owner only.
9. [`frontend/src/components/lifecycle/TransferOwnershipModal.tsx`](file:///Users/adityasingh/Desktop/r%20pjt/frontend/src/components/lifecycle/TransferOwnershipModal.tsx):
   - Upgraded with current owner identity card, registered stakeholder selector pills, 2-step confirmation review, irreversible warning, and on-chain confirmation receipt with tx hash.
10. [`backend/tests/ownership_transfer_e2e.test.ts`](file:///Users/adityasingh/Desktop/r%20pjt/backend/tests/ownership_transfer_e2e.test.ts):
    - Comprehensive test suite executing all 10 required scenarios (Tests A through J).

---

## 4. Empirical Test Results: Scenarios A Through J

Test execution executed on Hardhat EVM local node and PostgreSQL database:

```text
==============================================================
   VEHICLE OWNERSHIP TRANSFER — END-TO-END VERIFICATION SUITE   
==============================================================

✅ [PASS] Test B: Unauthorized non-owner transfer is rejected (HTTP 403 Forbidden)
✅ [PASS] Test C: Transfer to nonexistent recipient is rejected (HTTP 404 Not Found)
✅ [PASS] Test D: Self-transfer is strictly rejected (HTTP 400 Bad Request)
✅ [PASS] Test A: Successful transfer confirmed on blockchain and reflected in database
✅ [PASS] Test G: Duplicate transfer from previous owner is rejected (HTTP 403 Forbidden)
✅ [PASS] Test E: Database remains unmutated when transfer fails or reverts
✅ [PASS] Test F: On-chain state verifies Owner B as authoritative owner address
✅ [PASS] Test H: Sequential transfers A -> B -> C succeed in strictly preserved chronological order
✅ [PASS] Test I: Service history and timeline events remain fully intact after ownership transfer
✅ [PASS] Test J: Authentication, vehicle detail query, and core workflows remain 100% operational

==============================================================
SUMMARY: 10 PASSED, 0 FAILED across Tests A through J
==============================================================
```

### Detailed Test Matrix

| Test ID | Scenario | Expected Behavior | Actual Behavior | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Test A** | Successful transfer (A &rarr; B) | Tx confirmed on-chain, DB updated to Owner B, ownership history created | Tx Hash generated, block mined, DB currentOwnerId updated to Owner B | **PASS** |
| **Test B** | Unauthorized transfer | Non-owner attempting transfer is blocked | HTTP 403 Forbidden: "Only current vehicle owner can initiate transfer" | **PASS** |
| **Test C** | Invalid recipient | Non-existent user rejected safely | HTTP 404 Not Found: "Target owner not found" | **PASS** |
| **Test D** | Self-transfer | Owner transferring to self rejected | HTTP 400 Bad Request: "Cannot transfer vehicle to current owner" | **PASS** |
| **Test E** | Blockchain failure protection | Failed/reverting on-chain call leaves DB unmutated | DB rollback verified; original owner preserved | **PASS** |
| **Test F** | Database reconciliation | On-chain query matches DB owner state | `getVehicleById` on-chain owner address matches Owner B wallet | **PASS** |
| **Test G** | Duplicate submission | Repeated request from previous owner blocked | HTTP 403 Forbidden; duplicate records prevented | **PASS** |
| **Test H** | Sequential transfers (A &rarr; B &rarr; C) | Owner B transfers to C; lineage preserved in order | Owner C confirmed as current owner; 2 chronological transfer records preserved | **PASS** |
| **Test I** | Historical record preservation | Prior service logs remain attached to vehicle | Service records and timeline events remain fully intact | **PASS** |
| **Test J** | Regression check | Login, vehicle detail view, verification operational | HTTP 200 on `/auth/me`, `/vehicles/:id`, and `/timeline` | **PASS** |

---

## 5. Real Browser Verification Evidence

Testing was executed via the autonomous Browser Agent on the live web application:
- **Video Recording:** [`transfer_confirm_flow_1793209643789.webp`](file:///Users/adityasingh/.gemini/antigravity-ide/brain/3b92813b-f494-4d40-bcb2-0f2cad602e9a/transfer_confirm_flow_1793209643789.webp)
- **Modal Input & Recipient Selection:** [`transfer_modal_1793209497773.png`](file:///Users/adityasingh/.gemini/antigravity-ide/brain/3b92813b-f494-4d40-bcb2-0f2cad602e9a/transfer_modal_1793209497773.png)
- **On-Chain Confirmation Receipt:** [`ownership_transfer_confirmed_1793209705474.png`](file:///Users/adityasingh/.gemini/antigravity-ide/brain/3b92813b-f494-4d40-bcb2-0f2cad602e9a/ownership_transfer_confirmed_1793209705474.png)
- **Ownership Lineage in Timeline:** [`ownership_history_records_1793209778247.png`](file:///Users/adityasingh/.gemini/antigravity-ide/brain/3b92813b-f494-4d40-bcb2-0f2cad602e9a/ownership_history_records_1793209778247.png)

---

## 6. How to Demonstrate to Faculty / Evaluators

1. **Open Login Screen (`http://localhost:3000/login`):**
   - Click **"Access Portal"** on **Alex Mercer (Vehicle Owner)** (`USR-000001`).
2. **View Owned Vehicle on Dashboard (`http://localhost:3000/dashboard`):**
   - Select the Tata Nexon EV (`VP-000001`).
   - Notice the blue **"Transfer Vehicle"** button is visible in the vehicle header action bar.
3. **Trigger Transfer Modal:**
   - Click **"Transfer Vehicle"**.
   - Show the faculty that the **Current Registered Owner** is clearly displayed with their Blockchain ID (`USR-000001`).
   - Show the **"Select Registered Stakeholder"** quick pills. Click **Elena Rostova (Second Owner)**.
   - Select Transfer Type: **Commercial Sale**. Enter notes: *"Sold via verified bill of sale"*.
4. **Demonstrate 2-Step Review & Irreversible Warning:**
   - Click **"Review Transfer &rarr;"**.
   - Show the **Ownership Transition Card** (`From Alex Mercer -> To Elena Rostova`) and the alert: *"Irreversible Blockchain Transfer Warning"*.
5. **Anchor on Blockchain:**
   - Click **"Confirm & Anchor on Blockchain"**.
   - Watch the loading state (`Anchoring on Hardhat EVM...`) followed by the green **"Ownership Transfer Confirmed!"** screen.
   - Point out the on-chain **Transaction Hash**, **Block Number**, and **Passport ID**.
6. **Verify Ownership Transferred & History Preserved:**
   - Click **"Done & View Updated Passport"**.
   - Click **"Ownership History"** in the sidebar: show the completed transfer event with previous & new owner.
   - Switch user to **Elena Rostova** (`owner.b@vehiclepassport.dev`): demonstrate that Elena now controls the vehicle, and Alex Mercer no longer has the transfer button.
