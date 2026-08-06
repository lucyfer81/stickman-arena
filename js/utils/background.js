import { CONFIG, COLORS } from '../config.js';

export function drawBackground(scene) {
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;

  // sky gradient
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = mixColor(COLORS.bgTop, COLORS.bgBottom, t);
    scene.add.rectangle(0, (H * i) / steps, W, H / steps + 1, c)
      .setOrigin(0, 0).setDepth(-100);
  }

  // stars
  const starG = scene.add.graphics().setDepth(-98);
  for (let i = 0; i < 90; i++) {
    const sx = ((i * 9301 + 49297) % 233280) / 233280 * W;
    const sy = ((i * 49297 + 233) % 70000) / 100000 * (CONFIG.GROUND_Y - 60);
    const r = ((i * 7) % 3 === 0) ? 1.6 : 1;
    starG.fillStyle(0xcfe6ff, 0.5 + ((i * 13) % 5) / 12);
    starG.fillCircle(sx, sy, r);
  }

  // moon glow (faked radial)
  const moonX = W * 0.78, moonY = 150;
  const moonG = scene.add.graphics().setDepth(-97);
  for (let i = 14; i >= 1; i--) {
    moonG.fillStyle(0x2a4a6e, 0.03);
    moonG.fillCircle(moonX, moonY, 60 + i * 14);
  }
  moonG.fillStyle(0x9fc6ff, 0.95);
  moonG.fillCircle(moonX, moonY, 52);
  moonG.fillStyle(0xbed8ff, 0.95);
  moonG.fillCircle(moonX - 10, moonY - 12, 44);
  moonG.fillStyle(0x2a4a6e, 0.18);
  moonG.fillCircle(moonX + 12, moonY + 6, 10);
  moonG.fillCircle(moonX - 6, moonY + 16, 7);

  // distant skyline (parallax buildings)
  const bg = scene.add.graphics().setDepth(-90);
  const skylineY = CONFIG.GROUND_Y - 30;
  let x = -20;
  while (x < W + 40) {
    const bw = 50 + ((x * 9301 + 49297) % 70);
    const bh = 90 + ((x * 49297 + 233) % 190);
    bg.fillStyle(0x0f1726, 0.95);
    bg.fillRect(x, skylineY - bh, bw, bh);
    bg.fillStyle(0x3a6da3, 0.55);
    for (let wy = skylineY - bh + 12; wy < skylineY - 8; wy += 18) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 14) {
        if (((wx * 17 + wy * 31) % 7) < 3) bg.fillRect(wx, wy, 5, 8);
      }
    }
    x += bw + 8;
  }

  // floor
  scene.add.rectangle(0, CONFIG.GROUND_Y, W, H - CONFIG.GROUND_Y, 0x070912)
    .setOrigin(0, 0).setDepth(-55);

  // perspective floor grid
  const floorG = scene.add.graphics().setDepth(-52);
  const horizonX = W / 2;
  const vpx = horizonX, vpy = CONFIG.GROUND_Y;
  floorG.lineStyle(2, 0x1d3a57, 0.5);
  for (let i = -8; i <= 8; i++) {
    const fx = horizonX + i * 90;
    floorG.lineBetween(fx, vpy, horizonX + i * 360, H + 40);
  }
  for (let j = 1; j <= 5; j++) {
    const t = j / 6;
    const yy = CONFIG.GROUND_Y + t * (H - CONFIG.GROUND_Y) * 1.3;
    floorG.lineStyle(2, 0x1d3a57, 0.45 - t * 0.07);
    floorG.lineBetween(0, yy, W, yy);
  }

  // ground neon line (glow + core)
  const gl = scene.add.graphics().setDepth(-45);
  gl.lineStyle(8, 0x1b6ea8, 0.35);
  gl.lineBetween(0, CONFIG.GROUND_Y, W, CONFIG.GROUND_Y);
  gl.lineStyle(4, 0x35e1ff, 0.85);
  gl.lineBetween(0, CONFIG.GROUND_Y, W, CONFIG.GROUND_Y);
  gl.lineStyle(1, 0xeaf4ff, 0.9);
  gl.lineBetween(0, CONFIG.GROUND_Y - 1, W, CONFIG.GROUND_Y - 1);

  // arena side walls glow
  const w = scene.add.graphics().setDepth(-46);
  w.lineStyle(6, 0x1b6ea8, 0.3);
  w.lineBetween(CONFIG.WALL_LEFT, 80, CONFIG.WALL_LEFT, CONFIG.GROUND_Y);
  w.lineBetween(CONFIG.WALL_RIGHT, 80, CONFIG.WALL_RIGHT, CONFIG.GROUND_Y);
  w.lineStyle(3, 0x35506e, 0.9);
  w.lineBetween(CONFIG.WALL_LEFT, 80, CONFIG.WALL_LEFT, CONFIG.GROUND_Y);
  w.lineBetween(CONFIG.WALL_RIGHT, 80, CONFIG.WALL_RIGHT, CONFIG.GROUND_Y);

  // drifting embers
  if (scene.add.particles) {
    scene.add.particles(W / 2, CONFIG.GROUND_Y + 40, 'dot', {
      x: { min: 0, max: W },
      y: { min: -20, max: 20 },
      vx: { min: -12, max: 12 },
      vy: { min: -40, max: -18 },
      scale: { min: 0.15, max: 0.5 },
      alpha: { start: 0.5, end: 0 },
      tint: 0x35e1ff,
      lifespan: { min: 3000, max: 6000 },
      frequency: 140,
      blendMode: 'ADD',
    }).setDepth(-40);
  }

  // top vignette
  const v = scene.add.graphics().setDepth(80);
  v.fillStyle(0x000000, 0.3);
  v.fillRect(0, 0, W, 70);
  v.fillStyle(0x000000, 0.18);
  v.fillRect(0, 0, W, 30);
}

export function mixColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
