import { Stickman } from './Stickman.js';
import { CONFIG } from '../config.js';
import { clamp, clamp01, sign, rand } from '../utils/math.js';

const NECK = 108;

const VARIANTS = {
  grunt: {
    palette: { limb: 0xff6f5c, joint: 0xffb4a8, head: 0xffd2c9, accent: 0xff3b30, fist: 0xff8a3d },
    health: 30, speed: 150, damage: 9, scale: 1.0, score: 100, attackReach: 80,
  },
  runner: {
    palette: { limb: 0x6bff9e, joint: 0xb3ffd2, head: 0xd9ffe9, accent: 0x16c45a, fist: 0x9aff6b },
    health: 20, speed: 250, damage: 7, scale: 0.92, score: 150, attackReach: 78,
  },
  brute: {
    palette: { limb: 0xb06bff, joint: 0xd9b3ff, head: 0xecd9ff, accent: 0x8b2fff, fist: 0xd36bff },
    health: 70, speed: 110, damage: 16, scale: 1.22, score: 250, attackReach: 92,
  },
  leaper: {
    // anti-air: dives at the player to punish pure jump-spam. Fragile but its
    // committed leap is tall enough to catch an airborne target.
    palette: { limb: 0xffb02e, joint: 0xffd98a, head: 0xffeec0, accent: 0xff7a00, fist: 0xffe26b },
    health: 24, speed: 195, damage: 13, scale: 0.96, score: 220, attackReach: 96,
  },
};

export class Enemy extends Stickman {
  constructor(scene, x, y, variant = 'grunt') {
    const v = VARIANTS[variant];
    super(scene, x, y, v.palette);
    this.variant = variant;
    this.v = v;
    this.setScale(v.scale);
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.maxHealth = v.health;
    this.health = v.health;
    this.state = 'idle';
    this.facing = -1;
    this.animTime = rand(0, 10);
    this.attack = null;
    this.hurtTime = 0;
    this.dead = false;
    this.deadT = 0;
    this.flashTime = 0;
    this.attackCd = rand(0.4, 1.2);
    this.firstStrike = true; // first swing within range commits immediately
    this.id = ++Enemy._idc;
    this.active = true;
    this.speedMul = 1;
    this.hpMul = 1;
    this.dmgMul = 1;
    this.aggrMul = 1;     // wave-dependent aggression (lower recover/cooldown)
    this.flankDir = 1;    // desired side relative to player (+1 right / -1 left)
  }

  bodyBox() {
    const s = this.scale;
    return { x: this.x - 26 * s, y: this.y - NECK * s - 10, w: 52 * s, h: NECK * s + 10 };
  }

  takeHit(dmg, fromX, kb, pause) {
    if (this.dead) return false;
    this.health -= dmg;
    this.flashTime = 0.12;
    const dir = sign(this.x - fromX) || 1;
    const heavy = kb > 400; // kick (heavy) is the universal interrupt — skill reward
    // a kill always applies, regardless of armor
    if (this.health <= 0) { this._die(dir); return true; }

    const phase = this.attack && this.attack.phase;
    if (heavy) {
      // heavy hits break anything except a kill — full knockback + flinch.
      // Reset the windup glow so the flinched enemy doesn't keep a glowing fist.
      this.attack = null; this.glow = 0;
      this.vx = dir * kb; this.vy = -200; this.onGround = false; this.facing = -dir;
      this.state = 'hurt'; this.hurtTime = 0;
      return true;
    }
    if (phase === 'windup' || phase === 'active') {
      // HYPER-ARMOR: a committed, telegraphed swing plants the feet — accumulated
      // light hits cannot shove it out of its own strike. Kick or dodge instead.
      this.vx = 0;
      return true;
    }
    if (phase === 'recover') {
      // PUNISH WINDOW: right after a swing, the enemy is fully interruptible.
      // This is when light attacks create space / start combos.
      this.attack = null; this.glow = 0;
      this.vx = dir * kb; this.vy = -200; this.onGround = false; this.facing = -dir;
      this.state = 'hurt'; this.hurtTime = 0;
      return true;
    }
    // approaching / idle: light chip damage but minimal stall — the enemy keeps
    // closing to commit range. Mashing punch cannot stunlock the approach.
    this.vx = dir * kb * 0.05;
    return true;
  }

