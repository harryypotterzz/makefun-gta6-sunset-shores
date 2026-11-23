// Everything drawn: the camera that follows the player, the city, the
// cars and people, the HUD, and the minimap. One draw call per frame.

import { CONFIG } from './config.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const C = CONFIG.colors;

  function cameraFor(player, time, state) {
    if (state === 'title') {
      // A slow drift over the city behind the title screen.
      return {
        x: 1100 + Math.sin(time * 0.05) * 500,
        y: 900 + Math.cos(time * 0.04) * 300,
      };
    }
    return {
      x: Math.max(0, Math.min(CONFIG.worldWidth - VIEW_W, player.x - VIEW_W / 2)),
      y: Math.max(0, Math.min(CONFIG.worldHeight - VIEW_H, player.y - VIEW_H / 2)),
    };
  }

  function drawGround(cam, time) {
    // Everything here is in world coordinates: draw() already translated
    // the context by -cam, so the visible world rect is cam .. cam+view.
    ctx.fillStyle = C.grass;
    ctx.fillRect(cam.x, cam.y, VIEW_W, VIEW_H);
    // Mown stripes on the grass, for texture.
    ctx.fillStyle = C.grassDark;
    const stripe = 120;
    const startY = Math.floor(cam.y / (stripe * 2)) * stripe * 2;
    for (let y = startY; y < cam.y + VIEW_H; y += stripe * 2) {
      ctx.fillRect(cam.x, y, VIEW_W, stripe);
    }
    // Sand, then the sea on the east edge.
    ctx.fillStyle = C.sand;
    ctx.fillRect(CONFIG.sandStartX, cam.y, VIEW_W, VIEW_H);
    ctx.fillStyle = C.water;
    ctx.fillRect(CONFIG.waterStartX, cam.y, VIEW_W, VIEW_H);
    // A rolling wave edge where the sea meets the sand.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y <= VIEW_H; y += 24) {
      const wx = CONFIG.waterStartX + Math.sin((cam.y + y) * 0.02 + time * 1.6) * 6;
      if (y === 0) ctx.moveTo(wx, cam.y + y);
      else ctx.lineTo(wx, cam.y + y);
    }
    ctx.stroke();
  }

  function drawRoads(city, cam) {
    const half = CONFIG.roadHalfWidth;
    // Sidewalks first: a lighter band wider than the road.
    ctx.fillStyle = C.sidewalk;
    for (const vx of city.vertical) {
      ctx.fillRect(vx - half - 14, 0, (half + 14) * 2, CONFIG.worldHeight);
    }
    for (const hy of city.horizontal) {
      ctx.fillRect(0, hy - half - 14, CONFIG.worldWidth, (half + 14) * 2);
    }
    // Asphalt.
    ctx.fillStyle = C.asphalt;
    for (const vx of city.vertical) {
      ctx.fillRect(vx - half, 0, half * 2, CONFIG.worldHeight);
    }
    for (const hy of city.horizontal) {
      ctx.fillRect(0, hy - half, CONFIG.worldWidth, half * 2);
    }
    // Centre dashes, only across the visible strip.
    ctx.fillStyle = C.roadLine;
    for (const vx of city.vertical) {
      for (let y = Math.floor(cam.y / 60) * 60; y < cam.y + VIEW_H; y += 60) {
        ctx.fillRect(vx - 2, y, 4, 28);
      }
    }
    for (const hy of city.horizontal) {
      for (let x = Math.floor(cam.x / 60) * 60; x < cam.x + VIEW_W; x += 60) {
        ctx.fillRect(x, hy - 2, 28, 4);
      }
    }
  }

  function drawBuildings(city, cam) {
    for (const b of city.buildings) {
      // Cull in screen space, draw in world space.
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;
      if (sx + b.w < 0 || sx > VIEW_W || sy + b.h < 0 || sy > VIEW_H) continue;
      const x = b.x;
      const y = b.y;
      // Soft shadow, offset to the south-east.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      rr(ctx, x + 6, y + 8, b.w, b.h, 4);
      ctx.fill();
      ctx.fillStyle = b.color;
      rr(ctx, x, y, b.w, b.h, 4);
      ctx.fill();
      // Roof rim and windows.
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      rr(ctx, x, y, b.w, b.h, 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 30));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillRect(x + 10 + i * ((b.w - 20) / cols), y + 9 + j * ((b.h - 18) / rows), 12, 9);
        }
      }
    }
  }

  function drawTrees(city, cam) {
    for (const t of city.trees) {
      const sx = t.x - cam.x;
      const sy = t.y - cam.y;
      if (sx < -30 || sx > VIEW_W + 30 || sy < -30 || sy > VIEW_H + 30) continue;
      const x = t.x;
      const y = t.y;
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(x - 2, y - 2, 4, 8);
      ctx.fillStyle = t.palm ? '#4d8f3d' : C.tree;
      ctx.beginPath();
      ctx.arc(x, y - 4, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.treeDark;
      ctx.beginPath();
      ctx.arc(x - t.r * 0.3, y - 4 - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarShape(car, isPlayer, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Wheels.
    ctx.fillStyle = '#14161a';
    const l = CONFIG.carLength / 2;
    const w = CONFIG.carWidth / 2;
    ctx.fillRect(-l + 3, -w - 3, 9, 5);
    ctx.fillRect(-l + 3, w - 2, 9, 5);
    ctx.fillRect(l - 12, -w - 3, 9, 5);
    ctx.fillRect(l - 12, w - 2, 9, 5);
    // Body.
    ctx.fillStyle = car.color;
    rr(ctx, -l, -w, CONFIG.carLength, CONFIG.carWidth, 6);
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      rr(ctx, -l, -w, CONFIG.carLength, CONFIG.carWidth, 6);
      ctx.stroke();
    }
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(20, 30, 44, 0.85)';
    ctx.fillRect(-2, -w + 3, 9, CONFIG.carWidth - 6);
    ctx.fillRect(-l + 5, -w + 3, 6, CONFIG.carWidth - 6);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(l - 2, -w + 3, 3, 4);
    ctx.fillRect(l - 2, w - 7, 3, 4);
    ctx.restore();

    if (car.kind === 'police') {
      // Flashing light bar, red and blue alternating.
      const phase = Math.floor(time * 6 + (car.sirenPhase || 0)) % 2;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = phase === 0 ? '#ff2d2d' : '#2d6bff';
      ctx.beginPath();
      ctx.arc(-4, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase === 0 ? '#2d6bff' : '#ff2d2d';
      ctx.beginPath();
      ctx.arc(5, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPedestrian(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = '#5a5f6b';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.state === 'flee' ? '#e74c3c' : '#3d6fb4';
    rr(ctx, -7, -6, 14, 12, 5);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(8, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayerShape(player, time) {
    const bob = player.moving ? Math.sin(time * 12) * 1.5 : 0;
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(4, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(player.radius - 2, -2, 6, 4);
    ctx.restore();
  }

  function drawCashPickup(pickup, time) {
    const pulse = 1 + Math.sin(time * 4 + pickup.bob) * 0.15;
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0.5);
    ctx.restore();
  }

  function drawMarker(x, y, color, time, label) {
    const pulse = 1 + Math.sin(time * 5) * 0.2;
    ctx.save();
    ctx.translate(x, y);
    // Light beam.
    const beam = ctx.createLinearGradient(0, -90, 0, 0);
    beam.addColorStop(0, 'rgba(255, 215, 0, 0)');
    beam.addColorStop(1, 'rgba(255, 215, 0, 0.35)');
    ctx.fillStyle = beam;
    ctx.fillRect(-7, -90, 14, 90);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(-9, 12);
    ctx.lineTo(9, 12);
    ctx.closePath();
    ctx.fill();
    if (label) {
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, -30);
    }
    ctx.restore();
  }

  function drawHud(game) {
    const { player, mission, message, messageTimer } = game;
    ctx.textBaseline = 'alphabetic';

    // Top-left panel: money, health, wanted stars.
    ctx.fillStyle = C.hudPanel;
    rr(ctx, 14, 14, 250, 92, 10);
    ctx.fill();
    ctx.fillStyle = C.hudGold;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${Math.floor(player.money)}`, 28, 46);
    ctx.fillStyle = '#ff5a5a';
    rr(ctx, 28, 58, 120, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    rr(ctx, 28, 58, Math.max(0, 120 * (player.health / CONFIG.playerHealth)), 12, 6);
    ctx.fill();
    ctx.fillStyle = C.hudText;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('HP', 156, 69);
    // Wanted stars.
    ctx.font = '24px sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < player.wanted ? '★' : '☆';
    ctx.fillStyle = player.wanted > 0 ? C.hudGold : 'rgba(255,255,255,0.45)';
    ctx.fillText(stars, 28, 100);

    // Mission panel, top centre.
    if (mission) {
      const panelW = 460;
      ctx.fillStyle = C.hudPanel;
      rr(ctx, (VIEW_W - panelW) / 2, 14, panelW, 64, 10);
      ctx.fill();
      ctx.fillStyle = C.hudGold;
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(mission.name, VIEW_W / 2, 38);
      ctx.fillStyle = C.hudText;
      ctx.font = '14px sans-serif';
      const extra = mission.type === 'getaway' && mission.stage === 'laylow'
        ? ` — ${Math.ceil(mission.layLow)}s`
        : mission.type === 'cashrun' && mission.stage === 'collect'
          ? ` — ${mission.collected}/${mission.pickups.length}`
          : '';
      ctx.fillText(`${mission.objective}${extra}`, VIEW_W / 2, 58);
      const frac = Math.max(0, mission.timer / mission.duration);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      rr(ctx, (VIEW_W - panelW) / 2 + 16, 66, panelW - 32, 6, 3);
      ctx.fill();
      ctx.fillStyle = frac > 0.3 ? C.hudGold : '#ff5a5a';
      rr(ctx, (VIEW_W - panelW) / 2 + 16, 66, (panelW - 32) * frac, 6, 3);
      ctx.fill();
    }

    // Speed, top right, while driving.
    if (player.inCar) {
      ctx.fillStyle = C.hudPanel;
      rr(ctx, VIEW_W - 150, 14, 136, 54, 10);
      ctx.fill();
      ctx.fillStyle = C.hudText;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(player.inCar.speed) * 0.55)}`, VIEW_W - 52, 48);
      ctx.font = '13px sans-serif';
      ctx.fillText('km/h', VIEW_W - 24, 48);
    }

    // Event message, bottom centre.
    if (message && messageTimer > 0) {
      ctx.fillStyle = C.hudPanel;
      const w = 520;
      rr(ctx, (VIEW_W - w) / 2, VIEW_H - 64, w, 40, 10);
      ctx.fill();
      ctx.fillStyle = C.hudText;
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(message, VIEW_W / 2, VIEW_H - 37);
    }
  }

  function drawMinimap(game, cam) {
    const mw = 210;
    const mh = 158;
    const mx = VIEW_W - mw - 14;
    const my = VIEW_H - mh - 14;
    const sx = mw / CONFIG.worldWidth;
    const sy = mh / CONFIG.worldHeight;
    ctx.fillStyle = C.minimapBack;
    rr(ctx, mx - 5, my - 5, mw + 10, mh + 10, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    rr(ctx, mx, my, mw, mh, 4);
    ctx.clip();
    ctx.fillStyle = '#2c4630';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#e8d49a';
    ctx.fillRect(mx + CONFIG.sandStartX * sx, my, mw, mh);
    ctx.fillStyle = '#3f8fbf';
    ctx.fillRect(mx + CONFIG.waterStartX * sx, my, mw, mh);
    ctx.strokeStyle = 'rgba(200,200,210,0.75)';
    ctx.lineWidth = 1.5;
    for (const vx of game.city.vertical) {
      ctx.beginPath();
      ctx.moveTo(mx + vx * sx, my);
      ctx.lineTo(mx + vx * sx, my + mh);
      ctx.stroke();
    }
    for (const hy of game.city.horizontal) {
      ctx.beginPath();
      ctx.moveTo(mx, my + hy * sy);
      ctx.lineTo(mx + mw, my + hy * sy);
      ctx.stroke();
    }
    if (game.mission) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(mx + game.mission.target.x * sx, my + game.mission.target.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!game.mission && game.jobMarker) {
      ctx.fillStyle = '#35d0ff';
      ctx.beginPath();
      ctx.arc(mx + game.jobMarker.x * sx, my + game.jobMarker.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of game.police) {
      ctx.fillStyle = '#ff4040';
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + game.player.x * sx, my + game.player.y * sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // Camera frame on the minimap.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + cam.x * sx, my + cam.y * sy, VIEW_W * sx, VIEW_H * sy);
  }

  function drawOffscreenArrow(game, cam) {
    const mission = game.mission;
    if (!mission) return;
    const tx = mission.target.x;
    const ty = mission.target.y;
    if (tx > cam.x && tx < cam.x + VIEW_W && ty > cam.y && ty < cam.y + VIEW_H) return;
    const cx = Math.max(40, Math.min(VIEW_W - 40, tx - cam.x));
    const cy = Math.max(90, Math.min(VIEW_H - 90, ty - cam.y));
    const angle = Math.atan2(ty - game.player.y, tx - game.player.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTitle(game) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, 'rgba(20, 8, 32, 0.55)');
    g.addColorStop(0.55, 'rgba(20, 8, 32, 0.25)');
    g.addColorStop(1, 'rgba(20, 8, 32, 0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 92px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 24;
    ctx.fillText('SUNSET SHORES', VIEW_W / 2, 210);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('P A L M   B A Y', VIEW_W / 2, 258);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText('Walk the streets. Steal a car. Outrun the law. Get paid.', VIEW_W / 2, 300);

    const lines = [
      'WASD / Arrows — walk or drive',
      'E — steal / leave a car      M — start a job      P — pause',
      'N — mute sound',
    ];
    ctx.font = '17px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 356 + i * 28));

    const pulse = 0.65 + Math.sin(game.time * 3) * 0.35;
    ctx.fillStyle = `rgba(255, 217, 77, ${pulse})`;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Press ENTER to start', VIEW_W / 2, 480);

    if (game.save && (game.save.missionsDone > 0 || game.save.money > 0)) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '15px sans-serif';
      ctx.fillText(
        `Saved: $${Math.floor(game.save.money)} banked · ${game.save.missionsDone} jobs done`,
        VIEW_W / 2, 530,
      );
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 10, 18, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.font = '20px sans-serif';
    ctx.fillText('Press P to keep playing', VIEW_W / 2, VIEW_H / 2 + 34);
  }

  function drawEnd(game, title, color) {
    ctx.fillStyle = 'rgba(10, 10, 18, 0.68)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = color;
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    ctx.fillText(
      `Jobs done: ${game.missionManager.completed}   ·   Money: $${Math.floor(game.player.money)}`,
      VIEW_W / 2, VIEW_H / 2 + 22,
    );
    const pulse = 0.65 + Math.sin(game.time * 3) * 0.35;
    ctx.fillStyle = `rgba(255, 217, 77, ${pulse})`;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Press ENTER to try again', VIEW_W / 2, VIEW_H / 2 + 70);
  }

  function draw(game) {
    const cam = cameraFor(game.player, game.time, game.state);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawGround(cam, game.time);
    drawRoads(game.city, cam);
    drawBuildings(game.city, cam);
    drawTrees(game.city, cam);

    for (const pickup of game.cash) drawCashPickup(pickup, game.time);
    if (!game.mission && game.jobMarker && game.state === 'playing') {
      drawMarker(game.jobMarker.x, game.jobMarker.y, '#35d0ff', game.time, 'JOB');
    }
    if (game.mission) {
      drawMarker(game.mission.target.x, game.mission.target.y, '#ffd700', game.time, null);
      if (game.mission.type === 'cashrun' && game.mission.stage === 'collect') {
        for (const pickup of game.mission.pickups) {
          if (!pickup.taken) drawCashPickup(pickup, game.time);
        }
      }
    }

    for (const car of game.parked) drawCarShape(car, false, game.time);
    for (const car of game.traffic) drawCarShape(car, false, game.time);
    for (const car of game.police) drawCarShape(car, false, game.time);
    if (game.player.inCar) {
      drawCarShape({ ...game.player.inCar, kind: 'player' }, true, game.time);
    } else if (game.state !== 'title') {
      drawPlayerShape(game.player, game.time);
    }
    for (const ped of game.peds) drawPedestrian(ped);

    for (const p of game.particles) {
      ctx.fillStyle = `rgba(255, 220, 120, ${Math.max(0, p.life / p.max)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (game.state === 'title') {
      drawTitle(game);
      return;
    }
    drawHud(game);
    drawMinimap(game, cam);
    drawOffscreenArrow(game, cam);
    if (game.state === 'paused') drawPaused();
    if (game.state === 'busted') drawEnd(game, 'BUSTED', '#ff5a5a');
    if (game.state === 'wasted') drawEnd(game, 'WASTED', '#ff8a3d');
  }

  return { draw };
}
