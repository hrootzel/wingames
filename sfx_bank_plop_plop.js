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
  hardDrop: (sfx) => {
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.06, volume: 0.11, slideTo: 140, slideMs: 0.06 });
    sfx.tone({ freq: 520, type: 'sine', duration: 0.03, volume: 0.06, delay: 0.01, slideTo: 380, slideMs: 0.03 });
    sfx.noise({ duration: 0.03, volume: 0.04, tint: 0.45, delay: 0.0 });
  },
  clear: (sfx, p) => {
    const cleared = Math.max(1, p.cleared ?? 4);
    const pops = Math.max(1, Math.min(5, Math.floor(cleared / 2)));
    const base = 520 + Math.min(240, cleared * 14);
    for (let i = 0; i < pops; i++) {
      const freq = base + i * 60;
      sfx.tone({
        freq,
        type: 'sine',
        duration: 0.05,
        volume: 0.1,
        jitter: 6,
        slideTo: freq * 1.2,
        slideMs: 0.05,
        delay: i * 0.015,
      });
    }
  },
  chain: (sfx, p) => {
    const ch = Math.max(2, p.chain ?? 2);
    const base = 460 * Math.pow(1.08, Math.min(12, ch));
    sfx.arp({ base, ratios: [1, 6 / 5, 3 / 2, 2], stepMs: 40, type: 'triangle', volume: 0.11, duration: 0.055 });
  },
  allClear: (sfx) => {
    sfx.arp({ base: 520, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 70, type: 'square', volume: 0.11, duration: 0.08 });
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.28, volume: 0.08, delay: 0.02 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.32, volume: 0.1, slideTo: 130, slideMs: 0.32 });
    sfx.noise({ duration: 0.18, volume: 0.04, tint: 0.35, delay: 0.1 });
  },
};
