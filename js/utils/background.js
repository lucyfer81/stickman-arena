import { CONFIG, COLORS } from '../config.js';

// Arena backdrop — layered for depth (the single biggest perception lever on the
// screen players see 95% of the time). Earlier the background was one flat
// building silhouette whose base floated ~30px above the ground line, dropping
// into a featureless floor: the classic "placeholder stage" tell. This rebuild
// adds three depth planes (far haze skyline / near grounded skyline / foreground
// frame), an atmospheric horizon band that hides the sky-to-ground seam, a faint
// neon reflection on the floor, and a bottom vignette so the arena reads as a
// lit, occupied stage rather than cardboard.
//
// PURE VISUAL: only `background.js`. All layers stay at depth <= -40 (gameplay
// entities live at >= 0; the title spotlight sits at -30 and stays in front).
export function drawBackground(scene, opts) {
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
  const GY = CONFIG.GROUND_Y;
  const withForeground = !(opts && opts.skipForeground);

  // ---- sky gradient (deep navy -> slightly warmer horizon) ----
  const steps = 48;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = mixColor(COLORS.bgTop, COLORS.bgBottom, t);
    scene.add.rectangle(0, (H * i) / steps, W, H / steps + 1, c)
      .setOrigin(0, 0).setDepth(-100);
  }

  // ---- stars ----
  const starG = scene.add.graphics().setDepth(-98);
  for (let i = 0; i < 110; i++) {
    const sx = ((i * 9301 + 49297) % 233280) / 233280 * W;
    const sy = ((i * 49297 + 233) % 70000) / 100000 * (GY - 60);
    const r = ((i * 7) % 3 === 0) ? 1.6 : 1;
    starG.fillStyle(0xcfe6ff, 0.5 + ((i * 13) % 5) / 12);
    starG.fillCircle(sx, sy, r);
  }

  // ---- moon + soft glow ----
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

  // ---- FAR skyline (plane 1: distant, atmospheric haze) ----
  // Pushed back + LIFTED toward the horizon colour so it reads as miles away.
  // Far buildings are deliberately lighter + cooler + lower-contrast than the
  // near layer — that value separation is what makes the two planes read as
  // distinct depths at a glance (atmospheric perspective). Bases sit above the
  // ground line; the near layer + haze cover the seam.
  const farG = scene.add.graphics().setDepth(-95);
  const farBase = GY - 26;
  const farTint = 0x2b3c5c;     // hazy blue-grey, noticeably lighter than near
  let fx = -30;
  while (fx < W + 40) {
    const bw = 44 + rand(fx, 9301, 49297, 64);
    const bh = 70 + rand(fx, 49297, 233, 150);
    farG.fillStyle(farTint, 0.95);
    farG.fillRect(fx, farBase - bh, bw, bh);
    farG.fillStyle(0x7aa6d6, 0.4);
    for (let wy = farBase - bh + 12; wy < farBase - 10; wy += 16) {
      for (let wx = fx + 5; wx < fx + bw - 7; wx += 12) {
        if (((wx * 17 + wy * 31) % 9 + 9) % 9 < 3) farG.fillRect(wx, wy, 4, 6);
      }
    }
    fx += bw + 6;
  }

  // ---- horizon haze band ----
  // The single biggest "premium" tell: a soft warm-cool scattering band along
  // the skyline base. Hides the sky-to-ground seam, separates the planes, and
  // gives the moon something to glow through. Boosted alpha so it is *read*
  // (subtle failed the perception test — this must clearly read as depth).
  const hazeG = scene.add.graphics().setDepth(-88);
  for (let i = 0; i < 48; i++) {
    const t = i / 47;
    const y = GY - 110 + t * 116;
    // peak near the upper-middle of the band, warm-tinted
    const peak = 1 - Math.abs(t - 0.5) * 1.8;
    const a = 0.34 * Math.max(0, peak);
    if (a <= 0) continue;
    hazeG.fillStyle(0x4a7ab0, a);
    hazeG.fillRect(0, y, W, 3);
  }
  // bright kiss just above the ground line — light catching the haze / spillover
  // from the neon edge.
  hazeG.fillStyle(0x9fc6ff, 0.16);
  hazeG.fillRect(0, GY - 10, W, 10);

  // ---- NEAR skyline (plane 2: closer, darker, grounded, lit windows) ----
  // This is the layer that GROUNDS the city: near-black silhouettes (closer =
  // more contrast, opposite of the hazy far layer), bigger footprint, brighter
  // varied windows, and bases that reach fully DOWN to the ground line so the
  // city meets the street. Sits in front of the far layer → instant parallax.
  const nearG = scene.add.graphics().setDepth(-85);
  const nearBase = GY;            // grounded — no floating
  const nearTint = 0x05080f;      // near-black navy (silhouette)
  let nx = -40;
  while (nx < W + 40) {
    const bw = 64 + rand(nx, 4567, 12389, 96);
    const bh = 130 + rand(nx, 12389, 7, 220);
    nearG.fillStyle(nearTint, 0.98);
    nearG.fillRect(nx, nearBase - bh, bw, bh);
    // roof cap detail
    nearG.fillStyle(0x13243f, 0.95);
    nearG.fillRect(nx + 3, nearBase - bh, bw - 6, 4);
    // warm + cool windows (mixed = lived-in, not a grid); brighter than the far
    // layer's windows so the depth separation holds.
    for (let wy = nearBase - bh + 14; wy < nearBase - 12; wy += 18) {
      for (let wx = nx + 6; wx < nx + bw - 9; wx += 13) {
        const r = ((wx * 17 + wy * 31) % 11 + 11) % 11;
        if (r < 3) {
          const warm = (r % 5 === 0);
          nearG.fillStyle(warm ? 0xffd9a0 : 0x8fdcff, warm ? 0.68 : 0.62);
          nearG.fillRect(wx, wy, 4, 7);
        }
      }
    }
    nx += bw + 4;
  }

  // ---- foreground haze veil (in front of the near skyline) ----
  // Real atmospheric haze PARTLY VEILS the bases of nearer buildings, not just
  // the distant ones. A second low-alpha pass at depth -84 (in front of the
  // near layer) fogged across the lower skyline is what makes the horizon read
  // as genuine depth rather than two flat cutouts.
  const veilG = scene.add.graphics().setDepth(-84);
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const y = GY - 60 + t * 70;
    const a = 0.16 * (1 - t);
    if (a <= 0) continue;
    veilG.fillStyle(0x5b86b8, a);
    veilG.fillRect(0, y, W, 3);
  }

  // ---- floor fill ----
  scene.add.rectangle(0, GY, W, H - GY, 0x060810)
    .setOrigin(0, 0).setDepth(-60);

  // ---- neon ground-line reflection on the floor ----
  // The neon edge reflecting onto a polished floor — a classic "lit stage"
  // tell. Boosted so the falloff is clearly readable (subtle failed the
  // perception test). Cheap vertical alpha gradient, additive feel.
  const reflG = scene.add.graphics().setDepth(-58).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const a = 0.22 * (1 - t) * (1 - t);
    reflG.fillStyle(0x1b6ea8, a);
    reflG.fillRect(0, GY + 1 + i * 3, W, 3);
  }

  // ---- perspective floor grid ----
  const floorG = scene.add.graphics().setDepth(-52);
  const horizonX = W / 2;
  const vpy = GY;
  for (let i = -8; i <= 8; i++) {
    const fx = horizonX + i * 90;
    floorG.lineStyle(2, 0x1d3a57, 0.5);
    floorG.lineBetween(fx, vpy, horizonX + i * 360, H + 40);
  }
  for (let j = 1; j <= 6; j++) {
    const t = j / 7;
    const yy = GY + t * (H - GY) * 1.3;
    floorG.lineStyle(2, 0x1d3a57, Math.max(0.12, 0.5 - t * 0.07));
    floorG.lineBetween(0, yy, W, yy);
  }

  // ---- arena side walls glow ----
  const w = scene.add.graphics().setDepth(-46);
  w.lineStyle(6, 0x1b6ea8, 0.3);
  w.lineBetween(CONFIG.WALL_LEFT, 80, CONFIG.WALL_LEFT, GY);
  w.lineBetween(CONFIG.WALL_RIGHT, 80, CONFIG.WALL_RIGHT, GY);
  w.lineStyle(3, 0x35506e, 0.9);
  w.lineBetween(CONFIG.WALL_LEFT, 80, CONFIG.WALL_LEFT, GY);
  w.lineBetween(CONFIG.WALL_RIGHT, 80, CONFIG.WALL_RIGHT, GY);

  // ---- ground neon line (glow + core) ----
  const gl = scene.add.graphics().setDepth(-45);
  gl.lineStyle(8, 0x1b6ea8, 0.35);
  gl.lineBetween(0, GY, W, GY);
  gl.lineStyle(4, 0x35e1ff, 0.85);
  gl.lineBetween(0, GY, W, GY);
  gl.lineStyle(1, 0xeaf4ff, 0.9);
  gl.lineBetween(0, GY - 1, W, GY - 1);

  // ---- FOREGROUND frame (plane 3: dark silhouettes at the extreme edges) ----
  // DISABLED — the screen-edge structures consistently read as a flat UI border
  // rather than depth, which reads as lower polish. The skyline haze + grounded
  // near layer + floor reflection already carry the depth story without it.
  // (Kept as a no-op switch so it can be re-tuned later if desired.)

  // ---- drifting embers (mostly cyan, a few warm for life) ----
  if (scene.add.particles) {
    scene.add.particles(W / 2, GY + 40, 'dot', {
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
    // sparse warm embers — a touch of colour variety against the cool palette
    scene.add.particles(W / 2, GY + 60, 'dot', {
      x: { min: 0, max: W },
      y: { min: -10, max: 10 },
      vx: { min: -8, max: 8 },
      vy: { min: -32, max: -14 },
      scale: { min: 0.12, max: 0.38 },
      alpha: { start: 0.42, end: 0 },
      tint: 0xffae5c,
      lifespan: { min: 2800, max: 5200 },
      frequency: 360,
      blendMode: 'ADD',
    }).setDepth(-39);
  }

  // ---- vignette (top + bottom) ----
  const v = scene.add.graphics().setDepth(80);
  v.fillStyle(0x000000, 0.3);
  v.fillRect(0, 0, W, 70);
  v.fillStyle(0x000000, 0.18);
  v.fillRect(0, 0, W, 30);
  // bottom vignette grounds the floor + focuses the eye up to the action
  v.fillStyle(0x000000, 0.28);
  v.fillRect(0, H - 46, W, 46);
}

// A foreground silhouette "tower/structure" hugging one screen edge — gives a
// third depth plane that reads as an OBJECT (notch + setback + lit rim) rather
// than a flat UI border. `left` mirrors the shape for the right edge. Sits just
// outside WALL_LEFT/RIGHT so it never overlaps the play field.
function drawEdgeProp(g, edgeX, left, GY) {
  const topY = 60;
  const dir = left ? 1 : -1;
  const slabW = 50;
  const x0 = left ? 6 : edgeX - 6 - slabW;
  // outer tall slab
  g.fillStyle(0x04060c, 0.98);
  g.fillRect(x0, topY, slabW, GY - topY);
  // setback shoulder (the notch that makes it read as a structure, not a border)
  const shoulderH = 90;
  const shoulderW = slabW + 16;
  const sx = left ? x0 : x0 - 16;
  g.fillStyle(0x03050a, 1);
  g.fillRect(sx, GY - shoulderH, shoulderW, shoulderH);
  // inner inset column for layered relief
  g.fillStyle(0x02040a, 1);
  const colW = 16;
  const cx = left ? x0 + slabW - colW : x0;
  g.fillRect(cx, topY - 10, colW, GY - topY + 10);
  // faint cyan rim along the inner edge — catches the arena light so the
  // silhouette feels like it's standing IN the lit arena, not painted on.
  g.lineStyle(2, 0x35e1ff, 0.45);
  const rimX = left ? x0 + slabW : x0;
  g.lineBetween(rimX, topY, rimX, GY);
  // a few faint windows so it's a structure, not a black void
  g.fillStyle(0x8fdcff, 0.16);
  for (let i = 0; i < 4; i++) {
    const wy = topY + 48 + i * 84;
    const wx = left ? x0 + 10 : x0 + slabW - 22;
    g.fillRect(wx, wy, 12, 14);
  }
  // soft base shadow puddle where it meets the floor
  g.fillStyle(0x000000, 0.5);
  g.fillEllipse(left ? x0 + slabW / 2 : x0 + slabW / 2, GY + 4, slabW + 24, 10);
}

export function mixColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// Deterministic pseudo-random in [0, span) keyed on x — same skyline every
// frame (no shimmer) without storing state. Always non-negative (JS % can be
// negative for negative dividends, which previously produced negative building
// widths and an infinite loop).
function rand(x, m1, m2, span) {
  const v = (x * m1 + m2) % span;
  return (v + span) % span;
}
