import { CONFIG, COLORS, DIFFICULTY } from '../config.js';
import { Stickman } from '../entities/Stickman.js';
import { drawBackground } from '../utils/background.js';
import { Meta } from '../systems/Meta.js';

const DIFF_ORDER = ['easy', 'normal', 'hard'];

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    drawBackground(this);
    this.audio = this.registry.get('audio');
    // generative soundtrack: a calm bed on the title (becomes audible once the
    // first gesture resumes the audio context), crossfading to combat on start.
    this.audio && this.audio.startMusic && this.audio.startMusic('menu');

    const cx = CONFIG.WIDTH / 2;

    // demo stickman
    this.demo = new Stickman(this, cx - 220, CONFIG.GROUND_Y, COLORS.player);
    this.demo.facing = 1;
    this.t = 0;
    this.demoAction = 0;

    // difficulty (persists) — guarded: Safari private mode can throw on access
    let storedDiff = 'normal';
    try { storedDiff = localStorage.getItem('stickman_arena_diff') || 'normal'; } catch (e) {}
    this.difficulty = storedDiff;
    if (!DIFFICULTY[this.difficulty]) this.difficulty = 'normal';
    this.registry.set('difficulty', this.difficulty);

    // daily challenge flag (reset each visit to the title)
    this.registry.set('daily', false);
    this.dailyOn = false;

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

    // difficulty selector — click to cycle Easy -> Normal -> Hard
    this.diffLabel = this.add.text(cx - 150, CONFIG.HEIGHT - 200, '', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#ffffff',
      stroke: '#0b1a2a', strokeThickness: 5,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._refreshDiff();
    this.diffRect = new Phaser.Geom.Rectangle(cx - 150 - 120, CONFIG.HEIGHT - 200 - 24, 240, 48);
    this.diffLabel.on('pointerdown', (pointer, localX, localY, event) => {
      event && event.stopPropagation();
      this._cycleDiff();
    });

    // skin selector — cycle unlocked palettes
    this.skinLabel = this.add.text(cx + 150, CONFIG.HEIGHT - 200, '', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#ffffff',
      stroke: '#0b1a2a', strokeThickness: 5,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._refreshSkin();
    this.skinRect = new Phaser.Geom.Rectangle(cx + 150 - 120, CONFIG.HEIGHT - 200 - 24, 240, 48);
    this.skinLabel.on('pointerdown', (pointer, localX, localY, event) => {
      event && event.stopPropagation();
      this._cycleSkin();
    });

    // daily challenge toggle — fixed modifier for today, separate best
    const dm = Meta.dailyModifier();
    const db = Meta.dailyBest();
    this.dailyLabel = this.add.text(cx, CONFIG.HEIGHT - 258, '', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#9bb4c8',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._refreshDaily(dm, db);
    this.dailyRect = new Phaser.Geom.Rectangle(cx - 320, CONFIG.HEIGHT - 258 - 18, 640, 36);
    this.dailyLabel.on('pointerdown', (pointer, localX, localY, event) => {
      event && event.stopPropagation();
      this.dailyOn = !this.dailyOn;
      this.registry.set('daily', this.dailyOn);
      this._refreshDaily(dm, db);
      this.audio && this.audio.ui();
    });

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
    let hsRaw = '0';
    try { hsRaw = localStorage.getItem('stickman_arena_hs') || '0'; } catch (e) {}
    const hs = parseInt(hsRaw, 10);
    if (hs > 0) {
      this.add.text(cx, 300, 'BEST  ' + hs, {
        fontFamily: 'Arial Black', fontSize: '26px', color: '#35e1ff',
      }).setOrigin(0.5);
    }

    // input — tap anywhere to start, EXCEPT on the difficulty selector
    this.input.keyboard.on('keydown-SPACE', () => this.start());
    this.input.keyboard.on('keydown-ENTER', () => this.start());
    this.input.keyboard.on('keydown-ONE', () => this._setDiff('easy'));
    this.input.keyboard.on('keydown-TWO', () => this._setDiff('normal'));
    this.input.keyboard.on('keydown-THREE', () => this._setDiff('hard'));
    this.input.on('pointerdown', (pointer) => {
      if (this.diffRect && this.diffRect.contains(pointer.x, pointer.y)) return;
      if (this.skinRect && this.skinRect.contains(pointer.x, pointer.y)) return;
      if (this.dailyRect && this.dailyRect.contains(pointer.x, pointer.y)) return;
      this.start();
    });

    this.cameras.main.fadeIn(300);
    if (typeof window !== 'undefined') window.__stickman = { state: 'title', difficulty: this.difficulty };
  }

  _refreshDiff() {
    const d = DIFFICULTY[this.difficulty];
    const idx = DIFF_ORDER.indexOf(this.difficulty);
    this.diffLabel.setText('\u25C0  ' + d.label + '  \u25B6');
    this.diffLabel.setColor(d.color);
    this.registry.set('difficulty', this.difficulty);
    if (typeof window !== 'undefined') window.__stickman = Object.assign({}, window.__stickman, { difficulty: this.difficulty });
    this.audio && this.audio.ui();
  }
  _cycleDiff() {
    const idx = DIFF_ORDER.indexOf(this.difficulty);
    this.difficulty = DIFF_ORDER[(idx + 1) % DIFF_ORDER.length];
    try { localStorage.setItem('stickman_arena_diff', this.difficulty); } catch (e) {}
    this._refreshDiff();
  }
  _setDiff(k) {
    if (!DIFFICULTY[k]) return;
    this.difficulty = k;
    try { localStorage.setItem('stickman_arena_diff', k); } catch (e) {}
    this._refreshDiff();
  }

  _refreshSkin() {
    const unlocked = Meta.unlockedSkins();
    let cur = Meta.getSkin();
    if (unlocked.indexOf(cur) === -1) cur = 'default';
    this._skinList = unlocked.length ? unlocked : ['default'];
    const def = Meta.skinDef(cur);
    this.skinLabel.setText('\u25C0  ' + def.label + '  \u25B6');
    const p = def.palette;
    const hex = '#' + p.accent.toString(16).padStart(6, '0');
    this.skinLabel.setColor(hex);
    Meta.setSkin(cur);
    this.registry.set('skin', cur);
  }
  _cycleSkin() {
    const cur = Meta.getSkin();
    const list = this._skinList || ['default'];
    const idx = list.indexOf(cur);
    const next = list[(idx + 1) % list.length];
    Meta.setSkin(next);
    this._refreshSkin();
    // reflect on the demo stickman
    this.demo.palette = Meta.skinPalette(next);
    this.audio && this.audio.ui();
  }
  _refreshDaily(dm, db) {
    const label = (this.dailyOn ? '[ON]  ' : '[OFF] ') + 'DAILY: ' + dm.name + ' \u2014 ' + dm.desc + '  (best ' + db.best + ')';
    this.dailyLabel.setText(label);
    this.dailyLabel.setColor(this.dailyOn ? '#ffd23f' : '#7fb6d6');
  }

  start() {
    if (this.starting) return;
    this.starting = true;
    this.audio && this.audio.resume();
    this.audio && this.audio.start();
    this.audio && this.audio.setMusicIntensity && this.audio.setMusicIntensity('combat');
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
