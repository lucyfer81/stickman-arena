import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';
import { Meta } from '../systems/Meta.js';

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
    this._buildPauseButton();
    this._buildMute();
    this._buildOnboarding();
    this._buildTeach();
    this._buildGoalChip();

    this.floats = [];
    this._touchVisible = false;
    this.refreshTouchVisibility();
    // Named handler, removed on shutdown/destroy — the ScaleManager is global and
    // outlives this scene, so an anonymous arrow would leak one callback (holding
    // a dead UIScene reference) per restart.
    this._onResize = () => this.refreshTouchVisibility();
    this.scale.on('resize', this._onResize);
    this.events.once('shutdown', this._cleanup, this);
    this.events.once('destroy', this._cleanup, this);
  }

  _cleanup() {
    if (this._onResize) this.scale.off('resize', this._onResize);
    this._onResize = null;
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

    // right-side action buttons — sized for thumbs; interactive zone is larger
    // than the visual so near-misses still register (forgiving touch).
    const by = CONFIG.HEIGHT - 84;
    this.btnJump = this._makeBtn(CONFIG.WIDTH - 224, by - 70, 58, 'JUMP', 0x35e1ff);
    this.btnPunch = this._makeBtn(CONFIG.WIDTH - 236, by, 66, 'PUNCH', 0xffd23f);
    this.btnKick = this._makeBtn(CONFIG.WIDTH - 110, by - 30, 74, 'KICK', 0xff6f5c);

    // OVERDRIVE touch button (top-right, isolated). Only visually live + glowing
    // when the meter is full; the press guard (in the handler) blocks misfires.
    this._burstReady = false;
    this.btnBurstG = this.add.graphics().setScrollFactor(0);
    this.btnBurstT = this.add.text(CONFIG.WIDTH - 64, by - 118, '\u26A1', {
      fontFamily: 'Arial Black', fontSize: '26px', color: '#0b1a2a',
    }).setOrigin(0.5);
    this.btnBurstLabel = this.add.text(CONFIG.WIDTH - 64, by - 94, 'BURST', {
      fontFamily: 'Arial Black', fontSize: '10px', color: '#0b1a2a',
    }).setOrigin(0.5);
    this.btnBurstZone = this.add.zone(CONFIG.WIDTH - 64, by - 108, 96, 96).setInteractive();
    this.btnBurstZone.on('pointerdown', () => {
      const c = this.gameScene.controls;
      if (c) c.burstPressed = true;
    });
    this.touchGroup.add([this.btnBurstG, this.btnBurstT, this.btnBurstLabel, this.btnBurstZone]);
    this._drawBurstBtn(false);

    // MERCY SPARE touch button (top-LEFT, mirrors BURST). Only visible +
    // interactive while a surrender window is open (hud.mercyActive). Pressing
    // it any other time is a no-op (the scene handler guards).
    this._mercyActive = false;
    this.btnSpareG = this.add.graphics().setScrollFactor(0);
    this.btnSpareT = this.add.text(72, by - 118, '\u2696', {
      fontFamily: 'Arial Black', fontSize: '26px', color: '#0b1a2a',
    }).setOrigin(0.5);
    this.btnSpareLabel = this.add.text(72, by - 94, 'SPARE', {
      fontFamily: 'Arial Black', fontSize: '10px', color: '#0b1a2a',
    }).setOrigin(0.5);
    this.btnSpareZone = this.add.zone(72, by - 108, 96, 96).setInteractive();
    this.btnSpareZone.on('pointerdown', () => {
      const c = this.gameScene.controls;
      if (c) c.sparePressed = true;
    });
    this.touchGroup.add([this.btnSpareG, this.btnSpareT, this.btnSpareLabel, this.btnSpareZone]);
    this._drawSpareBtn(false);

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
      fontFamily: 'Arial Black', fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);
    // interactive zone is generously larger than the visual circle
    const zone = this.add.zone(x, y, r * 2.5, r * 2.5).setInteractive();
    const c2 = this.gameScene.controls;
    // TOUCH hold-to-repeat: PUNCH/KICK auto-swing while held (one tap = one swing
    // left touch 8x weaker than keyboard mashing). tryAttack() no-ops mid-swing,
    // so this syncs to the attack cycle. Keyboard stays edge-triggered.
    const repeatable = (label === 'PUNCH' || label === 'KICK');
    if (repeatable && !this.touchHeld) this.touchHeld = { PUNCH: false, KICK: false };
    const setFlag = (down) => {
      if (label === 'JUMP') { if (down) { c2.jumpPressed = true; c2.jumpHeldTouch = true; } else c2.jumpHeldTouch = false; }
      if (label === 'PUNCH') { if (down) c2.punchPressed = true; if (repeatable) this.touchHeld.PUNCH = down; }
      if (label === 'KICK') { if (down) c2.kickPressed = true; if (repeatable) this.touchHeld.KICK = down; }
    };
    zone.on('pointerdown', () => { draw(true); setFlag(true); });
    zone.on('pointerup', () => { draw(false); setFlag(false); });
    zone.on('pointerout', () => { draw(false); if (label === 'JUMP') c2.jumpHeldTouch = false; if (repeatable) this.touchHeld[label] = false; });
    zone.on('pointerupoutside', () => { draw(false); if (label === 'JUMP') c2.jumpHeldTouch = false; if (repeatable) this.touchHeld[label] = false; });
    this.touchGroup.add([c, t, zone]);
    return { c, t, zone };
  }

  // OVERDRIVE touch button redraw — only glows when the meter is full/ready so
  // the player reads it as "press me NOW"; dim + small otherwise.
  _drawBurstBtn(ready) {
    const g = this.btnBurstG;
    const bx = CONFIG.WIDTH - 64, by = CONFIG.HEIGHT - 84 - 108;
    const r = ready ? 40 : 30;
    g.clear();
    g.fillStyle(0xffd23f, ready ? 0.9 : 0.18);
    g.fillCircle(bx, by, r);
    g.lineStyle(3, 0xffe26b, ready ? 1 : 0.4);
    g.strokeCircle(bx, by, r);
    if (ready) {
      g.lineStyle(2, 0xffffff, 0.6);
      g.strokeCircle(bx, by, r + 6);
    }
    this.btnBurstT.setPosition(bx, by - 6).setAlpha(ready ? 1 : 0.4);
    this.btnBurstLabel.setPosition(bx, by + 18).setAlpha(ready ? 1 : 0.4);
    this.btnBurstT.setColor(ready ? '#0b1a2a' : '#7a5e1a');
    this.btnBurstLabel.setColor(ready ? '#0b1a2a' : '#7a5e1a');
  }

  // MERCY SPARE button — soft white while a surrender window is open, hidden
  // otherwise. Mirrors _drawBurstBtn but lives top-LEFT (BURST is top-right).
  _drawSpareBtn(active) {
    const g = this.btnSpareG;
    const bx = 72, by = CONFIG.HEIGHT - 84 - 108;
    const r = active ? 40 : 0; // zero radius = effectively invisible
    g.clear();
    if (active) {
      g.fillStyle(0xeaf4ff, 0.9);
      g.fillCircle(bx, by, r);
      g.lineStyle(3, 0xffffff, 1);
      g.strokeCircle(bx, by, r);
      g.lineStyle(2, 0xbfe3ff, 0.6);
      g.strokeCircle(bx, by, r + 6);
    }
    this.btnSpareT.setPosition(bx, by - 6).setAlpha(active ? 1 : 0);
    this.btnSpareLabel.setPosition(bx, by + 18).setAlpha(active ? 1 : 0);
    this.btnSpareT.setColor(active ? '#0b1a2a' : '#8893a6');
    this.btnSpareLabel.setColor(active ? '#0b1a2a' : '#8893a6');
  }

  _buildMute() {
    const x = 24, y = CONFIG.HEIGHT - 30;
    this.muteText = this.add.text(x, y, '\u266A', {
      fontFamily: 'Arial', fontSize: '22px', color: '#7fb6d6',
    }).setOrigin(0, 0.5).setInteractive().setDepth(120);
    const sync = () => {
      const a = this.registry.get('audio');
      if (!a) return;
      const v = a.volume;
      // three glyphs: loud, soft, muted
      this.muteText.setText(v > 0.45 ? '\u266A\u266A' : v > 0 ? '\u266A' : '\u266A\u0338');
      this.muteText.setColor(v <= 0 ? '#ff6f5c' : '#7fb6d6');
    };
    this.muteText.on('pointerdown', () => {
      const a = this.registry.get('audio');
      if (!a) return;
      a.cycleVolume();
      sync();
    });
    this._syncVol = sync;
    sync();
  }

  _buildPauseOverlay() {
    this.pauseOverlay = this.add.container(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2).setDepth(200).setVisible(false);
    const bg = this.add.rectangle(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT, 0x000000, 0.55);
    const t = this.add.text(0, -20, 'PAUSED', {
      fontFamily: 'Impact, Arial Black', fontSize: '80px', color: '#ffffff',
    }).setOrigin(0.5);
    const h = this.add.text(0, 50, 'tap \u25B6 or press ESC to resume', {
      fontFamily: 'Arial', fontSize: '22px', color: '#9bb4c8',
    }).setOrigin(0.5);
    this.pauseOverlay.add([bg, t, h]);
  }

  _buildPauseButton() {
    // Always-visible pause toggle (top-left, just right of the HP bar).
    // Critical for touch devices which have no ESC key; also helps desktop
    // discoverability. Sits above the pause overlay so it can resume too.
    const bx = 24 + 280 + 26, by = 35, r = 16;
    const g = this.add.graphics().setDepth(210);
    const label = this.add.text(bx, by, 'II', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#eaf4ff',
    }).setOrigin(0.5).setDepth(211);
    const draw = (pressed) => {
      g.clear();
      g.fillStyle(0x12203a, pressed ? 0.95 : 0.6);
      g.fillCircle(bx, by, r);
      g.lineStyle(2, 0x9bb4c8, pressed ? 1 : 0.6);
      g.strokeCircle(bx, by, r);
    };
    draw(false);
    const zone = this.add.zone(bx, by, r * 2.6, r * 2.6).setInteractive().setDepth(212);
    zone.on('pointerdown', () => { draw(true); });
    zone.on('pointerup', () => {
      draw(false);
      const gs = this.gameScene;
      if (gs && !gs.gameOver) gs._togglePause();
    });
    zone.on('pointerout', () => draw(false));
    zone.on('pointerupoutside', () => draw(false));
    this._pauseBtn = { g, label, draw };
  }

  setPaused(p) {
    this.pauseOverlay.setVisible(p);
    // swap glyph II / ▶ so the button reads as a resume control while paused
    if (this._pauseBtn) {
      this._pauseBtn.label.setText(p ? '\u25B6' : 'II');
    }
  }

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

  update(_time, deltaMs) {
    const hud = this.registry.get('hud');
    if (!hud) return;
    // TOUCH hold-to-repeat: while a PUNCH/KICK button is held, re-arm the edge
    // every frame so the next swing fires as soon as the attack cycle allows.
    // tryAttack() no-ops mid-swing, so this auto-syncs to the player's attack
    // timing — letting touch players chain attacks like keyboard mashing.
    if (this.touchHeld && this.gameScene && this.gameScene.controls) {
      const c = this.gameScene.controls;
      if (this.touchHeld.PUNCH) c.punchPressed = true;
      if (this.touchHeld.KICK) c.kickPressed = true;
    }
    // OVERDRIVE touch button: refresh its glow from the live HUD ready flag.
    if (this.btnBurstG && this._drawBurstBtn) {
      const ready = !!(hud && hud.burstReady);
      if (ready !== this._burstReady) { this._burstReady = ready; this._drawBurstBtn(ready); }
    }
    // MERCY SPARE touch button: only visible while a surrender window is open.
    if (this.btnSpareG && this._drawSpareBtn) {
      const active = !!(hud && hud.mercyActive);
      if (active !== this._mercyActive) { this._mercyActive = active; this._drawSpareBtn(active); }
    }
    // frame-rate-independent tween rates (were ±0.2/0.1 per frame → 2.4x faster
    // on 144Hz). Normalize to per-second using the actual frame delta.
    const dt = Math.min(deltaMs || 16, 50) / 1000;
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
    // label
    if (!this._hpLabel) {
      this._hpLabel = this.add.text(bx + 8, by + 2, 'HP', {
        fontFamily: 'Arial Black', fontSize: '13px', color: '#0b1a2a',
      }).setDepth(101);
    }

    // OVERDRIVE burst meter — a gold bar under the HP bar. Always visible: it's a
    // core player-earned mechanic, so the player should always see it building.
    // Pulses + shows a key hint when full and ready to unleash.
    {
      const bb_w = bw, bb_h = 9, bb_y = by + bh + 4;
      g.fillStyle(0x000000, 0.5);
      g.fillRoundedRect(bx - 2, bb_y - 2, bb_w + 4, bb_h + 4, 4);
      g.fillStyle(0x2a2008, 0.95);
      g.fillRoundedRect(bx, bb_y, bb_w, bb_h, 4);
      const bfrac = clamp((hud.burst || 0) / (hud.burstMax || 1), 0, 1);
      const ready = (hud.burst || 0) >= (hud.burstMax || 1) && !hud.bursting;
      const pulse = ready ? (0.55 + 0.45 * Math.sin(this.time.now * 0.016)) : 1;
      g.fillStyle(ready ? 0xffe26b : 0xffd23f, pulse);
      g.fillRoundedRect(bx, bb_y, Math.max(0, bb_w * bfrac), bb_h, 4);
      if (ready) {
        g.lineStyle(2, 0xffffff, 0.75 * pulse);
        g.strokeRoundedRect(bx, bb_y, bb_w, bb_h, 4);
      }
      if (!this._burstLabel) {
        this._burstLabel = this.add.text(bx + bb_w / 2, bb_y + bb_h / 2, 'OVERDRIVE', {
          fontFamily: 'Arial Black', fontSize: '8px', color: '#0b1a2a',
        }).setOrigin(0.5).setDepth(101);
      }
      // ready hint: pulse the prompt at the bar
      this._burstLabel.setText(ready ? (this._touchVisible ? 'TAP \u26A1 OVERDRIVE' : 'OVERDRIVE \u2014 PRESS L') : 'OVERDRIVE');
      this._burstLabel.setColor(ready ? '#0b1a2a' : '#7a5e1a');
      this._burstLabel.setAlpha(ready ? 0.95 * pulse : 0.5);
    }

    // RAGE bar — a thin orange bar under the OVERDRIVE bar that only appears while the
    // rage buff is active, so the player sees both the payoff (x2 score / harder
    // hits) and the remaining duration.
    if (hud.rage && hud.rage > 0) {
      const rb_w = bw, rb_h = 7, rb_y = by + bh + 4 + 9 + 3;
      g.fillStyle(0x000000, 0.5);
      g.fillRoundedRect(bx - 2, rb_y - 2, rb_w + 4, rb_h + 4, 4);
      g.fillStyle(0x2a1208, 0.95);
      g.fillRoundedRect(bx, rb_y, rb_w, rb_h, 3);
      const rfrac = clamp(hud.rage / (hud.rageMax || 1), 0, 1);
      const pulse = 0.7 + 0.3 * Math.sin(this.time.now * 0.02);
      g.fillStyle(0xff8a3d, pulse);
      g.fillRoundedRect(bx, rb_y, Math.max(0, rb_w * rfrac), rb_h, 3);
      if (!this._rageLabel) {
        this._rageLabel = this.add.text(bx + rb_w / 2, rb_y + rb_h / 2, 'RAGE', {
          fontFamily: 'Arial Black', fontSize: '9px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(101);
      }
      this._rageLabel.setAlpha(0.9 * rfrac);
    } else if (this._rageLabel) {
      this._rageLabel.setAlpha(0);
    }

    // SECOND WIND — a prominent draining timer bar while in the broken window.
    // Placed bottom-centre so it reads as a desperate countdown, not a stat.
    if (hud.broken) {
      const bw = 520, bhb = 18;
      const bxx = CONFIG.WIDTH / 2 - bw / 2, byy = CONFIG.HEIGHT - 64;
      const frac = clamp((hud.brokenT || 0) / (hud.brokenMax || 1), 0, 1);
      const danger = frac < 0.33;
      const pulse = 0.7 + 0.3 * Math.sin(this.time.now * (danger ? 0.025 : 0.012));
      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(bxx - 4, byy - 4, bw + 8, bhb + 8, 6);
      g.fillStyle(0x1a0608, 0.95);
      g.fillRoundedRect(bxx, byy, bw, bhb, 5);
      const bcol = danger ? 0xff3b30 : 0xff6f5c;
      g.fillStyle(bcol, pulse);
      g.fillRoundedRect(bxx, byy, Math.max(0, bw * frac), bhb, 5);
      g.lineStyle(2, 0xffd23f, 0.8);
      g.strokeRoundedRect(bxx, byy, bw, bhb, 5);
      if (!this._brokenLabel) {
        this._brokenLabel = this.add.text(CONFIG.WIDTH / 2, byy + bhb / 2, 'SECOND WIND', {
          fontFamily: 'Arial Black', fontSize: '12px', color: '#ffffff',
          stroke: '#0b1a2a', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(101);
      }
      this._brokenLabel.setVisible(true);
      this._brokenLabel.setText(danger ? 'SECOND WIND \u2014 RISE!' : 'SECOND WIND');
    } else if (this._brokenLabel) {
      this._brokenLabel.setVisible(false);
    }

    this.scoreText.setText(String(hud.score));
    this.waveText.setText('WAVE ' + hud.wave);
    this.enemyText.setText(hud.enemiesLeft > 0 ? (hud.enemiesLeft + ' left') : '');

    // combo
    const tierHit = hud.combo >= 5;
    if (hud.combo >= 2) {
      this.comboText.setText('x' + hud.combo + ' COMBO');
      this.comboText.setAlpha(Math.min(1, this.comboText.alpha + 12 * dt));
      this.comboText.setScale(1 + Math.min(hud.combo, 20) * 0.02);
      this.comboText.setColor(tierHit ? '#ffd23f' : '#35e1ff');
      // combo timer bar — shows the remaining combo window so the player knows
      // when the chain is about to drop
      const frac = clamp((hud.comboTimer || 0) / (hud.comboWindow || 1), 0, 1);
      const cw = 220, ch = 9, cxx = CONFIG.WIDTH / 2 - cw / 2, cyy = 182;
      const calpha = this.comboText.alpha;
      g.fillStyle(0x000000, 0.4 * calpha);
      g.fillRoundedRect(cxx - 2, cyy - 2, cw + 4, ch + 4, 4);
      const ccol = frac > 0.5 ? 0x35e1ff : frac > 0.25 ? 0xffd23f : 0xff3b30;
      g.fillStyle(ccol, calpha);
      g.fillRoundedRect(cxx, cyy, Math.max(0, cw * frac), ch, 4);
    } else {
      this.comboText.setAlpha(Math.max(0, this.comboText.alpha - 6 * dt));
    }

    // boss health bar — spans the top center while a boss is alive. A distinct
    // red/gold fixture so the climactic encounter reads as a real duel.
    if (hud.boss) {
      const bx = CONFIG.WIDTH / 2 - 340, by = 110, bw = 680, bh = 22;
      g.fillStyle(0x000000, 0.55);
      g.fillRoundedRect(bx - 4, by - 4, bw + 8, bh + 8, 6);
      g.fillStyle(0x1a0c0c, 0.95);
      g.fillRoundedRect(bx, by, bw, bh, 5);
      const frac = clamp(hud.boss.hp / hud.boss.maxHp, 0, 1);
      // flash gold under 50% (enrage) for tension
      const bcol = hud.boss.enraged ? 0xff6f5c : (frac < 0.5 ? 0xff8a3d : 0xff3b30);
      g.fillStyle(bcol, 1);
      g.fillRoundedRect(bx, by, Math.max(0, bw * frac), bh, 5);
      g.lineStyle(2, 0xffd23f, 0.8);
      g.strokeRoundedRect(bx, by, bw, bh, 5);
      if (!this._bossLabel) {
        this._bossLabel = this.add.text(CONFIG.WIDTH / 2, by + bh / 2, 'BOSS', {
          fontFamily: 'Arial Black', fontSize: '15px', color: '#ffd23f',
          stroke: '#0b1a2a', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(101);
      }
      this._bossLabel.setVisible(true);
      const name = hud.boss.name || 'BOSS';
      this._bossLabel.setText(hud.boss.enraged ? (name + '  \u2014  ENRAGED') : name);
    } else if (this._bossLabel) {
      this._bossLabel.setVisible(false);
    }

    this._updateOnboarding(dt);
    this._updateTeachHints(dt);
    this._refreshGoalChip();
  }

  _updateOnboarding(dt) {
    const gs = this.gameScene;
    const ob = gs && gs.onboard;
    if (!ob || !this.onboardChips) return;
    const allDone = ob.move && ob.jump && ob.punch && ob.kick;
    const expired = ob.t > 16;
    const pastIntro = gs.wave >= 2;
    const target = (allDone || expired || pastIntro) ? 0 : 1;
    // exponential approach, framerate-independent (was *0.08 per frame).
    const k = 1 - Math.exp(-5 * dt);
    this.onboardAlpha += (target - this.onboardAlpha) * k;
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

  // ---- teaching hints (retention) ----
  // The static chips just label keys; these callouts POINT at the moment of need:
  // a pre-contact pointer at the approaching enemy, a finisher hint on a
  // one-shot enemy, and an AFK lifeline if the player freezes. Desktop shows the
  // key letter, touch shows the action word. Gated to early waves + pre-first-hit.
  _buildTeach() {
    this._teachCloseT = 0;
    this.teachPointer = this.add.text(0, 0, '', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#ffd23f',
      stroke: '#0b1a2a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(160).setAlpha(0);
    this.teachFinisher = this.add.text(0, 0, '', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#ff6f5c',
      stroke: '#0b1a2a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(160).setAlpha(0);
    this.teachAfk = this.add.text(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 120, '', {
      fontFamily: 'Arial Black', fontSize: '30px', color: '#ffd23f',
      stroke: '#0b1a2a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(161).setAlpha(0);
  }

  _updateTeachHints(dt) {
    const gs = this.gameScene;
    const pointer = this.teachPointer, finisher = this.teachFinisher, afk = this.teachAfk;
    if (!gs || gs.gameOver || gs.paused) {
      pointer.setAlpha(0); finisher.setAlpha(0); afk.setAlpha(0); return;
    }
    const ob = gs.onboard;
    const R = CONFIG.RETENTION;
    const early = gs.wave <= R.TEACH_WAVES;
    // read touch flag live (refreshTouchVisibility maintains it, incl. on resize)
    const touch = !!this._touchVisible;
    const label = touch
      ? { punch: 'PUNCH', kick: 'KICK' }
      : { punch: 'J', kick: 'K' };

    // find nearest living non-boss enemy (the teaching target)
    let near = null, nd = 1e9, finisherTarget = null;
    const kickDmg = CONFIG.PLAYER.KICK.DAMAGE;
    for (const e of gs.enemies) {
      if (e.dead || e.isBoss) continue;
      const d = Math.abs(e.x - gs.player.x);
      if (d < nd) { nd = d; near = e; }
      if (early && e.health > 0 && e.health <= kickDmg && !finisherTarget) finisherTarget = e;
    }

    // FINISHER hint takes precedence over the approach pointer (same enemy slot)
    let showFinisher = false;
    if (early && finisherTarget && !(gs.player.attack && gs.player.attack.type === 'kick')) {
      showFinisher = true;
      finisher.setText('\u25BC ' + label.kick);
      finisher.setPosition(finisherTarget.x, finisherTarget.y - 156);
    }

    // APPROACH pointer: pre-first-contact, point at the incoming enemy
    let showPointer = false;
    if (early && !showFinisher && !ob.firstHit && near && nd < R.TEACH_APPROACH_DIST && nd > R.TEACH_AFK_DIST) {
      showPointer = true;
      pointer.setText('\u25BC ' + label.punch);
      pointer.setPosition(near.x, near.y - 172);
    }

    // AFK lifeline: enemy is on the player and no attack pressed for a beat
    let showAfk = false;
    if (gs.wave === 1 && !ob.punch && !ob.kick && near && nd < R.TEACH_AFK_DIST) {
      this._teachCloseT += dt;
      if (this._teachCloseT > R.TEACH_AFK_GRACE) {
        showAfk = true;
        afk.setText(touch ? 'TAP  PUNCH  TO  FIGHT!' : 'PRESS  J  TO  FIGHT!');
      }
    } else {
      this._teachCloseT = 0;
    }

    const pulse = 0.6 + 0.4 * Math.sin((ob.t || 0) * 7);
    pointer.setAlpha(showPointer ? pulse : 0);
    finisher.setAlpha(showFinisher ? pulse : 0);
    afk.setAlpha(showAfk ? pulse : 0);
  }

  // ---- in-run goal chip (retention: surface meta-progression during play) ----
  _buildGoalChip() {
    this.goalText = this.add.text(CONFIG.WIDTH / 2, CONFIG.HEIGHT - 104, '', {
      fontFamily: 'Arial', fontSize: '13px', color: '#7fb6d6',
    }).setOrigin(0.5).setDepth(101).setAlpha(0);
    this._goalWave = -1;
    this._goalKey = null;
  }

  _refreshGoalChip() {
    const gs = this.gameScene;
    if (!gs) return;
    // recompute only when the wave changes (cheap; stats that move mid-run —
    // bestWave/combo — only help, never lock, so a stale "next" is still correct)
    if (gs.wave === this._goalWave) return;
    this._goalWave = gs.wave;
    const goal = Meta.nextUnlock();
    if (!goal) { this.goalText.setAlpha(0); return; }
    this.goalText.setText('NEXT  \u2192  ' + goal.text + '  \u00B7  ' + goal.skinLabel + ' skin');
    this.goalText.setAlpha(0.8);
  }
}
