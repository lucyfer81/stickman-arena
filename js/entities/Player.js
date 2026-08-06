import { Stickman } from './Stickman.js';
import { CONFIG, COLORS } from '../config.js';
import { clamp, clamp01, easeOut, easeIn, sign } from '../utils/math.js';

export class Player extends Stickman {
  constructor(scene, x, y) {
    super(scene, x, y, COLORS.player);
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.maxHealth = CONFIG.PLAYER.MAX_HEALTH;
    this.health = this.maxHealth;
    this.state = 'idle';
    this.facing = 1;
    this.animTime = 0;
    this.attack = null; // { type, t, total, windup, active, recover, peakTime, phase, swingId }
    this.swingId = 0;
    this.hurtTime = 0;
    this.invuln = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpCut = false;
    this.dead = false;
    this.deadT = 0;
  }

  setPalette(p) { this.palette = p; }

  centerX() { return this.x; }
  bodyBox() {
    return { x: this.x - 26, y: this.y - STICK_NECK - 10, w: 52, h: STICK_NECK + 10 };
  }

  tryAttack(type, faceDir) {
    if (this.dead || this.state === 'hurt') return;
    if (this.attack) {
      // allow combo chain into kick near end of punch (light cancel), keep simple: no cancel
      return;
    }
    const C = type === 'kick' ? CONFIG.PLAYER.KICK : CONFIG.PLAYER.PUNCH;
    if (faceDir !== 0) this.facing = faceDir;
    this.swingId++;
    this.attack = {
      type,
      t: 0,
      windup: C.WINDUP,
      active: C.ACTIVE,
      recover: C.RECOVER,
      total: C.WINDUP + C.ACTIVE + C.RECOVER,
      peakTime: C.WINDUP + C.ACTIVE * 0.5,
      phase: 0,
      cfg: C,
    };
    this.state = type;
    if (type === 'punch') this.scene.audio && this.scene.audio.punch();
    else this.scene.audio && this.scene.audio.kick();
  }

  takeHit(dmg, fromX, knockback) {
    if (this.dead || this.invuln > 0) return false;
    this.health = Math.max(0, this.health - dmg);
    this.attack = null;
    this.vx = sign(this.x - fromX) * knockback * 0.6;
    this.vy = -260;
    this.onGround = false;
    if (this.health <= 0) {
      this.die();
    } else {
      this.state = 'hurt';
      this.hurtTime = 0;
      this.invuln = CONFIG.PLAYER.HURT_INVULN;
      this.scene.audio && this.scene.audio.playerHurt();
    }
    return true;
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.deadT = 0;
    this.health = 0;
    this.vx = sign(this.vx || -this.facing) * 120;
    this.vy = -300;
  }

  getHitbox() {
    if (!this.attack) return null;
    const a = this.attack;
    if (a.t < a.windup || a.t > a.windup + a.active) return null;
    const C = a.cfg;
    const cx = this.x + this.facing * (C.REACH * 0.5 + 10);
    const w = C.REACH;
    const h = C.HEIGHT;
    return { x: cx - w / 2, y: this.y - STICK_NECK - h * 0.5 - 6, w, h, swing: this.swingId, dmg: C.DAMAGE, kb: C.KNOCKBACK, pause: C.HIT_PAUSE, from: this.x };
  }

