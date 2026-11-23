// Sunset Shores — every tunable number in one place.
// One job only: hold the constants the rest of the game balances on, so
// tuning never means digging through the logic files.

// World size (pixels). Palm Bay is a 3200 x 2400 coastal city.
export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Road grid.
export const ROAD_W = 96;     // width of every avenue and street
export const BLOCK = 400;     // distance between road centre lines
export const ROAD_COLOR = '#3a3f4a';
export const ROAD_EDGE = '#2c3038';
export const SIDEWALK_COLOR = '#b9b3a4';
export const GROUND_COLOR = '#7fae62';  // grass
export const SAND_COLOR = '#e8d39a';    // beach
export const WATER_COLOR = '#2f7fb8';   // sea

// The player on foot.
export const WALK_SPEED = 230;
export const PLAYER_RADIUS = 14;
export const PLAYER_MAX_HEALTH = 100;

// Cars.
export const CAR_LENGTH = 52;
export const CAR_WIDTH = 26;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 700;
export const CAR_MAX_SPEED = 560;
export const CAR_MAX_REVERSE = 180;
export const CAR_TURN = 2.6;  // radians per second at full lock

// Wanted level and police.
export const MAX_WANTED = 5;
export const WANTED_DECAY_SECONDS = 45; // clean seconds before a star drops
export const BUST_FINE = 150;           // money lost when busted

// Money.
export const START_MONEY = 250;
export const CASH_PICKUP_VALUE = 25;

// Mission types, in rotation order.
export const MISSION_TYPES = ['delivery', 'getaway', 'collect'];

// View size (the canvas is 1280 x 720).
export const VIEW_W = 1280;
export const VIEW_H = 720;

// Flat-colour palettes. All art is original and drawn in code.
export const BUILDING_COLORS = [
  '#d98a6a', '#e0b25f', '#8fa8c8', '#b7c4a8', '#c98ba0',
  '#9a8fc0', '#7fb8a4', '#d9c08a', '#a8a0a0', '#e08a5f',
];
export const CAR_COLORS = [
  '#d23c3c', '#2f6fd0', '#e8c33c', '#3ca66a', '#8a5fd0',
  '#e8e8e8', '#222831', '#e07b2f', '#3fb8b0', '#c94f7c',
];
export const PED_SHIRT_COLORS = [
  '#e05a5a', '#4a7fd0', '#e8b23c', '#4aa86a', '#9a6fd0',
  '#e8e8e8', '#333a44', '#e08a3c', '#4ab8b0', '#d06a9c',
];
