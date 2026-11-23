// Sunset Shores — every tunable number for Palm Bay lives here.
// One place to balance the game: world shape, speeds, money, police.

export const CONFIG = {
  // The city of Palm Bay.
  worldWidth: 3200,
  worldHeight: 2400,
  seed: 7,

  // Road grid: roads run at these intervals, their centres on the offset.
  roadSpacing: 400,
  roadOffset: 200,
  roadHalfWidth: 40,

  // The beach on the east edge: sand, then water the player cannot enter.
  sandStartX: 2960,
  waterStartX: 3120,

  // The player on foot.
  playerRadius: 13,
  walkSpeed: 175,
  playerHealth: 100,
  startMoney: 250,
  stealDistance: 52,
  carTouchDamage: 12,

  // Driving.
  carAccel: 300,
  carBrake: 520,
  carReverseTop: 130,
  carTopSpeed: 430,
  carTurnRate: 2.9,
  carLength: 34,
  carWidth: 18,

  // Traffic.
  trafficCount: 16,
  trafficSpeedMin: 85,
  trafficSpeedMax: 150,
  parkedCount: 10,

  // Pedestrians.
  pedestrianCount: 22,
  pedestrianSpeedMin: 42,
  pedestrianSpeedMax: 68,
  pedestrianFleeSpeed: 150,

  // Police and the wanted system.
  policeMax: 5,
  policeBaseSpeed: 300,
  policeSpeedPerStar: 26,
  wantedDecayQuietSeconds: 25,
  wantedDecayEverySeconds: 20,
  bustDistance: 30,

  // Cash lying around the world.
  worldCashCount: 8,
  worldCashValue: 30,
  worldCashRespawnSeconds: 45,

  // Missions.
  missionRewardBase: 100,
  missionRewardPerPixel: 0.15,
  missionCashRunBonus: 150,
  missionCashRunPickups: 5,

  // Colours of the sun-soaked city.
  colors: {
    grass: '#7fae5e',
    grassDark: '#74a355',
    sand: '#e8d49a',
    water: '#3f8fbf',
    waterDeep: '#2f6f9e',
    asphalt: '#3d414c',
    asphaltEdge: '#333743',
    roadLine: '#e8d44d',
    sidewalk: '#c2b294',
    buildingRoof: '#8a6f5c',
    tree: '#3f7d3a',
    treeDark: '#356b31',
    hudPanel: 'rgba(12, 12, 20, 0.62)',
    hudText: '#ffffff',
    hudGold: '#ffd94d',
    minimapBack: 'rgba(10, 14, 24, 0.72)',
  },

  // Building paint, picked per building from the seed.
  buildingColors: [
    '#e8b04b', '#d97b4f', '#e07856', '#7fb3a3', '#e8dcc0',
    '#c96f6f', '#8fa8c8', '#d9a05b', '#a8b878', '#c98bb0',
  ],

  // Traffic paint.
  carColors: [
    '#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50',
    '#e67e22', '#16a085', '#8e44ad', '#7f8c8d', '#d35400',
  ],
};
