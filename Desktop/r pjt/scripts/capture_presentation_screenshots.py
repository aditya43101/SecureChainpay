import time
import os
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.abspath("docs/screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def run():
    print(f"📸 Starting automated presentation screenshot capture into {SCREENSHOT_DIR}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 920}, device_scale_factor=1.5)
        page = context.new_page()

        # 1. Landing Page
        print("1. Capturing Landing Page...")
        page.goto("http://localhost:3000", wait_until="networkidle")
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_landing_page.png"), full_page=False)

        # 2. Login Page
        print("2. Capturing Stakeholder Login Page...")
        page.goto("http://localhost:3000/login", wait_until="networkidle")
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_login_stakeholders.png"), full_page=False)

        # Authenticate as Test Owner A (Alex Mercer)
        print("Logging in as Alex Mercer...")
        owner_btn = page.locator('button:has-text("Access Portal")').first
        if owner_btn.count() > 0:
            owner_btn.click()
        else:
            # Fallback by text
            page.locator('text="Test Owner A (Alex Mercer)"').first.click()
        
        page.wait_for_url("**/dashboard", timeout=10000)
        time.sleep(2)

        # 3. Dashboard Overview
        print("3. Capturing Vehicle Passport Dashboard...")
        # Select Tata Nexon EV if needed
        nexon_card = page.locator('text="Tata Nexon EV"').first
        if nexon_card.count() > 0:
            nexon_card.click()
            time.sleep(1.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "03_dashboard_overview.png"), full_page=False)

        # 4. Lifecycle Timeline
        print("4. Capturing Lifecycle Timeline...")
        timeline_btn = page.locator('button:has-text("Timeline")').first
        if timeline_btn.count() > 0:
            timeline_btn.click()
            time.sleep(1)
        page.evaluate("window.scrollBy(0, 450)")
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "04_lifecycle_timeline.png"), full_page=False)

        # 5. Full Cryptographic Verification Audit
        print("5. Capturing Verification Audit Modal...")
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.5)
        verify_btn = page.locator('button:has-text("Full Verification Audit")').first
        if verify_btn.count() > 0:
            verify_btn.click()
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "05_cryptographic_verification.png"), full_page=False)
            # Close modal if open
            close_btn = page.locator('button:has-text("×")').first
            if close_btn.count() > 0:
                close_btn.click()
                time.sleep(0.5)

        # 6. Tamper Lab — Clean Verified State
        print("6. Capturing Tamper Lab (Clean State)...")
        page.goto("http://localhost:3000/tamper-lab", wait_until="networkidle")
        time.sleep(1.5)
        # Select Tata Nexon EV
        select_el = page.locator('select').first
        if select_el.count() > 0:
            for opt in select_el.locator('option').all():
                if "VP-000001" in opt.text_content() or "Nexon" in opt.text_content():
                    select_el.select_option(opt.get_attribute('value'))
                    time.sleep(1)
                    break
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "06_tamper_lab_verified.png"), full_page=False)

        # 7. Tamper Lab — Rollback Simulation (Tamper Detected)
        print("7. Capturing Tamper Lab (Tamper Detected)...")
        rollback_btn = page.locator('button:has-text("Simulate Odometer Rollback")').first
        if rollback_btn.count() > 0:
            rollback_btn.click()
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "07_tamper_lab_detected.png"), full_page=False)
            # Restore state immediately
            restore_btn = page.locator('button:has-text("Restore Original Hashes")').first
            if restore_btn.count() > 0:
                restore_btn.click()
                time.sleep(1.5)
                print("   -> Database successfully restored to clean state.")

        # 8. Digital Vehicle Twin & Buyer Intelligence
        print("8. Capturing Digital Twin & Buyer Intelligence...")
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        time.sleep(1)
        twin_tab = page.locator('button:has-text("Digital Twin")').first
        if twin_tab.count() > 0:
            twin_tab.click()
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "08_digital_twin_buyer_report.png"), full_page=False)
        else:
            page.goto("http://localhost:3000/intelligence/twin", wait_until="networkidle")
            time.sleep(1.5)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "08_digital_twin_buyer_report.png"), full_page=False)

        # 9. Blockchain Explorer
        print("9. Capturing Blockchain Explorer...")
        page.goto("http://localhost:3000/explorer", wait_until="networkidle")
        time.sleep(1.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "09_blockchain_explorer.png"), full_page=False)

        # 10. Merkle Batch Explorer
        print("10. Capturing Merkle Batch Explorer...")
        page.goto("http://localhost:3000/explorer/batches", wait_until="networkidle")
        time.sleep(1.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "10_merkle_batches.png"), full_page=False)

        # 11. Public Verification Portal (Unauthenticated Incognito context)
        print("11. Capturing Public Verification Portal with PII Masking...")
        incognito_context = browser.new_context(viewport={"width": 1440, "height": 920}, device_scale_factor=1.5)
        incognito_page = incognito_context.new_page()
        incognito_page.goto("http://localhost:3000/verify/VP-000001", wait_until="networkidle")
        time.sleep(1.5)
        incognito_page.screenshot(path=os.path.join(SCREENSHOT_DIR, "11_public_verification_pii_masked.png"), full_page=False)

        browser.close()
        print("🎉 All 11 presentation screenshots captured successfully!")

if __name__ == "__main__":
    run()
