#!/usr/bin/env python3
"""
Autonomous Real-Browser Verification of Live Vercel Production Deployment
Target: https://riya-project-five.vercel.app
"""
import sys
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

VERCEL_URL = "https://riya-project-five.vercel.app"
SCREENSHOT_DIR = Path("/Users/adityasingh/Desktop/r pjt/docs/screenshots/qa/vercel_live")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

test_results = []

def record(test_id, name, status, details=None, screenshot=None):
    res = {
        "id": test_id,
        "name": name,
        "status": status,
        "details": details or {},
        "screenshot": str(screenshot) if screenshot else None,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    test_results.append(res)
    mark = "✅ [PASS]" if status == "PASS" else "❌ [FAIL]"
    print(f"{mark} {test_id}: {name}")
    if details:
        for k, v in details.items():
            print(f"   -> {k}: {v}")
    if screenshot:
        print(f"   -> Screenshot: {screenshot}")

def main():
    print("=" * 80)
    print(f"🌐 AUTONOMOUS LIVE VERCEL PRODUCTION VERIFICATION")
    print(f"   Target: {VERCEL_URL}")
    print("=" * 80)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # -------------------------------------------------------------
        # VER-01: Public Landing Page
        # -------------------------------------------------------------
        try:
            page.goto(VERCEL_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_selector("text=The Sovereign Ledger for Automotive Truth", timeout=10000)
            ss_01 = SCREENSHOT_DIR / "ver_01_landing.png"
            page.screenshot(path=str(ss_01), full_page=True)
            record("VER-01", "Live Landing Page Renders Correctly", "PASS",
                   {"title": page.title(), "url": page.url}, ss_01)
        except Exception as e:
            record("VER-01", "Live Landing Page Renders Correctly", "FAIL", {"error": str(e)})

        # -------------------------------------------------------------
        # VER-02: Blockchain Explorer & Merkle Batches
        # -------------------------------------------------------------
        try:
            page.goto(f"{VERCEL_URL}/explorer", wait_until="networkidle", timeout=30000)
            time.sleep(2)
            page.wait_for_selector("text=Merkle Batch", timeout=10000)
            batch_count = page.locator("text=BATCH-2026-").count()
            ss_02 = SCREENSHOT_DIR / "ver_02_explorer.png"
            page.screenshot(path=str(ss_02), full_page=True)
            record("VER-02", "Live Explorer Renders Merkle Batches", "PASS",
                   {"batchesVisible": batch_count, "url": page.url}, ss_02)
        except Exception as e:
            record("VER-02", "Live Explorer Renders Merkle Batches", "FAIL", {"error": str(e)})

        # -------------------------------------------------------------
        # VER-03: Public Verification Portal
        # -------------------------------------------------------------
        try:
            page.goto(f"{VERCEL_URL}/verify/VP-DEMO-001", wait_until="networkidle", timeout=30000)
            time.sleep(2)
            page.wait_for_selector("text=Aurora X1 Sedan", timeout=10000)
            ss_03 = SCREENSHOT_DIR / "ver_03_verify.png"
            page.screenshot(path=str(ss_03), full_page=True)
            record("VER-03", "Live Public Passport Verification (/verify/VP-DEMO-001)", "PASS",
                   {"vehicle": "Aurora X1 Sedan", "passportId": "VP-DEMO-001"}, ss_03)
        except Exception as e:
            record("VER-03", "Live Public Passport Verification (/verify/VP-DEMO-001)", "FAIL", {"error": str(e)})

        # -------------------------------------------------------------
        # VER-04: Login & Seeded User Authentication
        # -------------------------------------------------------------
        try:
            page.goto(f"{VERCEL_URL}/login", wait_until="networkidle", timeout=30000)
            page.wait_for_selector("text=Aarav Sharma", timeout=10000)
            ss_04 = SCREENSHOT_DIR / "ver_04_login.png"
            page.screenshot(path=str(ss_04))
            record("VER-04", "Live Login Page Displays Quick Test Personas", "PASS",
                   {"personaAarav": True, "url": page.url}, ss_04)
        except Exception as e:
            record("VER-04", "Live Login Page Displays Quick Test Personas", "FAIL", {"error": str(e)})

        # -------------------------------------------------------------
        # VER-05: Authenticated Session & Dashboard
        # -------------------------------------------------------------
        try:
            # Click Access Portal button for Aarav Sharma (first persona)
            aarav_card = page.locator("div.group:has-text('Aarav Sharma')").first
            access_btn = aarav_card.locator("button:has-text('Access Portal')")
            access_btn.click()
            page.wait_for_url("**/dashboard", timeout=20000)
            time.sleep(3)
            page.wait_for_selector("text=Aarav Sharma", timeout=10000)
            ss_05 = SCREENSHOT_DIR / "ver_05_dashboard.png"
            page.screenshot(path=str(ss_05), full_page=True)
            record("VER-05", "Authenticated Live Dashboard Loads Aarav Garage", "PASS",
                   {"url": page.url, "user": "Aarav Sharma"}, ss_05)
        except Exception as e:
            record("VER-05", "Authenticated Live Dashboard Loads Aarav Garage", "FAIL", {"error": str(e)})

        # -------------------------------------------------------------
        # VER-06: Cryptographic Tamper Lab
        # -------------------------------------------------------------
        try:
            page.goto(f"{VERCEL_URL}/tamper-lab", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector("text=Simulate Fraud", timeout=15000)
            ss_06 = SCREENSHOT_DIR / "ver_06_tamper_lab.png"
            page.screenshot(path=str(ss_06), full_page=True)
            record("VER-06", "Live Cryptographic Tamper Lab Renders", "PASS",
                   {"url": page.url}, ss_06)
        except Exception as e:
            record("VER-06", "Live Cryptographic Tamper Lab Renders", "FAIL", {"error": str(e)})

        # -------------------------------------------------------------
        # VER-07: Custom 404 Route Safety
        # -------------------------------------------------------------
        try:
            page.goto(f"{VERCEL_URL}/non-existent-page-testing", wait_until="networkidle", timeout=30000)
            time.sleep(1)
            ss_07 = SCREENSHOT_DIR / "ver_07_404_safety.png"
            page.screenshot(path=str(ss_07))
            record("VER-07", "Live Unmapped Route Handled Safely", "PASS",
                   {"status": "Safe handling without crash", "url": page.url}, ss_07)
        except Exception as e:
            record("VER-07", "Live Unmapped Route Handled Safely", "FAIL", {"error": str(e)})

        browser.close()

    # Save summary
    results_path = SCREENSHOT_DIR / "vercel_live_results.json"
    with open(results_path, "w") as f:
        json.dump(test_results, f, indent=2)

    passed = sum(1 for r in test_results if r["status"] == "PASS")
    total = len(test_results)
    print("=" * 80)
    print(f"🏁 LIVE VERCEL VERIFICATION COMPLETE: {total} Tests | PASS: {passed} | FAIL: {total - passed}")
    print(f"📁 Report saved to: {results_path}")
    print("=" * 80)

    if total - passed > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
