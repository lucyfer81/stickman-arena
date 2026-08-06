import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    this.gameScene = this.scene.get('Game');
    this.hudG = this.add.graphics().setDepth(100);
    this.scoreText = this.add.text(CONFIG.WIDTH / 2, 30, '0', {
      fontFamily: 'Arial Black', fontSize: '40px', color: '#ffffff',
      stroke: '#0b1a2a', strokeThickness: 6,
    }).setOrigin(0.5, 0).setDepth(101);
    this.scoreLabel = this.add.text(CONFIG.WIDTH / 2, 74, 'SCORE', {
      fontFamily: 'Arial', fontSize: '14px', color: '#7fb6d6',
    }).setOrigin(0.5, 0).setDepth(101);

    this.waveText = this.add.text(CONFIG.WIDTH - 24, 24, 'WAVE 1', {
      fontFamily: 'Arial Black', fontSize: '24px', color: '#ffd23f',
    }).setOrigin(1, 0).setDepth(101);
    this.enemyText = this.add.text(CONFIG.WIDTH - 24, 54, '', {
      fontFamily: 'Arial', fontSize: '16px', color: '#9bb4c8',
    }).setOrigin(1, 0).setDepth(101);

    this.comboText = this.add.text(CONFIG.WIDTH / 2, 130, '', {
      fontFamily: 'Arial Black', fontSize: '48px', color: '#35e1ff',
      stroke: '#0b1a2a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(101).setAlpha(0);

    this.bannerText = this.add.text(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 60, '', {
      fontFamily: 'Impact, Arial Black', fontSize: '72px', color: '#ffffff',
      stroke: '#0b1a2a', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(102).setAlpha(0);

    this._buildTouchControls();
    this._buildPauseOverlay();
    this._buildMute();
    this._buildOnboarding();

    this.floats = [];
    this._touchVisible = false;
    this.refreshTouchVisibility();
    this.scale.on('resize', () => this.refreshTouchVisibility());
  }

  refreshTouchVisibility() {
    const dev = this.sys.game.device.input;
    const hasTouch = (dev && dev.touch && navigator.maxTouchPoints > 0)
      || ('ontouchstart' in window);
    const show = hasTouch || this.scale.width < 900;
    this._touchVisible = show;
    this.touchGroup && this.touchGroup.setVisible(show);
  }

  _buildTouchControls() {
    this.touchGroup = this.add.container(0, 0).setDepth(110);

    // ---- joystick (left half bottom) ----
    this.joyBase = this.add.graphics().setScrollFactor(0);
    this.joyKnob = this.add.graphics().setScrollFactor(0);
    this.joy = null; // { id, ox, oy }
    this.touchGroup.add([this.joyBase, this.joyKnob]);
    this._drawJoy();

    // right-side action buttons
    const by = CONFIG.HEIGHT - 92;
    this.btnPunch = this._makeBtn(CONFIG.WIDTH - 214, by, 56, 'PUNCH', 0xffd23f);
    this.btnKick = this._makeBtn(CONFIG.WIDTH - 120, by - 38, 64, 'KICK', 0xff6f5c);
    this.btnJump = this._makeBtn(CONFIG.WIDTH - 214, by - 64, 50, 'JUMP', 0x35e1ff);

    this.input.addPointer(2);

    // joystick pointer handling on left-bottom
    this.input.on('pointerdown', (p) => {
      if (!this._touchVisible) return;
      if (p.x < CONFIG.WIDTH * 0.5 && p.y > CONFIG.HEIGHT * 0.45) {
        this.joy = { id: p.id, ox: p.x, oy: p.y };
        this._updateJoy(p.x, p.y);
        this.gameScene.controls.touchActive = true;
      }
    });
    this.input.on('pointermove', (p) => {
      if (this.joy && p.id === this.joy.id) {
        this._updateJoy(p.x, p.y);
      }
    });
    this.input.on('pointerup', (p) => {
      if (this.joy && p.id === this.joy.id) {
        this.joy = null;
        this._drawJoy();
        const c = this.gameScene.controls;
        c.touchActive = false;
        c.touchDir = 0;
      }
    });
    this.input.on('pointerupoutside', (p) => {
      if (this.joy && p.id === this.joy.id) {
        this.joy = null; this._drawJoy();
        const c = this.gameScene.controls;
        c.touchActive = false; c.touchDir = 0;
      }
    });
  }

  _updateJoy(px, py) {
    const dx = px - this.joy.ox;
    const dy = py - this.joy.oy;
    const c = this.gameScene.controls;
    c.touchActive = true;
    c.touchDir = clamp(dx / 55, -1, 1);
    if (Math.abs(c.touchDir) < 0.18) c.touchDir = 0;
    this._drawJoy(clamp(dx, -60, 60), clamp(dy, -60, 60));
  }

  _drawJoy(kx = 0, ky = 0) {
    const ox = this.joy ? this.joy.ox : (CONFIG.WIDTH * 0.18);
    const oy = this.joy ? this.joy.oy : (CONFIG.HEIGHT - 120);
    const base = this.joyBase;
    base.clear();
    if (!this.joy) return; // hidden when idle
    base.lineStyle(4, 0x35e1ff, 0.5);
    base.strokeCircle(ox, oy, 64);
    base.lineStyle(2, 0x35e1ff, 0.25);
    base.strokeCircle(ox, oy, 30);
    const knob = this.joyKnob;
    knob.clear();
    knob.fillStyle(0x35e1ff, 0.5);
    knob.fillCircle(ox + kx, oy + ky, 30);
    knob.lineStyle(3, 0xeaf4ff, 0.8);
    knob.strokeCircle(ox + kx, oy + ky, 30);
  }

  _makeBtn(x, y, r, label, color) {
    const c = this.add.graphics();
    const draw = (pressed) => {
      c.clear();
      c.fillStyle(color, pressed ? 0.85 : 0.32);
      c.fillCircle(0, 0, r);
      c.lineStyle(3, color, pressed ? 1 : 0.7);
      c.strokeCircle(0, 0, r);
    };
    c.setPosition(x, y);
    draw(false);
    const t = this.add.text(x, y, label, {
      fontFamily: 'Arial Black', fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, r * 2, r * 2).setInteractive();
    const c2 = this.gameScene.controls;
    const setFlag = (down) => {
      if (label === 'JUMP') { if (down) { c2.jumpPressed = true; c2.jumpHeldTouch = true; } else c2.jumpHeldTouch = false; }
      if (label === 'PUNCH' && down) c2.punchPressed = true;
      if (label === 'KICK' && down) c2.kickPressed = true;
    };
    zone.on('pointerdown', () => { draw(true); setFlag(true); });
    zone.on('pointerup', () => { draw(false); setFlag(false); });
    zone.on('pointerout', () => { draw(false); if (label === 'JUMP') c2.jumpHeldTouch = false; });
    zone.on('pointerupoutside', () => { draw(false); if (label === 'JUMP') c2.jumpHeldTouch = false; });
    this.touchGroup.add([c, t, zone]);
    return { c, t, zone };
  }

  _buildMute() {
    const x = 24, y = CONFIG.HEIGHT - 30;
    this.muteText = this.add.text(x, y, '\u266A', {
      fontFamily: 'Arial', fontSize: '22px', color: '#7fb6d6',
    }).setOrigin(0, 0.5).setInteractive().setDepth(120);
    this.muteText.on('pointerdown', () => {
      const a = this.registry.get('audio');
      if (!a) return;
      a.setMuted(!a.muted);
      this.muteText.setColor(a.muted ? '#ff6f5c' : '#7fb6d6');
      this.muteText.setText(a.muted ? '\u266A\u0338' : '\u266A');
    });
  }

  _buildPauseOverlay() {
    this.pauseOverlay = this.add.container(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2).setDepth(200).setVisible(false);
    const bg = this.add.rectangle(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT, 0x000000, 0.55);
    const t = this.add.text(0, -20, 'PAUSED', {
      fontFamily: 'Impact, Arial Black', fontSize: '80px', color: '#ffffff',
    }).setOrigin(0.5);
    const h = this.add.text(0, 50, 'press ESC to resume', {
      fontFamily: 'Arial', fontSize: '22px', color: '#9bb4c8',
    }).setOrigin(0.5);
    this.pauseOverlay.add([bg, t, h]);
  }

  setPaused(p) { this.pauseOverlay.setVisible(p); }

  _buildOnboarding() {
    // Progressive control hints shown at game start (desktop only — on touch the
    // on-screen buttons are already self-labeled). Each chip dims as the player
    // performs that action; the whole row fades out once all are done, after a
    // timeout, or when the player reaches wave 2.
    this.onboardChips = null;
    if (this._touchVisible) return;
    const hints = [['MOVE', 'A  D'], ['JUMP', 'W'], ['PUNCH', 'J'], ['KICK', 'K']];
    const y = CONFIG.HEIGHT - 150;
    this.onboardGroup = this.add.container(0, 0).setDepth(115);
    this.onboardChips = [];
    const gap = 190;
    const totalW = gap * (hints.length - 1);
    hints.forEach(([label, key], i) => {
      const cx = CONFIG.WIDTH / 2 - totalW / 2 + i * gap;
      const k = this.add.text(cx, y, key, {
        fontFamily: 'Arial Black', fontSize: '22px', color: '#ffd23f',
        stroke: '#0b1a2a', strokeThickness: 5,
      }).setOrigin(0.5);
      const l = this.add.text(cx, y + 24, label, {
        fontFamily: 'Arial', fontSize: '14px', color: '#9bb4c8',
      }).setOrigin(0.5);
      this.onboardChips.push({ key: k, label: l, action: ['MOVE', 'JUMP', 'PUNCH', 'KICK'][i] });
      this.onboardGroup.add([k, l]);
    });
    this.onboardAlpha = 0;
  }

  banner(text, color = '#ffffff') {
    const b = this.bannerText;
    b.setText(text);
    b.setColor(color);
    b.setAlpha(0).setScale(0.7);
    this.tweens.killTweensOf(b);
    this.tweens.add({ targets: b, alpha: 1, scale: 1, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: b, alpha: 0, scale: 1.1, duration: 380, delay: 950, ease: 'Cubic.in' });
  }

  floatText(text, x, y, color = '#ffffff', size = 22) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Arial Black', fontSize: size + 'px', color,
      stroke: '#0b1a2a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(150);
    this.tweens.add({
      targets: t, y: y - 70, alpha: 0, duration: 750, ease: 'Cubic.out',
      onComplete: () => t.destroy(),
    });
  }

  update() {
    const hud = this.registry.get('hud');
    if (!hud) return;
    // health bar
    const g = this.hudG;
    g.clear();
    const bx = 24, by = 24, bw = 280, bh = 22;
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(bx - 3, by - 3, bw + 6, bh + 6, 6);
    g.fillStyle(0x12203a, 0.95);
    g.fillRoundedRect(bx, by, bw, bh, 5);
    const hp = clamp(hud.health / hud.maxHealth, 0, 1);
    const col = hp > 0.5 ? 0x35e1ff : hp > 0.25 ? 0xffd23f : 0xff3b30;
    g.fillStyle(col, 1);
    g.fillRoundedRect(bx, by, Math.max(0, bw * hp), bh, 5);
    g.lineStyle(2, 0xffffff, 0.25);
    g.strokeRoundedRect(bx, by, bw, bh, 5);
    this.add.text && 0; // no-op
    // label
    if (!this._hpLabel) {
      this._hpLabel = this.add.text(bx + 8, by + 2, 'HP', {
        fontFamily: 'Arial Black', fontSize: '13px', color: '#0b1a2a',
      }).setDepth(101);
    }

    this.scoreText.setText(String(hud.score));
    this.waveText.setText('WAVE ' + hud.wave);
    this.enemyText.setText(hud.enemiesLeft > 0 ? (hud.enemiesLeft + ' left') : '');

    // combo
    if (hud.combo >= 2) {
      this.comboText.setText('x' + hud.combo + ' COMBO');
      this.comboText.setAlpha(Math.min(1, this.comboText.alpha + 0.2));
      this.comboText.setScale(1 + Math.min(hud.combo, 20) * 0.02);
    } else {
      this.comboText.setAlpha(Math.max(0, this.comboText.alpha - 0.1));
    }

    this._updateOnboarding();
  }

  _updateOnboarding() {
    const gs = this.gameScene;
    const ob = gs && gs.onboard;
    if (!ob || !this.onboardChips) return;
    const allDone = ob.move && ob.jump && ob.punch && ob.kick;
    const expired = ob.t > 16;
    const pastIntro = gs.wave >= 2;
    const target = (allDone || expired || pastIntro) ? 0 : 1;
    // smooth fade
    this.onboardAlpha += (target - this.onboardAlpha) * 0.08;
    if (this.onboardAlpha < 0.01 && target === 0) this.onboardAlpha = 0;
    const pulse = 0.85 + 0.15 * Math.sin(ob.t * 5);
    const map = { MOVE: ob.move, JUMP: ob.jump, PUNCH: ob.punch, KICK: ob.kick };
    for (const chip of this.onboardChips) {
      const done = map[chip.action];
      const a = this.onboardAlpha * (done ? 0.3 : 1) * (done ? 1 : pulse);
      chip.key.setAlpha(a);
      chip.label.setAlpha(a);
    }
  }
}
