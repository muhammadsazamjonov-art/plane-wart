export class Sfx {
  ctx: AudioContext | null = null;
  engine: OscillatorNode | null = null;
  engineGain: GainNode | null = null;
  master: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  enabled = true;

  init(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled || this.ctx) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(ctx.destination);
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 60;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 400;
      const g = ctx.createGain();
      g.gain.value = 0.06;
      o.connect(f).connect(g).connect(this.master);
      o.start();
      this.engine = o;
      this.engineGain = g;
      const len = ctx.sampleRate * 1;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch {
      this.ctx = null;
    }
  }
  setEngine(throttle: number, speed: number) {
    if (!this.ctx || !this.engine || !this.engineGain) return;
    this.engine.frequency.setTargetAtTime(45 + throttle * 60 + speed * 0.15, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(0.03 + throttle * 0.06, this.ctx.currentTime, 0.1);
  }
  noise(dur: number, vol: number, freq: number) {
    if (!this.ctx || !this.noiseBuf || !this.master) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
  }
  beep(freq: number, dur: number, vol = 0.1, type: OscillatorType = "square") {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }
  gun() { this.noise(0.06, 0.25, 2500); }
  boom(near: number) { this.noise(1.2, 0.8 * near, 500); }
  missile() { this.noise(0.6, 0.3, 1200); }
  hit() { this.beep(900, 0.05, 0.08); }
  warn() { this.beep(1200, 0.08, 0.06); }
  coin() { this.beep(1320, 0.08, 0.08, "triangle"); setTimeout(() => this.beep(1760, 0.12, 0.08, "triangle"), 70); }
  dispose() {
    try { this.ctx?.close(); } catch { /* */ }
    this.ctx = null;
  }
}
