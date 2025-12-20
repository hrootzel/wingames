export const BANK_PLOPPLOP = {
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
