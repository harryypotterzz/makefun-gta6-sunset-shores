#!/usr/bin/env python3
"""Full play session for Sunset Shores in a headless browser.

Drives the game with a fixed seed through its whole loop and asserts
there are zero console errors and zero page errors:
  title -> ENTER -> walk -> steal a car with E -> drive
  -> M starts a mission -> complete it -> steal a second car
  -> wanted rises -> police spawn -> pause and resume.
Prints PASS/FAIL and exits non-zero on failure.

Usage: /home/hatch/workspace/makefun/.pwvenv/bin/python playtest.py
"""

import os
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 8903
URL = f"http://localhost:{PORT}/game/index.html"

CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))
    return ok


def wait_for_server(timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(URL, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def main():
    from playwright.sync_api import sync_playwright

    server = subprocess.Popen(
        ["node", "serve.ts", str(PORT)],
        cwd=HERE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    failures = 0
    try:
        if not wait_for_server():
            print("FAIL: dev server did not come up")
            return 1

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            errors = []
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

            page.goto(URL)
            page.wait_for_timeout(900)

            state = page.evaluate("window.__sunset.state()")
            if not check("title screen shows on load", state == "title", f"state={state}"):
                failures += 1

            # Start the game.
            page.keyboard.press("Enter")
            page.wait_for_timeout(400)
            state = page.evaluate("window.__sunset.state()")
            if not check("ENTER starts the game", state == "playing", f"state={state}"):
                failures += 1

            # Walk: hold Up and confirm the player moved.
            before = page.evaluate("window.__sunset.player()")
            page.keyboard.down("ArrowUp")
            page.wait_for_timeout(700)
            page.keyboard.up("ArrowUp")
            after = page.evaluate("window.__sunset.player()")
            moved = abs(after["y"] - before["y"]) + abs(after["x"] - before["x"])
            if not check("walking moves the player", moved > 30, f"moved {moved:.0f}px"):
                failures += 1

            # Steal a car: put a parked car beside the player, press E.
            page.evaluate("window.__sunset.debug.spawnParkedNear(30, 0)")
            page.wait_for_timeout(150)
            page.keyboard.press("KeyE")
            page.wait_for_timeout(300)
            player = page.evaluate("window.__sunset.player()")
            if not check("E steals a car", player["inCar"], f"inCar={player['inCar']}"):
                failures += 1
            if not check("stealing raises wanted to 1", player["wanted"] >= 1, f"wanted={player['wanted']}"):
                failures += 1

            # Drive: hold Up and confirm speed and movement.
            before = page.evaluate("window.__sunset.player()")
            page.keyboard.down("ArrowUp")
            page.wait_for_timeout(1500)
            page.keyboard.up("ArrowUp")
            after = page.evaluate("window.__sunset.player()")
            if not check("driving builds speed", after["speed"] > 50, f"speed={after['speed']}"):
                failures += 1
            drove = abs(after["y"] - before["y"]) + abs(after["x"] - before["x"])
            if not check("driving moves the car", drove > 100, f"moved {drove:.0f}px"):
                failures += 1

            # Mission: M starts one, teleport to its target, it completes.
            money_before = page.evaluate("window.__sunset.player()")["money"]
            page.keyboard.press("KeyM")
            page.wait_for_timeout(300)
            mission = page.evaluate("window.__sunset.mission()")
            if not check("M starts a mission", mission is not None, f"mission={mission}"):
                failures += 1
            else:
                page.evaluate("window.__sunset.debug.teleportToMissionTarget()")
                page.wait_for_timeout(900)
                done = page.evaluate("window.__sunset.missionsDone()")
                money_after = page.evaluate("window.__sunset.player()")["money"]
                if not check("mission completes at its target", done >= 1, f"missionsDone={done}"):
                    failures += 1
                if not check("mission pays money", money_after > money_before,
                             f"${money_before} -> ${money_after}"):
                    failures += 1

            # Second steal: exit, steal another car, wanted rises to 2.
            page.keyboard.press("KeyE")
            page.wait_for_timeout(200)
            page.evaluate("window.__sunset.debug.spawnParkedNear(30, 0)")
            page.wait_for_timeout(150)
            page.keyboard.press("KeyE")
            page.wait_for_timeout(300)
            player = page.evaluate("window.__sunset.player()")
            if not check("second steal raises wanted to 2", player["wanted"] >= 2,
                         f"wanted={player['wanted']}"):
                failures += 1

            # Police: wanted 2 must bring two cruisers within a few seconds.
            page.wait_for_timeout(3000)
            cops = page.evaluate("window.__sunset.policeCount()")
            if not check("police spawn at wanted 2", cops >= 2, f"police={cops}"):
                failures += 1

            # Pause and resume.
            page.keyboard.press("KeyP")
            page.wait_for_timeout(300)
            state = page.evaluate("window.__sunset.state()")
            if not check("P pauses the game", state == "paused", f"state={state}"):
                failures += 1
            page.keyboard.press("KeyP")
            page.wait_for_timeout(300)
            state = page.evaluate("window.__sunset.state()")
            if not check("P resumes the game", state == "playing", f"state={state}"):
                failures += 1

            # Zero console errors across the whole session.
            if not check("zero console/page errors", len(errors) == 0, f"{len(errors)} errors"):
                failures += 1
                for e in errors[:8]:
                    print("   ", e)

            browser.close()

        print()
        if failures == 0:
            print(f"PLAYTEST PASS ({len(CHECKS)} checks)")
            return 0
        print(f"PLAYTEST FAIL ({failures} of {len(CHECKS)} checks failed)")
        return 1
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    sys.exit(main())
