#!/usr/bin/env python3
"""Serve Sunset Shores (this rebuild) and capture its 4 staged screenshots.

Reads shots.json, opens each ?shot= URL in a desktop-size browser, waits for
window.__shotReady, and writes a JPEG into screenshots/ (1280x720, <=256 KiB).
Uses only the standard library plus Playwright for the browser, and serves
game/ with Python's own http.server so no project file is executed to serve.
Usage: python take_shots.py [port]
"""
import json
import os
import subprocess
import sys
import time

ENTRY = os.path.expanduser("~/workspace/makefun/entries/gta6")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8901

from playwright.sync_api import sync_playwright

GAME_DIR = os.path.join(ENTRY, "game")

# Serve game/ on 127.0.0.1 with the standard library only.
server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
    cwd=GAME_DIR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
)
time.sleep(1.5)

errors = []
try:
    with open(os.path.join(ENTRY, "shots.json")) as f:
        shots = json.load(f)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        for shot in shots:
            url = f"http://127.0.0.1:{PORT}/{shot['query']}"
            page.goto(url)
            try:
                page.wait_for_function("window.__shotReady === true", timeout=15000)
            except Exception as e:
                errors.append(f"{shot['name']}: __shotReady timeout ({e})")
            page.wait_for_timeout(400)
            out = os.path.join(ENTRY, "screenshots", shot["name"])
            page.screenshot(path=out, type="jpeg", quality=85)
            print(shot["name"], os.path.getsize(out), "bytes")
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()

print("--- console/page errors ---")
for e in errors:
    print(e)
print("--- done ---")
