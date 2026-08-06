import { CONFIG } from '../config.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Pickup } from '../entities/Pickup.js';
import { drawBackground } from '../utils/background.js';
import { aabb, clamp, sign, rand, randInt } from '../utils/math.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    drawBackground(this);
    this.audio = this.registry.get('audio');
    this.audio && this.audio.resume();

    this.shadows = this.add.graphics().setDepth(5);
    this.fxLayer = this.add.graphics().setDepth(20); // hit sparks drawn directly
    this.enemies = [];
    this.pickups = [];
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
    this.spawned = { grunt: 0, runner: 0, brute: 0, leaper: 0 };
    this.tierBonuses = 0;
    this.onboard = { move: false, jump: false, punch: false, kick: false, t: 0 };

    this.player = new Player(this, CONFIG.WIDTH / 2, CONFIG.GROUND_Y);
    this.player.facing = 1;

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
    // hit burst emitter
    this.hitEmitter = this.add.particles(0, 0, 'dot', {
      speed: { min: 120, max: 420 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      lifespan: { min: 220, max: 480 },
      blendMode: 'ADD',
      quantity: 14,
      emitting: false,
    }).setDepth(30);
    this.dustEmitter = this.add.particles(0, 0, 'dot', {
      speed: { min: 40, max: 140 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 200, max: 380 },
      tint: 0x6b86a3,
      quantity: 6,
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

  // ---- waves ----
  startWave(n) {
    this.wave = n;
    this.waveActive = true;
    const count = Math.min(2 + Math.floor(n * 0.9), 8);
    this.spawnQueue = count;
    this.spawnTimer = 0.3;
    this.ui.banner('WAVE ' + n, n === 1 ? '#35e1ff' : (n % 5 === 0 ? '#ff3b30' : '#ffd23f'));
    this.audio && this.audio.wave(n);
  }

  spawnOne() {
    const n = this.wave;
    let variant = 'grunt';
    const r = Math.random();
    if (n >= 4 && r < 0.18) variant = 'leaper';
    else if (n >= 3 && r < 0.40) variant = 'brute';
    else if (n >= 2 && r < 0.62) variant = 'runner';
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? CONFIG.WALL_LEFT + 10 : CONFIG.WALL_RIGHT - 10;
    const e = new Enemy(this, x, CONFIG.GROUND_Y, variant);
    e.facing = fromLeft ? 1 : -1;
    if (this.spawned && this.spawned[variant] != null) this.spawned[variant]++;
    // flank assignment: alternating sides, seeded by spawn side, so the pack
    // surrounds the player rather than stacking on one side.
    e.flankDir = (this.enemies.length % 2 === 0) ? (fromLeft ? 1 : -1) : (fromLeft ? -1 : 1);
    // wave-based scaling — steeper so late waves actually threaten
    e.speedMul = 1 + Math.min(n, 15) * 0.045;
    e.hpMul = 1 + Math.min(n, 15) * 0.075;
    e.aggrMul = 0.8 + Math.min(n - 1, 8) * 0.07; // wave1 gentle, wave9+ fierce
    e.health = e.maxHealth = e.maxHealth * e.hpMul;
    this.enemies.push(e);
  }

  // ---- combat ----
  _resolveCombat() {
    const p = this.player;

    // player -> enemies
    const phb = p.getHitbox();
    if (phb) {
      for (const e of this.enemies) {
        if (e.dead || e.lastSwing === p.swingId) continue;
        if (aabb(phb, e.bodyBox())) {
          e.lastSwing = p.swingId;
          const wasAlive = !e.dead;
          const killed = e.health - phb.dmg <= 0;
          e.takeHit(phb.dmg, phb.from, phb.kb, phb.pause);
          this._onPlayerHit(e, phb, killed);
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
    this.hitPause = Math.max(this.hitPause, hb.pause);
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = CONFIG.COMBO_WINDOW;
    const mult = 1 + Math.floor((this.combo - 1) / 4) * 0.5;
    const gain = Math.round(10 * mult);
    this.score += gain;
    this.burst(enemy.x, enemy.y - 70 * enemy.scale, enemy.v.palette.fist, 12);
    this._spark(enemy.x, enemy.y - 70 * enemy.scale, hb.kb > 400 ? '#ffd23f' : '#ffffff');
    this.cameras.main.shake(70, killed ? 0.012 : 0.006);
    this.audio && this.audio.hit();
    if (this.combo > 1) this.audio && this.audio.combo(this.combo);
    this.ui.floatText('+' + gain, enemy.x, enemy.y - 120 * enemy.scale, '#ffd23f');
    if (this.combo >= 3 && this.combo % 1 === 0) {
      this.ui.floatText('x' + this.combo, this.player.x, this.player.y - 220, '#35e1ff', 26);
    }
    this._checkComboTier();
    if (killed) {
      this.score += Math.round(enemy.v.score * mult);
      this.burst(enemy.x, enemy.y - 70 * enemy.scale, enemy.v.palette.accent, 26);
      this.cameras.main.shake(120, 0.014);
      this.audio && this.audio.bigHit();
      this.slowmo = 0.18;
      this.ui.floatText('K.O. +' + Math.round(enemy.v.score * mult), enemy.x, enemy.y - 150 * enemy.scale, enemy.v.palette.fist, 26);
      // chance to drop a health pickup (more likely if player low)
      const dropChance = this.player.health < 40 ? 0.4 : 0.2;
      if (Math.random() < dropChance && this.player.health < this.player.maxHealth) {
        this.pickups.push(new Pickup(this, enemy.x, enemy.y - 60));
      }
    }
  }

  _onPlayerHurt(enemy, hb) {
    this.combo = 0;
    this.comboTimer = 0;
    this.hitsTaken++;
    this.hitPause = Math.max(this.hitPause, 0.08);
    this.cameras.main.shake(160, 0.02);
    this.burst(this.player.x, this.player.y - 100, COLORS_PLAYER.accent, 18);
    this._spark(this.player.x, this.player.y - 100, '#ff3b30');
    this.audio && this.audio.bigHit();
  }

  _spark(x, y, color) {
    const g = this.fxLayer;
    g.lineStyle(3, 0xffffff, 1);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const r1 = 8, r2 = rand(16, 28);
      g.lineBetween(x, y, x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    }
    this.time.delayedCall(60, () => this.fxLayer.clear());
  }

  _checkComboTier() {
    if (!CONFIG.COMBO_TIERS || !CONFIG.COMBO_TIERS.length) return;
    if (CONFIG.COMBO_TIERS.indexOf(this.combo) === -1) return;
    const tierNames = { 5: 'NICE!', 10: 'GREAT!', 15: 'AWESOME!', 20: 'INSANE!', 30: 'GODLIKE!' };
    const bonus = CONFIG.COMBO_TIER_BONUS;
    this.score += bonus;
    this.tierBonuses++;
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
      // still render existing frames? entities already rendered last frame. keep frozen.
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

    // progressive onboarding: flag each action the first time it's used
    const ob = this.onboard;
    ob.t += dt;
    if (c.dir !== 0) ob.move = true;
    if (c.punchPressed) { p_tryAttack(this, 'punch'); c.punchPressed = false; ob.punch = true; }
    if (c.kickPressed) { p_tryAttack(this, 'kick'); c.kickPressed = false; ob.kick = true; }
    if (c.jumpPressed) { c.jumpPressed = false; ob.jump = true; }

    // slow-motion right after a kill
    let stepDt = dt;
    if (this.slowmo > 0) {
      this.slowmo -= dtMs / 1000;
      stepDt = dt * 0.35;
    }

    this.player.update(stepDt, c);

    // wave logic
    if (this.waveActive) {
      if (this.spawnQueue > 0) {
        this.spawnTimer -= stepDt;
        if (this.spawnTimer <= 0 && this.enemies.length < CONFIG.ENEMY.MAX_ALIVE) {
          this.spawnOne();
          this.spawnQueue--;
          this.spawnTimer = rand(0.3, 0.65);
        }
      } else {
        const alive = this.enemies.filter((e) => !e.dead).length;
        if (alive === 0) {
          this.waveActive = false;
          this.waveBreak = 1.1;
          this.score += 100 * this.wave;
          this.ui.banner('WAVE CLEAR  +' + 100 * this.wave, '#6bff9e');
        }
      }
    } else {
      this.waveBreak -= stepDt;
      if (this.waveBreak <= 0) this.startWave(this.wave + 1);
    }

    for (const e of this.enemies) e.update(stepDt, this.player);
    // cleanup destroyed
    this.enemies = this.enemies.filter((e) => e.active !== false && e.scene);

    // pickups
    for (const p of this.pickups) {
      p.update(stepDt, this.player);
      if (p._collected) {
        const heal = 25;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + heal);
        this.healed += heal;
        this.burst(this.player.x, this.player.y - 60, 0x35e1ff, 16);
        this.audio && this.audio.combo(8);
        this.ui.floatText('+' + heal + ' HP', this.player.x, this.player.y - 160, '#35e1ff', 22);
      }
    }
    this.pickups = this.pickups.filter((p) => p.scene);

    this._resolveCombat();

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
    for (const e of this.enemies) drawShadow(e.x, e.y, e.scale);
  }

  _updateHUD() {
    const alive = this.enemies.filter((e) => !e.dead);
    const counts = { grunt: 0, runner: 0, brute: 0, leaper: 0 };
    for (const e of alive) if (counts[e.variant] != null) counts[e.variant]++;
    this.registry.set('hud', {
      health: this.player.health, maxHealth: this.player.maxHealth,
      score: this.score, wave: this.wave, combo: this.combo,
      enemiesLeft: alive.length + this.spawnQueue,
      bestCombo: this.bestCombo,
      comboTimer: this.comboTimer, comboWindow: CONFIG.COMBO_WINDOW,
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
      };
    }
  }

  _endGame() {
    const hs = parseInt(localStorage.getItem('stickman_arena_hs') || '0', 10);
    if (this.score > hs) localStorage.setItem('stickman_arena_hs', String(this.score));
    this.scene.stop('UI');
    this.scene.start('GameOver', {
      score: this.score, wave: this.wave, bestCombo: this.bestCombo,
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

const COLORS_PLAYER = { accent: 0x35e1ff };
