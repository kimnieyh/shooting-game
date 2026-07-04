// Procedurally generates cute pixel-art sprites for the shooting game.
// Run with: node scripts/generate-sprites.mjs
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "sprites");
fs.mkdirSync(OUT_DIR, { recursive: true });

function hexToRgba(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

function createGrid(width, height) {
  return Array.from({ length: height }, () => new Array(width).fill(null));
}

function setPixel(grid, x, y, color) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = color;
}

function getPixel(grid, x, y) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return null;
  return grid[y][x];
}

function fillEllipse(grid, cx, cy, rx, ry, color, predicate) {
  const { length: h } = grid;
  const w = grid[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) {
        if (!predicate || predicate(x, y)) setPixel(grid, x, y, color);
      }
    }
  }
}

function fillRect(grid, x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) setPixel(grid, x, y, color);
  }
}

function fillHeart(grid, cx, cy, scale, color) {
  const { length: h } = grid;
  const w = grid[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / scale;
      const ny = -(y - cy) / scale;
      const v = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
      if (v <= 0) setPixel(grid, x, y, color);
    }
  }
}

function fillStar(grid, cx, cy, rOuter, rInner, points, color, rotation = -Math.PI / 2) {
  const { length: h } = grid;
  const w = grid[0].length;
  const verts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rotation + (i * Math.PI) / points;
    verts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const inside = (px, py) => {
    let c = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const [xi, yi] = verts[i];
      const [xj, yj] = verts[j];
      const intersect =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) c = !c;
    }
    return c;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inside(x + 0.5, y + 0.5)) setPixel(grid, x, y, color);
    }
  }
}

// Outline pass: any transparent pixel adjacent (8-dir) to a filled pixel becomes outline color.
function addOutline(grid, outlineColor) {
  const h = grid.length;
  const w = grid[0].length;
  const toSet = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== null) continue;
      let touchesFill = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (getPixel(grid, x + dx, y + dy) !== null) {
          touchesFill = true;
          break;
        }
      }
      if (touchesFill) toSet.push([x, y]);
    }
  }
  for (const [x, y] of toSet) setPixel(grid, x, y, outlineColor);
}

// Adds a small light highlight patch (for cute glossy look).
function addHighlight(grid, cx, cy, rx, ry, color) {
  const h = grid.length;
  const w = grid[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] === null) continue;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(grid, x, y, color);
    }
  }
}

function writePng(grid, name) {
  const height = grid.length;
  const width = grid[0].length;
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const px = grid[y][x];
      if (px === null) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      } else {
        const [r, g, b, a] = hexToRgba(px);
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = a;
      }
    }
  }
  const filePath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(filePath, PNG.sync.write(png));
  console.log("wrote", filePath);
}

// ---------- Player ship (24x24), cute rounded rocket, facing up ----------
function buildShip() {
  const S = 24;
  const g = createGrid(S, S);
  const cx = S / 2 - 0.5;
  // main hull (teardrop-ish via ellipse) + nose triangle done with ellipses stacked
  fillEllipse(g, cx, 13, 5.5, 8, "#4fd6ff");
  fillEllipse(g, cx, 6.5, 3, 4.5, "#4fd6ff"); // nose
  // wings
  fillEllipse(g, cx - 6, 16, 3.2, 4, "#2fb8e6");
  fillEllipse(g, cx + 6, 16, 3.2, 4, "#2fb8e6");
  // cockpit window
  fillEllipse(g, cx, 10, 2.2, 2.6, "#ff5d7a");
  fillEllipse(g, cx, 9.3, 1.1, 1.1, "#ffd9df");
  // engine glow
  fillEllipse(g, cx, 20, 2.4, 2.2, "#ffb347");
  fillEllipse(g, cx, 20.5, 1.2, 1.1, "#fff275");
  addHighlight(g, cx - 2.2, 8, 1.6, 3, "#8ee9ff");
  addOutline(g, "#123055");
  return g;
}

// ---------- Enemy A: cute UFO (20x20) ----------
function buildEnemyUfo() {
  const S = 20;
  const g = createGrid(S, S);
  const cx = S / 2 - 0.5;
  fillEllipse(g, cx, 12, 8.5, 4.2, "#b768ff");
  fillEllipse(g, cx, 8, 4.5, 4.5, "#e6c9ff");
  fillEllipse(g, cx, 7, 3.2, 3, "#8b3fe0");
  fillEllipse(g, cx - 4.5, 13, 1.1, 1.1, "#ffe873");
  fillEllipse(g, cx + 4.5, 13, 1.1, 1.1, "#ffe873");
  fillEllipse(g, cx, 14, 1.1, 1.1, "#ffe873");
  addHighlight(g, cx - 2, 6, 1.6, 1.6, "#ffffff");
  addOutline(g, "#3a1466");
  return g;
}