  update(dt, input) {
    this.animTime += dt;
    if (this.invuln > 0) this.invuln -= dt;

    if (this.dead) {
      this.deadT += dt / 0.7;
      this._physics(dt, false);
      this.alpha = clamp01(1 - (this.deadT - 0.7) * 2) * (this.invuln > 0 ? 0.5 : 1);
      this._render();
      return;
    }

    // attack progression takes over (no new movement input driving state)
    if (this.attack) {
      const a = this.attack;
      a.t += dt;
      // compute pose phase
      if (a.t <= a.peakTime) a.phase = 0.5 * (a.t / a.peakTime);
      else a.phase = 0.5 + 0.5 * clamp01((a.t - a.peakTime) / (a.total - a.peakTime));
      // friction on ground during attack
      this._physics(dt, true);
      // queue next attack near end of recover for combo feel handled by scene reading input
      if (a.t >= a.total) {
        this.attack = null;
        this.state = this.onGround ? 'idle' : 'jump';
      }
      this._render();
      return;
    }

    if (this.state === 'hurt') {
      this.hurtTime += dt;
      this._physics(dt, true);
      if (this.hurtTime > 0.34 && this.onGround) {
        this.state = 'idle';
      }
      this._render();
      return;
    }

    // ---- normal control ----
    // horizontal
    const target = input.dir * CONFIG.PLAYER.SPEED;
    const accel = this.onGround ? CONFIG.PLAYER.ACCEL : CONFIG.PLAYER.AIR_ACCEL;
    if (input.dir !== 0) {
      this.vx += (target - this.vx) * clamp01(accel * dt / Math.max(1, Math.abs(target - this.vx)));
      this.vx = clamp(this.vx, -CONFIG.PLAYER.SPEED, CONFIG.PLAYER.SPEED);
      this.facing = input.dir;
    } else {
      const fr = CONFIG.PLAYER.FRICTION * dt;
      if (Math.abs(this.vx) <= fr) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * fr;
    }

    // jump buffering / coyote
    this.coyote = this.onGround ? CONFIG.PLAYER.COYOTE_TIME : this.coyote - dt;
    if (input.jumpPressed) this.jumpBuffer = CONFIG.PLAYER.JUMP_BUFFER;
    else this.jumpBuffer -= dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -CONFIG.PLAYER.JUMP_VEL;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumpCut = false;
      this.scene.audio && this.scene.audio.jump();
    }
    if (!input.jumpHeld && this.vy < 0 && !this.jumpCut) {
      this.vy *= 0.5;
      this.jumpCut = true;
    }

    this._physics(dt, false);

    // state
    if (!this.onGround) this.state = 'jump';
    else if (Math.abs(this.vx) > 12) this.state = 'run';
    else this.state = 'idle';

    this._render();
  }

  _physics(dt, frozen) {
    if (!frozen) {
      // gravity already applied via vy in update; ensure gravity applied here uniformly
    }
    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // walls
    if (this.x < CONFIG.WALL_LEFT) { this.x = CONFIG.WALL_LEFT; this.vx = 0; }
    if (this.x > CONFIG.WALL_RIGHT) { this.x = CONFIG.WALL_RIGHT; this.vx = 0; }
    // ground
    const wasAir = !this.onGround;
    if (this.y >= CONFIG.GROUND_Y) {
      this.y = CONFIG.GROUND_Y;
      if (this.vy > 420 && wasAir) {
        this.scene.audio && this.scene.audio.land();
        this.scene.dustBurst && this.scene.dustBurst(this.x, CONFIG.GROUND_Y, Math.min(14, 6 + Math.floor(this.vy / 120)));
        if (this.vy > 760) this.scene.cameras.main.shake(60, 0.004);
      }
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  _render() {
    let anim;
    if (this.dead) {
      anim = { state: 'dead', time: this.animTime, deadT: this.deadT };
    } else if (this.state === 'punch' || this.state === 'kick') {
      this.glow = (this.attack && this.attack.t >= this.attack.windup && this.attack.t <= this.attack.windup + this.attack.active) ? 1 : 0.35;
      anim = { state: this.state, phase: this.attack ? this.attack.phase : 0 };
    } else if (this.state === 'hurt') {
      anim = { state: 'hurt', time: this.hurtTime };
    } else if (this.state === 'jump') {
      anim = { state: 'jump', vy: -this.vy };
    } else if (this.state === 'run') {
      anim = { state: 'run', time: this.animTime };
    } else {
      anim = { state: 'idle', time: this.animTime };
    }
    // flicker when invuln
    if (this.invuln > 0 && !this.dead) {
      this.alpha = (Math.floor(this.animTime * 30) % 2 === 0) ? 0.4 : 1;
    } else if (!this.dead) {
      this.alpha = 1;
    }
    this.render(anim);
  }

  getAnimDebug() { return this.state; }
}

const STICK_NECK = 108;
