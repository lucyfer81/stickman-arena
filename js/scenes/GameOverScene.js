import { CONFIG } from '../config.js';
import { drawBackground } from '../utils/background.js';
import { Stickman } from '../entities/Stickman.js';
import { COLORS } from '../config.js';

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
    const r = this.result || { score: 0, wave: 1, bestCombo: 0 };

    this.add.text(cx, 150, 'GAME OVER', {
      fontFamily: 'Impact, Arial Black', fontSize: '96px', color: '#ff3b30',
      stroke: '#0b1a2a', strokeThickness: 10,
    }).setOrigin(0.5).setShadow(0, 6, '#000', 12, true, true);

    const newBest = r.score >= hs && r.score > 0;
    const lines = [
      ['SCORE', r.score, '#eaf4ff'],
      ['WAVE REACHED', r.wave, '#35e1ff'],
      ['BEST COMBO', 'x' + r.bestCombo, '#ffd23f'],
      ['HIGH SCORE', hs, '#9bb4c8'],
    ];
    let yy = 280;
    for (const [label, val, col] of lines) {
      this.add.text(cx - 30, yy, label, {
        fontFamily: 'Arial', fontSize: '24px', color: '#7fb6d6',
      }).setOrigin(1, 0.5);
      this.add.text(cx + 30, yy, String(val), {
        fontFamily: 'Arial Black', fontSize: '28px', color: col,
      }).setOrigin(0, 0.5);
      yy += 48;
    }

    if (newBest) {
      this.add.text(cx, yy + 10, 'NEW BEST!', {
        fontFamily: 'Impact, Arial Black', fontSize: '34px', color: '#ffd23f',
      }).setOrigin(0.5);
    }

    this.t = 0;
    this.restartHint = this.add.text(cx, CONFIG.HEIGHT - 90, 'PRESS  R  /  TAP  TO  PLAY AGAIN', {
      fontFamily: 'Arial Black', fontSize: '26px', color: '#eaf4ff',
    }).setOrigin(0.5);

    // dead stickman for flavor
    this.body = new Stickman(this, cx, CONFIG.GROUND_Y, COLORS.player);
    this.body.facing = 1;
    this.body.render({ state: 'dead', time: 0, deadT: 0.8 });

    this.input.keyboard.on('keydown-R', () => this.restart());
    this.input.keyboard.on('keydown-SPACE', () => this.restart());
    this.input.keyboard.on('keydown-ENTER', () => this.restart());
    this.input.on('pointerdown', () => this.restart());

    this.cameras.main.fadeIn(400);
    if (typeof window !== 'undefined') {
      window.__stickman = { state: 'gameover', score: r.score, wave: r.wave, bestCombo: r.bestCombo };
    }
  }

  restart() {
    if (this.restarting) return;
    this.restarting = true;
    this.audio && this.audio.ui();
    this.cameras.main.fadeOut(250);
    this.time.delayedCall(250, () => this.scene.start('Game'));
  }

  update(_t, dtMs) {
    this.t += dtMs / 1000;
    this.restartHint.setAlpha(0.5 + 0.5 * Math.sin(this.t * 4));
  }
}
