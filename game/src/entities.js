// The moving things of Palm Bay: the player, traffic cars, parked cars,
// pedestrians, police cars, and the cash lying around. Each factory makes
// one, each update function moves one for a frame.

import { CONFIG } from './config.js';
import {
  isBlocked,
  nearestRoadPoint,
  randomParkedSpot,
  randomRoadPoint,
  randomSidewalkPoint,
} from './city.js';

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// The signed smallest turn from angle `from` to angle `to`.
export function angleDifference(to, from) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  if (value > target) return Math.max(target, value - step);
  return value;
}

// Move a round-bodied thing, sliding along buildings and the map edge
// instead of passing through them. Returns true when it moved at all.
export function slideMove(city, obj, dx, dy, radius) {
  const free = (x, y) =>
    !isBlocked(city, x - radius, y) &&
    !isBlocked(city, x + radius, y) &&
    !isBlocked(city, x, y - radius) &&
    !isBlocked(city, x, y + radius);
  if (free(obj.x + dx, obj.y + dy)) {
    obj.x += dx;
    obj.y += dy;
    return true;
  }
  if (dx !== 0 && free(obj.x + dx, obj.y)) {
    obj.x += dx;
    return true;
  }
  if (dy !== 0 && free(obj.x, obj.y + dy)) {
    obj.y += dy;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- player

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    health: CONFIG.playerHealth,
    money: CONFIG.startMoney,
    wanted: 0,
    inCar: null,
    radius: CONFIG.playerRadius,
    hurtCooldown: 0,
    moving: false,
    lastCrimeAt: -9999,
  };
}

export function updatePlayerOnFoot(player, input, dt, city) {
  const left = input.down('ArrowLeft') || input.down('KeyA');
  const right = input.down('ArrowRight') || input.down('KeyD');
  const up = input.down('ArrowUp') || input.down('KeyW');
  const down = input.down('ArrowDown') || input.down('KeyS');
  let mx = (right ? 1 : 0) - (left ? 1 : 0);
  let my = (down ? 1 : 0) - (up ? 1 : 0);
  player.moving = mx !== 0 || my !== 0;
  if (!player.moving) return;
  const len = Math.hypot(mx, my);
  mx /= len;
  my /= len;
  player.angle = Math.atan2(my, mx);
  slideMove(city, player, mx * CONFIG.walkSpeed * dt, my * CONFIG.walkSpeed * dt, player.radius);
}

// ---------------------------------------------------------------- cars

function baseCar(x, y, angle, color) {
  return {
    x,
    y,
    angle,
    speed: 0,
    color,
    length: CONFIG.carLength,
    width: CONFIG.carWidth,
  };
}

export function createTrafficCar(city, rng) {
  const onVertical = rng.chance(0.5);
  const dir = rng.chance(0.5) ? 1 : -1;
  // Right-hand lane: offset to the driver's right of the road centre.
  const lane = dir === 1 ? 14 : -14;
  let car;
  if (onVertical) {
    const vx = rng.pick(city.vertical);
    car = baseCar(vx + lane, rng.range(100, CONFIG.worldHeight - 100), dir === 1 ? Math.PI / 2 : -Math.PI / 2, rng.pick(CONFIG.carColors));
    car.axis = 'v';
    car.road = vx;
  } else {
    const hy = rng.pick(city.horizontal);
    car = baseCar(rng.range(100, CONFIG.sandStartX - 100), hy + lane, dir === 1 ? 0 : Math.PI, rng.pick(CONFIG.carColors));
    car.axis = 'h';
    car.road = hy;
  }
  car.kind = 'traffic';
  car.dir = dir;
  car.lane = lane;
  car.cruise = rng.range(CONFIG.trafficSpeedMin, CONFIG.trafficSpeedMax);
  car.speed = car.cruise;
  car.turnCooldown = rng.range(1, 4);
  return car;
}

export function createParkedCar(city, rng) {
  const spot = randomParkedSpot(city, rng);
  const car = baseCar(spot.x, spot.y, spot.angle, rng.pick(CONFIG.carColors));
  car.kind = 'parked';
  car.parked = true;
  return car;
}

