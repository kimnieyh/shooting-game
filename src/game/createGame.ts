import kaplay from "kaplay";
import type { GameObj, KAPLAYCtx } from "kaplay";
import {
  BOSS_CONFIG,
  BOSS_TYPES,
  ENEMY_BULLET_SPEED,
  ENEMY_TYPES,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_DROP_CHANCE,
  ITEM_FALL_SPEED,
  ITEM_MAGNET_PULL_SPEED,
  ITEM_MAGNET_RADIUS,
  ITEM_TYPES,
  PLAYER,
  STORAGE_BEST_SCORE_KEY,
  type EnemyKind,
  type ItemKind,
} from "./constants";

type BuffKind = Exclude<ItemKind, "heart">;
const BUFF_ORDER: BuffKind[] = ["rapidFire", "spread", "shield", "magnet"];

// Audio state management (persists across scene changes)
const AUDIO_MUTE_KEY = "stella_shooter_muted";
let isMuted = false;

function loadMuteState(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUDIO_MUTE_KEY) === "true";
}

function saveMuteState(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIO_MUTE_KEY, String(muted));
}

function pickItemKind(): ItemKind {
  const entries = Object.entries(ITEM_TYPES) as [ItemKind, (typeof ITEM_TYPES)[ItemKind]][];
  const total = entries.reduce((sum, [, cfg]) => sum + cfg.weight, 0);
  let roll = Math.random() * total;
  for (const [kind, cfg] of entries) {
    roll -= cfg.weight;
    if (roll <= 0) return kind;
  }
  return entries[entries.length - 1][0];
}

