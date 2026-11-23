// Missions: three jobs that pay. One runs at a time, started with M
// or by driving onto the glowing job marker. Each has a target on the
// map, a timer, and a reward; finishing one pays and frees the slot.

import { CONFIG } from './config.js';
import { distance } from './entities.js';
import { randomRoadPoint } from './city.js';

export const MISSION_TYPES = ['delivery', 'getaway', 'cashrun'];

const NAMES = {
  delivery: 'Parcel Delivery',
  getaway: 'Getaway',
  cashrun: 'Cash Run',
};

export function createMissionManager() {
  return { active: null, nextIndex: 0, completed: 0 };
}

function farRoadPoint(city, rng, from, minDist, maxDist) {
  for (let tries = 0; tries < 24; tries++) {
    const spot = randomRoadPoint(city, rng);
    const d = distance(spot.x, spot.y, from.x, from.y);
    if (d >= minDist && d <= maxDist) return { point: spot, distance: d };
  }
  const spot = randomRoadPoint(city, rng);
  return { point: spot, distance: distance(spot.x, spot.y, from.x, from.y) };
}

export function startMission(manager, type, world) {
  const { city, rng, player } = world;
  let mission = null;

  if (type === 'delivery') {
    const { point, distance: d } = farRoadPoint(city, rng, player, 600, 1400);
    mission = {
      type,
      name: NAMES[type],
      objective: 'Drive the parcel to the gold marker',
      target: point,
      timer: d / 200 + 25,
      duration: d / 200 + 25,
      reward: Math.round(CONFIG.missionRewardBase + d * CONFIG.missionRewardPerPixel),
      pickups: [],
      collected: 0,
      stage: 'deliver',
      layLow: 0,
    };
  } else if (type === 'getaway') {
    const { point } = farRoadPoint(city, rng, player, 650, 1100);
    mission = {
      type,
      name: NAMES[type],
      objective: 'Reach the safe house and shake the police',
      target: point,
      timer: 80,
      duration: 80,
      reward: 220,
      pickups: [],
      collected: 0,
      stage: 'reach',
      layLow: 0,
    };
  } else {
    // Cash Run: five bundles around a district, then a drop-off.
    const { point: centre } = farRoadPoint(city, rng, player, 300, 700);
    const pickups = [];
    for (let i = 0; i < CONFIG.missionCashRunPickups; i++) {
      pickups.push({
        x: centre.x + rng.range(-320, 320),
        y: centre.y + rng.range(-320, 320),
        value: 25,
        taken: false,
        bob: rng.range(0, Math.PI * 2),
      });
    }
    const { point: drop } = farRoadPoint(city, rng, centre, 500, 1000);
    mission = {
      type,
      name: NAMES[type],
      objective: `Collect ${CONFIG.missionCashRunPickups} cash bundles`,
      target: centre,
      dropoff: drop,
      timer: 120,
      duration: 120,
      reward: CONFIG.missionCashRunBonus,
      pickups,
      collected: 0,
      stage: 'collect',
      layLow: 0,
    };
  }

  manager.active = mission;
  return mission;
}

// Advance the active mission one frame. Returns an event for main.js:
// { event: 'completed', reward } or { event: 'failed', reason } or null.
export function updateMission(manager, dt, world) {
  const mission = manager.active;
  if (!mission) return null;
  const { player, police } = world;

  mission.timer -= dt;
  if (mission.timer <= 0) {
    manager.active = null;
    return { event: 'failed', reason: 'Time ran out' };
  }

  if (mission.type === 'delivery') {
    if (distance(player.x, player.y, mission.target.x, mission.target.y) < 46) {
      manager.active = null;
      manager.completed += 1;
      return { event: 'completed', reward: mission.reward };
    }
  } else if (mission.type === 'getaway') {
    if (mission.stage === 'reach') {
      if (distance(player.x, player.y, mission.target.x, mission.target.y) < 52) {
        mission.stage = 'laylow';
        mission.layLow = 4;
        mission.objective = 'Lay low — keep the police away';
      }
    } else {
      const nearest = nearestPoliceDistance(police, player);
      if (nearest < 300) {
        mission.layLow = 4;
      } else {
        mission.layLow -= dt;
        if (mission.layLow <= 0) {
          manager.active = null;
          manager.completed += 1;
          return { event: 'completed', reward: mission.reward };
        }
      }
    }
  } else if (mission.type === 'cashrun') {
    if (mission.stage === 'collect') {
      for (const pickup of mission.pickups) {
        if (!pickup.taken && distance(player.x, player.y, pickup.x, pickup.y) < 30) {
          pickup.taken = true;
          mission.collected += 1;
          player.money += pickup.value;
        }
      }
      if (mission.collected >= mission.pickups.length) {
        mission.stage = 'deliver';
        mission.target = mission.dropoff;
        mission.objective = 'Deliver the cash to the drop-off';
      }
    } else if (distance(player.x, player.y, mission.target.x, mission.target.y) < 46) {
      manager.active = null;
      manager.completed += 1;
      return { event: 'completed', reward: mission.reward };
    }
  }

  return null;
}

function nearestPoliceDistance(police, player) {
  let best = Infinity;
  for (const car of police) {
    best = Math.min(best, distance(car.x, car.y, player.x, player.y));
  }
  return best;
}
