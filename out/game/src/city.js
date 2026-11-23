// Palm Bay itself: the road grid, the blocks between the roads, the
// buildings and trees inside them, and the beach on the east edge.
// Everything is generated from the fixed seed, so the city is identical
// on every load. This module also answers the questions the rest of the
// game asks about the city: is a point on a road, inside a building,
// or blocked for movement.

import { CONFIG } from './config.js';

function roadCenters(count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(CONFIG.roadOffset + i * CONFIG.roadSpacing);
  return out;
}

export function buildCity(rng) {
  const vertical = roadCenters(8); // x = 200, 600, ... 3000
  const horizontal = roadCenters(6); // y = 200, 600, ... 2200
  const half = CONFIG.roadHalfWidth;

  // Blocks are the rectangles between the roads.
  const blockXs = [];
  for (let i = 0; i < vertical.length - 1; i++) {
    blockXs.push([vertical[i] + half + 8, vertical[i + 1] - half - 8]);
  }
  // The last strip, between the final road and the beach.
  blockXs.push([vertical[vertical.length - 1] + half + 8, CONFIG.sandStartX - 8]);
  const blockYs = [];
  for (let j = 0; j < horizontal.length - 1; j++) {
    blockYs.push([horizontal[j] + half + 8, horizontal[j + 1] - half - 8]);
  }
  // The southern strip below the last road.
  blockYs.push([horizontal[horizontal.length - 1] + half + 8, CONFIG.worldHeight - 16]);

  const buildings = [];
  const trees = [];

  for (const [bx0, bx1] of blockXs) {
    for (const [by0, by1] of blockYs) {
      const blockW = bx1 - bx0;
      const blockH = by1 - by0;
      if (blockW < 120 || blockH < 120) continue;
      // One or two buildings per block, set back from the block edge.
      const count = rng.chance(0.45) ? 2 : 1;
      for (let b = 0; b < count; b++) {
        const w = rng.range(90, Math.min(190, blockW - 40));
        const h = rng.range(70, Math.min(150, blockH - 40));
        const x = bx0 + 20 + rng.range(0, Math.max(1, blockW - w - 40));
        const y = by0 + 20 + rng.range(0, Math.max(1, blockH - h - 40));
        const rect = { x, y, w, h, color: rng.pick(CONFIG.buildingColors) };
        // Never let two buildings in one block overlap.
        if (buildings.some((o) => rectsOverlap(rect, o, 12))) continue;
        buildings.push(rect);
      }
      // A few trees in the block's open corners.
      const treeCount = rng.int(2, 4);
      for (let t = 0; t < treeCount; t++) {
        const x = rng.range(bx0 + 12, bx1 - 12);
        const y = rng.range(by0 + 12, by1 - 12);
        if (buildings.some((o) => x > o.x - 14 && x < o.x + o.w + 14 && y > o.y - 14 && y < o.y + o.h + 14)) continue;
        trees.push({ x, y, r: rng.range(9, 15) });
      }
    }
  }

  // Palm trees along the beach.
  for (let y = 120; y < CONFIG.worldHeight - 100; y += 170) {
    trees.push({ x: CONFIG.sandStartX + 34 + rng.range(-8, 8), y: y + rng.range(-20, 20), r: 13, palm: true });
  }

  return { vertical, horizontal, buildings, trees };
}

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

export function isOnRoad(city, x, y) {
  const half = CONFIG.roadHalfWidth;
  for (const vx of city.vertical) if (Math.abs(x - vx) <= half) return true;
  for (const hy of city.horizontal) if (Math.abs(y - hy) <= half) return true;
  return false;
}

export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
  }
  return null;
}

export function isBlocked(city, x, y) {
  if (x < 16 || x > CONFIG.waterStartX - 8) return true;
  if (y < 16 || y > CONFIG.worldHeight - 16) return true;
  return buildingAt(city, x, y, 0) !== null;
}

// The closest point on any road centre line to (x, y).
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const vx of city.vertical) {
    const d = Math.abs(x - vx);
    if (d < bestDist) { bestDist = d; best = { x: vx, y }; }
  }
  for (const hy of city.horizontal) {
    const d = Math.abs(y - hy);
    if (d < bestDist) { bestDist = d; best = { x, y: hy }; }
  }
  return best;
}

export function randomRoadPoint(city, rng) {
  if (rng.chance(0.5)) {
    const vx = rng.pick(city.vertical);
    return { x: vx, y: rng.range(80, CONFIG.worldHeight - 80) };
  }
  const hy = rng.pick(city.horizontal);
  return { x: rng.range(80, CONFIG.sandStartX - 80), y: hy };
}

// A point on the sidewalk: just outside a road's edge.
export function randomSidewalkPoint(city, rng) {
  const onVertical = rng.chance(0.5);
  const off = CONFIG.roadHalfWidth + rng.range(10, 18);
  const side = rng.chance(0.5) ? 1 : -1;
  if (onVertical) {
    const vx = rng.pick(city.vertical);
    return { x: vx + side * off, y: rng.range(80, CONFIG.worldHeight - 80) };
  }
  const hy = rng.pick(city.horizontal);
  return { x: rng.range(80, CONFIG.sandStartX - 80), y: hy + side * off };
}

// A roadside parking spot: on a road, near its edge, facing along it.
export function randomParkedSpot(city, rng) {
  const onVertical = rng.chance(0.5);
  const lane = (rng.chance(0.5) ? 1 : -1) * (CONFIG.roadHalfWidth - 12);
  if (onVertical) {
    const vx = rng.pick(city.vertical);
    return {
      x: vx + lane,
      y: rng.range(120, CONFIG.worldHeight - 120),
      angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2,
    };
  }
  const hy = rng.pick(city.horizontal);
  return {
    x: rng.range(120, CONFIG.sandStartX - 120),
    y: hy + lane,
    angle: rng.chance(0.5) ? 0 : Math.PI,
  };
}

// Where a new run begins: the intersection at the middle of the city.
export function playerSpawnPoint() {
  return { x: 1000, y: 1000 };
}
