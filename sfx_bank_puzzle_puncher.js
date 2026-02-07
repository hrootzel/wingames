function cpsTransient(sfx, delay = 0, vol = 0.06) {
  sfx.noise({ duration: 0.045, volume: vol, tint: 0.35, delay });
  sfx.tone({
    freq: 240,
    type: 'sawtooth',
    duration: 0.035,
    volume: vol * 0.9,
    delay,
    slideTo: 180,
    slideMs: 0.03,
  });
}

function cpsBody(sfx, freq, delay = 0, vol = 0.08, dur = 0.11) {
  sfx.tone({
    freq,
    type: 'sawtooth',
    duration: dur,
    volume: vol,
    delay,
    slideTo: freq * 1.08,
    slideMs: dur * 0.5,
    jitter: 3,
  });
  sfx.tone({
    freq: freq * 0.5,
    type: 'triangle',
    duration: dur + 0.03,
    volume: vol * 0.62,
    delay: delay + 0.003,
    slideTo: freq * 0.47,
    slideMs: dur * 0.72,
  });
}

function cpsBrassStab(sfx, freq, delay = 0, vol = 0.07) {
  sfx.chord({
    freqs: [freq, freq * 1.2599, freq * 1.4983],
    duration: 0.11,
    type: 'sawtooth',
    volume: vol,
    spreadCents: 4,
    delay,
  });
  sfx.tone({
    freq: freq * 0.5,
    type: 'triangle',
    duration: 0.15,
    volume: vol * 0.55,
    delay: delay + 0.01,
    slideTo: freq * 0.55,
    slideMs: 0.1,
  });
}

function cpsCall(sfx, freq, delay = 0, vol = 0.08) {
  cpsTransient(sfx, delay, vol * 0.65);
  cpsBody(sfx, freq, delay, vol, 0.13);
}

export const BANK_PUZZLEPUNCHER = {
  move: (sfx) => {
    cpsTransient(sfx, 0, 0.03);
    sfx.tone({
      freq: 210,
      type: 'sawtooth',
      duration: 0.045,
      volume: 0.048,
      slideTo: 240,
      slideMs: 0.035,
      jitter: 2,
    });
  },

  rotate: (sfx) => {
    cpsTransient(sfx, 0, 0.035);
    cpsBody(sfx, 460, 0.002, 0.065, 0.09);
  },

  lock: (sfx) => {
    cpsTransient(sfx, 0, 0.06);
    cpsBody(sfx, 140, 0.002, 0.08, 0.11);
  },

  hardDrop: (sfx) => {
    cpsTransient(sfx, 0, 0.085);
    cpsBody(sfx, 98, 0.002, 0.12, 0.14);
    cpsBrassStab(sfx, 240, 0.02, 0.045);
  },

  clear: (sfx, p) => {
    const cleared = Math.max(1, p.cleared ?? 6);
    const chain = Math.max(1, p.chain ?? p.chainIndex ?? 1);
    const k = Math.min(2.2, 1 + cleared / 14 + chain * 0.07);
    cpsTransient(sfx, 0, 0.06);
    cpsBody(sfx, 460 * k, 0.005, 0.105, 0.12);
    cpsBrassStab(sfx, 300 * k, 0.018, 0.05);
  },

  power: (sfx, p) => {
    const size = Math.max(1, Math.min(20, p.power ?? 1));
    const base = 180 + size * 12;
    cpsTransient(sfx, 0, 0.05);
    cpsBrassStab(sfx, base, 0.004, 0.075);
    cpsBody(sfx, base * 0.75, 0.015, 0.07, 0.16);
  },

  diamond: (sfx, p) => {
    const chain = Math.max(1, p.chain ?? p.chainIndex ?? 1);
    const base = 420 * Math.min(1.75, 1 + chain * 0.06);
    cpsCall(sfx, base, 0, 0.1);
    cpsBrassStab(sfx, base * 0.82, 0.018, 0.06);
    sfx.arp({
      base: base * 0.58,
      ratios: [1, 4 / 3, 3 / 2, 2],
      stepMs: 36,
      type: 'sawtooth',
      volume: 0.07,
      duration: 0.075,
      delay: 0.03,
    });
  },

  techBonus: (sfx) => {
    cpsCall(sfx, 540, 0, 0.09);
    sfx.arp({
      base: 470,
      ratios: [1, 5 / 4, 3 / 2, 2, 5 / 2],
      stepMs: 40,
      type: 'sawtooth',
      volume: 0.08,
      duration: 0.07,
      delay: 0.02,
    });
    cpsBody(sfx, 250, 0.04, 0.055, 0.24);
  },

  chain: (sfx, p) => {
    const ch = Math.max(2, p.chain ?? p.chainIndex ?? 2);
    const base = 280 * Math.pow(1.07, Math.min(14, ch));
    const stepMs = Math.max(22, 36 - Math.min(11, ch));
    cpsTransient(sfx, 0, 0.045);
    sfx.arp({
      base,
      ratios: [1, 6 / 5, 3 / 2, 2],
      stepMs,
      type: 'sawtooth',
      volume: 0.09,
      duration: 0.065,
    });
    cpsBrassStab(sfx, base * 0.82, 0.022, 0.045);
    if (ch >= 4) {
      cpsCall(sfx, 360 + ch * 22, 0.03, 0.06);
    }
  },

  allClear: (sfx) => {
    cpsCall(sfx, 500, 0, 0.1);
    sfx.arp({
      base: 410,
      ratios: [1, 5 / 4, 3 / 2, 2, 5 / 2],
      stepMs: 52,
      type: 'sawtooth',
      volume: 0.1,
      duration: 0.09,
      delay: 0.015,
    });
    cpsBrassStab(sfx, 260, 0.04, 0.06);
    cpsBody(sfx, 180, 0.08, 0.05, 0.32);
  },

  gameOver: (sfx) => {
    cpsTransient(sfx, 0, 0.05);
    cpsBody(sfx, 210, 0, 0.1, 0.34);
    sfx.tone({ freq: 168, type: 'triangle', duration: 0.38, volume: 0.08, delay: 0.03, slideTo: 82, slideMs: 0.34 });
    sfx.noise({ duration: 0.32, volume: 0.055, tint: 0.1, delay: 0.08 });
    cpsBody(sfx, 88, 0.15, 0.055, 0.27);
  },

  warning: (sfx) => {
    cpsCall(sfx, 760, 0, 0.07);
    cpsBrassStab(sfx, 420, 0.045, 0.04);
  },

  garbageRise: (sfx) => {
    cpsTransient(sfx, 0, 0.075);
    cpsBody(sfx, 118, 0.002, 0.1, 0.17);
    cpsBrassStab(sfx, 180, 0.018, 0.04);
  },
};