  _die(dir) {
    this.dead = true;
    this.state = 'dead';
    this.deadT = 0;
    this.vx = dir * 220;
    this.vy = -360;
    this.active = false;
    this.scene.audio && this.scene.audio.enemyDie();
  }

  getHitbox(player) {
    if (!this.attack || this.dead) return null;
    const a = this.attack;
    if (a.phase !== 'active') return null;
    const reach = this.v.attackReach;
    if (a.leap) {
      // tall, body-following hitbox so a jumping target gets caught mid-dive
      const w = 86, h = 176;
      return { x: this.x - w / 2, y: this.y - NECK * this.scale - h * 0.5, w, h, dmg: Math.round(this.v.damage * this.dmgMul), kb: CONFIG.ENEMY.KNOCKBACK, from: this.x };
    }
    const cx = this.x + this.facing * (reach * 0.5 + 6);
    const w = reach;
    const h = 104; // tall enough that a low hop won't fully sidestep the swing
    return { x: cx - w / 2, y: this.y - NECK * this.scale - h * 0.42, w, h, dmg: Math.round(this.v.damage * this.dmgMul), kb: CONFIG.ENEMY.KNOCKBACK, from: this.x };
  }

  update(dt, player) {
    this.animTime += dt;
    if (this.flashTime > 0) this.flashTime -= dt;

    if (this.dead) {
      this.deadT += dt / 0.7;
      this._physics(dt);
      this._alpha = clamp01(1 - (this.deadT - 0.6) * 2.5);
      this._render();
      if (this.deadT >= 1) this._destroy();
      return;
    }

    if (this.attack) {
      this._progressAttack(dt);
      this._physics(dt);
      this._render();
      return;
    }

    if (this.state === 'hurt') {
      this.hurtTime += dt;
      this._physics(dt);
      if (this.hurtTime > 0.26 && this.onGround) this.state = 'idle';
      this._render();
      return;
    }

    // AI — flank the player: each enemy claims a slot on alternating sides so
    // they surround instead of stacking on one side.
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    this.facing = sign(dx) || this.facing;

    const reach = this.v.attackReach;
    // desired stand position on the enemy's assigned flank side
    const desiredX = player.x + this.flankDir * reach * 0.55;
    const standoff = Math.abs(this.x - desiredX);
    // leaper commits from farther out (it dives to close the gap)
    const commitRange = reach * (this.variant === 'leaper' ? 1.15 : 0.82);

    if (dist > commitRange || standoff > 30) {
      // reposition toward the flank slot (keeps enemies on both sides)
      const tx = standoff > 30 && dist <= commitRange * 1.5 ? desiredX : player.x;
      const dir = sign(tx - this.x) || sign(dx) || 1;
      this.vx += (dir * this.v.speed * this.speedMul - this.vx) * clamp01(8 * dt);
      this.state = this.onGround ? 'run' : 'jump';
    } else {
      this.vx *= clamp01(1 - 10 * dt);
      // first strike commits immediately so the player can't stall it with mash;
      // later swings are gated by attackCd. Only consume the first strike when an
      // attack actually starts — airborne enemies keep it for when they land.
      // (Same-flank overlap is intentionally left as-is: it gives the player an
      // emergent cleave window, and the 0.5s hurt-invlun + one-hit-per-frame rule
      // means stacked simultaneous swings still only land once. Spreading them out
      // removed that window and over-pressured jump-spam in wave-6 testing.)
      if (this.onGround && (this.firstStrike || this.attackCd <= 0)) {
        this._startAttack();
        this.firstStrike = false;
      } else if (!this.onGround) {
        // hold the first strike until grounded
      } else {
        this.attackCd -= dt;
      }
      this.state = this.onGround ? 'idle' : 'jump';
    }
    this._physics(dt);
    this._render();
  }

  // (No boids separation: see note in update(). Same-flank clustering is left
  // intact to preserve the player's emergent cleave + the tuned difficulty.)

