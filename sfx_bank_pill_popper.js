export const BANK_PILLPOPPER = {
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
