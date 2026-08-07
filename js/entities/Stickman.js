import { pulse, clamp01, easeOut, lerp } from '../utils/math.js';

// Local coordinate system: origin at feet midpoint, +y is UP, +x is forward.
// Render converts to graphics coords (y down) and applies facing flip.

const HIP_Y = 54;
const NECK_Y = 108;
const HEAD_Y = 132;
const HEAD_R = 14;

function idlePose(t) {
  const bob = Math.sin(t * 2.2) * 1.6;
  const sway = Math.sin(t * 1.1) * 1.2;
  return {
    hip: { x: sway * 0.3, y: HIP_Y + bob },
    neck: { x: 2 + sway * 0.3, y: NECK_Y + bob },
    head: { x: 3, y: HEAD_Y + bob },
    elbowL: { x: -11, y: NECK_Y - 18 + bob },
    handL: { x: -10, y: NECK_Y - 34 + bob },
    elbowR: { x: 11, y: NECK_Y - 16 + bob },
    handR: { x: 13, y: NECK_Y - 30 + bob },
    kneeL: { x: -8, y: 26 },
    footL: { x: -11, y: 0 },
    kneeR: { x: 8, y: 26 },
    footR: { x: 12, y: 0 },
  };
}

function runPose(t) {
  const phase = t * 12;
  const s = Math.sin(phase);
  const s2 = Math.sin(phase + Math.PI);
  const liftR = Math.max(0, Math.sin(phase)) * 18;
  const liftL = Math.max(0, Math.sin(phase + Math.PI)) * 18;
  const bob = -Math.abs(Math.sin(phase * 2)) * 3;

  const hip = { x: 3, y: HIP_Y + bob };
  const neck = { x: 6, y: NECK_Y + bob };
  const head = { x: 8, y: HEAD_Y + bob };

  const footR = { x: 14 + s * 12, y: liftR };
  const footL = { x: -10 + s2 * 12, y: liftL };
  // knee bends forward
  const kneeR = { x: (hip.x + footR.x) / 2 + 7, y: (hip.y + footR.y) / 2 + 4 };
  const kneeL = { x: (hip.x + footL.x) / 2 + 4, y: (hip.y + footL.y) / 2 + 4 };

  // arms swing opposite to legs
  const handR = { x: 11 - s * 13, y: NECK_Y - 30 + bob };
  const elbowR = { x: 10 - s * 8, y: NECK_Y - 15 + bob };
  const handL = { x: -10 - s2 * 13, y: NECK_Y - 32 + bob };
  const elbowL = { x: -10 - s2 * 7, y: NECK_Y - 16 + bob };

  return { hip, neck, head, elbowL, handL, elbowR, handR, kneeL, footL, kneeR, footR };
}

function jumpPose(vy) {
  // vy>0 rising -> tuck more
  const tuck = clamp01(vy / 600);
  const legUp = 6 + tuck * 16;
  const armUp = tuck * 14;
  return {
    hip: { x: 2, y: HIP_Y },
    neck: { x: 4, y: NECK_Y },
    head: { x: 6, y: HEAD_Y },
    elbowR: { x: 13, y: NECK_Y - 18 + armUp },
    handR: { x: 16, y: NECK_Y - 32 + armUp * 2 },
    elbowL: { x: -12, y: NECK_Y - 18 + armUp },
    handL: { x: -15, y: NECK_Y - 32 + armUp * 2 },
    kneeR: { x: 10, y: legUp + 14 },
    footR: { x: 14, y: legUp },
    kneeL: { x: -6, y: legUp + 16 },
    footL: { x: -6, y: legUp + 4 },
  };
}

function punchPose(p) {
  const out = pulse(p);
  const lean = out * 5;
  return {
    hip: { x: 4 + lean, y: HIP_Y },
    neck: { x: 7 + lean, y: NECK_Y },
    head: { x: 9 + lean, y: HEAD_Y },
    elbowR: { x: 13 + out * 24, y: NECK_Y - 26 },
    handR: { x: 13 + out * 50, y: NECK_Y - 28 },
    elbowL: { x: -12, y: NECK_Y - 12 },
    handL: { x: -16, y: NECK_Y - 22 },
    kneeR: { x: 14, y: 24 },
    footR: { x: 18, y: 0 },
    kneeL: { x: -11, y: 24 },
    footL: { x: -16, y: 0 },
  };
}

