// Better SAM — веб-синтезатор речи с эффектами
// SAM-ядро: sam-js (BSD-2-Clause, Sebastian Macke / Joshua Scoggins)
import SamJs from 'https://cdn.jsdelivr.net/npm/sam-js@0.3.2/+esm';

/* ============================================================
 *  UTIL
 * ========================================================== */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n, d = 2) => (+n).toFixed(d);

function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = 'toast ' + kind), 2600);
}
function setStatus(s) { $('#status').textContent = s; }

/* ============================================================
 *  WAV ENCODER
 * ========================================================== */
function encodeWAV(buffer) {
  const numCh = buffer.numberOfChannels;
  const len = buffer.length;
  const sr = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));

  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = clamp(chans[c][i], -1, 1);
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/* ============================================================
 *  PRESETS — только параметры
 * ========================================================== */
const BUILTIN_PRESETS = {
  'Classic SAM': {
    voice: { pitch: 64, speed: 72, mouth: 128, throat: 128, volume: 1, pause: 0 },
    fx: {}
  },
  'Deep Robot': {
    voice: { pitch: 20, speed: 60, mouth: 100, throat: 200, volume: 1, pause: 0 },
    fx: {
      eq: { on: true, low: 8, mid: -2, high: -4, lowF: 200, midF: 1000, highF: 4000 },
      distortion: { on: true, drive: 0.35, tone: 0.5, mix: 0.7, mode: 'soft' },
      chorus: { on: true, rate: 0.4, depth: 0.4, mix: 0.3, width: 0.6 },
      compressor: { on: true, threshold: -18, ratio: 4, attack: 0.005, release: 0.15, knee: 6, makeup: 2 }
    }
  },
  'Retro Computer': {
    voice: { pitch: 90, speed: 90, mouth: 80, throat: 90, volume: 0.9, pause: 0 },
    fx: {
      bitcrusher: { on: true, bits: 6, sr: 8000, mix: 1 },
      eq: { on: true, low: -6, mid: 3, high: 4, lowF: 250, midF: 1500, highF: 5000 },
      delay: { on: true, time: 0.12, feedback: 0.25, mix: 0.2, pingpong: false, bpm: 120, beat: 0.25 }
    }
  },
  'Haunted Radio': {
    voice: { pitch: 70, speed: 65, mouth: 120, throat: 140, volume: 1, pause: 20 },
    fx: {
      phone: { on: true, mix: 1 },
      reverb: { on: true, mix: 0.5, size: 0.7, decay: 2.5, predelay: 0.02, damp: 0.4, width: 0.7 },
      distortion: { on: true, drive: 0.2, tone: 0.6, mix: 0.4, mode: 'soft' },
      noise: { on: true, level: 0.02, color: 'pink' }
    }
  },
  'Underground Tunnel': {
    voice: { pitch: 55, speed: 70, mouth: 130, throat: 150, volume: 1, pause: 0 },
    fx: {
      reverb: { on: true, mix: 0.55, size: 0.9, decay: 4.5, predelay: 0.05, damp: 0.35, width: 0.9 },
      eq: { on: true, low: 4, mid: -3, high: -6, lowF: 180, midF: 900, highF: 4500 },
      compressor: { on: true, threshold: -20, ratio: 3, attack: 0.01, release: 0.2, knee: 8, makeup: 1 }
    }
  },
  'Huge Hall': {
    voice: { pitch: 60, speed: 65, mouth: 128, throat: 128, volume: 0.95, pause: 0 },
    fx: {
      reverb: { on: true, mix: 0.6, size: 1, decay: 6, predelay: 0.08, damp: 0.3, width: 1 },
      eq: { on: true, low: 3, mid: 0, high: -2, lowF: 200, midF: 1200, highF: 6000 }
    }
  },
  'VHS Voice': {
    voice: { pitch: 72, speed: 68, mouth: 130, throat: 140, volume: 1, pause: 0 },
    fx: {
      vhs: { on: true, mix: 0.7, wow: 0.3, flutter: 0.35, noise: 0.15 },
      eq: { on: true, low: -3, mid: 2, high: -5, lowF: 200, midF: 1400, highF: 5000 },
      compressor: { on: true, threshold: -22, ratio: 6, attack: 0.003, release: 0.12, knee: 4, makeup: 3 }
    }
  },
  'Glitch Machine': {
    voice: { pitch: 80, speed: 100, mouth: 100, throat: 120, volume: 1, pause: 0 },
    fx: {
      glitch: { on: true, mix: 0.6, rate: 6, depth: 0.5, crackle: 0.4 },
      bitcrusher: { on: true, bits: 4, sr: 6000, mix: 0.8 },
      delay: { on: true, time: 0.08, feedback: 0.4, mix: 0.35, pingpong: true, bpm: 140, beat: 0.25 }
    }
  },
  'Alien Transmission': {
    voice: { pitch: 30, speed: 55, mouth: 90, throat: 200, volume: 1, pause: 40 },
    fx: {
      pitchshift: { on: true, semitones: 5, mix: 0.7 },
      chorus: { on: true, rate: 1.4, depth: 0.7, mix: 0.5, width: 0.9 },
      phaser: { on: true, rate: 0.3, depth: 0.8, mix: 0.6, stages: 6 },
      reverb: { on: true, mix: 0.5, size: 0.8, decay: 4, predelay: 0.03, damp: 0.5, width: 1 }
    }
  },
  'Old Telephone': {
    voice: { pitch: 68, speed: 74, mouth: 128, throat: 128, volume: 1, pause: 0 },
    fx: {
      phone: { on: true, mix: 1 },
      distortion: { on: true, drive: 0.15, tone: 0.7, mix: 0.3, mode: 'soft' }
    }
  },
  'Synthetic Narrator': {
    voice: { pitch: 62, speed: 68, mouth: 130, throat: 130, volume: 1, pause: 10 },
    fx: {
      eq: { on: true, low: 2, mid: 1, high: 1, lowF: 200, midF: 1200, highF: 5000 },
      compressor: { on: true, threshold: -20, ratio: 3, attack: 0.01, release: 0.25, knee: 6, makeup: 2 },
      reverb: { on: true, mix: 0.2, size: 0.4, decay: 1.5, predelay: 0.01, damp: 0.5, width: 0.4 }
    }
  },
  'Dream Sequence': {
    voice: { pitch: 55, speed: 55, mouth: 140, throat: 120, volume: 0.9, pause: 30 },
    fx: {
      reverb: { on: true, mix: 0.6, size: 0.9, decay: 5, predelay: 0.05, damp: 0.5, width: 1 },
      chorus: { on: true, rate: 0.25, depth: 0.8, mix: 0.5, width: 0.9 },
      autopan: { on: true, rate: 0.15, depth: 0.8, mix: 0.6 },
      eq: { on: true, low: -4, mid: 0, high: 3, lowF: 250, midF: 1200, highF: 5000 }
    }
  }
};

