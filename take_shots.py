#!/usr/bin/env python3
"""Take the four Sunset Shores screenshots with a headless browser.

Opens each scene (?scene=...) of game/index.html at 1280x720 and saves
a JPEG into screenshots/. Retries at lower quality if a shot is over the
256 KiB gate. Starts its own dev server on port 8903 and stops it after.

Usage: /home/hatch/workspace/makefun/.pwvenv/bin/python take_shots.py
"""

import json
import os
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 8903
BASE = f"http://localhost:{PORT}/game/index.html"
SHOTS = [
    ("1-chase", "chase"),
    ("2-mission", "mission"),
    ("3-drive", "drive"),
    ("4-title", "title"),
]
MAX_BYTES = 256 * 1024


def wait_for_server(timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://localhost:{PORT}/game/index.html", timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def main():
    from playwright.sync_api import sync_playwright

    out_dir = os.path.join(HERE, "screenshots")
    os.makedirs(out_dir, exist_ok=True)

    server = subprocess.Popen(
        ["node", "serve.ts", str(PORT)],
        cwd=HERE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        if not wait_for_server():
            print("FAIL: dev server did not come up")
            return 1

        results = {}
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            for name, scene in SHOTS:
                path = os.path.join(out_dir, f"{name}.jpg")
                page.goto(f"{BASE}?scene={scene}")
                page.wait_for_timeout(1600)
                quality = 82
                while True:
                    page.screenshot(path=path, type="jpeg", quality=quality)
                    size = os.path.getsize(path)
                    if size <= MAX_BYTES or quality <= 40:
                        break
                    quality -= 18
                results[name] = {"scene": scene, "bytes": size, "quality": quality}
                print(f"{name}.jpg ({scene}): {size} bytes, quality {quality}")
            if errors:
                print(f"NOTE: {len(errors)} console/page errors during shots:")
                for e in errors[:5]:
                    print("  ", e)
            browser.close()

        over = [n for n, r in results.items() if r["bytes"] > MAX_BYTES]
        if over:
            print(f"FAIL: over 256 KiB: {over}")
            return 1
        print("take_shots.py: all 4 screenshots OK")
        return 0
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    sys.exit(main())