  _startAttack() {
    const aggr = this.aggrMul;
    const windupFloor = CONFIG.ENEMY.ATTACK_WINDUP * 0.62; // keep it readable
    const leap = this.variant === 'leaper';
    this.attack = {
      phase: 'windup',
      t: 0,
      leap,
      windup: Math.max(windupFloor, CONFIG.ENEMY.ATTACK_WINDUP * (this.variant === 'brute' ? 1.15 : 1) / aggr),
      active: leap ? 0.4 : CONFIG.ENEMY.ATTACK_ACTIVE,
      recover: CONFIG.ENEMY.ATTACK_RECOVER * (this.variant === 'brute' ? 1.25 : 1) / aggr,
    };
    this.state = 'punch';
  }

  _progressAttack(dt) {
    const a = this.attack;
    a.t += dt;
    if (a.phase === 'windup') {
      // visible "charge": fist glow ramps up so the player reads the committed swing
      this.glow = clamp01(a.t / a.windup) * 0.9;
      if (a.t >= a.windup) {
        a.phase = 'active'; a.t = 0; this.glow = 1;
        if (a.leap) {
          // ANTI-AIR DIVE: launch toward the player's current position. The arc
          // + tall hitbox catches jump-spammers who'd otherwise be untouchable.
          this.vx = this.facing * 460;
          this.vy = -840;
          this.onGround = false;
        } else {
          // LUNGE: commit forward so the swing reaches a backing/dodging target.
          const lunge = (this.variant === 'brute' ? 180 : 240) + this.aggrMul * 60;
          this.vx = this.facing * lunge;
        }
      }
    }
    else if (a.phase === 'active' && a.t >= a.active) { a.phase = 'recover'; a.t = 0; this.glow = 0.3; }
    else if (a.phase === 'recover' && a.t >= a.recover) {
      this.attack = null;
      this.attackCd = rand(0.35, 0.85) / this.aggrMul;
      this.glow = 0;
      this.state = this.onGround ? 'idle' : 'jump';
    }
  }

  _physics(dt) {
    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < CONFIG.WALL_LEFT) { this.x = CONFIG.WALL_LEFT; this.vx = 0; }
    if (this.x > CONFIG.WALL_RIGHT) { this.x = CONFIG.WALL_RIGHT; this.vx = 0; }
    if (this.y >= CONFIG.GROUND_Y) {
      this.y = CONFIG.GROUND_Y;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    // friction on ground when not actively chasing handled in AI
    if (this.onGround && (this.state === 'idle' || this.state === 'punch' || this.state === 'hurt')) {
      this.vx *= clamp01(1 - 8 * dt);
    }
  }

  _render() {
    let anim;
    if (this.dead) {
      anim = { state: 'dead', time: this.animTime, deadT: this.deadT };
    } else if (this.attack && this.attack.leap) {
      // a diving leaper reads as an airborne tuck, not a grounded punch
      anim = { state: 'jump', vy: -this.vy };
    } else if (this.attack) {
      anim = { state: 'punch', phase: this._attackPhase01() };
    } else if (this.state === 'hurt') {
      anim = { state: 'hurt', time: this.hurtTime };
    } else if (this.state === 'run') {
      anim = { state: 'run', time: this.animTime };
    } else {
      anim = { state: 'idle', time: this.animTime };
    }
    this.render(anim);
    // hit flash overlay — a soft white disc + thin ring over the torso so the
    // player reads that the strike landed (the lineStyle was previously set but
    // never stroked, so the ring was missing entirely).
    if (this.flashTime > 0) {
      const fa = clamp01(this.flashTime / 0.12);
      this.fillStyle(0xffffff, fa * 0.5);
      this.fillCircle(0, -60 * this.scale, 40 * this.scale);
      this.lineStyle(3, 0xffffff, fa);
      this.strokeCircle(0, -60 * this.scale, 40 * this.scale);
    }
  }

  _attackPhase01() {
    const a = this.attack;
    if (a.phase === 'windup') return 0.1;
    if (a.phase === 'active') return 0.5;
    return 0.9;
  }

  _destroy() {
    this.destroy();
  }
}
Enemy._idc = 0;

export { VARIANTS };
