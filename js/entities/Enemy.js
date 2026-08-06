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
    this.id = ++Enemy._idc;
    this.active = true;
  }

  bodyBox() {
    const s = this.scale;
    return { x: this.x - 26 * s, y: this.y - NECK * s - 10, w: 52 * s, h: NECK * s + 10 };
  }

  takeHit(dmg, fromX, kb, pause) {
    if (this.dead) return false;
    this.health -= dmg;
    this.flashTime = 0.12;
    this.attack = null;
    const dir = sign(this.x - fromX) || 1;
    this.vx = dir * kb;
    this.vy = -200;
    this.onGround = false;
    this.facing = -dir;
    if (this.health <= 0) {
      this._die(dir);
    } else {
      this.state = 'hurt';
      this.hurtTime = 0;
    }
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
    const cx = this.x + this.facing * (reach * 0.5 + 6);
    const w = reach;
    const h = 80;
    return { x: cx - w / 2, y: this.y - NECK * this.scale - h * 0.4, w, h, dmg: this.v.damage, kb: CONFIG.ENEMY.KNOCKBACK, from: this.x };
  }

  update(dt, player) {
    this.animTime += dt;
    if (this.flashTime > 0) this.flashTime -= dt;

    if (this.dead) {
      this.deadT += dt / 0.7;
      this._physics(dt);
      this.alpha = clamp01(1 - (this.deadT - 0.6) * 2.5);
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

    // AI
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    this.facing = sign(dx) || this.facing;

    const stopDist = this.v.attackReach * 0.62;
    if (dist > stopDist) {
      const dir = sign(dx);
      this.vx += (dir * this.v.speed - this.vx) * clamp01(8 * dt);
      this.state = this.onGround ? 'run' : 'jump';
    } else {
      this.vx *= clamp01(1 - 10 * dt);
      this.attackCd -= dt;
      if (this.attackCd <= 0 && this.onGround) {
        this._startAttack();
      }
      this.state = this.onGround ? 'idle' : 'jump';
    }
    this._physics(dt);
    this._render();
  }

  _startAttack() {
    const v = this.v;
    this.attack = {
      phase: 'windup',
      t: 0,
      windup: CONFIG.ENEMY.ATTACK_WINDUP * (this.variant === 'brute' ? 1.15 : 1),
      active: CONFIG.ENEMY.ATTACK_ACTIVE,
      recover: CONFIG.ENEMY.ATTACK_RECOVER,
    };
    this.state = 'punch';
  }

  _progressAttack(dt) {
    const a = this.attack;
    a.t += dt;
    if (a.phase === 'windup' && a.t >= a.windup) { a.phase = 'active'; a.t = 0; this.glow = 1; }
    else if (a.phase === 'active' && a.t >= a.active) { a.phase = 'recover'; a.t = 0; this.glow = 0.3; }
    else if (a.phase === 'recover' && a.t >= a.recover) {
      this.attack = null;
      this.attackCd = rand(0.5, 1.3);
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
    // hit flash overlay
    if (this.flashTime > 0) {
      const fa = clamp01(this.flashTime / 0.12);
      this.lineStyle(8, 0xffffff, fa);
      // redraw roughly over body via a translucent circle
      this.fillStyle(0xffffff, fa * 0.5);
      this.fillCircle(0, -60 * this.scale, 40 * this.scale);
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
