export class SfxEngine {
  constructor(opts = {}) {
    this.masterLevel = typeof opts.master === 'number' ? opts.master : 0.6;
    this.enabled = opts.enabled !== undefined ? !!opts.enabled : true;

    this._ctx = null;
    this._master = null;
    this._compressor = null;

    this._rand = opts.rand ?? (() => Math.random());
    this._waves = new Map();
  }

  get ctx() {
    return this._ctx;
  }

  unlock() {
    if (!this.enabled) return;
    this._ensure();
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (this._master) {
      this._master.gain.value = this.enabled ? this.masterLevel : 0;
    }
  }

  setMaster(level) {
    const next = Number(level);
    if (!Number.isFinite(next)) return;
    this.masterLevel = Math.max(0, Math.min(1, next));
    if (this._master) {
      this._master.gain.value = this.enabled ? this.masterLevel : 0;
    }
  }

  tone(params = {}) {
    if (!this.enabled) return;
    this._ensure();

    const ctx = this._ctx;
    const t0 = ctx.currentTime + (params.delay ?? 0);
    const freq = params.freq ?? 440;
    const dur = params.duration ?? 0.08;
    const vol = params.volume ?? 0.12;
    const attack = params.attack ?? 0.002;
    const decay = params.decay ?? Math.max(0.02, dur - attack);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (params.duty) {
      osc.setPeriodicWave(this._getDutyWave(params.duty));
    } else {
      osc.type = params.type ?? 'square';
    }

    const det = params.detune ?? 0;
    const jitter = params.jitter ?? 0;
    const detJ = jitter ? (this._rand() * 2 - 1) * jitter : 0;

    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.setValueAtTime(det + detJ, t0);

    if (params.slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, params.slideTo),
        t0 + Math.max(0.01, params.slideMs ?? dur)
      );
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

    osc.connect(gain);
    gain.connect(this._compressor);

    osc.start(t0);
    osc.stop(t0 + dur);
  }

  noise(params = {}) {
    if (!this.enabled) return;
    this._ensure();

    const ctx = this._ctx;
    const t0 = ctx.currentTime + (params.delay ?? 0);
    const dur = params.duration ?? 0.1;
    const vol = params.volume ?? 0.1;
    const tint = params.tint ?? 0.0;

    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * dur));
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);

    let prev = 0;
    for (let i = 0; i < len; i++) {
      const w = this._rand() * 2 - 1;
      prev = prev + tint * (w - prev);
      data[i] = (1 - tint) * w + tint * prev;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const gain = ctx.createGain();
    const attack = params.attack ?? 0.002;
    const decay = params.decay ?? Math.max(0.02, dur - attack);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

    src.connect(gain);
    gain.connect(this._compressor);

    src.start(t0);
    src.stop(t0 + dur);
  }

  chord({ freqs = [440, 550], duration = 0.1, type = 'square', volume = 0.08, spreadCents = 3, delay = 0 } = {}) {
    for (let i = 0; i < freqs.length; i++) {
      this.tone({
        freq: freqs[i],
        duration,
        type,
        volume,
        jitter: 0,
        detune: (i - (freqs.length - 1) / 2) * spreadCents,
        delay,
      });
    }
  }

  arp({ base = 440, ratios = [1, 5 / 4, 3 / 2, 2], stepMs = 45, type = 'square', volume = 0.1, duration = 0.05, delay = 0 } = {}) {
    for (let i = 0; i < ratios.length; i++) {
      this.tone({
        freq: base * ratios[i],
        duration,
        type,
        volume,
        jitter: 6,
        delay: delay + (i * stepMs) / 1000,
      });
    }
  }

  play(bank, name, payload = {}) {
    if (!this.enabled) return;
    const fn = bank?.[name];
    if (typeof fn === 'function') fn(this, payload);
  }

  _ensure() {
    if (this._ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this._ctx = new Ctx();

    this._compressor = this._ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -18;
    this._compressor.knee.value = 24;
    this._compressor.ratio.value = 6;
    this._compressor.attack.value = 0.003;
    this._compressor.release.value = 0.12;

    this._master = this._ctx.createGain();
    this._master.gain.value = this.enabled ? this.masterLevel : 0;

    this._compressor.connect(this._master);
    this._master.connect(this._ctx.destination);
  }

  _getDutyWave(duty) {
    const d = duty;
    const key = `duty:${d}`;
    const cached = this._waves.get(key);
    if (cached) return cached;

    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);

    for (let k = 1; k < n; k++) {
      const amp = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
      imag[k] = amp;
      real[k] = 0;
    }

    const wave = this._ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    this._waves.set(key, wave);
    return wave;
  }
}

