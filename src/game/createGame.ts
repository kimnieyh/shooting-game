import kaplay from "kaplay";
import type { GameObj, KAPLAYCtx } from "kaplay";
import {
  ENEMY_BULLET_SPEED,
  ENEMY_TYPES,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER,
  STORAGE_BEST_SCORE_KEY,
  type EnemyKind,
} from "./constants";

function loadBestScore(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(STORAGE_BEST_SCORE_KEY) ?? 0);
}

function saveBestScore(score: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_BEST_SCORE_KEY, String(score));
}

function addStarfield(k: KAPLAYCtx) {
  for (let i = 0; i < 70; i++) {
    const depth = k.rand(0.5, 2.2);
    k.add([
      k.sprite("star"),
      k.pos(k.rand(0, GAME_WIDTH), k.rand(0, GAME_HEIGHT)),
      k.scale(depth),
      k.opacity(k.rand(0.35, 1)),
      k.z(-100),
      "star",
      { speed: depth * 45 },
    ]).onUpdate(function (this: GameObj) {
      this.pos.y += this.speed * k.dt();
      if (this.pos.y > GAME_HEIGHT + 4) {
        this.pos.y = -4;
        this.pos.x = k.rand(0, GAME_WIDTH);
      }
    });
  }
}

function spawnBurst(k: KAPLAYCtx, x: number, y: number, count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + k.rand(-0.3, 0.3);
    const speed = k.rand(60, 160);
    k.add([
      k.sprite("spark"),
      k.pos(x, y),
      k.anchor("center"),
      k.scale(k.rand(1, 1.8)),
      k.opacity(1),
      k.rotate(k.rand(0, 360)),
      k.lifespan(0.35, { fade: 0.25 }),
      k.z(50),
      { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed },
    ]).onUpdate(function (this: GameObj) {
      this.pos.x += this.vx * k.dt();
      this.pos.y += this.vy * k.dt();
    });
  }
}

