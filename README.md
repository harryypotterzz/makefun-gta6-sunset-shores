# Sunset Shores — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/harryypotterzz/makefun-gta6-sunset-shores/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/harryypotterzz/makefun-gta6-sunset-shores/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original top-down 2D open-world crime game built by an AI agent for
[make.fun](https://make.fun/bounty/gta6-01) — where you and your AI agent
can earn money in bounties like this one. Set in the fictional sun-soaked
coastal city of Palm Bay, it runs offline in a desktop browser from static
files, drawn on an HTML5 canvas with plain JavaScript and no libraries.

Walk the streets, steal cars, outrun the police, and take jobs to get paid.

## The game

- **A city:** Palm Bay, 3200×2400 pixels of road grid, blocks, buildings,
  trees and a beach on the east edge — generated from a fixed seed, so it
  is identical on every load.
- **On foot and by car:** walk with WASD or the arrow keys, press E to
  steal a nearby car and drive it, E again to step out.
- **Traffic and pedestrians:** cars follow the roads and turn at
  intersections; pedestrians stroll the sidewalks and flee from trouble.
- **Wanted system and police:** stealing cars and hitting pedestrians
  raise your wanted level (0–5 stars). Police cruisers spawn and chase
  you; get caught on foot and you are BUSTED. Lay low and the heat fades.
- **Missions:** press M (or drive onto the glowing JOB marker) to take a
  job — Parcel Delivery, Getaway, or Cash Run — each with a timer and a
  payout. Cash lying on the street pays on pickup.
- **HUD and minimap:** money, health, wanted stars, mission name and
  timer, speed, and a live minimap with the player, police and markers.
- **States and save:** title screen, pause, BUSTED / WASTED screens with
  restart, and money plus jobs done saved to local storage.
- **Sound:** engine hum, police sirens, pickup chimes and mission
  jingles, all synthesised with the Web Audio API. N toggles mute.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Walk, or drive (accelerate, brake, steer) |
| E | Steal a car / leave a car |
| M | Start a job |
| P or Esc | Pause / resume |
| Enter | Start, or restart after BUSTED / WASTED |
| N | Mute sound |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8903/game/index.html in a desktop browser.

## Build the entry dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` into `out/` and writes
`out/dossier.json`.

## Screenshots and playtest

```sh
/home/hatch/workspace/makefun/.pwvenv/bin/python take_shots.py
/home/hatch/workspace/makefun/.pwvenv/bin/python playtest.py
```

`take_shots.py` captures the four scenes (title, driving, police chase,
delivery mission) at 1280×720. `playtest.py` drives a full session —
title, walk, steal, drive, mission, wanted level, police, pause — and
requires zero console errors.
