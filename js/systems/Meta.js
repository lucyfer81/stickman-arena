// Meta-progression: persistent stats, unlockable skins, and a daily modifier.
// All persisted to localStorage. No backend.

import { COLORS } from '../config.js';

const KEY_STATS = 'stickman_arena_stats';
const KEY_SKIN = 'stickman_arena_skin';
const KEY_DAILY = 'stickman_arena_daily';

// Unlockable player palettes (cosmetic). 'default' is always available.
const SKINS = {
  default: {
    label: 'CYAN', palette: COLORS.player,
    unlock: { type: 'default' },
  },
  ember: {
    label: 'EMBER',
    palette: { limb: 0xff8a3d, joint: 0xffb88a, head: 0xffe0c8, accent: 0xff3b30, fist: 0xffd23f },
    unlock: { type: 'wave', value: 5, desc: 'reach wave 5' },
  },
  toxic: {
    label: 'TOXIC',
    palette: { limb: 0x6bff9e, joint: 0xb3ffd2, head: 0xd9ffe9, accent: 0x16c45a, fist: 0xeaff5c },
    unlock: { type: 'kills', value: 100, desc: 'defeat 100 enemies' },
  },
  royal: {
    label: 'ROYAL',
    palette: { limb: 0xb06bff, joint: 0xd9b3ff, head: 0xecd9ff, accent: 0x8b2fff, fist: 0xffd23f },
    unlock: { type: 'score', value: 5000, desc: 'score 5000 in one run' },
  },
  gold: {
    label: 'GOLD',
    palette: { limb: 0xffd23f, joint: 0xffea99, head: 0xfff5cc, accent: 0xff9b00, fist: 0xffffff },
    unlock: { type: 'combo', value: 20, desc: 'hit a x20 combo' },
  },
};

const DEFAULT_STATS = {
  totalKills: 0, gamesPlayed: 0, bestWave: 0, bestCombo: 0, bestScore: 0, totalScore: 0,
};

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try { return Object.assign({}, fallback, JSON.parse(raw)); } catch (e) { return fallback; }
}

export const Meta = {
  loadStats() {
    try { return safeParse(localStorage.getItem(KEY_STATS), DEFAULT_STATS); }
    catch (e) { return Object.assign({}, DEFAULT_STATS); }
  },
  saveStats(s) {
    try { localStorage.setItem(KEY_STATS, JSON.stringify(s)); } catch (e) {}
  },

  // record a finished run; returns the updated stats + newly-unlocked skin keys
  recordRun(result) {
    const s = this.loadStats();
    s.totalKills += result.kills || 0;
    s.gamesPlayed += 1;
    s.bestWave = Math.max(s.bestWave, result.wave || 0);
    s.bestCombo = Math.max(s.bestCombo, result.bestCombo || 0);
    s.bestScore = Math.max(s.bestScore, result.score || 0);
    s.totalScore += result.score || 0;
    const before = this.unlockedSkins(this.loadStats());
    this.saveStats(s);
    // re-check unlocks using the freshly saved bests (bestScore/bestCombo/wave)
    const after = this.unlockedSkins(s);
    const newlyUnlocked = after.filter((k) => before.indexOf(k) === -1);
    return { stats: s, newlyUnlocked };
  },

  // record an in-run combo milestone unlock (e.g. x20 mid-run)
  noteCombo(combo) {
    const s = this.loadStats();
    if (combo > s.bestCombo) { s.bestCombo = combo; this.saveStats(s); }
  },

  isSkinUnlocked(key, stats) {
    stats = stats || this.loadStats();
    const skin = SKINS[key];
    if (!skin) return false;
    const u = skin.unlock;
    switch (u.type) {
      case 'default': return true;
      case 'wave': return stats.bestWave >= u.value;
      case 'kills': return stats.totalKills >= u.value;
      case 'score': return stats.bestScore >= u.value;
      case 'combo': return stats.bestCombo >= u.value;
      default: return false;
    }
  },
  unlockedSkins(stats) {
    stats = stats || this.loadStats();
    return Object.keys(SKINS).filter((k) => this.isSkinUnlocked(k, stats));
  },
  skinDef(key) { return SKINS[key] || SKINS.default; },
  allSkins() { return SKINS; },
  getSkin() {
    try { return localStorage.getItem(KEY_SKIN) || 'default'; } catch (e) { return 'default'; }
  },
  setSkin(key) {
    if (!SKINS[key]) return;
    try { localStorage.setItem(KEY_SKIN, key); } catch (e) {}
  },
  skinPalette(key) { return this.skinDef(key || this.getSkin()).palette; },

  // ---- daily challenge ----
  // a date key + a deterministic modifier chosen from the date. The run itself
  // uses normal RNG; the modifier is the daily hook (same for everyone today).
  todayKey(d) {
    const date = d || new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  dailyModifier(d) {
    const MODIFIERS = [
      { key: 'frenzy', name: 'FRENZY', desc: 'enemies +25% speed', enemySpeed: 1.25, scoreMul: 1.0 },
      { key: 'bloodlust', name: 'BLOODLUST', desc: 'x2 score, enemies +25% dmg', scoreMul: 2.0, enemyDmg: 1.25 },
      { key: 'glass', name: 'GLASS', desc: '70 HP, +50% score', playerHp: 70, scoreMul: 1.5 },
      { key: 'swarm', name: 'SWARM', desc: '+1 enemy per wave', extraPerWave: 1, scoreMul: 1.0 },
      { key: 'hunter', name: 'HUNTER', desc: 'enemies +20% hp, +30% score', enemyHp: 1.2, scoreMul: 1.3 },
    ];
    const date = d || new Date();
    const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    return MODIFIERS[seed % MODIFIERS.length];
  },
  dailyBest() {
    const key = this.todayKey();
    try {
      const raw = localStorage.getItem(KEY_DAILY);
      const obj = raw ? JSON.parse(raw) : {};
      return { key, best: obj[key] || 0 };
    } catch (e) { return { key: this.todayKey(), best: 0 }; }
  },
  recordDaily(score) {
    const key = this.todayKey();
    try {
      const raw = localStorage.getItem(KEY_DAILY);
      const obj = raw ? JSON.parse(raw) : {};
      if (score > (obj[key] || 0)) {
        obj[key] = score;
        localStorage.setItem(KEY_DAILY, JSON.stringify(obj));
        return true; // new daily best
      }
    } catch (e) {}
    return false;
  },
};
