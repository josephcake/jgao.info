/**
 * All audio is synthesized. PKT's sounds are chiptune (square/saw blips);
 * the world's sounds are soft foley (filtered noise, low sines): squelch, thud.
 */
export type SfxName =
  | 'jump' | 'djump' | 'dash' | 'land' | 'hit' | 'hit3' | 'bounce' | 'clang' | 'jack' | 'plug' | 'unplug' | 'zip'
  | 'hack' | 'nocarrier' | 'hurt' | 'die' | 'recalOn' | 'recalOff' | 'squelch' | 'thud' | 'gate' | 'shot' | 'charge'
  | 'crumble' | 'roar' | 'exit' | 'select' | 'type' | 'coo' | 'flap' | 'squawk' | 'thunder';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private wantMusic = false;
  muted = false;

  /** Must be called from a user gesture before sound plays. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.8;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.22;
    this.music.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.wantMusic) this.startMusic();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0, out?: AudioNode): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', q = 1, slideTo?: number, delay = 0, out?: AudioNode): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out ?? this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name: SfxName): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump': this.tone(330, 0.12, 'square', 0.12, 660); break;
      case 'djump': this.tone(440, 0.1, 'square', 0.1, 990); this.tone(880, 0.08, 'square', 0.05, 1320, 0.05); break;
      case 'dash': this.tone(1200, 0.14, 'sawtooth', 0.07, 200); this.noise(0.12, 0.08, 3000, 'highpass'); break;
      case 'land': this.noise(0.12, 0.25, 500, 'lowpass', 1, 120); this.tone(110, 0.08, 'sine', 0.2, 60); break;
      case 'hit': this.tone(220, 0.08, 'square', 0.12, 110); this.squelch(0.15); break;
      case 'hit3': this.tone(160, 0.14, 'sawtooth', 0.16, 60); this.squelch(0.3); break;
      case 'bounce': this.tone(520, 0.1, 'square', 0.1, 1560); this.tone(1040, 0.06, 'triangle', 0.06, undefined, 0.04); break;
      case 'thunder': this.noise(1.6, 0.22, 220, 'lowpass', 1, 60); this.noise(0.25, 0.12, 900, 'lowpass', 1, 200); break;
      case 'coo': this.tone(420, 0.12, 'sine', 0.1, 360); this.tone(380, 0.16, 'sine', 0.09, 300, 0.13); break;
      case 'flap': this.noise(0.06, 0.12, 1800, 'bandpass', 2); this.noise(0.06, 0.1, 1500, 'bandpass', 2, undefined, 0.08); break;
      case 'squawk': this.tone(900, 0.18, 'sawtooth', 0.12, 500); this.tone(1300, 0.12, 'square', 0.06, 700, 0.05); break;
      case 'clang': this.tone(1400, 0.2, 'triangle', 0.1, 1300); this.tone(2100, 0.15, 'triangle', 0.06); break;
      case 'jack': this.tone(500, 0.12, 'square', 0.08, 1500); break;
      case 'plug': this.tone(880, 0.05, 'square', 0.12); this.tone(1320, 0.08, 'square', 0.1, undefined, 0.05); this.noise(0.04, 0.2, 2000, 'bandpass', 4); break;
      case 'unplug': this.tone(1320, 0.05, 'square', 0.1); this.tone(660, 0.08, 'square', 0.08, undefined, 0.05); break;
      case 'zip': this.tone(300, 0.25, 'sawtooth', 0.06, 1400); break;
      case 'hack': for (let i = 0; i < 6; i++) this.tone(400 + Math.random() * 1600, 0.04, 'square', 0.07, undefined, i * 0.035); break;
      case 'nocarrier': this.tone(200, 0.25, 'square', 0.1, 180); this.tone(150, 0.3, 'square', 0.08, undefined, 0.12); break;
      case 'hurt': this.tone(600, 0.25, 'sawtooth', 0.14, 80); this.noise(0.2, 0.15, 1200, 'bandpass', 2); break;
      case 'die': this.tone(880, 0.8, 'square', 0.12, 40); this.tone(440, 0.8, 'sawtooth', 0.08, 30, 0.1); break;
      case 'recalOn': this.tone(200, 0.35, 'sine', 0.15, 90); this.noise(0.3, 0.06, 400); break;
      case 'recalOff': this.tone(90, 0.25, 'sine', 0.12, 260); this.tone(1200, 0.06, 'square', 0.04, undefined, 0.15); break;
      case 'squelch': this.squelch(0.35); break;
      case 'thud': this.tone(70, 0.3, 'sine', 0.35, 35); this.noise(0.25, 0.2, 300, 'lowpass', 1, 80); break;
      case 'gate': this.tone(55, 0.6, 'sawtooth', 0.06, 45); this.noise(0.5, 0.1, 250, 'lowpass'); break;
      case 'shot': this.tone(260, 0.1, 'sine', 0.15, 120); this.noise(0.08, 0.1, 900, 'lowpass'); break;
      case 'charge': this.tone(200, 0.5, 'triangle', 0.06, 800); break;
      case 'crumble': this.noise(0.6, 0.35, 700, 'lowpass', 1, 90); this.tone(60, 0.5, 'sine', 0.3, 30); break;
      case 'roar': this.tone(80, 1.2, 'sawtooth', 0.18, 40); this.noise(1.0, 0.25, 500, 'lowpass', 2, 120); break;
      case 'exit': for (let i = 0; i < 5; i++) this.tone(440 * Math.pow(1.26, i), 0.12, 'square', 0.07, undefined, i * 0.06); break;
      case 'select': this.tone(990, 0.06, 'square', 0.08); break;
      case 'type': this.tone(1600 + Math.random() * 400, 0.015, 'square', 0.025); break;
    }
  }

  private squelch(vol: number): void {
    this.noise(0.22, vol, 900, 'lowpass', 6, 150);
    this.tone(180, 0.18, 'sine', vol * 0.6, 70);
  }

  /** Simple synthwave loop: bass, arp, kick, hats. */
  startMusic(): void {
    this.wantMusic = true;
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule(): void {
    const c = this.ctx!;
    const sixteenth = 60 / 108 / 4;
    const roots = [45, 41, 48, 43];
    const chords = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 11], [0, 4, 7, 10]];
    while (this.nextNote < c.currentTime + 0.12) {
      const bar = Math.floor(this.step / 16) % 4;
      const s = this.step % 16;
      const t = this.nextNote - c.currentTime;
      const root = roots[bar];
      const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
      if (s % 2 === 0) this.tone(mtof(root - 12 + (s % 8 === 6 ? 12 : 0)), sixteenth * 1.8, 'sawtooth', 0.22, undefined, t, this.music);
      const ch = chords[bar];
      this.tone(mtof(root + 12 + ch[(s * 3) % 4]), sixteenth * 0.9, 'square', 0.05, undefined, t, this.music);
      if (s % 4 === 0) this.tone(120, 0.18, 'sine', 0.5, 40, t, this.music);
      if (s % 4 === 2) this.noise(0.05, 0.12, 8000, 'highpass', 1, undefined, t, this.music);
      if (s === 4 || s === 12) this.noise(0.18, 0.18, 1800, 'bandpass', 1, 600, t, this.music);
      this.nextNote += sixteenth;
      this.step++;
    }
  }
}

export const Audio = new AudioEngine();