export function createPoliceCar(city, x, y) {
  const car = baseCar(x, y, 0, '#22262e');
  car.kind = 'police';
  car.sirenPhase = Math.random() * Math.PI * 2;
  return car;
}

// The player's car: accelerate, brake, reverse, steer. Steering bites
// less at high speed and flips when reversing, like a real car.
export function drivePlayerCar(car, input, dt, city) {
  const up = input.down('ArrowUp') || input.down('KeyW');
  const down = input.down('ArrowDown') || input.down('KeyS');
  const left = input.down('ArrowLeft') || input.down('KeyA');
  const right = input.down('ArrowRight') || input.down('KeyD');

  if (up) {
    car.speed += CONFIG.carAccel * dt;
  } else if (down) {
    if (car.speed > 5) car.speed -= CONFIG.carBrake * dt;
    else car.speed -= CONFIG.carAccel * 0.55 * dt;
  } else {
    car.speed = approach(car.speed, 0, 70 * dt);
  }
  car.speed = clamp(car.speed, -CONFIG.carReverseTop, CONFIG.carTopSpeed);

  const grip = 0.3 + 0.7 * Math.min(1, Math.abs(car.speed) / 140);
  const steer = CONFIG.carTurnRate * grip * (car.speed >= 0 ? 1 : -1);
  if (left) car.angle -= steer * dt;
  if (right) car.angle += steer * dt;

  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  if (!slideMove(city, car, dx, dy, 15)) {
    // Ran into a building or the map edge: stop dead with a jolt.
    car.speed *= 0.25;
  }
}

// Traffic follows the grid: along its road, turning at intersections,
// slowing for the car ahead, and reappearing elsewhere when it leaves town.
export function updateTrafficCar(car, dt, city, others, rng) {
  car.turnCooldown -= dt;
  let target = car.cruise;

  for (const other of others) {
    if (other === car) continue;
    if (other.kind === 'parked') continue;
    const ahead = carAheadDistance(car, other);
    if (ahead !== null) {
      if (ahead < 30) target = 0;
      else if (ahead < 70) target = Math.min(target, other.speed * 0.5);
    }
  }
  car.speed = approach(car.speed, target, 260 * dt);

  const crossing = nearestCrossing(city, car);
  if (crossing !== null && car.turnCooldown <= 0 && rng.chance(0.35)) {
    turnOnto(car, crossing);
    car.turnCooldown = rng.range(2, 5);
  }

  if (car.axis === 'v') {
    car.y += car.dir * car.speed * dt;
    car.x = car.road + car.lane;
    if (car.y < 60 || car.y > CONFIG.worldHeight - 60) respawnTraffic(car, city, rng);
  } else {
    car.x += car.dir * car.speed * dt;
    car.y = car.road + car.lane;
    if (car.x < 60 || car.x > CONFIG.sandStartX - 40) respawnTraffic(car, city, rng);
  }
}

// How far `other` is ahead of `car` on the same road and lane, or null.
function carAheadDistance(car, other) {
  if (car.axis === 'v' && other.axis === 'v' && Math.abs(car.road - other.road) < 4 && Math.abs(car.lane - other.lane) < 4) {
    const gap = (other.y - car.y) * car.dir;
    if (gap > 0 && gap < 90) return gap;
  }
  if (car.axis === 'h' && other.axis === 'h' && Math.abs(car.road - other.road) < 4 && Math.abs(car.lane - other.lane) < 4) {
    const gap = (other.x - car.x) * car.dir;
    if (gap > 0 && gap < 90) return gap;
  }
  // The player's car and police cars have no axis; check by heading instead.
  if (other.kind === 'player' || other.kind === 'police') {
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
    const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
    if (forward > 0 && forward < 80 && side < 24) return forward;
  }
  return null;
}

// The crossing road centre the car is about to reach, or null.
function nearestCrossing(city, car) {
  if (car.axis === 'v') {
    for (const hy of city.horizontal) {
      if (Math.abs(car.y - hy) < 14) return { axis: 'h', road: hy };
    }
  } else {
    for (const vx of city.vertical) {
      if (Math.abs(car.x - vx) < 14) return { axis: 'v', road: vx };
    }
  }
  return null;
}