// ---------- Enemy B: cute bug (20x20) ----------
function buildEnemyBug() {
  const S = 20;
  const g = createGrid(S, S);
  const cx = S / 2 - 0.5;
  // antennae
  fillRect(g, cx - 4, 2, cx - 4, 4, "#ff8fb3");
  fillRect(g, cx + 4, 2, cx + 4, 4, "#ff8fb3");
  fillEllipse(g, cx - 4, 2, 1, 1, "#ff5d7a");
  fillEllipse(g, cx + 4, 2, 1, 1, "#ff5d7a");
  // body
  fillEllipse(g, cx, 12, 7.5, 6.5, "#ff6f91");
  // eyes
  fillEllipse(g, cx - 2.6, 10, 1.8, 2.1, "#ffffff");
  fillEllipse(g, cx + 2.6, 10, 1.8, 2.1, "#ffffff");
  fillEllipse(g, cx - 2.6, 10.6, 0.9, 1, "#1c1c2e");
  fillEllipse(g, cx + 2.6, 10.6, 0.9, 1, "#1c1c2e");
  // little feet
  fillEllipse(g, cx - 5, 17, 1.4, 1.1, "#d94f76");
  fillEllipse(g, cx + 5, 17, 1.4, 1.1, "#d94f76");
  addHighlight(g, cx - 2.5, 8, 1.8, 1.6, "#ffb6cd");
  addOutline(g, "#7a1c3a");
  return g;
}

// ---------- Enemy C: cute square robot (mini-boss look, 24x24) ----------
function buildEnemyRobot() {
  const S = 24;
  const g = createGrid(S, S);
  const cx = S / 2 - 0.5;
  fillRect(g, cx - 8, 5, cx + 8, 18, "#7fe08a");
  fillEllipse(g, cx - 8, 12, 2.4, 3, "#7fe08a");
  fillEllipse(g, cx + 8, 12, 2.4, 3, "#7fe08a");
  fillRect(g, cx - 9, 20, cx - 5, 22, "#4fbb62");
  fillRect(g, cx + 5, 20, cx + 9, 22, "#4fbb62");
  fillEllipse(g, cx - 3.5, 10, 2, 2.4, "#0d3d1a");
  fillEllipse(g, cx + 3.5, 10, 2, 2.4, "#0d3d1a");
  fillEllipse(g, cx - 3.5, 9.4, 0.7, 0.7, "#ffffff");
  fillEllipse(g, cx + 3.5, 9.4, 0.7, 0.7, "#ffffff");
  fillRect(g, cx - 4, 14, cx + 4, 15, "#0d3d1a");
  fillRect(g, cx - 1, 1, cx + 1, 5, "#4fbb62");
  fillEllipse(g, cx, 1, 1.4, 1.4, "#ffe873");
  addHighlight(g, cx - 4, 8, 3, 2.4, "#c8ffce");
  addOutline(g, "#12461e");
  return g;
}

// ---------- Bullets ----------
function buildBulletPlayer() {
  const w = 6,
    h = 12;
  const g = createGrid(w, h);
  fillEllipse(g, w / 2 - 0.5, h / 2 - 0.5, 2.2, 5.4, "#ffe873");
  fillEllipse(g, w / 2 - 0.5, 3, 1, 2, "#fffde0");
  addOutline(g, "#8a6d00");
  return g;
}

function buildBulletEnemy() {
  const w = 6,
    h = 12;
  const g = createGrid(w, h);
  fillEllipse(g, w / 2 - 0.5, h / 2 - 0.5, 2.2, 5.4, "#ff5d5d");
  fillEllipse(g, w / 2 - 0.5, h - 3, 1, 2, "#ffd6d6");
  addOutline(g, "#7a0f0f");
  return g;
}

// ---------- Heart (16x16) ----------
function buildHeart() {
  const S = 16;
  const g = createGrid(S, S);
  fillHeart(g, S / 2 - 0.5, S / 2, 3.1, "#ff4d6d");
  addHighlight(g, S / 2 - 2.6, S / 2 - 2.5, 1.6, 1.2, "#ff9bae");
  addOutline(g, "#7a0f26");
  return g;
}

// ---------- Spark / explosion particle (12x12) ----------
function buildSpark() {
  const S = 12;
  const g = createGrid(S, S);
  fillStar(g, S / 2 - 0.5, S / 2 - 0.5, 5.6, 2.2, 4, "#ffe873");
  fillStar(g, S / 2 - 0.5, S / 2 - 0.5, 2.6, 1, 4, "#ffffff");
  return g;
}

// ---------- Star particle for background (4x4) ----------
function buildStarParticle() {
  const S = 4;
  const g = createGrid(S, S);
  fillEllipse(g, 1.5, 1.5, 1.4, 1.4, "#ffffff");
  return g;
}

writePng(buildShip(), "ship");
writePng(buildEnemyUfo(), "enemy_ufo");
writePng(buildEnemyBug(), "enemy_bug");
writePng(buildEnemyRobot(), "enemy_robot");
writePng(buildBulletPlayer(), "bullet_player");
writePng(buildBulletEnemy(), "bullet_enemy");
writePng(buildHeart(), "heart");
writePng(buildSpark(), "spark");
writePng(buildStarParticle(), "star");

console.log("All sprites generated in", OUT_DIR);
