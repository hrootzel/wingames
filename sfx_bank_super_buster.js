const RAT = {
  m3: 6 / 5,
  M3: 5 / 4,
  P4: 4 / 3,
  P5: 3 / 2,
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

export const BANK_SUPERBUSTER = {
  move: (sfx, p = {}) => {
    const k = p.fast ? 1.1 : 1.0;
    sfx.tone({ freq: 180 * k, type: 'square', duty: 0.5, duration: 0.018, volume: 0.055, jitter: 6 });
    sfx.noise({ duration: 0.014, volume: 0.016, tint: 0.7, delay: 0.0 });
  },
  shoot: (sfx) => {
    sfx.tone({ freq: 520, type: 'square', duty: 0.125, duration: 0.06, volume: 0.1, jitter: 10, slideTo: 980, slideMs: 0.06 });
    sfx.noise({ duration: 0.02, volume: 0.02, tint: 0.25, delay: 0.0 });
  },
  harpoonTop: (sfx) => {
    sfx.tone({ freq: 820, type: 'square', duty: 0.25, duration: 0.03, volume: 0.07, jitter: 8 });
  },
  hit: (sfx, p = {}) => {
    const f = sizePitch(p.sizeIndex ?? 2, p.maxSize ?? 3);
    sfx.tone({ freq: f, type: 'triangle', duration: 0.045, volume: 0.11, jitter: 4 });
    sfx.noise({ duration: 0.03, volume: 0.03, tint: 0.15, delay: 0.0 });
  },
  split: (sfx, p = {}) => {
    const f = sizePitch(p.childSizeIndex ?? Math.max(0, (p.sizeIndex ?? 2) - 1), p.maxSize ?? 3);
    sfx.arp({ base: f, ratios: [1, RAT.M3, RAT.P5], stepMs: 32, type: 'square', volume: 0.09, duration: 0.05 });
  },
  pop: (sfx, p = {}) => {
    const f = p.freq ?? 1100;
    sfx.tone({ freq: f, type: 'square', duty: 0.25, duration: 0.05, volume: 0.1, jitter: 10 });
    sfx.tone({ freq: f * 1.5, type: 'triangle', duration: 0.03, volume: 0.05, delay: 0.01 });
  },
  playerHit: (sfx) => {
    sfx.noise({ duration: 0.1, volume: 0.06, tint: 0.05 });
    sfx.tone({ freq: 220, type: 'sawtooth', duration: 0.22, volume: 0.1, slideTo: 110, slideMs: 0.22 });
    sfx.tone({ freq: 165, type: 'triangle', duration: 0.2, volume: 0.06, delay: 0.03, slideTo: 82, slideMs: 0.2 });
  },
  levelClear: (sfx, p = {}) => {
    const lvl = Math.max(1, p.level ?? 1);
    const base = 392 * (1 + Math.min(0.25, (lvl - 1) * 0.02));
    sfx.arp({ base, ratios: [1, RAT.M3, RAT.P5, RAT.OCT], stepMs: 55, type: 'triangle', volume: 0.1, duration: 0.07 });
    sfx.chord({ freqs: [base, base * RAT.P5, base * RAT.OCT], duration: 0.22, type: 'square', volume: 0.06, delay: 0.3 });
    for (let i = 0; i < 3; i++) {
      sfx.tone({ freq: 1200 + i * 120, type: 'square', duty: 0.125, duration: 0.018, volume: 0.03, delay: 0.22 + i * 0.05, jitter: 12 });
    }
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.45, volume: 0.12, slideTo: 98, slideMs: 0.45 });
    sfx.tone({ freq: 146, type: 'square', duty: 0.5, duration: 0.35, volume: 0.08, delay: 0.06, slideTo: 73, slideMs: 0.35 });
    sfx.noise({ duration: 0.22, volume: 0.05, tint: 0.1, delay: 0.14 });
  },
};
