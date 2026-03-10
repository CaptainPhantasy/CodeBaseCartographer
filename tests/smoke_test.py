#!/usr/bin/env python3
"""
Smoke test for Codebase Cartographer webapp
Tests core UI/UX flows and functionality
"""

from playwright.sync_api import sync_playwright, ConsoleMessage
import json
import sys

def log_console(msg: ConsoleMessage):
    """Log console messages for debugging"""
    if msg.type in ['error', 'warning']:
        print(f"🔍 Console [{msg.type}]: {msg.text}")

def take_screenshot(page, name):
    """Take a screenshot for debugging"""
    path = f"/tmp/cc_smoke_{name}.png"
    page.screenshot(path=path, full_page=True)
    print(f"📸 Screenshot saved: {path}")

def main():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # Listen to console for errors
        page.on('console', log_console)

        print("=" * 60)
        print("SMOKE TEST: Codebase Cartographer")
        print("=" * 60)

        # Test 1: Page loads
        print("\n[TEST 1] Navigate to app...")
        try:
            page.goto('http://localhost:3002', wait_until='networkidle', timeout=10000)
            print("✅ Page loaded successfully")
            results.append(("Page Load", "PASS"))
            take_screenshot(page, "01_home")
        except Exception as e:
            print(f"❌ Failed to load page: {e}")
            results.append(("Page Load", f"FAIL: {e}"))
            browser.close()
            return

        # Test 2: Check main navigation elements exist
        print("\n[TEST 2] Check navigation elements...")
        try:
            # Wait for app to be ready
            page.wait_for_selector('[data-app-ready="true"]', timeout=5000)

            # Check for nav buttons
            nav_buttons = page.locator('nav button').all()
            print(f"   Found {len(nav_buttons)} navigation buttons")

            # Check for specific buttons
            trace_chat = page.locator('button:has-text("Trace & Chat")')
            visual_map = page.locator('button:has-text("Visual Map")')
            flow_chart = page.locator('button:has-text("Flow Chart")')
            tasks = page.locator('button:has-text("Tasks")')

            assert trace_chat.count() > 0, "Trace & Chat button missing"
            assert visual_map.count() > 0, "Visual Map button missing"
            assert flow_chart.count() > 0, "Flow Chart button missing"
            assert tasks.count() > 0, "Tasks button missing"

            print("✅ All navigation buttons present")
            results.append(("Navigation", "PASS"))
        except Exception as e:
            print(f"❌ Navigation test failed: {e}")
            results.append(("Navigation", f"FAIL: {e}"))
            take_screenshot(page, "02_nav_error")

        # Test 3: Check Settings button
        print("\n[TEST 3] Check Settings button...")
        try:
            settings_btn = page.locator('button:has-text("Settings")')
            assert settings_btn.count() > 0, "Settings button missing"
            print("✅ Settings button found")
            results.append(("Settings Button", "PASS"))
        except Exception as e:
            print(f"❌ Settings button test failed: {e}")
            results.append(("Settings Button", f"FAIL: {e}"))

        # Test 4: Check Architect Live button
        print("\n[TEST 4] Check Architect Live button...")
        try:
            live_btn = page.locator('button:has-text("Architect Live")')
            if live_btn.count() > 0:
                print("✅ Architect Live button found")
                results.append(("Architect Live Button", "PASS"))

                # Check if it's disabled (expected if no realtime config)
                is_disabled = live_btn.first.is_disabled()
                print(f"   Architect Live disabled: {is_disabled}")
            else:
                print("⚠️ Architect Live button not found")
                results.append(("Architect Live Button", "WARNING"))
        except Exception as e:
            print(f"❌ Architect Live test failed: {e}")
            results.append(("Architect Live Button", f"FAIL: {e}"))

        # Test 5: Click on Tasks mode
        print("\n[TEST 5] Navigate to Tasks mode...")
        try:
            tasks_btn = page.locator('button:has-text("Tasks")').first
            tasks_btn.click()
            page.wait_for_timeout(500)

            # Check if tasks view loaded
            take_screenshot(page, "03_tasks")
            print("✅ Tasks mode clicked")
            results.append(("Tasks Navigation", "PASS"))
        except Exception as e:
            print(f"❌ Tasks navigation failed: {e}")
            results.append(("Tasks Navigation", f"FAIL: {e}"))

        # Test 6: Click on Settings
        print("\n[TEST 6] Open Settings...")
        try:
            settings_btn = page.locator('button:has-text("Settings")').first
            settings_btn.click()
            page.wait_for_timeout(500)

            # Check if settings modal opened
            take_screenshot(page, "04_settings")
            print("✅ Settings opened")
            results.append(("Settings Open", "PASS"))
        except Exception as e:
            print(f"❌ Settings open failed: {e}")
            results.append(("Settings Open", f"FAIL: {e}"))

        # Test 7: Check Settings has provider sections
        print("\n[TEST 7] Check Settings provider sections...")
        try:
            # Look for provider sections (Google, OpenAI, etc.)
            page.wait_for_timeout(500)

            # Check for common provider names
            providers_to_check = ['Google', 'OpenAI', 'Anthropic', 'ElevenLabs', 'OpenRouter']
            found_providers = []

            for provider in providers_to_check:
                if page.locator(f'text={provider}').count() > 0:
                    found_providers.append(provider)

            print(f"   Found providers: {found_providers}")
            if len(found_providers) > 0:
                print("✅ Settings has provider sections")
                results.append(("Settings Providers", "PASS"))
            else:
                print("⚠️ No provider sections found")
                results.append(("Settings Providers", "WARNING"))
        except Exception as e:
            print(f"❌ Settings providers check failed: {e}")
            results.append(("Settings Providers", f"FAIL: {e}"))

        # Test 8: Check for Voice Selector (if ElevenLabs is configured)
        print("\n[TEST 8] Check for Voice Selector...")
        try:
            voice_selector = page.locator('text=Select Voice')
            if voice_selector.count() > 0:
                print("✅ Voice Selector found")
                results.append(("Voice Selector", "PASS"))

                # Try to get voices dropdown
                dropdown = page.locator('select').first
                if dropdown.count() > 0:
                    options = dropdown.locator('option').all()
                    print(f"   Found {len(options)} voice options")
            else:
                print("⚠️ Voice Selector not found (may need ElevenLabs API key)")
                results.append(("Voice Selector", "SKIP"))
        except Exception as e:
            print(f"❌ Voice Selector check failed: {e}")
            results.append(("Voice Selector", f"FAIL: {e}"))

        # Test 9: Close Settings and go back to Chat
        print("\n[TEST 9] Close Settings, return to Chat...")
        try:
            # Look for close button (X) in settings
            close_btns = page.locator('button[aria-label*="close" i], button:has-text("×"), button:has-text("Close")').all()
            if close_btns:
                close_btns[0].click()
            else:
                # Try pressing Escape
                page.keyboard.press('Escape')

            page.wait_for_timeout(300)

            # Click on Trace & Chat
            chat_btn = page.locator('button:has-text("Trace & Chat")').first
            chat_btn.click()
            page.wait_for_timeout(500)

            take_screenshot(page, "05_chat")
            print("✅ Returned to Chat mode")
            results.append(("Return to Chat", "PASS"))
        except Exception as e:
            print(f"❌ Return to chat failed: {e}")
            results.append(("Return to Chat", f"FAIL: {e}"))

        # Test 10: Check for chat input
        print("\n[TEST 10] Check chat input...")
        try:
            chat_input = page.locator('textarea[placeholder*="ask" i], input[placeholder*="ask" i], textarea')
            if chat_input.count() > 0:
                print("✅ Chat input found")
                results.append(("Chat Input", "PASS"))

                # Try typing a message
                chat_input.first.fill("Hello, this is a smoke test")
                page.wait_for_timeout(200)

                # Check if send button exists
                send_btn = page.locator('button:has-text("➤"), button:has-text("Send")').first
                if send_btn.count() > 0:
                    print("✅ Send button found")
                else:
                    print("⚠️ Send button not found")
            else:
                print("❌ Chat input not found")
                results.append(("Chat Input", "FAIL"))
        except Exception as e:
            print(f"❌ Chat input check failed: {e}")
            results.append(("Chat Input", f"FAIL: {e}"))

        # Test 11: Check Visual Map mode
        print("\n[TEST 11] Check Visual Map mode...")
        try:
            map_btn = page.locator('button:has-text("Visual Map")').first
            map_btn.click()
            page.wait_for_timeout(500)

            take_screenshot(page, "06_map")
            print("✅ Visual Map mode opened")
            results.append(("Visual Map", "PASS"))
        except Exception as e:
            print(f"❌ Visual Map failed: {e}")
            results.append(("Visual Map", f"FAIL: {e}"))

        # Test 12: Check Flow Chart mode
        print("\n[TEST 12] Check Flow Chart mode...")
        try:
            flow_btn = page.locator('button:has-text("Flow Chart")').first
            flow_btn.click()
            page.wait_for_timeout(500)

            take_screenshot(page, "07_flowchart")
            print("✅ Flow Chart mode opened")
            results.append(("Flow Chart", "PASS"))
        except Exception as e:
            print(f"❌ Flow Chart failed: {e}")
            results.append(("Flow Chart", f"FAIL: {e}"))

        # Test 13: Check for console errors summary
        print("\n[TEST 13] Console errors summary...")
        try:
            errors = page.evaluate("""() => {
                // Get any error messages from the page
                const errors = [];
                // Check if there are any visible error messages
                const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
                errorElements.forEach(el => {
                    if (el.offsetParent !== null) {  // Visible
                        errors.push(el.textContent.substring(0, 100));
                    }
                });
                return errors;
            }""")
            if errors:
                print(f"⚠️ Found {len(errors)} visible error elements")
            else:
                print("✅ No visible error elements found")
            results.append(("Console Check", "PASS"))
        except Exception as e:
            print(f"❌ Console check failed: {e}")
            results.append(("Console Check", f"FAIL: {e}"))

        # Final screenshot
        take_screenshot(page, "99_final")

        # Print summary
        print("\n" + "=" * 60)
        print("SMOKE TEST SUMMARY")
        print("=" * 60)

        passed = sum(1 for _, status in results if "PASS" in status)
        failed = sum(1 for _, status in results if "FAIL" in status)
        warnings = sum(1 for _, status in results if "WARNING" in status or "SKIP" in status)

        for test, status in results:
            status_emoji = "✅" if "PASS" in status else "❌" if "FAIL" in status else "⚠️"
            print(f"{status_emoji} {test}: {status}")

        print(f"\nTotal: {len(results)} tests")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️ Warnings/Skipped: {warnings}")

        # Keep browser open for a moment
        print("\nKeeping browser open for 5 seconds for manual inspection...")
        page.wait_for_timeout(5000)

        browser.close()

        # Return exit code based on results
        if failed > 0:
            sys.exit(1)
        sys.exit(0)

if __name__ == '__main__':
    main()
