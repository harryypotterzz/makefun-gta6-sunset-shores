// Sunset Shores — the game loop, the state machine, and the wiring.
// Title -> playing -> paused / busted / wasted, with a save in local
// storage so money and jobs done survive across sessions.

import { CONFIG } from './config.js';
import { createRng } from './random.js';
import { buildCity, playerSpawnPoint, randomSidewalkPoint } from './city.js';
import {
  clamp,
  createCashPickup,
  createParkedCar,
  createPedestrian,
  createPlayer,
  createPoliceCar,
  createTrafficCar,
  distance,
  drivePlayerCar,
  policeSpawnPoint,
  slideMove,
  updatePedestrian,
  updatePoliceCar,
  updatePlayerOnFoot,
  updateTrafficCar,
} from './entities.js';
import { MISSION_TYPES, createMissionManager, startMission, updateMission } from './missions.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { setupScene } from './shots.js';

const SAVE_KEY = 'sunset-shores-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, missionsDone: 0 };
    const parsed = JSON.parse(raw);
    return {
      money: Number(parsed.money) || 0,
      missionsDone: Number(parsed.missionsDone) || 0,
    };
  } catch {
    return { money: 0, missionsDone: 0 };
  }
}

function storeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage may be unavailable; the game plays on regardless.
  }
}

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput();
const audio = createAudio();
const rng = createRng(CONFIG.seed);
const city = buildCity(rng);
const save = loadSave();
const missionManager = createMissionManager();
missionManager.completed = save.missionsDone;

const spawn = playerSpawnPoint();
const game = {
  state: 'title',
  time: 0,
  city,
  rng,
  player: createPlayer(spawn.x, spawn.y),
  traffic: [],
  parked: [],
  peds: [],
  police: [],
  cash: [],
  particles: [],
  missionManager,
  mission: null,
  jobMarker: { x: 1200, y: 1000 },
  message: '',
  messageTimer: 0,
  save,
  wantedTimer: 0,
  policeTimer: 0,
};

function populateWorld() {
  game.traffic = [];
  game.parked = [];
  game.peds = [];
  game.police = [];
  game.cash = [];
  game.particles = [];
  for (let i = 0; i < CONFIG.trafficCount; i++) game.traffic.push(createTrafficCar(city, rng));
  for (let i = 0; i < CONFIG.parkedCount; i++) game.parked.push(createParkedCar(city, rng));
  for (let i = 0; i < CONFIG.pedestrianCount; i++) game.peds.push(createPedestrian(city, rng));
  for (let i = 0; i < CONFIG.worldCashCount; i++) {
    const pickup = createCashPickup(city, rng);
    pickup.respawnAt = 0;
    game.cash.push(pickup);
  }
}

function showMessage(text, seconds) {
  game.message = text;
  game.messageTimer = seconds || 3.5;
}

function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const speed = rng.range(30, 140);
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rng.range(0.3, 0.7),
      max: 0.7,
      size: rng.range(2, 5),
      color: color || '#ffd678',
    });
  }
}

function commitCrime(stars) {
  const player = game.player;
  player.wanted = Math.min(5, player.wanted + stars);
  player.lastCrimeAt = game.time;
  game.wantedTimer = 0;
}

// Put the player in a fresh car at a spot. Used by scenes and by stealing.
game.giveCar = function giveCar(x, y, angle) {
  const car = {
    kind: 'player',
    x, y, angle,
    speed: 0,
    color: '#d64541',
    length: CONFIG.carLength,
    width: CONFIG.carWidth,
  };
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  return car;
};

