// Sunset Shores — the game itself.
// One job only: own the game object, the state machine (title, playing,
// paused, busted, wasted), the update loop (driving, stealing, wanted,
// police, missions, money, health) and saving. Rendering lives in render.js,
// missions in missions.js, the city in city.js.
import {
  WORLD_W, WORLD_H, WALK_SPEED, PLAYER_RADIUS, PLAYER_MAX_HEALTH,
  MAX_WANTED, WANTED_DECAY_SECONDS, BUST_FINE,
  START_MONEY, CASH_PICKUP_VALUE, VIEW_W, VIEW_H,
} from './config.js';
import { City } from './city.js';
import { makeRng, range } from './random.js';
import { Input, ACTION } from './input.js';
import {
  Player, Ped, angleDiff, clamp,
  spawnTrafficCar, updateTrafficCar, spawnParkedCar,
  spawnPoliceCar, updatePoliceCar, carsCollide,
} from './entities.js';
import { MissionManager } from './missions.js';
import { Sound } from './audio.js';
import { drawWorld, drawHUD, drawTitle, drawPause, drawEnd } from './render.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'sunset-shores-save-v1';

export class Game {
  constructor(seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.city = new City(seed);
    this.input = new Input();
    this.audio = new Sound();
    this.missions = new MissionManager(this.city, this.rng);
    this.t = 0;
    this.state = 'title'; // title | playing | paused | busted | wasted
    this.endTimer = 0;

    const bar = this.city.landmarks.marasBar;
    this.player = new Player(bar.x + 60, bar.y + 40);
    this.cam = { x: this.player.x, y: this.player.y };

    this.traffic = [];
    this.parked = [];
    this.police = [];
    this.peds = [];
    this.particles = [];
    this.cashPickups = this.city.cashSpots.map((s) => ({ x: s.x, y: s.y, taken: false }));

    this.money = START_MONEY;
    this.wanted = 0;
    this.crimeTimer = 0;  // seconds since the last crime
    this.bustTimer = 0;   // seconds a cop has been touching the player
    this.save = this._loadSave();
    this.money = Math.max(this.money, this.save.money || START_MONEY);
    this.missions.completed = this.save.missionsDone || 0;

    this._populate();
  }

