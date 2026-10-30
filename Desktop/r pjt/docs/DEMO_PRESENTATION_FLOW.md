# Digital Vehicle Passport — Demonstration & Evaluation Presentation Guide

This guide provides a structured, live demonstration script for evaluators, faculty reviewers, and stakeholders. It demonstrates the complete resolution of the new-user onboarding flow, zero demo vehicle leakage, empty state handling, and multi-vehicle ownership.

---

## Pre-Flight Environment Checklist

Ensure all three subsystem daemons are operational:
1. **Hardhat EVM Localhost Node**: `http://localhost:8545` (Chain ID: 31337)
2. **Backend API Service**: `http://localhost:5001`
3. **Frontend Application**: `http://localhost:3000`

---

## Demonstration 1: New User Signs Up & Continues Without a Vehicle

**Goal:** Prove that creating an account does not automatically fabricate or assign a demo vehicle, and that skipping vehicle creation results in a clean empty state.

### Actions:
1. Open `http://localhost:3000/login` in the browser.
2. In the "Authorized Role-Based Portals" grid, locate the **Test New User (Uninitialized)** card (or use the Direct Sign-In form with a custom email like `evaluator@test.com`).
3. Click **"Access Portal"**.
4. The application navigates to `http://localhost:3000/initialize`.
   - Point out the **"Uninitialized"** status badge.
   - Highlight the privacy policy: *Zero personal data stored on-chain; only cryptographic identity hash registered.*
5. Click **"Initialize Vehicle Passport"**.
6. The transaction confirms, and the application automatically routes to `http://localhost:3000/onboarding`.
7. Point out the two clear, balanced options:
   - **Option 1:** *Add My Vehicle*
   - **Option 2:** *Continue Without a Vehicle*
8. Click **"Continue Without a Vehicle"**.
9. The application routes to `http://localhost:3000/dashboard`.

### Verification Points to Show Evaluator:
- **Vehicle Count:** Exactly **0** vehicles.
- **Empty State Display:** *"No Registered Vehicles Found — Your cryptographic account is ready. Add your first vehicle to anchor its digital passport on the blockchain."*
- **Call-to-Action:** The prominent **`[Add Your First Vehicle]`** button is displayed.
- **Persistence:** Refresh the browser page (`F5` or `Cmd+R`). Confirm the user remains on the dashboard and is **not** trapped in an infinite onboarding redirect loop.

---

## Demonstration 2: User Adds Their First Vehicle Later

**Goal:** Demonstrate that a user who skipped onboarding can register an authentic vehicle asset at any time.

### Actions:
1. From the empty dashboard state in Demonstration 1, click **"Add Your First Vehicle"**.
2. The vehicle registration modal opens. Fill in the following details:
   - **Manufacturer:** `Hyundai`
   - **Model:** `Ioniq 5`
   - **Variant:** `Long Range AWD`
   - **Manufacturing Year:** `2024`
   - **Fuel Type:** `Electric`
   - **Exterior Color:** `Gravity Gold Matte`
   - **Engine / Motor Number:** `EM987654`
   - **VIN:** `KMHK14JA5PU123456` *(17-character ISO 3779 compliant)*
   - **Registration Number:** `DL01AB9999`
3. Click **"Register & Anchor to Blockchain"**.
4. Wait for the transaction animation:
   - Client sends payload to `/api/vehicles`.
   - Smart contract registers vehicle passport.
   - Digital Twin genesis record is generated.
5. The modal closes, and the dashboard updates.

### Verification Points to Show Evaluator:
- **Vehicle List:** Exactly **1** vehicle now displayed (`Hyundai Ioniq 5`).
- **Blockchain Status:** Status badge reads **"CONFIRMED"** with a valid EVM transaction hash.
- **Owner Identity:** Verified as belonging to the current authenticated user.

---

## Demonstration 3: New User Adds Vehicle Directly During Onboarding

**Goal:** Demonstrate the streamlined "Option 1: Add My Vehicle" flow for users who already own a car.

### Actions:
1. Log out via the user profile dropdown in the top right.
2. In the Direct Sign-In box on `/login`, enter:
   - **Email:** `sarah.owner@vehiclepassport.dev`
   - **Name:** `Sarah Connor`
3. Click **"Sign In / Register"**.
4. On `/initialize`, click **"Initialize Vehicle Passport"**.
5. On `/onboarding`, select **"Add My Vehicle"**.
6. Enter vehicle information:
   - **Manufacturer:** `BMW`
   - **Model:** `i4 M50`
   - **Variant:** `Gran Coupe`
   - **Year:** `2024`
   - **Fuel Type:** `Electric`
   - **Color:** `Frozen Portimao Blue`
   - **VIN:** `WBA43AW06PFG12345`
   - **Registration:** `KA05EV2024`
   - **Engine Number:** `BMWEV4432`
7. Click **"Complete Onboarding & Anchor Passport"**.
8. Application lands directly on `/dashboard` with Sarah's BMW i4 M50 active and ready.

---

## Demonstration 4: Returning User Experience (Alex Mercer / Existing Owners)

**Goal:** Prove that existing accounts with completed onboarding bypass onboarding screens and retain their existing assets.

### Actions:
1. Sign out.
2. On `/login`, scroll to **Alex Mercer (Vehicle Owner)**.
3. Click **"Access Portal"**.
4. Observe the immediate transition to `http://localhost:3000/dashboard` (no `/initialize` and no `/onboarding` screens).

### Verification Points to Show Evaluator:
- Alex Mercer's pre-seeded **Tata Nexon EV** (`MH02EV1001`) is immediately displayed.
- Service records, odometer history, and digital twin status are fully preserved.

---

## Demonstration 5: Absence of Demo Vehicle Leakage & Data Isolation

**Goal:** Prove that normal accounts never see other users' vehicles or synthetic demo records.

### Actions:
1. Open browser DevTools Network tab.
2. Inspect the response payload from `GET /api/vehicles`.
3. Highlight that the query strictly matches `currentOwnerId === currentUser.id`.
4. Point out that no fallback to `getUsers()[0]` exists, and no `provisionVehicleForNewOwner` is ever executed during normal user signup.

---

## Summary of Completed Tasks

| Requirement | Implementation | Status |
| :--- | :--- | :--- |
| **Two Clear Onboarding Options** | `Add My Vehicle` and `Continue Without a Vehicle` cards on `/onboarding` | Verified |
| **Clean Empty Dashboard** | Zero demo vehicles assigned; `Add Your First Vehicle` button | Verified |
| **Add Vehicle Later** | Functional modal registers and anchors vehicle anytime | Verified |
| **EVM Blockchain Anchoring** | Genesis passport minted to Subnet 31337 | Verified |
| **Existing User Workflow** | Direct navigation to `/dashboard` with existing cars intact | Verified |
| **Data Isolation** | Strict server-side verification of authenticated identity | Verified |
| **Automated Tests** | 30 tests in `backend/tests/onboarding_e2e.test.ts` passing | 100% Pass Rate |
