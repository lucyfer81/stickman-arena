// Options / settings: rebindable controls + an accessibility shake toggle.
// All persisted to localStorage, with an in-memory cache so the per-frame
// readers (the impulse-shake scale, the input polling) never hit JSON.parse.
// Mirrors Meta.js's persistence style.
//
// Why this exists: post-launch reviews (Round 3) showed the #1 and #2
// complaints were "no key rebinding" (recurred every round since launch) and
// "no screen-shake toggle" (motion sickness) — both symptoms of the same
// missing feature: a settings screen. This module is the data layer for it.

const KEY = 'stickman_arena_options';

// Bindable actions in display order. Defaults reproduce the game's original
// layout exactly (A/D/W + J/K/L/H), so a fresh install behaves byte-identical.
export const ACTIONS = [
  { id: 'left',  label: 'MOVE LEFT',   default: 'A' },
  { id: 'right', label: 'MOVE RIGHT',  default: 'D' },
  { id: 'jump',  label: 'JUMP',        default: 'W' },
  { id: 'punch', label: 'PUNCH',       default: 'J' },
  { id: 'kick',  label: 'KICK',        default: 'K' },
  { id: 'burst', label: 'OVERDRIVE',   default: 'L' },
  { id: 'spare', label: 'SPARE',       default: 'H' },
];

// Accessibility shake modes. 'full' = as designed; 'reduced' = 40% amplitude
// (the juice still reads but nausea sufferers get relief); 'off' = none.
export const SHAKE_MODES = ['full', 'reduced', 'off'];
const SHAKE_SCALE = { full: 1, reduced: 0.4, off: 0 };

// Mobile haptics (navigator.vibrate). On for touch by default; a toggle so
// players who dislike rumble can kill it. No-op on desktop (no vibrator).
export const HAPTICS_MODES = ['on', 'off'];

// ESC is reserved (pause / cancel-capture) so it can never be bound to an action.
const RESERVED = new Set(['ESC', 'ESCAPE']);

// in-memory cache (single-page app); invalidated + rebuilt on every write.
let _cache = null;
function load() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(KEY);
    _cache = raw ? JSON.parse(raw) : null;
  } catch (e) { _cache = null; }
  return _cache;
}
function save(obj) {
  _cache = obj;
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
}

function defaultBindings() {
  const b = {};
  for (const a of ACTIONS) b[a.id] = a.default;
  return b;
}

// friendly display label for a Phaser key name
const LABELS = {
  SPACE: 'SPACE', ENTER: 'ENTER', SHIFT: 'SHIFT', CTRL: 'CTRL', ALT: 'ALT', TAB: 'TAB',
  LEFT: '\u2190', RIGHT: '\u2192', UP: '\u2191', DOWN: '\u2193',
  SEMICOLON: ';', COMMA: ',', PERIOD: '.', SLASH: '/', QUOTE: '\u2019',
  BACKSLASH: '\\', MINUS: '-', PLUS: '+', EQUALS: '=',
};

export const Options = {
  ACTIONS,
  SHAKE_MODES,
  HAPTICS_MODES,

  defaults: defaultBindings,

  // current bindings, merged over defaults so newly-added actions always land
  bindings() {
    const raw = load();
    if (!raw || !raw.bindings) return defaultBindings();
    return Object.assign(defaultBindings(), raw.bindings);
  },
  binding(action) { return this.bindings()[action]; },

  // set one binding; rejects reserved keys + duplicates (returns false on reject)
  setBinding(action, keyName) {
    if (RESERVED.has(String(keyName).toUpperCase())) return false;
    const b = this.bindings();
    // remove the key from any other action first (swap-out), then assign
    for (const a of ACTIONS) if (b[a.id] === keyName) b[a.id] = b[action] || a.default;
    b[action] = keyName;
    this._persist(b, this.shakeMode(), this.hapticsMode());
    return true;
  },

  // does this key collide with another action? (for UI feedback)
  conflict(action, keyName) {
    const b = this.bindings();
    for (const a of ACTIONS) {
      if (a.id === action) continue;
      if (b[a.id] === keyName) return a.id;
    }
    return null;
  },

  resetBindings() { this._persist(defaultBindings(), this.shakeMode(), this.hapticsMode()); },

  shakeMode() {
    const raw = load();
    const m = raw && raw.shakeMode;
    return SHAKE_MODES.indexOf(m) >= 0 ? m : 'full';
  },
  setShakeMode(mode) {
    if (SHAKE_MODES.indexOf(mode) < 0) return;
    this._persist(this.bindings(), mode, this.hapticsMode());
  },
  // amplitude multiplier the impulse-shake reads each call (cached => cheap)
  shakeScale() { return SHAKE_SCALE[this.shakeMode()] != null ? SHAKE_SCALE[this.shakeMode()] : 1; },

  hapticsMode() {
    const raw = load();
    const m = raw && raw.haptics;
    return HAPTICS_MODES.indexOf(m) >= 0 ? m : 'on';
  },
  setHapticsMode(mode) {
    if (HAPTICS_MODES.indexOf(mode) < 0) return;
    this._persist(this.bindings(), this.shakeMode(), mode);
  },
  haptics() { return this.hapticsMode() === 'on'; },

  // internal: write the full settings object atomically (so no setter erases
  // another field — each carries the complete current state).
  _persist(bindings, shakeMode, haptics) {
    save({ bindings, shakeMode, haptics });
  },

  keyLabel(name) {
    if (!name) return '\u2014';
    const u = String(name).toUpperCase();
    if (LABELS[u]) return LABELS[u];
    if (u.length === 1) return u;
    return u;
  },
};
