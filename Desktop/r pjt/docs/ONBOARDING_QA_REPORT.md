# Digital Vehicle Passport — Onboarding & Vehicle Initialization QA Report

## Executive Summary

| Attribute | Details |
| :--- | :--- |
| **System** | Blockchain-Based Digital Vehicle Passport & Autonomous Twin Engine |
| **Audit Date** | October 29, 2026 |
| **Target Milestone** | Master Task: Full Project Analysis + New-User Onboarding + Vehicle Initialization Repair |
| **Final Status** | **IMPLEMENTED AND END-TO-END VERIFIED** |
| **Automated Test Results** | **30 Passed / 0 Failed** across 10 Scenarios (100% Pass Rate) |
| **Browser Subagent Run** | Completed with Live Screen Recordings and Visual Evidence |

---

## 1. Root Causes of Original Issues

A comprehensive code audit traced three distinct flaws in the original codebase:

### Root Cause 1: Hardcoded Vehicle Auto-Provisioning
- **Location:** `frontend/src/lib/serverStore.ts` & `frontend/src/app/api/vehicles/route.ts`
- **Defect:** 
  1. `serverStore.ts` called `provisionVehicleForNewOwner(user)` inside `findOrCreateUser` and `parseSessionToken`.
  2. `api/vehicles/route.ts` contained a conditional block:
     ```ts
     if (userVehicles.length === 0) {
       const newVehicle = provisionVehicleForNewOwner(currentUser);
       userVehicles = [newVehicle];
     }
     ```
  3. This forcefully created a demo "Tesla Model Y" and injected it into every freshly registered or empty account.

### Root Cause 2: Fallback User Leak on Unauthenticated / Invalid Queries
- **Location:** `frontend/src/app/api/vehicles/route.ts`
- **Defect:**
  ```ts
  const currentUser = parseSessionToken(token) || getUsers()[0];
  ```
  When an unauthenticated or invalid session called `GET /api/vehicles`, the handler defaulted to `getUsers()[0]`, which was Alex Mercer (`user-owner-a`). As a consequence, unauthenticated sessions or misconfigured headers silently rendered Alex Mercer's "Tata Nexon EV" demo vehicle.

### Root Cause 3: Premature Dashboard Bypass from `/initialize`
- **Location:** `frontend/src/context/AuthContext.tsx`
- **Defect:**
  Upon completing cryptographic registration on `/initialize`, `initializePassport()` immediately executed `router.push('/dashboard')`, completely bypassing the onboarding choice screen and never allowing users to state whether they owned a vehicle.

---

## 2. Files Inspected and Modified

### Database & Schema
- `backend/prisma/schema.prisma`:
  - Added enum `OnboardingStatus` with values `NOT_STARTED`, `COMPLETED_WITH_VEHICLE`, `COMPLETED_WITHOUT_VEHICLE`.
  - Added field `onboardingStatus OnboardingStatus @default(NOT_STARTED)` to model `User`.
  - Applied safely via `npx prisma db push` without table drops or data loss.
- `backend/prisma/seed.ts`:
  - Updated seed accounts to set appropriate `OnboardingStatus` (`COMPLETED_WITH_VEHICLE` for owners with cars, `COMPLETED_WITHOUT_VEHICLE` for institutions).

### Backend Services & Controllers
- `backend/src/lib/jwt.ts`:
  - Added `onboardingStatus?: string` to `TokenPayload`.
- `backend/src/controllers/authController.ts`:
  - Updated `syncUser`: New users initialize with `onboardingStatus: NOT_STARTED`.
  - Updated `initializeUser`: Preserves `onboardingStatus` and includes it in re-signed JWT token.
  - Added `setOnboardingStatus`: Endpoint handler validating and updating user onboarding choice.
  - Updated `devLogin`: Signs JWT with user's stored `onboardingStatus`.
- `backend/src/controllers/vehicleController.ts`:
  - In `createVehicle`: Automatically transitions owner's `onboardingStatus` to `COMPLETED_WITH_VEHICLE` upon first vehicle registration.
- `backend/src/routes/authRoutes.ts`:
  - Registered `POST /api/auth/onboarding` route with token authentication.

### Frontend Application
- `frontend/src/types/auth.ts`:
  - Added `OnboardingStatus` type and optional field to `User` interface.
- `frontend/src/lib/serverStore.ts`:
  - Removed all invocations of `provisionVehicleForNewOwner`.
  - Added `updateUserOnboardingStatus` and `initializeUserPassport` helpers.
  - Initialized new test persona `user-new-user` with `NOT_STARTED`.
- `frontend/src/app/api/vehicles/route.ts`:
  - Removed fallback to `getUsers()[0]`; enforces strict 401 Unauthorized for unauthenticated calls.
  - Returns clean empty array `[]` when user owns 0 vehicles.
  - Validates 17-character VIN and unique registration number on `POST`.
- `frontend/src/app/api/auth/onboarding/route.ts`:
  - Created dedicated endpoint for updating user onboarding status.
- `frontend/src/app/api/auth/initialize/route.ts`:
  - Preserves user `onboardingStatus` during blockchain user registration.
- `frontend/src/lib/api.ts`:
  - Added `setOnboardingStatusApi(token, status)`.
- `frontend/src/context/AuthContext.tsx`:
  - Added `completeOnboardingWithoutVehicle` and `completeOnboardingWithVehicle`.
  - Updated route guards:
    - `isInitialized = false` &rarr; `/initialize`
    - `isInitialized = true` & `onboardingStatus = NOT_STARTED` &rarr; `/onboarding`
    - `isInitialized = true` & `onboardingStatus != NOT_STARTED` &rarr; `/dashboard`
