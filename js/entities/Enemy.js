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
  vanguard: {
    // early-game mini-elite (retention): one spawns as wave 2's first enemy to
    // give a short 6-8s "duel" climax inside the first minute, before the wave-5
    // boss. Tougher/grittier than a grunt but not a boss — beats the "first
    // minute is the least exciting part" churn point.
    palette: { limb: 0xffd23f, joint: 0xffea99, head: 0xfff5cc, accent: 0xff9b00, fist: 0xffffff },
    health: 50, speed: 132, damage: 11, scale: 1.25, score: 300, attackReach: 86,
  },
  shielder: {
    // riot guard: holds a frontal shield that BLOCKS light hits (punches). A kick
    // (heavy) shatters the guard for ~1s, opening a punish window. Teaches the
    // player to mix in kicks and to flank — pure punch-spam bounces off.
    palette: { limb: 0x7fb8d6, joint: 0xb6dcec, head: 0xdaf2ff, accent: 0x2f8fbf, fist: 0xeaf4ff },
    health: 55, speed: 120, damage: 12, scale: 1.15, score: 320, attackReach: 82,
  },
  bomber: {
    // volatile suicide unit: rushes in, ignites a short fuse near the player, and
    // detonates a lingering ground-fire zone. Fragile, but its blast also hurts
    // other enemies — fun emergent chain reactions. Spacing/jumping beats it.
    palette: { limb: 0xff9a3d, joint: 0xffc98a, head: 0xffe6c2, accent: 0xff3b30, fist: 0xffe26b },
    health: 18, speed: 168, damage: 8, scale: 0.95, score: 240, attackReach: 70,
  },
  ranger: {
    // ranged kiter: keeps its distance and lobs arcing projectiles. Forces the
    // player to close ground instead of turtling. Retreats when rushed.
    palette: { limb: 0xff5cb0, joint: 0xff9ecf, head: 0xffd0e6, accent: 0xd62f8a, fist: 0xffe26b },
    health: 26, speed: 140, damage: 10, scale: 0.98, score: 280, attackReach: 80,
  },
  charger: {
    // commitment dash: a telegraphed horizontal charge that locks in and races
    // across the floor. Punishes turtling / standing still — the counter is to
    // jump or step aside (it can't steer mid-charge). Mini version of the boss
    // armor pattern: once committed, only a kill or dodge stops it.
    palette: { limb: 0xc0392b, joint: 0xe8a59c, head: 0xf5cdc6, accent: 0x7d1d12, fist: 0xffd23f },
    health: 44, speed: 130, damage: 14, scale: 1.1, score: 260, attackReach: 70,
  },
  medic: {
    // support: channels a heal to the lowest-HP nearby ally, sustaining the
    // pack. Creates a target-priority decision — ignore it and enemies won't
    // die; rush it and the rest collapse on you. Weak melee as self-defense.
    palette: { limb: 0xeaf4ff, joint: 0xbfe3ff, head: 0xffffff, accent: 0x35e1ff, fist: 0x6bff9e },
    health: 30, speed: 135, damage: 6, scale: 1.0, score: 320, attackReach: 70,
  },
  splitter: {
    // tanky melee that fissures on death into two spawnlings. Rewards overkill
    // (a clean kill limits the adds) and seeds emergent crowd pressure. Reads
    // as a rocky bruiser so the player anticipates the split.
    palette: { limb: 0xb58860, joint: 0xd9b48a, head: 0xe8cda8, accent: 0x7a5a36, fist: 0xffd23f },
    health: 40, speed: 120, damage: 10, scale: 1.15, score: 200, attackReach: 78,
  },
  spawnling: {
    // the weak, fast mini-grunt produced by a splitter death. Small, fragile,
    // and aggressive — a splitter kill trades one threat for two smaller ones
    // unless overkilled. Only spawned by splitter._die(), never from waves.
    palette: { limb: 0xd9b48a, joint: 0xe8cda8, head: 0xf5e2c6, accent: 0x7a5a36, fist: 0xffe26b },
    health: 12, speed: 210, damage: 6, scale: 0.7, score: 80, attackReach: 64,
  },
  boss: {
    // elite climactic enemy for boss waves (every 5th wave). Big, tough, and
    // performs a telegraphed ground-slam whose shockwaves must be jumped.
    palette: { limb: 0xff3b30, joint: 0xffb4a8, head: 0xffe0d8, accent: 0xffd23f, fist: 0xff8a3d },
    health: 220, speed: 95, damage: 18, scale: 1.6, score: 1500, attackReach: 120,
  },
  bossCaster: {
    // Boss variant B ("The Oracle"): a ranged caster that alternates with the
    // slammer on even boss-index waves. Its special is a telegraphed lobbed
    // projectile barrage (dodge by moving/jumping) instead of a ground-slam.
    // Shares the HP bar / enrage / kill-payoff infra; `isBoss` is true for both.
    palette: { limb: 0x9aff6b, joint: 0xc6ffae, head: 0xe6ffd2, accent: 0x16c45a, fist: 0xeaf4ff },
    health: 200, speed: 108, damage: 16, scale: 1.45, score: 1500, attackReach: 110,
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
    this.passive = false;    // training dummy: holds its swing until provoked/grace
    this.passiveT = 0;
    this.sprintT = 0;        // entrance sprint: briefly boosts approach speed so
                             // wall-spawned enemies don't leave a walk-up dead gap
    this.id = ++Enemy._idc;
    this.active = true;
    this.speedMul = 1;
    this.hpMul = 1;
    this.dmgMul = 1;
    this.aggrMul = 1;     // wave-dependent aggression (lower recover/cooldown)
    this.swarmMul = 1;    // live pack-pressure aggression bonus (crowds attack faster)
    this.swarmSpeedMul = 1; // live pack-pressure move-speed bonus
    this.flankDir = 1;    // desired side relative to player (+1 right / -1 left)
    // boss-only state
    this.isBoss = variant === 'boss' || variant === 'bossCaster';
    this.bossKind = variant === 'bossCaster' ? 'caster' : 'slammer';
    this.enraged = false;
    this.slam = null;     // { phase: 'windup'|'leap'|'recover', t } (slammer)
    this.cast = null;     // { phase: 'windup'|'recover', t } (caster barrage)
    this.slamCd = this.isBoss ? 2.0 : 0;  // first slam after a brief grace
    this.castCd = this.isBoss ? 2.2 : 0;  // first barrage after a brief grace
    // shielder guard state — down for GUARD_BREAK_TIME after a heavy hit lands
    this.guardBroken = 0;
    // bomber fuse state — { t } once close enough; detonates at FUSE_TIME
    this.fuse = null;
    this.lifeT = 0;             // seconds alive (bombers auto-detonate past a threshold)
    this.detonated = false;     // idempotency guard so a bomber blasts exactly once
    // ranged throw state for rangers — cooldown + windup timer
    this.throwCd = rand(1.0, 2.0);
    this.throw = null;     // { phase: 'windup'|'recover', t, windup }
    // charger dash state — a committed horizontal charge (mini boss-pattern).
    this.charge = null;    // { phase: 'windup'|'dash'|'recover', t, dir }
    this.chargeCd = this.variant === 'charger' ? rand(1.6, 3.0) : 0;
    // medic support state — channels a heal pulse to the lowest-HP nearby ally.
    this.heal = null;      // { phase: 'windup'|'recover', t, target }
    this.healCd = this.variant === 'medic' ? rand(2.0, 3.5) : 0;
    // MERCY 「The Coward's End」 — the last living enemy of a non-boss wave may
    // surrender (kneel + white flag) and let the player choose spare/kill/ignore.
    // phases: 'kneel' (transition in) -> 'wait' (choice window) -> 'bow' (spared)
    // -> 'depart' (walking off) -> 'flee' (running off). The scene owns trigger
    // gating + the spare/kill payoff; the enemy owns pose/movement/flag drawing.
    this.surrender = null;
    this.departed = false;     // true once it has been spared or is fleeing: the
                               // wave-clear filter excludes it so the exit anim
                               // plays during the between-wave break, not before
  }

  bodyBox() {
    // use the BASE scale (not the live scaleX, which is currently base*squash
    // during a squash-&-stretch deformation) so hit detection stays stable
    // through impact frames — a squashed body mustn't become harder to hit.
    const s = this._baseScaleX || this.scale || 1;
    return { x: this.x - 26 * s, y: this.y - NECK * s - 10, w: 52 * s, h: NECK * s + 10 };
  }

  // MERCY: a spared / fleeing enemy is invulnerable to ALL damage paths (melee,
  // Overdrive AoE) so its exit animation plays untouched. The kneel/wait window
  // stays hittable (the KILL choice). Centralized here so combat + burst agree.
  isHittable() {
    if (this.dead) return false;
    if (this.surrender && (this.surrender.phase === 'bow' || this.surrender.phase === 'depart' || this.surrender.phase === 'flee')) return false;
    return true;
  }

  takeHit(dmg, fromX, kb, pause) {
    if (this.dead) return false;
    // MERCY: once the enemy has been SPARED (bow/depart) or is fleeing, it's
    // invulnerable — the player already made their choice; the exit animation
    // plays out untouched. Only the kneel/wait window can still be ended by an
    // attack (the KILL path).
    if (this.surrender && (this.surrender.phase === 'bow' || this.surrender.phase === 'depart' || this.surrender.phase === 'flee')) {
      return false;
    }
    const heavy = kb > 400; // kick (heavy) is the universal interrupt — skill reward

    // SHIELDER GUARD: a raised frontal shield nullifies light hits from the
    // front. The player must either kick (heavy shatters the guard for ~1s) or
    // flank. A guard that's already broken, or a hit from behind, connects.
    if (this.variant === 'shielder' && this.guardBroken <= 0 && !heavy) {
      const frontal = sign(fromX - this.x) === this.facing;
      if (frontal) {
        // blocked: no damage, a clang spark + tiny chip shove. The shove keeps
        // the enemy reachable so the player can't pin it out of range.
        this.flashTime = 0.10;
        const dir = sign(this.x - fromX) || 1;
        this.vx = dir * CONFIG.CONTENT.SHIELDER.GUARD_SHOVE;
        if (this.scene.audio) this.scene.audio.hit();
        if (this.scene._blockSpark) this.scene._blockSpark(this.x + this.facing * 30, this.y - 70 * this.scale);
        return true;
      }
    }
    // a landed heavy hit on a shielder breaks its guard for a punish window.
    if (this.variant === 'shielder' && heavy) {
      this.guardBroken = CONFIG.CONTENT.SHIELDER.GUARD_BREAK_TIME;
    }
    this.guardBroken = Math.max(0, this.guardBroken); // (decremented in update)

    // FIRST-TIME ASSIST: the training dummy drops its truce the instant the
    // player lands a real hit — provocation ends the safe window so the teachable
    // dummy still fights back once the lesson (press J) has landed.
    this.passive = false;

    this.health -= dmg;
    this.flashTime = 0.14; // slightly longer so the chromatic edges of the new flash read
    const dir = sign(this.x - fromX) || 1;
    // SQUASH-&-STRETCH: deform along the blow axis for a few frames — the
    // single most readable "this got hit" tell. A kill goes bigger; a heavy
    // kick goes bigger than a punch. The body widens (sx<1) and elongates
    // vertically (sy>1) for a horizontal blow, then rebounds via tickStretch.
    // Faces-aware: when the blow comes from the side, the deform is along x;
    // we mirror sx/sy for a "vertical" feel since the stickman is upright.
    if (CONFIG.FEEL && CONFIG.FEEL.STRETCH) {
      const S = CONFIG.FEEL.STRETCH;
      let spec = S.HEAVY, lifeOverride = null;
      if (this.health <= 0) spec = S.KILL;
      else if (heavy) spec = S.HEAVY;
      else spec = S.HIT;
      this.pushStretch(spec.sx, spec.sy);
    }
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
    // BOSS super-armor: once a boss commits to its special (past the telegraph
    // windup), it cannot be interrupted by anything short of death. For the
    // slammer that's the leap+recover; for the caster, the barrage release+
    // recover. The telegraphed counter is to dodge the attack, not stagger it.
    if (this.isBoss && this.slam && this.slam.phase !== 'windup') {
      return true;
    }
    if (this.isBoss && this.cast && this.cast.phase !== 'windup') {
      return true;
    }
    // CHARGER commitment: once the dash locks in, light hits can't shove it off
    // its lane — dodge it, or kick (heavy) to interrupt. Mirrors the boss-armor
    // model so punch-spam can't stuff a committed charge, but a skill kick can.
    if (this.variant === 'charger' && this.charge && this.charge.phase === 'dash') {
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
    // BOMBER: death always goes out with a blast (a confident kill is a clutch
    // chain-reaction play). _detonate is idempotent, so a fuse-completion death
    // won't double-fire.
    if (this.variant === 'bomber') this._detonate();
    // SPLITTER: fissures into spawnlings on death. The scene owns the enemy
    // array + scaling, so route through a hook (mirrors _bossEnrage). Idempotent
    // via the dead flag so a multi-hit death can't double-split.
    if (this.variant === 'splitter' && this.scene._onSplitterDeath) this.scene._onSplitterDeath(this);
  }

  // ---- bomber detonation ----
  _detonate() {
    if (this.detonated) return;
    this.detonated = true;
    if (this.scene._detonateBomber) this.scene._detonateBomber(this);
  }

  _progressFuse(dt, player) {
    const B = CONFIG.CONTENT.BOMBER;
    const a = this.fuse;
    a.t += dt;
    // committed dive toward the player while the fuse burns
    const dir = sign(player.x - this.x) || this.facing;
    this.facing = dir;
    this.vx += (dir * this.v.speed * 1.15 * this.speedMul - this.vx) * clamp01(8 * dt);
    // core ramps to white-hot + strobes so the player reads the imminent blast
    this.glow = clamp01(a.t / B.FUSE_TIME);
    if (Math.floor(a.t * 22) % 2 === 0) this.flashTime = Math.max(this.flashTime, 0.06);
    if (a.t >= B.FUSE_TIME) {
      this._detonate();
      if (!this.dead) { this.health = 0; this._die(dir); }
    }
  }

  // ---- ranger ranged throw ----
  _startThrow() {
    const R = CONFIG.CONTENT.RANGER;
    this.throw = { phase: 'windup', t: 0, windup: R.THROW_WINDUP };
    this.state = 'punch'; // reuse the punch pose for the throwing windup
  }

  _progressThrow(dt, player) {
    const a = this.throw;
    a.t += dt;
    this.facing = sign(player.x - this.x) || this.facing;
    if (a.phase === 'windup') {
      this.glow = clamp01(a.t / a.windup) * 0.9;
      this.vx *= clamp01(1 - 8 * dt); // plant feet while aiming
      if (a.t >= a.windup) {
        this.glow = 1;
        if (this.scene.spawnEnemyProjectile) {
          this.scene.spawnEnemyProjectile(this.x, this.y - 92, player.x, player.y - 60);
        }
        a.phase = 'recover'; a.t = 0;
      }
    } else {
      this.glow = 0;
      this.vx *= clamp01(1 - 10 * dt);
      if (a.t >= 0.5) {
        this.throw = null;
        this.throwCd = rand(CONFIG.CONTENT.RANGER.THROW_CD[0], CONFIG.CONTENT.RANGER.THROW_CD[1]);
        this.state = this.onGround ? 'idle' : 'jump';
      }
    }
  }

  // ---- charger commitment dash ----
  _startCharge(player) {
    const C = CONFIG.CONTENT.CHARGER;
    this.charge = {
      phase: 'windup', t: 0, windup: C.CHARGE_WINDUP,
      dashTime: C.CHARGE_TIME, recover: C.CHARGE_RECOVER,
      dir: sign(player.x - this.x) || this.facing,
    };
    this.state = 'punch'; // charging pose during windup
  }

  _progressCharge(dt, player) {
    const a = this.charge;
    const C = CONFIG.CONTENT.CHARGER;
    a.t += dt;
    if (a.phase === 'windup') {
      // TELEGRAPH: plant + face the player + glow ramps so the dash reads. A
      // brief squat tells the player "it's about to lunge".
      this.facing = a.dir;
      this.glow = clamp01(a.t / a.windup);
      this.vx *= clamp01(1 - 10 * dt);
      if (a.t >= a.windup) {
        a.phase = 'dash'; a.t = 0; this.glow = 1;
        this.vx = a.dir * C.CHARGE_SPEED;
        this.state = 'run';
      }
      return;
    }
    if (a.phase === 'dash') {
      // committed dash — locks velocity straight; can't steer. Hyper-armor
      // (handled in takeHit via this.charge) means it can only be stopped by a
      // kill or by running into a wall.
      this.vx = a.dir * C.CHARGE_SPEED;
      this.glow = 0.85;
      if (a.t >= a.dashTime || this.x <= CONFIG.WALL_LEFT + 4 || this.x >= CONFIG.WALL_RIGHT - 4) {
        a.phase = 'recover'; a.t = 0; this.glow = 0.25;
        this.state = 'idle';
      }
      return;
    }
    // recover: a vulnerable pause — the punish window for dodging the dash
    this.vx *= clamp01(1 - 8 * dt);
    if (a.t >= a.recover) {
      this.charge = null;
      this.chargeCd = rand(C.CHARGE_CD[0], C.CHARGE_CD[1]);
      this.glow = 0;
      this.state = this.onGround ? 'idle' : 'jump';
    }
  }

  // ---- medic support heal ----
  // Find the lowest-HP wounded ally in range (excluding self/dead/boss). Used
  // to decide whether to start a heal channel this tick.
  _healTarget(M) {
    let best = null, bestFrac = M.HEAL_THRESHOLD;
    for (const o of this.scene.enemies) {
      if (o === this || o.dead || o.isBoss) continue;
      if (Math.abs(o.x - this.x) > M.HEAL_RANGE) continue;
      const frac = o.health / o.maxHealth;
      if (frac < bestFrac) { bestFrac = frac; best = o; }
    }
    return best;
  }

  _startHeal(target) {
    const M = CONFIG.CONTENT.MEDIC;
    this.heal = { phase: 'windup', t: 0, windup: M.HEAL_WINDUP, recover: M.HEAL_RECOVER, target };
    this.state = 'punch'; // both-arms-forward casting pose during windup
  }

  _progressHeal(dt, player) {
    const a = this.heal;
    const M = CONFIG.CONTENT.MEDIC;
    a.t += dt;
    // face the player for self-defense awareness, but the beam goes to the ally
    this.facing = sign(player.x - this.x) || this.facing;
    if (a.phase === 'windup') {
      this.glow = clamp01(a.t / a.windup) * 0.8;
      this.vx *= clamp01(1 - 8 * dt); // plant feet while channeling
      if (a.t >= a.windup) {
        // pulse: heal the lowest-HP ally (re-resolve in case the prior target
        // died mid-channel) + a green beam visual via a scene hook.
        const tgt = (a.target && !a.target.dead) ? a.target : this._healTarget(M);
        if (tgt && this.scene._healBeam) this.scene._healBeam(this.x, this.y - 92, tgt);
        if (tgt && !tgt.dead) {
          tgt.health = Math.min(tgt.maxHealth, tgt.health + M.HEAL_AMOUNT);
          tgt.flashTime = 0.16; // green-tinted flash reads as "healed"
        }
        a.phase = 'recover'; a.t = 0; this.glow = 0.2;
        this.state = 'idle';
      }
      return;
    }
    // recover: vulnerable pause — the punish for rushing a medic mid-cast
    this.vx *= clamp01(1 - 10 * dt);
    if (a.t >= a.recover) {
      this.heal = null;
      this.healCd = rand(M.HEAL_CD[0], M.HEAL_CD[1]);
      this.glow = 0;
      this.state = this.onGround ? 'idle' : 'jump';
    }
  }

  // ---- MERCY surrender ----
  // The scene calls this once trigger conditions are met. The enemy drops into
  // a kneeling beg over KNEEL_TIME, then holds the WAIT window for the scene's
  // spare/kill decision; if neither comes, the scene calls _flee().
  _startSurrender() {
    const M = CONFIG.MERCY;
    this.surrender = { phase: 'kneel', t: 0, p: 0 };
    this.attack = null; this.glow = 0;
    this.passive = true; // suppress melee AI; surrendered enemies never swing
    this.vx *= 0.4;
    if (this.scene._onSurrenderStart) this.scene._onSurrenderStart(this);
  }

  _progressSurrender(dt) {
    const a = this.surrender;
    const M = CONFIG.MERCY;
    a.t += dt;
    // plant feet: kill residual velocity so the kneel reads as a committed stop
    this.vx *= clamp01(1 - 10 * dt);
    if (a.phase === 'kneel') {
      // ease the pose parameter 0 -> 1 over KNEEL_TIME (kneeling-in)
      a.p = clamp01(a.t / M.KNEEL_TIME);
      if (a.t >= M.KNEEL_TIME) { a.phase = 'wait'; a.t = 0; a.p = 0; }
    } else if (a.phase === 'wait') {
      a.p = 0; // begging silhouette holds; tremble is procedural in the pose
      // wait window is owned by the scene (it knows spare/kill/flee); here we
      // only animate the held kneel. The scene expires the window and calls
      // _bow() / _flee().
    } else if (a.phase === 'bow') {
      a.p = clamp01(a.t / M.BOW_TIME); // 0 -> 1 raises the body to a standing bow
      if (a.t >= M.BOW_TIME) { a.phase = 'depart'; a.t = 0; a.p = 1; }
    } else if (a.phase === 'depart') {
      // walk off-screen at a brisk pace (spared). Faces nearest world edge.
      // NOTE: departed is NOT set here — the wave-clear filter still counts
      // this enemy as alive so the wave doesn't end until the spared enemy
      // has actually left (lets the MERCY banner breathe before WAVE CLEAR).
      a.p = 1;
      const dir = (this.x < (CONFIG.WALL_LEFT + CONFIG.WALL_RIGHT) / 2) ? -1 : 1;
      this.facing = dir;
      this.vx += (dir * 460 - this.vx) * clamp01(6 * dt);
      if (this.x <= CONFIG.WALL_LEFT - 60 || this.x >= CONFIG.WALL_RIGHT + 60) {
        this._destroy();
      }
    } else if (a.phase === 'flee') {
      // run off-screen fast (window expired). Arms up, full sprint.
      a.p = 1;
      const dir = (this.x < (CONFIG.WALL_LEFT + CONFIG.WALL_RIGHT) / 2) ? -1 : 1;
      this.facing = dir;
      this.vx = dir * M.FLEE_SPEED;
      if (this.x <= CONFIG.WALL_LEFT - 60 || this.x >= CONFIG.WALL_RIGHT + 60) {
        this._destroy();
      }
    }
    this._physics(dt);
    this._render();
  }

  // scene hooks for the spared / flee transitions
  _bow() {
    if (!this.surrender) return;
    this.surrender.phase = 'bow';
    this.surrender.t = 0;
    this.surrender.p = 0;
    // departed stays false: the wave-clear filter still counts this enemy so
    // the MERCY banner gets to breathe before the WAVE CLEAR beat. It clears
    // when the enemy actually walks off-screen and is destroyed.
  }
  _flee() {
    if (!this.surrender) return;
    this.surrender.phase = 'flee';
    this.surrender.t = 0;
    this.departed = true; // the player ignored — end the wave immediately while it sprints off
  }

  getHitbox(player) {
    if (this.dead) return null;
    // a surrendered enemy never damages the player — it's kneeling, hands up.
    if (this.surrender) return null;
    // hitbox geometry uses the BASE scale (combat-stable through squash frames;
    // a squashed attacker mustn't get a shifted swing arc).
    const sc = this._baseScaleX || this.scale || 1;
    // CHARGER dash: a tall, body-following hitbox during the dash phase so the
    // charge connects with anyone in its lane (mirrors the leaper dive shape).
    if (this.charge && this.charge.phase === 'dash') {
      const w = 78, h = 150;
      return { x: this.x - w / 2, y: this.y - NECK * sc - h * 0.5, w, h, dmg: Math.round(this.v.damage * this.dmgMul), kb: CONFIG.ENEMY.KNOCKBACK, from: this.x };
    }
    if (!this.attack) return null;
    const a = this.attack;
    if (a.phase !== 'active') return null;
    const reach = this.v.attackReach;
    if (a.leap) {
      // tall, body-following hitbox so a jumping target gets caught mid-dive
      const w = 86, h = 176;
      return { x: this.x - w / 2, y: this.y - NECK * sc - h * 0.5, w, h, dmg: Math.round(this.v.damage * this.dmgMul), kb: CONFIG.ENEMY.KNOCKBACK, from: this.x };
    }
    const cx = this.x + this.facing * (reach * 0.5 + 6);
    const w = reach;
    const h = 104; // tall enough that a low hop won't fully sidestep the swing
    return { x: cx - w / 2, y: this.y - NECK * sc - h * 0.42, w, h, dmg: Math.round(this.v.damage * this.dmgMul), kb: CONFIG.ENEMY.KNOCKBACK, from: this.x };
  }

  update(dt, player) {
    this.animTime += dt;
    if (this.flashTime > 0) this.flashTime -= dt;
    if (this.sprintT > 0) this.sprintT -= dt;
    // SQUASH-&-STRETCH: decay any active impact deformation back to neutral.
    // Runs every frame for every state (alive/dead/attacking) so a hit during
    // any phase still rebounds cleanly. The push happens in takeHit below.
    this.tickStretch(dt);

    if (this.dead) {
      this.deadT += dt / 0.7;
      this._physics(dt);
      this._alpha = clamp01(1 - (this.deadT - 0.6) * 2.5);
      this._render();
      if (this.deadT >= 1) this._destroy();
      return;
    }

    // MERCY: a surrendered enemy only runs its surrender state machine — it
    // never attacks, never path-finds, never triggers boss/slam/fuse logic.
    // Takes priority over every other action state once entered.
    if (this.surrender) {
      this._progressSurrender(dt);
      return;
    }

    // BOSS enrage crossing (once): phase 2 — faster, summons minions.
    if (this.isBoss && !this.enraged && this.health <= this.maxHealth * CONFIG.BOSS.ENRAGE_AT) {
      this._enrage();
    }

    if (this.slam) {
      this._progressSlam(dt, player);
      this._physics(dt);
      this._render();
      return;
    }

    // CASTER BOSS barrage: like the slam, it takes over the full body once
    // committed (windup -> release -> recover). Progress it before melee AI.
    if (this.cast) {
      this._progressCast(dt, player);
      this._physics(dt);
      this._render();
      return;
    }

    // BOMBER fuse: once lit (started in AI below), it runs to completion and
    // detonates — takes priority over a normal melee swing, like the boss slam.
    if (this.fuse) {
      this._progressFuse(dt, player);
      this._physics(dt);
      this._render();
      return;
    }

    // RANGER throw windup: a committed lob. Takes priority once started.
    if (this.throw) {
      this._progressThrow(dt, player);
      this._physics(dt);
      this._render();
      return;
    }

    // CHARGER dash: a committed horizontal charge. Once committed (past windup)
    // it has hyper-armor and takes over the body until recover — like a mini
    // boss-slam. Progressed before the melee AI so a started charge always runs.
    if (this.charge) {
      this._progressCharge(dt, player);
      this._physics(dt);
      this._render();
      return;
    }

    // MEDIC heal channel: a committed support pulse to the lowest-HP ally. Takes
    // priority once started (the medic plants to cast, like the ranger throw).
    if (this.heal) {
      this._progressHeal(dt, player);
      this._physics(dt);
      this._render();
      return;
    }

    // shielder guard recovers over time after being broken.
    if (this.guardBroken > 0) this.guardBroken -= dt;

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

    // FIRST-TIME ASSIST: the training dummy's truce is a fixed window from spawn
    // (not from first reaching the player), so a slow approach can't extend the
    // safe time indefinitely. Tick + expire it here, before the melee decision.
    // FIRST-MINUTE v2: the per-enemy self-expire is now a FALLBACK that only fires
    // once the scene-level wave-1 truce has ended — so the global 12s salvation
    // window holds for every wave-1 enemy, not just the first 5s of each. The
    // scene gate (_endWave1Truce) is the authoritative clearer on first hit.
    if (this.passive) {
      this.passiveT += dt;
      if (!this.scene.wave1Truce && this.passiveT > CONFIG.RETENTION.FIRST_ENEMY_PASSIVE_GRACE) {
        this.passive = false;
      }
    }

    const reach = this.v.attackReach;
    // desired stand position on the enemy's assigned flank side
    const desiredX = player.x + this.flankDir * reach * 0.55;
    const standoff = Math.abs(this.x - desiredX);
    // leaper commits from farther out (it dives to close the gap)
    const commitRange = reach * (this.variant === 'leaper' ? 1.15 : 0.82);

    // BOSS: periodic special attack — the dramatic, must-be-dodged move. The
    // slammer ground-slams (shockwaves you jump); the caster fires a lobbed
    // projectile barrage (you move/jump). Takes priority over a normal swing.
    if (this.isBoss) {
      if (this.bossKind === 'caster') {
        this.castCd -= dt;
        if (this.onGround && this.castCd <= 0 && dist < CONFIG.BOSS.CAST.RANGE) {
          this._startCast();
          this._physics(dt);
          this._render();
          return;
        }
      } else {
        this.slamCd -= dt;
        if (this.onGround && this.slamCd <= 0 && dist < 760) {
          this._startSlam();
          this._physics(dt);
          this._render();
          return;
        }
      }
    }

    // BOMBER: no melee — it charges the player, ignites a short fuse when close
    // (or after a few seconds alive, so a kiting player still gets a blast),
    // then detonates a lingering ground-fire zone on death or fuse completion.
    if (this.variant === 'bomber') {
      const B = CONFIG.CONTENT.BOMBER;
      this.lifeT += dt;
      if (this.onGround && !this.fuse && (dist < B.FUSE_RANGE || this.lifeT > 4.5)) {
        this.fuse = { t: 0 };
        this.glow = 0.5;
      }
      // keep charging at the player even while the fuse burns (committed dive).
      // A light separation term keeps bombers from stacking on the same pixel
      // (they ignore flank slots, unlike the melee pack); aiming at a small
      // per-bomber flank offset also spreads two bombers on opposite sides.
      const dir = sign(dx) || this.facing;
      const charging = !!this.fuse;
      const sp = this.v.speed * this.speedMul * (charging ? 1.15 : 1.0);
      const target = dir * sp + this._sepNudge() * 7;
      this.vx += (target - this.vx) * clamp01(8 * dt);
      this.state = this.onGround ? 'run' : 'jump';
      this._physics(dt);
      this._render();
      return;
    }

    // RANGER: kites — maintains distance, lobs arcing projectiles, and retreats
    // when rushed. Purely ranged; the punish for catching one is a free kill.
    if (this.variant === 'ranger') {
      const R = CONFIG.CONTENT.RANGER;
      this.throwCd -= dt;
      let mdir;
      if (dist < R.KITE_RANGE * 0.8) mdir = (-sign(dx)) || (-this.facing); // retreat
      else if (dist > R.THROW_RANGE) mdir = sign(dx) || this.facing;        // close in
      else mdir = 0;                                                        // hold + throw
      const sep = this._sepNudge() * 4;
      if (mdir !== 0) {
        this.vx += (mdir * this.v.speed * this.speedMul + sep - this.vx) * clamp01(8 * dt);
        this.state = this.onGround ? 'run' : 'jump';
      } else {
        this.vx += (sep - this.vx) * clamp01(6 * dt);
        this.state = this.onGround ? 'idle' : 'jump';
      }
      if (this.onGround && !this.throw && this.throwCd <= 0 && dist <= R.THROW_RANGE && dist >= 50) {
        this._startThrow();
      }
      this._physics(dt);
      this._render();
      return;
    }

    // CHARGER: a commitment-dash specialist. At mid-range it starts a
    // telegraphed charge (mini boss-pattern); otherwise it approaches with the
    // standard melee flank logic below. The dash punishes players who stand
    // still — the counter is to jump or step aside, since it can't steer.
    if (this.variant === 'charger') {
      const C = CONFIG.CONTENT.CHARGER;
      this.chargeCd -= dt;
      if (this.onGround && this.chargeCd <= 0 && dist > reach * 1.3 && dist < C.CHARGE_RANGE) {
        this._startCharge(player);
        this._physics(dt);
        this._render();
        return;
      }
      // fall through to the general melee approach below when not charging
    }

    // MEDIC: support. Kites at KITE_RANGE and channels a heal to the lowest-HP
    // wounded ally whenever one is in range + off cooldown. Weak melee only as
    // self-defense when crowded. Creates a target-priority decision: ignore it
    // and the pack sustains; rush it and the rest collapse on you.
    if (this.variant === 'medic') {
      const M = CONFIG.CONTENT.MEDIC;
      this.healCd -= dt;
      const target = this._healTarget(M);
      if (target && this.onGround && !this.heal && this.healCd <= 0) {
        this._startHeal(target);
        this._physics(dt);
        this._render();
        return;
      }
      // kite: keep a comfortable distance from the player
      let mdir;
      if (dist < M.KITE_RANGE) mdir = (-sign(dx)) || (-this.facing);            // retreat
      else if (dist > M.KITE_RANGE * 1.4) mdir = sign(dx) || this.facing;       // close in
      else mdir = 0;                                                            // hold
      const sep = this._sepNudge() * 4;
      if (mdir !== 0) {
        this.vx += (mdir * this.v.speed * this.speedMul + sep - this.vx) * clamp01(8 * dt);
        this.state = this.onGround ? 'run' : 'jump';
      } else {
        this.vx += (sep - this.vx) * clamp01(6 * dt);
        this.state = this.onGround ? 'idle' : 'jump';
      }
      // weak self-defense swing if the player crowds us
      if (this.onGround && dist <= reach && (this.firstStrike || this.attackCd <= 0)) {
        this._startAttack();
        this.firstStrike = false;
      } else if (this.onGround) {
        this.attackCd -= dt;
      }
      this._physics(dt);
      this._render();
      return;
    }

    if (dist > commitRange || standoff > 30) {
      // reposition toward the flank slot (keeps enemies on both sides)
      const tx = standoff > 30 && dist <= commitRange * 1.5 ? desiredX : player.x;
      const dir = sign(tx - this.x) || sign(dx) || 1;
      // entrance sprint: briefly close from spawn at 2x so wall-spawned enemies
      // don't leave a ~3.8s walk-up dead gap. Drops off as soon as they reach the
      // fight (this branch only runs pre-commitRange) and as the timer expires.
      const sprint = this.sprintT > 0 ? CONFIG.RETENTION.SPRINT_IN.BOOST : 1;
      this.vx += (dir * this.v.speed * this.speedMul * sprint * this.swarmSpeedMul - this.vx) * clamp01(8 * dt);
      this.state = this.onGround ? 'run' : 'jump';
    } else {
      this.vx *= clamp01(1 - 10 * dt);
      // FIRST-TIME ASSIST: a passive training dummy holds its swing. It still
      // approaches (above) so the encounter has tension, but it won't attack
      // until the player provokes it (a hit) or the grace timer (tick above)
      // runs out. This turns the first encounter into a safe teachable moment.
      if (this.passive) {
        this.attackCd -= dt;
      } else if (this.onGround && (this.firstStrike || this.attackCd <= 0)) {
        // first strike commits immediately so the player can't stall it with mash;
        // later swings are gated by attackCd. Only consume the first strike when an
        // attack actually starts — airborne enemies keep it for when they land.
        // (Same-flank overlap is intentionally left as-is: it gives the player an
        // emergent cleave window, and the 0.5s hurt-invlun + one-hit-per-frame rule
        // means stacked simultaneous swings still only land once. Spreading them out
        // removed that window and over-pressured jump-spam in wave-6 testing.)
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
    const aggr = this.aggrMul * this.swarmMul;  // pack pressure: crowds swing faster
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

  // ---- boss ground-slam special ----
  _startSlam() {
    this.slam = { phase: 'windup', t: 0 };
    this.glow = 0;
    this.state = 'idle';
  }

  _progressSlam(dt, player) {
    const a = this.slam;
    const B = CONFIG.BOSS;
    a.t += dt;
    if (a.phase === 'windup') {
      // TELEGRAPH: glow ramps to full so the player reads the incoming slam and
      // gets ready to jump. Hold position, face the player.
      this.facing = sign(player.x - this.x) || this.facing;
      this.glow = clamp01(a.t / B.SLAM_WINDUP);
      this.vx *= clamp01(1 - 8 * dt);
      if (a.t >= B.SLAM_WINDUP) {
        a.phase = 'leap'; a.t = 0; this.glow = 1;
        const dir = sign(player.x - this.x) || this.facing;
        this.vx = dir * B.SLAM_LEAP_VX;
        this.vy = -B.SLAM_LEAP_VY;
        this.onGround = false;
        this.scene.audio && this.scene.audio.kick();
      }
      return;
    }
    if (a.phase === 'leap') {
      // committed arc — on landing, radiate shockwaves outward along the ground.
      if (this.onGround) {
        this._slamImpact();
        a.phase = 'recover'; a.t = 0; this.glow = 0.3;
      }
      return;
    }
    // recover: brief vulnerable pause before the next slam cycle
    this.vx *= clamp01(1 - 10 * dt);
    if (a.t >= B.SLAM_RECOVER) {
      this.slam = null;
      this.slamCd = this.enraged ? B.SLAM_INTERVAL_ENRAGED : B.SLAM_INTERVAL;
      this.glow = 0;
      this.state = 'idle';
    }
  }

  _slamImpact() {
    const B = CONFIG.BOSS;
    // twin shockwaves race outward along the floor — the player must be airborne
    // to clear them. (Scene owns collision/draw; boss just emits.)
    if (this.scene.spawnShockwave) {
      this.scene.spawnShockwave(this.x, 1, B.SHOCKWAVE_SPEED);
      this.scene.spawnShockwave(this.x, -1, B.SHOCKWAVE_SPEED);
    }
    // slam feedback: a heavy ground ring + downward punch-zoom sells the weight
    // of a giant slamming down. Routed via scene helpers so FEEL tuning is shared.
    const scene = this.scene;
    if (scene._impactRing) scene._impactRing(this.x, CONFIG.GROUND_Y - 10, 0xff3b30, scene._ringSpec ? scene._ringSpec('SLAM') : { life: 0.4, maxR: 120, width: 6 });
    if (scene._punchZoom) scene._punchZoom(CONFIG.FEEL.ZOOM.SLAM, 0, CONFIG.FEEL.SHOVE.DOWN);
    if (scene._shake) {
      const S = CONFIG.FEEL.SHAKE.SLAM;
      scene._shake(S.amp, S.life, S.freq, 0, 1);
    } else { scene.cameras.main.shake(210, 0.022); }
    scene.dustBurst && scene.dustBurst(this.x, CONFIG.GROUND_Y, 28);
    scene.audio && scene.audio.bigHit();
  }

  // ---- caster boss projectile barrage ----
  // A telegraphed cast (glow ramps for CAST.WINDUP) then a spread of lobbed
  // projectiles arcing toward the player's standoff — dodgeable by moving or
  // jumping, unlike the slam's must-jump shockwaves. Reuses the scene's ranger
  // projectile pool (gravity arc + collision + draw) for free.
  _startCast() {
    this.cast = { phase: 'windup', t: 0 };
    this.glow = 0;
    this.state = 'idle';
  }

  _progressCast(dt, player) {
    const a = this.cast;
    const C = CONFIG.BOSS.CAST;
    a.t += dt;
    if (a.phase === 'windup') {
      // TELEGRAPH: glow ramps to full + face the player so the barrage reads.
      this.facing = sign(player.x - this.x) || this.facing;
      this.glow = clamp01(a.t / C.WINDUP);
      this.vx *= clamp01(1 - 8 * dt);
      if (a.t >= C.WINDUP) {
        this._castRelease(player);
        a.phase = 'recover'; a.t = 0; this.glow = 0.3;
      }
      return;
    }
    // recover: a long, stationary vulnerable window — the punish for dodging
    // the barrage. Shorter window than the slammer's to offset the cast safety.
    this.vx *= clamp01(1 - 10 * dt);
    if (a.t >= C.RECOVER) {
      this.cast = null;
      this.castCd = this.enraged ? C.INTERVAL_ENRAGED : C.INTERVAL;
      this.glow = 0;
      this.state = 'idle';
    }
  }

  _castRelease(player) {
    const C = CONFIG.BOSS.CAST;
    const scene = this.scene;
    const y0 = this.y - 96 * this.scale;       // cast from head height
    const shots = this.enraged ? C.SHOTS_ENRAGED : C.SHOTS;
    for (let i = 0; i < shots; i++) {
      const off = shots === 1 ? 0 : (i / (shots - 1) - 0.5) * 2 * C.SPREAD;
      const tx = clamp(player.x + off, CONFIG.WALL_LEFT + 20, CONFIG.WALL_RIGHT - 20);
      scene.spawnEnemyProjectile(this.x, y0, tx, CONFIG.GROUND_Y - 40, C.PROJECTILE_DMG);
    }
    // cast feedback: a charging ring + recoil zoom + flash. Tinted toxic-green
    // to match the caster palette so the source of the barrage reads clearly.
    if (scene._impactRing) scene._impactRing(this.x, y0, 0x9aff6b, scene._ringSpec ? scene._ringSpec('HEAVY') : { life: 0.28, maxR: 66, width: 5 });
    if (scene._punchZoom) scene._punchZoom(CONFIG.FEEL.ZOOM.HEAVY, 0, 0);
    if (scene._shake) {
      const S = CONFIG.FEEL.SHAKE.HEAVY;
      scene._shake(S.amp * 0.7, S.life, S.freq, 0, 0.5);
    } else { scene.cameras.main.shake(120, 0.012); }
    scene.audio && scene.audio.bigHit && scene.audio.bigHit();
  }

  _enrage() {
    this.enraged = true;
    this.speedMul *= 1.25;
    this.aggrMul *= 1.2;
    this.flashTime = 0.3;
    if (this.scene._bossEnrage) this.scene._bossEnrage(this);
  }

  // minimal horizontal separation for archetypes that ignore flank slots
  // (bombers charge, rangers kite) — pushes them off neighbors so they don't
  // stack on the same X. Melee pack uses flank slots instead, per the design.
  // Returns a signed velocity nudge; two perfectly overlapping enemies (d≈0)
  // deterministically split by id parity so they don't stay glued.
  _sepNudge() {
    let nudge = 0;
    for (const o of this.scene.enemies) {
      if (o === this || o.dead) continue;
      const d = this.x - o.x;
      const ad = Math.abs(d);
      if (ad < 1) nudge += (this.id % 2 === 0 ? 1 : -1) * 40;
      else if (ad < 44) nudge += (d / ad) * (44 - ad) * 0.7;
    }
    return nudge;
  }

  // hard position-based safety net: guarantees a minimum horizontal gap from
  // other living enemies. Acts only on severe overlap (<minGap), which the tuned
  // flank spacing keeps melee out of in practice — it's a collision resolver for
  // the bomber/ranger archetypes (which bypass flank slots) + spawn coincidences,
  // NOT boids steering. Ensures the "no perfect overlap" invariant.
  _hardSeparate(minGap = 12) {
    if (this.dead) return;
    for (const o of this.scene.enemies) {
      if (o === this || o.dead || o.isBoss) continue;
      const d = this.x - o.x;
      const ad = Math.abs(d);
      if (ad < minGap) {
        const dir = ad < 0.5 ? (this.id % 2 ? 1 : -1) : Math.sign(d) || 1;
        this.x += dir * (minGap - ad + 1);
      }
    }
    if (this.x < CONFIG.WALL_LEFT) this.x = CONFIG.WALL_LEFT;
    if (this.x > CONFIG.WALL_RIGHT) this.x = CONFIG.WALL_RIGHT;
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
    // resolve severe horizontal overlap with other living enemies (safety net)
    this._hardSeparate();
  }

  _render() {
    let anim;
    if (this.dead) {
      anim = { state: 'dead', time: this.animTime, deadT: this.deadT };
    } else if (this.surrender) {
      // MERCY: kneeling-beg (p=0) -> standing bow (p=1). The pose function
      // interpolates the whole body; tremble is procedural. Fleeing reads as a
      // run cycle so the exit has motion.
      if (this.surrender.phase === 'flee') {
        anim = { state: 'run', time: this.animTime };
      } else {
        anim = { state: 'surrender', time: this.animTime, phase: this.surrender.p };
      }
    } else if (this.slam) {
      // boss slam: windup reads as a charging punch, the leap as an airborne
      // tuck, recover as settling idle — so each phase is instantly legible.
      if (this.slam.phase === 'leap') anim = { state: 'jump', vy: -this.vy };
      else if (this.slam.phase === 'windup') anim = { state: 'punch', phase: 0.18 };
      else anim = { state: 'idle', time: this.animTime };
    } else if (this.cast) {
      // caster barrage: windup reads as a charging cast (both arms forward),
      // recover as a vulnerable idle. The glowing fist carries the telegraph.
      if (this.cast.phase === 'windup') anim = { state: 'punch', phase: 0.3 };
      else anim = { state: 'idle', time: this.animTime };
    } else if (this.attack && this.attack.leap) {
      // a diving leaper reads as an airborne tuck, not a grounded punch
      anim = { state: 'jump', vy: -this.vy };
    } else if (this.attack) {
      anim = { state: 'punch', phase: this._attackPhase01() };
    } else if (this.throw) {
      // ranger throwing windup reads as a committed punch pose
      anim = { state: 'punch', phase: this.throw.phase === 'windup' ? 0.35 : 0.85 };
    } else if (this.charge) {
      // charger: windup = a charging squat (punch pose), dash = a lean-in run,
      // recover = a settling idle. The glow + dash velocity carry the read.
      if (this.charge.phase === 'windup') anim = { state: 'punch', phase: 0.2 };
      else if (this.charge.phase === 'dash') anim = { state: 'run', time: this.animTime };
      else anim = { state: 'idle', time: this.animTime };
    } else if (this.heal) {
      // medic: windup = both arms forward (charging cast), recover = idle
      anim = { state: 'punch', phase: this.heal.phase === 'windup' ? 0.45 : 0.9 };
    } else if (this.state === 'hurt') {
      anim = { state: 'hurt', time: this.hurtTime };
    } else if (this.state === 'run') {
      anim = { state: 'run', time: this.animTime };
    } else {
      anim = { state: 'idle', time: this.animTime };
    }
    this.render(anim);
    // equipment overlays — make new archetypes visually distinct so the player
    // reads the shield / volatile core at a glance. Drawn in graphics coords
    // (feet at origin, +x right, facing applied manually since Graphics isn't rotated).
    if (!this.dead) {
      // MERCY overlays — drawn FIRST so the body sits on top of the spotlight
      // pool. A soft white light beneath the kneeler sells the "moment of
      // decision", and the white flag is the universal surrender symbol. The
      // flag waves on a slow sine while waiting, droops during the bow, and is
      // gone once departed/fleeing.
      if (this.surrender && (this.surrender.phase === 'kneel' || this.surrender.phase === 'wait' || this.surrender.phase === 'bow')) {
        // ground spotlight pool (additive-feeling soft disc under the feet)
        const poolA = 0.28 * (this.surrender.phase === 'bow' ? 1 - this.surrender.p : 1);
        this.fillStyle(0xeaf4ff, poolA * 0.5);
        this.fillEllipse(0, 2 * this.scale, 70 * this.scale, 20 * this.scale);
        this.fillStyle(0xffffff, poolA * 0.35);
        this.fillEllipse(0, 2 * this.scale, 44 * this.scale, 13 * this.scale);
        // white flag on a pole, held up to the facing side
        const flagUp = this.surrender.phase === 'bow' ? (1 - this.surrender.p) : 1;
        const poleX = this.facing * (20 * this.scale);
        const poleTopY = -(150 + 10 * Math.sin(this.animTime * 4)) * this.scale * flagUp - 30 * this.scale * (1 - flagUp);
        const poleBotY = -70 * this.scale;
        this.lineStyle(2.5 * this.scale, 0x05070d, 0.9);
        this.strokeLineShape(new Phaser.Geom.Line(poleX, poleBotY, poleX, poleTopY));
        this.lineStyle(2 * this.scale, 0xbfe3ff, 0.95);
        this.strokeLineShape(new Phaser.Geom.Line(poleX, poleBotY, poleX, poleTopY));
        // the cloth (waves via a horizontal sine offset)
        const fw = 26 * this.scale, fh = 18 * this.scale;
        const wave = Math.sin(this.animTime * 6) * 3 * this.scale * flagUp;
        this.fillStyle(0xeaf4ff, 0.95);
        this.beginPath();
        this.moveTo(poleX, poleTopY);
        this.lineTo(poleX + this.facing * fw + wave, poleTopY + fh * 0.3);
        this.lineTo(poleX + this.facing * fw + wave * 0.7, poleTopY + fh);
        this.lineTo(poleX, poleTopY + fh);
        this.closePath();
        this.fillPath();
        this.lineStyle(1.5, 0xffffff, 0.7);
        this.strokePath();
      }
      if (this.variant === 'shielder') {
        const up = this.guardBroken <= 0;
        const sx = this.facing * 30 * this.scale;
        const sy = -68 * this.scale;
        const sw = 14 * this.scale, sh = 60 * this.scale;
        this.fillStyle(0x2f8fbf, up ? 0.92 : 0.35);
        this.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
        this.lineStyle(3, up ? 0xeaf4ff : 0xff6f5c, up ? 1 : 0.6);
        this.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);
        this.fillStyle(0xeaf4ff, up ? 0.9 : 0.3);
        this.fillCircle(sx, sy, 4 * this.scale);
      } else if (this.variant === 'bomber') {
        // volatile core: gentle pulse normally, white-hot strobe while fusing
        const cy = -62 * this.scale;
        const rad = (8 + (this.fuse ? 4 : 0)) * this.scale;
        const pulse = this.fuse
          ? (0.55 + 0.45 * Math.abs(Math.sin(this.animTime * 26)))
          : (0.45 + 0.2 * Math.sin(this.animTime * 6));
        this.fillStyle(this.fuse ? 0xffffff : 0xff3b30, pulse * 0.85);
        this.fillCircle(this.facing * 4, cy, rad);
        this.lineStyle(2, 0xffe26b, pulse);
        this.strokeCircle(this.facing * 4, cy, rad);
      } else if (this.variant === 'medic') {
        // glowing medic cross on the chest — green when ready, bright while
        // channeling a heal. Reads "support" at a glance so the player prioritizes.
        const cx = 0, cyy = -60 * this.scale;
        const ch = this.heal && this.heal.phase === 'windup';
        const pulse = ch ? (0.6 + 0.4 * Math.abs(Math.sin(this.animTime * 18))) : 0.5;
        const sz = 9 * this.scale;
        this.fillStyle(ch ? 0x6bff9e : 0x35e1ff, pulse * 0.85);
        this.fillRect(cx - sz, cyy - 2.5 * this.scale, sz * 2, 5 * this.scale);
        this.fillRect(cx - 2.5 * this.scale, cyy - sz, 5 * this.scale, sz * 2);
      } else if (this.variant === 'splitter') {
        // rocky cracks glow faintly, brightening as HP drops — telegraphs that
        // something happens when it breaks. The fissure lines read "fragile shell".
        const frac = 1 - (this.health / this.maxHealth);
        const cy = -58 * this.scale;
        const glow = 0.25 + frac * 0.6;
        this.lineStyle(2, 0xffd23f, glow);
        this.beginPath();
        this.moveTo(-10 * this.scale, cy); this.lineTo(2 * this.scale, cy - 8 * this.scale);
        this.moveTo(2 * this.scale, cy - 8 * this.scale); this.lineTo(8 * this.scale, cy + 4 * this.scale);
        this.strokePath();
      }
    }
    // hit flash overlay — a layered stack: white-hot core disc, chromatic ring
    // (cyan outside / magenta inside, the classic "impact" hue split), and a
    // thin white ring. Scales with the flash window so a heavy hit (longer
    // flashTime) reads brighter for longer. The chromatic split sells the
    // "energy" of the connection far more than a flat white disc.
    if (this.flashTime > 0) {
      const fa = clamp01(this.flashTime / 0.14);
      // outer cyan halo
      this.fillStyle(0x35e1ff, fa * 0.35);
      this.fillCircle(0, -60 * this.scale, 46 * this.scale);
      // white-hot core
      this.fillStyle(0xffffff, fa * 0.55);
      this.fillCircle(0, -60 * this.scale, 38 * this.scale);
      // inner magenta punch (reads as the strike point)
      this.fillStyle(0xff5cb0, fa * 0.30);
      this.fillCircle(0, -60 * this.scale, 24 * this.scale);
      // crisp white ring — the snap outline
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