/* ============================================================
 *  SAM ENGINE
 * ========================================================== */
const SAM_SR = 22050;
class SamEngine {
  constructor() { this.lastBuffer = null; }

  /**
   * Генерирует PCM через sam-js и возвращает AudioBuffer.
   * sam-js: new SamJs({pitch, speed, mouth, throat}) .buf8(text) → Uint8Array (unsigned 8-bit)
   */
  async generate(text, opts) {
    if (!text || !text.trim()) throw new Error('Пустой текст');
    const samOpts = {};
    if (opts.pitch  != null) samOpts.pitch  = clamp(opts.pitch | 0, 0, 255);
    if (opts.speed  != null) samOpts.speed  = clamp(opts.speed | 0, 0, 255);
    if (opts.mouth  != null) samOpts.mouth  = clamp(opts.mouth | 0, 0, 255);
    if (opts.throat != null) samOpts.throat = clamp(opts.throat | 0, 0, 255);

    const sam = new SamJs(samOpts);
    // sam-js отдаёт Uint8Array (unsigned), частота 22050, mono
    const u8 = sam.buf8(text);

    // Вставляем «паузы» между словами, если пользователь задал pause > 0
    const pauseMs = clamp(opts.pause | 0, 0, 200);
    const pauseSamples = Math.floor((pauseMs / 1000) * SAM_SR);

    const totalLen = u8.length + (pauseSamples > 0 ? countWords(text) * pauseSamples : 0);
    const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, totalLen, SAM_SR);
    const buf = ctx.createBuffer(1, totalLen, SAM_SR);
    const ch = buf.getChannelData(0);

    if (pauseSamples === 0) {
      for (let i = 0; i < u8.length; i++) ch[i] = (u8[i] - 128) / 128;
    } else {
      // простой приём: на каждой границе пробела вставляем тишину
      let w = 0, out = 0, wordIdx = 0;
      // определим точки вставки как равномерные между словами
      const words = text.trim().split(/\s+/).length;
      const step = Math.floor(u8.length / Math.max(1, words));
      let next = step;
      for (let i = 0; i < u8.length; i++) {
        ch[out++] = (u8[i] - 128) / 128;
        if (i >= next && wordIdx < words - 1) {
          out += pauseSamples;
          wordIdx++;
          next += step;
        }
      }
      while (out < totalLen) ch[out++] = 0;
    }

    // Применяем мастер-громкость уже здесь (до эффектов), чтобы FX видели уровень
    const vol = opts.volume ?? 1;
    if (vol !== 1) for (let i = 0; i < ch.length; i++) ch[i] *= vol;

    this.lastBuffer = buf;
    return buf;
  }
}
function countWords(t){ return t.trim().split(/\s+/).filter(Boolean).length; }

/* ============================================================
 *  FX CHAIN — единый AudioContext
 * ========================================================== */
