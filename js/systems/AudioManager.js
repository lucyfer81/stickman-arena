// Procedural audio via WebAudio. No external files.
// Volume is a 3-level cycle (high/low/mute) persisted to localStorage.
//
// In addition to one-shot SFX, the manager runs a GENERATIVE MUSIC engine: a
// lookahead scheduler loops a 16-step bar, and the active "intensity" picks the
// tempo/scale/drum pattern. This is the soundtrack — there are no audio files.
// Intensities: menu (calm pad/arp) -> combat (groove) -> boss (driving) ->
// broken (tense). Routed through its own gain so it ducks under SFX and obeys
// the master volume / pause-mute.
const LEVELS = [0.6, 0.3, 0];

// --- generative music patterns (16 steps / bar, 16th-note grid) ---
// scale = absolute frequencies; arp arrays hold indices into `scale`; bass
// arrays hold absolute low frequencies (or null = rest); drums are 0/1 gates.
const MUSIC = {
  menu: {
    bpm: 92,
    scale: [220.00, 261.63, 293.66, 329.63, 392.00],      // A minor pentatonic
    arp:  [0, null, 2, null, 4, null, 3, null, 2, null, 1, null, 4, null, 3, null],
    arpOct: 1,
    pad: [220.00, 261.63, 329.63],                         // sustained chord every 8 steps
    bass: null,
    drums: null,
  },
  combat: {
    bpm: 126,
    scale: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00],
    arp:  [0, null, null, 2, null, 3, null, null, 2, null, null, 4, null, 3, null, null],
    arpOct: 1,
    bass: [110.00, null, null, null, 110.00, null, null, null, 130.81, null, null, null, 87.31, null, null, null],
    drums: { kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,1] },
  },
  boss: {
    bpm: 150,
    scale: [220.00, 261.63, 311.13, 329.63, 392.00, 466.16], // harmonic-minor tension (Eb, Bb)
    arp:  [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 4, 2, 3, 2, 1, 2],
    arpOct: 1,
    bass: [55.00, null, 55.00, null, 55.00, null, null, 55.00, 65.41, null, 65.41, null, 49.00, null, null, 49.00],
    drums: { kick: [1,0,0,1,1,0,0,1,1,0,0,1,1,0,1,1], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1], hat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
  },
  broken: {
    bpm: 140,
    scale: [220.00, 233.08, 293.66, 311.13, 369.99],        // diminished/tense (Bb, Eb, F#)
    arp:  [0, null, 1, null, null, 3, null, 1, 0, null, 4, null, null, 1, null, 3],
    arpOct: 1,
    bass: [55.00, null, null, 58.27, null, null, 55.00, null, null, 61.74, null, null, 49.00, null, 51.91, null],
    drums: { kick: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0] },
  },
};
const MUSIC_VOL = { menu: 0.11, combat: 0.14, boss: 0.16, broken: 0.12 };

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._timers = new Set();
    let stored = 0.6;
    try { stored = parseFloat(localStorage.getItem('stickman_arena_vol')); if (isNaN(stored)) stored = 0.6; } catch (e) {}
    this.volume = stored;
    this.muted = this.volume <= 0;
  }

  _ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return false; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      this.enabled = false;
      return false;
    }
  }

  // tracked setTimeout so multi-note sequences can be cancelled on teardown.
  _later(fn, ms) {
    const id = setTimeout(() => { this._timers.delete(id); try { fn(); } catch (e) {} }, ms);
    this._timers.add(id);
    return id;
  }

  destroy() {
    if (this._music && this._music.timer) { clearInterval(this._music.timer); this._music.timer = null; }
    this._music = null;
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
    try { if (this.ctx) this.ctx.close(); } catch (e) {}
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
  }

  resume() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // 3-level volume cycle: 0.6 -> 0.3 -> 0 (mute) -> 0.6
  cycleVolume() {
    const idx = LEVELS.indexOf(this.volume);
    const next = LEVELS[(idx + 1) % LEVELS.length] ?? 0.6;
    this.setVolume(next);
    return next;
  }

  setVolume(v) {
    this.volume = v;
    this.muted = v <= 0;
    if (this.master) this.master.gain.value = v;
    try { localStorage.setItem('stickman_arena_vol', String(v)); } catch (e) {}
  }

  // pause mute (restores prior volume on unmute)
  setMuted(m) {
    this.suppressed = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  _silent() { return !this.enabled || this.volume <= 0 || this.suppressed; }

  // ===================== GENERATIVE MUSIC ENGINE =====================
  // A lookahead scheduler (the classic "A Tale of Two Clocks" pattern): a 25ms
  // interval peeks 0.2s ahead and schedules notes at precise AudioContext
  // times. The active intensity selects tempo + patterns, so scene events can
  // retune the mood instantly (menu/combat/boss/broken). Music lives on its own
  // gain node below the master, so master volume + pause-mute apply for free.
  _initMusic() {
    if (this._music) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0001;
    this.musicGain.connect(this.master);
    this._music = { on: false, intensity: 'combat', step: 0, nextNoteTime: 0, timer: null };
    // single recurring tick for the engine's whole life; it no-ops when off or
    // when the context isn't running (e.g. before the first user gesture).
    this._music.timer = setInterval(() => this._musicTick(), 25);
  }

  startMusic(intensity = 'combat') {
    this._ensure();
    if (!this.ctx) return;
    if (!this._music) this._initMusic();
    this._music.on = true;
    this._music.intensity = intensity in MUSIC ? intensity : 'combat';
    this._applyMusicGain();
  }

  setMusicIntensity(intensity) {
    if (!this._music || !(intensity in MUSIC)) return;
    if (this._music.intensity === intensity) return;
    this._music.intensity = intensity;
    this._applyMusicGain();
  }

  stopMusic() {
    if (!this._music) return;
    this._music.on = false;
    this._applyMusicGain();
  }

  getMusicState() {
    if (!this._music) return { on: false, intensity: null, bpm: 0 };
    const pat = MUSIC[this._music.intensity] || MUSIC.combat;
    return { on: !!this._music.on, intensity: this._music.intensity, bpm: pat.bpm };
  }

  _applyMusicGain() {
    if (!this._music || !this.musicGain || !this.ctx) return;
    try {
      const base = MUSIC_VOL[this._music.intensity] != null ? MUSIC_VOL[this._music.intensity] : 0.14;
      const target = this._music.on ? Math.max(0.0001, base) : 0.0001;
      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(Math.max(0.0001, this.musicGain.gain.value), t);
      this.musicGain.gain.linearRampToValueAtTime(target, t + 0.45);
    } catch (e) {}
  }

  _musicTick() {
    if (!this._alive() || !this._music || !this._music.on) return;
    if (this.ctx.state !== 'running') return;            // no audio until gesture-resumed
    const m = this._music;
    const pat = MUSIC[m.intensity] || MUSIC.combat;
    const stepDur = (60 / pat.bpm) / 4;                  // 16th note
    const lookahead = 0.2;
    if (m.nextNoteTime < this.ctx.currentTime) m.nextNoteTime = this.ctx.currentTime + 0.02;
    let guard = 0;
    while (m.nextNoteTime < this.ctx.currentTime + lookahead && guard++ < 64) {
      this._scheduleStep(m.step, m.nextNoteTime, pat);
      m.nextNoteTime += stepDur;
      m.step = (m.step + 1) % 16;
    }
  }

  _scheduleStep(step, time, pat) {
    try {
      if (pat.bass) { const f = pat.bass[step]; if (f) this._mBass(f, time, 0.20); }
      if (pat.arp) {
        const deg = pat.arp[step];
        if (deg != null) {
          const f = pat.scale[deg % pat.scale.length] * (pat.arpOct || 1);
          this._mOsc(f, time, 0.16, 'triangle', 0.085);
        }
      }
      if (pat.pad && (step % 8 === 0)) { for (const f of pat.pad) this._mOsc(f, time, 1.7, 'sine', 0.045); }
      if (pat.drums) {
        const d = pat.drums;
        if (d.kick && d.kick[step]) this._mKick(time);
        if (d.snare && d.snare[step]) this._mSnare(time);
        if (d.hat && d.hat[step]) this._mHat(time);
      }
    } catch (e) {}
  }

  // scheduled (absolute-time) note helpers — independent of the SFX _env path.
  _mOsc(freq, time, dur, type, peak) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(time); o.stop(time + dur + 0.03);
  }

  _mBass(freq, time, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, time);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 460; f.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.20, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(time); o.stop(time + dur + 0.03);
  }

  _mKick(time) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(135, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.28, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    o.connect(g); g.connect(this.musicGain);
    o.start(time); o.stop(time + 0.2);
  }

  _mSnare(time) { this._mNoiseHit(time, 0.16, 1800, 'bandpass', 0.14); }

  _mHat(time) { this._mNoiseHit(time, 0.045, 8000, 'highpass', 0.045); }

  _mNoiseHit(time, dur, ff, ftype, peak) {
    const ctx = this.ctx;
    const src = this._noise(dur);
    const f = ctx.createBiquadFilter();
    f.type = ftype; f.frequency.value = ff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(time); src.stop(time + dur + 0.03);
  }
  // ===================== /GENERATIVE MUSIC ENGINE =====================

  _noise(dur) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  _env(node, gain, attack, decay, peak = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g);
    g.connect(this.master);
    return { g, t };
  }

  _alive() { return this.ctx && this.ctx.state !== 'closed'; }

  tone(freq, dur, type = 'sine', gain = 0.4, slideTo = null) {
    if (this._silent()) return;
    this._ensure();
    if (!this._alive()) return;
    try {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const { g } = this._env(o, gain, 0.005, dur);
      o.start();
      o.stop(ctx.currentTime + dur + 0.05);
      return g;
    } catch (e) {}
  }

  noise(dur, gain = 0.4, filterFreq = 1200, filterType = 'lowpass') {
    if (this._silent()) return;
    this._ensure();
    if (!this._alive()) return;
    try {
      const ctx = this.ctx;
      const src = this._noise(dur);
      const filt = ctx.createBiquadFilter();
      filt.type = filterType;
      filt.frequency.value = filterFreq;
      src.connect(filt);
      this._env(filt, gain, 0.004, dur);
      src.start();
      src.stop(ctx.currentTime + dur + 0.05);
    } catch (e) {}
  }

  punch() { this.tone(180, 0.12, 'square', 0.25, 70); this.noise(0.08, 0.18, 900); }
  kick() { this.tone(120, 0.18, 'sawtooth', 0.3, 50); this.noise(0.12, 0.22, 700); }
  hit() { this.noise(0.1, 0.3, 2200, 'bandpass'); this.tone(90, 0.1, 'triangle', 0.2, 40); }
  bigHit() { this.noise(0.16, 0.4, 1600); this.tone(70, 0.18, 'sawtooth', 0.3, 35); }
  jump() { this.tone(300, 0.16, 'square', 0.18, 560); }
  land() { this.tone(140, 0.08, 'sine', 0.18, 80); }
  enemyDie() { this.tone(260, 0.22, 'sawtooth', 0.22, 60); this.noise(0.18, 0.18, 1200); }
  playerHurt() { this.tone(220, 0.18, 'square', 0.25, 110); }
  ui() { this.tone(520, 0.08, 'square', 0.16, 700); }
  start() { this.tone(440, 0.1, 'square', 0.18, 660); this._later(() => this.tone(660, 0.14, 'square', 0.18, 880), 90); }
  combo(n) {
    const base = 440 + Math.min(n, 12) * 60;
    this.tone(base, 0.09, 'square', 0.18, base * 1.4);
  }
  wave(n) {
    this.tone(330, 0.12, 'triangle', 0.2, 440);
    this._later(() => this.tone(440, 0.12, 'triangle', 0.2, 550), 110);
    this._later(() => this.tone(550, 0.16, 'triangle', 0.2, 660), 220);
  }
  gameover() {
    this.tone(440, 0.2, 'sawtooth', 0.22, 330);
    this._later(() => this.tone(330, 0.2, 'sawtooth', 0.22, 220), 180);
    this._later(() => this.tone(220, 0.4, 'sawtooth', 0.22, 110), 360);
  }
}
