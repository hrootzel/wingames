export const BANK_PUZZLEPUNCHER = {
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
  hardDrop: (sfx) => {
    sfx.tone({ freq: 95, type: 'triangle', duration: 0.07, volume: 0.14 });
    sfx.tone({ freq: 260, type: 'square', duty: 0.25, duration: 0.04, volume: 0.08, delay: 0.01 });
    sfx.noise({ duration: 0.04, volume: 0.06, tint: 0.2, delay: 0.0 });
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
  power: (sfx, p) => {
    const size = Math.max(1, Math.min(12, p.power ?? 1));
    const base = 240 + size * 18;
    sfx.tone({ freq: base, type: 'triangle', duration: 0.09, volume: 0.12, slideTo: base * 1.25, slideMs: 0.08 });
  },
  diamond: (sfx) => {
    sfx.tone({ freq: 720, type: 'square', duty: 0.125, duration: 0.06, volume: 0.12, jitter: 8, slideTo: 980, slideMs: 0.05 });
    sfx.tone({ freq: 440, type: 'triangle', duration: 0.08, volume: 0.08, delay: 0.01 });
  },
  techBonus: (sfx) => {
    sfx.arp({ base: 520, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 45, type: 'square', volume: 0.1, duration: 0.06 });
  },
  chain: (sfx, p) => {
    const ch = Math.max(2, p.chain ?? 2);
    const base = 360 * Math.pow(1.08, Math.min(10, ch));
    sfx.arp({ base, ratios: [1, 6 / 5, 3 / 2, 2], stepMs: 35, type: 'square', volume: 0.1, duration: 0.045 });
  },
  allClear: (sfx) => {
    sfx.arp({ base: 420, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 60, type: 'square', volume: 0.11, duration: 0.08 });
    sfx.tone({ freq: 210, type: 'triangle', duration: 0.25, volume: 0.08, delay: 0.02 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 220, type: 'sawtooth', duration: 0.25, volume: 0.1, slideTo: 110, slideMs: 0.25 });
    sfx.tone({ freq: 165, type: 'triangle', duration: 0.28, volume: 0.08, delay: 0.06, slideTo: 82, slideMs: 0.28 });
    sfx.noise({ duration: 0.22, volume: 0.06, tint: 0.0, delay: 0.1 });
  },
};
