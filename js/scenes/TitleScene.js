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

    // ---- centred "VS" stage: two stickmen squared off under a spotlight ----
    // Was a single left-aligned demo + a wide void on the right, which left the
    // title's middle band empty and the composition lopsided. A centred duel
    // (the game's namesake) balances the frame and shows the promise of the
    // game — a stickman arena fight — right on the cover.
    this._buildSpotlight(cx);
    const off = 150;
    this.demo = new Stickman(this, cx - off, CONFIG.GROUND_Y, COLORS.player);
    this.demo.facing = 1;
    this.enemyDemo = new Stickman(this, cx + off, CONFIG.GROUND_Y, COLORS.enemy);
    this.enemyDemo.facing = -1;
    this.t = 0;

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
    const title = this.add.text(cx, 150, 'STICKMAN ARENA', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: '96px',
      color: '#eaf4ff',
      stroke: '#35e1ff',
      strokeThickness: 10,
    }).setOrigin(0.5);
    title.setShadow(0, 6, '#0b1a2a', 12, true, true);

    this.add.text(cx, 220, 'a tiny stickman brawler', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#7fb6d6',
    }).setOrigin(0.5);

    // difficulty selector — click to cycle Easy -> Normal -> Hard
    this.diffLabel = this.add.text(cx - 150, 364, '', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#ffffff',
      stroke: '#0b1a2a', strokeThickness: 5,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._refreshDiff();
    this.diffRect = new Phaser.Geom.Rectangle(cx - 150 - 120, 364 - 24, 240, 48);
    this.diffLabel.on('pointerdown', (pointer, localX, localY, event) => {
      event && event.stopPropagation();
      this._cycleDiff();
    });

    // skin selector — cycle unlocked palettes
    this.skinLabel = this.add.text(cx + 150, 364, '', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#ffffff',
      stroke: '#0b1a2a', strokeThickness: 5,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._refreshSkin();
    this.skinRect = new Phaser.Geom.Rectangle(cx + 150 - 120, 364 - 24, 240, 48);
    this.skinLabel.on('pointerdown', (pointer, localX, localY, event) => {
      event && event.stopPropagation();
      this._cycleSkin();
    });

    // daily challenge toggle — fixed modifier for today, separate best
    const dm = Meta.dailyModifier();
    const db = Meta.dailyBest();
    this.dailyLabel = this.add.text(cx, 320, '', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#9bb4c8',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._refreshDaily(dm, db);
    this.dailyRect = new Phaser.Geom.Rectangle(cx - 320, 320 - 18, 640, 36);
    this.dailyLabel.on('pointerdown', (pointer, localX, localY, event) => {
      event && event.stopPropagation();
      this.dailyOn = !this.dailyOn;
      this.registry.set('daily', this.dailyOn);
      this._refreshDaily(dm, db);
      this.audio && this.audio.ui();
    });

    this.subtitle = this.add.text(cx, 458, 'PRESS  SPACE  /  TAP  TO  START', {
      fontFamily: 'Arial Black',
      fontSize: '34px',
      color: '#ffd23f',
      stroke: '#0b1a2a',
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.subtitle.setShadow(0, 3, '#000', 8, true, true);

    this.add.text(cx, 672, 'A / \u2190  D / \u2192  move    W / SPACE  jump    J  punch    K  kick', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#9bb4c8',
    }).setOrigin(0.5);

    this.add.text(cx, 698, 'on mobile: use the on-screen joystick & buttons', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#6c8aa0',
    }).setOrigin(0.5);

    // high score
    let hsRaw = '0';
    try { hsRaw = localStorage.getItem('stickman_arena_hs') || '0'; } catch (e) {}
    const hs = parseInt(hsRaw, 10);
    if (hs > 0) {
      this.add.text(cx, 276, 'BEST  ' + hs, {
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

  // Soft stage spotlight: a cone of cyan light from above widening to a bright
  // pool on the arena floor. Anchors the centre of the title (filling the old
  // dead middle band) and lights the VS duel. The cone originates BELOW the
  // menu text so selectors stay on a clean plate; only the CTA + fighters are
  // lit. Additive + low alpha = atmosphere, never competing with UI.
  _buildSpotlight(cx) {
    const g = this.add.graphics().setDepth(-30).setBlendMode(Phaser.BlendModes.ADD);
    const topY = 392, topHalf = 40;
    const botY = CONFIG.GROUND_Y, botHalf = 250;
    for (let i = 5; i >= 1; i--) {
      const k = i / 5;
      g.fillStyle(0x35e1ff, 0.022 * (6 - i));
      g.beginPath();
      g.moveTo(cx - topHalf * (1 + k), topY);
      g.lineTo(cx + topHalf * (1 + k), topY);
      g.lineTo(cx + botHalf * (1 + k * 0.5), botY);
      g.lineTo(cx - botHalf * (1 + k * 0.5), botY);
      g.closePath();
      g.fillPath();
    }
    for (let i = 4; i >= 1; i--) {
      g.fillStyle(0x35e1ff, 0.045 * (5 - i));
      g.fillEllipse(cx, botY + 8, 420 * (i / 4), 70 * (i / 4));
    }
    g.fillStyle(0xbfeeff, 0.10);
    g.fillEllipse(cx, botY + 6, 180, 40);
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
    // Alternating sparring loop: every `round` seconds one fighter throws a
    // punch at the other — depicts a live standoff instead of a static pose.
    const round = 3.4;
    const cycle = this.t % round;
    const playerAttacks = Math.floor(this.t / round) % 2 === 0;
    const punchStart = 2.5, punchEnd = 3.05;
    let pAnim = { state: 'idle', time: this.t };
    let eAnim = { state: 'idle', time: this.t };
    if (cycle > punchStart && cycle < punchEnd) {
      const phase = (cycle - punchStart) / (punchEnd - punchStart);
      if (playerAttacks) { pAnim = { state: 'punch', phase }; this.demo.glow = 1; }
      else { eAnim = { state: 'punch', phase }; this.enemyDemo.glow = 1; }
    } else {
      this.demo.glow = 0;
      this.enemyDemo.glow = 0;
    }
    this.demo.render(pAnim);
    this.enemyDemo.render(eAnim);
    this.subtitle.setAlpha(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 4)));
  }
}
