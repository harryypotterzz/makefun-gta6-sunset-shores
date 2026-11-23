// Sunset Shores — tiny WebAudio sound effects, no audio files.
// One job only: bleeps for pickups, a thud for crashes, a two-tone siren
// while the heat is on, and a low engine hum that follows the car's speed.
// Everything is synthesized; the game loads no sound asset.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.sirenNodes = null;
    this.engineNodes = null;
  }

  /** Call from a user gesture (key press / click) to unlock audio. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.25;
    return this.muted;
  }

  _tone(freq, dur, type = 'sine', volume = 0.5, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, volume = 0.4) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  pickup() { this._tone(880, 0.12, 'sine', 0.5, 1320); }
  cash() { this._tone(660, 0.1, 'triangle', 0.4); this._tone(990, 0.14, 'triangle', 0.35); }
  crash() { this._noise(0.25, 0.5); this._tone(90, 0.2, 'sawtooth', 0.3, 50); }
  missionDone() {
    this._tone(523, 0.12, 'triangle', 0.5);
    setTimeout(() => this._tone(659, 0.12, 'triangle', 0.5), 110);
    setTimeout(() => this._tone(784, 0.2, 'triangle', 0.5), 220);
  }
  busted() { this._tone(392, 0.3, 'sawtooth', 0.4, 196); }
  enterCar() { this._tone(180, 0.15, 'square', 0.25, 320); }

  /** Two-tone police siren while wanted > 0; call every frame. */
  setSiren(on) {
    if (!this.ctx || this.muted) { this._stopSiren(); return; }
    if (on && !this.sirenNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 700;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const gain = this.ctx.createGain();
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      lfo.start();
      this.sirenNodes = { osc, lfo, gain };
    } else if (!on && this.sirenNodes) {
      this._stopSiren();
    }
  }

  _stopSiren() {
    if (!this.sirenNodes) return;
    try {
      this.sirenNodes.osc.stop();
      this.sirenNodes.lfo.stop();
    } catch { /* already stopped */ }
    this.sirenNodes = null;
  }

  /** Engine hum following the car's speed; call every frame. */
  setEngine(speed, driving) {
    if (!this.ctx || this.muted || !driving) {
      if (this.engineNodes) {
        try { this.engineNodes.osc.stop(); } catch { /* already stopped */ }
        this.engineNodes = null;
      }
      return;
    }
    if (!this.engineNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.03;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.engineNodes = { osc, gain };
    }
    this.engineNodes.osc.frequency.value = 55 + Math.abs(speed) * 0.14;
  }
}