export const BANK_PUZZLEFIGHTER = {
  move: (sfx) => {
    sfx.tone({ freq: 180, type: 'square', duty: 0.25, duration: 0.03, volume: 0.08, jitter: 8 });
  },
  rotate: (sfx) => {
    sfx.tone({ freq: 520, type: 'square', duty: 0.125, duration: 0.035, volume: 0.1, jitter: 10 });
  },
  lock: (sfx) => {
    sfx.tone({ freq: 120, type: 'triangle', duration: 0.06, volume: 0.14 });
    sfx.noise({ duration: 0.04, volume: 0.06, tint: 0.35, delay: 0.0 });
  },
  clear: (sfx, p) => {
    const k = Math.min(1.8, 1 + ((p.cleared ?? 6) / 18));
    sfx.tone({
      freq: 680 * k,
      type: 'square',
      duty: 0.25,
      duration: 0.05,
      volume: 0.12,
      jitter: 12,
      slideTo: 900 * k,
      slideMs: 0.05,
    });
    sfx.noise({ duration: 0.06, volume: 0.05, tint: 0.1, delay: 0.01 });
  },
  chain: (sfx, p) => {
    const ch = Math.max(2, p.chain ?? 2);
    const base = 360 * Math.pow(1.08, Math.min(10, ch));
    sfx.arp({ base, ratios: [1, 6 / 5, 3 / 2, 2], stepMs: 35, type: 'square', volume: 0.1, duration: 0.045 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 220, type: 'sawtooth', duration: 0.25, volume: 0.1, slideTo: 110, slideMs: 0.25 });
    sfx.tone({ freq: 165, type: 'triangle', duration: 0.28, volume: 0.08, delay: 0.06, slideTo: 82, slideMs: 0.28 });
    sfx.noise({ duration: 0.22, volume: 0.06, tint: 0.0, delay: 0.1 });
  },
};

export const BANK_PUYO = {
  move: (sfx) => {
    sfx.tone({ freq: 240, type: 'triangle', duration: 0.03, volume: 0.07, jitter: 6 });
  },
  rotate: (sfx) => {
    sfx.tone({ freq: 420, type: 'triangle', duration: 0.035, volume: 0.08, jitter: 7 });
  },
  lock: (sfx) => {
    sfx.tone({ freq: 160, type: 'triangle', duration: 0.06, volume: 0.11 });
    sfx.noise({ duration: 0.03, volume: 0.04, tint: 0.55, delay: 0.0 });
  },
  clear: (sfx, p) => {
    const n = p.cleared ?? 4;
    const base = 520 + Math.min(220, n * 18);
    sfx.tone({ freq: base, type: 'sine', duration: 0.07, volume: 0.11, jitter: 6, slideTo: base * 1.35, slideMs: 0.07 });
  },
  chain: (sfx, p) => {
    const ch = Math.max(2, p.chain ?? 2);
    const base = 520 * Math.pow(1.06, Math.min(12, ch));
    sfx.arp({ base, ratios: [1, 5 / 4, 3 / 2], stepMs: 38, type: 'triangle', volume: 0.1, duration: 0.055 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.32, volume: 0.1, slideTo: 130, slideMs: 0.32 });
    sfx.noise({ duration: 0.18, volume: 0.04, tint: 0.35, delay: 0.1 });
  },
};

export const BANK_DRMARIO = {
  move: (sfx) => {
    sfx.tone({ freq: 200, type: 'square', duty: 0.5, duration: 0.03, volume: 0.07, jitter: 4 });
  },
  rotate: (sfx) => {
    sfx.tone({ freq: 440, type: 'square', duty: 0.25, duration: 0.035, volume: 0.09, jitter: 5 });
  },
  lock: (sfx) => {
    sfx.tone({ freq: 110, type: 'triangle', duration: 0.07, volume: 0.12 });
    sfx.tone({ freq: 330, type: 'square', duty: 0.125, duration: 0.03, volume: 0.06, delay: 0.01 });
    sfx.noise({ duration: 0.035, volume: 0.05, tint: 0.25, delay: 0.0 });
  },
  clear: (sfx, p) => {
    const v = p.viruses ?? 0;
    const base = 660 + (v * 90);
    sfx.tone({ freq: base, type: 'square', duty: 0.25, duration: 0.09, volume: 0.11, jitter: 4 });
    sfx.tone({ freq: base * 1.5, type: 'triangle', duration: 0.06, volume: 0.06, delay: 0.0 });
  },
  chain: (sfx, p) => {
    const ch = Math.max(2, p.chain ?? 2);
    const base = 440 * Math.pow(1.07, Math.min(10, ch));
    sfx.arp({ base, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 42, type: 'square', volume: 0.1, duration: 0.06 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.4, volume: 0.11, slideTo: 98, slideMs: 0.4 });
    sfx.tone({ freq: 146, type: 'square', duty: 0.5, duration: 0.32, volume: 0.07, delay: 0.06, slideTo: 73, slideMs: 0.32 });
    sfx.noise({ duration: 0.2, volume: 0.05, tint: 0.1, delay: 0.12 });
  },
};
