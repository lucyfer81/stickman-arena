import { CONFIG } from '../config.js';
import { drawBackground } from '../utils/background.js';
import { Stickman } from '../entities/Stickman.js';
import { Meta } from '../systems/Meta.js';

function fmt(n) {
  n = Math.floor(n);
  const s = '' + n;
  if (s.length <= 3) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.result = data;
  }

  create() {
    drawBackground(this);
    this.audio = this.registry.get('audio');
    // fade the soundtrack out on death so the game-over stinger lands in space;
    // the title restarts menu music when the player goes back.
    this.audio && this.audio.stopMusic && this.audio.stopMusic();
    const cx = CONFIG.WIDTH / 2;
    let hsRaw = '0';
    try { hsRaw = localStorage.getItem('stickman_arena_hs') || '0'; } catch (e) {}
    const hs = parseInt(hsRaw, 10);
    const r = this.result || { score: 0, wave: 1, bestCombo: 0, kills: 0 };
    const stats = r.stats || Meta.loadStats();
    // newBest is computed in GameScene._endGame against the PRE-save hs; relying
    // on `score >= hs` here would mis-report an exact tie as a new record.
    const newBest = !!r.newBest;

    this.t = 0;

    // ---- mood: red floor wash + a defeat spotlight on the fallen fighter ----
    // The pre-redesign screen ran ~9% visual density (the same sparse disease the
    // title had before its Round 8 pass), was top-heavy with a dead middle band,
    // buried its D1 retention hooks in 13px grey, and let the dead body collide
    // with the CTA. This mirrors the title's proven toolkit: a spotlight cone
    // fills the dead middle with atmosphere and turns the corpse into a dramatic
    // hero, a card + band give the stats/retention a designed plate, and a score
    // count-up injects the energy a brawler needs to drive "one more run".
    this._buildMood(cx);

    // ---- GAME OVER verdict ----
    this.add.text(cx, 86, r.daily ? 'DAILY RUN OVER' : 'GAME OVER', {
      fontFamily: 'Impact, Arial Black', fontSize: r.daily ? 72 : 92, color: '#ff3b30',
      stroke: '#0b1a2a', strokeThickness: 10,
    }).setOrigin(0.5).setShadow(0, 6, '#000', 12, true, true);

    // ---- result tagline: reframe defeat as progress, or celebrate a record ----
    if (newBest && !r.daily) {
      this.add.text(cx, 142, 'NEW PERSONAL BEST!', {
        fontFamily: 'Impact, Arial Black', fontSize: 30, color: '#ffd23f',
        stroke: '#0b1a2a', strokeThickness: 6,
      }).setOrigin(0.5).setShadow(0, 2, '#000', 6, true, true);
    } else {
      this.add.text(cx, 142, 'YOU REACHED WAVE  ' + r.wave, {
        fontFamily: 'Arial Black', fontSize: 22, color: '#7fb6d6',
        stroke: '#0b1a2a', strokeThickness: 4,
      }).setOrigin(0.5);
    }

    // ---- stats card: SCORE hero (animated count-up) + 3-up supporting row ----
    const cardY = 188, cardH = 122, cardW = 480;
    this._plate(cx, cardY, cardW, cardH, 0x35e1ff, 0.32);
    this.add.text(cx, cardY + 16, 'SCORE', {
      fontFamily: 'Arial', fontSize: '15px', color: '#7fb6d6',
    }).setOrigin(0.5);
    const scoreText = this.add.text(cx, cardY + 52, '0', {
      fontFamily: 'Impact, Arial Black', fontSize: '54px', color: '#eaf4ff',
      stroke: '#0b1a2a', strokeThickness: 6,
    }).setOrigin(0.5);
    // count-up: the result feels earned instead of stamped in.
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter, v: r.score || 0, duration: 850, ease: 'Cubic.out', delay: 150,
      onUpdate: () => scoreText.setText(fmt(counter.v)),
    });
    // supporting stats in a tidy 3-up row
    const sy = cardY + cardH - 26;
    const colX = [cx - 160, cx, cx + 160];
    const sup = [
      ['WAVE', r.wave, '#35e1ff'],
      ['BEST COMBO', 'x' + r.bestCombo, '#ffd23f'],
      ['KILLS', r.kills || 0, '#ff8a3d'],
    ];
    sup.forEach((row, i) => {
      this.add.text(colX[i], sy, row[0], {
        fontFamily: 'Arial', fontSize: '12px', color: '#6c8aa0',
      }).setOrigin(0.5);
      this.add.text(colX[i], sy + 18, String(row[1]), {
        fontFamily: 'Arial Black', fontSize: '20px', color: row[2],
      }).setOrigin(0.5);
    });

    // daily best / skin unlocks (celebratory, only when present)
    let yy = cardY + cardH + 14;
    if (r.daily) {
      const dmsg = r.daily.newBest ? ('NEW DAILY BEST!  ' + r.daily.best) : ('DAILY BEST  ' + r.daily.best);
      this.add.text(cx, yy, dmsg, {
        fontFamily: 'Arial Black', fontSize: '20px', color: r.daily.newBest ? '#6bff9e' : '#9bb4c8',
        stroke: '#0b1a2a', strokeThickness: 4,
      }).setOrigin(0.5);
      yy += 32;
    }
    if (r.newlyUnlocked && r.newlyUnlocked.length) {
      const names = r.newlyUnlocked.map((k) => Meta.skinDef(k).label).join(', ');
      this.add.text(cx, yy, 'SKIN UNLOCKED: ' + names, {
        fontFamily: 'Arial Black', fontSize: '20px', color: '#35e1ff',
        stroke: '#0b1a2a', strokeThickness: 4,
      }).setOrigin(0.5);
      this.audio && this.audio.start();
      yy += 32;
    }

    // ---- retention band: the D1 hooks, made readable (were 13px invisible grey) ----
    // Definition-list layout (label gutter | value) — robust to variable daily
    // text length, no centre-collision between the two hooks.
    const goal = Meta.nextUnlock(stats);
    const tom = Meta.dailyModifierTomorrow();
    const rbY = yy + 42;
    const bandW = 660, bandH = 78;
    this._plate(cx, rbY, bandW, bandH, 0x35e1ff, 0.16);
    this.add.text(cx, rbY + 13, 'REASON TO RETURN', {
      fontFamily: 'Arial', fontSize: '12px', color: '#6c8aa0',
    }).setOrigin(0.5);
    const labX = cx - bandW / 2 + 28, valX = cx - 150;
    const lab = (y, s) => this.add.text(labX, y, s, {
      fontFamily: 'Arial', fontSize: '13px', color: '#6c8aa0',
    }).setOrigin(0, 0.5);
    if (goal) {
      lab(rbY + 38, 'NEXT UNLOCK');
      this.add.text(valX, rbY + 38, goal.current + ' / ' + goal.target + '  \u2192  ' + goal.skinLabel + ' skin', {
        fontFamily: 'Arial Black', fontSize: '16px', color: '#35e1ff',
      }).setOrigin(0, 0.5);
    }
    lab(rbY + 60, 'TOMORROW');
    this.add.text(valX, rbY + 60, tom.name + ' \u2014 ' + tom.desc, {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#ffd23f',
    }).setOrigin(0, 0.5);

    // ---- fallen fighter: the spotlit defeated champion (in the player's skin) ----
    this.body = new Stickman(this, cx, CONFIG.GROUND_Y, Meta.skinPalette());
    this.body.facing = 1;
    this.body.setScale(1.15);
    this.body.render({ state: 'dead', time: 0, deadT: 0.85 });

    // ---- call to action (separated from the body, pulsing) ----
    this.inputLocked = true;
    this.time.delayedCall(650, () => { this.inputLocked = false; });
    this.restartHint = this.add.text(cx, 560, 'PRESS  R  /  TAP  TO  PLAY AGAIN', {
      fontFamily: 'Arial Black', fontSize: '28px', color: '#ffd23f',
      stroke: '#0b1a2a', strokeThickness: 6,
    }).setOrigin(0.5).setShadow(0, 3, '#000', 8, true, true);

    // persistent career line (reference only — tiny, at the very bottom edge)
    this.add.text(cx, CONFIG.HEIGHT - 14,
      'career: ' + stats.totalKills + ' kills  \u00B7  ' + stats.gamesPlayed + ' runs  \u00B7  best wave ' + stats.bestWave + '  \u00B7  hi ' + hs, {
        fontFamily: 'Arial', fontSize: '14px', color: '#5a7689',
      }).setOrigin(0.5);

    this.input.keyboard.on('keydown-R', () => this.restart());
    this.input.keyboard.on('keydown-SPACE', () => this.restart());
    this.input.keyboard.on('keydown-ENTER', () => this.restart());
    this.input.on('pointerdown', () => this.restart());

    this.cameras.main.fadeIn(450, 30, 0, 0);
    if (typeof window !== 'undefined') {
      window.__stickman = {
        state: 'gameover', score: r.score, wave: r.wave, bestCombo: r.bestCombo,
        kills: r.kills || 0, newlyUnlocked: r.newlyUnlocked || [], daily: r.daily || null,
        stats: stats,
      };
    }
  }

  // Red floor wash + a downward defeat spotlight (the title's cyan stage light,
  // retuned to mournful red) that bathes the fallen fighter. Additive + low
  // alpha so it reads as atmosphere, never competing with the UI plates above.
  _buildMood(cx) {
    const wash = this.add.graphics().setDepth(-6).setBlendMode(Phaser.BlendModes.ADD);
    wash.fillStyle(0xff3b30, 0.05);
    wash.fillRect(0, CONFIG.GROUND_Y - 60, CONFIG.WIDTH, CONFIG.HEIGHT - CONFIG.GROUND_Y + 60);
    this.spot = this.add.graphics().setDepth(-5).setBlendMode(Phaser.BlendModes.ADD);
    this._drawSpot(cx, 0.9);
  }

  _drawSpot(cx, k) {
    const g = this.spot;
    g.clear();
    const topY = 408, topHalf = 26;
    const botY = CONFIG.GROUND_Y + 8, botHalf = 168;
    for (let i = 5; i >= 1; i--) {
      const kk = i / 5;
      g.fillStyle(0xff4d44, 0.018 * (6 - i) * k);
      g.beginPath();
      g.moveTo(cx - topHalf * (1 + kk), topY);
      g.lineTo(cx + topHalf * (1 + kk), topY);
      g.lineTo(cx + botHalf * (1 + kk * 0.5), botY);
      g.lineTo(cx - botHalf * (1 + kk * 0.5), botY);
      g.closePath();
      g.fillPath();
    }
    for (let i = 4; i >= 1; i--) {
      g.fillStyle(0xff6a5a, 0.038 * (5 - i) * k);
      g.fillEllipse(cx, botY + 4, 300 * (i / 4), 58 * (i / 4));
    }
    g.fillStyle(0xffd9c8, 0.08 * k);
    g.fillEllipse(cx, botY + 2, 138, 34);
  }

  // Semi-transparent dark plate with a thin coloured edge — gives a block of
  // text a designed home (raises density, separates it from the spotlight wash).
  _plate(cx, cy, w, h, edge, edgeA) {
    const g = this.add.graphics().setDepth(-1);
    g.fillStyle(0x0b1a2a, 0.5);
    g.fillRoundedRect(cx - w / 2, cy, w, h, 14);
    g.lineStyle(2, edge, edgeA);
    g.strokeRoundedRect(cx - w / 2, cy, w, h, 14);
  }

  restart() {
    if (this.restarting || this.inputLocked) return;
    this.restarting = true;
    this.audio && this.audio.ui();
    this.cameras.main.fadeOut(250);
    // return to title so the player can change skin/difficulty/daily
    this.time.delayedCall(250, () => this.scene.start('Title'));
  }

  update(_t, dtMs) {
    this.t += dtMs / 1000;
    this.restartHint.setAlpha(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 4)));
    // keep the spotlight breathing so the still screen still feels alive
    const k = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(this.t * 1.7));
    this._drawSpot(CONFIG.WIDTH / 2, k);
  }
}
