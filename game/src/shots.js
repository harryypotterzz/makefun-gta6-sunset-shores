// Sunset Shores — staged scenes for screenshots (?shot=...).
// One job only: put the game into a fixed, lively state for each screenshot
// name, using the real rules and the real renderer, then let main.js paint it
// twice and set window.__shotReady. Nothing here is a mock: the cover shows
// the title screen, the others show live play.
import { AVENUES, STREETS } from './city.js';
import { Car, clamp } from './entities.js';

function putPlayerInCar(game, x, y, angle, color) {
  const car = new Car(x, y, angle, 'player', game.rng);
  car.color = color;
  car.speed = 240;
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.cam.x = x;
  game.cam.y = y;
  return car;
}

function scatterTraffic(game, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const vertical = game.rng() < 0.5;
    let x; let y; let angle;
    if (vertical) {
      x = AVENUES[2 + Math.floor(game.rng() * 4)];
      y = cy + (game.rng() - 0.5) * 700;
      angle = game.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = cx + (game.rng() - 0.5) * 800;
      y = STREETS[1 + Math.floor(game.rng() * 3)];
      angle = game.rng() < 0.5 ? 0 : Math.PI;
    }
    const car = new Car(
      clamp(x, 100, 3100), clamp(y, 100, 2300), angle, 'traffic', game.rng,
    );
    car.speed = 130 + game.rng() * 90;
    car.ai = { dir: angle, cruise: car.speed };
    game.traffic.push(car);
  }
}

export function stageShot(game, name) {
  const bar = game.city.landmarks.marasBar;
  if (name === 'start') {
    // Title screen over a living street outside Mara's Bar.
    game.state = 'title';
    game.player.x = bar.x + 60;
    game.player.y = bar.y + 40;
    game.cam.x = game.player.x;
    game.cam.y = game.player.y;
    game.money = 1250;
    game.missions.completed = 3;
    return;
  }

  if (name === 'play') {
    // Cruising down an avenue in a stolen sedan, traffic and pedestrians around.
    game.state = 'playing';
    game.money = 1240;
    game.wanted = 0;
    const x = AVENUES[3];
    const y = STREETS[2];
    putPlayerInCar(game, x, y, 0, '#d23c3c');
    game.player.car.speed = 260;
    scatterTraffic(game, x, y, 6);
    game.missions.say('Press M — Mara has work for you.', 5);
    return;
  }

  if (name === 'chase') {
    // Three stars: Palm Bay PD in pursuit, sirens flashing, player fleeing.
    game.state = 'playing';
    game.money = 860;
    game.wanted = 3;
    const x = AVENUES[4];
    const y = STREETS[3];
    const car = putPlayerInCar(game, x, y, 0, '#2f6fd0');
    car.speed = 420;
    for (let i = 0; i < 3; i++) {
      const pc = new Car(
        x - 260 - i * 130, y + (i - 1) * 70,
        0, 'police', game.rng,
      );
      pc.speed = 380 + i * 20;
      pc.sirenPhase = i * 2.1;
      game.police.push(pc);
    }
    scatterTraffic(game, x, y, 4);
    game.missions.say('Lose the cops!', 5);
    return;
  }

  if (name === 'mission') {
    // A delivery job in progress: Mara's package, the drop-off beacon and the
    // dashed route line, one star of heat trailing the player.
    game.state = 'playing';
    game.money = 1480;
    game.wanted = 1;
    const x = AVENUES[2];
    const y = STREETS[2];
    const car = putPlayerInCar(game, x, y, Math.PI / 2, '#e8c33c');
    car.speed = 300;
    const drop = game.city.landmarks.diner;
    game.missions.current = {
      type: 'delivery',
      title: 'Hot Delivery',
      blurb: 'Drive the package to the drop-off before the timer runs out.',
      target: { x: drop.x, y: drop.y },
      targetLabel: 'Sunset Diner',
      timeLeft: 58,
      progress: 0,
      goal: 1,
      reward: 240,
      phase: 'drive',
    };
    const pc = new Car(x - 320, y + 90, 0, 'police', game.rng);
    pc.speed = 330;
    game.police.push(pc);
    scatterTraffic(game, x, y, 4);
    return;
  }

  // Unknown shot name: fall back to the title screen.
  game.state = 'title';
}
