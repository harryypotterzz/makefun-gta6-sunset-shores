// Screenshot scenes: when the page opens with ?scene=<name>, drive the
// game into that exact scene so screenshots are reproducible.

import { startMission } from './missions.js';
import { createPoliceCar } from './entities.js';

function trafficCarAt(x, y, angle, speed, color) {
  const axis = Math.abs(Math.cos(angle)) > 0.5 ? 'h' : 'v';
  const road = axis === 'h' ? y : x;
  const dir = axis === 'h'
    ? (Math.cos(angle) >= 0 ? 1 : -1)
    : (Math.sin(angle) >= 0 ? 1 : -1);
  return {
    kind: 'traffic',
    x, y, angle, speed, color,
    axis, road, dir,
    lane: 14,
    cruise: speed,
    turnCooldown: 5,
    length: 34,
    width: 18,
  };
}

export function setupScene(game, name) {
  if (name === 'title') return;
  const { player } = game;
  game.state = 'playing';

  if (name === 'drive') {
    game.giveCar(1000, 600, 0);
    player.inCar.speed = 210;
    // Clear random traffic from the player's lane so the shot reads.
    game.traffic = game.traffic.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) > 350);
    game.traffic.push(trafficCarAt(1260, 614, 0, 110, '#2980b9'));
    game.traffic.push(trafficCarAt(700, 586, Math.PI, 120, '#c0392b'));
    game.traffic.push(trafficCarAt(1000, 1400, Math.PI / 2, 100, '#f1c40f'));
    game.peds.push({ x: 1120, y: 656, angle: 0, speed: 55, state: 'walk', downTimer: 0, fleeTimer: 0, fleeAngle: 0, radius: 10 });
    game.message = 'Cruising Palm Bay — press E to leave the car';
    game.messageTimer = 6;
    return;
  }

  if (name === 'chase') {
    game.giveCar(1400, 1250, -Math.PI / 2);
    player.inCar.speed = 320;
    game.traffic = game.traffic.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) > 350);
    player.wanted = 2;
    player.lastCrimeAt = game.time;
    const cop1 = createPoliceCar(game.city, 1400, 1720);
    cop1.angle = -Math.PI / 2;
    cop1.speed = 300;
    const cop2 = createPoliceCar(game.city, 1452, 1660);
    cop2.angle = -Math.PI / 2;
    cop2.speed = 290;
    game.police.push(cop1, cop2);
    game.traffic.push(trafficCarAt(1800, 1000, 0, 120, '#ecf0f1'));
    game.traffic.push(trafficCarAt(1000, 1000, 0, 100, '#e67e22'));
    game.message = 'Wanted level 2 — lose the police!';
    game.messageTimer = 6;
    return;
  }

  if (name === 'mission') {
    game.giveCar(1000, 1000, 0);
    player.inCar.speed = 180;
    game.traffic = game.traffic.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) > 350);
    const mission = startMission(game.missionManager, 'delivery', {
      city: game.city,
      rng: game.rng,
      player,
    });
    // A fixed destination straight ahead, so the marker reads clearly.
    mission.target = { x: 1800, y: 1000 };
    mission.timer = 60;
    mission.duration = 60;
    mission.reward = 250;
    game.traffic.push(trafficCarAt(1300, 1014, 0, 100, '#16a085'));
    game.traffic.push(trafficCarAt(1600, 986, Math.PI, 110, '#8e44ad'));
    game.peds.push({ x: 1150, y: 1056, angle: Math.PI, speed: 50, state: 'walk', downTimer: 0, fleeTimer: 0, fleeAngle: 0, radius: 10 });
    game.message = 'Parcel Delivery — reach the gold marker';
    game.messageTimer = 6;
  }
}
