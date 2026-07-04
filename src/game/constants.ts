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