function kickPose(p) {
  const out = pulse(p);
  const legX = 12 + out * 48;
  const legY = lerp(0, NECK_Y - 34, out); // kick rises to ~ head height
  return {
    hip: { x: 2 - out * 4, y: HIP_Y },
    neck: { x: 0 - out * 6, y: NECK_Y },
    head: { x: -3 - out * 6, y: HEAD_Y },
    elbowR: { x: 10, y: NECK_Y - 14 },
    handR: { x: 12, y: NECK_Y - 10 },
    elbowL: { x: -13, y: NECK_Y - 12 },
    handL: { x: -19, y: NECK_Y - 22 },
    kneeR: { x: lerp(8, legX * 0.55, out), y: lerp(26, HIP_Y - 2, out) },
    footR: { x: legX, y: legY },
    kneeL: { x: -10, y: 24 },
    footL: { x: -14, y: 0 },
  };
}

function hurtPose(t) {
  const shake = Math.sin(t * 50) * 2;
  return {
    hip: { x: -5 + shake, y: HIP_Y - 2 },
    neck: { x: -8 + shake, y: NECK_Y },
    head: { x: -12 + shake, y: HEAD_Y + 2 },
    elbowR: { x: 16, y: NECK_Y + 4 },
    handR: { x: 20, y: NECK_Y + 12 },
    elbowL: { x: -16, y: NECK_Y },
    handL: { x: -20, y: NECK_Y - 4 },
    kneeR: { x: 12, y: 26 },
    footR: { x: 16, y: 0 },
    kneeL: { x: -12, y: 24 },
    footL: { x: -18, y: 0 },
  };
}