  _loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* fresh start */ }
    return { money: START_MONEY, missionsDone: 0, bestMoney: START_MONEY };
  }

  _storeSave() {
    this.save.money = this.money;
    this.save.missionsDone = this.missions.completed;
    this.save.bestMoney = Math.max(this.save.bestMoney || 0, this.money);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch { /* storage unavailable */ }
  }

  _populate() {
    for (let i = 0; i < 8; i++) {
      const car = spawnTrafficCar(this.city, this.rng, this.player.x, this.player.y);
      if (car) this.traffic.push(car);
    }
    for (let i = 0; i < 6; i++) {
      const car = spawnParkedCar(this.city, this.rng, this.player.x, this.player.y);
      if (car) this.parked.push(car);
    }
    for (let i = 0; i < 14; i++) {
      this.peds.push(new Ped(
        clamp(this.player.x + range(this.rng, -600, 600), 80, WORLD_W - 80),
        clamp(this.player.y + range(this.rng, -500, 500), 80, WORLD_H - 80),
        this.rng,
      ));
    }
  }

  // ------------------------------------------------------------ wanted
  addWanted(stars) {
    if (this.wanted >= MAX_WANTED) return;
    this.wanted = Math.min(MAX_WANTED, this.wanted + stars);
    this.crimeTimer = 0;
  }

  _spawnPoliceIfNeeded(dt) {
    if (this.police.length < this.wanted) {
      this._policeSpawnTimer = (this._policeSpawnTimer || 0) - dt;
      if (this._policeSpawnTimer <= 0) {
        const car = spawnPoliceCar(this.city, this.rng, this.player.x, this.player.y);
        if (car) this.police.push(car);
        this._policeSpawnTimer = 1.5;
      }
    }
  }

  // ------------------------------------------------------------ particles
  burst(x, y, color, count, speed = 120) {
    for (let i = 0; i < count; i++) {
      const a = range(this.rng, 0, Math.PI * 2);
      const v = range(this.rng, speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: range(this.rng, 0.3, 0.7), maxLife: 0.7,
        color, size: range(this.rng, 2, 5),
      });
    }
  }

  // ------------------------------------------------------------ entering cars
  _nearestCar(maxDist) {
    const pl = this.player;
    let best = null;
    let bestD = maxDist;
    for (const car of [...this.traffic, ...this.parked, ...this.police]) {
      const d = Math.hypot(car.x - pl.x, car.y - pl.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  _enterCar() {
    const car = this._nearestCar(70);
    if (!car) return;
    if (car.kind === 'police') {
      this.missions.say('That is a police car. Bad idea.', 3);
      return;
    }
    // Steal it: the driver (if any) bails, the car is yours now.
    if (car.kind === 'traffic') {
      this.traffic = this.traffic.filter((c) => c !== car);
      this.addWanted(1);
      this.missions.say('Car jacked! The heat is on.', 3);
    } else {
      this.parked = this.parked.filter((c) => c !== car);
    }
    car.kind = 'player';
    car.speed = 0;
    this.player.car = car;
    this.player.x = car.x;
    this.player.y = car.y;
    this.player.angle = car.angle;
    this.audio.enterCar();
  }

  _exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.kind = 'parked';
    car.speed = 0;
    this.parked.push(car);
    // Step out beside the car.
    const px = car.x - Math.sin(car.angle) * 30;
    const py = car.y + Math.cos(car.angle) * 30;
    const res = this.city.resolveCircle(px, py, PLAYER_RADIUS);
    this.player.x = res.x;
    this.player.y = res.y;
    this.player.angle = car.angle;
    this.player.car = null;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    this.t += dt;
    const pressed = this.input.takePressed();
    if (pressed & ACTION.MUTE) {
      const muted = this.audio.toggleMute();
      this.missions.say(muted ? 'Sound off.' : 'Sound on.', 2);
    }
    if (pressed & ACTION.PAUSE && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'playing' ? 'paused' : 'playing';
    }

    if (this.state === 'title') {
      this.audio.unlock();
      if (pressed & ACTION.RESTART) this._startPlay();
      this._idleWorld(dt);
      return;
    }
    if (this.state === 'paused') return;
    if (this.state === 'busted' || this.state === 'wasted') {
      this.endTimer -= dt;
      if (pressed & ACTION.RESTART && this.endTimer <= 0) this._respawn();
      this._idleWorld(dt);
      return;
    }

    // --- playing ---
    this.audio.unlock();
    if (pressed & ACTION.MISSION) {
      if (!this.missions.startNext(this.player.x, this.player.y)) {
        if (!this.missions.active) this.missions.say('Mara is lining up the next job…', 2);
      }
    }

    const pl = this.player;
    const held = this.input.held;

    if (pl.car) {
      // Driving.
      if (pressed & ACTION.ENTER) this._exitCar();
      else {
        const car = pl.car;
        car.drive(held, dt);
        const hitBuilding = car.collideCity(this.city);
        if (hitBuilding && Math.abs(car.speed) > 200) {
          this._damagePlayer(6);
          this.audio.crash();
          this.burst(car.x, car.y, '#ffb347', 10, 160);
        }
        pl.x = car.x;
        pl.y = car.y;
        pl.angle = car.angle;
      }
    } else {
      // On foot.
      if (pressed & ACTION.ENTER) this._enterCar();
      let mx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      let my = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len; my /= len;
        pl.x += mx * WALK_SPEED * dt;
        pl.y += my * WALK_SPEED * dt;
        pl.angle = Math.atan2(my, mx);
        pl.walkPhase += dt * 11;
      }
      const res = this.city.resolveCircle(pl.x, pl.y, PLAYER_RADIUS);
      pl.x = res.x;
      pl.y = res.y;
      pl.x = clamp(pl.x, 40, WORLD_W - 40);
      pl.y = clamp(pl.y, 40, WORLD_H - 40);
    }
    if (pl.hurtFlash > 0) pl.hurtFlash -= dt;

    // Traffic + parked cars + peds keep the streets alive near the player.
    this._maintainPopulation(dt);
    for (const car of this.traffic) updateTrafficCar(car, dt, this.city);
    for (const p of this.peds) p.update(dt, this.city, pl);

    // Car-on-car collisions with the player's car.
    if (pl.car) {
      for (const other of [...this.traffic, ...this.parked, ...this.police]) {
        const impact = carsCollide(pl.car, other);
        if (impact > 60) {
          this._damagePlayer(Math.min(14, impact * 0.03));
          this.audio.crash();
          this.burst(other.x, other.y, '#ffb347', 12, 180);
          if (other.kind === 'police') this.addWanted(1);
          if (other.kind === 'traffic' || other.kind === 'parked') {
            other.speed *= 0.5;
          }
        }
      }
      // Running over a pedestrian is a crime.
      for (const p of this.peds) {
        if (p.down <= 0 && Math.hypot(p.x - pl.x, p.y - pl.y) < 30) {
          p.down = 4;
          this.addWanted(1);
          this.audio.crash();
          this.burst(p.x, p.y, '#ff5a5a', 8, 120);
          this.missions.say('You hit a pedestrian! The cops saw that.', 3);
        }
      }
    }

    // Police behaviour.
    this.crimeTimer += dt;
    this._spawnPoliceIfNeeded(dt);
    let copTouching = false;
    for (const car of this.police) {
      updatePoliceCar(car, dt, this.city, pl.x, pl.y);
      const d = Math.hypot(car.x - pl.x, car.y - pl.y);
      if (d < 46) {
        copTouching = true;
        // A cop ramming the player hurts.
        if (Math.abs(car.speed) > 150) this._damagePlayer(4 * dt * 10);
      }
    }
    if (copTouching && this.wanted > 0 && Math.abs(pl.car ? pl.car.speed : 0) < 60) {
      this.bustTimer += dt;
      if (this.bustTimer > 1.2) return this._busted();
    } else {
      this.bustTimer = 0;
    }
    // Wanted fades when the player stays clean and out of sight.
    if (this.wanted > 0 && this.crimeTimer > WANTED_DECAY_SECONDS) {
      const nearestCop = this.police.reduce(
        (m, c) => Math.min(m, Math.hypot(c.x - pl.x, c.y - pl.y)), Infinity,
      );
      if (nearestCop > 500) {
        this.wanted--;
        this.crimeTimer = 0;
        this.police = this.police.slice(0, this.wanted);
        this.missions.say('The heat is cooling off…', 3);
      }
    }

    // Cash pickups.
    for (const c of this.cashPickups) {
      if (c.taken) continue;
      if (Math.hypot(c.x - pl.x, c.y - pl.y) < 30) {
        c.taken = true;
        this.money += CASH_PICKUP_VALUE;
        this.audio.cash();
        this.burst(c.x, c.y, '#7be382', 10, 120);
        this.missions.say(`Found a dropped wallet: +$${CASH_PICKUP_VALUE}.`, 2);
        // A fresh wallet turns up somewhere else later.
        setTimeout(() => { c.taken = false; }, 45000);
      }
    }

    // Missions.
    this.missions.update(dt, this);

    // Slow health regen while clean.
    if (this.wanted === 0 && pl.health < PLAYER_MAX_HEALTH) {
      pl.health = Math.min(PLAYER_MAX_HEALTH, pl.health + 2 * dt);
    }

    // Particles.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    // Audio beds.
    this.audio.setSiren(this.wanted > 0);
    this.audio.setEngine(pl.car ? pl.car.speed : 0, !!pl.car);

    // Camera follows the player.
    const tx = clamp(pl.x, VIEW_W / 2, WORLD_W - VIEW_W / 2);
    const ty = clamp(pl.y, VIEW_H / 2, WORLD_H - VIEW_H / 2);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);

    if (this.money > (this.save.bestMoney || 0)) this._storeSave();
  }

  _idleWorld(dt) {
    // The title / end screens still show a living street behind them.
    for (const car of this.traffic) updateTrafficCar(car, dt, this.city);
    for (const p of this.peds) p.update(dt, this.city, this.player);
    this.cam.x += (clamp(this.player.x, VIEW_W / 2, WORLD_W - VIEW_W / 2) - this.cam.x) * Math.min(1, dt * 2);
    this.cam.y += (clamp(this.player.y, VIEW_H / 2, WORLD_H - VIEW_H / 2) - this.cam.y) * Math.min(1, dt * 2);
  }

  _maintainPopulation(dt) {
    void dt;
    const px = this.player.x;
    const py = this.player.y;
    // Drop traffic that has wandered far away; top back up near the player.
    this.traffic = this.traffic.filter((c) => Math.hypot(c.x - px, c.y - py) < 1400);
    while (this.traffic.length < 8) {
      const car = spawnTrafficCar(this.city, this.rng, px, py);
      if (!car) break;
      this.traffic.push(car);
    }
    this.parked = this.parked.filter((c) => Math.hypot(c.x - px, c.y - py) < 1400);
    while (this.parked.length < 6) {
      const car = spawnParkedCar(this.city, this.rng, px, py);
      if (!car) break;
      this.parked.push(car);
    }
    this.peds = this.peds.filter((p) => Math.hypot(p.x - px, p.y - py) < 1200);
    while (this.peds.length < 14) {
      this.peds.push(new Ped(
        clamp(px + range(this.rng, -700, 700), 80, WORLD_W - 80),
        clamp(py + range(this.rng, -600, 600), 80, WORLD_H - 80),
        this.rng,
      ));
    }
  }

  _damagePlayer(amount) {
    const pl = this.player;
    pl.health -= amount;
    pl.hurtFlash = 0.25;
    if (pl.health <= 0) this._wasted();
  }

  _startPlay() {
    this.state = 'playing';
    this.missions.say("Mara: Welcome to Palm Bay. Press M when you want work.", 5);
  }

  _busted() {
    this.state = 'busted';
    this.endTimer = 1.0;
    const fine = Math.min(this.money, BUST_FINE);
    this.money -= fine;
    this.wanted = 0;
    this.police = [];
    this.bustTimer = 0;
    if (this.player.car) {
      this.player.car.kind = 'parked';
      this.parked.push(this.player.car);
      this.player.car = null;
    }
    this.audio.busted();
    this.audio.setSiren(false);
    this.audio.setEngine(0, false);
    this._storeSave();
  }

  _wasted() {
    this.state = 'wasted';
    this.endTimer = 1.0;
    this.money = Math.max(0, this.money - 200);
    this.wanted = 0;
    this.police = [];
    if (this.player.car) {
      this.player.car.kind = 'parked';
      this.parked.push(this.player.car);
      this.player.car = null;
    }
    this.audio.setSiren(false);
    this.audio.setEngine(0, false);
    this._storeSave();
  }

  _respawn() {
    const clinic = this.city.landmarks.clinic;
    const bar = this.city.landmarks.marasBar;
    const spot = this.state === 'wasted' ? clinic : bar;
    this.player.x = spot.x + 60;
    this.player.y = spot.y + 40;
    this.player.health = PLAYER_MAX_HEALTH;
    this.player.angle = -Math.PI / 2;
    this.player.car = null;
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.missions.abandon();
    this.state = 'playing';
  }

  render(ctx) {
    ctx.save();
    ctx.translate(-Math.round(this.cam.x - VIEW_W / 2), -Math.round(this.cam.y - VIEW_H / 2));
    drawWorld(ctx, this, this.cam);
    ctx.restore();
    if (this.state === 'playing' || this.state === 'paused') drawHUD(ctx, this);
    if (this.state === 'title') drawTitle(ctx, this);
    if (this.state === 'paused') drawPause(ctx);
    if (this.state === 'busted') drawEnd(ctx, 'busted', this);
    if (this.state === 'wasted') drawEnd(ctx, 'wasted', this);
  }
}

// ---------------------------------------------------------------- boot
export function boot(canvas) {
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || 1);
  const game = new Game(seed);
  const shot = params.get('shot');
  if (shot) {
    stageShot(game, shot);
    game.render(ctx);
    game.render(ctx);
    window.__shotReady = true;
    return game;
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__game = game;
  return game;
}

// Expose the game for play-testing and for the screenshot helper.
export function createGame(seed) {
  return new Game(seed);
}
