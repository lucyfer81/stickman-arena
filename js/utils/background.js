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

  // distant skyline (parallax buildings)
  const bg = scene.add.graphics().setDepth(-90);
  const skylineY = CONFIG.GROUND_Y - 40;
  let x = -20;
  bg.fillStyle(0x121a2c, 0.9);
  while (x < W + 40) {
    const bw = 50 + ((x * 9301 + 49297) % 70);
    const bh = 80 + ((x * 49297 + 233) % 180);
    bg.fillRect(x, skylineY - bh, bw, bh);
    // a couple of lit windows
    bg.fillStyle(0x2b4a6b, 0.5);
    for (let wy = skylineY - bh + 12; wy < skylineY - 8; wy += 18) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 14) {
        if (((wx * 17 + wy * 31) % 7) < 3) bg.fillRect(wx, wy, 5, 8);
      }
    }
    bg.fillStyle(0x121a2c, 0.9);
    x += bw + 8;
  }

  // ground area
  scene.add.rectangle(0, CONFIG.GROUND_Y, W, H - CONFIG.GROUND_Y, COLORS.ground)
    .setOrigin(0, 0).setDepth(-50);

  // ground neon line
  const gl = scene.add.graphics().setDepth(-45);
  gl.lineStyle(3, COLORS.groundLine, 0.9);
  gl.lineBetween(0, CONFIG.GROUND_Y, W, CONFIG.GROUND_Y);
  gl.lineStyle(1, 0x35e1ff, 0.35);
  gl.lineBetween(0, CONFIG.GROUND_Y + 4, W, CONFIG.GROUND_Y + 4);

  // arena side walls glow
  const w = scene.add.graphics().setDepth(-46);
  w.lineStyle(4, 0x35506e, 0.8);
  w.lineBetween(CONFIG.WALL_LEFT, 80, CONFIG.WALL_LEFT, CONFIG.GROUND_Y);
  w.lineBetween(CONFIG.WALL_RIGHT, 80, CONFIG.WALL_RIGHT, CONFIG.GROUND_Y);

  // soft top vignette
  const v = scene.add.graphics().setDepth(80);
  v.fillStyle(0x000000, 0.25);
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