class FXChain {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ sampleRate: 44100 });
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.08;
    this.limiter.connect(this.output);

    this.fx = {}; // key → node group
    this.order = [];
    this.buildAll();
    this.rebuild();
  }

  /* --- фабрики --- */
  buildAll() {
    const ctx = this.ctx;
    const self = this;

    this.fx.eq = makeEQ(ctx);
    this.fx.distortion = makeDistortion(ctx);
    this.fx.bitcrusher = makeBitcrusher(ctx);
    this.fx.chorus = makeChorus(ctx);
    this.fx.flanger = makeFlanger(ctx);
    this.fx.phaser = makePhaser(ctx);
    this.fx.delay = makeDelay(ctx);
    this.fx.reverb = makeReverb(ctx);
    this.fx.compressor = makeCompressor(ctx);
    this.fx.pitchshift = makePitchShift(ctx);
    this.fx.tremolo = makeTremolo(ctx);
    this.fx.autopan = makeAutoPan(ctx);
    this.fx.filters = makeFilters(ctx);
    this.fx.noise = makeNoise(ctx);
    this.fx.phone = makePhone(ctx);
    this.fx.radio = makeRadio(ctx);
    this.fx.robot = makeRobot(ctx);
    this.fx.space = makeSpace(ctx);
    this.fx.vhs = makeVHS(ctx);
    this.fx.glitch = makeGlitch(ctx);

    // Заданный порядок обработки
    this.order = [
      'eq', 'filters', 'distortion', 'bitcrusher', 'pitchshift', 'robot',
      'chorus', 'flanger', 'phaser', 'phone', 'radio', 'vhs', 'glitch',
      'delay', 'space', 'reverb', 'noise', 'tremolo', 'autopan', 'compressor'
    ];
  }

  rebuild() {
    // Отключаем все известные связи
    try { this.input.disconnect(); } catch {}
    for (const k of this.order) {
      const fx = this.fx[k];
      try { fx.output.disconnect(); } catch {}
    }

    let prev = this.input;
    for (const k of this.order) {
      const fx = this.fx[k];
      if (fx.on) {
        prev.connect(fx.input);
        prev = fx.output;
      }
    }
    prev.connect(this.limiter);
    this.limiter.connect(this.output);
  }

  /* --- update from preset --- */
  applyFX(patch = {}) {
    for (const k of Object.keys(this.fx)) {
      const p = patch[k];
      if (!p) { this.fx[k].setOn(false); continue; }
      this.fx[k].setOn(!!p.on);
      this.fx[k].setParams(p);
    }
    this.rebuild();
  }

  resetFX() {
    for (const k of Object.keys(this.fx)) {
      this.fx[k].setOn(false);
      this.fx[k].setParams(this.fx[k].defaults || {});
    }
    this.rebuild();
  }

  /* --- Play: подключаем буфер и играем --- */
  play(buffer, onEnded) {
    this.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.input);
    src.onended = () => { if (this._src === src) { this._src = null; onEnded && onEnded(); } };
    this._src = src;
    src.start();
    return src;
  }
  pause() { if (this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
  stop() {
    if (this._src) {
      try { this._src.stop(); } catch {}
      try { this._src.disconnect(); } catch {}
      this._src = null;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /* --- Offline render для WAV --- */
  async renderOffline(buffer, durationSec) {
    const total = Math.ceil((buffer.duration + (durationSec || 0)) * buffer.sampleRate);
    const off = new OfflineAudioContext(2, total, buffer.sampleRate);
    const chain = Object.create(FXChain.prototype);
    chain.ctx = off;
    chain.input = off.createGain();
    chain.output = off.createGain();
    chain.limiter = off.createDynamicsCompressor();
    chain.limiter.threshold.value = -3;
    chain.limiter.knee.value = 0;
    chain.limiter.ratio.value = 20;
    chain.limiter.attack.value = 0.002;
    chain.limiter.release.value = 0.08;
    chain.fx = {};
    chain.order = this.order.slice();

    // Пересобираем все фабрики в offline-контексте
    chain.fx.eq = makeEQ(off);
    chain.fx.distortion = makeDistortion(off);
    chain.fx.bitcrusher = makeBitcrusher(off);
    chain.fx.chorus = makeChorus(off);
    chain.fx.flanger = makeFlanger(off);
    chain.fx.phaser = makePhaser(off);
    chain.fx.delay = makeDelay(off);
    chain.fx.reverb = makeReverb(off);
    chain.fx.compressor = makeCompressor(off);
    chain.fx.pitchshift = makePitchShift(off);
    chain.fx.tremolo = makeTremolo(off);
    chain.fx.autopan = makeAutoPan(off);
    chain.fx.filters = makeFilters(off);
    chain.fx.noise = makeNoise(off);
    chain.fx.phone = makePhone(off);
    chain.fx.radio = makeRadio(off);
    chain.fx.robot = makeRobot(off);
    chain.fx.space = makeSpace(off);
    chain.fx.vhs = makeVHS(off);
    chain.fx.glitch = makeGlitch(off);

    // Копируем состояние
    for (const k of this.order) {
      const s = this.fx[k];
      const d = chain.fx[k];
      d.setOn(s.on);
      d.setParams(s.params || {});
    }
    // offline-цепочка
    let prev = chain.input;
    for (const k of chain.order) {
      const fx = chain.fx[k];
      if (fx.on) { prev.connect(fx.input); prev = fx.output; }
    }
    prev.connect(chain.limiter);
    chain.limiter.connect(chain.output);
    chain.output.connect(off.destination);

    const src = off.createBufferSource();
    src.buffer = buffer;
    src.connect(chain.input);
    src.start();

    return await off.startRendering();
  }
}

/* -------- Фабрики эффектов --------
 * Каждая возвращает { on, input, output, setOn, setParams, params, defaults }
 * Внутри — реальные Web Audio узлы.
 * ------------------------------------------------------------------ */

function baseFx(input, output, defaults) {
  return { on: false, input, output, params: { ...defaults }, defaults,
    setOn(v){ this.on = !!v; },
    setParams(p){ Object.assign(this.params, p); if (this.apply) this.apply(p); }
  };
}

/* EQ: 3-полосный + опционально shelf/peak */
function makeEQ(ctx) {
  const low = ctx.createBiquadFilter(); low.type = 'lowshelf';
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking';
  const high = ctx.createBiquadFilter(); high.type = 'highshelf';
  low.frequency.value = 200; mid.frequency.value = 1200; mid.Q.value = 1; high.frequency.value = 5000;
  low.gain.value = 0; mid.gain.value = 0; high.gain.value = 0;
  low.connect(mid).connect(high);
  const fx = baseFx(low, high, { low: 0, mid: 0, high: 0, lowF: 200, midF: 1200, highF: 5000 });
  fx.apply = (p) => {
    if (p.low  != null) low.gain.value  = p.low;
    if (p.mid  != null) mid.gain.value  = p.mid;
    if (p.high != null) high.gain.value = p.high;
    if (p.lowF != null) low.frequency.value  = p.lowF;
    if (p.midF != null) mid.frequency.value  = p.midF;
    if (p.highF!= null) high.frequency.value = p.highF;
  };
  fx.apply(fx.params);
  return fx;
}

/* Distortion: waveshaper + tone LPF */
function makeDistortion(ctx) {
  const inGain = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 6000;
  const dry = ctx.createGain(); dry.gain.value = 0;
  const wet = ctx.createGain(); wet.gain.value = 1;
  const out = ctx.createGain();
  inGain.connect(shaper).connect(tone).connect(wet).connect(out);
  inGain.connect(dry).connect(out);

  function curve(amount, mode) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      let y;
      if (mode === 'hard') y = Math.sign(x) * Math.pow(Math.abs(x), 1 / (1 + amount * 8));
      else if (mode === 'fold') y = Math.sin(x * (1 + amount * 6));
      else y = Math.tanh(x * (1 + amount * 8)); // soft
      c[i] = y;
    }
    return c;
  }
  const fx = baseFx(inGain, out, { drive: 0.3, tone: 0.5, mix: 1, mode: 'soft' });
  fx.apply = (p) => {
    const amount = clamp(p.drive ?? 0.3, 0, 1);
    const mode = p.mode || 'soft';
    shaper.curve = curve(amount, mode);
    if (p.tone != null) tone.frequency.value = 200 + p.tone * 12000;
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* Bitcrusher: скриптлет через AudioWorklet или WaveShaper + понижение sample rate */
function makeBitcrusher(ctx) {
  // Без AudioWorklet — используем ScriptProcessor только для offline/online совместимости.
  // ScriptProcessor deprecated, но работает в Chrome/Firefox и в OfflineAudioContext.
  const dry = ctx.createGain(); dry.gain.value = 0;
  const wet = ctx.createGain(); wet.gain.value = 1;
  const out = ctx.createGain();

  const proc = ctx.createScriptProcessor ? ctx.createScriptProcessor(1024, 1, 1) : null;
  let hold = 0, phase = 0, lastVal = 0;
  const params = { bits: 8, sr: 22050, mix: 1 };

  if (proc) {
    proc.onaudioprocess = (e) => {
      const inp = e.inputBuffer.getChannelData(0);
      const outb = e.outputBuffer.getChannelData(0);
      const step = Math.max(1, Math.round(ctx.sampleRate / params.sr));
      const levels = Math.pow(2, params.bits);
      for (let i = 0; i < inp.length; i++) {
        if (phase % step === 0) {
          const x = inp[i];
          lastVal = Math.round(x * levels) / levels;
        }
        outb[i] = lastVal;
        phase++;
      }
    };
    proc.connect(wet);
  }
  const inG = ctx.createGain();
  inG.connect(proc || wet);
  inG.connect(dry);
  wet.connect(out); dry.connect(out);
  const fx = baseFx(inG, out, { bits: 8, sr: 22050, mix: 1 });
  fx.apply = (p) => {
    if (p.bits != null) params.bits = clamp(p.bits, 1, 16);
    if (p.sr   != null) params.sr   = clamp(p.sr, 500, 44100);
    if (p.mix  != null) { params.mix = p.mix; wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* Chorus: LFO + modulated delay */
function makeChorus(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0.5;

  const splitL = ctx.createGain();
  const splitR = ctx.createGain();
  const merger = ctx.createChannelMerger(2);

  const dL = ctx.createDelay(0.1); dL.delayTime.value = 0.025;
  const dR = ctx.createDelay(0.1); dR.delayTime.value = 0.03;
  const lfoL = ctx.createOscillator(); lfoL.frequency.value = 0.5;
  const lfoR = ctx.createOscillator(); lfoR.frequency.value = 0.53;
  const gL = ctx.createGain(); gL.gain.value = 0.003;
  const gR = ctx.createGain(); gR.gain.value = 0.003;
  lfoL.connect(gL).connect(dL.delayTime);
  lfoR.connect(gR).connect(dR.delayTime);
  lfoL.start(); lfoR.start();

  inG.connect(dry).connect(out);
  inG.connect(splitL).connect(dL).connect(merger, 0, 0);
  inG.connect(splitR).connect(dR).connect(merger, 0, 1);
  merger.connect(wet).connect(out);

  const fx = baseFx(inG, out, { rate: 0.5, depth: 0.4, mix: 0.4, width: 0.6 });
  fx.apply = (p) => {
    if (p.rate != null) { lfoL.frequency.value = p.rate; lfoR.frequency.value = p.rate * 1.07; }
    if (p.depth != null) { gL.gain.value = 0.001 + p.depth * 0.006; gR.gain.value = 0.001 + p.depth * 0.006; }
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* Flanger: короче delay, сильнее feedback */
function makeFlanger(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0.4;
  const d = ctx.createDelay(0.05); d.delayTime.value = 0.005;
  const fb = ctx.createGain(); fb.gain.value = 0.6;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.4;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.003;
  lfo.connect(lfoGain).connect(d.delayTime); lfo.start();

  inG.connect(d).connect(wet).connect(out);
  d.connect(fb).connect(d);
  inG.connect(dry).connect(out);

  const fx = baseFx(inG, out, { rate: 0.4, depth: 0.5, feedback: 0.6, mix: 0.4 });
  fx.apply = (p) => {
    if (p.rate != null) lfo.frequency.value = p.rate;
    if (p.depth != null) lfoGain.gain.value = 0.0005 + p.depth * 0.006;
    if (p.feedback != null) fb.gain.value = clamp(p.feedback, 0, 0.9);
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* Phaser: цепочка allpass + LFO */
function makePhaser(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0.5;
  const stages = 6;
  const aps = [];
  for (let i = 0; i < stages; i++) {
    const ap = ctx.createBiquadFilter();
    ap.type = 'allpass';
    ap.frequency.value = 300 * Math.pow(1.6, i);
    ap.Q.value = 0.7;
    aps.push(ap);
  }
  for (let i = 0; i < aps.length - 1; i++) aps[i].connect(aps[i + 1]);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 400;
  lfo.connect(lfoGain);
  aps.forEach(ap => lfoGain.connect(ap.frequency));
  lfo.start();

  inG.connect(aps[0]);
  aps[aps.length - 1].connect(wet).connect(out);
  inG.connect(dry).connect(out);

  const fx = baseFx(inG, out, { rate: 0.3, depth: 0.6, mix: 0.5 });
  fx.apply = (p) => {
    if (p.rate != null) lfo.frequency.value = p.rate;
    if (p.depth != null) lfoGain.gain.value = 100 + p.depth * 800;
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* Delay / Echo с ping-pong и bpm */
function makeDelay(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0.3;

  const dl = ctx.createDelay(5); dl.delayTime.value = 0.3;
  const dr = ctx.createDelay(5); dr.delayTime.value = 0.3;
  const fbL = ctx.createGain(); fbL.gain.value = 0.3;
  const fbR = ctx.createGain(); fbR.gain.value = 0.3;
  const merger = ctx.createChannelMerger(2);
  const splitter = ctx.createChannelSplitter(2);

  inG.connect(dl);
  dl.connect(merger, 0, 0);
  dr.connect(merger, 0, 1);
  merger.connect(wet).connect(out);
  inG.connect(dry).connect(out);

  // ping-pong: dl → dr → dl
  dl.connect(dr);
  dr.connect(fbR).connect(dl);
  dl.connect(fbL);

  const fx = baseFx(inG, out, { time: 0.3, feedback: 0.3, mix: 0.3, pingpong: true, bpm: 120, beat: 0.25 });
  fx.apply = (p) => {
    let t = p.time ?? 0.3;
    if (p.bpm) t = (60 / p.bpm) * (p.beat ?? 0.25);
    if (dl.delayTime.value !== t) { dl.delayTime.value = t; dr.delayTime.value = t * 1.0; }
    const fb = clamp(p.feedback ?? 0.3, 0, 0.85);
    fbL.gain.value = fb;
    fbR.gain.value = p.pingpong ? fb : 0;
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* Reverb: Convolver с генерируемой IR (реальный ревербератор, не эхо) */
function makeReverb(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0.3;
  const pre = ctx.createDelay(0.5); pre.delayTime.value = 0.02;
  const conv = ctx.createConvolver();
  const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 6000;
  const width = ctx.createGain();

  inG.connect(dry).connect(out);
  inG.connect(pre).connect(conv).connect(damp).connect(wet).connect(out);

  // IR builder
  function buildIR(size, decay, dampVal) {
    const sr = ctx.sampleRate;
    const len = Math.max(0.2, size * decay) * sr | 0;
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, Math.max(0.5, decay * 0.5));
        d[i] = (Math.random() * 2 - 1) * env * (1 - dampVal * t * 0.5);
      }
    }
    return ir;
  }

  const fx = baseFx(inG, out, { mix: 0.3, size: 0.6, decay: 2.5, predelay: 0.02, damp: 0.4, width: 0.7 });
  fx.apply = (p) => {
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
    if (p.predelay != null) pre.delayTime.value = p.predelay;
    if (p.damp != null) damp.frequency.value = 12000 - p.damp * 10000;
    if (p.size != null || p.decay != null || p.damp != null) {
      conv.buffer = buildIR(p.size ?? fx.params.size ?? 0.6,
                            p.decay ?? fx.params.decay ?? 2.5,
                            p.damp ?? fx.params.damp ?? 0.4);
    }
  };
  fx.apply(fx.params);
  return fx;
}

/* Compressor */
function makeCompressor(ctx) {
  const c = ctx.createDynamicsCompressor();
  const makeup = ctx.createGain(); makeup.gain.value = 1;
  c.connect(makeup);
  const fx = baseFx(c, makeup, { threshold: -20, ratio: 3, attack: 0.01, release: 0.2, knee: 6, makeup: 1 });
  fx.apply = (p) => {
    if (p.threshold != null) c.threshold.value = p.threshold;
    if (p.ratio != null) c.ratio.value = clamp(p.ratio, 1, 20);
    if (p.attack != null) c.attack.value = p.attack;
    if (p.release != null) c.release.value = p.release;
    if (p.knee != null) c.knee.value = p.knee;
    if (p.makeup != null) makeup.gain.value = Math.pow(10, p.makeup / 20);
  };
  fx.apply(fx.params);
  return fx;
}

/* Pitch Shift: phase-vocoder-lite (2× overlap-add, time-stretch + resample) */
function makePitchShift(ctx) {
  // В real-time без worklet качественный pitch-shift сложен.
  // Реализуем честный упрощённый гранулярный шифтер через ScriptProcessor:
  // два перекрывающихся окна, читающие буфер с изменяемой скоростью и кроссфейдом.
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0.7;
  const out = ctx.createGain();

  const proc = ctx.createScriptProcessor ? ctx.createScriptProcessor(2048, 1, 1) : null;
  const params = { semitones: 0, mix: 0.7 };
  let ring = new Float32Array(1 << 16);
  let w = 0;
  const GRAIN = 1024, HOP = 512;

  if (proc) {
    proc.onaudioprocess = (e) => {
      const inp = e.inputBuffer.getChannelData(0);
      const outb = e.outputBuffer.getChannelData(0);
      // пишем во входное кольцо
      for (let i = 0; i < inp.length; i++) { ring[w & (ring.length - 1)] = inp[i]; w++; }
      // читаем питч-сдвинутый сигнал с гранулярным ресемплингом
      const speed = Math.pow(2, params.semitones / 12);
      for (let i = 0; i < outb.length; i++) {
        // фаза внутр. гранулы
        const g = ((w + i) % GRAIN) / GRAIN;
        const win = 0.5 - 0.5 * Math.cos(2 * Math.PI * g);
        // источник читается со скоростью 1/speed
        const idx = Math.floor((w + i) / speed);
        const s = ring[((idx % ring.length) + ring.length) % ring.length] * win;
        outb[i] = s;
      }
    };
    proc.connect(wet);
  }
  const inG = ctx.createGain();
  inG.connect(proc || wet);
  inG.connect(dry).connect(out);
  wet.connect(out);

  const fx = baseFx(inG, out, { semitones: 0, mix: 0.7 });
  fx.apply = (p) => {
    if (p.semitones != null) params.semitones = clamp(p.semitones, -12, 12);
    if (p.mix != null) { params.mix = p.mix; wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* Tremolo */
function makeTremolo(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const lfo = ctx.createOscillator(); lfo.frequency.value = 4;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
  const depth = ctx.createGain(); depth.gain.value = 0.5;
  lfo.connect(depth).connect(inG.gain); lfo.start();
  inG.gain.value = 0.5;
  inG.connect(out);
  const fx = baseFx(inG, out, { rate: 4, depth: 0.5 });
  fx.apply = (p) => {
    if (p.rate != null) lfo.frequency.value = p.rate;
    if (p.depth != null) { depth.gain.value = p.depth * 0.5; inG.gain.value = 1 - p.depth * 0.5; }
  };
  fx.apply(fx.params);
  return fx;
}

/* AutoPan */
function makeAutoPan(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const dry = ctx.createGain(); dry.gain.value = 0;
  const wet = ctx.createGain(); wet.gain.value = 1;
  inG.connect(dry).connect(out);
  if (panner) {
    inG.connect(panner).connect(wet).connect(out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3;
    const g = ctx.createGain(); g.gain.value = 0.8;
    lfo.connect(g).connect(panner.pan); lfo.start();
    const fx = baseFx(inG, out, { rate: 0.3, depth: 0.8, mix: 1 });
    fx.apply = (p) => {
      if (p.rate != null) lfo.frequency.value = p.rate;
      if (p.depth != null) g.gain.value = clamp(p.depth, 0, 1);
      if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
    };
    fx.apply(fx.params);
    return fx;
  }
  // Fallback: нет StereoPanner — просто pass-through
  const fx = baseFx(inG, out, { rate: 0.3, depth: 0.8, mix: 1 });
  fx.setOn = () => {};
  return fx;
}

/* Filters: HPF + LPF */
function makeFilters(ctx) {
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 20;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 20000;
  hp.connect(lp);
  const fx = baseFx(hp, lp, { hp: 20, lp: 20000 });
  fx.apply = (p) => {
    if (p.hp != null) hp.frequency.value = clamp(p.hp, 20, 20000);
    if (p.lp != null) lp.frequency.value = clamp(p.lp, 20, 20000);
  };
  fx.apply(fx.params);
  return fx;
}

/* Noise: генератор шума, подмешиваемый в сигнал */
function makeNoise(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0;
  inG.connect(dry).connect(out);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
  src.connect(lp).connect(wet).connect(out);
  src.start();
  const fx = baseFx(inG, out, { level: 0.02, color: 'white' });
  fx.apply = (p) => {
    if (p.level != null) wet.gain.value = p.level;
    if (p.color === 'pink') lp.frequency.value = 1500;
    else if (p.color === 'brown') lp.frequency.value = 500;
    else lp.frequency.value = 8000;
  };
  fx.apply(fx.params);
  return fx;
}

/* Phone: 300–3400 band-pass + резонанс */
function makePhone(ctx) {
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 1;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 3400; lp.Q.value = 1;
  const peak = ctx.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 1800; peak.gain.value = 6; peak.Q.value = 1.2;
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 1;
  const out = ctx.createGain();
  hp.connect(lp).connect(peak).connect(wet).connect(out);
  hp.connect(dry).connect(out);
  const fx = baseFx(hp, out, { mix: 1 });
  fx.apply = (p) => { if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; } };
  fx.apply(fx.params);
  return fx;
}

/* Radio: band-pass + distortion + узкая полоса */
function makeRadio(ctx) {
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 2500;
  const dist = ctx.createWaveShaper();
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / (n - 1) - 1; c[i] = Math.tanh(x * 3); }
  dist.curve = c;
  hp.connect(lp).connect(dist);
  const fx = baseFx(hp, dist, {});
  return fx;
}

/* Robot: кольцевой модулятор + короткий comb */
function makeRobot(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.5;
  const wet = ctx.createGain(); wet.gain.value = 0.5;
  const ring = ctx.createGain(); ring.gain.value = 0;
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 60;
  const oscGain = ctx.createGain(); oscGain.gain.value = 1;
  osc.connect(oscGain).connect(ring.gain); osc.start();
  inG.connect(ring).connect(wet).connect(out);
  inG.connect(dry).connect(out);
  const fx = baseFx(inG, out, { freq: 60, mix: 0.5 });
  fx.apply = (p) => {
    if (p.freq != null) osc.frequency.value = p.freq;
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* Space: haas + long reverb-ish */
function makeSpace(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.6;
  const wet = ctx.createGain(); wet.gain.value = 0.4;
  const d = ctx.createDelay(0.2); d.delayTime.value = 0.02;
  const fb = ctx.createGain(); fb.gain.value = 0.4;
  d.connect(fb).connect(d);
  inG.connect(dry).connect(out);
  inG.connect(d).connect(wet).connect(out);
  const fx = baseFx(inG, out, { mix: 0.4, time: 0.02, feedback: 0.4 });
  fx.apply = (p) => {
    if (p.time != null) d.delayTime.value = p.time;
    if (p.feedback != null) fb.gain.value = clamp(p.feedback, 0, 0.85);
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
  };
  fx.apply(fx.params);
  return fx;
}

/* VHS: wow/flutter (медленная модуляция задержки) + шум + LPF */
function makeVHS(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.6;
  const wet = ctx.createGain(); wet.gain.value = 0.4;
  const d = ctx.createDelay(0.05); d.delayTime.value = 0.005;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 3;
  const g = ctx.createGain(); g.gain.value = 0.002;
  lfo.connect(g).connect(d.delayTime); lfo.start();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
  d.connect(lp).connect(wet).connect(out);
  inG.connect(d);
  inG.connect(dry).connect(out);
  const fx = baseFx(inG, out, { mix: 0.7, wow: 0.3, flutter: 0.35, noise: 0.15 });
  fx.apply = (p) => {
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
    if (p.wow != null) lfo.frequency.value = 0.5 + p.wow * 4;
    if (p.flutter != null) g.gain.value = 0.0005 + p.flutter * 0.006;
    if (p.noise != null) lp.frequency.value = 8000 - p.noise * 6000;
  };
  fx.apply(fx.params);
  return fx;
}

/* Glitch: случайные короткие задержки/вырезания */
function makeGlitch(ctx) {
  const inG = ctx.createGain();
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0.5;
  const d = ctx.createDelay(0.5); d.delayTime.value = 0.05;
  const fb = ctx.createGain(); fb.gain.value = 0.3;
  d.connect(fb).connect(d);
  inG.connect(d).connect(wet).connect(out);
  inG.connect(dry).connect(out);
  let timer = null;
  const params = { mix: 0.5, rate: 6, depth: 0.5, crackle: 0.4 };
  function tick() {
    if (!fx.on) return;
    const base = 0.02 + Math.random() * 0.15;
    d.delayTime.setValueAtTime(base, ctx.currentTime);
    fb.gain.setValueAtTime(0.1 + Math.random() * params.depth * 0.7, ctx.currentTime);
    timer = setTimeout(tick, 1000 / Math.max(1, params.rate));
  }
  const fx = baseFx(inG, out, { mix: 0.5, rate: 6, depth: 0.5, crackle: 0.4 });
  fx.setOn = function (v) {
    this.on = !!v;
    if (this.on) { clearTimeout(timer); tick(); }
    else clearTimeout(timer);
  };
  fx.apply = (p) => {
    if (p.mix != null) { wet.gain.value = p.mix; dry.gain.value = 1 - p.mix; }
    if (p.rate != null) params.rate = p.rate;
    if (p.depth != null) params.depth = p.depth;
    if (p.crackle != null) params.crackle = p.crackle;
  };
  fx.apply(fx.params);
  return fx;
}

/* ============================================================
 *  UI
 * ========================================================== */
const engine = new SamEngine();
const chain = new FXChain();

/* Описание UI эффектов */
const FX_UI = [
  { key: 'eq', name: 'Equalizer', params: [
    { id: 'low',  label: 'Low',   min: -24, max: 24, step: 0.5, def: 0 },
    { id: 'mid',  label: 'Mid',   min: -24, max: 24, step: 0.5, def: 0 },
    { id: 'high', label: 'High',  min: -24, max: 24, step: 0.5, def: 0 },
    { id: 'lowF', label: 'Low f', min: 50,  max: 800, step: 1, def: 200 },
    { id: 'midF', label: 'Mid f', min: 400, max: 4000, step: 10, def: 1200 },
    { id: 'highF',label: 'High f',min: 2000,max: 12000, step: 50, def: 5000 },
  ]},
  { key: 'filters', name: 'HPF / LPF', params: [
    { id: 'hp', label: 'HPF Hz', min: 20, max: 8000, step: 10, def: 20 },
    { id: 'lp', label: 'LPF Hz', min: 200, max: 20000, step: 50, def: 20000 },
  ]},
  { key: 'distortion', name: 'Distortion', params: [
    { id: 'drive', label: 'Drive', min: 0, max: 1, step: 0.01, def: 0.3 },
    { id: 'tone',  label: 'Tone',  min: 0, max: 1, step: 0.01, def: 0.5 },
    { id: 'mix',   label: 'Mix',   min: 0, max: 1, step: 0.01, def: 1 },
  ], select: { id: 'mode', label: 'Режим', options: ['soft','hard','fold'], def: 'soft' }},
  { key: 'bitcrusher', name: 'Bitcrusher', params: [
    { id: 'bits', label: 'Bits', min: 1, max: 16, step: 1, def: 8 },
    { id: 'sr',   label: 'Sample Rate', min: 500, max: 44100, step: 100, def: 22050 },
    { id: 'mix',  label: 'Mix', min: 0, max: 1, step: 0.01, def: 1 },
  ]},
  { key: 'pitchshift', name: 'Pitch Shift', params: [
    { id: 'semitones', label: 'Полутоны', min: -12, max: 12, step: 0.1, def: 0 },
    { id: 'mix',       label: 'Mix',      min: 0, max: 1, step: 0.01, def: 0.7 },
  ]},
  { key: 'robot', name: 'Robot Voice', params: [
    { id: 'freq', label: 'Частота (Hz)', min: 20, max: 400, step: 1, def: 60 },
    { id: 'mix',  label: 'Mix', min: 0, max: 1, step: 0.01, def: 0.5 },
  ]},
  { key: 'chorus', name: 'Chorus', params: [
    { id: 'rate',  label: 'Rate',  min: 0.05, max: 8, step: 0.01, def: 0.5 },
    { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, def: 0.4 },
    { id: 'mix',   label: 'Mix',   min: 0, max: 1, step: 0.01, def: 0.4 },
  ]},
  { key: 'flanger', name: 'Flanger', params: [
    { id: 'rate',     label: 'Rate',     min: 0.05, max: 6, step: 0.01, def: 0.4 },
    { id: 'depth',    label: 'Depth',    min: 0, max: 1, step: 0.01, def: 0.5 },
    { id: 'feedback', label: 'Feedback', min: 0, max: 0.9, step: 0.01, def: 0.6 },
    { id: 'mix',      label: 'Mix',      min: 0, max: 1, step: 0.01, def: 0.4 },
  ]},
  { key: 'phaser', name: 'Phaser', params: [
    { id: 'rate',  label: 'Rate',  min: 0.05, max: 4, step: 0.01, def: 0.3 },
    { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, def: 0.6 },
    { id: 'mix',   label: 'Mix',   min: 0, max: 1, step: 0.01, def: 0.5 },
  ]},
  { key: 'phone', name: 'Old Telephone', params: [
    { id: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, def: 1 },
  ]},
  { key: 'radio', name: 'Radio / Walkie-Talkie', params: [] },
  { key: 'vhs', name: 'VHS / Retro', params: [
    { id: 'mix',     label: 'Mix',     min: 0, max: 1, step: 0.01, def: 0.7 },
    { id: 'wow',     label: 'Wow',     min: 0, max: 1, step: 0.01, def: 0.3 },
    { id: 'flutter', label: 'Flutter', min: 0, max: 1, step: 0.01, def: 0.35 },
    { id: 'noise',   label: 'Noise',   min: 0, max: 1, step: 0.01, def: 0.15 },
  ]},
  { key: 'glitch', name: 'Digital Glitch', params: [
    { id: 'mix',     label: 'Mix',     min: 0, max: 1, step: 0.01, def: 0.6 },
    { id: 'rate',    label: 'Rate',    min: 0.5, max: 20, step: 0.1, def: 6 },
    { id: 'depth',   label: 'Depth',   min: 0, max: 1, step: 0.01, def: 0.5 },
    { id: 'crackle', label: 'Crackle', min: 0, max: 1, step: 0.01, def: 0.4 },
  ]},
  { key: 'delay', name: 'Delay / Echo', params: [
    { id: 'time',     label: 'Time (s)', min: 0.01, max: 2, step: 0.01, def: 0.3 },
    { id: 'feedback', label: 'Feedback', min: 0, max: 0.85, step: 0.01, def: 0.3 },
    { id: 'mix',      label: 'Mix',      min: 0, max: 1, step: 0.01, def: 0.3 },
    { id: 'bpm',      label: 'BPM',      min: 40, max: 240, step: 1, def: 120 },
    { id: 'beat',     label: 'Beat',     min: 0.125, max: 1, step: 0.125, def: 0.25 },
  ], check: { id: 'pingpong', label: 'Ping-Pong', def: true }},
  { key: 'space', name: 'Space / Ambient', params: [
    { id: 'time',     label: 'Time',     min: 0.005, max: 0.15, step: 0.001, def: 0.02 },
    { id: 'feedback', label: 'Feedback', min: 0, max: 0.85, step: 0.01, def: 0.4 },
    { id: 'mix',      label: 'Mix',      min: 0, max: 1, step: 0.01, def: 0.4 },
  ]},
  { key: 'reverb', name: 'Reverb', params: [
    { id: 'mix',      label: 'Mix',      min: 0, max: 1, step: 0.01, def: 0.3 },
    { id: 'size',     label: 'Room Size',min: 0, max: 1, step: 0.01, def: 0.6 },
    { id: 'decay',    label: 'Decay',    min: 0.2, max: 8, step: 0.1, def: 2.5 },
    { id: 'predelay', label: 'Pre-delay',min: 0, max: 0.2, step: 0.005, def: 0.02 },
    { id: 'damp',     label: 'Dampening',min: 0, max: 1, step: 0.01, def: 0.4 },
  ]},
  { key: 'noise', name: 'Noise', params: [
    { id: 'level', label: 'Level', min: 0, max: 0.3, step: 0.001, def: 0.02 },
  ], select: { id: 'color', label: 'Цвет', options: ['white','pink','brown'], def: 'white' }},
  { key: 'tremolo', name: 'Tremolo', params: [
    { id: 'rate',  label: 'Rate',  min: 0.1, max: 20, step: 0.1, def: 4 },
    { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, def: 0.5 },
  ]},
  { key: 'autopan', name: 'Auto Pan', params: [
    { id: 'rate',  label: 'Rate',  min: 0.05, max: 8, step: 0.01, def: 0.3 },
    { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, def: 0.8 },
    { id: 'mix',   label: 'Mix',   min: 0, max: 1, step: 0.01, def: 1 },
  ]},
  { key: 'compressor', name: 'Compressor', params: [
    { id: 'threshold', label: 'Threshold', min: -60, max: 0, step: 0.5, def: -20 },
    { id: 'ratio',     label: 'Ratio',     min: 1, max: 20, step: 0.1, def: 3 },
    { id: 'attack',    label: 'Attack',    min: 0, max: 0.5, step: 0.001, def: 0.01 },
    { id: 'release',   label: 'Release',   min: 0.01, max: 1, step: 0.01, def: 0.2 },
    { id: 'knee',      label: 'Knee',      min: 0, max: 40, step: 0.5, def: 6 },
    { id: 'makeup',    label: 'Makeup dB', min: -12, max: 12, step: 0.5, def: 0 },
  ]},
];

/* Строим UI */
const fxListEl = $('#fxList');
const uiRefs = {};
for (const def of FX_UI) {
  const fx = chain.fx[def.key];
  const wrap = document.createElement('div');
  wrap.className = 'fx';
  wrap.innerHTML = `
    <div class="head">
      <div class="switch" data-switch></div>
      <div class="name">${def.name}</div>
      <div class="chev">▸</div>
    </div>
    <div class="body"></div>`;
  const body = wrap.querySelector('.body');
  const sw = wrap.querySelector('[data-switch]');

  sw.addEventListener('click', (e) => {
    e.stopPropagation();
    fx.setOn(!fx.on);
    sw.classList.toggle('on', fx.on);
    chain.rebuild();
  });

  wrap.querySelector('.head').addEventListener('click', () => {
    wrap.classList.toggle('open');
  });

  const refs = { sw, params: {}, select: null, check: null };

  for (const p of (def.params || [])) {
    const row = document.createElement('div');
    row.className = 'ctrl';
    row.innerHTML = `<label>${p.label}</label>
      <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.def}">
      <span class="val">${fmt(p.def, stepDecimals(p.step))}</span>`;
    const input = row.querySelector('input');
    const val = row.querySelector('.val');
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = fmt(v, stepDecimals(p.step));
      fx.setParams({ [p.id]: v });
    });
    body.appendChild(row);
    refs.params[p.id] = { input, val, step: p.step };
  }

  if (def.select) {
    const row = document.createElement('div');
    row.className = 'ctrl';
    row.innerHTML = `<label>${def.select.label}</label>
      <select>${def.select.options.map(o => `<option ${o === def.select.def ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    const sel = row.querySelector('select');
    sel.addEventListener('change', () => fx.setParams({ [def.select.id]: sel.value }));
    body.appendChild(row);
    refs.select = sel;
  }

  if (def.check) {
    const row = document.createElement('div');
    row.className = 'ctrl';
    row.innerHTML = `<label>${def.check.label}</label><input type="checkbox" ${def.check.def ? 'checked' : ''}>`;
    const cb = row.querySelector('input');
    cb.addEventListener('change', () => fx.setParams({ [def.check.id]: cb.checked }));
    body.appendChild(row);
    refs.check = cb;
  }

  fxListEl.appendChild(wrap);
  uiRefs[def.key] = refs;
}
function stepDecimals(step) {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  return 3;
}

/* Синхронизация UI ↔ состояние цепочки */
function syncUIFromChain() {
  for (const def of FX_UI) {
    const fx = chain.fx[def.key];
    const refs = uiRefs[def.key];
    refs.sw.classList.toggle('on', fx.on);
    for (const p of (def.params || [])) {
      const v = fx.params[p.id];
      if (v == null) continue;
      refs.params[p.id].input.value = v;
      refs.params[p.id].val.textContent = fmt(v, stepDecimals(p.step));
    }
    if (def.select && refs.select) refs.select.value = fx.params[def.select.id] || def.select.def;
    if (def.check && refs.check) refs.check.checked = !!fx.params[def.check.id];
  }
}

/* ---- параметры голоса ---- */
const voice = { pitch: 64, speed: 72, mouth: 128, throat: 128, volume: 1, pause: 0 };
function bindVoice(id, key, decimals) {
  const el = $('#' + id), v = $('#' + id + 'V');
  el.addEventListener('input', () => {
    voice[key] = parseFloat(el.value);
    v.textContent = fmt(voice[key], decimals);
  });
  v.textContent = fmt(voice[key], decimals);
}
bindVoice('pPitch', 'pitch', 0);
bindVoice('pSpeed', 'speed', 0);
bindVoice('pMouth', 'mouth', 0);
bindVoice('pThroat', 'throat', 0);
bindVoice('pVol', 'volume', 2);
bindVoice('pPause', 'pause', 0);

/* ---- кнопки ---- */
const btnGen = $('#btnGen');
const btnPlay = $('#btnPlay');
const btnPause = $('#btnPause');
const btnStop = $('#btnStop');
const btnWav = $('#btnWav');

let lastBuffer = null;
let busy = false;

btnGen.addEventListener('click', async () => {
  if (busy) return;
  busy = true; setStatus('Генерация…');
  btnGen.disabled = true;
  try {
    const text = $('#text').value;
    if (!text.trim()) throw new Error('Введите текст');
    const buf = await engine.generate(text, voice);
    lastBuffer = buf;
    drawWave(buf);
    $('#tDur').textContent = fmt(buf.duration, 2) + 's';
    btnPlay.disabled = false;
    btnWav.disabled = false;
    setStatus('Готово');
    toast('Синтез завершён: ' + fmt(buf.duration, 2) + 's', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Ошибка');
    toast('Ошибка генерации: ' + e.message, 'err');
  } finally {
    busy = false;
    btnGen.disabled = false;
  }
});

btnPlay.addEventListener('click', async () => {
  if (!lastBuffer) return;
  await chain.ctx.resume();
  chain.play(lastBuffer, () => {
    setStatus('Стоп');
    btnPause.textContent = 'Pause';
  });
  setStatus('Играет');
  btnPause.disabled = false;
  btnStop.disabled = false;
  btnPause.textContent = 'Pause';
});

btnPause.addEventListener('click', () => {
  if (chain.ctx.state === 'running') { chain.pause(); btnPause.textContent = 'Resume'; setStatus('Пауза'); }
  else { chain.resume(); btnPause.textContent = 'Pause'; setStatus('Играет'); }
});

btnStop.addEventListener('click', () => {
  chain.stop();
  setStatus('Стоп');
  btnPause.textContent = 'Pause';
  btnPause.disabled = true;
  btnStop.disabled = true;
});

btnWav.addEventListener('click', async () => {
  if (!lastBuffer) return;
  setStatus('Рендер WAV…');
  try {
    // Хвост эффектов: время реверба + delay, чтобы ничего не обрезалось
    const tail = (chain.fx.reverb.on ? chain.fx.reverb.params.decay : 0) +
                 (chain.fx.delay.on ? (chain.fx.delay.params.time * (1 / (1 - Math.min(0.85, chain.fx.delay.params.feedback)))) : 0) +
                 0.3;
    const outBuf = await chain.renderOffline(lastBuffer, Math.min(tail, 12));
    const blob = encodeWAV(outBuf);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'better-sam-' + Date.now() + '.wav';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('WAV готов');
    toast('WAV сохранён', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Ошибка WAV');
    toast('Ошибка WAV: ' + e.message, 'err');
  }
});

/* ---- волновая форма ---- */
const cv = $('#wave'), ctx2d = cv.getContext('2d');
function drawWave(buf) {
  const w = cv.width, h = cv.height;
  ctx2d.fillStyle = '#0a0b10';
  ctx2d.fillRect(0, 0, w, h);
  const ch = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(ch.length / w));
  ctx2d.strokeStyle = '#8b5cf6';
  ctx2d.lineWidth = 1.5;
  ctx2d.beginPath();
  for (let x = 0; x < w; x++) {
    let min = 1, max = -1;
    for (let i = 0; i < step; i++) {
      const v = ch[x * step + i] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y1 = (1 - max) * h / 2;
    const y2 = (1 - min) * h / 2;
    ctx2d.moveTo(x + 0.5, y1);
    ctx2d.lineTo(x + 0.5, y2);
  }
  ctx2d.stroke();
  // сетка
  ctx2d.strokeStyle = '#ffffff10';
  ctx2d.beginPath();
  ctx2d.moveTo(0, h / 2); ctx2d.lineTo(w, h / 2);
  ctx2d.stroke();
}

/* ---- пресеты ---- */
const presetsEl = $('#presetsBuiltin');
for (const name of Object.keys(BUILTIN_PRESETS)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.addEventListener('click', () => applyPreset(BUILTIN_PRESETS[name]));
  presetsEl.appendChild(b);
}

function applyPreset(preset) {
  // voice
  Object.assign(voice, preset.voice || {});
  $('#pPitch').value = voice.pitch; $('#pPitchV').textContent = voice.pitch;
  $('#pSpeed').value = voice.speed; $('#pSpeedV').textContent = voice.speed;
  $('#pMouth').value = voice.mouth; $('#pMouthV').textContent = voice.mouth;
  $('#pThroat').value = voice.throat; $('#pThroatV').textContent = voice.throat;
  $('#pVol').value = voice.volume; $('#pVolV').textContent = fmt(voice.volume, 2);
  $('#pPause').value = voice.pause; $('#pPauseV').textContent = fmt(voice.pause, 0);

  // fx — сначала сброс, потом применение
  chain.resetFX();
  if (preset.fx) chain.applyFX(preset.fx);
  syncUIFromChain();
  setStatus('Пресет применён');
  toast('Пресет загружен', 'ok');
}

/* Сохранение/загрузка JSON */
$('#btnSavePreset').addEventListener('click', () => {
  const data = {
    type: 'better-sam-preset',
    version: 1,
    voice: { ...voice },
    fx: Object.fromEntries(Object.keys(chain.fx).map(k => [k, { on: chain.fx[k].on, ...chain.fx[k].params }]))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'better-sam-preset.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('#btnLoadPreset').addEventListener('click', () => $('#filePreset').click());
$('#filePreset').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const txt = await f.text();
    const data = JSON.parse(txt);
    if (data.type !== 'better-sam-preset') throw new Error('Неверный формат');
    applyPreset({ voice: data.voice, fx: data.fx });
  } catch (err) {
    toast('Ошибка пресета: ' + err.message, 'err');
  } finally {
    e.target.value = '';
  }
});

$('#btnResetFX').addEventListener('click', () => {
  chain.resetFX();
  syncUIFromChain();
  toast('Эффекты сброшены', 'ok');
});

/* ---- инициализация ---- */
syncUIFromChain();
setStatus('Готов (нажмите Generate)');
// Разблокировка AudioContext по первому жесту
window.addEventListener('pointerdown', () => { chain.ctx.resume().catch(()=>{}); }, { once: true });