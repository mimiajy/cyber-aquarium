/* Original Underwater Ambient soundscape. No samples, network, or frame-loop work.
 * The generated audio is CC0-1.0; see AUDIO.md. Audio starts only after a gesture.
 */
(() => {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  function random(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function waterBuffer(context, duration = 24) {
    // The water is filtered below 440Hz. 16kHz source buffers retain that band
    // while avoiding unnecessary full-rate allocation on the first mobile tap.
    const rate = Math.min(context.sampleRate,16000);
    const length = Math.ceil(rate * duration), fade = Math.ceil(rate * 2);
    const buffer = context.createBuffer(2, length, rate), rng = random(84721);
    for (let channel = 0; channel < 2; channel++) {
      const source = new Float32Array(length + fade); let brown = 0;
      for (let i = 0; i < source.length; i++) { brown = (brown + (rng() * 2 - 1) * .025) / 1.025; source[i] = brown * 3; }
      const out = buffer.getChannelData(channel); out.set(source.subarray(0, length));
      // Last sample flows into source[length], then fades into the new head.
      // Both edges and their slope remain continuous at the 24-second wrap.
      for (let i = 0; i < fade; i++) {
        const blend = (1 - Math.cos(Math.PI * i / fade)) * .5;
        out[i] = source[length + i] * (1 - blend) + source[i] * blend;
      }
    }
    return buffer;
  }
  function impulse(context) {
    const length = Math.ceil(context.sampleRate * 3.8), buffer = context.createBuffer(2, length, context.sampleRate), rng = random(61037);
    for (let ch = 0; ch < 2; ch++) {
      const out = buffer.getChannelData(ch); let smooth = 0;
      for (let i = 0; i < length; i++) {
        smooth += ((rng() * 2 - 1) - smooth) * .22;
        out[i] = smooth * Math.exp(-i / length * 7) * Math.min(1, i / (context.sampleRate * .018)) * .045;
      }
    }
    return buffer;
  }
  function buildGraph(context) {
    const master = context.createGain(); master.gain.value = 0;
    const bus = context.createGain(), filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1800; filter.Q.value = .45;
    const highpass = context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 35; highpass.Q.value = .45;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 18; limiter.ratio.value = 3; limiter.attack.value = .03; limiter.release.value = .8;
    bus.connect(filter); filter.connect(highpass); highpass.connect(limiter); limiter.connect(master); master.connect(context.destination);
    const reverb = context.createConvolver(), wet = context.createGain();
    reverb.normalize = false; reverb.buffer = impulse(context); wet.gain.value = .26;
    bus.connect(reverb); reverb.connect(wet); wet.connect(filter);
    const sources = [];
    function oscillator(frequency, target, amount, type = 'sine') {
      const source = context.createOscillator(), level = context.createGain();
      source.type = type; source.frequency.value = frequency; level.gain.value = amount;
      source.connect(level); level.connect(target); source.start(); sources.push(source); return source;
    }
    // D minor add9, open voicing. No rhythmic attacks: independent slow tides
    // keep a sustained harmonic bed alive without a finite music-file seam.
    for (const [i, frequency] of [73.4162, 146.8324, 174.6141, 220, 329.6276].entries()) {
      const level = context.createGain(); level.gain.value = i === 0 ? .12 : .075;
      const pan = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
      if (pan.pan) { pan.pan.value = (i % 2 ? -.22 : .22); oscillator(.013 + i * .0017, pan.pan, .15); }
      level.connect(pan); pan.connect(bus);
      const a = oscillator(frequency, level, .55), b = oscillator(frequency, level, .35);
      a.detune.value = -2.2 - i * .19; b.detune.value = 2.4 + i * .17;
      oscillator(.018 + i * .0031, level.gain, i === 0 ? .025 : .025);
      oscillator(.009 + i * .0013, a.detune, 1.1);
    }
    const water = context.createBufferSource(), waterFilter = context.createBiquadFilter(), waterGain = context.createGain();
    water.buffer = waterBuffer(context); water.loop = true;
    waterFilter.type = 'lowpass'; waterFilter.frequency.value = 440; waterFilter.Q.value = .4;
    waterGain.gain.value = .09; water.connect(waterFilter); waterFilter.connect(waterGain); waterGain.connect(bus); water.start(); sources.push(water);
    oscillator(.021, waterGain.gain, .025);
    return { master, sources };
  }
  class Soundscape {
    constructor({ contextFactory, volume = .35, onChange = () => {}, onError = () => {} } = {}) {
      this.contextFactory = contextFactory || (() => {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) throw new Error('此浏览器暂不支持环境音乐');
        return new Audio({ latencyHint: 'playback' });
      });
      this.context = null; this.graph = null; this.enabled = false; this.pending = false; this.volume = clamp(volume);
      this.onChange = onChange; this.onError = onError; this.operation = 0; this.suspendTimer = null;
      this.envelope = { from: 0, to: 0, start: 0, end: 0 };
    }
    get playing() { return this.enabled && this.context?.state === 'running'; }
    valueAt(time) {
      const e = this.envelope, fraction = e.end > e.start ? Math.max(0, Math.min(1, (time - e.start) / (e.end - e.start))) : 1;
      return e.from + (e.to - e.from) * fraction;
    }
    ramp(target, duration) {
      if (!this.graph) return;
      const now = this.context.currentTime, current = this.valueAt(now), gain = this.graph.master.gain;
      gain.cancelScheduledValues(now); gain.setValueAtTime(current, now); gain.linearRampToValueAtTime(target, now + duration);
      this.envelope = { from: current, to: target, start: now, end: now + duration };
    }
    async setEnabled(value) {
      const operation = ++this.operation;
      this.enabled = Boolean(value); this.pending = this.enabled; clearTimeout(this.suspendTimer);
      if (!this.enabled) {
        this.ramp(0, 1.6); this.onChange(this);
        if (this.context) this.suspendTimer = setTimeout(() => {
          if (!this.enabled && operation === this.operation) this.context.suspend().catch(() => {});
        }, 1750);
        return;
      }
      try {
        if (!this.context) {
          this.context = this.contextFactory();
          this.context.addEventListener('statechange', () => this.onChange(this));
          // Resume is requested synchronously within the click, before buffer work.
        }
        const ready = this.context.resume();
        if (!this.graph) this.graph = buildGraph(this.context);
        await ready;
        if (operation !== this.operation) return;
        if (this.context.state !== 'running') throw new Error('请再次点按开启深海氛围');
        this.pending = false;
        this.ramp(this.volume * .55, 2.4); this.onChange(this);
      } catch (error) {
        if (operation !== this.operation) return;
        this.enabled = false; this.pending = false; this.ramp(0, .2); this.onChange(this); this.onError(error);
      }
    }
    toggle() { return this.setEnabled(this.pending ? false : !this.playing); }
    setVolume(value) { this.volume = clamp(value); if (this.enabled) this.ramp(this.volume * .55, .25); this.onChange(this); }
  }
  globalThis.ReefAudio = { Soundscape, waterBuffer, buildGraph };
})();
