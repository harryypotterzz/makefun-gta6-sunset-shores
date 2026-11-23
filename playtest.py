#!/usr/bin/env python3
"""Live playtest of the rebuilt Sunset Shores: start, walk, steal a car,
drive, take a mission, and report the game state after each step.
Serves game/ with Python's http.server and drives it with Playwright.
Usage: python playtest.py [port]
"""
import os
import subprocess
import sys
import time

ENTRY = os.path.expanduser("~/workspace/makefun/entries/gta6")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8902
GAME_DIR = os.path.join(ENTRY, "game")

from playwright.sync_api import sync_playwright

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
    cwd=GAME_DIR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
)
time.sleep(1.5)

errors = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        page.goto(f"http://127.0.0.1:{PORT}/?seed=7")
        page.wait_for_timeout(800)

        def state():
            return page.evaluate("""() => {
              const g = window.__game;
              if (!g) return 'no game';
              return JSON.stringify({
                state: g.state, money: g.money, wanted: g.wanted,
                health: Math.round(g.player.health),
                px: Math.round(g.player.x), py: Math.round(g.player.y),
                inCar: !!g.player.car, speed: g.player.car ? Math.round(g.player.car.speed) : 0,
                traffic: g.traffic.length, parked: g.parked.length,
                police: g.police.length, peds: g.peds.length,
                mission: g.missions.current ? g.missions.current.type : null,
                missionsDone: g.missions.completed,
              });
            }""")

        print("initial:", state())
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)
        print("after ENTER:", state())
        # Walk up-left for a bit.
        page.keyboard.down("KeyW")
        page.keyboard.down("KeyA")
        page.wait_for_timeout(1200)
        page.keyboard.up("KeyW")
        page.keyboard.up("KeyA")
        print("after walking:", state())
        # Teleport next to a parked car and steal it (E).
        page.evaluate("""() => {
          const g = window.__game;
          const car = g.parked[0] || g.traffic[0];
          g.player.x = car.x + 20; g.player.y = car.y;
          g.cam.x = car.x; g.cam.y = car.y;
        }""")
        page.keyboard.press("KeyE")
        page.wait_for_timeout(400)
        print("after E (steal):", state())
        # Drive forward.
        page.keyboard.down("KeyW")
        page.wait_for_timeout(2500)
        page.keyboard.up("KeyW")
        print("after driving:", state())
        # Take a mission.
        page.keyboard.press("KeyM")
        page.wait_for_timeout(400)
        print("after M (mission):", state())
        # Drive toward the mission target for a while.
        page.evaluate("""() => {
          const g = window.__game;
          const m = g.missions.current;
          if (m) { g.player.car.x = m.target.x - 200; g.player.car.y = m.target.y; g.player.x = g.player.car.x; g.player.y = g.player.car.y; }
        }""")
        page.keyboard.down("KeyW")
        page.wait_for_timeout(1500)
        page.keyboard.up("KeyW")
        print("near target:", state())
        # Force a wanted level and check police spawn.
        page.evaluate("() => { window.__game.addWanted(2); }")
        page.wait_for_timeout(3500)
        print("wanted 2, police should spawn:", state())
        # Pause / resume.
        page.keyboard.press("KeyP")
        page.wait_for_timeout(300)
        print("paused:", state())
        page.keyboard.press("KeyP")
        page.wait_for_timeout(300)
        print("resumed:", state())
        # Live screenshot (not staged).
        live = os.path.join(ENTRY, "qa-live.jpg")
        page.screenshot(path=live, type="jpeg", quality=85)
        print("live screenshot saved, size:", os.path.getsize(live))
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()

print("--- errors ---")
for e in errors:
    print(e)
print("--- done ---")
