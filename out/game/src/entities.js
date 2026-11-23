// Sunset Shores — the people and vehicles of Palm Bay.
// One job only: the player (on foot or driving), traffic cars, pedestrians
// and police, with their movement, collisions and behaviour.
import {
  WORLD_W, WORLD_H, WALK_SPEED, PLAYER_RADIUS, PLAYER_MAX_HEALTH,
  CAR_LENGTH, CAR_WIDTH, CAR_ACCEL, CAR_BRAKE, CAR_MAX_SPEED,
  CAR_MAX_REVERSE, CAR_TURN, CAR_COLORS, PED_SHIRT_COLORS, ROAD_W,
} from './config.js';
import { AVENUES, STREETS, isOnRoad, nearestRoadPoint } from './city.js';
import { pick, range, rangeInt, chance } from './random.js';

export const TAU = Math.PI * 2;

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// ---------------------------------------------------------------- player
export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.health = PLAYER_MAX_HEALTH;
    this.car = null;      // the Car being driven, or null when on foot
    this.walkPhase = 0;
    this.hurtFlash = 0;
  }

  get speed() {
    return this.car ? Math.abs(this.car.speed) : 0;
  }
}

// ---------------------------------------------------------------- cars
let carId = 1;

export class Car {
  constructor(x, y, angle, kind, rng) {
    this.id = carId++;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.kind = kind; // 'player' | 'traffic' | 'police' | 'parked'
    this.color = kind === 'police' ? '#222831' : pick(rng, CAR_COLORS);
    this.occupied = kind === 'traffic';
    this.crashed = 0;   // brief slowdown after a hard hit
    this.skid = 0;
    this.ai = null;     // traffic: {dir, cruise}
    this.sirenPhase = rng() * TAU;
    this.dead = false;
  }

  get halfLen() { return CAR_LENGTH / 2; }
  get halfWid() { return CAR_WIDTH / 2; }

  /** Arcade driving: throttle and brake, steering that bites with speed. */
  drive(input, dt) {
    if (input.up) this.speed += CAR_ACCEL * dt;
    if (input.down) {
      if (this.speed > 20) this.speed -= CAR_BRAKE * dt;
      else this.speed -= CAR_ACCEL * 0.6 * dt;
    }
    if (!input.up && !input.down) this.speed *= Math.pow(0.4, dt);
    this.speed = clamp(this.speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);
    if (this.crashed > 0) {
      this.crashed -= dt;
      this.speed *= Math.pow(0.1, dt);
    }
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const grip = clamp(Math.abs(this.speed) / 220, 0, 1);
    this.angle += steer * CAR_TURN * grip * dt * (this.speed < 0 ? -1 : 1);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.x = clamp(this.x, 40, WORLD_W - 40);
    this.y = clamp(this.y, 40, WORLD_H - 40);
    this.skid = Math.abs(steer) > 0 && Math.abs(this.speed) > 300 ? 1 : 0;
  }

  /** Keep the car out of buildings; returns true when it hit one. */
  collideCity(city) {
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    const hl = this.halfLen + 2;
    const hw = this.halfWid + 2;
    let hit = false;
    for (const [lx, ly] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
      const px = this.x + lx * c - ly * s;
      const py = this.y + lx * s + ly * c;
      if (city.collides(px, py, 2)) { hit = true; break; }
    }
    if (hit) {
      // Back off along the heading and kill most of the speed.
      this.x -= Math.cos(this.angle) * Math.abs(this.speed) * 0.12;
      this.y -= Math.sin(this.angle) * Math.abs(this.speed) * 0.12;
      if (Math.abs(this.speed) > 120) this.crashed = 0.4;
      this.speed *= 0.35;
    }
    return hit;
  }
}

// ---------------------------------------------------------------- pedestrians
export class Ped {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.angle = range(rng, 0, TAU);
    this.speed = range(rng, 30, 55);
    this.shirt = pick(rng, PED_SHIRT_COLORS);
    this.walkPhase = range(rng, 0, TAU);
    this.flee = 0;  // seconds of panicked running
    this.down = 0;  // seconds lying down after being hit
    this.target = null;
    this.rng = rng;
  }

  update(dt, city, playerPos) {
    if (this.down > 0) { this.down -= dt; return; }
    const dPlayer = Math.hypot(this.x - playerPos.x, this.y - playerPos.y);
    if (dPlayer < 160) this.flee = 1.5;
    if (this.flee > 0) {
      this.flee -= dt;
      const away = Math.atan2(this.y - playerPos.y, this.x - playerPos.x);
      this.angle = away;
      this.x += Math.cos(away) * 140 * dt;
      this.y += Math.sin(away) * 140 * dt;
    } else {
      if (!this.target || Math.hypot(this.target.x - this.x, this.target.y - this.y) < 20) {
        // Pick a new stroll target on a nearby sidewalk.
        const p = nearestRoadPoint(this.x, this.y);
        const along = range(this.rng, -260, 260);
        this.target = p.vertical
          ? { x: p.x + (this.rng() < 0.5 ? -70 : 70), y: clamp(this.y + along, 120, WORLD_H - 120) }
          : { x: clamp(this.x + along, 120, WORLD_W - 120), y: p.y + (this.rng() < 0.5 ? -70 : 70) };
      }
      const a = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      this.angle = a;
      this.x += Math.cos(a) * this.speed * dt;
      this.y += Math.sin(a) * this.speed * dt;
    }
    this.x = clamp(this.x, 60, WORLD_W - 60);
    this.y = clamp(this.y, 60, WORLD_H - 60);
    const res = city.resolveCircle(this.x, this.y, 10);
    this.x = res.x;
    this.y = res.y;
    this.walkPhase += dt * (this.flee > 0 ? 14 : 7);
  }
}

