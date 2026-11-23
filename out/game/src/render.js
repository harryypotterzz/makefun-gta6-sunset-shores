// Sunset Shores — everything the player sees.
// One job only: draw the city, the cars, the people and the particles, then
// the HUD (money, health, wanted stars, mission, minimap), then the menus.
import {
  WORLD_W, WORLD_H, ROAD_W, ROAD_COLOR, ROAD_EDGE, SIDEWALK_COLOR,
  GROUND_COLOR, SAND_COLOR, WATER_COLOR, CAR_LENGTH, CAR_WIDTH,
  PLAYER_MAX_HEALTH, VIEW_W, VIEW_H,
} from './config.js';
import { AVENUES, STREETS } from './city.js';

const MINIMAP_W = 210;
const MINIMAP_H = 158;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, kind, sirenPhase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 4, CAR_LENGTH, CAR_WIDTH, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = color;
  roundRect(ctx, -CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 8);
  ctx.fill();
  // Cabin / windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -6, -CAR_WIDTH / 2 + 4, 16, CAR_WIDTH - 8, 4);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(CAR_LENGTH / 2 - 3, -CAR_WIDTH / 2 + 3, 3, 5);
  ctx.fillRect(CAR_LENGTH / 2 - 3, CAR_WIDTH / 2 - 8, 3, 5);
  // Wheels.
  ctx.fillStyle = '#16181d';
  for (const [wx, wy] of [[-16, -CAR_WIDTH / 2 - 2], [14, -CAR_WIDTH / 2 - 2], [-16, CAR_WIDTH / 2 - 4], [14, CAR_WIDTH / 2 - 4]]) {
    ctx.fillRect(wx, wy, 10, 6);
  }
  // Police livery + flashing light bar.
  if (kind === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-CAR_LENGTH / 2 + 4, -CAR_WIDTH / 2 + 2, CAR_LENGTH - 8, 4);
    const flash = Math.sin(sirenPhase) > 0;
    ctx.fillStyle = flash ? '#ff2f2f' : '#2f7bff';
    ctx.fillRect(-4, -CAR_WIDTH / 2 - 1, 5, 5);
    ctx.fillStyle = flash ? '#2f7bff' : '#ff2f2f';
    ctx.fillRect(2, -CAR_WIDTH / 2 - 1, 5, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  ctx.restore();
}

