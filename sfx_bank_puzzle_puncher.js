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