- `frontend/src/app/onboarding/page.tsx`:
  - Built brand new onboarding choice page with Option 1 ("Add My Vehicle") and Option 2 ("Continue Without a Vehicle").
- `frontend/src/app/dashboard/page.tsx`:
  - Built empty state card featuring call-to-action button `Add Your First Vehicle` (`id="btn-add-first-vehicle"`).
- `frontend/src/app/login/page.tsx` & `frontend/src/app/api/auth/test-users/route.ts`:
  - Added uninitialized test persona card for rapid interactive verification.

---

## 3. Automated Test Matrix & Evidence

The automated verification suite was executed against the live Express backend, PostgreSQL database, and Hardhat EVM node (`backend/tests/onboarding_e2e.test.ts`):

```bash
npx ts-node tests/onboarding_e2e.test.ts
```

| Test ID | Scenario | Preconditions | Actions | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | New user adds vehicle | Authenticated user on `/onboarding` | Submit valid vehicle data (Make, Model, Year, VIN, Reg, Odometer) | Vehicle created in PostgreSQL (201 Created), anchored on EVM | Created with HTTP 201; Genesis state anchored | **PASS** |
| **TEST-02** | New user continues without vehicle | Freshly initialized account | Select Option 2: `Continue Without a Vehicle` | `onboardingStatus` updated to `COMPLETED_WITHOUT_VEHICLE`; 0 vehicles returned | HTTP 200 OK; 0 vehicles; clean empty state | **PASS** |
| **TEST-03** | User adds vehicle later | User previously completed onboarding without vehicle | Click `Add Your First Vehicle` and submit form | Vehicle created; status transitioned to `COMPLETED_WITH_VEHICLE` | HTTP 201 Created; owner ID matches user | **PASS** |
| **TEST-04** | Existing user session restoration | Initialized account with vehicle | Authenticate via token/credentials | Direct navigation to `/dashboard`; no onboarding redirect loop | HTTP 200; status preserved; no redirect | **PASS** |
| **TEST-05** | Multiple vehicles per user | User with 1 registered vehicle | Submit second vehicle registration | Both vehicles associated with same owner without overwriting | HTTP 201; 2 vehicles returned in owner query | **PASS** |
| **TEST-06** | Duplicate & invalid inputs | Valid user session | Submit duplicate VIN; submit short VIN (<17 chars) | Duplicate rejected with 409 Conflict; short VIN rejected with 400 Bad Request | 409 Conflict & 400 Bad Request returned | **PASS** |
| **TEST-07** | Initialization enforcement | Uninitialized account (`isInitialized: false`) | Attempt `POST /api/vehicles` | Blocked with 403 Forbidden | HTTP 403 Forbidden received | **PASS** |
| **TEST-08** | Authorization & data isolation | Two distinct user accounts (User A & User B) | User A queries vehicles | User A sees only their vehicles; zero cross-account leakage | Strict data isolation verified | **PASS** |
| **TEST-09** | Demo isolation & zero auto-provisioning | Newly registered user account | Check vehicle count immediately after sync | Count is strictly 0; no demo vehicle auto-created | HTTP 200; `vehicles: []` (0 items) | **PASS** |
| **TEST-10** | Regression audit across personas | Seed accounts (Alex Mercer - Owner A) | Dev-login and verify existing vehicle | Existing Tata Nexon EV intact; `COMPLETED_WITH_VEHICLE` preserved | HTTP 200; seed vehicles preserved | **PASS** |

**Summary: 30 passed, 0 failed across all 10 scenarios.**

---

## 4. Browser Subagent Live Verification

Live end-to-end browser verification was conducted using the Browser Subagent on `http://localhost:3000`:

1. **New User Identity Initialization (`/initialize`)**:
   - Screenshot: `step3_initialize_page_1793214384045.png`
   - Verified uninitialized status badge and explicit terms of cryptographic passport authority.
2. **Onboarding Choice Screen (`/onboarding`)**:
   - Screenshot: `step5_onboarding_choice_1793214396046.png`
   - Verified presence of both options:
     - Option 1: "Add My Vehicle" (Recommended)
     - Option 2: "Continue Without a Vehicle"
3. **Empty Dashboard State (`/dashboard`)**:
   - Screenshot: `step7_empty_dashboard_1793214445695.png`
   - Verified 0 vehicles loaded, "No Registered Vehicles Found" message, and primary action button `Add Your First Vehicle`.
4. **Vehicle Creation & Blockchain Anchoring**:
   - Screenshot: `vehicle_registered_dashboard_1793214994553.png`
   - Form filled with ISO-compliant inputs, anchored to EVM Subnet 31337, and reflected in the user dashboard.
5. **Returning User Verification**:
   - Screenshot: `owner_dashboard_1793214917980.png`
   - Alex Mercer logged in, bypassed `/onboarding`, and immediately displayed his existing Tata Nexon EV.

---

## 5. Remaining Limitations & Edge Cases

- **Firebase Unauthorized Domain on Vercel**: 
  When running on custom Vercel domains (`riya-project-five.vercel.app`), the domain must be registered under **Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains**. The application includes helpful guidance and a fallback Direct Sign-In mechanism.
- **ISO 3779 VIN Character Restrictions**:
  Per global automotive standards, the letters `I`, `O`, and `Q` are forbidden in VIN numbers. Client-side and server-side validators enforce this strictly to ensure smart contract compatibility.

---

## 6. Sign-off

- **Auditor:** Antigravity Pair-Programming Lead
- **Status:** **IMPLEMENTED AND END-TO-END VERIFIED**
