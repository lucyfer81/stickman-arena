import { CONFIG } from '../config.js';
import { drawBackground } from '../utils/background.js';
import { Stickman } from '../entities/Stickman.js';
import { COLORS } from '../config.js';
import { Meta } from '../systems/Meta.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.result = data;
  }

  create() {
    drawBackground(this);
    this.audio = this.registry.get('audio');
    const cx = CONFIG.WIDTH / 2;
    const hs = parseInt(localStorage.getItem('stickman_arena_hs') || '0', 10);
    const r = this.result || { score: 0, wave: 1, bestCombo: 0, kills: 0 };
    const stats = r.stats || Meta.loadStats();

    this.add.text(cx, 120, r.daily ? 'DAILY RUN OVER' : 'GAME OVER', {
      fontFamily: 'Impact, Arial Black', fontSize: r.daily ? 72 : 96, color: '#ff3b30',
      stroke: '#0b1a2a', strokeThickness: 10,
    }).setOrigin(0.5).setShadow(0, 6, '#000', 12, true, true);

    const newBest = r.score >= hs && r.score > 0;
    const lines = [
      ['SCORE', r.score, '#eaf4ff'],
      ['WAVE REACHED', r.wave, '#35e1ff'],
      ['BEST COMBO', 'x' + r.bestCombo, '#ffd23f'],
      ['KILLS', r.kills || 0, '#ff8a3d'],
    ];
    let yy = 240;
    for (const [label, val, col] of lines) {
      this.add.text(cx - 30, yy, label, {
        fontFamily: 'Arial', fontSize: '22px', color: '#7fb6d6',
      }).setOrigin(1, 0.5);
      this.add.text(cx + 30, yy, String(val), {
        fontFamily: 'Arial Black', fontSize: '26px', color: col,
      }).setOrigin(0, 0.5);
      yy += 40;
    }

    if (r.daily) {
      const dmsg = r.daily.newBest ? ('NEW DAILY BEST!  ' + r.daily.best) : ('DAILY BEST  ' + r.daily.best);
      this.add.text(cx, yy + 6, dmsg, {
        fontFamily: 'Arial Black', fontSize: '20px', color: r.daily.newBest ? '#6bff9e' : '#9bb4c8',
      }).setOrigin(0.5);
      yy += 34;
    } else if (newBest) {
      this.add.text(cx, yy + 6, 'NEW BEST!', {
        fontFamily: 'Impact, Arial Black', fontSize: '30px', color: '#ffd23f',
      }).setOrigin(0.5);
      yy += 34;
    }

    // unlock notifications (skins earned this run)
    if (r.newlyUnlocked && r.newlyUnlocked.length) {
      const names = r.newlyUnlocked.map((k) => Meta.skinDef(k).label).join(', ');
      this.add.text(cx, yy + 16, 'SKIN UNLOCKED: ' + names, {
        fontFamily: 'Arial Black', fontSize: '20px', color: '#35e1ff',
      }).setOrigin(0.5);
      this.audio && this.audio.start();
      yy += 36;
    }

    // persistent career line
    this.add.text(cx, CONFIG.HEIGHT - 150,
      'career: ' + stats.totalKills + ' kills  \u00B7  ' + stats.gamesPlayed + ' runs  \u00B7  best wave ' + stats.bestWave + '  \u00B7  hi ' + hs, {
        fontFamily: 'Arial', fontSize: '16px', color: '#6c8aa0',
      }).setOrigin(0.5);

    this.t = 0;
    this.inputLocked = true;
    this.time.delayedCall(650, () => { this.inputLocked = false; });
    this.restartHint = this.add.text(cx, CONFIG.HEIGHT - 90, 'PRESS  R  /  TAP  TO  PLAY AGAIN', {
      fontFamily: 'Arial Black', fontSize: '26px', color: '#eaf4ff',
    }).setOrigin(0.5);

    // dead stickman for flavor, in the player's chosen skin
    this.body = new Stickman(this, cx, CONFIG.GROUND_Y, Meta.skinPalette());
    this.body.facing = 1;
    this.body.render({ state: 'dead', time: 0, deadT: 0.8 });

    this.input.keyboard.on('keydown-R', () => this.restart());
    this.input.keyboard.on('keydown-SPACE', () => this.restart());
    this.input.keyboard.on('keydown-ENTER', () => this.restart());
    this.input.on('pointerdown', () => this.restart());

    this.cameras.main.fadeIn(400);
    if (typeof window !== 'undefined') {
      window.__stickman = {
        state: 'gameover', score: r.score, wave: r.wave, bestCombo: r.bestCombo,
        kills: r.kills || 0, newlyUnlocked: r.newlyUnlocked || [], daily: r.daily || null,
        stats: stats,
      };
    }
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
    this.restartHint.setAlpha(0.5 + 0.5 * Math.sin(this.t * 4));
  }
}
