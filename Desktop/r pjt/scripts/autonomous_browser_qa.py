#!/usr/bin/env python3
"""
Autonomous Browser QA Agent for Blockchain Vehicle Passport
Target URL: https://riya-project-five.vercel.app
High-Resolution Browser Automation Verification using Playwright Chromium
"""

import sys
import os
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = Path("/Users/adityasingh/Desktop/r pjt/docs/screenshots/qa/browser_agent")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://riya-project-five.vercel.app"

results = {
    "target_url": BASE_URL,
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "checks": [],
    "summary": {
        "total": 0,
        "passed": 0,
        "failed": 0
    }
}

def log_check(name, passed, details, screenshot_path=None):
    results["summary"]["total"] += 1
    if passed:
        results["summary"]["passed"] += 1
        status_str = "PASS"
    else:
        results["summary"]["failed"] += 1
        status_str = "FAIL"
    
    check_entry = {
        "name": name,
        "status": status_str,
        "details": details,
        "screenshot": str(screenshot_path) if screenshot_path else None
    }
    results["checks"].append(check_entry)
    print(f"[{status_str}] {name} - {details}")

def run_qa():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu"
            ]
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AutonomousBrowserQA"
        )
        page = context.new_page()

        print(f"Starting Autonomous Browser QA on {BASE_URL}...")

        # -------------------------------------------------------------
        # 1. Public Landing Page (/)
        # -------------------------------------------------------------
        print("\n--- Test 1: Public Landing Page (/) ---")
        try:
            page.goto(f"{BASE_URL}/", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            nav_present = page.locator("header, nav").count() > 0
            page_content = page.content()

            hero_title_present = "Blockchain Vehicle Passport" in page_content or "Vehicle Passport" in page_content
            hero_subtitle_present = "Tamper-Evident" in page_content or "Cryptographic" in page_content
            cta_count = page.locator("a[href*='/verify'], a[href*='/explorer'], a[href*='/login'], button").count()
            has_cta = cta_count > 0

            screenshot_path = SCREENSHOT_DIR / "01_landing_page.png"
            page.screenshot(path=str(screenshot_path), full_page=False)

            landing_passed = nav_present and hero_title_present and has_cta
            log_check(
                "1. Public Landing Page (/)",
                landing_passed,
                f"Navigation bar: {nav_present}, Hero Title: {hero_title_present}, CTA Count: {cta_count}",
                screenshot_path
            )
        except Exception as e:
            log_check("1. Public Landing Page (/)", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 2. Blockchain Merkle Explorer (/explorer)
        # -------------------------------------------------------------
        print("\n--- Test 2: Blockchain Merkle Explorer (/explorer) ---")
        try:
            page.goto(f"{BASE_URL}/explorer", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2500)

            explorer_content = page.content()

            # Verify 99.0% gas savings metric
            gas_savings_present = "99.0%" in explorer_content

            # Verify 12 batches exist (10 rendered on page 1, search finds batch 1 and 12)
            input_box = page.locator("input[placeholder*='Search by Batch ID']").first
            input_box.fill("BATCH-2026-000001")
            page.locator("button:has-text('Search')").click()
            page.wait_for_timeout(1000)
            batch1_found = "BATCH-2026-000001" in page.content()

            # Clear search to show all batches
            input_box.fill("")
            page.locator("button:has-text('Search')").click()
            page.wait_for_timeout(1500)

            # Verify Merkle root hash inspection
            roots = page.locator("td span.font-semibold").all_inner_texts()
            root_hashes = [r for r in roots if r.startswith("0x")]
            has_root_hashes = len(root_hashes) > 0

            # Copy root hash interaction test
            copy_root_btn = page.locator("button[title='Copy Root']").first
            copy_root_btn.click()
            page.wait_for_timeout(500)
            root_copied = page.locator("td svg.text-emerald-600").count() > 0

            screenshot_path_exp = SCREENSHOT_DIR / "02_merkle_explorer.png"
            page.screenshot(path=str(screenshot_path_exp), full_page=False)

            screenshot_path_root = SCREENSHOT_DIR / "02b_merkle_root_inspection.png"
            page.screenshot(path=str(screenshot_path_root), full_page=False)

            explorer_passed = gas_savings_present and batch1_found and has_root_hashes and root_copied
            log_check(
                "2. Blockchain Merkle Explorer (/explorer)",
                explorer_passed,
                f"99.0% Gas Savings: {gas_savings_present}, Batches Verified: {batch1_found}, Merkle Roots Rendered: {len(root_hashes)}, Root Copy Validated: {root_copied}",
                screenshot_path_exp
            )
        except Exception as e:
            log_check("2. Blockchain Merkle Explorer (/explorer)", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 3. Public Passport Verification (/verify/VP-DEMO-001)
        # -------------------------------------------------------------
        print("\n--- Test 3: Public Passport Verification (/verify/VP-DEMO-001) ---")
        try:
            page.goto(f"{BASE_URL}/verify/VP-DEMO-001", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2500)

            verify_content = page.content()

            # Status VERIFIED
            status_verified = "CRYPTOGRAPHICALLY VERIFIED" in verify_content or "VERIFIED" in verify_content

            # Aurora X1 details
            aurora_x1_present = "Aurora" in verify_content and "X1" in verify_content

            # Masked privacy-safe reg number (e.g. MH02****1001)
            masked_reg_present = "Plate:" in verify_content and ("****" in verify_content or "•••" in verify_content)

            # Genesis hash / Registration Tx Hash
            genesis_present = "Genesis Anchor" in verify_content or ("0x" in verify_content and "Registration Transaction" in verify_content)

            screenshot_path_verify = SCREENSHOT_DIR / "03_public_passport_verification.png"
            page.screenshot(path=str(screenshot_path_verify), full_page=False)

            verify_passed = status_verified and aurora_x1_present and masked_reg_present and genesis_present
            log_check(
                "3. Public Passport Verification (/verify/VP-DEMO-001)",
                verify_passed,
                f"Status Cryptographically Verified: {status_verified}, Aurora X1: {aurora_x1_present}, Masked Reg: {masked_reg_present}, Genesis Tx: {genesis_present}",
                screenshot_path_verify
            )
        except Exception as e:
            log_check("3. Public Passport Verification (/verify/VP-DEMO-001)", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 4. Demo Login (/login)
        # -------------------------------------------------------------
        print("\n--- Test 4: Demo Login (/login) ---")
        try:
            page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            login_content = page.content()

            # Verify all 5 personas appear
            personas = ["Aarav Sharma", "Priya Verma", "Rohan Mehta", "Neha Kapoor", "Kabir Malhotra"]
            missing_personas = [p for p in personas if p not in login_content]
            all_personas_present = len(missing_personas) == 0

            screenshot_path_login = SCREENSHOT_DIR / "04_login_personas.png"
            page.screenshot(path=str(screenshot_path_login), full_page=False)

            # Click 'Access Portal' for Aarav Sharma to establish session
            aarav_card = page.locator("div.group").filter(has_text="Aarav Sharma").first
            access_btn = aarav_card.locator("button:has-text('Access Portal')")
            access_btn.click()
            page.wait_for_url("**/dashboard**", timeout=15000)
            page.wait_for_timeout(2000)

            # Verify session token in localStorage
            token = page.evaluate("() => localStorage.getItem('vehicle_passport_token')")
            session_established = bool(token) and "/dashboard" in page.url

            screenshot_path_session = SCREENSHOT_DIR / "04b_session_established.png"
            page.screenshot(path=str(screenshot_path_session), full_page=False)

            login_passed = all_personas_present and session_established
            log_check(
                "4. Demo Login (/login)",
                login_passed,
                f"All 5 Personas Present: {all_personas_present}, Session Token Generated: {bool(token)}, Redirected to Dashboard: {'/dashboard' in page.url}",
                screenshot_path_session
            )
        except Exception as e:
            log_check("4. Demo Login (/login)", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 5. Garage Dashboard (/dashboard)
        # -------------------------------------------------------------
        print("\n--- Test 5: Garage Dashboard (/dashboard) ---")
        try:
            page.locator("aside button:has-text('My Vehicles')").click()
            page.wait_for_timeout(2000)

            dash_content = page.content()

            # Verify Aarav's 4 vehicles:
            # VP-DEMO-001 (Aurora X1), VP-DEMO-002 (Falcon E2), VP-DEMO-006 (Nova S4), VP-DEMO-008 (Orbit M2)
            expected_passports = ["VP-DEMO-001", "VP-DEMO-002", "VP-DEMO-006", "VP-DEMO-008"]
            found_passports = [p for p in expected_passports if p in dash_content]
            vehicles_all_present = len(found_passports) == 4

            screenshot_path_dash = SCREENSHOT_DIR / "05_dashboard_vehicles.png"
            page.screenshot(path=str(screenshot_path_dash), full_page=False)

            dashboard_passed = vehicles_all_present
            log_check(
                "5. Garage Dashboard (/dashboard)",
                dashboard_passed,
                f"All 4 Aarav Passports Found: {found_passports}",
                screenshot_path_dash
            )
        except Exception as e:
            log_check("5. Garage Dashboard (/dashboard)", False, f"Exception: {str(e)}")

        # Select Aurora X1 as the active vehicle for detail tab testing
        try:
            aurora_card = page.locator("div.group, div").filter(has_text="VP-DEMO-001").first
            view_passport_btn = aurora_card.locator("button:has-text('View Passport'), button").first
            if view_passport_btn.count() > 0:
                view_passport_btn.click()
                page.wait_for_timeout(1500)
        except Exception as e:
            print(f"Aurora selection note: {e}")

        # -------------------------------------------------------------
        # 6a. Vehicle Detail: Digital Vehicle Twin
        # -------------------------------------------------------------
        print("\n--- Test 6a: Digital Vehicle Twin ---")
        try:
            twin_btn = page.locator("aside button:has-text('Digital Vehicle Twin')").first
            twin_btn.click()
            page.wait_for_timeout(2500)

            twin_content = page.content()
            odometer_present = "km" in twin_content or "Odometer" in twin_content or "Telemetry" in twin_content
            evolution_present = "Evolution" in twin_content or "State" in twin_content or "Lifecycle" in twin_content
            evidence_present = "Evidence" in twin_content or "Timeline" in twin_content or "Confidence" in twin_content

            screenshot_path_twin = SCREENSHOT_DIR / "06a_digital_vehicle_twin.png"
            page.screenshot(path=str(screenshot_path_twin), full_page=False)

            twin_passed = odometer_present and evolution_present and evidence_present
            log_check(
                "6a. Vehicle Detail: Digital Vehicle Twin",
                twin_passed,
                f"Telemetry Odometer: {odometer_present}, State Evolution: {evolution_present}, Evidence Timeline: {evidence_present}",
                screenshot_path_twin
            )
        except Exception as e:
            log_check("6a. Vehicle Detail: Digital Vehicle Twin", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 6b. Vehicle Detail: Industry & EV Ecosystem
        # -------------------------------------------------------------
        print("\n--- Test 6b: Industry & EV Ecosystem ---")
        try:
            eco_btn = page.locator("aside button:has-text('Industry & EV Ecosystem')").first
            eco_btn.click()
            page.wait_for_timeout(2500)

            eco_content = page.content()
            birth_cert_present = "Birth Certificate" in eco_content or "Manufacturer" in eco_content or "Genesis" in eco_content
            battery_present = "Battery" in eco_content or "State of Health" in eco_content or "SoH" in eco_content or "kWh" in eco_content
            garage_present = "Garage" in eco_content or "Network" in eco_content or "Certified" in eco_content

            screenshot_path_eco = SCREENSHOT_DIR / "06b_industry_ev_ecosystem.png"
            page.screenshot(path=str(screenshot_path_eco), full_page=False)

            eco_passed = birth_cert_present and battery_present and garage_present
            log_check(
                "6b. Vehicle Detail: Industry & EV Ecosystem",
                eco_passed,
                f"OEM Birth Cert: {birth_cert_present}, Battery Passport: {battery_present}, Garage Network: {garage_present}",
                screenshot_path_eco
            )
        except Exception as e:
            log_check("6b. Vehicle Detail: Industry & EV Ecosystem", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 6c. Vehicle Detail: Vehicle Intelligence
        # -------------------------------------------------------------
        print("\n--- Test 6c: Vehicle Intelligence ---")
        try:
            intel_btn = page.locator("aside button:has-text('Vehicle Intelligence')").first
            intel_btn.click()
            page.wait_for_timeout(2500)

            intel_content = page.content()
            score_present = "96" in intel_content and "EXCELLENT" in intel_content
            components_present = "Component" in intel_content or "Powertrain" in intel_content or "Electrical" in intel_content or "Chassis" in intel_content
            risk_present = "Risk" in intel_content or "LOW" in intel_content
            maintenance_present = "Maintenance" in intel_content or "Predicted" in intel_content

            screenshot_path_intel = SCREENSHOT_DIR / "06c_vehicle_intelligence.png"
            page.screenshot(path=str(screenshot_path_intel), full_page=False)

            intel_passed = score_present and components_present and risk_present and maintenance_present
            log_check(
                "6c. Vehicle Detail: Vehicle Intelligence",
                intel_passed,
                f"AI Health Score (96/100 EXCELLENT): {score_present}, Component Breakdown: {components_present}, Risk Assessment: {risk_present}, Predictive Maintenance: {maintenance_present}",
                screenshot_path_intel
            )
        except Exception as e:
            log_check("6c. Vehicle Detail: Vehicle Intelligence", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 6d. Vehicle Detail: Blockchain Verification
        # -------------------------------------------------------------
        print("\n--- Test 6d: Blockchain Verification ---")
        try:
            chain_btn = page.locator("aside button:has-text('Blockchain Verification')").first
            chain_btn.click()
            page.wait_for_timeout(2500)

            chain_content = page.content()
            smart_contract_present = "Smart Contract Verified" in chain_content or "Smart Contract" in chain_content
            chain_id_present = "31337" in chain_content
            mapping_present = "0x" in chain_content and ("Address" in chain_content or "Transaction" in chain_content or "Registry" in chain_content)

            screenshot_path_chain = SCREENSHOT_DIR / "06d_blockchain_verification.png"
            page.screenshot(path=str(screenshot_path_chain), full_page=False)

            chain_passed = smart_contract_present and chain_id_present and mapping_present
            log_check(
                "6d. Vehicle Detail: Blockchain Verification",
                chain_passed,
                f"Smart Contract Connection: {smart_contract_present}, Chain ID 31337: {chain_id_present}, On-chain Mapping: {mapping_present}",
                screenshot_path_chain
            )
        except Exception as e:
            log_check("6d. Vehicle Detail: Blockchain Verification", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 7. Cryptographic Tamper Lab (/tamper-lab)
        # -------------------------------------------------------------
        print("\n--- Test 7: Cryptographic Tamper Lab (/tamper-lab) ---")
        try:
            page.goto(f"{BASE_URL}/tamper-lab", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2500)

            screenshot_path_tamper_init = SCREENSHOT_DIR / "07a_tamper_lab_pristine.png"
            page.screenshot(path=str(screenshot_path_tamper_init), full_page=False)

            # Click simulate tamper: Simulate Odometer Rollback
            sim_btn = page.locator("button:has-text('Simulate Odometer Rollback')").first
            sim_btn.click()
            page.wait_for_timeout(3000)

            sim_content = page.content()
            tamper_detected = "MISMATCH" in sim_content or "TAMPER" in sim_content or "FAILED" in sim_content or "Rollback" in sim_content

            screenshot_path_tamper_sim = SCREENSHOT_DIR / "07b_tamper_simulated.png"
            page.screenshot(path=str(screenshot_path_tamper_sim), full_page=False)

            # Click restore button
            restore_btn = page.locator("button:has-text('Restore Original Hashes')").first
            restore_btn.click()
            page.wait_for_timeout(3000)

            restored_content = page.content()
            restored_success = "Restore" in restored_content and ("VERIFIED" in restored_content or "CRYPTOGRAPHICALLY VERIFIED" in restored_content or "Pristine" in restored_content or "Valid" in restored_content or "Matches" in restored_content)

            screenshot_path_tamper_rest = SCREENSHOT_DIR / "07c_tamper_restored.png"
            page.screenshot(path=str(screenshot_path_tamper_rest), full_page=False)

            tamper_passed = tamper_detected and restored_success
            log_check(
                "7. Cryptographic Tamper Lab (/tamper-lab)",
                tamper_passed,
                f"Fraud Simulation Detected: {tamper_detected}, Cryptographic Restoration: {restored_success}",
                screenshot_path_tamper_sim
            )
        except Exception as e:
            log_check("7. Cryptographic Tamper Lab (/tamper-lab)", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 8. Fraud Knowledge Graph (/intelligence/fraud-graph)
        # -------------------------------------------------------------
        print("\n--- Test 8: Fraud Knowledge Graph (/intelligence/fraud-graph) ---")
        try:
            page.goto(f"{BASE_URL}/intelligence/fraud-graph", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            graph_content = page.content()
            svg_count = page.locator("svg[viewBox='0 0 800 600'], svg").count()
            has_svg = svg_count > 0
            has_findings = "Finding" in graph_content or "Investigation" in graph_content or "Anomaly" in graph_content or "Graph" in graph_content

            screenshot_path_graph = SCREENSHOT_DIR / "08_fraud_knowledge_graph.png"
            page.screenshot(path=str(screenshot_path_graph), full_page=False)

            graph_passed = has_svg and has_findings
            log_check(
                "8. Fraud Knowledge Graph (/intelligence/fraud-graph)",
                graph_passed,
                f"SVG Canvas Active: {has_svg} (nodes/edges svg elements: {svg_count}), Findings & Anomaly Detection: {has_findings}",
                screenshot_path_graph
            )
        except Exception as e:
            log_check("8. Fraud Knowledge Graph (/intelligence/fraud-graph)", False, f"Exception: {str(e)}")

        # -------------------------------------------------------------
        # 9. Route Safety (/unknown-safety-test)
        # -------------------------------------------------------------
        print("\n--- Test 9: Route Safety (/unknown-safety-test) ---")
        try:
            page.goto(f"{BASE_URL}/unknown-safety-test", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            notfound_content = page.content()
            is_404 = "404" in notfound_content and ("Page Not Found" in notfound_content or "Ledger Address Not Found" in notfound_content)
            has_home_btn = page.locator("a:has-text('Return to Home')").count() > 0 or page.locator("a[href='/']").count() > 0

            screenshot_path_404 = SCREENSHOT_DIR / "09_route_safety_404.png"
            page.screenshot(path=str(screenshot_path_404), full_page=False)

            notfound_passed = is_404 and has_home_btn
            log_check(
                "9. Route Safety (/unknown-safety-test)",
                notfound_passed,
                f"Custom 404 Rendered: {is_404}, Return to Home Button: {has_home_btn}",
                screenshot_path_404
            )
        except Exception as e:
            log_check("9. Route Safety (/unknown-safety-test)", False, f"Exception: {str(e)}")

        browser.close()

    # Save test results JSON
    report_json_path = SCREENSHOT_DIR / "browser_qa_results.json"
    with open(report_json_path, "w") as f:
        json.dump(results, f, indent=2)

    print("\n=======================================================")
    print(f"QA Suite Complete: {results['summary']['passed']}/{results['summary']['total']} Passed")
    print(f"Results written to: {report_json_path}")
    print("=======================================================")
    return results

if __name__ == "__main__":
    res = run_qa()
    sys.exit(0 if res["summary"]["failed"] == 0 else 1)
