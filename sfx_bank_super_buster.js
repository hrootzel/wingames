const RAT = {
  m2: 16 / 15,
  m3: 6 / 5,
  M3: 5 / 4,
  P4: 4 / 3,
  P5: 3 / 2,
  m7: 16 / 9,
  OCT: 2,
};

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function sizePitch(sizeIndex = 0, maxSize = 3) {
  const s = clamp(sizeIndex, 0, maxSize);
  const t = 1 - (s / Math.max(1, maxSize));
  return 260 + t * 520;
}

function cpSnap(sfx, delay = 0, vol = 0.06) {
  sfx.noise({ duration: 0.03, volume: vol * 0.45, tint: 0.35, delay });
  sfx.tone({
    freq: 230,
    type: 'sawtooth',
    duration: 0.028,
    volume: vol * 0.85,
    delay,
    slideTo: 180,
    slideMs: 0.024,
    jitter: 4,
  });
}

function cpBody(sfx, freq, delay = 0, vol = 0.08, dur = 0.11) {
  sfx.tone({
    freq,
    type: 'sawtooth',
    duration: dur,
    volume: vol,
    delay,
    slideTo: freq * 1.06,
    slideMs: dur * 0.52,
    jitter: 3,
  });
  sfx.tone({
    freq: freq * 0.5,
    type: 'triangle',
    duration: dur + 0.02,
    volume: vol * 0.6,
    delay: delay + 0.004,
    slideTo: freq * 0.47,
    slideMs: dur * 0.68,
  });
}

function cpStab(sfx, freq, delay = 0, vol = 0.06) {
  sfx.chord({
    freqs: [freq, freq * RAT.M3, freq * RAT.P5],
    duration: 0.1,
    type: 'sawtooth',
    volume: vol,
    spreadCents: 3,
    delay,
  });
}

export const BANK_SUPERBUSTER = {
  move: (sfx, p = {}) => {
    const k = p.fast ? 1.13 : 1.0;
    cpSnap(sfx, 0, 0.03);
    sfx.tone({
      freq: 170 * k,
      type: 'square',
      duty: 0.42,
      duration: 0.026,
      volume: 0.038,
      jitter: 5,
      slideTo: 200 * k,
      slideMs: 0.02,
    });
  },
  shoot: (sfx) => {
    cpSnap(sfx, 0, 0.09);
    cpBody(sfx, 560, 0.002, 0.1, 0.08);
    sfx.tone({
      freq: 980,
      type: 'square',
      duty: 0.1,
      duration: 0.055,
      volume: 0.055,
      delay: 0.01,
      slideTo: 1320,
      slideMs: 0.05,
      jitter: 8,
    });
  },
  harpoonTop: (sfx) => {
    cpSnap(sfx, 0, 0.05);
    cpStab(sfx, 760, 0.003, 0.04);
    sfx.tone({
      freq: 1200,
      type: 'square',
      duty: 0.14,
      duration: 0.04,
      volume: 0.04,
      delay: 0.006,
      jitter: 10,
    });
  },
  hit: (sfx, p = {}) => {
    const f = sizePitch(p.sizeIndex ?? 2, p.maxSize ?? 3);
    cpSnap(sfx, 0, 0.055);
    cpBody(sfx, f * 0.95, 0.003, 0.09, 0.085);
    sfx.tone({
      freq: f * RAT.P5,
      type: 'square',
      duty: 0.16,
      duration: 0.04,
      volume: 0.045,
      delay: 0.012,
      jitter: 7,
    });
  },
  split: (sfx, p = {}) => {
    const f = sizePitch(p.childSizeIndex ?? Math.max(0, (p.sizeIndex ?? 2) - 1), p.maxSize ?? 3);
    cpSnap(sfx, 0, 0.04);
    sfx.arp({ base: f, ratios: [1, RAT.M3, RAT.P5, RAT.OCT], stepMs: 28, type: 'sawtooth', volume: 0.085, duration: 0.045 });
    sfx.tone({ freq: f * 0.52, type: 'triangle', duration: 0.11, volume: 0.045, delay: 0.015 });
  },
  pop: (sfx, p = {}) => {
    const f = p.freq ?? 1100;
    cpSnap(sfx, 0, 0.06);
    sfx.tone({ freq: f, type: 'square', duty: 0.2, duration: 0.055, volume: 0.08, jitter: 10 });
    sfx.tone({ freq: f * RAT.m7, type: 'sawtooth', duration: 0.05, volume: 0.055, delay: 0.01, slideTo: f * RAT.OCT, slideMs: 0.04 });
    sfx.noise({ duration: 0.035, volume: 0.018, tint: 0.8, delay: 0.006 });
  },
  playerHit: (sfx) => {
    cpSnap(sfx, 0, 0.08);
    sfx.noise({ duration: 0.14, volume: 0.05, tint: 0.1, delay: 0.015 });
    cpBody(sfx, 220, 0, 0.11, 0.25);
    sfx.tone({ freq: 160, type: 'triangle', duration: 0.22, volume: 0.07, delay: 0.025, slideTo: 82, slideMs: 0.2 });
  },
  levelClear: (sfx, p = {}) => {
    const lvl = Math.max(1, p.level ?? 1);
    const base = 392 * (1 + Math.min(0.3, (lvl - 1) * 0.02));
    cpSnap(sfx, 0, 0.05);
    sfx.arp({ base, ratios: [1, RAT.M3, RAT.P5, RAT.OCT], stepMs: 52, type: 'sawtooth', volume: 0.1, duration: 0.07 });
    cpStab(sfx, base * 0.92, 0.27, 0.055);
    sfx.chord({ freqs: [base * 0.5, base * 0.75, base], duration: 0.24, type: 'triangle', volume: 0.05, delay: 0.26 });
    for (let i = 0; i < 3; i++) {
      sfx.tone({
        freq: 1220 + i * 135,
        type: 'square',
        duty: 0.1,
        duration: 0.02,
        volume: 0.028,
        delay: 0.2 + i * 0.05,
        jitter: 12,
      });
    }
  },
  gameOver: (sfx) => {
    cpSnap(sfx, 0, 0.05);
    cpBody(sfx, 205, 0, 0.11, 0.35);
    sfx.tone({ freq: 150, type: 'square', duty: 0.48, duration: 0.34, volume: 0.08, delay: 0.05, slideTo: 72, slideMs: 0.31 });
    sfx.noise({ duration: 0.24, volume: 0.05, tint: 0.09, delay: 0.12 });
    sfx.tone({ freq: 98 * RAT.m2, type: 'triangle', duration: 0.22, volume: 0.045, delay: 0.2, slideTo: 70, slideMs: 0.2 });
  },
};
