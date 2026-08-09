// Rare wave-remix events (round 5). The director rolls once at the start of each
// non-boss wave (after MIN_WAVE); a chosen event either changes that wave's spawn
// composition or injects an in-wave mechanic (meteor storm, supply drop, free
// rage). The goal is variety — no two runs play the same. Boss waves are never
// event waves (they already have their own climax).
//
// Pattern mirrors Meta.js: a dictionary of plain objects + small pure helpers.
// Each event exposes an `apply(scene)` hook that sets flags the spawn loop reads,
// keeping all the messy state on the scene (where the existing wave code lives).

import { CONFIG } from '../config.js';

export const EVENTS = {
  swarm: {
    name: 'SWARM WAVE', color: '#6bff9e',
    desc: 'fragile runners flood the arena',
    minWave: 3,
    apply(s) { s.eventExtraSpawns = 3; s.eventForceVariant = 'runner'; },
  },
  heavy: {
    name: 'HEAVY PLATING', color: '#b06bff',
    desc: 'armored brutes & shields — bring kicks',
    minWave: 4,
    apply(s) { s.eventExtraSpawns = -1; s.eventVariantPool = ['brute', 'shielder', 'shielder']; },
  },
  bombsquad: {
    name: 'BOMB SQUAD', color: '#ff9a3d',
    desc: 'volatile bombers — keep your distance!',
    minWave: 4,
    apply(s) { s.eventForceVariant = 'bomber'; },
  },
  hunters: {
    name: 'HUNTER PACK', color: '#ff5cb0',
    desc: 'rangers & leapers pin you down',
    minWave: 5,
    apply(s) { s.eventVariantPool = ['ranger', 'leaper', 'ranger']; },
  },
  elite: {
    name: 'ELITE DUO', color: '#ffd23f',
    desc: 'two vanguard elites inbound',
    minWave: 4,
    apply(s) { s.eventEliteCount = 2; },
  },
  supply: {
    name: 'SUPPLY DROP', color: '#35e1ff',
    desc: 'a care package falls in — grab it!',
    minWave: 3,
    apply(s) { s.eventSupplyDrop = true; if (s._dropSupply) s._dropSupply(); },
  },
  meteor: {
    name: 'METEOR STORM', color: '#ff3b30',
    desc: 'the sky is falling — keep moving!',
    minWave: 5,
    apply(s) { s.eventMeteors = true; s.meteorTimer = 1.2; },
  },
  rage: {
    name: 'RAGE MODE', color: '#ff8a3d',
    desc: 'UNLEASHED — x2 score, harder hits',
    minWave: 3,
    apply(s) { s._startRage(CONFIG.CONTENT.PICKUP.RAGE_TIME * 1.6); },
  },
  frenzy: {
    name: 'FRENZY', color: '#ff3b30',
    desc: 'glass cannon — fast & fierce, but brittle!',
    minWave: 4,
    apply(s) { s.eventFrenzy = true; },
  },
  ambush: {
    name: 'AMBUSH', color: '#ff5cb0',
    desc: 'surrounded! enemies hit from both walls',
    minWave: 4,
    apply(s) { s.eventAmbush = true; s.eventExtraSpawns = 1; },
  },
  plague: {
    name: 'PLAGUE', color: '#9aff6b',
    desc: 'medics sustain the pack — hunt the healers',
    minWave: 5,
    apply(s) { s.eventVariantPool = ['medic', 'bomber', 'medic', 'charger']; },
  },
  blessed: {
    name: 'BLESSED GROUND', color: '#35e1ff',
    desc: 'heal shrines ripple up — claim them!',
    minWave: 3,
    apply(s) { s.eventShrines = true; if (s._dropShrines) s._dropShrines(); },
  },
};

const ORDER = Object.keys(EVENTS);

// Roll a single event for `wave` (or null for a plain wave). Uses Math.random
// by default; pass an rng for deterministic tests.
export function rollEvent(wave, rng = Math.random) {
  const cfg = CONFIG.CONTENT.EVENTS;
  if (wave < cfg.MIN_WAVE) return null;
  if (rng() > cfg.CHANCE) return null;
  const eligible = ORDER.filter((k) => wave >= EVENTS[k].minWave);
  if (!eligible.length) return null;
  return eligible[Math.floor(rng() * eligible.length)];
}

export function getEvent(key) { return EVENTS[key] || null; }
export function eventKeys() { return ORDER.slice(); }
