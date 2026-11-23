// Sunset Shores — the city of Palm Bay.
// One job only: build the open world (roads, blocks, buildings, parks, the
// beach, the landmarks) and answer the geometry questions the rest of the
// game asks: is this point on a road, inside a building, or free to walk on.
import {
  WORLD_W, WORLD_H, ROAD_W, BLOCK, BUILDING_COLORS,
} from './config.js';
import { makeRng, pick, range, rangeInt, chance } from './random.js';

// Road centre lines: avenues run north-south, streets east-west.
export const AVENUES = [];
for (let x = 200; x < WORLD_W; x += BLOCK) AVENUES.push(x);
export const STREETS = [];
for (let y = 200; y < WORLD_H - 200; y += BLOCK) STREETS.push(y);

export function isOnRoad(x, y) {
  for (const ax of AVENUES) {
    if (Math.abs(x - ax) < ROAD_W / 2) return true;
  }
  for (const sy of STREETS) {
    if (Math.abs(y - sy) < ROAD_W / 2) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y, vertical: true }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy, vertical: false }; }
  }
  return best;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export class City {
  constructor(seed) {
    this.rng = makeRng(seed);
    this.buildings = [];  // {x, y, w, h, color, roof, height}
    this.trees = [];      // {x, y, r}
    this.parks = [];      // {x, y, w, h}
    this.landmarks = {};  // name -> {x, y, label, color}
    this.cashSpots = [];  // free-roam cash pickup spawn points
    this.beachTop = 0;
    this._generate();
  }

  _generate() {
    const rng = this.rng;
    // The blocks sit between neighbouring road centre lines.
    const blockXs = [];
    for (let i = 0; i < AVENUES.length - 1; i++) {
      blockXs.push([AVENUES[i] + ROAD_W / 2 + 8, AVENUES[i + 1] - ROAD_W / 2 - 8]);
    }
    const blockYs = [];
    for (let i = 0; i < STREETS.length - 1; i++) {
      blockYs.push([STREETS[i] + ROAD_W / 2 + 8, STREETS[i + 1] - ROAD_W / 2 - 8]);
    }
    // The southern strip, below the last street, is the beach.
    const beachTop = STREETS[STREETS.length - 1] + ROAD_W / 2 + 8;
    this.beachTop = beachTop;

    let parkCount = 0;
    for (let bi = 0; bi < blockXs.length; bi++) {
      for (let bj = 0; bj < blockYs.length; bj++) {
        const [x0, x1] = blockXs[bi];
        const [y0, y1] = blockYs[bj];
        const w = x1 - x0;
        const h = y1 - y0;
        // A few blocks become parks instead of buildings.
        if (parkCount < 4 && chance(rng, 0.14)) {
          parkCount++;
          this.parks.push({ x: x0, y: y0, w, h });
          const trees = rangeInt(rng, 5, 9);
          for (let t = 0; t < trees; t++) {
            this.trees.push({
              x: range(rng, x0 + 20, x1 - 20),
              y: range(rng, y0 + 20, y1 - 20),
              r: range(rng, 9, 15),
            });
          }
          continue;
        }
        // 1-4 buildings per block, on a rough grid inside it.
        const cols = rangeInt(rng, 1, 2);
        const rows = rangeInt(rng, 1, 2);
        const cw = w / cols;
        const ch = h / rows;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (chance(rng, 0.15)) continue; // empty lot / courtyard
            const bw = range(rng, cw * 0.45, cw * 0.8);
            const bh = range(rng, ch * 0.45, ch * 0.8);
            const bx = x0 + c * cw + (cw - bw) / 2 + range(rng, -8, 8);
            const by = y0 + r * ch + (ch - bh) / 2 + range(rng, -8, 8);
            const color = pick(rng, BUILDING_COLORS);
            this.buildings.push({
              x: bx, y: by, w: bw, h: bh, color,
              roof: shade(color, -18),
              height: rangeInt(rng, 6, 18),
            });
          }
        }
        // Street trees along the block edges.
        if (chance(rng, 0.6)) {
          this.trees.push({ x: range(rng, x0 + 10, x1 - 10), y: y0 + 4, r: range(rng, 8, 12) });
          this.trees.push({ x: range(rng, x0 + 10, x1 - 10), y: y1 - 4, r: range(rng, 8, 12) });
        }
      }
    }

    // Landmarks: fixed spots the missions and the HUD point at.
    this.landmarks.marasBar = { x: AVENUES[1], y: STREETS[1] + 130, label: "Mara's Bar", color: '#e05a8a' };
    this.landmarks.safehouse = { x: AVENUES[6], y: STREETS[0] + 130, label: 'Safehouse', color: '#3ca66a' };
    this.landmarks.junkyard = { x: AVENUES[0], y: STREETS[4] + 130, label: 'Junkyard', color: '#8a7a5a' };
    this.landmarks.clinic = { x: AVENUES[5], y: STREETS[3] + 130, label: 'Clinic', color: '#e8e8e8' };
    this.landmarks.diner = { x: AVENUES[3], y: STREETS[2] + 130, label: 'Sunset Diner', color: '#e8b23c' };

    // Free-roam cash: dropped wallets on sidewalks and in parks.
    for (let i = 0; i < 10; i++) {
      const bx = range(rng, 240, WORLD_W - 240);
      const by = range(rng, 240, beachTop - 120);
      if (!this.collides(bx, by, 12)) this.cashSpots.push({ x: bx, y: by });
    }
  }

  /** The building a circle of radius r at (x, y) overlaps, or null. */
  collides(x, y, r) {
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  /** Push a circle out of any building it overlaps; returns the new spot. */
  resolveCircle(x, y, r) {
    const b = this.collides(x, y, r);
    if (!b) return { x, y, hit: null };
    const overlapL = (x + r) - b.x;
    const overlapR = (b.x + b.w) - (x - r);
    const overlapT = (y + r) - b.y;
    const overlapB = (b.y + b.h) - (y - r);
    const min = Math.min(overlapL, overlapR, overlapT, overlapB);
    if (min === overlapL) x = b.x - r;
    else if (min === overlapR) x = b.x + b.w + r;
    else if (min === overlapT) y = b.y - r;
    else y = b.y + b.h + r;
    return { x, y, hit: b };
  }

  /** A random point on a road, at least minDist away from (fx, fy). */
  randomRoadPoint(fx, fy, minDist) {
    const rng = this.rng;
    for (let tries = 0; tries < 40; tries++) {
      const vertical = chance(rng, 0.5);
      let x; let y;
      if (vertical) {
        x = pick(rng, AVENUES);
        y = range(rng, 150, WORLD_H - 250);
      } else {
        x = range(rng, 150, WORLD_W - 150);
        y = pick(rng, STREETS);
      }
      if (Math.hypot(x - fx, y - fy) >= minDist) return { x, y };
    }
    return { x: AVENUES[3], y: STREETS[2] };
  }

  /** A random landmark, other than the one named. */
  randomLandmark(exceptName) {
    const names = Object.keys(this.landmarks).filter((n) => n !== exceptName);
    return this.landmarks[pick(this.rng, names)];
  }
}
