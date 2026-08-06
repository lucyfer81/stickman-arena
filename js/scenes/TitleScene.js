import { CONFIG, COLORS } from '../config.js';
import { Stickman } from '../entities/Stickman.js';
import { drawBackground } from '../utils/background.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    drawBackground(this);
    this.audio = this.registry.get('audio');

    const cx = CONFIG.WIDTH / 2;

    // demo stickman
    this.demo = new Stickman(this, cx - 220, CONFIG.GROUND_Y, COLORS.player);
    this.demo.facing = 1;
    this.t = 0;
    this.demoAction = 0;

    // title
    const title = this.add.text(cx, 170, 'STICKMAN ARENA', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: '96px',
      color: '#eaf4ff',
      stroke: '#35e1ff',
      strokeThickness: 10,
    }).setOrigin(0.5);
    title.setShadow(0, 6, '#0b1a2a', 12, true, true);

    this.add.text(cx, 246, 'a tiny stickman brawler', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#7fb6d6',
    }).setOrigin(0.5);

    this.subtitle = this.add.text(cx, CONFIG.HEIGHT - 150, 'PRESS  SPACE  /  TAP  TO  START', {
      fontFamily: 'Arial Black',
      fontSize: '30px',
      color: '#ffd23f',
    }).setOrigin(0.5);

    this.add.text(cx, CONFIG.HEIGHT - 96, 'A / \u2190  D / \u2192  move    W / SPACE  jump    J  punch    K  kick', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#9bb4c8',
    }).setOrigin(0.5);

    this.add.text(cx, CONFIG.HEIGHT - 64, 'on mobile: use the on-screen joystick & buttons', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#6c8aa0',
    }).setOrigin(0.5);

    // high score
    const hs = parseInt(localStorage.getItem('stickman_arena_hs') || '0', 10);
    if (hs > 0) {
      this.add.text(cx, 300, 'BEST  ' + hs, {
        fontFamily: 'Arial Black', fontSize: '26px', color: '#35e1ff',
      }).setOrigin(0.5);
    }

    // input
    this.input.keyboard.on('keydown-SPACE', () => this.start());
    this.input.keyboard.on('keydown-ENTER', () => this.start());
    this.input.on('pointerdown', () => this.start());

    this.cameras.main.fadeIn(300);
    if (typeof window !== 'undefined') window.__stickman = { state: 'title' };
  }

  start() {
    if (this.starting) return;
    this.starting = true;
    this.audio && this.audio.resume();
    this.audio && this.audio.start();
    this.cameras.main.fadeOut(280);
    this.time.delayedCall(280, () => this.scene.start('Game'));
  }

  update(_t, dtMs) {
    const dt = dtMs / 1000;
    this.t += dt;
    this.demoAction -= dt;
    if (this.demoAction <= 0) {
      this.demoAction = 1.6 + Math.random() * 1.5;
      this.demoPunch = !this.demoPunch;
    }
    // wave: occasional punch
    let anim;
    const cycle = (this.t % 3.2);
    if (cycle > 2.6 && cycle < 3.1) {
      anim = { state: 'punch', phase: (cycle - 2.6) / 0.5 };
      this.demo.glow = 1;
    } else {
      this.demo.glow = 0;
      anim = { state: 'idle', time: this.t };
    }
    this.demo.render(anim);
    this.subtitle.setAlpha(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 4)));
  }
}
