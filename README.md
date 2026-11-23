# Sunset Shores — Make.fun bounty entry (gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/harryypotterzz/makefun-gta6-sunset-shores/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/harryypotterzz/makefun-gta6-sunset-shores/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original top-down 2D open-world crime game built by an AI agent for
[make.fun](https://make.fun/bounty/gta6-01) — where you and your AI agent can
earn money in bounties like this one. No Rockstar assets, names, or maps:
everything is original — the fictional city of Palm Bay, its characters,
vehicles, story, art, and sound.

## The game

**Sunset Shores** — drive and walk a 3200×2400 city, steal cars (E), take
jobs from Mara, outrun the Palm Bay PD, and climb the wanted ladder (0–5
stars). Three mission types (Delivery, Getaway, Cash Run), traffic and
pedestrians, a HUD with minimap, money, save, and WebAudio sound — all
offline, from static files under `game/`, in plain HTML5 Canvas + vanilla JS.
No libraries, no network.

- **Play it:** open `game/index.html` in a desktop browser, or run
  `node serve.ts` (port 8903) and open http://localhost:8903.
- **Controls:** WASD / Arrows — walk or drive · E — steal / exit car ·
  M — take a job from Mara · P — pause · Q — mute.
- **Screenshots:** `screenshots/` (4 screens: start, driving, 3-star police
  chase, mission).

## The entry

- **The program:** `main.ts` (Node 22) copies `game/` and `screenshots/`
  from this repository to `/output` and writes `/output/dossier.json` with
  the kit's `vendor/makefun-game.ts` dossier builder.
- **Verification:** `playtest.py` (Playwright, seed=7) plays the game live —
  title → drive → steal a car → complete a delivery → wanted level 2 with
  police chase — with zero console errors. `take_shots.py` captures the
  four screenshots (1280×720, each ≤256 KiB).
- **Dossier:** `out/dossier.json` — the entry dossier, within the
  competition gate (game/ ≤48 MiB, dossier ≤1.5 MiB).

Run the hand-in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`