export function createGame(canvas: HTMLCanvasElement): () => void {
  const k = kaplay({
    canvas,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    stretch: true,
    letterbox: true,
    crisp: true,
    background: "12082b",
    touchToMouse: true,
    debug: false,
    loadingScreen: false,
    font: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
  });

  k.loadSprite("ship", "/sprites/ship.png");
  k.loadSprite("enemy_ufo", "/sprites/enemy_ufo.png");
  k.loadSprite("enemy_bug", "/sprites/enemy_bug.png");
  k.loadSprite("enemy_robot", "/sprites/enemy_robot.png");
  k.loadSprite("bullet_player", "/sprites/bullet_player.png");
  k.loadSprite("bullet_enemy", "/sprites/bullet_enemy.png");
  k.loadSprite("heart", "/sprites/heart.png");
  k.loadSprite("spark", "/sprites/spark.png");
  k.loadSprite("star", "/sprites/star.png");

  // ---------------- Start scene ----------------
  k.scene("start", () => {
    addStarfield(k);
    const best = loadBestScore();

    k.add([
      k.sprite("ship"),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 160),
      k.anchor("center"),
      k.scale(2.6),
    ]);

    k.add([
      k.text("스텔라 슈터", { size: 40 }),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);

    k.add([
      k.text("귀여운 도트 세로 슈팅게임", { size: 16 }),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 2),
      k.anchor("center"),
      k.color(180, 200, 255),
    ]);

    k.add([
      k.text("화면을 드래그해서 이동\n(PC는 방향키/WASD)\n조준은 자동, 공격도 자동!", {
        size: 14,
        align: "center",
      }),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60),
      k.anchor("center"),
      k.color(160, 170, 200),
    ]);

    if (best > 0) {
      k.add([
        k.text(`최고 점수 ${best}`, { size: 14 }),
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130),
        k.anchor("center"),
        k.color(255, 220, 120),
      ]);
    }

    const prompt = k.add([
      k.text("탭하여 시작", { size: 20 }),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT - 120),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.opacity(1),
    ]);
    prompt.onUpdate(() => {
      prompt.opacity = 0.55 + Math.sin(k.time() * 4) * 0.45;
    });

    k.onMousePress(() => k.go("game"));
    k.onKeyPress(["space", "enter"], () => k.go("game"));
  });

  // ---------------- Game scene ----------------
  k.scene("game", () => {
    addStarfield(k);

    let score = 0;
    let lives = PLAYER.maxLives;
    let invulnTimer = 0;
    let elapsed = 0;
    let spawnTimer = 0;
    let fireTimer = 0;
    let dragging = false;

    const player = k.add([
      k.sprite("ship"),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT - 110),
      k.anchor("center"),
      k.scale(2),
      k.area(),
      k.opacity(1),
      k.z(10),
      "player",
    ]);

    const scoreLabel = k.add([
      k.text("0", { size: 20 }),
      k.pos(GAME_WIDTH - 16, 16),
      k.anchor("topright"),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(100),
    ]);

    const hearts: GameObj[] = [];
    function renderHearts() {
      hearts.forEach((h) => k.destroy(h));
      hearts.length = 0;
      for (let i = 0; i < lives; i++) {
        hearts.push(
          k.add([
            k.sprite("heart"),
            k.pos(16 + i * 26, 16),
            k.anchor("topleft"),
            k.scale(1.4),
            k.fixed(),
            k.z(100),
          ])
        );
      }
    }
    renderHearts();

    function clampToStage(obj: GameObj, margin: number) {
      obj.pos.x = k.clamp(obj.pos.x, margin, GAME_WIDTH - margin);
      obj.pos.y = k.clamp(obj.pos.y, margin, GAME_HEIGHT - margin);
    }

    // ---- input: drag to move ----
    k.onMousePress(() => {
      dragging = true;
    });
    k.onMouseRelease(() => {
      dragging = false;
    });
    k.onMouseMove((pos) => {
      if (!dragging) return;
      player.pos.x = pos.x;
      player.pos.y = pos.y - 40;
      clampToStage(player, PLAYER.size);
    });

    function endGame() {
      saveBestScore(Math.max(score, loadBestScore()));
      k.go("gameover", score);
    }

    function damagePlayer() {
      if (invulnTimer > 0) return;
      lives -= 1;
      invulnTimer = PLAYER.invulnDuration;
      k.shake(6);
      spawnBurst(k, player.pos.x, player.pos.y, 10);
      renderHearts();
      if (lives <= 0) {
        k.destroy(player);
        k.wait(0.4, endGame);
      }
    }

    function spawnPlayerBullet() {
      k.add([
        k.sprite("bullet_player"),
        k.pos(player.pos.x, player.pos.y - 26),
        k.anchor("center"),
        k.scale(2),
        k.area(),
        k.move(k.vec2(0, -1), PLAYER.bulletSpeed),
        k.offscreen({ destroy: true }),
        k.z(5),
        "playerBullet",
      ]);
    }

    function spawnEnemyBullet(x: number, y: number, dirX: number, dirY: number) {
      k.add([
        k.sprite("bullet_enemy"),
        k.pos(x, y),
        k.anchor("center"),
        k.scale(2),
        k.area(),
        k.rotate((Math.atan2(dirY, dirX) * 180) / Math.PI + 90),
        k.move(k.vec2(dirX, dirY), ENEMY_BULLET_SPEED),
        k.offscreen({ destroy: true }),
        k.z(5),
        "enemyBullet",
      ]);
    }

    function spawnEnemy() {
      const roll = Math.random();
      const kind: EnemyKind = roll < 0.45 ? "ufo" : roll < 0.85 ? "bug" : "robot";
      const cfg = ENEMY_TYPES[kind];
      const speed = k.rand(cfg.speed[0], cfg.speed[1]) + Math.min(elapsed * 1.5, 90);
      const x = k.rand(cfg.size + 10, GAME_WIDTH - cfg.size - 10);

      const enemy = k.add([
        k.sprite(cfg.sprite),
        k.pos(x, -30),
        k.anchor("center"),
        k.scale(1.9),
        k.area(),
        k.health(cfg.hp),
        k.z(8),
        "enemy",
        {
          baseX: x,
          wobble: k.rand(0, Math.PI * 2),
          fallSpeed: speed,
          shootTimer: k.rand(1.4, 2.6),
          kind,
          scoreValue: cfg.score,
        },
      ]);

      enemy.onUpdate(() => {
        enemy.pos.y += enemy.fallSpeed * k.dt();
        enemy.wobble += k.dt() * 2;
        enemy.pos.x = enemy.baseX + Math.sin(enemy.wobble) * 26;

        if (enemy.pos.y > GAME_HEIGHT + 40) {
          k.destroy(enemy);
          return;
        }

        if (enemy.pos.y > 20 && enemy.pos.y < GAME_HEIGHT - 60) {
          enemy.shootTimer -= k.dt();
          if (enemy.shootTimer <= 0) {
            enemy.shootTimer = k.rand(1.8, 3.2);
            const dx = player.exists() ? player.pos.x - enemy.pos.x : 0;
            const dy = player.exists() ? player.pos.y - enemy.pos.y : 1;
            const len = Math.hypot(dx, dy) || 1;
            spawnEnemyBullet(enemy.pos.x, enemy.pos.y, dx / len, dy / len);
          }
        }
      });

      enemy.onDeath(() => {
        score += enemy.scoreValue;
        scoreLabel.text = String(score);
        spawnBurst(k, enemy.pos.x, enemy.pos.y, 8);
        k.destroy(enemy);
      });
    }

    k.onCollide("playerBullet", "enemy", (bullet, enemy) => {
      k.destroy(bullet);
      enemy.hurt(1);
      if (enemy.hp() > 0) spawnBurst(k, enemy.pos.x, enemy.pos.y, 3);
    });

    k.onCollide("enemyBullet", "player", (bullet) => {
      k.destroy(bullet);
      damagePlayer();
    });

    k.onCollide("enemy", "player", (enemy) => {
      k.destroy(enemy);
      damagePlayer();
    });

    k.onUpdate(() => {
      elapsed += k.dt();

      if (invulnTimer > 0) {
        invulnTimer -= k.dt();
        player.opacity = Math.sin(k.time() * 20) > 0 ? 1 : 0.2;
      } else {
        player.opacity = 1;
      }

      // keyboard movement
      let vx = 0;
      let vy = 0;
      if (k.isKeyDown("left") || k.isKeyDown("a")) vx -= 1;
      if (k.isKeyDown("right") || k.isKeyDown("d")) vx += 1;
      if (k.isKeyDown("up") || k.isKeyDown("w")) vy -= 1;
      if (k.isKeyDown("down") || k.isKeyDown("s")) vy += 1;
      if (vx !== 0 || vy !== 0) {
        dragging = false;
        const len = Math.hypot(vx, vy) || 1;
        player.pos.x += (vx / len) * PLAYER.speed * k.dt();
        player.pos.y += (vy / len) * PLAYER.speed * k.dt();
      }
      clampToStage(player, PLAYER.size);

      // auto fire
      fireTimer -= k.dt();
      if (fireTimer <= 0 && player.exists()) {
        fireTimer = PLAYER.fireInterval;
        spawnPlayerBullet();
      }

      // enemy spawning, ramps up over time
      spawnTimer -= k.dt();
      if (spawnTimer <= 0) {
        const interval = Math.max(1.5 - elapsed * 0.01, 0.5);
        spawnTimer = interval;
        spawnEnemy();
      }
    });
  });

  // ---------------- Game over scene ----------------
  k.scene("gameover", (score: number) => {
    addStarfield(k);
    const best = loadBestScore();

    k.add([
      k.text("게임 오버", { size: 36 }),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80),
      k.anchor("center"),
      k.color(255, 120, 140),
    ]);

    k.add([
      k.text(`점수 ${score}`, { size: 22 }),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);

    k.add([
      k.text(`최고 점수 ${best}`, { size: 16 }),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16),
      k.anchor("center"),
      k.color(255, 220, 120),
    ]);

    const prompt = k.add([
      k.text("탭하여 다시 시작", { size: 18 }),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90),
      k.anchor("center"),
      k.color(200, 210, 255),
      k.opacity(1),
    ]);
    prompt.onUpdate(() => {
      prompt.opacity = 0.55 + Math.sin(k.time() * 4) * 0.45;
    });

    k.onMousePress(() => k.go("game"));
    k.onKeyPress(["space", "enter"], () => k.go("game"));
  });

  k.go("start");

  return () => {
    k.quit();
  };
}