// ---------------------------------------------------------------- traffic
export function spawnTrafficCar(city, rng, nearX, nearY) {
  // Spawn on a road within roughly 900px of the player, off-screen-ish.
  for (let tries = 0; tries < 20; tries++) {
    const vertical = chance(rng, 0.5);
    let x; let y; let angle;
    if (vertical) {
      x = pick(rng, AVENUES);
      y = clamp(nearY + range(rng, -800, 800), 120, WORLD_H - 120);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = clamp(nearX + range(rng, -800, 800), 120, WORLD_W - 120);
      y = pick(rng, STREETS);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    const dist = Math.hypot(x - nearX, y - nearY);
    if (dist < 320 || dist > 1000) continue;
    const car = new Car(x, y, angle, 'traffic', rng);
    car.speed = range(rng, 120, 200);
    car.ai = { dir: angle, cruise: car.speed };
    return car;
  }
  return null;
}

export function updateTrafficCar(car, dt, city) {
  // Drive along the road grid; at intersections sometimes turn.
  if (!isOnRoad(car.x, car.y)) {
    // Drifted off the road: steer back to the nearest road centre.
    const p = nearestRoadPoint(car.x, car.y);
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    car.angle += clamp(angleDiff(car.angle, want), -2.2 * dt, 2.2 * dt);
    car.speed = Math.min(car.speed, 120);
  } else {
    const nearJunction = AVENUES.some((ax) => Math.abs(car.x - ax) < 60)
      && STREETS.some((sy) => Math.abs(car.y - sy) < 60);
    if (nearJunction && Math.random() < 0.02) {
      const r = Math.random();
      if (r < 0.18) car.angle += Math.PI / 2;
      else if (r < 0.36) car.angle -= Math.PI / 2;
    }
    car.speed += (car.ai.cruise - car.speed) * dt;
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 60, WORLD_W - 60);
  car.y = clamp(car.y, 60, WORLD_H - 60);
  car.collideCity(city);
}

export function spawnParkedCar(city, rng, nearX, nearY) {
  for (let tries = 0; tries < 20; tries++) {
    const vertical = chance(rng, 0.5);
    let x; let y; let angle;
    if (vertical) {
      x = pick(rng, AVENUES) + (rng() < 0.5 ? -ROAD_W / 2 + 16 : ROAD_W / 2 - 16);
      y = clamp(nearY + range(rng, -500, 500), 120, WORLD_H - 120);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = clamp(nearX + range(rng, -500, 500), 120, WORLD_W - 120);
      y = pick(rng, STREETS) + (rng() < 0.5 ? -ROAD_W / 2 + 16 : ROAD_W / 2 - 16);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    if (Math.hypot(x - nearX, y - nearY) < 150) continue;
    if (city.collides(x, y, 30)) continue;
    const car = new Car(x, y, angle, 'parked', rng);
    car.occupied = false;
    return car;
  }
  return null;
}

// ---------------------------------------------------------------- police
export function spawnPoliceCar(city, rng, nearX, nearY) {
  // Spawn on a road a little way from the player, facing them.
  const p = city.randomRoadPoint(nearX, nearY, 500);
  const angle = Math.atan2(nearY - p.y, nearX - p.x);
  const car = new Car(p.x, p.y, angle, 'police', rng);
  car.speed = 260;
  return car;
}

export function updatePoliceCar(car, dt, city, targetX, targetY) {
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.8 * dt, 2.8 * dt);
  // Police drive fast, but ease off when very close so they ram, not orbit.
  const dist = Math.hypot(targetX - car.x, targetY - car.y);
  const targetSpeed = dist < 90 ? 140 : 430;
  car.speed += (targetSpeed - car.speed) * dt * 1.5;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 60, WORLD_W - 60);
  car.y = clamp(car.y, 60, WORLD_H - 60);
  car.sirenPhase += dt * 6;
  if (car.collideCity(city)) car.speed *= 0.5;
}

export function carsCollide(a, b) {
  // Simple push-apart plus speed exchange; returns the impact speed.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const overlap = 46 - dist;
  if (overlap <= 0) return 0;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * overlap / 2;
  a.y -= ny * overlap / 2;
  b.x += nx * overlap / 2;
  b.y += ny * overlap / 2;
  const impact = Math.abs(a.speed - b.speed);
  const tmp = a.speed;
  a.speed = b.speed * 0.6;
  b.speed = tmp * 0.6;
  return impact;
}
