// Sunset Shores — missions from Mara, the fixer.
// One job only: three mission types (delivery, getaway, collect), their
// objectives, timers, rewards, and the phone-call flow that hands them out.
import { pick, rangeInt } from './random.js';

export const MISSION_DEFS = {
  delivery: {
    title: 'Hot Delivery',
    blurb: 'Drive the package to the drop-off before the timer runs out. No scratches, no cops.',
  },
  getaway: {
    title: 'Getaway Driver',
    blurb: 'Pick up the crew at the marker, then shake the heat and reach the Safehouse.',
  },
  collect: {
    title: 'Cash Run',
    blurb: 'Mara stashed cash bags around Palm Bay. Grab them all — the cops are watching.',
  },
};

const REWARDS = { delivery: [150, 300], getaway: [350, 500], collect: [200, 300] };

export class MissionManager {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.current = null;   // {type, title, blurb, target, targetLabel, timeLeft, progress, goal, reward, phase, bags?}
    this.completed = 0;
    this.nextTypeIndex = 0;
    this.cooldown = 0;     // seconds before a new mission can be taken
    this.toast = '';       // short message the HUD shows
    this.toastTime = 0;
  }

  get active() { return this.current !== null; }

  say(text, seconds = 4) {
    this.toast = text;
    this.toastTime = seconds;
  }

  /** Mara calls: hand out the next mission in the rotation. */
  startNext(playerX, playerY) {
    if (this.current || this.cooldown > 0) return false;
    const types = ['delivery', 'getaway', 'collect'];
    const type = types[this.nextTypeIndex % types.length];
    this.nextTypeIndex++;
    const reward = rangeInt(this.rng, REWARDS[type][0], REWARDS[type][1]);
    const def = MISSION_DEFS[type];
    if (type === 'delivery') {
      const spot = this.city.randomLandmark('marasBar');
      this.current = {
        type, title: def.title, blurb: def.blurb,
        target: { x: spot.x, y: spot.y }, targetLabel: spot.label,
        timeLeft: 75, progress: 0, goal: 1, reward, phase: 'drive',
      };
    } else if (type === 'getaway') {
      const pickup = this.city.randomRoadPoint(playerX, playerY, 600);
      this.current = {
        type, title: def.title, blurb: def.blurb,
        target: pickup, targetLabel: 'Crew pickup',
        timeLeft: 0, progress: 0, goal: 2, reward, phase: 'pickup',
      };
    } else {
      const bags = [];
      for (let i = 0; i < 5; i++) {
        bags.push(this.city.randomRoadPoint(playerX, playerY, 350));
      }
      this.current = {
        type, title: def.title, blurb: def.blurb,
        target: bags[0], targetLabel: 'Cash bag',
        timeLeft: 120, progress: 0, goal: 5, reward, phase: 'collect',
        bags,
      };
    }
    this.say(`Mara: ${def.title} — ${def.blurb}`, 5);
    return true;
  }

  /** Called every frame; returns 'done' | 'failed' | null. */
  update(dt, game) {
    if (this.toastTime > 0) this.toastTime -= dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    const m = this.current;
    if (!m) return null;
    if (m.timeLeft > 0) {
      m.timeLeft -= dt;
      if (m.timeLeft <= 0) return this._fail(game, 'Out of time.');
    }
    const px = game.player.x;
    const py = game.player.y;
    const near = Math.hypot(px - m.target.x, py - m.target.y) < 70;
    if (m.type === 'delivery') {
      if (near) return this._complete(game);
    } else if (m.type === 'getaway') {
      if (m.phase === 'pickup') {
        if (near) {
          m.phase = 'escape';
          m.target = { x: this.city.landmarks.safehouse.x, y: this.city.landmarks.safehouse.y };
          m.targetLabel = 'Safehouse';
          m.progress = 1;
          this.say('Crew is in! Lose the cops and reach the Safehouse.', 4);
          game.addWanted(2);
        }
      } else if (near && game.wanted === 0) {
        return this._complete(game);
      }
    } else if (m.type === 'collect') {
      if (near) {
        m.progress++;
        game.money += 40;
        game.audio.pickup();
        this.say(`Cash bag ${m.progress}/5 grabbed (+$40).`, 2);
        if (m.progress >= m.goal) return this._complete(game);
        m.target = m.bags[m.progress];
      }
    }
    return null;
  }

  _complete(game) {
    const m = this.current;
    game.money += m.reward;
    game.audio.missionDone();
    this.completed++;
    this.say(`Mission complete: ${m.title} — +$${m.reward}!`, 5);
    this.current = null;
    this.cooldown = 3;
    return 'done';
  }

  _fail(game, why) {
    const m = this.current;
    this.say(`Mission failed: ${m.title} — ${why}`, 5);
    this.current = null;
    this.cooldown = 5;
    return 'failed';
  }

  abandon() {
    if (!this.current) return;
    this.say(`Mission abandoned: ${this.current.title}.`, 4);
    this.current = null;
    this.cooldown = 5;
  }
}
