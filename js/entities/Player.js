import { Stickman, computePose } from './Stickman.js';
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
    // OVERDRIVE: a player-built super meter. The scene adds to it on hits/kills/
    // taking damage, and consumes it when the player unleashes (GameScene._burst).
    // FIRST-MINUTE v2 (B1): start part-charged so the flagship player-chosen
    // climax lands inside the 60s window for casuals/mobile — was ~25-35s to
    // charge from 0, invisible to the at-risk segment. Seed + first-blood bonus
    // ≈ a ready Overdrive ~15-20s in for anyone who lands a hit.
    this.burst = CONFIG.BURST.START_METER || 0;
    this.burstMax = CONFIG.BURST.METER_MAX;
    // ICE PATCH: a short slip timer refreshed each frame by an ice hazard zone
    // while the player stands in it. While >0, ground traction + steer drop so
    // the player slides — a kinesthetic feel-change (no new system; the hazard
    // layer sets the flag, the player physics reads it).
    this.slipT = 0;
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
    // ANTICIPATION: a small dust puff at attack start reads as the player
    // planting their foot for the swing — sells the windup before the fist
    // even extends. Purely cosmetic; no physics effect.
    if (this.onGround && this.scene && this.scene.dustBurst) {
      this.scene.dustBurst(this.x - this.facing * 14, CONFIG.GROUND_Y, 5);
    }
    // SQUASH: anticipation squat — body widens and shortens for a frame to
    // store energy before the strike. The active-phase stretch below inverts
    // this, giving the silhouette a clear windup->release arc.
    if (CONFIG.FEEL && CONFIG.FEEL.STRETCH) {
      const w = CONFIG.FEEL.STRETCH.WINDUP;
      this.pushStretch(w.sx, w.sy);
    }
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
    if (this.slipT > 0) this.slipT -= dt;

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
      this.tickStretch(dt);
      // Once the corpse has fully faded there's nothing to see — stop issuing
      // the per-frame draw calls (every fill uses _alpha, so at 0 they're
      // invisible but still cost CPU/GPU). Clear once so no stale geometry
      // lingers, then idle until the scene transition. (Enemy._die destroys at
      // deadT>=1; the player is kept alive for scene/x references.)
      if (this._alpha > 0.001) this._render();
      else if (!this._clearedAfterDeath) { this.clear(); this._clearedAfterDeath = true; }
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
      // SQUASH-&-STRETCH: at the active-window peak the body elongates along
      // the strike axis — the "reaching" silhouette that sells the strike arc.
      // Fires once per swing on entry to the active phase so it doesn't fight
      // the natural ease-back in tickStretch.
      if (!a._activeStretched && a.t >= a.windup && CONFIG.FEEL && CONFIG.FEEL.STRETCH) {
        a._activeStretched = true;
        const s = CONFIG.FEEL.STRETCH.ACTIVE;
        // a kick extends along the horizontal axis more (foot reaches far);
        // a punch is a more compact forward thrust. We bias the stretch along x.
        this.pushStretch(a.type === 'kick' ? s.sx * 1.02 : s.sx, s.sy);
      }
      // friction on ground during attack
      this._physics(dt, true);
      // queue next attack near end of recover for combo feel handled by scene reading input
      if (a.t >= a.total) {
        this.attack = null;
        this.state = this.onGround ? 'idle' : 'jump';
      }
      this.tickStretch(dt);
      this._render();
      return;
    }

    if (this.state === 'hurt') {
      this.hurtTime += dt;
      this._physics(dt, true);
      if (this.hurtTime > 0.34 && this.onGround) {
        this.state = 'idle';
      }
      this.tickStretch(dt);
      this._render();
      return;
    }

    // ---- normal control ----
    // horizontal
    // SECOND WIND: the broken last-stand pumps move speed so a 1-HP player
    // can actually chase a heal drop or escape pressure.
    const speedMul = this.broken ? CONFIG.LASTSTAND.SPEED_MUL : 1;
    const target = input.dir * CONFIG.PLAYER.SPEED * speedMul;
    // ICE PATCH: while slippery, traction (friction) and steer (accel) both
    // drop sharply so the player keeps momentum and turns sluggishly — the
    // signature "slide on ice" feel. Pure multiplier, no new state machine.
    const slipping = this.slipT > 0 && this.onGround;
    const slipFr = slipping ? CONFIG.CONTENT.ENV.ICE.FRICTION_SCALE : 1;
    const slipAc = slipping ? CONFIG.CONTENT.ENV.ICE.ACCEL_SCALE : 1;
    const accel = (this.onGround ? CONFIG.PLAYER.ACCEL : CONFIG.PLAYER.AIR_ACCEL) * slipAc;
    if (input.dir !== 0) {
      this.vx += (target - this.vx) * clamp01(accel * dt / Math.max(1, Math.abs(target - this.vx)));
      this.vx = clamp(this.vx, -CONFIG.PLAYER.SPEED * speedMul, CONFIG.PLAYER.SPEED * speedMul);
      this.facing = input.dir;
    } else {
      const fr = CONFIG.PLAYER.FRICTION * slipFr * dt;
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

    this.tickStretch(dt);
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
          if (this.scene._shake) this.scene._shake(2.4, 0.14, 36, 0, 1);
          // SQUASH: a hard landing splats the body wide and short for a frame,
          // then rebounds — the classic impact silhouette. Pairs with the dust
          // + ring + zoom so the landing reads as a single weighted beat.
          if (CONFIG.FEEL && CONFIG.FEEL.STRETCH) {
            const s = CONFIG.FEEL.STRETCH.LAND;
            this.pushStretch(s.sx, s.sy);
          }
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
    // MOTION TRAIL: during a swing's active window, sample the striking limb
    // position each frame so the scene can draw a fading streak behind it.
    // Reads as motion blur and makes the strike arc readable at a glance. We
    // re-evaluate the pose here (cheap pure function) to get the limb point.
    if (this.attack && this.scene && this.scene._pushTrail) {
      const a = this.attack;
      const inActive = a.t >= a.windup && a.t <= a.windup + a.active;
      // also trail the early recover so the arc finishes naturally
      if (inActive || (a.t <= a.windup + a.active + 0.05)) {
        const pose = computePose(anim);
        const limb = a.type === 'kick' ? pose.footR : pose.handR;
        if (limb) {
          const wx = this.x + this.facing * limb.x;
          const wy = this.y - limb.y;
          const col = a.type === 'kick'
            ? (this.palette && this.palette.accent ? this.palette.accent : 0x35e1ff)
            : (this.palette && this.palette.fist ? this.palette.fist : 0xffe26b);
          this.scene._pushTrail(wx, wy, col, 'p:' + a.type);
        }
      }
    }
  }

  getAnimDebug() { return this.state; }
}

const STICK_NECK = 108;
