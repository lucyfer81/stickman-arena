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
    // SECOND WIND: once-per-run broken state. `broken` is active during the
    // last-stand window; `secondWindUsed` gates it to a single occurrence.
    this.broken = false;
    this.brokenT = 0;
    this.brokenMax = 1;
    this.secondWindUsed = false;
  }

  setPalette(p) { this.palette = p; }

  centerX() { return this.x; }
  bodyBox() {
    return { x: this.x - 26, y: this.y - STICK_NECK - 10, w: 52, h: STICK_NECK + 10 };
  }

  tryAttack(type, faceDir) {
    if (this.dead || this.state === 'hurt') return;
    if (this.attack) {
      // PUNCH -> KICK CANCEL: while a punch is in flight, a kick press flows
      // seamlessly into a kick instead of being dropped. This rewards mixing
      // attacks and turns mashing into a readable combo rhythm. (Kick is the
      // committed, whiff-punishable move and cannot itself be cancelled.)
      const canCancel = type === 'kick' && this.attack.type === 'punch';
      if (!canCancel) return;
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
      connected: false,  // set true by the scene on a hit -> drives whiff endlag
      whiffChecked: false,
    };
    this.state = type;
    if (type === 'punch') this.scene.audio && this.scene.audio.punch();
    else this.scene.audio && this.scene.audio.kick();
  }

  takeHit(dmg, fromX, knockback) {
    if (this.dead || this.invuln > 0) return false;
    this.health = Math.max(0, this.health - dmg);
    this.attack = null;
    // knockback away from the attacker; fall back to forward shove if they're
    // exactly overlapping (sign(0)===0 would otherwise cancel all horizontal kb).
    this.vx = (sign(this.x - fromX) || this.facing || 1) * knockback * 0.6;
    this.vy = -260;
    this.onGround = false;
    if (this.health <= 0) {
      // SECOND WIND: the first lethal blow shatters the stickman into a
      // 1-HP last stand instead of ending the run. The scene owns the
      // enter/reform/expire choreography; we just flip state + stay alive.
      if (!this.secondWindUsed && !this.broken) {
        this._enterBroken();
      } else {
        this.die();
      }
    } else {
      this.state = 'hurt';
      this.hurtTime = 0;
      this.invuln = CONFIG.PLAYER.HURT_INVULN;
      this.scene.audio && this.scene.audio.playerHurt();
    }
    return true;
  }

  // Enter the broken last-stand: clamp to 1 HP, grant entry i-frames, arm the
  // timer. The scene hooks _onEnterBroken/_onReform for feedback + HUD.
  _enterBroken() {
    const L = CONFIG.LASTSTAND;
    this.broken = true;
    this.secondWindUsed = true;
    this.health = 1;
    this.brokenMax = L.DURATION;
    this.brokenT = L.DURATION;
    this.invuln = L.ENTRY_INVULN;
    this.attack = null;
    this.state = 'idle';
    this.scene.audio && this.scene.audio.bigHit && this.scene.audio.bigHit();
    if (this.scene._onEnterBroken) this.scene._onEnterBroken();
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

    // SECOND WIND: tick the broken-window timer. Running out = real death.
    if (this.broken && !this.dead) {
      this.brokenT -= dt;
      if (this.brokenT <= 0) {
        this.brokenT = 0;
        this.die();
      }
    }

    if (this.dead) {
      this.deadT += dt / 0.7;
      this._physics(dt, false);
      this._alpha = clamp01(1 - (this.deadT - 0.7) * 2) * (this.invuln > 0 ? 0.5 : 1);
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
      // WHIFF PENALTY: exactly once, when the kick's active window ends without
      // connecting, switch to a longer recover. Blind kick-spam is therefore
      // punishable by dodging runners; a connecting kick recovers fast.
      if (a.type === 'kick' && !a.whiffChecked && a.t >= a.windup + a.active) {
        a.whiffChecked = true;
        if (!a.connected) {
          a.recover = a.cfg.RECOVER_WHIFF;
          a.total = a.windup + a.active + a.recover;
        }
      }
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
    // SECOND WIND: the broken last-stand pumps move speed so a 1-HP player
    // can actually chase a heal drop or escape pressure.
    const speedMul = this.broken ? CONFIG.LASTSTAND.SPEED_MUL : 1;
    const target = input.dir * CONFIG.PLAYER.SPEED * speedMul;
    const accel = this.onGround ? CONFIG.PLAYER.ACCEL : CONFIG.PLAYER.AIR_ACCEL;
    if (input.dir !== 0) {
      this.vx += (target - this.vx) * clamp01(accel * dt / Math.max(1, Math.abs(target - this.vx)));
      this.vx = clamp(this.vx, -CONFIG.PLAYER.SPEED * speedMul, CONFIG.PLAYER.SPEED * speedMul);
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
        this.scene.dustBurst && this.scene.dustBurst(this.x, CONFIG.GROUND_Y, Math.min(16, 6 + Math.floor(this.vy / 110)));
        if (this.vy > 720) {
          // hard landing: a small ground ring + zoom tick + snappier shake gives
          // the impact actual weight (was a near-imperceptible 0.004 shake).
          if (this.scene._impactRing) this.scene._impactRing(this.x, CONFIG.GROUND_Y - 6, 0x6b86a3, { life: 0.18, maxR: 40, width: 3 });
          if (this.scene._punchZoom) this.scene._punchZoom(0.014, 0, 0);
          this.scene.cameras.main.shake(70, 0.008);
        }
      }
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  _render() {
    let anim;
    this.glow = 0; // default off; attack branch below lights the fist only mid-swing
    if (this.dead) {
      anim = { state: 'dead', time: this.animTime, deadT: this.deadT };
    } else if (this.state === 'punch' || this.state === 'kick') {
      // ANTICIPATION: the fist glow ramps up through the windup (charging),
      // peaks white-hot through the active window, then fades in recover. This
      // telegraphs the committed swing visually — no timing/damage change.
      const a = this.attack;
      let g = 0.4;
      if (a) {
        if (a.t < a.windup) g = 0.25 + 0.6 * clamp01(a.t / a.windup);
        else if (a.t <= a.windup + a.active) g = 1;
        else g = 0.5 - 0.3 * clamp01((a.t - a.windup - a.active) / a.recover);
      }
      this.glow = g;
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
      this._alpha = (Math.floor(this.animTime * 30) % 2 === 0) ? 0.4 : 1;
    } else if (!this.dead) {
      this._alpha = 1;
    }
    // SECOND WIND: while broken, the right arm is gone (it shattered off) and
    // the body reads cracked/red-rimmed. We signal the arm loss via a limb
    // mask on the pose so the base renderer skips those segments.
    this.limbMask = this.broken ? { dropRightArm: true } : null;
    this.render(anim);
  }

  getAnimDebug() { return this.state; }
}

const STICK_NECK = 108;
