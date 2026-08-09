import { CONFIG } from '../config.js';
import { Options } from '../systems/Options.js';

// Options / settings overlay. Launchable on top of the Title (before a run, the
// common case) or over a paused Game (hand-cramp rebinding mid-session). Solves
// the two top post-launch complaints (Round 3 review audit) at once: no key
// rebinding (#1, recurred every round) and no screen-shake toggle (#2, motion
// sickness). Closes on ESC/BACK; while open, the scenes underneath are guarded
// so their ESC/pause/start handlers can't fire through it.
//
// Default controls stay byte-identical: arrow keys + SPACE always remain as
// fixed movement/jump alternates (see GameScene._setupKeyboard), so rebinding
// can never leave the player unable to move.
export class OptionsScene extends Phaser.Scene {
  constructor() { super('Options'); }

  create(data) {
    this.from = (data && data.from) || 'title';
    this.registry.set('optionsOpen', true);

    const cx = CONFIG.WIDTH / 2;
    this.capturing = null;   // action id while waiting for a key press
    this._flashT = 0;        // conflict-flash timer (red pulse)
    this._flashMsg = '';

    // ---- backdrop (absorbs pointer so clicks don't fall through to Title) ----
    this.backdrop = this.add.rectangle(cx, CONFIG.HEIGHT / 2, CONFIG.WIDTH, CONFIG.HEIGHT, 0x000000, 0.72)
      .setInteractive().setDepth(300);

    // ---- panel ----
    const pw = 760, ph = 600, px = cx - pw / 2, py = 70;
    this.panel = this.add.graphics().setDepth(301);
    this.panel.fillStyle(0x0c1326, 0.96);
    this.panel.fillRoundedRect(px, py, pw, ph, 18);
    this.panel.lineStyle(2, 0x35e1ff, 0.55);
    this.panel.strokeRoundedRect(px, py, pw, ph, 18);

    this.add.text(cx, 112, 'OPTIONS', {
      fontFamily: 'Impact, Arial Black, sans-serif', fontSize: '52px', color: '#eaf4ff',
      stroke: '#35e1ff', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(302);

    this.add.text(cx, 152, 'click a key to rebind  \u00B7  arrows + SPACE always work for move/jump', {
      fontFamily: 'Arial', fontSize: '15px', color: '#7fb6d6',
    }).setOrigin(0.5).setDepth(302);

    // ---- bindable action rows ----
    this.rows = [];
    const top = 196;
    const rowH = 44;
    Options.ACTIONS.forEach((act, i) => {
      const y = top + i * rowH;
      const row = this._makeRow(cx, y, pw - 120, act);
      this.rows.push(row);
    });

    // ---- shake toggle row ----
    const shakeY = top + Options.ACTIONS.length * rowH + 6;
    this.shakeLabel = this.add.text(cx - 200, shakeY, 'SCREEN SHAKE', {
      fontFamily: 'Arial Black', fontSize: '19px', color: '#eaf4ff',
      stroke: '#0b1a2a', strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(302);
    this.shakeValue = this.add.text(cx + 200, shakeY, '', {
      fontFamily: 'Arial Black', fontSize: '19px', color: '#ffd23f',
      stroke: '#0b1a2a', strokeThickness: 4,
    }).setOrigin(1, 0.5).setDepth(302).setInteractive({ useHandCursor: true });
    const shakeZone = this.add.zone(cx, shakeY, pw - 120, rowH).setInteractive({ useHandCursor: true }).setDepth(304);
    shakeZone.on('pointerdown', () => this._cycleShake());
    this._refreshShake();

    // ---- reset + back ----
    const bottomY = py + ph - 64;
    this.resetLabel = this.add.text(cx - 130, bottomY, '\u21BA  RESET TO DEFAULTS', {
      fontFamily: 'Arial Black', fontSize: '17px', color: '#ff6f5c',
      stroke: '#0b1a2a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(302).setInteractive({ useHandCursor: true });
    this.resetLabel.on('pointerdown', () => {
      Options.resetBindings();
      this._refreshRows();
      this._flash('reset to defaults', '#6bff9e');
      this.audio && this.audio.ui();
    });

    this.backLabel = this.add.text(cx + 130, bottomY, 'BACK  (ESC)', {
      fontFamily: 'Arial Black', fontSize: '19px', color: '#35e1ff',
      stroke: '#0b1a2a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(302).setInteractive({ useHandCursor: true });
    this.backLabel.on('pointerdown', () => this.close());

    // ---- status line (capture prompt / conflict flash) ----
    this.status = this.add.text(cx, bottomY - 44, '', {
      fontFamily: 'Arial Black', fontSize: '17px', color: '#ffd23f',
      stroke: '#0b1a2a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(302);

    // ---- key capture: the global keydown listener handles both rebind + ESC ----
    this.input.keyboard.on('keydown', (evt) => this._onKey(evt));

    this.events.once('shutdown', () => {
      this.registry.set('optionsOpen', false);
      if (typeof window !== 'undefined' && window.__options) window.__options.open = false;
    });
    this.events.once('destroy', () => {
      this.registry.set('optionsOpen', false);
      if (typeof window !== 'undefined' && window.__options) window.__options.open = false;
    });

    this.cameras.main.fadeIn(120);
    this._publish();
  }

  // one rebind row: label (left) + current key (right, clickable).
  _makeRow(cx, y, w, act) {
    const label = this.add.text(cx - w / 2, y, act.label, {
      fontFamily: 'Arial Black', fontSize: '19px', color: '#cfe3f2',
      stroke: '#0b1a2a', strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(302);

    const keyBg = this.add.graphics().setDepth(302);
    const keyText = this.add.text(cx + w / 2, y, '', {
      fontFamily: 'Arial Black', fontSize: '19px', color: '#eaf4ff',
      stroke: '#0b1a2a', strokeThickness: 4,
    }).setOrigin(1, 0.5).setDepth(303);

    const zone = this.add.zone(cx, y, w, 38).setInteractive({ useHandCursor: true }).setDepth(304);
    zone.on('pointerover', () => keyBg.clear() || this._drawKeyBg(keyBg, keyText, act, true));
    zone.on('pointerout', () => keyBg.clear() || this._drawKeyBg(keyBg, keyText, act, false));
    zone.on('pointerdown', () => this._beginCapture(act.id, keyText, keyBg));

    const row = { act, label, keyText, keyBg, zone };
    this._drawKeyBg(keyBg, keyText, act, false);
    return row;
  }

  // the little rounded chip behind the current key
  _drawKeyBg(g, keyText, act, hover) {
    const name = Options.binding(act.id);
    keyText.setText(Options.keyLabel(name));
    const tw = keyText.width + 34;
    const th = 32;
    const x = keyText.x - tw + 6; // right-aligned to the text (origin 1,0.5)
    const y = keyText.y - th / 2;
    g.clear();
    g.fillStyle(hover ? 0x1c3a5e : 0x12203a, 0.95);
    g.fillRoundedRect(x, y, tw, th, 8);
    g.lineStyle(2, hover ? 0x35e1ff : 0x3a567a, 0.9);
    g.strokeRoundedRect(x, y, tw, th, 8);
  }

  _refreshRows() {
    for (const r of this.rows) this._drawKeyBg(r.keyBg, r.keyText, r.act, false);
    this._publish();
  }

  _refreshShake() {
    const m = Options.shakeMode().toUpperCase();
    this.shakeValue.setText('\u25C0  ' + m + '  \u25B6');
    this._publish();
  }

  _cycleShake() {
    const modes = Options.SHAKE_MODES;
    const idx = modes.indexOf(Options.shakeMode());
    Options.setShakeMode(modes[(idx + 1) % modes.length]);
    this._refreshShake();
    this.audio && this.audio.ui();
  }

  _beginCapture(actionId) {
    this.capturing = actionId;
    this._flash('PRESS A KEY for ' + Options.ACTIONS.find((a) => a.id === actionId).label + '  \u00B7  ESC to cancel', '#ffd23f');
    this.audio && this.audio.ui();
    this._publish();
  }

  _onKey(evt) {
    if (this.capturing) {
      if (evt.code === 'Escape' || evt.key === 'Escape') { this._cancelCapture(); return; }
      if (evt.repeat) return;
      const name = this._codeToName(evt);
      if (!name) { this._cancelCapture(); return; }
      // reserved (ESC) can't be bound
      if (Options.setBinding(this.capturing, name)) {
        const done = this.capturing;
        this.capturing = null;
        this._refreshRows();
        this._flash(done + ' \u2192 ' + Options.keyLabel(name), '#6bff9e');
        this.audio && this.audio.ui();
      } else {
        this._flash('that key is reserved', '#ff6f5c');
      }
      return;
    }
    if (evt.code === 'Escape' || evt.key === 'Escape') this.close();
  }

  _cancelCapture() {
    this.capturing = null;
    this._flashMsg = ''; this._flashT = 0;
    this.status.setText('');
    this._publish();
  }

  _flash(msg, color) {
    this._flashMsg = msg;
    this._flashT = 1.6;
    this.status.setText(msg);
    this.status.setColor(color || '#ffd23f');
  }

  // DOM KeyboardEvent.code -> a Phaser KeyCodes name that addKey() accepts.
  _codeToName(evt) {
    const code = evt.code || '';
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);          // KeyA -> A
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);        // Digit1 -> 1
    const map = {
      Space: 'SPACE', Enter: 'ENTER', Tab: 'TAB',
      ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT',
      ControlLeft: 'CTRL', ControlRight: 'CTRL',
      AltLeft: 'ALT', AltRight: 'ALT',
      ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
      Semicolon: 'SEMICOLON', Comma: 'COMMA', Period: 'PERIOD',
      Slash: 'SLASH', Quote: 'QUOTE', Backslash: 'BACKSLASH',
      Minus: 'MINUS', Equal: 'EQUALS', Backquote: 'BACKQUOTE',
      BracketLeft: 'OPEN_BRACKET', BracketRight: 'CLOSED_BRACKET',
    };
    if (map[code]) return map[code];
    if (evt.key && evt.key.length === 1) return evt.key.toUpperCase();
    return null;
  }

  close() {
    this.audio && this.audio.ui();
    this.cameras.main.fadeOut(120);
    this.time.delayedCall(110, () => this.scene.stop());
  }

  update(_t, dtMs) {
    // capture prompt pulses so the player notices it's listening
    if (this.capturing) {
      const p = 0.6 + 0.4 * Math.sin(this.time.now * 0.012);
      this.status.setAlpha(p);
    } else if (this._flashT > 0) {
      this._flashT -= dtMs / 1000;
      if (this._flashT <= 0) { this.status.setText(''); this._flashMsg = ''; }
    }
  }

  // telemetry for tests + external inspection
  _publish() {
    if (typeof window !== 'undefined') {
      window.__options = {
        open: true,
        capturing: this.capturing,
        from: this.from,
        bindings: Options.bindings(),
        shakeMode: Options.shakeMode(),
      };
    }
  }
}
