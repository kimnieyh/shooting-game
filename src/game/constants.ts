export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

export const PLAYER = {
  speed: 340,
  fireInterval: 0.22,
  bulletSpeed: 560,
  maxLives: 3,
  invulnDuration: 1.2,
  size: 24,
};

export const ENEMY_TYPES = {
  ufo: { sprite: "enemy_ufo", hp: 1, score: 10, speed: [90, 130], size: 20 },
  bug: { sprite: "enemy_bug", hp: 1, score: 15, speed: [110, 160], size: 20 },
  robot: { sprite: "enemy_robot", hp: 3, score: 50, speed: [60, 90], size: 24 },
} as const;

export type EnemyKind = keyof typeof ENEMY_TYPES;

export const ENEMY_BULLET_SPEED = 260;

export const STORAGE_BEST_SCORE_KEY = "stella-shooter-best-score";

export const ITEM_DROP_CHANCE = 0.22;
export const ITEM_FALL_SPEED = 70;
export const ITEM_MAGNET_RADIUS = 140;
export const ITEM_MAGNET_PULL_SPEED = 320;

export const ITEM_TYPES = {
  heart: { sprite: "heart", weight: 30, kind: "instant", color: [255, 77, 109] },
  rapidFire: {
    sprite: "item_rapid",
    weight: 25,
    kind: "buff",
    duration: 8,
    fireIntervalMult: 0.55,
    color: [255, 232, 115],
  },
  spread: {
    sprite: "item_spread",
    weight: 20,
    kind: "buff",
    duration: 10,
    color: [79, 214, 255],
  },
  shield: {
    sprite: "item_shield",
    weight: 15,
    kind: "buff",
    duration: 4,
    color: [127, 209, 255],
  },
  magnet: {
    sprite: "item_magnet",
    weight: 10,
    kind: "buff",
    duration: 12,
    color: [255, 93, 93],
  },
} as const;

export type ItemKind = keyof typeof ITEM_TYPES;