function nearestStealableCar() {
  const player = game.player;
  let best = null;
  let bestDist = CONFIG.stealDistance;
  for (const car of [...game.parked, ...game.traffic]) {
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

function stealCar() {
  const player = game.player;
  const car = nearestStealableCar();
  if (!car) return;
  game.parked = game.parked.filter((c) => c !== car);
  game.traffic = game.traffic.filter((c) => c !== car);
  const fresh = game.giveCar(car.x, car.y, car.angle);
  fresh.color = car.color;
  fresh.speed = 0;
  commitCrime(1);
  showMessage('You stole a car! The police are on their way.', 3);
  audio.thud();
  spawnParticles(car.x, car.y, 8, '#ffffff');
}

function exitCar() {
  const player = game.player;
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  const side = { x: Math.cos(car.angle + Math.PI / 2), y: Math.sin(car.angle + Math.PI / 2) };
  player.x = car.x + side.x * 26;
  player.y = car.y + side.y * 26;
  player.angle = car.angle;
  car.kind = 'parked';
  car.parked = true;
  car.speed = 0;
  game.parked.push(car);
}

function startNextMission() {
  if (missionManager.active) return;
  const type = MISSION_TYPES[missionManager.nextIndex % MISSION_TYPES.length];
  missionManager.nextIndex += 1;
  const mission = startMission(missionManager, type, { city, rng, player: game.player });
  if (type === 'getaway') {
    game.player.wanted = Math.max(game.player.wanted, 2);
    game.player.lastCrimeAt = game.time;
  }
  showMessage(`${mission.name} — ${mission.objective}`, 4);
  audio.chime();
}

function endRun(kind) {
  game.state = kind;
  save.money += Math.floor(game.player.money);
  save.missionsDone = missionManager.completed;
  storeSave(save);
  audio.bust();
  audio.setSiren(false);
  audio.setEngine(0, false);
}

function resetRun() {
  const spawnPoint = playerSpawnPoint();
  game.player = createPlayer(spawnPoint.x, spawnPoint.y);
  populateWorld();
  missionManager.active = null;
  game.mission = null;
  game.message = '';
  game.messageTimer = 0;
  game.wantedTimer = 0;
  game.policeTimer = 0;
  game.state = 'playing';
}

function updatePlaying(dt) {
  const player = game.player;

  // --- Player movement and actions.
  if (player.inCar) {
    drivePlayerCar(player.inCar, input, dt, city);
    player.x = player.inCar.x;
    player.y = player.inCar.y;
    player.angle = player.inCar.angle;
  } else {
    updatePlayerOnFoot(player, input, dt, city);
  }
  if (player.hurtCooldown > 0) player.hurtCooldown -= dt;

  if (input.pressed('KeyE')) {
    audio.ensure();
    if (player.inCar) exitCar();
    else stealCar();
  }
  if (input.pressed('KeyM')) {
    audio.ensure();
    startNextMission();
  }
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    game.state = 'paused';
    audio.setEngine(0, false);
    audio.setSiren(false);
    return;
  }
  if (input.pressed('KeyN')) {
    audio.ensure();
    const muted = audio.toggleMute();
    showMessage(muted ? 'Sound off' : 'Sound on', 1.5);
  }

  // --- Traffic, pedestrians, police.
  const others = [...game.traffic, ...game.police];
  if (player.inCar) others.push(player.inCar);
  for (const car of game.traffic) updateTrafficCar(car, dt, city, others, rng);

  const threat = (player.inCar && Math.abs(player.inCar.speed) > 120) || game.time - player.lastCrimeAt < 2
    ? { x: player.x, y: player.y }
    : null;
  for (const ped of game.peds) updatePedestrian(ped, dt, city, threat, rng);

  game.policeTimer -= dt;
  if (game.policeTimer <= 0) {
    game.policeTimer = 0.5;
    const target = Math.min(player.wanted, CONFIG.policeMax);
    if (game.police.length < target) {
      const spot = policeSpawnPoint(city, rng, player);
      const cop = createPoliceCar(city, spot.x, spot.y);
      game.police.push(cop);
    } else if (game.police.length > target) {
      // Wanted level fell: the furthest cruiser gives up and leaves.
      game.police.sort((a, b) => distance(b.x, b.y, player.x, player.y) - distance(a.x, a.y, player.x, player.y));
      game.police.shift();
    }
  }
  for (const cop of game.police) updatePoliceCar(cop, dt, city, player, player.wanted);

  // --- Collisions.
  if (!player.inCar) {
    for (const car of game.traffic) {
      if (car.speed > 40 && distance(player.x, player.y, car.x, car.y) < 28 && player.hurtCooldown <= 0) {
        player.health -= CONFIG.carTouchDamage;
        player.hurtCooldown = 1;
        showMessage('Ouch! Watch the traffic.', 2);
        audio.thud();
        spawnParticles(player.x, player.y, 10, '#ff8a8a');
        if (player.health <= 0) {
          endRun('wasted');
          return;
        }
      }
    }
    for (const cop of game.police) {
      if (distance(player.x, player.y, cop.x, cop.y) < CONFIG.bustDistance) {
        showMessage('Busted!', 2);
        endRun('busted');
        return;
      }
    }
  } else {
    const car = player.inCar;
    for (const ped of game.peds) {
      if (ped.state !== 'down' && Math.abs(car.speed) > 60 && distance(car.x, car.y, ped.x, ped.y) < 28) {
        ped.state = 'down';
        ped.downTimer = 12;
        commitCrime(1);
        showMessage('You hit a pedestrian! Wanted level up.', 3);
        audio.thud();
        spawnParticles(ped.x, ped.y, 12, '#ff8a8a');
      }
    }
    for (const other of [...game.traffic, ...game.police]) {
      if (distance(car.x, car.y, other.x, other.y) < 30) {
        const impact = Math.abs(car.speed - other.speed);
        // A ram only bites once per half second: without the cooldown a
        // tap would grind the car to a halt in a single frame.
        if (impact > 60 && game.time - (car._lastRam || -9) > 0.4) {
          car._lastRam = game.time;
          audio.thud();
          spawnParticles((car.x + other.x) / 2, (car.y + other.y) / 2, 8, '#ffd678');
          car.speed *= 0.7;
          other.speed *= 0.5;
        }
        const push = 34 - distance(car.x, car.y, other.x, other.y);
        const angle = Math.atan2(other.y - car.y, other.x - car.x);
        slideMove(city, other, Math.cos(angle) * push, Math.sin(angle) * push, 12);
      }
    }
  }

  // --- Cash on the street.
  for (const pickup of game.cash) {
    if (game.time < pickup.respawnAt) continue;
    if (distance(player.x, player.y, pickup.x, pickup.y) < 28) {
      player.money += pickup.value;
      audio.chime();
      spawnParticles(pickup.x, pickup.y, 8, '#2ecc71');
      showMessage(`+$${pickup.value}`, 1.5);
      pickup.respawnAt = game.time + CONFIG.worldCashRespawnSeconds;
      const spot = randomSidewalkPoint(city, rng);
      pickup.x = spot.x;
      pickup.y = spot.y;
    }
  }

  // --- The glowing JOB marker starts the next mission.
  if (!missionManager.active && distance(player.x, player.y, game.jobMarker.x, game.jobMarker.y) < 42) {
    startNextMission();
  }

  // --- Missions.
  const result = updateMission(missionManager, dt, { player, police: game.police });
  if (result && result.event === 'completed') {
    player.money += result.reward;
    save.money += result.reward;
    save.missionsDone = missionManager.completed;
    storeSave(save);
    showMessage(`Job done! +$${result.reward}`, 4);
    audio.jingle();
    spawnParticles(player.x, player.y, 20, '#ffd700');
  } else if (result && result.event === 'failed') {
    showMessage(`Job failed — ${result.reason}`, 4);
  }
  game.mission = missionManager.active;

  // --- Wanted level slowly falls when the heat is off.
  const nearestCop = game.police.reduce((best, cop) => Math.min(best, distance(cop.x, cop.y, player.x, player.y)), Infinity);
  if (player.wanted > 0 && game.time - player.lastCrimeAt > CONFIG.wantedDecayQuietSeconds && nearestCop > 350) {
    game.wantedTimer += dt;
    if (game.wantedTimer >= CONFIG.wantedDecayEverySeconds) {
      player.wanted -= 1;
      game.wantedTimer = 0;
      if (player.wanted === 0) showMessage('You lost the heat. Wanted level clear.', 3);
    }
  } else {
    game.wantedTimer = 0;
  }

  // --- Slow health recovery while nobody is after the player.
  if (player.wanted === 0 && game.time - player.lastCrimeAt > 10) {
    player.health = Math.min(CONFIG.playerHealth, player.health + 2 * dt);
  }

  // --- Particles and messages.
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  if (game.messageTimer > 0) game.messageTimer -= dt;

  // --- Sound follows the drive.
  const speed01 = player.inCar ? clamp(Math.abs(player.inCar.speed) / CONFIG.carTopSpeed, 0, 1) : 0;
  audio.setEngine(speed01, !!player.inCar);
  audio.setSiren(game.police.length > 0 && player.wanted > 0);
}

function update(dt) {
  if (game.state === 'title') {
    if (input.pressed('Enter')) {
      audio.ensure();
      resetRun();
    }
    return;
  }
  if (game.state === 'playing') {
    updatePlaying(dt);
    return;
  }
  if (game.state === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape') || input.pressed('Enter')) {
      game.state = 'playing';
    }
    return;
  }
  // busted / wasted
  if (input.pressed('Enter')) {
    audio.ensure();
    resetRun();
  }
}