function rotateAround(p, cx, cy, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

// Map high-level anim to a pose object.
export function computePose(anim) {
  const { state, time = 0, vy = 0, phase = 0 } = anim;
  let pose;
  switch (state) {
    case 'run': pose = runPose(time); break;
    case 'jump': pose = jumpPose(vy); break;
    case 'punch': pose = punchPose(phase); break;
    case 'kick': pose = kickPose(phase); break;
    case 'hurt': pose = hurtPose(time); break;
    case 'dead':
      pose = idlePose(time);
      break;
    default: pose = idlePose(time);
  }
  if (state === 'dead') {
    const d = clamp01(anim.deadT || 0);
    const ang = easeOut(d) * 1.45; // ~83deg
    const cx = pose.hip.x;
    const cy = pose.hip.y;
    pose = {
      hip: pose.hip,
      neck: rotateAround(pose.neck, cx, cy, ang),
      head: rotateAround(pose.head, cx, cy, ang),
      elbowL: rotateAround(pose.elbowL, cx, cy, ang),
      handL: rotateAround(pose.handL, cx, cy, ang),
      elbowR: rotateAround(pose.elbowR, cx, cy, ang),
      handR: rotateAround(pose.handR, cx, cy, ang),
      kneeL: rotateAround(pose.kneeL, cx, cy, ang),
      footL: rotateAround(pose.footL, cx, cy, ang),
      kneeR: rotateAround(pose.kneeR, cx, cy, ang),
      footR: rotateAround(pose.footR, cx, cy, ang),
    };
  }
  return pose;
}

export const STICK = { HIP_Y, NECK_Y, HEAD_Y, HEAD_R };

export class Stickman extends Phaser.GameObjects.Graphics {
  constructor(scene, x, y, palette) {
    super(scene);
    this.x = x;
    this.y = y;
    this.facing = 1;
    this.palette = palette;
    this.glow = 0; // fist glow 0..1
    this.alpha = 1;       // Phaser GameObject alpha — left at 1 (see _alpha below).
    this._alpha = 1;      // manual draw alpha (flicker / death fade). Applied once
                          // inside render(); we don't also lower GameObject.alpha,
                          // which would double-multiply (a*a) and make flicker/fade
                          // fade to a^2 — far too faint.
    this.setDepth(10);
    scene.add.existing(this);
  }

  // Convert local (y-up) to graphics coords with facing flip.
  P(p) {
    return { x: p.x * this.facing, y: -p.y };
  }

  render(anim) {
    const pose = computePose(anim);
    const p = this.P.bind(this);
    const pal = this.palette;
    this.clear();

    const lw = 7;
    const limb = pal.limb;
    const joint = pal.joint;
    const a = this._alpha;
    // SECOND WIND: an optional limb mask lets a caller drop segments (e.g. the
    // shattered right arm during the broken last-stand). Each entry names the
    // two segment keys that should NOT be drawn.
    const mask = this.limbMask || {};
    const skip = (ka, kb) => !!(mask.dropRightArm && (ka === 'neck' && kb === 'elbowR' || ka === 'elbowR' && kb === 'handR'));

    // soft aura behind torso
    const torso = p(pose.neck);
    this.fillStyle(pal.accent, 0.10 * a);
    this.fillCircle(torso.x, torso.y + 6, 46);

    const hip = p(pose.hip), neck = p(pose.neck);
    const seg2 = (ka, kb, w, col, al) => {
      const A = p(pose[ka]), B = p(pose[kb]);
      this.lineStyle(w, col, al);
      this.strokeLineShape(new Phaser.Geom.Line(A.x, A.y, B.x, B.y));
    };

    // dark outline pass (pops against bg)
    const seg = (x, y) => { if (skip(x, y)) return; seg2(x, y, lw + 4, 0x05070d, a); };
    seg('hip', 'neck');
    seg('hip', 'kneeL'); seg('kneeL', 'footL');
    seg('hip', 'kneeR'); seg('kneeR', 'footR');
    seg('neck', 'elbowL'); seg('elbowL', 'handL');
    seg('neck', 'elbowR'); seg('elbowR', 'handR');

    // bright color pass
    const col = (x, y) => { if (skip(x, y)) return; seg2(x, y, lw, limb, a); };
    col('hip', 'neck');
    col('hip', 'kneeL'); col('kneeL', 'footL');
    col('hip', 'kneeR'); col('kneeR', 'footR');
    col('neck', 'elbowL'); col('elbowL', 'handL');
    col('neck', 'elbowR'); col('elbowR', 'handR');

    // joints
    this.fillStyle(joint, a);
    for (const j of [pose.kneeL, pose.kneeR, pose.elbowL, pose.elbowR, pose.hip]) {
      // hide the right elbow joint when the arm is gone
      if (mask.dropRightArm && j === pose.elbowR) continue;
      const q = p(j);
      this.fillCircle(q.x, q.y, lw * 0.5);
    }

    // head with outline
    const head = p(pose.head);
    this.lineStyle(4, 0x05070d, a);
    this.strokeCircle(head.x, head.y, HEAD_R + 1);
    this.lineStyle(lw, limb, a);
    this.strokeCircle(head.x, head.y, HEAD_R);
    this.fillStyle(pal.head, a * 0.22);
    this.fillCircle(head.x, head.y, HEAD_R - 2);
    // face: eye dot toward facing direction
    this.fillStyle(0x05070d, a);
    this.fillCircle(head.x + this.facing * 5, head.y - 2, 2.4);

    // fists with glow
    const drawFist = (pt, isAccent) => {
      const q = p(pt);
      const baseR = lw * 0.62;
      if (this.glow > 0.01 && isAccent) {
        this.fillStyle(pal.accent, this.glow * 0.4 * a);
        this.fillCircle(q.x, q.y, baseR + 12 * this.glow);
        this.fillStyle(pal.fist, (0.7 + 0.3 * this.glow) * a);
        this.fillCircle(q.x, q.y, baseR + 3 * this.glow);
      } else {
        this.fillStyle(joint, a);
        this.fillCircle(q.x, q.y, baseR);
      }
    };
    if (!mask.dropRightArm) drawFist(pose.handR, true);
    drawFist(pose.handL, false);

    // feet
    this.fillStyle(joint, a);
    const fL = p(pose.footL), fR = p(pose.footR);
    this.fillCircle(fL.x, fL.y, lw * 0.55);
    this.fillCircle(fR.x, fR.y, lw * 0.55);
  }
}