function pickBossBonusItemKind(): ItemKind {
  const weighted: [ItemKind, number][] = [
    ["heart", 40],
    ["shield", 40],
    ["rapidFire", 20],
  ];
  let roll = Math.random() * 100;
  for (const [kind, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return "rapidFire";
}

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

function spawnPopupText(
  k: KAPLAYCtx,
  x: number,
  y: number,
  text: string,
  color: readonly [number, number, number]
) {
  const popup = k.add([
    k.text(text, { size: 16 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(...color),
    k.opacity(1),
    k.z(90),
    k.lifespan(0.8, { fade: 0.3 }),
  ]);
  popup.onUpdate(() => {
    popup.pos.y -= 34 * k.dt();
  });
}

function spawnRing(
  k: KAPLAYCtx,
  x: number,
  y: number,
  color: readonly [number, number, number],
  startRadius: number,
  growSpeed: number
) {
  const ring = k.add([
    k.circle(startRadius),
    k.pos(x, y),
    k.anchor("center"),
    k.opacity(0.6),
    k.color(...color),
    k.outline(2, k.rgb(255, 255, 255)),
    k.z(9),
  ]);
  ring.onUpdate(function (this: GameObj) {
    this.radius += growSpeed * k.dt();
    this.opacity -= k.dt() * 1.1;
    if (this.opacity <= 0) k.destroy(this);
  });
}

function spawnBurst(k: KAPLAYCtx, x: number, y: number, count = 6, scaleMul = 1) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + k.rand(-0.3, 0.3);
    const speed = k.rand(60, 160);
    k.add([
      k.sprite("spark"),
      k.pos(x, y),
      k.anchor("center"),
      k.scale(k.rand(1, 1.8) * scaleMul),
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
  k.loadSprite("item_rapid", "/sprites/item_rapid.png");
  k.loadSprite("item_spread", "/sprites/item_spread.png");
  k.loadSprite("item_shield", "/sprites/item_shield.png");
  k.loadSprite("item_magnet", "/sprites/item_magnet.png");
  k.loadSprite("boss_doljun", "/sprites/boss_doljun.png");
  k.loadSprite("bomb_gimbap", "/sprites/bomb_gimbap.png");

  // Load sounds
  k.loadSound("ui_select", "/sounds/ui_select.wav");
  k.loadSound("player_shoot", "/sounds/player_shoot.wav");
  k.loadSound("enemy_shoot", "/sounds/enemy_shoot.wav");
  k.loadSound("hit", "/sounds/hit.wav");
  k.loadSound("explosion", "/sounds/explosion.wav");
  k.loadSound("player_damage", "/sounds/player_damage.wav");
  k.loadSound("shield_block", "/sounds/shield_block.wav");
  k.loadSound("item_pickup", "/sounds/item_pickup.wav");
  k.loadSound("game_over", "/sounds/game_over.wav");
  k.loadSound("boss_throw", "/sounds/boss_throw.wav");
  k.loadMusic("bgm_title", "/sounds/bgm_title.wav");
  k.loadMusic("bgm_game", "/sounds/bgm_game.wav");

  let currentBGM: ReturnType<typeof k.play> | null = null;

  // Load initial mute state
  isMuted = loadMuteState();
  // Apply initial global volume based on mute state
  k.setVolume(isMuted ? 0 : 1);

  // Smoothly ramp master volume instead of snapping it, so toggling mute
  // while BGM/SFX are mid-waveform doesn't produce an audible click/pop.
  let volumeTween: ReturnType<typeof k.tween> | null = null;
  function applyMasterVolume(target: number) {
    volumeTween?.cancel();
    const from = k.getVolume();
    volumeTween = k.tween(from, target, 0.12, (v) => k.setVolume(v), k.easings.linear);
  }

  // Helper function to calculate effective volume
  function getEffectiveVolume(baseVolume: number): number {
    return isMuted ? 0 : baseVolume;
  }

  // Helper function to play sound with master volume
  function playSound(soundName: string, options?: { volume?: number; loop?: boolean; detune?: number }) {
    return k.play(soundName, {
      ...options,
      volume: getEffectiveVolume(options?.volume ?? 0.7),
    });
  }

  // Mute toggle button (placed in bottom-right corner)
  let muteButton: GameObj | null = null;

  function createMuteButton(k: KAPLAYCtx) {
    if (muteButton) k.destroy(muteButton);

    const muteIcon = isMuted ? "🔇" : "🔊";
    muteButton = k.add([
      k.text(muteIcon, { size: 24 }),
      k.pos(GAME_WIDTH - 32, GAME_HEIGHT - 40),
      k.anchor("center"),
      k.fixed(),
      k.z(100),
      k.area(),
    ]);

    muteButton.onClick(() => {
      isMuted = !isMuted;
      saveMuteState(isMuted);
      // Ramp (not snap) the volume so it also affects already-playing BGM
      // without producing a click/pop artifact.
      applyMasterVolume(isMuted ? 0 : 1);
      createMuteButton(k);
    });

    muteButton.onHover(() => {
      muteButton!.scale = 1.15;
    });

    muteButton.onHoverEnd(() => {
      muteButton!.scale = 1;
    });
  }

  // ---------------- Start scene ----------------
  k.scene("start", () => {
    // Stop any existing BGM and play title BGM
    if (currentBGM) {
      currentBGM.stop();
    }
    currentBGM = playSound("bgm_title", { loop: true, volume: 0.6 });

    addStarfield(k);
    const best = loadBestScore();

    createMuteButton(k);

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

    k.onMousePress(() => {
      if (muteButton?.isHovering()) return;
      playSound("ui_select", { volume: 0.7 });
      k.go("game");
    });
    k.onKeyPress(["space", "enter"], () => {
      playSound("ui_select", { volume: 0.7 });
      k.go("game");
    });
  });

  // ---------------- Game scene ----------------
  k.scene("game", () => {
    // Stop title BGM and play game BGM
    if (currentBGM) {
      currentBGM.stop();
    }
    currentBGM = playSound("bgm_game", { loop: true, volume: 0.5 });

    addStarfield(k);
    createMuteButton(k);

    let score = 0;
    let lives = PLAYER.maxLives;
    let invulnTimer = 0;
    let elapsed = 0;
    let spawnTimer = 0;
    let fireTimer = 0;
    let dragging = false;

    // ---- boss state ----
    let bossEncounterCount = 0; // N, starts at 1 on first encounter
    let nextBossThreshold = BOSS_CONFIG.firstAppearScore;
    let activeBoss: GameObj | null = null;
    let bossPhase: 1 | 2 | null = null;
    let bossPhaseTransitioning = false;
    let bossDefeatTriggered = false;
    let bossInvuln = false;
    let bossMaxHp = 0;
    let bossMoveDir = 1;
    let bossThrowTimer = 0;
    let bossEscortTimer = 0;
    let bossBombsInFlight = 0;
    let bossBlinkTime = 0;
    let bossHpBarBg: GameObj | null = null;
    let bossHpBarFill: GameObj | null = null;
    let bossNameLabel: GameObj | null = null;

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

    const buffs: Record<ItemKind, number> = {
      heart: 0,
      rapidFire: 0,
      spread: 0,
      shield: 0,
      magnet: 0,
    };

    const buffUI = BUFF_ORDER.map((kind, i) => {
      const cfg = ITEM_TYPES[kind];
      const x = 16 + i * 30;
      const y = 46;
      const icon = k.add([
        k.sprite(cfg.sprite),
        k.pos(x, y),
        k.anchor("topleft"),
        k.scale(1.2),
        k.opacity(0.25),
        k.fixed(),
        k.z(100),
      ]);
      const bar = k.add([
        k.rect(24, 3),
        k.pos(x, y + 22),
        k.anchor("topleft"),
        k.color(cfg.color[0], cfg.color[1], cfg.color[2]),
        k.opacity(0.25),
        k.fixed(),
        k.z(100),
      ]);
      return { kind, icon, bar };
    });

    function updateBuffUI() {
      for (const { kind, icon, bar } of buffUI) {
        const cfg = ITEM_TYPES[kind];
        const remain = buffs[kind];
        const active = remain > 0;
        icon.opacity = active ? 1 : 0.25;
        bar.opacity = active ? 1 : 0.25;
        bar.width = active ? Math.max(2, 24 * (remain / cfg.duration)) : 24;
      }
    }

    let shieldAura: GameObj | null = null;
    let magnetPulseTimer = 0;

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
      playSound("game_over", { volume: 0.7 });
      if (currentBGM) {
        currentBGM.stop();
      }
      saveBestScore(Math.max(score, loadBestScore()));
      k.go("gameover", score);
    }

    function damagePlayer() {
      if (invulnTimer > 0) return;
      if (buffs.shield > 0) {
        playSound("shield_block", { volume: 0.7 });
        k.shake(3);
        spawnRing(k, player.pos.x, player.pos.y, ITEM_TYPES.shield.color, 20, 260);
        return;
      }
      playSound("player_damage", { volume: 0.7 });
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

    function spawnPlayerBulletAt(angleOffsetDeg: number) {
      const rad = (angleOffsetDeg * Math.PI) / 180;
      const dir = k.vec2(Math.sin(rad), -Math.cos(rad));
      k.add([
        k.sprite("bullet_player"),
        k.pos(player.pos.x, player.pos.y - 26),
        k.anchor("center"),
        k.scale(2),
        k.area(),
        k.rotate(angleOffsetDeg),
        k.move(dir, PLAYER.bulletSpeed),
        k.offscreen({ destroy: true }),
        k.z(5),
        "playerBullet",
      ]);
    }

    function spawnPlayerBullet() {
      // Add pitch randomization to prevent monotony during rapid fire
      const detuneAmount = k.rand(-120, 120); // ±120 cents = ±1.2 semitones
      playSound("player_shoot", { volume: 0.5, detune: detuneAmount });
      spawnPlayerBulletAt(0);
      if (buffs.spread > 0) {
        spawnPlayerBulletAt(-18);
        spawnPlayerBulletAt(18);
      }
      if (buffs.rapidFire > 0) {
        spawnBurst(k, player.pos.x, player.pos.y - 26, 3);
      }
    }

    function spawnEnemyBullet(x: number, y: number, dirX: number, dirY: number) {
      // Add pitch randomization to enemy shots as well
      const detuneAmount = k.rand(-100, 100);
      playSound("enemy_shoot", { volume: 0.5, detune: detuneAmount });
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

    function applyItem(kind: ItemKind) {
      playSound("item_pickup", { volume: 0.7 });
      if (kind === "heart") {
        const cfg = ITEM_TYPES.heart;
        if (lives < PLAYER.maxLives) {
          lives += 1;
          renderHearts();
          spawnPopupText(k, player.pos.x, player.pos.y - 30, "+1 LIFE", cfg.color);
        } else {
          score += 50;
          scoreLabel.text = String(score);
          spawnPopupText(k, player.pos.x, player.pos.y - 30, "+50", cfg.color);
        }
        spawnBurst(k, player.pos.x, player.pos.y, 8);
        return;
      }

      const cfg = ITEM_TYPES[kind];
      buffs[kind] = cfg.duration;
      const labels: Record<BuffKind, string> = {
        rapidFire: "연사 UP!",
        spread: "3-WAY!",
        shield: "무적!",
        magnet: "자석!",
      };
      spawnPopupText(k, player.pos.x, player.pos.y - 30, labels[kind], cfg.color);
      spawnRing(k, player.pos.x, player.pos.y, cfg.color, 16, 220);
    }

    function createItemDrop(x: number, y: number, kind: ItemKind) {
      const cfg = ITEM_TYPES[kind];
      k.add([
        k.sprite(cfg.sprite),
        k.pos(x, y),
        k.anchor("center"),
        k.scale(1.6),
        k.area(),
        k.opacity(1),
        k.z(7),
        "item",
        { kind, vy: ITEM_FALL_SPEED },
      ]).onUpdate(function (this: GameObj) {
        if (buffs.magnet > 0 && player.exists()) {
          const dx = player.pos.x - this.pos.x;
          const dy = player.pos.y - this.pos.y;
          const dist = Math.hypot(dx, dy);
          if (dist < ITEM_MAGNET_RADIUS) {
            this.pos.x += (dx / (dist || 1)) * ITEM_MAGNET_PULL_SPEED * k.dt();
            this.pos.y += (dy / (dist || 1)) * ITEM_MAGNET_PULL_SPEED * k.dt();
            if (this.pos.y > GAME_HEIGHT + 40) k.destroy(this);
            return;
          }
        }
        this.pos.y += this.vy * k.dt();
        if (this.pos.y > GAME_HEIGHT + 40) k.destroy(this);
      });
    }

    function spawnItemDrop(x: number, y: number, chance: number = ITEM_DROP_CHANCE) {
      if (Math.random() >= chance) return;
      createItemDrop(x, y, pickItemKind());
    }

    function spawnEnemy(opts?: { kind?: EnemyKind; x?: number; tag?: string }) {
      const roll = Math.random();
      const kind: EnemyKind =
        opts?.kind ?? (roll < 0.45 ? "ufo" : roll < 0.85 ? "bug" : "robot");
      const cfg = ENEMY_TYPES[kind];
      const speed = k.rand(cfg.speed[0], cfg.speed[1]) + Math.min(elapsed * 1.5, 90);
      const x = opts?.x ?? k.rand(cfg.size + 10, GAME_WIDTH - cfg.size - 10);
      const extraTags = opts?.tag ? [opts.tag] : [];

      const enemy = k.add([
        k.sprite(cfg.sprite),
        k.pos(x, -30),
        k.anchor("center"),
        k.scale(1.9),
        k.area(),
        k.health(cfg.hp),
        k.z(8),
        "enemy",
        ...extraTags,
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
        playSound("explosion", { volume: 0.65 });
        score += enemy.scoreValue;
        scoreLabel.text = String(score);
        spawnBurst(k, enemy.pos.x, enemy.pos.y, 8);
        // boss escorts drop items at a boosted rate, scoped to this encounter only
        spawnItemDrop(enemy.pos.x, enemy.pos.y, enemy.is("bossEscort") ? 0.35 : ITEM_DROP_CHANCE);
        k.destroy(enemy);
      });
    }

    // ---- boss: "김돌준" (Kim Doljun) ----
    function bossHpMul(n: number) {
      return (
        1 +
        BOSS_CONFIG.hpScalePerEncounter * (Math.min(n, BOSS_CONFIG.hpScaleCapEncounter) - 1)
      );
    }
    function bossSpeedMul(n: number) {
      return (
        1 +
        BOSS_CONFIG.moveSpeedScalePerEncounter *
          (Math.min(n, BOSS_CONFIG.hpScaleCapEncounter) - 1)
      );
    }
    function bossCooldownMul(n: number) {
      return (
        1 -
        BOSS_CONFIG.bombCooldownScalePerEncounter *
          (Math.min(n, BOSS_CONFIG.hpScaleCapEncounter) - 1)
      );
    }
    function bossScoreValue(n: number) {
      return (
        BOSS_TYPES.kimDoljun.baseScoreValue +
        BOSS_CONFIG.scoreValueFlatBonusPerEncounter * (n - 1)
      );
    }

    function showBossDialogue(text: string, duration: number, onDone: () => void) {
      const box = k.add([
        k.rect(GAME_WIDTH - 40, 74, { radius: 6 }),
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 150),
        k.anchor("center"),
        k.color(20, 14, 40),
        k.opacity(0.85),
        k.outline(2, k.rgb(255, 255, 255)),
        k.fixed(),
        k.z(96),
      ]);
      const label = k.add([
        k.text(text, { size: 13, align: "center", width: GAME_WIDTH - 64 }),
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 150),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.fixed(),
        k.z(97),
      ]);
      k.wait(duration, () => {
        k.destroy(box);
        k.destroy(label);
        onDone();
      });
    }

    function spawnBossTelegraphRing(x: number, y: number, duration: number) {
      const startR = 10;
      const endR = 50;
      const ring = k.add([
        k.circle(startR),
        k.pos(x, y),
        k.anchor("center"),
        k.opacity(0.65),
        k.color(255, 90, 40),
        k.outline(2, k.rgb(255, 200, 120)),
        k.z(9),
        { elapsedT: 0 },
      ]);
      ring.onUpdate(function (this: GameObj) {
        this.elapsedT += k.dt();
        const p = Math.min(this.elapsedT / duration, 1);
        this.radius = startR + (endR - startR) * p;
        this.opacity = 0.65 * (1 - p * 0.7);
        if (p >= 1) k.destroy(this);
      });
    }

    // lobs a lunchbox bomb from (fromX, fromY) to a locked-on (targetX, targetY);
    // shows a growing telegraph ring at the landing spot for the whole flight time
    function bossThrowBombAt(fromX: number, fromY: number, targetX: number, targetY: number) {
      const duration = 1.1;
      const aoeRadius = 50;
      bossBombsInFlight += 1;
      playSound("boss_throw", { volume: 0.65 });
      spawnBossTelegraphRing(targetX, targetY, duration);

      const bomb = k.add([
        k.sprite("bomb_gimbap"),
        k.pos(fromX, fromY),
        k.anchor("center"),
        k.scale(2.2),
        k.rotate(0),
        k.z(9),
        { elapsedT: 0 },
      ]);
      bomb.onUpdate(function (this: GameObj) {
        this.elapsedT += k.dt();
        const p = Math.min(this.elapsedT / duration, 1);
        const arcHeight = 90;
        this.pos.x = k.lerp(fromX, targetX, p);
        this.pos.y = k.lerp(fromY, targetY, p) - Math.sin(p * Math.PI) * arcHeight;
        this.angle += 340 * k.dt();
      });

      k.wait(duration, () => {
        k.destroy(bomb);
        bossBombsInFlight = Math.max(0, bossBombsInFlight - 1);
        spawnBurst(k, targetX, targetY, 12);
        k.shake(2);
        if (player.exists()) {
          const dist = Math.hypot(player.pos.x - targetX, player.pos.y - targetY);
          if (dist <= aoeRadius) damagePlayer();
        }
      });
    }

    // phase 2 only: spawns 1 ufo + 1 bug escort pair from the top corners,
    // skipping the whole tick if it would exceed the concurrent escort cap
    function trySpawnBossEscorts(n: number) {
      const cap = n >= 3 ? 4 : 3;
      const alive = k.get("bossEscort").length;
      if (alive + 2 > cap) return;
      spawnEnemy({ kind: "ufo", x: 50, tag: "bossEscort" });
      spawnEnemy({ kind: "bug", x: GAME_WIDTH - 50, tag: "bossEscort" });
    }

    function triggerBossPhaseTransition(boss: GameObj) {
      bossPhaseTransitioning = true;
      bossInvuln = true;
      bossBlinkTime = 0;
      k.shake(5);

      const lines = [
        "뭐?! 반이나 깎였다고?! 좋아, 오늘 저녁은 너로 정했다!!",
        "이 도시락은 아직 안 비었어! 한 그릇 더 간다!!",
      ];
      showBossDialogue(lines[Math.floor(Math.random() * lines.length)], 2.2, () => {});

      // guaranteed drop, no ITEM_DROP_CHANCE roll
      createItemDrop(boss.pos.x, boss.pos.y, pickBossBonusItemKind());

      k.wait(3.2, () => {
        boss.opacity = 1;
        bossPhaseTransitioning = false;
        bossInvuln = false;
        bossPhase = 2;
        bossThrowTimer = 0.6;
        bossEscortTimer = 3;
      });
    }

    function startBossDefeatSequence(boss: GameObj, n: number) {
      if (bossDefeatTriggered) return;
      bossDefeatTriggered = true;
      bossInvuln = true;
      bossPhase = null;
      playSound("explosion", { volume: 0.7 });

      let step = 0;
      const runStep = () => {
        if (step < 3) {
          spawnBurst(
            k,
            boss.pos.x + k.rand(-14, 14),
            boss.pos.y + k.rand(-14, 14),
            Math.floor(k.rand(10, 14))
          );
          step += 1;
          k.wait(0.25, runStep);
          return;
        }

        spawnBurst(k, boss.pos.x, boss.pos.y, 24, 2);
        playSound("explosion", { volume: 0.85 });
        k.shake(8);
        k.destroy(boss);

        const lines = [
          "속이... 더부룩하다... 오늘은 여기까지...",
          "밥이 넘어가야 할 텐데... 졌잘싸...",
        ];
        showBossDialogue(lines[Math.floor(Math.random() * lines.length)], 2.5, () => {
          const reward = bossScoreValue(n);
          score += reward;
          scoreLabel.text = String(score);
          spawnPopupText(k, GAME_WIDTH / 2, GAME_HEIGHT / 2, `+${reward}`, [
            255, 220, 120,
          ] as const);

          k.wait(0.3, () => {
            score += 100;
            scoreLabel.text = String(score);
            spawnPopupText(k, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, "CLEAR BONUS +100", [
              120, 255, 180,
            ] as const);
          });

          k.wait(1.0, () => {
            activeBoss = null;
            bossPhase = null;
            if (bossHpBarBg) k.destroy(bossHpBarBg);
            if (bossHpBarFill) k.destroy(bossHpBarFill);
            if (bossNameLabel) k.destroy(bossNameLabel);
            bossHpBarBg = null;
            bossHpBarFill = null;
            bossNameLabel = null;
          });
        });
      };
      runStep();
    }

    function beginBossEncounter() {
      bossEncounterCount += 1;
      nextBossThreshold += BOSS_CONFIG.repeatIntervalScore;
      const n = bossEncounterCount;
      const repeat = n > 1;
      const cfg = BOSS_TYPES.kimDoljun;

      bossPhase = null;
      bossPhaseTransitioning = false;
      bossDefeatTriggered = false;
      bossInvuln = true;
      bossMoveDir = 1;
      bossThrowTimer = 0;
      bossEscortTimer = n >= 3 ? 6 : 7;
      bossBombsInFlight = 0;
      bossMaxHp = Math.max(1, Math.round(cfg.baseHp * bossHpMul(n)));

      const boss = k.add([
        k.sprite(cfg.sprite),
        k.pos(GAME_WIDTH / 2, repeat ? cfg.idleY : -60),
        k.anchor("center"),
        k.scale(cfg.scale),
        k.area(),
        k.health(bossMaxHp),
        k.opacity(0),
        k.z(8),
        "boss",
      ]);
      activeBoss = boss;

      bossHpBarBg = k.add([
        k.rect(220, 10, { radius: 3 }),
        k.pos(GAME_WIDTH / 2, 80),
        k.anchor("center"),
        k.color(40, 20, 30),
        k.opacity(0),
        k.outline(1, k.rgb(255, 255, 255)),
        k.fixed(),
        k.z(101),
      ]);
      bossHpBarFill = k.add([
        k.rect(214, 6, { radius: 2 }),
        k.pos(GAME_WIDTH / 2 - 107, 80),
        k.anchor("left"),
        k.color(255, 90, 90),
        k.opacity(0),
        k.fixed(),
        k.z(102),
      ]);
      bossNameLabel = k.add([
        k.text(cfg.name, { size: 12 }),
        k.pos(GAME_WIDTH / 2, 68),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.opacity(0),
        k.fixed(),
        k.z(102),
      ]);

      // keep the HP bar fill in sync at all times boss is alive
      boss.onUpdate(() => {
        if (!bossHpBarFill) return;
        const ratio = bossMaxHp > 0 ? Math.max(0, boss.hp() / bossMaxHp) : 0;
        bossHpBarFill.width = 214 * ratio;
      });

      // movement + attack loop, gated by bossPhase/bossPhaseTransitioning
      boss.onUpdate(() => {
        if (bossPhaseTransitioning) {
          bossBlinkTime += k.dt();
          boss.opacity = 0.4 + Math.abs(Math.sin(bossBlinkTime * 18)) * 0.6;
          return;
        }
        if (bossPhase === null) return;

        const speedMul = bossSpeedMul(n);
        const cooldownMul = bossCooldownMul(n);
        const rangeMin = bossPhase === 1 ? cfg.moveRangeX[0] : 70;
        const rangeMax = bossPhase === 1 ? cfg.moveRangeX[1] : 410;
        const moveSpeed = (bossPhase === 1 ? cfg.baseMoveSpeed : 95) * speedMul;

        boss.pos.x += bossMoveDir * moveSpeed * k.dt();
        if (boss.pos.x >= rangeMax) {
          boss.pos.x = rangeMax;
          bossMoveDir = -1;
        } else if (boss.pos.x <= rangeMin) {
          boss.pos.x = rangeMin;
          bossMoveDir = 1;
        }
        boss.pos.y = cfg.idleY + Math.sin(k.time() * 3) * 6;

        const targetX = player.exists() ? player.pos.x : boss.pos.x;
        const targetY = player.exists() ? player.pos.y : GAME_HEIGHT - 110;

        bossThrowTimer -= k.dt();
        if (bossPhase === 1) {
          if (bossThrowTimer <= 0 && bossBombsInFlight < 1) {
            bossThrowTimer = Math.max(1.8 * cooldownMul, 1.3);
            bossThrowBombAt(boss.pos.x, boss.pos.y, targetX, targetY);
          }
        } else {
          if (bossThrowTimer <= 0) {
            bossThrowTimer = Math.max(1.4 * cooldownMul, 1.0);
            bossThrowBombAt(boss.pos.x, boss.pos.y, targetX, targetY);
            // second bomb always offset to a single random side, so the other
            // side stays clear as an escape route (never sandwich the player)
            const sign = Math.random() < 0.5 ? -1 : 1;
            const mag = k.rand(40, 70);
            bossThrowBombAt(boss.pos.x, boss.pos.y, targetX + sign * mag, targetY);
          }

          bossEscortTimer -= k.dt();
          if (bossEscortTimer <= 0) {
            bossEscortTimer = n >= 3 ? 6 : 7;
            trySpawnBossEscorts(n);
          }
        }
      });

      boss.onDeath(() => startBossDefeatSequence(boss, n));

      // ---- entrance sequence ----
      k.shake(4);
      const warnDur = repeat ? 1.0 : 2.0;
      const warning = k.add([
        k.text("위험! 거대 신호 접근 중", { size: 20, align: "center" }),
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60),
        k.anchor("center"),
        k.color(255, 90, 90),
        k.opacity(1),
        k.fixed(),
        k.z(95),
      ]);
      warning.onUpdate(() => {
        warning.opacity = 0.5 + Math.sin(k.time() * 12) * 0.5;
      });

      if (currentBGM) {
        const startVol = currentBGM.volume;
        k.tween(startVol, startVol * 0.3, 1.0, (v) => {
          if (currentBGM) currentBGM.volume = v;
        });
      }

      k.wait(warnDur, () => {
        k.destroy(warning);

        const afterEntrance = () => {
          const dialogueDuration = repeat ? 1.8 : 3.0;
          showBossDialogue(
            "나는 김돌준. 용케 여기까지 왔군. 하지만 여기가 끝이다!! 내 밥이나 먹어라!!",
            dialogueDuration,
            () => {
              k.tween(0, 1, 0.3, (o) => {
                if (bossHpBarBg) bossHpBarBg.opacity = o;
                if (bossHpBarFill) bossHpBarFill.opacity = o;
                if (bossNameLabel) bossNameLabel.opacity = o;
              });
              if (currentBGM) {
                const cur = currentBGM.volume;
                k.tween(cur, 0.5, 0.3, (v) => {
                  if (currentBGM) currentBGM.volume = v;
                });
              }
              const grace = repeat ? 0.4 : 0.8;
              k.wait(grace, () => {
                bossInvuln = false;
                bossPhase = 1;
              });
            }
          );
        };

        if (!repeat) {
          boss.opacity = 1;
          k.tween(
            boss.pos.y,
            cfg.idleY,
            1.2,
            (y) => {
              boss.pos.y = y;
            },
            k.easings.easeOutQuad
          );
          k.wait(1.2, afterEntrance);
        } else {
          k.tween(0, 1, 0.4, (o) => {
            boss.opacity = o;
          });
          k.wait(0.4, afterEntrance);
        }
      });
    }

    k.onCollide("playerBullet", "enemy", (bullet, enemy) => {
      k.destroy(bullet);
      enemy.hurt(1);
      if (enemy.hp() > 0) {
        playSound("hit", { volume: 0.65 });
        spawnBurst(k, enemy.pos.x, enemy.pos.y, 3);
      }
    });

    k.onCollide("enemyBullet", "player", (bullet) => {
      k.destroy(bullet);
      damagePlayer();
    });

    k.onCollide("enemy", "player", (enemy) => {
      k.destroy(enemy);
      damagePlayer();
    });

    k.onCollide("item", "player", (item) => {
      applyItem(item.kind as ItemKind);
      k.destroy(item);
    });

    k.onCollide("playerBullet", "boss", (bullet, boss) => {
      k.destroy(bullet);
      if (bossInvuln) return;
      boss.hurt(1);
      if (boss.hp() > 0) {
        playSound("hit", { volume: 0.5 });
        spawnBurst(k, boss.pos.x, boss.pos.y, 2);
        if (bossPhase === 1 && !bossPhaseTransitioning && boss.hp() <= bossMaxHp / 2) {
          triggerBossPhaseTransition(boss);
        }
      }
    });

    k.onCollide("boss", "player", () => {
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

      // buff timers
      for (const kind of BUFF_ORDER) {
        if (buffs[kind] > 0) buffs[kind] = Math.max(0, buffs[kind] - k.dt());
      }
      updateBuffUI();

      // shield aura follows player while active
      if (buffs.shield > 0 && player.exists()) {
        if (!shieldAura) {
          shieldAura = k.add([
            k.circle(24),
            k.pos(player.pos),
            k.anchor("center"),
            k.opacity(0.35),
            k.color(
              ITEM_TYPES.shield.color[0],
              ITEM_TYPES.shield.color[1],
              ITEM_TYPES.shield.color[2]
            ),
            k.outline(2, k.rgb(230, 247, 255)),
            k.z(9),
          ]);
        }
        shieldAura.pos = player.pos;
        shieldAura.opacity = 0.25 + Math.sin(k.time() * 6) * 0.15;
      } else if (shieldAura) {
        k.destroy(shieldAura);
        shieldAura = null;
      }

      // magnet pulse ring, purely visual feedback that the field is active
      if (buffs.magnet > 0 && player.exists()) {
        magnetPulseTimer -= k.dt();
        if (magnetPulseTimer <= 0) {
          magnetPulseTimer = 0.45;
          spawnRing(k, player.pos.x, player.pos.y, ITEM_TYPES.magnet.color, 10, 160);
        }
      }

      // auto fire
      fireTimer -= k.dt();
      if (fireTimer <= 0 && player.exists()) {
        const interval =
          buffs.rapidFire > 0
            ? PLAYER.fireInterval * ITEM_TYPES.rapidFire.fireIntervalMult
            : PLAYER.fireInterval;
        fireTimer = interval;
        spawnPlayerBullet();
      }

      // enemy spawning, ramps up over time — suspended while a boss fight is active
      if (!activeBoss) {
        spawnTimer -= k.dt();
        if (spawnTimer <= 0) {
          const interval = Math.max(1.5 - elapsed * 0.01, 0.5);
          spawnTimer = interval;
          spawnEnemy();
        }
      }

      // boss trigger: fires once per crossed score threshold (500, 1000, 1500, ...)
      if (!activeBoss && score >= nextBossThreshold) {
        beginBossEncounter();
      }
    });
  });

  // ---------------- Game over scene ----------------
  k.scene("gameover", (score: number) => {
    // Play title BGM again on game over
    if (currentBGM) {
      currentBGM.stop();
    }
    currentBGM = playSound("bgm_title", { loop: true, volume: 0.6 });

    addStarfield(k);
    createMuteButton(k);
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

    k.onMousePress(() => {
      if (muteButton?.isHovering()) return;
      playSound("ui_select", { volume: 0.7 });
      k.go("game");
    });
    k.onKeyPress(["space", "enter"], () => {
      playSound("ui_select", { volume: 0.7 });
      k.go("game");
    });
  });

  k.go("start");

  return () => {
    k.quit();
  };
}
