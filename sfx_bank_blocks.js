const RAT = {
  m3: 6 / 5,
  M3: 5 / 4,
  P5: 3 / 2,
  OCT: 2,
};

export const BANK_BLOCKS = {
  shift: (sfx) => {
    sfx.tone({ freq: 320, type: 'square', duty: 0.5, duration: 0.03, volume: 0.06, jitter: 2 });
  },
  rotate: (sfx) => {
    sfx.tone({ freq: 620, type: 'square', duty: 0.25, duration: 0.035, volume: 0.07, jitter: 1 });
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.04, volume: 0.03, delay: 0.01 });
  },
  lock: (sfx) => {
    sfx.tone({ freq: 130, type: 'triangle', duration: 0.08, volume: 0.12, slideTo: 92, slideMs: 0.08 });
    sfx.tone({ freq: 340, type: 'square', duty: 0.125, duration: 0.03, volume: 0.05, delay: 0.01 });
    sfx.noise({ duration: 0.03, volume: 0.04, tint: 0.2 });
  },
  hardDrop: (sfx) => {
    sfx.tone({ freq: 92, type: 'triangle', duration: 0.1, volume: 0.13, slideTo: 72, slideMs: 0.1 });
    sfx.noise({ duration: 0.05, volume: 0.05, tint: 0.12 });
  },
  lineClear: (sfx, p = {}) => {
    const lines = Math.max(1, Math.min(3, p.lines ?? 1));
    const base = 560 + (lines - 1) * 70;
    sfx.tone({ freq: base, type: 'square', duty: 0.25, duration: 0.06, volume: 0.09, jitter: 1 });
    sfx.tone({ freq: base * 0.5, type: 'triangle', duration: 0.08, volume: 0.05, delay: 0.01 });
  },
  tetris: (sfx) => {
    sfx.arp({ base: 392, ratios: [1, RAT.M3, RAT.P5, RAT.OCT], stepMs: 45, type: 'square', volume: 0.1, duration: 0.05 });
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.2, volume: 0.07, delay: 0.05 });
  },
  levelUp: (sfx) => {
    sfx.arp({ base: 330, ratios: [1, RAT.M3, RAT.P5], stepMs: 50, type: 'square', volume: 0.08, duration: 0.06 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.45, volume: 0.12, slideTo: 98, slideMs: 0.45 });
    sfx.tone({ freq: 146, type: 'square', duty: 0.5, duration: 0.35, volume: 0.08, delay: 0.06, slideTo: 73, slideMs: 0.35 });
    sfx.noise({ duration: 0.22, volume: 0.05, tint: 0.1, delay: 0.14 });
  },
};