// ---------------------------------------------------------------- boot

populateWorld();
game.mission = null;

const scene = new URLSearchParams(window.location.search).get('scene');
if (scene) setupScene(game, scene);

// A small read-only window for the playtest and the screenshot helper.
window.__sunset = {
  state: () => game.state,
  player: () => ({
    x: Math.round(game.player.x),
    y: Math.round(game.player.y),
    health: Math.round(game.player.health),
    money: Math.floor(game.player.money),
    wanted: game.player.wanted,
    inCar: game.player.inCar !== null,
    speed: game.player.inCar ? Math.round(game.player.inCar.speed) : 0,
  }),
  policeCount: () => game.police.length,
  mission: () => (missionManager.active
    ? { type: missionManager.active.type, name: missionManager.active.name, timer: Math.round(missionManager.active.timer) }
    : null),
  missionsDone: () => missionManager.completed,
  debug: {
    spawnParkedNear(dx, dy) {
      const car = createParkedCar(city, rng);
      car.x = game.player.x + dx;
      car.y = game.player.y + dy;
      car.angle = 0;
      game.parked.push(car);
      return { x: car.x, y: car.y };
    },
    teleport(x, y) {
      if (game.player.inCar) {
        game.player.inCar.x = x;
        game.player.inCar.y = y;
        game.player.inCar.speed = 0;
      }
      game.player.x = x;
      game.player.y = y;
    },
    teleportToMissionTarget() {
      const mission = missionManager.active;
      if (!mission) return null;
      const target = mission.target;
      window.__sunset.debug.teleport(target.x, target.y);
      return { x: target.x, y: target.y };
    },
    missionTarget() {
      const mission = missionManager.active;
      return mission ? { x: mission.target.x, y: mission.target.y } : null;
    },
  },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.time += dt;
  update(dt);
  renderer.draw(game);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