export function drawWorld(ctx, game, cam) {
  const { city, t } = game;
  const x0 = cam.x - VIEW_W / 2;
  const y0 = cam.y - VIEW_H / 2;
  const x1 = x0 + VIEW_W;
  const y1 = y0 + VIEW_H;

  // Ground.
  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(x0, y0, VIEW_W, VIEW_H);

  // Beach + water along the south edge.
  ctx.fillStyle = SAND_COLOR;
  ctx.fillRect(
    Math.max(x0, 0), Math.max(y0, city.beachTop),
    Math.min(x1, WORLD_W) - Math.max(x0, 0),
    WORLD_H - Math.max(y0, city.beachTop),
  );
  const waterY = WORLD_H - 60;
  if (y1 > waterY) {
    ctx.fillStyle = WATER_COLOR;
    ctx.fillRect(
      Math.max(x0, 0), Math.max(y0, waterY),
      Math.min(x1, WORLD_W) - Math.max(x0, 0),
      WORLD_H - Math.max(y0, waterY),
    );
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let wx = 0; wx < WORLD_W; wx += 130) {
      const wy = waterY + 18 + Math.sin(t * 1.4 + wx * 0.02) * 5;
      ctx.fillRect(wx, wy, 46, 3);
    }
  }

  // Parks.
  for (const p of city.parks) {
    if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
    ctx.fillStyle = '#5d9e4a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#4a8a3c';
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  // Roads: asphalt, edge lines, centre dashes.
  ctx.fillStyle = ROAD_COLOR;
  for (const ax of AVENUES) {
    ctx.fillRect(ax - ROAD_W / 2, Math.max(y0, 0), ROAD_W, Math.min(y1, WORLD_H) - Math.max(y0, 0));
  }
  for (const sy of STREETS) {
    ctx.fillRect(Math.max(x0, 0), sy - ROAD_W / 2, Math.min(x1, WORLD_W) - Math.max(x0, 0), ROAD_W);
  }
  ctx.strokeStyle = ROAD_EDGE;
  ctx.lineWidth = 2;
  for (const ax of AVENUES) {
    ctx.beginPath(); ctx.moveTo(ax - ROAD_W / 2, Math.max(y0, 0)); ctx.lineTo(ax - ROAD_W / 2, Math.min(y1, WORLD_H)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + ROAD_W / 2, Math.max(y0, 0)); ctx.lineTo(ax + ROAD_W / 2, Math.min(y1, WORLD_H)); ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 0), sy - ROAD_W / 2); ctx.lineTo(Math.min(x1, WORLD_W), sy - ROAD_W / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 0), sy + ROAD_W / 2); ctx.lineTo(Math.min(x1, WORLD_W), sy + ROAD_W / 2); ctx.stroke();
  }
  ctx.fillStyle = '#e8d44d';
  for (const ax of AVENUES) {
    for (let y = 0; y < WORLD_H; y += 64) {
      if (y < y0 - 32 || y > y1) continue;
      ctx.fillRect(ax - 2, y, 4, 30);
    }
  }
  for (const sy of STREETS) {
    for (let x = 0; x < WORLD_W; x += 64) {
      if (x < x0 - 32 || x > x1) continue;
      ctx.fillRect(x, sy - 2, 30, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(232,232,232,0.7)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      if (ax < x0 - 80 || ax > x1 + 80 || sy < y0 - 80 || sy > y1 + 80) continue;
      for (let i = -3; i <= 3; i++) ctx.fillRect(ax + i * 12 - 4, sy - ROAD_W / 2 + 6, 7, 14);
    }
  }

  // Sidewalks: pale border around each block.
  ctx.fillStyle = SIDEWALK_COLOR;
  for (let i = 0; i < AVENUES.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      const bx0 = AVENUES[i] + ROAD_W / 2;
      const by0 = STREETS[j] + ROAD_W / 2;
      const bw = AVENUES[i + 1] - AVENUES[i] - ROAD_W;
      const bh = STREETS[j + 1] - STREETS[j] - ROAD_W;
      if (bx0 > x1 || bx0 + bw < x0 || by0 > y1 || by0 + bh < y0) continue;
      ctx.fillRect(bx0, by0, bw, bh);
    }
  }

  // Buildings with a sun-offset shadow and a roof line.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + b.height * 0.5, b.y + b.height * 0.7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Windows.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(b.x + 10 + c * 26, b.y + 10 + r * 26, 10, 8);
      }
    }
  }

  // Trees.
  for (const tr of city.trees) {
    if (tr.x < x0 - 20 || tr.x > x1 + 20 || tr.y < y0 - 20 || tr.y > y1 + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.arc(tr.x + 4, tr.y + 5, tr.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3e8a3a';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a84e';
    ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Landmark labels.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const lm of Object.values(city.landmarks)) {
    if (lm.x < x0 - 60 || lm.x > x1 + 60 || lm.y < y0 - 60 || lm.y > y1 + 60) continue;
    ctx.fillStyle = lm.color;
    ctx.beginPath(); ctx.arc(lm.x, lm.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('★', lm.x, lm.y + 4);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(lm.label, lm.x + 1, lm.y + 27);
    ctx.fillStyle = '#fff';
    ctx.fillText(lm.label, lm.x, lm.y + 26);
  }

  // Free-roam cash pickups.
  for (const c of game.cashPickups) {
    if (c.taken) continue;
    if (c.x < x0 - 20 || c.x > x1 + 20 || c.y < y0 - 20 || c.y > y1 + 20) continue;
    const bob = Math.sin(t * 4 + c.x) * 3;
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath(); ctx.arc(c.x, c.y + bob, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d44d';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('$', c.x, c.y + bob + 5);
  }

  // Mission marker: pulsing beacon + dashed line to it.
  const m = game.missions.current;
  if (m) {
    const pulse = 14 + Math.sin(t * 5) * 5;
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.target.x, m.target.y, pulse + 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(m.target.x, m.target.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('!', m.target.x, m.target.y + 4);
    ctx.strokeStyle = 'rgba(255,210,60,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(game.player.x, game.player.y); ctx.lineTo(m.target.x, m.target.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Parked + traffic + police cars.
  for (const car of game.parked) drawCarShape(ctx, car.x, car.y, car.angle, car.color, 'parked', 0);
  for (const car of game.traffic) drawCarShape(ctx, car.x, car.y, car.angle, car.color, 'traffic', 0);
  for (const car of game.police) drawCarShape(ctx, car.x, car.y, car.angle, car.color, 'police', car.sirenPhase);

  // Pedestrians.
  for (const p of game.peds) {
    if (p.x < x0 - 20 || p.x > x1 + 20 || p.y < y0 - 20 || p.y > y1 + 20) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.down > 0) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath(); ctx.arc(11, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      const bob = Math.sin(p.walkPhase) * 2;
      ctx.fillStyle = '#2c3038';
      ctx.fillRect(-5, -2 + bob, 4, 12);
      ctx.fillRect(1, -2 - bob, 4, 12);
      ctx.fillStyle = p.shirt;
      roundRect(ctx, -7, -12, 14, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath(); ctx.arc(0, -16, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // The player: a little runner on foot, the driven car when driving.
  const pl = game.player;
  if (pl.car) {
    drawCarShape(ctx, pl.car.x, pl.car.y, pl.car.angle, pl.car.color, 'player', 0);
  } else {
    ctx.save();
    ctx.translate(pl.x, pl.y);
    ctx.rotate(pl.angle + Math.PI / 2);
    const bob = Math.sin(pl.walkPhase) * 2.5;
    ctx.fillStyle = pl.hurtFlash > 0 ? '#ff5a5a' : '#2c3038';
    ctx.fillRect(-6, -2 + bob, 5, 13);
    ctx.fillRect(1, -2 - bob, 5, 13);
    ctx.fillStyle = '#d23c3c';
    roundRect(ctx, -8, -13, 16, 15, 5);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(0, -17, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c3038';
    ctx.beginPath(); ctx.arc(0, -20, 7, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  // Particles (sparks, smoke, pickup glints).
  for (const pt of game.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a + 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawHUD(ctx, game) {
  const { player, money, wanted, missions } = game;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Money + health, top-left.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 12, 12, 250, 84, 10);
  ctx.fill();
  ctx.fillStyle = '#7be382';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${money.toLocaleString('en-US')}`, 26, 42);
  ctx.fillStyle = '#222';
  roundRect(ctx, 26, 52, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = player.health > 30 ? '#7be382' : '#ff5a5a';
  roundRect(ctx, 26, 52, 150 * Math.max(0, player.health / PLAYER_MAX_HEALTH), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('HEALTH', 184, 62);
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Missions done: ${missions.completed}`, 26, 86);

  // Wanted stars, top-right.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, VIEW_W - 232, 12, 220, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('WANTED', VIEW_W - 218, 32);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd23c' : 'rgba(255,255,255,0.25)';
    ctx.font = '22px sans-serif';
    ctx.fillText('★', VIEW_W - 148 + i * 28, 46);
  }

  // Mission panel, bottom-left.
  const m = missions.current;
  if (m) {
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    roundRect(ctx, 12, VIEW_H - 108, 360, 96, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`◆ ${m.title}`, 26, VIEW_H - 82);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(m.targetLabel, 26, VIEW_H - 60);
    if (m.type === 'collect') {
      ctx.fillText(`Bags: ${m.progress}/${m.goal}`, 26, VIEW_H - 40);
    } else if (m.type === 'getaway') {
      ctx.fillText(
        m.phase === 'pickup' ? 'Pick up the crew' : 'Reach the Safehouse — lose the cops!',
        26, VIEW_H - 40,
      );
    } else if (m.timeLeft > 0) {
      ctx.fillStyle = m.timeLeft < 15 ? '#ff5a5a' : '#fff';
      ctx.fillText(`Time left: ${Math.ceil(m.timeLeft)}s`, 26, VIEW_H - 40);
    }
    const dist = Math.hypot(player.x - m.target.x, player.y - m.target.y);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${Math.round(dist)}m away`, 26, VIEW_H - 22);
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    roundRect(ctx, 12, VIEW_H - 52, 360, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText('Press M — Mara has work for you.  E — get in a car.', 26, VIEW_H - 27);
  }

  // Speed, bottom-centre (only while driving).
  if (player.car) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, VIEW_W / 2 - 90, VIEW_H - 64, 180, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(Math.abs(player.car.speed) * 0.12)} mph`, VIEW_W / 2, VIEW_H - 30);
    ctx.textAlign = 'left';
  }

  // Toast (mission messages), centre-top.
  if (missions.toastTime > 0 && missions.toast) {
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(missions.toast).width + 32;
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    roundRect(ctx, (VIEW_W - w) / 2, 76, w, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.textAlign = 'center';
    ctx.fillText(missions.toast, VIEW_W / 2, 100);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, game);
}

function drawMinimap(ctx, game) {
  const mx = VIEW_W - MINIMAP_W - 12;
  const my = VIEW_H - MINIMAP_H - 12;
  const sx = MINIMAP_W / WORLD_W;
  const sy = MINIMAP_H / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  roundRect(ctx, mx - 4, my - 4, MINIMAP_W + 8, MINIMAP_H + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, MINIMAP_W, MINIMAP_H);
  ctx.clip();
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(mx, my, MINIMAP_W, MINIMAP_H);
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 3;
  for (const ax of AVENUES) {
    ctx.beginPath(); ctx.moveTo(mx + ax * sx, my); ctx.lineTo(mx + ax * sx, my + MINIMAP_H); ctx.stroke();
  }
  for (const sy2 of STREETS) {
    ctx.beginPath(); ctx.moveTo(mx, my + sy2 * sy); ctx.lineTo(mx + MINIMAP_W, my + sy2 * sy); ctx.stroke();
  }
  for (const lm of Object.values(game.city.landmarks)) {
    ctx.fillStyle = lm.color;
    ctx.fillRect(mx + lm.x * sx - 2, my + lm.y * sy - 2, 4, 4);
  }
  const m = game.missions.current;
  if (m) {
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(mx + m.target.x * sx, my + m.target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of game.police) {
    ctx.fillStyle = '#ff2f2f';
    ctx.beginPath(); ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const pl = game.player;
  ctx.save();
  ctx.translate(mx + pl.x * sx, my + pl.y * sy);
  ctx.rotate(pl.car ? pl.car.angle : pl.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('PALM BAY', mx + 6, my + 14);
}

export function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SUNSET SHORES', VIEW_W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('An open-world crime story in Palm Bay', VIEW_W / 2, 232);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cfe0f0';
  ctx.fillText('Steal cars. Outrun the Palm Bay PD. Run jobs for Mara and get rich.', VIEW_W / 2, 268);
  ctx.fillText('Explore the city on foot or behind the wheel — every street is open.', VIEW_W / 2, 292);
  ctx.fillStyle = 'rgba(10,14,20,0.8)';
  roundRect(ctx, VIEW_W / 2 - 260, 330, 520, 170, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD / Arrows — walk or drive      E — steal / exit car', VIEW_W / 2, 362);
  ctx.fillText('M — take a job from Mara      P — pause      Q — mute', VIEW_W / 2, 390);
  ctx.fillText('Wanted stars bring the police. Get busted and you pay a fine.', VIEW_W / 2, 418);
  ctx.fillText('Get wasted and you wake up at the Clinic, lighter by $200.', VIEW_W / 2, 446);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 22px sans-serif';
  const blink = Math.sin(game.t * 4) > -0.2;
  if (blink) ctx.fillText('Press ENTER to start', VIEW_W / 2, 560);
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Best: $${game.save.bestMoney.toLocaleString('en-US')}   •   Missions done: ${game.save.missionsDone}`, VIEW_W / 2, 600);
  ctx.fillText('Your progress saves on this machine.', VIEW_W / 2, 624);
  ctx.textAlign = 'left';
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(8,12,24,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 330);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P to keep playing', VIEW_W / 2, 372);
  ctx.textAlign = 'left';
}

export function drawEnd(ctx, kind, game) {
  ctx.fillStyle = 'rgba(8,12,24,0.65)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (kind === 'busted') {
    ctx.fillStyle = '#7db8ff';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('BUSTED!', VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('The Palm Bay PD caught you. You paid the fine and walked.', VIEW_W / 2, 344);
  } else {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('You woke up at the Clinic. The city is still out there.', VIEW_W / 2, 344);
  }
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`You are carrying $${game.money.toLocaleString('en-US')}`, VIEW_W / 2, 400);
  const blink = Math.sin(game.t * 4) > -0.2;
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.fillText('Press ENTER to get back out there', VIEW_W / 2, 460);
  }
  ctx.textAlign = 'left';
}
