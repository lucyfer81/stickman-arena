// Procedural audio via WebAudio. No external files.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.muted = false;
  }

  _ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

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

  tone(freq, dur, type = 'sine', gain = 0.4, slideTo = null) {
    if (!this.enabled || this.muted) return;
    this._ensure();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const { g } = this._env(o, gain, 0.005, dur);
    o.start();
    o.stop(ctx.currentTime + dur + 0.05);
    return g;
  }

  noise(dur, gain = 0.4, filterFreq = 1200, filterType = 'lowpass') {
    if (!this.enabled || this.muted) return;
    this._ensure();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = this._noise(dur);
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    src.connect(filt);
    this._env(filt, gain, 0.004, dur);
    src.start();
    src.stop(ctx.currentTime + dur + 0.05);
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
  start() { this.tone(440, 0.1, 'square', 0.18, 660); setTimeout(() => this.tone(660, 0.14, 'square', 0.18, 880), 90); }
  combo(n) {
    const base = 440 + Math.min(n, 12) * 60;
    this.tone(base, 0.09, 'square', 0.18, base * 1.4);
  }
  wave(n) {
    this.tone(330, 0.12, 'triangle', 0.2, 440);
    setTimeout(() => this.tone(440, 0.12, 'triangle', 0.2, 550), 110);
    setTimeout(() => this.tone(550, 0.16, 'triangle', 0.2, 660), 220);
  }
  gameover() {
    this.tone(440, 0.2, 'sawtooth', 0.22, 330);
    setTimeout(() => this.tone(330, 0.2, 'sawtooth', 0.22, 220), 180);
    setTimeout(() => this.tone(220, 0.4, 'sawtooth', 0.22, 110), 360);
  }
}
