// All sound is synthesised with the Web Audio API: oscillators and
// noise made in code. No audio files, and nothing plays until the
// player first presses a key, so browsers allow it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 760;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300;
      lfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      lfo.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, delay) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume || 0.2, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  return {
    ensure,
    setEngine(speed01, driving) {
      if (!ctx) return;
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 120, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(driving ? 0.025 + speed01 * 0.05 : 0, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.04 : 0, ctx.currentTime, 0.2);
    },
    chime() {
      tone(880, 0.1, 'sine', 0.2, 0);
      tone(1318, 0.14, 'sine', 0.16, 0.07);
    },
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.2, i * 0.09));
    },
    bust() {
      [330, 262, 196].forEach((f, i) => tone(f, 0.24, 'sawtooth', 0.14, i * 0.16));
    },
    thud() {
      tone(90, 0.12, 'sine', 0.3, 0);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
