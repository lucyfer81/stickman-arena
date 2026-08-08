import { CONFIG, DIFFICULTY, COLORS } from '../config.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Pickup } from '../entities/Pickup.js';
import { drawBackground } from '../utils/background.js';
import { aabb, clamp, clamp01, sign, rand, randInt } from '../utils/math.js';
import { Meta } from '../systems/Meta.js';
import { rollEvent, getEvent } from '../systems/Events.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    drawBackground(this);
    this.audio = this.registry.get('audio');
    this.audio && this.audio.resume();
    // ensure the generative soundtrack is up at combat intensity on enter
    this.audio && this.audio.startMusic && this.audio.startMusic('combat');

    this.shadows = this.add.graphics().setDepth(5);
    this.fxLayer = this.add.graphics().setDepth(20); // hit sparks drawn direct
    this.ringLayer = this.add.graphics().setDepth(21); // expanding impact rings
    this.shockLayer = this.add.graphics().setDepth(19); // boss ground-slam shockwaves
    this.debrisLayer = this.add.graphics().setDepth(9); // SECOND WIND shattered-limb props
    this.veilLayer = this.add.graphics().setDepth(220); // SECOND WIND monochrome/red vignette
    this.fireLayer = this.add.graphics().setDepth(18); // ground fire (bomber/meteor)
    this.projLayer = this.add.graphics().setDepth(20); // ranger projectiles + meteor markers
    this.enemies = [];
    this.pickups = [];
    this.shockwaves = [];
    this.hazards = [];        // ground fire zones { x, w, life, t, tick, dps }
    this.projectiles = [];    // ranger lobbed projectiles
    this.meteorWarnings = []; // telegraph markers before a meteor impact
    this.debris = [];          // SECOND WIND: shattered limb props (arm ragdoll)
    this.rings = [];          // expanding impact rings { x, y, t, life, maxR, width, color }
    this.camBoost = 0;        // punch-zoom boost (zoom = 1 + boost); decays each frame
    this.camShoveX = 0;       // directional camera recoil (px), eased back to 0
    this.camShoveY = 0;
    this.boss = null;            // live boss reference (for the HP bar + payoff)
    this.isBossWave = false;     // every 5th wave is a single-boss encounter
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.wave = 0;
    this.spawnQueue = 0;
    this.waveActive = false;
    this.waveBreak = 1.0;
    this.hitPause = 0;
    this.slowmo = 0;
    this.timeScale = 1;
    this.gameOver = false;
    this.hitsTaken = 0;
    this.healed = 0;
    this.kills = 0;
    this.spawned = { grunt: 0, runner: 0, brute: 0, leaper: 0, vanguard: 0, shielder: 0, bomber: 0, ranger: 0, boss: 0, bossCaster: 0 };
    this.tierBonuses = 0;
    this.firstBloodDone = false;     // FIRST BLOOD fires once on the run's first non-boss kill
    this.waveFirstSpawn = true;      // wave-2 first spawn is a vanguard mini-elite
    this.onboard = { move: false, jump: false, punch: false, kick: false, firstHit: false, t: 0 };
    // round-5 content: rage buff + rare-event director state
    this.rageT = 0;
    this.rageMax = 1;
    this.activeEvent = null;     // event key for the current wave (null = plain wave)
    this._resetEventFlags();

    // difficulty preset (chosen on the title screen; persists)
    const diffKey = this.registry.get('difficulty') || 'normal';
    this.diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;

    // daily modifier (optional) composes on top of difficulty
    this.daily = this.registry.get('daily') ? Meta.dailyModifier() : null;
    this.mods = {
      enemyHp: this.diff.enemyHp,
      enemySpeed: this.diff.enemySpeed,
      enemyDmg: this.diff.enemyDmg,
      aggr: this.diff.aggr,
      scoreMul: 1,
      extraPerWave: 0,
    };
    if (this.daily) {
      if (this.daily.enemySpeed) this.mods.enemySpeed *= this.daily.enemySpeed;
      if (this.daily.enemyDmg) this.mods.enemyDmg *= this.daily.enemyDmg;
      if (this.daily.enemyHp) this.mods.enemyHp *= this.daily.enemyHp;
      if (this.daily.scoreMul) this.mods.scoreMul *= this.daily.scoreMul;
      if (this.daily.extraPerWave) this.mods.extraPerWave += this.daily.extraPerWave;
    }
    const playerHp = this.daily && this.daily.playerHp ? this.daily.playerHp : this.diff.playerHp;

    this.player = new Player(this, CONFIG.WIDTH / 2, CONFIG.GROUND_Y);
    this.player.facing = 1;
    this.player.maxHealth = playerHp;
    this.player.health = playerHp;
    // apply the player's selected skin palette (cosmetic)
    this.player.setPalette(Meta.skinPalette());

    // shared control state (also written by UIScene touch controls)
    this.controls = {
      dir: 0, jumpPressed: false, jumpHeld: false,
      punchPressed: false, kickPressed: false,
      touchActive: false, touchDir: 0, jumpHeldTouch: false,
    };
    this._setupKeyboard();
    this._setupParticles();
    if (typeof window !== 'undefined') {
      window.__controls = this.controls;
      window.__stickman = { state: 'game', score: 0, wave: 0 };
      window.__test = {
        hurt: (n) => this.player.takeHit(n || 99, this.player.x - 100, 0),
        setHealth: (n) => { this.player.health = n; },
        killEnemies: () => { for (const e of this.enemies) if (!e.dead) e.takeHit(9999, this.player.x, 0, 0); },
        // clean instant despawn (skips the death anim) — for tests that just need
        // to advance waves without creating a corpse backlog that interacts with
        // the spawn gate / death-tween behaviour.
        despawnEnemies: () => { for (const e of this.enemies) if (!e.dead) { e.dead = true; e.destroy(); } },
        // skip straight to a boss wave (default wave 5) so boss logic can be
        // exercised without playing through 4 normal waves.
        gotoBossWave: (n) => { for (const e of this.enemies) e.destroy(); this.enemies = []; this.boss = null; this.shockwaves = []; this.hazards = []; this.projectiles = []; this.meteorWarnings = []; this.debris = []; this.startWave(n || CONFIG.BOSS.WAVE_EVERY); },
        spawnBoss: () => { this._spawnBoss(); },
        // spawn a specific boss archetype directly (bypasses wave parity) and
        // force the live boss to fire its special next tick — for deterministic
        // caster/slammer testing.
        spawnBossKind: (kind) => {
          for (const e of this.enemies) e.destroy();
          this.enemies = []; this.boss = null; this.shockwaves = []; this.hazards = []; this.projectiles = []; this.meteorWarnings = []; this.debris = [];
          const variant = kind === 'caster' ? 'bossCaster' : 'boss';
          const e = new Enemy(this, CONFIG.WALL_LEFT + 40, CONFIG.GROUND_Y, variant);
          e.facing = 1; e.flankDir = 1;
          this._applyScaling(e, Math.max(this.wave, 10));
          this.boss = e; this.enemies.push(e);
          return e.bossKind;
        },
        bossFireSpecial: () => { if (this.boss && !this.boss.dead) { this.boss.slamCd = 0; this.boss.castCd = 0; return true; } return false; },
        setBossHp: (n) => { if (this.boss && !this.boss.dead) { this.boss.health = n; } },
        // route a lethal player strike through the real combat pipeline so the
        // BOSS DOWN payoff (score/slowmo/banner/heal drop) fires exactly as in play.
        killBoss: () => {
          const b = this.boss; if (!b || b.dead) return;
          const hb = { dmg: 9999, kb: 560, pause: 0.18, from: this.player.x };
          b.takeHit(9999, this.player.x, 560, 0.18);
          if (b.dead) this._onPlayerHit(b, hb, true);
          this._updateHUD(); // refresh telemetry synchronously so tests read post-kill state
        },
        // route a lethal player strike on the first living non-boss enemy through
        // the real combat pipeline so FIRST BLOOD (and normal K.O. feedback) fires
        // exactly as in play. Mirrors killBoss for determinism in tests.
        killFirstEnemy: () => {
          const e = this.enemies.find((x) => !x.dead && !x.isBoss);
          if (!e) return false;
          const hb = { dmg: 9999, kb: 320, pause: 0.055, from: this.player.x };
          e.takeHit(9999, this.player.x, 320, 0.055);
          if (e.dead) this._onPlayerHit(e, hb, true);
          this._updateHUD(); // refresh telemetry synchronously (FIRST BLOOD flag etc.)
          return true;
        },
        // combat-depth probes: read first living enemy's HP, spawn a grunt at a
        // fixed offset from the player, and snapshot player attack state.
        firstEnemyHp: () => { const e = this.enemies.find((x) => !x.dead); return e ? e.health : null; },
        spawnDummy: (dx, passive) => {
          const e = new Enemy(this, this.player.x + (dx || 60), CONFIG.GROUND_Y, 'grunt');
          e.facing = -1; e.flankDir = 1;
          if (passive) { e.firstStrike = false; e.attackCd = 1e9; } // won't swing -> won't interrupt
          this._applyScaling(e, Math.max(1, this.wave));
          this.enemies.push(e);
          return e.health;
        },
        // spawn a specific variant at an offset from the player (round-5 content)
        spawnVariant: (variant, dx) => {
          const e = new Enemy(this, this.player.x + (dx || 80), CONFIG.GROUND_Y, variant);
          e.facing = -1; e.flankDir = 1;
          this._applyScaling(e, Math.max(1, this.wave));
          this.enemies.push(e);
          return e;
        },
        // force a rare event to remix the next/current wave (tests)
        triggerEvent: (key, wave) => {
          const ev = getEvent(key);
          if (!ev) return false;
          this._resetEventFlags();
          this.activeEvent = key;
          const w = wave || Math.max(this.wave, ev.minWave);
          this.wave = w; this.isBossWave = false; this.waveActive = true;
          ev.apply(this);
          return true;
        },
        giveRage: (t) => this._startRage(t || CONFIG.CONTENT.PICKUP.RAGE_TIME),
        dropPickup: (type, x) => this.pickups.push(new Pickup(this, x || this.player.x, this.player.y - 60, type || 'health')),
        spawnFireZone: (x, opts) => this.spawnFireZone(x, opts),
        spawnProjectileAt: (x0, y0, x1, y1) => this.spawnEnemyProjectile(x0, y0, x1, y1),
        detonateAt: (x) => this._detonateBomber({ x, y: CONFIG.GROUND_Y }),
        // SECOND WIND: force-enter the broken last-stand, force a reform, and
        // fast-forward the window's timer so the expiry path is testable.
        enterSecondWind: () => { if (!this.player.broken && !this.player.dead) { this.player._enterBroken(); return true; } return false; },
        reform: () => { if (this.player.broken) { this._reform(); return true; } return false; },
        fastForwardBroken: (t) => { if (this.player.broken) this.player.brokenT = (t != null ? t : 0.2); },
        playerState: () => ({
          state: this.player.state,
          attackType: this.player.attack ? this.player.attack.type : null,
          phase: this.player.attack ? this.player.attack.phase : null,
          t: this.player.attack ? this.player.attack.t : null,
          total: this.player.attack ? this.player.attack.total : null,
          connected: this.player.attack ? this.player.attack.connected : null,
        }),
        clearEnemies: () => { for (const e of this.enemies) if (!e.dead) { e.dead = true; e.destroy(); } this.enemies = []; this.boss = null; this.shockwaves = []; this.hazards = []; this.projectiles = []; this.meteorWarnings = []; this.debris = []; this.spawnQueue = 0; this.waveActive = false; },
      };
    }

    this.scene.launch('UI');
    this.ui = this.scene.get('UI');

    this.registry.set('hud', {
      health: this.player.health, maxHealth: this.player.maxHealth,
      score: 0, wave: 0, combo: 0, enemiesLeft: 0,
    });

    this.cameras.main.fadeIn(300);
    this.cameras.main.setBackgroundColor('#0b0e16');
  }

  _setupKeyboard() {
    const k = this.input.keyboard;
    const c = this.controls;
    this.keys = {
      left: k.addKey('A'), left2: k.addKey('LEFT'),
      right: k.addKey('D'), right2: k.addKey('RIGHT'),
      up: k.addKey('W'), up2: k.addKey('UP'),
      jump: k.addKey('SPACE'),
      punch: k.addKey('J'),
      kick: k.addKey('K'),
    };
    const resume = () => this.audio && this.audio.resume();
    this.keys.jump.on('down', () => { resume(); c.jumpPressed = true; });
    this.keys.up.on('down', () => { resume(); c.jumpPressed = true; });
    this.keys.up2.on('down', () => { resume(); c.jumpPressed = true; });
    this.keys.punch.on('down', () => { resume(); c.punchPressed = true; });
    this.keys.kick.on('down', () => { resume(); c.kickPressed = true; });
    k.on('keydown-ESC', () => this._togglePause());
  }

  _setupParticles() {
    // hit burst emitter — gravity makes the sparks/debris arc and fall, which
    // sells weight far better than floating dots. Faster + more particles for a
    // punchier burst; additive blend keeps it bright.
    this.hitEmitter = this.add.particles(0, 0, 'dot', {
      speed: { min: 160, max: 560 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.85, end: 0 },
      lifespan: { min: 240, max: 520 },
      gravityY: 720,
      blendMode: 'ADD',
      quantity: 18,
      emitting: false,
    }).setDepth(30);
    this.dustEmitter = this.add.particles(0, 0, 'dot', {
      speed: { min: 50, max: 170 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.55, end: 0 },
      lifespan: { min: 220, max: 420 },
      gravityY: 360,
      tint: 0x6b86a3,
      quantity: 8,
      emitting: false,
    }).setDepth(6);
  }

  _togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    if (this.ui) this.ui.setPaused(this.paused);
    this.audio && this.audio.setMuted(this.paused);
  }

  burst(x, y, color, count = 14) {
    this.hitEmitter.setPosition(x, y);
    this.hitEmitter.tint = color;
    this.hitEmitter.explode(count);
  }

  dustBurst(x, y, count = 8) {
    this.dustEmitter.setPosition(x, y);
    this.dustEmitter.explode(count);
  }

  // ---- game-feel helpers (pure feedback, no mechanic change) ----
  // snap the camera in: zoom boosts instantly and eases back; shove recoils
  // opposite the blow direction (clamped to zoom headroom so edges never show).
  _punchZoom(boost, dirX = 0, shoveY = 0) {
    const F = CONFIG.FEEL;
    this.camBoost = Math.min(F.ZOOM.MAX, Math.max(this.camBoost, boost));
    if (dirX) this.camShoveX = clamp(this.camShoveX + dirX, -F.SHOVE.BOSS, F.SHOVE.BOSS);
    if (shoveY) this.camShoveY = clamp(this.camShoveY + shoveY, 0, F.SHOVE.DOWN * 1.4);
  }

  // expanding impact ring — the classic impact tell. Drawn persistently on its
  // own layer (survives the spark's short clear window) and fades as it grows.
  _impactRing(x, y, color, spec) {
    this.rings.push({
      x, y, t: 0, life: spec.life, maxR: spec.maxR, width: spec.width, color,
    });
  }

  // resolve FEEL.RING spec by event key (with a safe fallback)
  _ringSpec(key) { return (CONFIG.FEEL.RING[key] || CONFIG.FEEL.RING.HEAVY); }

  // apply the standard feedback stack for a landed hit. dirX = direction the
  // blow travels (attacker -> target); the camera recoils the opposite way.
  _impactFX(x, y, color, dirX, ringKey, zoomKey, sparkColor) {
    const F = CONFIG.FEEL;
    this._impactRing(x, y, color, this._ringSpec(ringKey));
    const zoom = F.ZOOM[zoomKey] != null ? F.ZOOM[zoomKey] : F.ZOOM.HIT;
    const shoveMag = F.SHOVE[zoomKey] != null ? F.SHOVE[zoomKey]
      : (zoomKey === 'BOSS_KILL' ? F.SHOVE.BOSS : F.SHOVE.HIT);
    this._punchZoom(zoom, 0, 0);
    // recoil shove is applied directly so the magnitude honours the event weight
    this.camShoveX = clamp(this.camShoveX - dirX * shoveMag, -F.SHOVE.BOSS, F.SHOVE.BOSS);
    this._spark(x, y, sparkColor || color, dirX);
  }

  _updateCamera(dt) {
    const F = CONFIG.FEEL;
    // exponential ease-back to rest
    const k = Math.exp(-dt / F.ZOOM.TAU);
    this.camBoost *= k;
    this.camShoveX *= k;
    this.camShoveY *= k;
    if (this.camBoost < 0.0008) this.camBoost = 0;
    if (Math.abs(this.camShoveX) < 0.05) this.camShoveX = 0;
    if (this.camShoveY < 0.05) this.camShoveY = 0;
    const cam = this.cameras.main;
    cam.setZoom(1 + this.camBoost);
    // only shove while zoomed in (headroom); clamp to the px the zoom buys so we
    // never reveal the world rectangle's edge.
    const headX = (cam.width * this.camBoost) * 0.5 * 0.8;
    const headY = (cam.height * this.camBoost) * 0.5 * 0.8;
    cam.setScroll(
      clamp(this.camShoveX, -headX, headX),
      clamp(this.camShoveY, -headY, headY)
    );
  }

  _updateRings(dt) {
    const g = this.ringLayer;
    g.clear();
    if (!this.rings.length) return;
    for (const r of this.rings) {
      r.t += dt;
      const p = clamp01(r.t / r.life);
      // ease-out radius growth; alpha fades over the back half for a snappy lead
      const rad = r.maxR * (1 - Math.pow(1 - p, 3));
      const a = (p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65);
      g.lineStyle(r.width, r.color, a * 0.9);
      g.strokeCircle(r.x, r.y, rad);
      // soft inner glow disc on the opening frames
      if (p < 0.5) {
        g.fillStyle(r.color, a * 0.10);
        g.fillCircle(r.x, r.y, rad * 0.7);
      }
    }
    this.rings = this.rings.filter((r) => r.t < r.life);
  }

  // ---- waves ----
  // per-wave event flags consumed by spawnOne() / update(). Reset every wave so
  // an event never bleeds into the next one.
  _resetEventFlags() {
    this.eventForceVariant = null; // a single forced variant for the whole wave
    this.eventVariantPool = null;  // weighted pool to draw from each spawn
    this.eventExtraSpawns = 0;     // +/- to this wave's spawn count
    this.eventEliteCount = 0;      // first N spawns are vanguards
    this.eventSupplyDrop = false;  // drop a care package at wave start
    this.eventMeteors = false;     // spawn meteor strikes during the wave
    this.meteorTimer = 0;
  }

  startWave(n) {
    this.wave = n;
    this.waveActive = true;
    this.isBossWave = (n % CONFIG.BOSS.WAVE_EVERY === 0);
    this._resetEventFlags();
    this.activeEvent = null;
    if (this.isBossWave) {
      // boss wave: a single climactic elite — no filler spawns, no event remix.
      this.spawnQueue = 1;
      const variant = (Math.round(n / CONFIG.BOSS.WAVE_EVERY) % 2 === 1) ? 'slammer' : 'caster';
      const name = CONFIG.BOSS.NAME[variant];
      this.ui.banner('BOSS WAVE ' + n + ' \u2014 ' + name, '#ff3b30');
      this.cameras.main.shake(220, 0.012);
    } else {
      // rare-event director: occasionally remix this wave for variety. Rolled
      // once here; the chosen event sets flags that spawnOne()/update() honor.
      const evKey = rollEvent(n);
      if (evKey) {
        const ev = getEvent(evKey);
        this.activeEvent = evKey;
        ev.apply(this);
        this.ui.banner(ev.name, ev.color);
        this.ui.floatText(ev.desc, this.player.x, this.player.y - 220, ev.color, 22);
        this.cameras.main.shake(150, 0.01);
      }
      const extra = (this.mods && this.mods.extraPerWave) || 0;
      const base = 2 + Math.floor(n * 0.9) + extra + (this.eventExtraSpawns || 0);
      const count = Math.min(Math.max(1, base), 9);
      this.spawnQueue = count;
      if (!this.activeEvent) this.ui.banner('WAVE ' + n, n === 1 ? '#35e1ff' : '#ffd23f');
    }
    this.spawnTimer = (n === 1) ? CONFIG.RETENTION.WAVE1_FIRST_SPAWN : 0.3;
    this.waveFirstSpawn = true;
    this.audio && this.audio.wave(n);
    // soundtrack follows the wave shape: boss waves get the driving intensity,
    // normal waves relax back to the combat groove (unless we're mid-Second-Wind).
    if (this.audio && this.audio.setMusicIntensity) {
      if (this.isBossWave) this.audio.setMusicIntensity('boss');
      else if (!this.player || !this.player.broken) this.audio.setMusicIntensity('combat');
    }
  }

  spawnOne() {
    if (this.isBossWave) return this._spawnBoss();
    const n = this.wave;
    let variant = 'grunt';
    // RETENTION: wave 2 opens with a vanguard mini-elite — one early "duel"
    // climax inside the first minute. Skipped when an event remixes the wave.
    if (this.waveFirstSpawn && n === CONFIG.RETENTION.VANGUARD_WAVE && !this.activeEvent) {
      variant = 'vanguard';
    } else if (this.eventEliteCount > 0) {
      // ELITE DUO event: the first N spawns of the wave are vanguards.
      variant = 'vanguard';
      this.eventEliteCount--;
    } else if (this.eventForceVariant) {
      variant = this.eventForceVariant;
    } else if (this.eventVariantPool && this.eventVariantPool.length) {
      variant = this.eventVariantPool[Math.floor(Math.random() * this.eventVariantPool.length)];
    } else {
      // weighted composition that scales with wave — early waves stay gentle
      // (wave 1 is grunts only), new archetypes phase in from wave 4-6 so the
      // first minute's teaching beats stay uncontested.
      const table = [];
      if (n >= 6) table.push(['ranger', 10]);
      if (n >= 5) table.push(['shielder', 12]);
      if (n >= 4) table.push(['bomber', 14], ['leaper', 12]);
      if (n >= 3) table.push(['brute', 18]);
      if (n >= 2) table.push(['runner', 22]);
      table.push(['grunt', 30]);
      let total = 0; for (const [, w] of table) total += w;
      let r = Math.random() * total;
      for (const [key, w] of table) { if ((r -= w) <= 0) { variant = key; break; } }
    }
    const firstOfWave = this.waveFirstSpawn;
    this.waveFirstSpawn = false;
    const fromLeft = Math.random() < 0.5;
    // RETENTION: early waves spawn on an inner band (closer to mid) instead of
    // the walls, cutting the ~3.2s "walk-up" dead time to ~1.5s. Wave 4+ still
    // spawns at the walls so late-game pressure comes from the edges as before.
    const early = n <= CONFIG.RETENTION.INNER_SPAWN_WAVES;
    const x = early
      ? (fromLeft ? CONFIG.WALL_LEFT + CONFIG.RETENTION.INNER_SPAWN_OFFSET
                  : CONFIG.WALL_RIGHT - CONFIG.RETENTION.INNER_SPAWN_OFFSET)
      : (fromLeft ? CONFIG.WALL_LEFT + 10 : CONFIG.WALL_RIGHT - 10);
    const e = new Enemy(this, x, CONFIG.GROUND_Y, variant);
    e.facing = fromLeft ? 1 : -1;
    // DEAD TIME: wall-spawned enemies (wave 4+) get a brief entrance sprint so
    // the ~3.8s walk-up to mid doesn't leave a dead gap. Inner-band spawns are
    // already close, so they don't need it.
    if (!early) e.sprintT = CONFIG.RETENTION.SPRINT_IN.TIME;
    // FIRST-TIME ASSIST: wave 1's opening enemy is a passive training dummy so a
    // confused first-timer gets a safe window to land their first punch (and the
    // FIRST BLOOD celebration) instead of bleeding out 0-score. Cleared on hit.
    if (firstOfWave && n === 1) e.passive = true;
    if (this.spawned && this.spawned[variant] != null) this.spawned[variant]++;
    // flank assignment: alternating sides, seeded by spawn side, so the pack
    // surrounds the player rather than stacking on one side. Base the slot on
    // LIVING enemies only — lingering death-anims would otherwise skew the count.
    const aliveCount = this.enemies.filter((e) => !e.dead).length;
    e.flankDir = (aliveCount % 2 === 0) ? (fromLeft ? 1 : -1) : (fromLeft ? -1 : 1);
    this._applyScaling(e, n);
    this.enemies.push(e);
  }

  // shared wave/difficulty scaling — used by normal spawns, the boss, and
  // enrage-summoned adds so the whole curve stays consistent.
  _applyScaling(e, n) {
    const m = this.mods;
    // wave-based scaling — steeper so late waves actually threaten; difficulty
    // preset + daily modifier multiply on top so the whole curve shifts.
    e.speedMul = (1 + Math.min(n, 15) * 0.045) * m.enemySpeed;
    e.hpMul = (1 + Math.min(n, 15) * 0.075) * m.enemyHp;
    // RETENTION: floor early-wave aggression so the first minute has stakes — a
    // passive/casual player now takes a few hits instead of none. The floor only
    // lifts waves 1-3 (the curve exceeds it after); hardcore can still dodge.
    const aggrCurve = 0.8 + Math.min(n - 1, 8) * 0.07;
    e.aggrMul = Math.max(CONFIG.RETENTION.EARLY_AGR_FLOOR, aggrCurve) * m.aggr;
    e.dmgMul = m.enemyDmg;
    e.health = e.maxHealth = e.maxHealth * e.hpMul;
  }

  _spawnBoss() {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? CONFIG.WALL_LEFT + 40 : CONFIG.WALL_RIGHT - 40;
    // alternate boss archetypes so every climactic wave isn't the same duel:
    // boss-index 1 (wave 5), 3 (15), 5 (25)... = the slammer; even indexes
    // (wave 10, 20, 30...) = the caster. Only real boss waves (multiples of 5)
    // use the parity rule; spawning off-context (e.g. the spawnBoss test hook
    // mid-wave-1) defaults to the classic slammer so the canonical boss holds.
    const isRealBossWave = (this.wave % CONFIG.BOSS.WAVE_EVERY === 0);
    const variant = isRealBossWave
      ? ((Math.round(this.wave / CONFIG.BOSS.WAVE_EVERY) % 2 === 1) ? 'boss' : 'bossCaster')
      : 'boss';
    const e = new Enemy(this, x, CONFIG.GROUND_Y, variant);
    e.facing = fromLeft ? 1 : -1;
    e.flankDir = fromLeft ? 1 : -1;
    this._applyScaling(e, this.wave);
    if (this.spawned) {
      if (this.spawned.boss != null) this.spawned.boss++;
      if (variant === 'bossCaster' && this.spawned.bossCaster != null) this.spawned.bossCaster++;
    }
    this.boss = e;
    this.enemies.push(e);
  }

  // enrage callback: summon adds near the boss to raise pressure. The slammer
  // summons grunts (melee pressure); the caster summons leapers (anti-air, to
  // punish jump-dodging its barrage).
  _bossEnrage(boss) {
    this.ui.banner('THE BOSS IS ENRAGED!', '#ff6f5c');
    this._punchZoom(CONFIG.FEEL.ZOOM.HURT, 0, 0);
    this._impactRing(boss.x, boss.y - 80, 0xff3b30, this._ringSpec('HEAVY'));
    this.cameras.main.shake(220, 0.016);
    this.audio && this.audio.bigHit();
    const n = CONFIG.BOSS.ENRAGE_SUMMONS;
    const kind = (CONFIG.BOSS.ENRAGE_SUMMONS_KIND && CONFIG.BOSS.ENRAGE_SUMMONS_KIND[boss.bossKind]) || 'grunt';
    for (let i = 0; i < n; i++) {
      const side = i === 0 ? 1 : -1;
      const x = clamp(boss.x + side * 70, CONFIG.WALL_LEFT + 10, CONFIG.WALL_RIGHT - 10);
      const e = new Enemy(this, x, CONFIG.GROUND_Y, kind);
      e.facing = -side;
      e.flankDir = side;
      this._applyScaling(e, this.wave);
      this.enemies.push(e);
    }
  }

  // ---- boss ground-slam shockwaves ----
  // A shockwave races along the floor; the player must jump (feet rise above
  // SHOCKWAVE_CLEAR px) to clear it. Standing still = guaranteed hit.
  spawnShockwave(x, dir, speed) {
    this.shockwaves.push({
      x, dir, speed, life: CONFIG.BOSS.SHOCKWAVE_LIFE, t: 0, hit: false, dead: false,
    });
  }

  _updateShockwaves(dt) {
    const g = this.shockLayer;
    g.clear();
    const p = this.player;
    const clear = CONFIG.BOSS.SHOCKWAVE_CLEAR;
    for (const s of this.shockwaves) {
      if (s.dead) continue;
      s.t += dt;
      s.life -= dt;
      s.x += s.dir * s.speed * dt;
      if (s.x < CONFIG.WALL_LEFT - 30 || s.x > CONFIG.WALL_RIGHT + 30 || s.life <= 0) {
        s.dead = true; continue;
      }
      // collision: only catches a player whose feet are still near the ground.
      // feetClear = how high the feet have lifted above the floor.
      const feetClear = CONFIG.GROUND_Y - p.y;
      if (!p.dead && p.invuln <= 0 && !s.hit && feetClear < clear && Math.abs(p.x - s.x) < 42) {
        s.hit = true;
        const dmg = Math.round(CONFIG.BOSS.SHOCKWAVE_DAMAGE * this.mods.enemyDmg);
        if (p.takeHit(dmg, s.x, CONFIG.ENEMY.KNOCKBACK)) this._onPlayerHurt(null, { from: s.x });
      }
    }
    // draw surviving shockwaves
    for (const s of this.shockwaves) {
      if (s.dead) continue;
      const fade = clamp01(s.life / 0.6);
      const a = Math.min(1, fade) * (s.hit ? 0.5 : 1);
      // leading vertical "wall" + radiating arc + ground ripple
      g.lineStyle(5, 0xff3b30, a);
      g.lineBetween(s.x, CONFIG.GROUND_Y, s.x, CONFIG.GROUND_Y - 78);
      g.lineStyle(3, 0xffd23f, a * 0.85);
      g.beginPath();
      g.arc(s.x, CONFIG.GROUND_Y, 46, Math.PI, 2 * Math.PI);
      g.strokePath();
      g.lineStyle(2, 0xff8a3d, a * 0.6);
      g.strokeEllipse(s.x, CONFIG.GROUND_Y + 4, 84, 16);
    }
    this.shockwaves = this.shockwaves.filter((s) => !s.dead);
  }

  // ---- ground-fire hazard layer (bomber blasts + meteor scorch) ----
  spawnFireZone(x, opts = {}) {
    this.hazards.push({
      x, w: (opts.radius || 60) * 2,
      life: opts.life || 3, t: Math.random() * 2,
      tick: 0, dps: opts.dps != null ? opts.dps : 24, dead: false,
    });
  }

  _updateHazards(dt) {
    const g = this.fireLayer;
    g.clear();
    const p = this.player;
    const H = CONFIG.CONTENT.HAZARD;
    for (const hz of this.hazards) {
      if (hz.dead) continue;
      hz.t += dt;
      hz.life -= dt;
      if (hz.life <= 0) { hz.dead = true; continue; }
      // damage player standing in the zone (feet near the ground)
      hz.tick -= dt;
      const feetClear = CONFIG.GROUND_Y - p.y;
      if (hz.tick <= 0) {
        hz.tick = H.TICK;
        if (hz.dps > 0 && !p.dead && p.invuln <= 0 && feetClear < 30 && Math.abs(p.x - hz.x) < hz.w / 2) {
          const dmg = Math.max(1, Math.round(hz.dps * H.TICK * this.mods.enemyDmg));
          if (p.takeHit(dmg, hz.x, CONFIG.ENEMY.KNOCKBACK)) this._onPlayerHurt(null, { from: hz.x });
        }
      }
      // damage enemies standing in the fire (emergent friendly-fire chains)
      if (hz.dps > 0) {
        for (const e of this.enemies) {
          if (e.dead || e.isBoss) continue;
          if (Math.abs(e.x - hz.x) < hz.w / 2) e.takeHit(hz.dps * dt, hz.x, 0, 0);
        }
      }
      // draw flame — layered flickering tongues, fading as it dies out
      const fade = clamp01(hz.life / 0.6);
      const cx = hz.x, gy = CONFIG.GROUND_Y;
      g.fillStyle(0xff7a00, 0.22 * fade);
      g.fillEllipse(cx, gy + 2, hz.w * 1.25, 14);
      const tongues = 5;
      for (let i = 0; i < tongues; i++) {
        const frac = i / (tongues - 1);
        const baseX = cx + (frac - 0.5) * hz.w;
        const fh = 26 + Math.sin(hz.t * 11 + i * 1.7) * 12 + Math.cos(hz.t * 7 + i) * 6;
        g.fillStyle(i % 2 ? 0xffd23f : 0xff9a3d, 0.55 * fade);
        g.fillTriangle(baseX - 7, gy, baseX + 7, gy, baseX + Math.sin(hz.t * 9 + i) * 4, gy - Math.max(8, fh));
      }
      g.fillStyle(0xff3b30, 0.6 * fade);
      g.fillEllipse(cx, gy, hz.w * 0.7, 10);
    }
    this.hazards = this.hazards.filter((h) => !h.dead);
  }

  // ---- ranger projectiles (lobbed, gravity-driven) ----
  // An optional dmgOverride lets the caster boss reuse this path with its own
  // per-shot damage (the ranger uses the default R.PROJECTILE_DMG).
  spawnEnemyProjectile(x0, y0, x1, y1, dmgOverride) {
    const R = CONFIG.CONTENT.RANGER;
    const g = CONFIG.GRAVITY;
    const dx = x1 - x0;
    const dist = Math.abs(dx);
    // pick a flight time from distance, then solve the ballistic arc toward the
    // target — gives a readable lob instead of a flat shot.
    const T = clamp(dist / 520, 0.55, 1.3);
    const vx = dx / T;
    const vy = (y1 - y0 - 0.5 * g * T * T) / T;
    this.projectiles.push({
      x: x0, y: y0, vx, vy, t: 0, life: R.PROJECTILE_LIFE, hit: false, dead: false,
      dmg: Math.round((dmgOverride != null ? dmgOverride : R.PROJECTILE_DMG) * this.mods.enemyDmg),
    });
  }

  _updateProjectiles(dt) {
    const g = this.projLayer;
    g.clear();
    const p = this.player;
    const R = CONFIG.CONTENT.RANGER;
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.t += dt; pr.life -= dt;
      pr.vy += CONFIG.GRAVITY * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.life <= 0 || pr.x < CONFIG.WALL_LEFT - 20 || pr.x > CONFIG.WALL_RIGHT + 20) { pr.dead = true; continue; }
      if (pr.y >= CONFIG.GROUND_Y) { this.dustBurst(pr.x, CONFIG.GROUND_Y, 6); pr.dead = true; continue; }
      if (!p.dead && p.invuln <= 0 && !pr.hit) {
        const dx = pr.x - p.x, dy = pr.y - (p.y - 60);
        if (Math.abs(dx) < 26 + R.PROJECTILE_RADIUS && Math.abs(dy) < 72) {
          pr.hit = true; pr.dead = true;
          if (p.takeHit(pr.dmg, pr.x, CONFIG.ENEMY.KNOCKBACK)) this._onPlayerHurt(null, { from: pr.x });
          this.burst(pr.x, pr.y, 0xff5cb0, 14);
          continue;
        }
      }
      // glowing orb + soft trail
      g.fillStyle(0xff5cb0, 0.28);
      g.fillCircle(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, R.PROJECTILE_RADIUS + 4);
      g.fillStyle(0xffe26b, 0.95);
      g.fillCircle(pr.x, pr.y, R.PROJECTILE_RADIUS);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(pr.x, pr.y, R.PROJECTILE_RADIUS * 0.5);
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  // ---- bomber detonation (called from Enemy._detonate) ----
  _detonateBomber(b) {
    const B = CONFIG.CONTENT.BOMBER;
    const x = b.x, y = b.y;
    const p = this.player;
    // blast: contact damage + knockback if the player is in radius
    if (!p.dead && p.invuln <= 0 && Math.abs(p.x - x) < B.BLAST_RADIUS) {
      const dmg = Math.round(B.FIRE_DMG_PLAYER * this.mods.enemyDmg);
      if (p.takeHit(dmg, x, B.BLAST_KNOCKBACK)) this._onPlayerHurt(null, { from: x });
    }
    // chain-damage other enemies in the radius — a baited bomber thins the pack
    for (const e of this.enemies) {
      if (e === b || e.dead) continue;
      if (Math.abs(e.x - x) < B.BLAST_RADIUS) e.takeHit(26, x, B.BLAST_KNOCKBACK * 0.7, 0.04);
    }
    // lingering ground fire
    this.spawnFireZone(x, { life: B.FIRE_LIFE, radius: B.FIRE_RADIUS, dps: B.FIRE_DPS });
    // blast feedback: orange/gold dual ring + downward punch-zoom (weight) +
    // a chunky particle storm. The shockwave ring sells the radius.
    this._impactRing(x, CONFIG.GROUND_Y - 20, 0xff7a00, this._ringSpec('BLAST'));
    this._impactRing(x, CONFIG.GROUND_Y - 20, 0xffd23f, this._ringSpec('KILL'));
    this._punchZoom(CONFIG.FEEL.ZOOM.BLAST, 0, CONFIG.FEEL.SHOVE.DOWN);
    this.burst(x, y - 60, 0xff7a00, 46);
    this.burst(x, y - 60, 0xffd23f, 28);
    this.dustBurst(x, CONFIG.GROUND_Y, 22);
    this.cameras.main.shake(210, 0.024);
    this.audio && this.audio.bigHit();
  }

  // shield "clang" feedback when a light hit is blocked
  _blockSpark(x, y) {
    // a blocked hit still needs to feel like a real collision — a crisp cyan
    // ring + tiny zoom tick + directional spark, just muted vs a clean hit.
    this._impactRing(x, y, 0x35e1ff, CONFIG.FEEL.RING.HIT);
    this._punchZoom(CONFIG.FEEL.ZOOM.HIT * 0.6, 0, 0);
    this._spark(x, y, '#35e1ff');
    this.burst(x, y, 0x35e1ff, 10);
  }

  // ---- meteor storm event ----
  _updateMeteors(dt) {
    const M = CONFIG.CONTENT.METEOR;
    if (this.eventMeteors && this.waveActive) {
      this.meteorTimer -= dt;
      if (this.meteorTimer <= 0) {
        const x = rand(CONFIG.WALL_LEFT + 40, CONFIG.WALL_RIGHT - 40);
        this.meteorWarnings.push({ x, t: 0, warn: M.WARN_TIME, dead: false });
        this.meteorTimer = rand(M.INTERVAL[0], M.INTERVAL[1]);
        this.audio && this.audio.kick();
      }
    }
    const g = this.projLayer; // share the projectile layer for markers + descending rock
    for (const w of this.meteorWarnings) {
      if (w.dead) continue;
      w.t += dt;
      if (w.t >= w.warn) {
        // impact
        const p = this.player;
        if (!p.dead && p.invuln <= 0 && Math.abs(p.x - w.x) < M.RADIUS) {
          const dmg = Math.round(M.DAMAGE * this.mods.enemyDmg);
          if (p.takeHit(dmg, w.x, M.KNOCKBACK)) this._onPlayerHurt(null, { from: w.x });
        }
        // scorch the ground briefly
        this.spawnFireZone(w.x, { life: 1.8, radius: M.RADIUS * 0.75, dps: 18 });
        // a meteor strike deserves a full impact stack: orange ring + zoom
        // punch with downward shove (a rock just slammed the ground).
        this._impactRing(w.x, CONFIG.GROUND_Y - 20, 0xff7a00, this._ringSpec('BLAST'));
        this._punchZoom(CONFIG.FEEL.ZOOM.BLAST, 0, CONFIG.FEEL.SHOVE.DOWN);
        this.burst(w.x, CONFIG.GROUND_Y - 20, 0xff7a00, 36);
        this.dustBurst(w.x, CONFIG.GROUND_Y, 22);
        this.cameras.main.shake(170, 0.018);
        this.audio && this.audio.bigHit();
        w.dead = true;
      } else {
        // telegraph: a ground ring filling up + a descending rock
        const a = clamp01(w.t / w.warn);
        g.lineStyle(3, 0xff3b30, 0.35 + 0.55 * a);
        g.strokeEllipse(w.x, CONFIG.GROUND_Y + 4, M.RADIUS * 1.7, 24);
        g.fillStyle(0xff3b30, 0.14 * a);
        g.fillEllipse(w.x, CONFIG.GROUND_Y + 4, M.RADIUS * 1.7, 24);
        g.fillStyle(0xffd23f, 1);
        const rockY = CONFIG.GROUND_Y - 560 * (1 - a);
        g.fillCircle(w.x, rockY, 9);
        g.fillStyle(0xff7a00, 0.5);
        g.fillCircle(w.x, rockY + 14, 7);
      }
    }
    this.meteorWarnings = this.meteorWarnings.filter((w) => !w.dead);
  }

  // ---- rage buff (rage pickup / RAGE MODE event) ----
  _startRage(time) {
    this.rageT = time;
    this.rageMax = time;
    this.cameras.main.shake(100, 0.01);
    this.audio && this.audio.combo(12);
  }

  // combined score multiplier: difficulty/daily * rage buff
  _scoreMul() {
    const base = (this.mods && this.mods.scoreMul) || 1;
    return this.rageT > 0 ? base * CONFIG.CONTENT.PICKUP.RAGE_SCORE_MUL : base;
  }

  // ---- supply drop event ----
  _dropSupply() {
    const cx = clamp(this.player.x + rand(-140, 140), CONFIG.WALL_LEFT + 60, CONFIG.WALL_RIGHT - 60);
    const gold = new Pickup(this, cx - 44, 90, 'score', { drop: true });
    const rage = new Pickup(this, cx + 44, 90, 'rage', { drop: true });
    this.pickups.push(gold, rage);
    this.ui.floatText('SUPPLY!', cx, 160, '#35e1ff', 26);
  }

  // ---- SECOND WIND ("The Broken") ----
  // Fires once per run when the player takes lethal damage: instead of dying,
  // they shatter into a 1-HP last stand. This method is the shatter payoff —
  // visuals + a guaranteed heal lifeline so reform is always POSSIBLE (skill,
  // not RNG) while still demanding a kill-or-chase under pressure.
  _onEnterBroken() {
    const L = CONFIG.LASTSTAND;
    const p = this.player;
    const F = CONFIG.FEEL;
    // SHATTER feedback: the strongest "you almost died" beat in the game.
    this.slowmo = Math.max(this.slowmo, 0.45);
    this.hitPause = Math.max(this.hitPause, 0.16);
    this._impactRing(p.x, p.y - 80, 0xff3b30, this._ringSpec('BOSS_KILL'));
    this._impactRing(p.x, p.y - 80, 0xffffff, this._ringSpec('HURT'));
    this._punchZoom(F.ZOOM.BOSS_KILL, 0, F.SHOVE.DOWN);
    this.cameras.main.shake(320, 0.028);
    this.burst(p.x, p.y - 70, 0xff3b30, 50);
    this.burst(p.x, p.y - 70, 0xeaf4ff, 26);
    // spawn the detached right arm as a short-lived physics prop
    this.debris.push({
      x: p.x + p.facing * 14, y: p.y - 96, vx: -p.facing * 220 + rand(-60, 60),
      vy: -340, rot: rand(-0.5, 0.5), vr: rand(-9, 9), t: 0, life: 5.0,
      onGround: false, len: 64,
    });
    // guaranteed lifeline: a health drop falls near the player so reform is
    // never purely RNG-gated. Place it offset so the player must commit.
    const lx = clamp(p.x + rand(-150, 150), CONFIG.WALL_LEFT + 50, CONFIG.WALL_RIGHT - 50);
    this.pickups.push(new Pickup(this, lx, 80, 'health', { drop: true }));
    this.ui.banner('SECOND WIND!', '#ff3b30');
    this.ui.floatText('SHATTERED', p.x, p.y - 200, '#ff3b30', 34);
    this.audio && this.audio.gameover && this.audio.bigHit && this.audio.bigHit();
    // the soundtrack turns desperate during the last stand.
    this.audio && this.audio.setMusicIntensity && this.audio.setMusicIntensity('broken');
  }

  // REFORM: called from the health-pickup path while broken. Snaps the arm back
  // (render reads broken=false), restores HP, fires the survival climax.
  _reform() {
    const L = CONFIG.LASTSTAND;
    const p = this.player;
    const F = CONFIG.FEEL;
    p.broken = false;
    p.reformed = true;
    p.brokenT = 0;
    p.invuln = Math.max(p.invuln, 0.8);
    p.health = Math.max(1, Math.round(p.maxHealth * L.REFORM_HP_FRAC));
    const bonus = Math.round(L.REFORM_SCORE_BONUS * this._scoreMul());
    this.score += bonus;
    this.healed += p.health;
    // climax: golden flood — the arm returns, colour washes back, big payoff.
    this.slowmo = Math.max(this.slowmo, L.REFORM_SLOWMO);
    this.hitPause = Math.max(this.hitPause, 0.12);
    this._impactRing(p.x, p.y - 80, 0xffd23f, this._ringSpec('BOSS_KILL'));
    this._impactRing(p.x, p.y - 80, 0x6bff9e, this._ringSpec('KILL'));
    this._punchZoom(F.ZOOM.BOSS_KILL, 0, 0);
    this.cameras.main.shake(260, 0.02);
    this.burst(p.x, p.y - 70, 0xffd23f, 56);
    this.burst(p.x, p.y - 70, 0x6bff9e, 30);
    this.ui.banner('REFORMED!  +' + bonus, '#6bff9e');
    this.ui.floatText('REFORMED!', p.x, p.y - 200, '#6bff9e', 36);
    this.audio && this.audio.combo && this.audio.combo(16);
    // survival resolved — hand the soundtrack back to the wave's intensity.
    if (this.audio && this.audio.setMusicIntensity) {
      this.audio.setMusicIntensity(this.isBossWave ? 'boss' : 'combat');
    }
  }

  // shatter-prop physics + draw (a detached stickman arm = two line segments)
  _updateDebris(dt) {
    const g = this.debrisLayer;
    g.clear();
    for (const d of this.debris) {
      d.t += dt;
      d.life -= dt;
      if (!d.onGround) {
        d.vy += CONFIG.GRAVITY * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
        if (d.y >= CONFIG.GROUND_Y - 4) {
          d.y = CONFIG.GROUND_Y - 4; d.vy = 0; d.vx *= 0.4; d.vr *= 0.3;
          if (Math.abs(d.vx) < 6) { d.onGround = true; d.vx = 0; d.vr = 0; }
        }
        if (d.x < CONFIG.WALL_LEFT) { d.x = CONFIG.WALL_LEFT; d.vx *= -0.4; }
        if (d.x > CONFIG.WALL_RIGHT) { d.x = CONFIG.WALL_RIGHT; d.vx *= -0.4; }
      }
      // fade out in the last second
      const fade = d.life < 1 ? Math.max(0, d.life) : 1;
      // draw a two-segment arm pivoting at d.rot
      const ux = Math.cos(d.rot), uy = Math.sin(d.rot);
      const hx = d.x, hy = d.y - d.len * 0.5;
      const ex = d.x + ux * d.len * 0.5, ey = hy + uy * d.len * 0.5 + d.len * 0.5;
      g.lineStyle(8, 0x05070d, fade);
      g.lineBetween(hx, hy, ex, ey);
      g.lineBetween(ex, ey, ex + ux * d.len * 0.4, ey + uy * d.len * 0.4 + d.len * 0.3);
      g.lineStyle(6, 0xeaf4ff, fade);
      g.lineBetween(hx, hy, ex, ey);
      g.lineBetween(ex, ey, ex + ux * d.len * 0.4, ey + uy * d.len * 0.4 + d.len * 0.3);
      g.fillStyle(0xbfe3ff, fade);
      g.fillCircle(hx, hy, 4); g.fillCircle(ex, ey, 4);
    }
    this.debris = this.debris.filter((d) => d.life > 0);
  }

  // monochrome + red-edge vignette while in the broken window (depth above all)
  _updateVeil(dt) {
    const g = this.veilLayer;
    g.clear();
    const p = this.player;
    if (!p.broken) return;
    const L = CONFIG.LASTSTAND;
    // intensity ramps: snap to full on entry, pulse with the heartbeat, fade as
    // the window closes so the final second reads as desperate.
    const frac = clamp(p.brokenT / L.DURATION, 0, 1);
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now * 0.012);
    const edge = (0.55 + 0.35 * (1 - frac)) * pulse;
    // full-screen dark wash (the desaturate analogue for procedural art)
    g.fillStyle(0x0b0e16, 0.45 * edge);
    g.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    // red inner vignette ring
    const cx = CONFIG.WIDTH / 2, cy = CONFIG.HEIGHT / 2;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      g.lineStyle(60 + t * 120, 0xff3b30, 0.04 * edge * (1 - t));
      g.strokeRect(-120 + t * 60, -120 + t * 60, CONFIG.WIDTH + 240 - t * 120, CONFIG.HEIGHT + 240 - t * 120);
    }
    // heartbeat throb at the screen centre (a soft red disc behind the player)
    g.fillStyle(0xff3b30, 0.05 * edge * pulse);
    g.fillCircle(cx, cy, 240 + 40 * pulse);
  }

  // ---- combat ----
  _resolveCombat() {
    const p = this.player;

    // player -> enemies
    const phb = p.getHitbox();
    if (phb) {
      // RAGE + SECOND WIND: both amplify the player's outgoing damage. Compose
      // an effective hitbox so the kill-prediction + takeHit both see the boost.
      const rageMul = this.rageT > 0 ? CONFIG.CONTENT.PICKUP.RAGE_DMG_MUL : 1;
      const brokenMul = this.player.broken ? CONFIG.LASTSTAND.DMG_MUL : 1;
      const outMul = rageMul * brokenMul;
      const dmg = Math.round(phb.dmg * outMul);
      const eff = (outMul === 1) ? phb : { x: phb.x, y: phb.y, w: phb.w, h: phb.h, swing: phb.swing, dmg, kb: phb.kb, pause: phb.pause, from: phb.from };
      for (const e of this.enemies) {
        if (e.dead || e.lastSwing === p.swingId) continue;
        if (aabb(eff, e.bodyBox())) {
          e.lastSwing = p.swingId;
          // record the connection so the player's whiff-penalty logic knows this
          // swing landed (a missed kick recovers slower than a connecting one).
          if (p.attack) p.attack.connected = true;
          // decide kill from pre-hit health so the death anim/K.O. feedback lines
          // up with takeHit's own <=0 check.
          const killed = e.health - eff.dmg <= 0;
          e.takeHit(eff.dmg, eff.from, eff.kb, eff.pause);
          this._onPlayerHit(e, eff, killed);
        }
      }
    }

    // enemies -> player
    if (!p.dead && p.invuln <= 0) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        const ehb = e.getHitbox(p);
        if (ehb && aabb(ehb, p.bodyBox())) {
          if (p.takeHit(ehb.dmg, ehb.from, ehb.kb)) {
            this._onPlayerHurt(e, ehb);
          }
          break;
        }
      }
    }
  }

  _onPlayerHit(enemy, hb, killed) {
    const F = CONFIG.FEEL;
    const heavy = hb.kb > 400;
    // extra hitstop for weight on heavy connecting hits (stacks on the attack's
    // base HIT_PAUSE). The kill branch adds more below.
    this.hitPause = Math.max(this.hitPause, hb.pause + (heavy ? F.PAUSE.HEAVY : 0));
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = CONFIG.COMBO_WINDOW;
    // RETENTION: first time the player damages an enemy — drives the teaching
    // callouts (hide the pre-contact pointer once they've actually landed a hit).
    if (!this.onboard.firstHit) this.onboard.firstHit = true;
    const mult = 1 + Math.floor((this.combo - 1) / 4) * 0.5;
    const scoreMul = this._scoreMul();
    const gain = Math.round(10 * mult * scoreMul);
    this.score += gain;
    // hit direction: the blow travels from the player (hb.from) toward the enemy.
    const dirX = Math.sign(enemy.x - hb.from) || (enemy.x >= hb.from ? 1 : -1);
    const hitY = enemy.y - 70 * enemy.scale;
    const sparkColor = heavy ? '#ffd23f' : '#ffffff';
    // juice stack: directional spark + impact ring + punch-zoom + recoil shove.
    this._impactFX(enemy.x, hitY, enemy.v.palette.fist, dirX,
      heavy ? 'HEAVY' : 'HIT', heavy ? 'HEAVY' : 'HIT', sparkColor);
    // particles scale with weight; the fist-tint burst reads as a chunk of the
    // enemy getting knocked loose.
    this.burst(enemy.x, hitY, enemy.v.palette.fist, heavy ? 20 : 13);
    // snappier shake than before (was 0.006/0.012) so each connection has bite.
    this.cameras.main.shake(heavy ? 90 : 60, heavy ? 0.014 : 0.009);
    this.audio && this.audio.hit();
    if (this.combo > 1) this.audio && this.audio.combo(this.combo);
    this.ui.floatText('+' + gain, enemy.x, enemy.y - 120 * enemy.scale, '#ffd23f');
    // periodic multiplier reminder (every 3rd hit) — a per-hit xN popup would
    // duplicate the +gain popup above and spam the screen. (`% 1` was always true.)
    if (this.combo >= 3 && this.combo % 3 === 0) {
      this.ui.floatText('x' + this.combo, this.player.x, this.player.y - 220, '#35e1ff', 26);
    }
    this._checkComboTier();
    if (killed) {
      this.kills++;
      // COMBO BRIDGE: a kill extends the combo window so the chain survives the
      // gap to the next enemy. Without this, casuals stall just below the x10
      // milestone — the window can't bridge a dead enemy to the next walk-up.
      this.comboTimer = Math.max(this.comboTimer, CONFIG.COMBO_WINDOW + CONFIG.COMBO_KILL_BRIDGE);
      // SECOND WIND: a kill during the broken window is a lifeline — extend the
      // timer and roll a health drop so reform stays within reach.
      if (this.player.broken) {
        const L = CONFIG.LASTSTAND;
        this.player.brokenT = Math.min(this.player.brokenT + L.KILL_TIME_BONUS, this.player.brokenMax + 3);
        this.ui.floatText('+' + (L.KILL_TIME_BONUS.toFixed(1)) + 's', enemy.x, enemy.y - 170 * enemy.scale, '#ff3b30', 20);
        if (enemy.variant !== 'bomber' && Math.random() < L.KILL_HEAL_CHANCE) {
          this.pickups.push(new Pickup(this, enemy.x, enemy.y - 60, 'health'));
        }
      }
      // a kill always carries a touch more hitstop for the "finishing" weight.
      this.hitPause = Math.max(this.hitPause, hb.pause + F.PAUSE.KILL);
      // RETENTION: FIRST BLOOD — celebrate the run's first (non-boss) kill with a
      // bigger slow-mo + banner. It lands ~3-5s in: the cheapest possible memory
      // peak during the most churn-prone moment. Fires once; boss kills have
      // their own climax and are excluded.
      if (!this.firstBloodDone && !enemy.isBoss) {
        this.firstBloodDone = true;
        this.slowmo = Math.max(this.slowmo, CONFIG.RETENTION.FIRST_BLOOD_SLOWMO);
        this.hitPause = Math.max(this.hitPause, CONFIG.RETENTION.FIRST_BLOOD_PAUSE);
        this.cameras.main.shake(190, 0.016);
        this.ui.banner('FIRST BLOOD!', '#ff8a3d');
        this.ui.floatText('FIRST BLOOD!', this.player.x, this.player.y - 220, '#ff8a3d', 30);
      }
      // BOSS payoff: a climactic moment — long slow-mo, big shake, banner,
      // guaranteed heal drop, huge score. Worth the climb.
      if (enemy.isBoss) {
        this.boss = null;
        this.slowmo = Math.max(this.slowmo, 0.5);
        this.hitPause = Math.max(this.hitPause, 0.18);
        const bx = enemy.x, by = enemy.y - 80 * enemy.scale;
        // peak feedback: biggest zoom + ring + downward shove (sells the weight
        // of a giant toppling) + dual-color particle storm.
        this._impactRing(bx, by, 0xffd23f, this._ringSpec('BOSS_KILL'));
        this._impactRing(bx, by, 0xff3b30, this._ringSpec('KILL'));
        this._punchZoom(F.ZOOM.BOSS_KILL, 0, F.SHOVE.DOWN);
        this.cameras.main.shake(300, 0.026);
        this.burst(bx, by, 0xffd23f, 64);
        this.burst(bx, by, 0xff3b30, 44);
        const bonus = Math.round(CONFIG.BOSS.SCORE * scoreMul);
        this.score += bonus;
        this.ui.banner('BOSS DOWN!  +' + bonus, '#ffd23f');
        this.ui.floatText('BOSS DOWN!', enemy.x, enemy.y - 200 * enemy.scale, '#ffd23f', 40);
        this.pickups.push(new Pickup(this, enemy.x, enemy.y - 60, 'health'));
        this.audio && this.audio.bigHit();
        return;
      }
      const gain2 = Math.round(enemy.v.score * mult * scoreMul);
      this.score += gain2;
      const kx = enemy.x, ky = enemy.y - 70 * enemy.scale;
      // K.O. feedback: kill-tier ring + zoom, on top of the per-hit stack above.
      this._impactRing(kx, ky, enemy.v.palette.accent, this._ringSpec('KILL'));
      this._punchZoom(F.ZOOM.KILL, 0, 0);
      this.camShoveX = clamp(this.camShoveX - dirX * F.SHOVE.KILL, -F.SHOVE.BOSS, F.SHOVE.BOSS);
      this.burst(kx, ky, enemy.v.palette.accent, 30);
      this.cameras.main.shake(120, 0.014);
      this.audio && this.audio.bigHit();
      this.slowmo = 0.18;
      this.ui.floatText('K.O. +' + gain2, enemy.x, enemy.y - 150 * enemy.scale, enemy.v.palette.fist, 26);
      // chance to drop a pickup (more likely if player low). Bombers never drop
      // a heal-on-death (they leave a fire zone instead); rare rage drop otherwise.
      const dropChance = this.player.health < 40 ? 0.4 : 0.2;
      if (Math.random() < dropChance && this.player.health < this.player.maxHealth && enemy.variant !== 'bomber') {
        this.pickups.push(new Pickup(this, enemy.x, enemy.y - 60, 'health'));
      } else if (enemy.variant !== 'bomber' && Math.random() < 0.04 && this.rageT <= 0) {
        // very rare rage drop from any non-boss kill
        this.pickups.push(new Pickup(this, enemy.x, enemy.y - 60, 'rage'));
      }
    }
  }

  _onPlayerHurt(enemy, hb) {
    const F = CONFIG.FEEL;
    this.combo = 0;
    this.comboTimer = 0;
    this.hitsTaken++;
    this.hitPause = Math.max(this.hitPause, 0.08);
    // a hit on the player is the other key feedback peak — zoom punch + red ring
    // + a shake with real bite so getting hurt actually hurts.
    const hx = this.player.x, hy = this.player.y - 100;
    const dirX = enemy ? Math.sign(this.player.x - enemy.x) || 1 : (hb && hb.from != null ? Math.sign(this.player.x - hb.from) || 1 : 1);
    this._impactRing(hx, hy, 0xff3b30, this._ringSpec('HURT'));
    this._punchZoom(F.ZOOM.HURT, dirX, 0);
    this.cameras.main.shake(170, 0.022);
    this.burst(hx, hy, COLORS.player.accent, 20);
    this._spark(hx, hy, '#ff3b30', dirX);
    this.audio && this.audio.bigHit();
  }

  _spark(x, y, color, dirX) {
    const g = this.fxLayer;
    const cnum = (typeof color === 'string') ? parseInt(color.replace('#', ''), 16) : (color || 0xffffff);
    const dir = dirX ? Math.sign(dirX) : 0;
    const baseAng = dir !== 0 ? (dir > 0 ? 0 : Math.PI) : -1;
    // white-hot core flash (reads as the moment of contact)
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(x, y, 7);
    g.fillStyle(cnum, 0.5);
    g.fillCircle(x, y, 13);
    // bright streaks fanning out in the blow's direction (or omnidirectional
    // when no dir) — thicker + more than before so the strike reads at a glance.
    const n = dir !== 0 ? 7 : 6;
    g.lineStyle(3, cnum, 1);
    for (let i = 0; i < n; i++) {
      const a = dir !== 0
        ? baseAng + rand(-0.95, 0.95)
        : (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const r2 = rand(20, 34);
      g.lineBetween(x, y, x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    }
    // a couple of bright white tips for extra crackle
    g.lineStyle(2, 0xffffff, 0.85);
    for (let i = 0; i < 2; i++) {
      const a = dir !== 0 ? baseAng + rand(-0.6, 0.6) : Math.random() * Math.PI * 2;
      const r2 = rand(14, 22);
      g.lineBetween(x, y, x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    }
    this.time.delayedCall(85, () => this.fxLayer.clear());
  }

  _checkComboTier() {
    if (!CONFIG.COMBO_TIERS || !CONFIG.COMBO_TIERS.length) return;
    if (CONFIG.COMBO_TIERS.indexOf(this.combo) === -1) return;
    const tierNames = { 5: 'NICE!', 10: 'GREAT!', 15: 'AWESOME!', 20: 'INSANE!', 30: 'GODLIKE!' };
    // tier bonus honours the active score multiplier (daily modifiers like
    // BLOODLUST x2 / HUNTER x1.3) so it's consistent with hit/kill/wave scoring.
    const bonus = Math.round(CONFIG.COMBO_TIER_BONUS * (this.mods && this.mods.scoreMul || 1));
    this.score += bonus;
    this.tierBonuses++;
    // persist the new best-combo immediately so a milestone unlock (e.g. the
    // GOLD skin at x20) survives even if the run never reaches _endGame.
    Meta.noteCombo(this.combo);
    const label = tierNames[this.combo] || ('COMBO x' + this.combo);
    this.ui.banner(label + '  +' + bonus, '#ffd23f');
    this.audio && this.audio.combo(this.combo + 4);
    this.cameras.main.shake(140, 0.012);
  }

  // ---- update ----
  update(time, dtMs) {
    let dt = Math.min(dtMs / 1000, 0.05);
    this._drawShadows();

    if (this.paused) return;

    // hit pause freeze
    if (this.hitPause > 0) {
      this.hitPause -= dtMs / 1000;
      // feedback layers keep playing during the freeze so the impact reads: the
      // ring expands across the frozen frame and the zoom holds at its peak.
      // dt=0 here keeps the camera boost/shove from decaying mid-freeze.
      this._updateRings(dt);
      this._updateCamera(0);
      this._updateHUD();
      return;
    }

    // combine input sources: keyboard + touch (written by UIScene)
    const k = this.keys;
    const c = this.controls;
    let kbDir = 0;
    if (k.left.isDown || k.left2.isDown) kbDir -= 1;
    if (k.right.isDown || k.right2.isDown) kbDir += 1;
    const kbJumpHeld = k.jump.isDown || k.up.isDown || k.up2.isDown;
    if (kbJumpHeld) this.audio && this.audio.resume();

    c.dir = c.touchActive ? c.touchDir : kbDir;
    c.jumpHeld = c.jumpHeldTouch || kbJumpHeld;

    // progressive onboarding: flag each action the first time it's used.
    // NOTE: jump is only OBSERVED here — its action lives in Player.update (the
    // jump-buffer arm), so c.jumpPressed must survive until player.update() reads
    // it. Consuming it here (like punch/kick) starved the buffer and broke every
    // jump key (W / Space / Up). It is cleared after player.update() below.
    const ob = this.onboard;
    ob.t += dt;
    if (c.dir !== 0) ob.move = true;
    if (c.punchPressed) { p_tryAttack(this, 'punch'); c.punchPressed = false; ob.punch = true; }
    if (c.kickPressed) { p_tryAttack(this, 'kick'); c.kickPressed = false; ob.kick = true; }
    if (c.jumpPressed) ob.jump = true;

    // slow-motion right after a kill
    let stepDt = dt;
    if (this.slowmo > 0) {
      this.slowmo -= dtMs / 1000;
      stepDt = dt * 0.35;
    }

    this.player.update(stepDt, c);
    c.jumpPressed = false; // now that Player has read it, consume the edge

    // wave logic
    if (this.waveActive) {
      if (this.spawnQueue > 0) {
        this.spawnTimer -= stepDt;
        // gate on LIVING enemies only — dead-but-animating corpses briefly linger
        // in the array (their death tween runs to completion before destroy()).
        const aliveNow = this.enemies.filter((e) => !e.dead).length;
        if (this.spawnTimer <= 0 && aliveNow < CONFIG.ENEMY.MAX_ALIVE) {
          this.spawnOne();
          this.spawnQueue--;
          // RETENTION: tighter spawn cadence early so the action stays dense in
          // the first minute (was a flat 0.3-0.65 for all waves).
          const gap = (this.wave <= CONFIG.RETENTION.INNER_SPAWN_WAVES)
            ? CONFIG.RETENTION.EARLY_SPAWN_GAP : CONFIG.RETENTION.LATE_SPAWN_GAP;
          this.spawnTimer = rand(gap[0], gap[1]);
        }
      } else {
        const alive = this.enemies.filter((e) => !e.dead).length;
        if (alive === 0) {
          this.waveActive = false;
          // RETENTION: shorter between-wave gap in the first few waves so the
          // first minute keeps momentum (1.1s -> 0.7s); late waves keep the
          // breathing room.
          this.waveBreak = (this.wave <= CONFIG.RETENTION.EARLY_WAVE_BREAK_WAVES)
            ? CONFIG.RETENTION.EARLY_WAVE_BREAK : CONFIG.RETENTION.LATE_WAVE_BREAK;
          const clearBonus = Math.round(100 * this.wave * this._scoreMul());
          this.score += clearBonus;
          this.ui.banner('WAVE CLEAR  +' + clearBonus, '#6bff9e');
        }
      }
    } else {
      this.waveBreak -= stepDt;
      if (this.waveBreak <= 0) this.startWave(this.wave + 1);
    }

    for (const e of this.enemies) e.update(stepDt, this.player);
    // cleanup only fully-destroyed enemies (scene nulled by Phaser.destroy()).
    // Dead-but-animating enemies stay so their death tween + destroy() can run;
    // removing them early left frozen corpses on screen and leaked Graphics.
    this.enemies = this.enemies.filter((e) => e.scene);

    // pickups
    for (const p of this.pickups) {
      p.update(stepDt, this.player);
      if (p._collected) {
        if (p.type === 'health') {
          // SECOND WIND: grabbing health while broken REFORMS — the run survives.
          if (this.player.broken) {
            this._reform();
          } else {
            const heal = 25;
            this.player.health = Math.min(this.player.maxHealth, this.player.health + heal);
            this.healed += heal;
            this.burst(this.player.x, this.player.y - 60, 0x35e1ff, 16);
            this.audio && this.audio.combo(8);
            this.ui.floatText('+' + heal + ' HP', this.player.x, this.player.y - 160, '#35e1ff', 22);
          }
        } else if (p.type === 'rage') {
          this._startRage(CONFIG.CONTENT.PICKUP.RAGE_TIME);
          this.ui.banner('RAGE!', '#ff8a3d');
          this.ui.floatText('RAGE MODE', this.player.x, this.player.y - 160, '#ff8a3d', 26);
          this.burst(this.player.x, this.player.y - 60, 0xff8a3d, 22);
        } else if (p.type === 'score') {
          const bonus = Math.round(CONFIG.CONTENT.PICKUP.SCORE_BONUS * this._scoreMul());
          this.score += bonus;
          this.ui.floatText('+' + bonus, this.player.x, this.player.y - 160, '#ffd23f', 28);
          this.burst(this.player.x, this.player.y - 60, 0xffd23f, 22);
          this.audio && this.audio.combo(10);
        }
      }
    }
    this.pickups = this.pickups.filter((p) => p.scene);

    this._resolveCombat();
    this._updateShockwaves(stepDt);
    this._updateHazards(stepDt);
    this._updateProjectiles(stepDt);
    this._updateMeteors(stepDt);
    this._updateDebris(dt);   // real-time: the shatter prop fades regardless of slow-mo
    this._updateVeil(dt);

    // rage buff timer
    if (this.rageT > 0) {
      const wasRage = this.rageT > 0;
      this.rageT -= dt;
      if (wasRage && this.rageT <= 0) {
        this.rageT = 0;
        this.ui.floatText('RAGE OFF', this.player.x, this.player.y - 140, '#9bb4c8', 20);
      }
    }

    // combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // death transition
    if (this.player.dead && !this.gameOver) {
      this.gameOver = true;
      this.audio && this.audio.gameover();
      this.time.delayedCall(1400, () => this._endGame());
    }

    // feedback layers run on real time so the juice always feels the same,
    // independent of gameplay slow-mo.
    this._updateRings(dt);
    this._updateCamera(dt);

    this._updateHUD();
  }

  _drawShadows() {
    const g = this.shadows;
    g.clear();
    g.fillStyle(0x000000, 0.28);
    const drawShadow = (x, y, scale) => {
      const h = clamp((CONFIG.GROUND_Y - y) / 400, 0, 1);
      const w = (38 - 14 * h) * scale;
      g.fillEllipse(x, CONFIG.GROUND_Y + 4, w, 9 * scale);
    };
    drawShadow(this.player.x, this.player.y, 1);
    for (const e of this.enemies) if (!e.dead) drawShadow(e.x, e.y, e.scale);
  }

  _updateHUD() {
    const alive = this.enemies.filter((e) => !e.dead);
    const counts = { grunt: 0, runner: 0, brute: 0, leaper: 0, vanguard: 0, shielder: 0, bomber: 0, ranger: 0, boss: 0, bossCaster: 0 };
    for (const e of alive) if (counts[e.variant] != null) counts[e.variant]++;
    // boss HP for the top-of-screen bar (null when no boss is alive)
    const bossAlive = this.boss && !this.boss.dead ? this.boss : null;
    this.registry.set('hud', {
      health: this.player.health, maxHealth: this.player.maxHealth,
      score: this.score, wave: this.wave, combo: this.combo,
      enemiesLeft: alive.length + this.spawnQueue,
      bestCombo: this.bestCombo,
      comboTimer: this.comboTimer, comboWindow: CONFIG.COMBO_WINDOW,
      boss: bossAlive ? { hp: this.boss.health, maxHp: this.boss.maxHealth, enraged: this.boss.enraged, kind: this.boss.bossKind, name: CONFIG.BOSS.NAME[this.boss.bossKind] } : null,
      rage: Math.max(0, this.rageT), rageMax: this.rageMax,
      event: this.activeEvent,
      broken: this.player.broken, brokenT: this.player.brokenT, brokenMax: this.player.brokenMax,
    });
    if (typeof window !== 'undefined') {
      window.__stickman = {
        state: this.gameOver ? 'dying' : 'game',
        score: this.score, wave: this.wave, combo: this.combo,
        bestCombo: this.bestCombo, health: this.player.health,
        enemiesAlive: alive.length, spawnQueue: this.spawnQueue,
        waveActive: this.waveActive,
        hitsTaken: this.hitsTaken, healed: this.healed,
        onboard: Object.assign({}, this.onboard),
        variants: counts,
        spawned: Object.assign({}, this.spawned),
        comboTimer: this.comboTimer,
        tierBonuses: this.tierBonuses,
        difficulty: this.diff && this.diff.label,
        kills: this.kills,
        daily: this.daily ? this.daily.name : null,
        scoreMul: this.mods && this.mods.scoreMul,
        isBossWave: this.isBossWave,
        bossActive: !!(bossAlive),
        bossHp: bossAlive ? bossAlive.health : 0,
        bossMaxHp: bossAlive ? bossAlive.maxHealth : 0,
        bossEnraged: bossAlive ? bossAlive.enraged : false,
        bossKind: bossAlive ? bossAlive.bossKind : null,
        shockwaves: this.shockwaves.length,
        pickups: this.pickups.length,
        firstBlood: this.firstBloodDone,
        // round-5 content telemetry
        hazards: this.hazards.length,
        projectiles: this.projectiles.length,
        meteors: this.meteorWarnings.length,
        rage: Math.max(0, this.rageT),
        event: this.activeEvent,
        // SECOND WIND telemetry
        broken: this.player.broken,
        brokenT: this.player.brokenT,
        brokenMax: this.player.brokenMax,
        secondWindUsed: this.player.secondWindUsed,
        reformed: !this.player.broken && this.player.secondWindUsed,
        // generative-soundtrack state (observable for tests / debug)
        music: this.audio && this.audio.getMusicState ? this.audio.getMusicState() : null,
      };
    }
  }

  _endGame() {
    let hsRaw = '0';
    try { hsRaw = localStorage.getItem('stickman_arena_hs') || '0'; } catch (e) {}
    const hs = parseInt(hsRaw, 10);
    // decide "new best" against the PRE-save value so an exact tie of the
    // existing high score is not mis-reported as a new record.
    const newBest = this.score > hs && this.score > 0;
    if (this.score > hs) { try { localStorage.setItem('stickman_arena_hs', String(this.score)); } catch (e) {} }
    // meta-progression: persist stats, compute unlocks, track daily best
    const rec = Meta.recordRun({
      kills: this.kills, wave: this.wave, bestCombo: this.bestCombo, score: this.score,
    });
    let newDailyBest = false;
    if (this.daily) newDailyBest = Meta.recordDaily(this.score);
    this.scene.stop('UI');
    this.scene.start('GameOver', {
      score: this.score, wave: this.wave, bestCombo: this.bestCombo,
      kills: this.kills, stats: rec.stats, newlyUnlocked: rec.newlyUnlocked,
      newBest,
      daily: this.daily ? Object.assign({ newBest: newDailyBest }, Meta.dailyBest()) : null,
      mods: this.mods,
    });
  }
}

function p_tryAttack(scene, type) {
  const p = scene.player;
  // face toward nearest enemy if no input direction
  let faceDir = 0;
  const c = scene.controls;
  if (c.dir !== 0) faceDir = sign(c.dir);
  else {
    let best = null, bd = 1e9;
    for (const e of scene.enemies) {
      if (e.dead) continue;
      const d = Math.abs(e.x - p.x);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) faceDir = sign(best.x - p.x) || p.facing;
  }
  p.tryAttack(type, faceDir);
}