function turnOnto(car, crossing) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  car.axis = crossing.axis;
  car.road = crossing.road;
  car.dir = dir;
  car.lane = dir === 1 ? 14 : -14;
  if (crossing.axis === 'v') {
    car.x = crossing.road + car.lane;
    car.angle = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y = crossing.road + car.lane;
    car.angle = dir === 1 ? 0 : Math.PI;
  }
}

function respawnTraffic(car, city, rng) {
  const fresh = createTrafficCar(city, rng);
  Object.assign(car, fresh);
}

// ---------------------------------------------------------------- pedestrians

export function createPedestrian(city, rng) {
  const spot = randomSidewalkPoint(city, rng);
  return {
    x: spot.x,
    y: spot.y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(CONFIG.pedestrianSpeedMin, CONFIG.pedestrianSpeedMax),
    state: 'walk',
    downTimer: 0,
    fleeTimer: 0,
    fleeAngle: 0,
    radius: 10,
  };
}

export function updatePedestrian(ped, dt, city, threat, rng) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      const spot = randomSidewalkPoint(city, rng);
      ped.x = spot.x;
      ped.y = spot.y;
      ped.state = 'walk';
    }
    return;
  }

  if (threat && distance(ped.x, ped.y, threat.x, threat.y) < 300) {
    ped.state = 'flee';
    ped.fleeTimer = 3;
    ped.fleeAngle = Math.atan2(ped.y - threat.y, ped.x - threat.x);
  }

  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.state = 'walk';
    ped.angle = ped.fleeAngle;
    const moved = slideMove(city, ped, Math.cos(ped.angle) * CONFIG.pedestrianFleeSpeed * dt, Math.sin(ped.angle) * CONFIG.pedestrianFleeSpeed * dt, ped.radius);
    if (!moved) ped.fleeAngle += Math.PI / 2;
    return;
  }

  // Strolling: keep walking; turn when blocked, sometimes at random.
  const ahead = { x: ped.x + Math.cos(ped.angle) * 18, y: ped.y + Math.sin(ped.angle) * 18 };
  if (isBlocked(city, ahead.x, ahead.y) || rng.chance(dt * 0.12)) {
    ped.angle += (rng.chance(0.5) ? 1 : -1) * Math.PI * (rng.chance(0.5) ? 0.5 : 1);
  }
  slideMove(city, ped, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt, ped.radius);
}

// ---------------------------------------------------------------- police

export function updatePoliceCar(police, dt, city, target, wanted) {
  const desired = Math.atan2(target.y - police.y, target.x - police.x);
  const turn = clamp(angleDifference(desired, police.angle), -3.4 * dt, 3.4 * dt);
  police.angle += turn;
  const top = CONFIG.policeBaseSpeed + CONFIG.policeSpeedPerStar * wanted;
  police.speed = approach(police.speed, top, 300 * dt);
  const dx = Math.cos(police.angle) * police.speed * dt;
  const dy = Math.sin(police.angle) * police.speed * dt;
  if (!slideMove(city, police, dx, dy, 15)) {
    police.speed *= 0.5;
    // Shove back towards the nearest road so a chase never gets stuck.
    const road = nearestRoadPoint(city, police.x, police.y);
    if (road) {
      police.x += (road.x - police.x) * 0.02;
      police.y += (road.y - police.y) * 0.02;
    }
  }
  police.sirenPhase += dt * 6;
}

// A spawn point for a new police car: on a road, a few hundred pixels
// from the player, so the sirens arrive instead of appearing on top.
export function policeSpawnPoint(city, rng, player) {
  for (let tries = 0; tries < 10; tries++) {
    const spot = randomRoadPoint(city, rng);
    const d = distance(spot.x, spot.y, player.x, player.y);
    if (d > 320 && d < 620) return spot;
  }
  const road = nearestRoadPoint(city, player.x, player.y);
  return { x: road.x + 380, y: road.y };
}

// ---------------------------------------------------------------- cash

export function createCashPickup(city, rng) {
  const spot = randomSidewalkPoint(city, rng);
  return { x: spot.x, y: spot.y, value: CONFIG.worldCashValue, bob: rng.range(0, Math.PI * 2) };
}
